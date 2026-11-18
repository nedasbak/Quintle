import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';

import {
  buildAnswerIndex,
  getDailyChallenge,
  normalizeAnswer,
} from '../../shared/challenges.mjs';

import {
  calculateScore,
  GAME_DURATION,
  MAX_ANSWERS,
  remainingTime,
} from '../../shared/gameRules.mjs';

interface Session extends RowDataPacket {
  session_id: number;
  player_id: number;
  challenge_date: string;
  started_at_utc: Date;
  finished_at_utc: Date | null;
  status: 'in_progress' | 'solved' | 'timed_out';
  correct_count: number;
  remaining_seconds: number | null;
  score: number | null;
}

type Action = 'read' | 'start' | 'answer';

// Create today's challenge and safely seed its accepted answers.
// The challenge row lock prevents concurrent players from duplicating
// the answer records during initialization.
async function ensureChallenge(
  connection: PoolConnection,
  now: number,
) {
  const challenge = getDailyChallenge(now);

  await connection.execute(
    `INSERT IGNORE INTO daily_challenges
      (challenge_date, category, prompt)
     VALUES (?, ?, ?)`,
    [
      challenge.date,
      challenge.category,
      `Name ${MAX_ANSWERS} ${challenge.title.charAt(0).toLowerCase()}${challenge.title.slice(1)}`,
    ],
  );

  await connection.execute(
    'SELECT challenge_date FROM daily_challenges WHERE challenge_date = ? FOR UPDATE',
    [challenge.date],
  );

  buildAnswerIndex(challenge.answers, MAX_ANSWERS);

  for (const variants of challenge.answers) {
    const displayAnswer = variants[0];

    const [[existing]] = await connection.execute<RowDataPacket[]>(
      `SELECT answer_id
       FROM accepted_answers
       WHERE challenge_date = ? AND display_answer = ?
       LIMIT 1`,
      [challenge.date, displayAnswer],
    );

    let answerId: number;

    if (existing) {
      answerId = Number(existing.answer_id);
    } else {
      const [insert] = await connection.execute<ResultSetHeader>(
        `INSERT INTO accepted_answers
          (challenge_date, display_answer)
         VALUES (?, ?)`,
        [challenge.date, displayAnswer],
      );

      answerId = insert.insertId;
    }

    for (const key of new Set(variants.map(normalizeAnswer))) {
      await connection.execute(
        `INSERT IGNORE INTO answer_keys
          (challenge_date, normalized_answer, answer_id)
         VALUES (?, ?, ?)`,
        [challenge.date, key, answerId],
      );
    }
  }
}

// All actions for one player are serialized using a database transaction.
export function createGameService(
  pool: Pool,
  clock: () => number = Date.now,
) {
  return async function play(
    tokenHash: Buffer,
    action: Action,
    input?: string,
  ) {
    const connection = await pool.getConnection();

    try {
      await connection.query("SET time_zone = '+00:00'");
      await connection.beginTransaction();

      // MySQL generates the BIGINT player_id.
      await connection.execute(
        'INSERT IGNORE INTO players (token_hash) VALUES (?)',
        [tokenHash],
      );

      const [[player]] = await connection.execute<RowDataPacket[]>(
        'SELECT player_id FROM players WHERE token_hash = ? FOR UPDATE',
        [tokenHash],
      );

      if (!player) {
        throw new Error('Unable to create or retrieve player.');
      }

      const now = clock();
      const today = getDailyChallenge(now).date;

      await ensureChallenge(connection, now);

      // Find an existing unfinished session.
      const [activeRows] = await connection.execute<Session[]>(
        `SELECT *
         FROM game_sessions
         WHERE player_id = ? AND status = 'in_progress'
         ORDER BY started_at_utc DESC, session_id DESC
         LIMIT 1 FOR UPDATE`,
        [player.player_id],
      );

      let session: Session | undefined = activeRows[0];

      // Otherwise, find this player's session for today's challenge.
      if (!session) {
        const [dailyRows] = await connection.execute<Session[]>(
          `SELECT *
           FROM game_sessions
           WHERE player_id = ? AND challenge_date = ?
           FOR UPDATE`,
          [player.player_id, today],
        );

        session = dailyRows[0];
      }

      const date = session?.challenge_date ?? today;

      const [[challenge]] = await connection.execute<RowDataPacket[]>(
        `SELECT category, prompt
         FROM daily_challenges
         WHERE challenge_date = ?
         FOR SHARE`,
        [date],
      );

      if (!challenge) {
        throw new Error(`Challenge not found for ${date}.`);
      }

      const available = true;

      let accepted = false;
      let feedback = {
        kind: 'hint',
        text: 'You’ve got this. Enter your first answer.',
      };

      // The server controls expiration.
      if (session?.status === 'in_progress') {
        const startedAt = new Date(session.started_at_utc).getTime();
        const expiresAt = startedAt + GAME_DURATION;

        if (now >= expiresAt) {
          await connection.execute(
            `UPDATE game_sessions
             SET status = 'timed_out',
                 finished_at_utc = ?
             WHERE session_id = ?`,
            [new Date(expiresAt), session.session_id],
          );

          session.status = 'timed_out';
          session.finished_at_utc = new Date(expiresAt);

          feedback = {
            kind: 'hint',
            text: 'Time’s up. Every answer counts.',
          };
        }
      }

      // Start a new session.
      if (action === 'start' && !session && available) {
        const [insert] = await connection.execute<ResultSetHeader>(
          `INSERT INTO game_sessions
            (player_id, challenge_date, started_at_utc)
           VALUES (?, ?, ?)`,
          [player.player_id, today, new Date(now)],
        );

        const [[started]] = await connection.execute<Session[]>(
          'SELECT * FROM game_sessions WHERE session_id = ?',
          [insert.insertId],
        );

        if (!started) {
          throw new Error('Unable to create game session.');
        }

        session = started;
      }

      // Process an answer.
      if (
        action === 'answer' &&
        session?.status === 'in_progress'
      ) {
        const normalized = normalizeAnswer(input ?? '');

        const [[answer]] = normalized
          ? await connection.execute<RowDataPacket[]>(
              `SELECT
                 a.answer_id,
                 a.display_answer
               FROM answer_keys k
               JOIN accepted_answers a
                 ON a.answer_id = k.answer_id
               WHERE k.challenge_date = ?
                 AND k.normalized_answer = ?`,
              [session.challenge_date, normalized],
            )
          : [[]];

        const [[duplicate]] = answer
          ? await connection.execute<RowDataPacket[]>(
              `SELECT submission_id
               FROM player_submissions
               WHERE session_id = ?
                 AND answer_id = ?
                 AND outcome = 'correct'
               LIMIT 1`,
              [session.session_id, answer.answer_id],
            )
          : [[]];

        const result = !answer
          ? 'incorrect'
          : duplicate
            ? 'duplicate'
            : 'correct';

        await connection.execute(
          `INSERT INTO player_submissions
            (session_id, challenge_date, guess, outcome, answer_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            session.session_id,
            session.challenge_date,
            input ?? '',
            result,
            answer?.answer_id ?? null,
          ],
        );

        accepted = result === 'correct';

        if (accepted) {
          const count = Number(session.correct_count) + 1;
          const solved = count >= MAX_ANSWERS;

          await connection.execute(
            `UPDATE game_sessions
             SET correct_count = ?,
                 status = ?,
                 finished_at_utc = ?
             WHERE session_id = ?`,
            [
              count,
              solved ? 'solved' : 'in_progress',
              solved ? new Date(now) : null,
              session.session_id,
            ],
          );

          feedback = {
            kind: 'success',
            text: solved
              ? 'Five for five. Beautifully done.'
              : `${answer.display_answer} is in. Keep going!`,
          };
        } else {
          feedback = {
            kind: 'error',
            text: result === 'duplicate'
              ? 'Already on your list. Think of another!'
              : 'Not quite. Try another answer.',
          };
        }
      } else if (action === 'answer' && session?.status === 'timed_out') {
        feedback = {
          kind: 'error',
          text: 'Time is up. That answer arrived too late.',
        };
      } else if (action === 'answer' && session?.status === 'solved') {
        feedback = {
          kind: 'hint',
          text: 'This challenge is already completed.',
        };
      }

      // Reload the authoritative session, including generated columns.
      if (session) {
        const [[updated]] = await connection.execute<Session[]>(
          'SELECT * FROM game_sessions WHERE session_id = ?',
          [session.session_id],
        );

        if (!updated) {
          throw new Error('Game session disappeared.');
        }

        session = updated;
      }

      // Retrieve accepted answers in submission order.
      const [answers] = session
        ? await connection.execute<RowDataPacket[]>(
            `SELECT a.display_answer
             FROM player_submissions s
             JOIN accepted_answers a
               ON a.answer_id = s.answer_id
             WHERE s.session_id = ?
               AND s.outcome = 'correct'
             ORDER BY s.submission_id`,
            [session.session_id],
          )
        : [[]];

      const finished = !!session &&
        session.status !== 'in_progress';

      const startedAt = session
        ? new Date(session.started_at_utc).getTime()
        : null;

      const finishedAt = session?.finished_at_utc
        ? new Date(session.finished_at_utc).getTime()
        : null;

      const remaining = session
        ? remainingTime(startedAt!, finishedAt ?? now)
        : GAME_DURATION;

      const correctCount = Number(session?.correct_count ?? 0);

      const correctness = calculateScore(correctCount, 0);

      const total = calculateScore(
        correctCount,
        finished ? remaining : 0,
      );

      // Return completed game history.
      const [results] = await connection.execute<RowDataPacket[]>(
        `SELECT
           challenge_date AS date,
           correct_count AS correct,
           score
         FROM game_sessions
         WHERE player_id = ?
           AND finished_at_utc IS NOT NULL
         ORDER BY challenge_date`,
        [player.player_id],
      );

      const response = {
        game: {
          challenge: {
            date,
            number: getDailyChallenge(Date.parse(date)).number,
            category: challenge.category,
            prompt: challenge.prompt,
          },
          status: !session
            ? available ? 'ready' : 'unavailable'
            : finished ? 'finished' : 'playing',
          answers: answers.map(
            answer => answer.display_answer as string,
          ),
          startedAt,
          finishedAt,
          score: {
            correctness,
            speed: total - correctness,
            total,
          },
        },
        serverNow: now,
        accepted,
        feedback,
        results: results.map(result => ({
          date: result.date as string,
          correct: Number(result.correct),
          score: Number(result.score ?? 0),
        })),
      };

      await connection.commit();

      return response;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
