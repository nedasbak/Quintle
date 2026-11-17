import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getDailyChallenge, normalizeAnswer } from '../../shared/challenges.mjs';
import { calculateScore, GAME_DURATION, MAX_ANSWERS, remainingTime } from '../../shared/gameRules.mjs';

interface Session extends RowDataPacket {
  session_id: number;
  challenge_date: string;
  started_at_utc: Date;
  finished_at_utc: Date | null;
  status: 'in_progress' | 'solved' | 'timed_out';
  correct_count: number;
  score: number | null;
}

type Action = 'read' | 'start' | 'answer';

// Jei dienos turinio dar nėra, įrašomos jau projekte esančios kategorijos ir jų sinonimai.
async function ensureChallenge(connection: PoolConnection, now: number) {
  const challenge = getDailyChallenge(now);
  const [insert] = await connection.execute<ResultSetHeader>(
    'INSERT IGNORE INTO daily_challenges (challenge_date, category, prompt) VALUES (?, ?, ?)',
    [challenge.date, challenge.category, `Name ${MAX_ANSWERS} ${challenge.title.charAt(0).toLowerCase()}${challenge.title.slice(1)}`],
  );
  if (!insert.affectedRows) return;
  for (const variants of challenge.answers) {
    const [answer] = await connection.execute<ResultSetHeader>(
      'INSERT INTO accepted_answers (challenge_id, challenge_date, display_answer) VALUES (?, ?, ?)',
      [insert.insertId, challenge.date, variants[0]],
    );
    for (const key of new Set(variants.map(normalizeAnswer))) {
      await connection.execute('INSERT INTO answer_keys (challenge_date, normalized_answer, answer_id) VALUES (?, ?, ?)',
        [challenge.date, key, answer.insertId]);
    }
  }
}

// Vieno žaidėjo užklausa užrakinama transakcijoje: vienalaikiai atsakymai nedubliuoja taškų.
export function createGameService(pool: Pool, clock: () => number = Date.now) {
  return async function play(tokenHash: Buffer, action: Action, input?: string) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('INSERT IGNORE INTO players (token_hash) VALUES (?)', [tokenHash]);
      const [[player]] = await connection.execute<RowDataPacket[]>(
        'SELECT player_id FROM players WHERE token_hash = ? FOR UPDATE', [tokenHash],
      );
      const now = clock();
      const today = getDailyChallenge(now).date;
      await ensureChallenge(connection, now);
      const [[active]] = await connection.execute<Session[]>(
        "SELECT * FROM game_sessions WHERE player_id = ? AND status = 'in_progress' ORDER BY session_id DESC LIMIT 1 FOR UPDATE",
        [player.player_id],
      );
      const [[daily]] = active ? [[]] : await connection.execute<Session[]>(
        'SELECT * FROM game_sessions WHERE player_id = ? AND challenge_date = ? FOR UPDATE', [player.player_id, today],
      );
      let session = active ?? daily;
      let accepted = false;
      let feedback = { kind: 'hint', text: 'You’ve got this. Enter your first answer.' };

      // Terminą nustato serveris; klientas negali pateikti savo laiko ar galutinio rezultato.
      if (session?.status === 'in_progress' && remainingTime(session.started_at_utc.getTime(), now) === 0) {
        await connection.execute("UPDATE game_sessions SET status = 'timed_out', finished_at_utc = ? WHERE session_id = ?",
          [new Date(session.started_at_utc.getTime() + GAME_DURATION), session.session_id]);
        session.status = 'timed_out';
        feedback = { kind: 'hint', text: 'Time’s up. Every answer counts.' };
      }
      if (action === 'start' && !session) {
        const [created] = await connection.execute<ResultSetHeader>(
          'INSERT INTO game_sessions (player_id, challenge_date, started_at_utc) VALUES (?, ?, ?)',
          [player.player_id, today, new Date(now)],
        );
        const [[started]] = await connection.execute<Session[]>('SELECT * FROM game_sessions WHERE session_id = ?', [created.insertId]);
        session = started;
      } else if (action === 'answer' && session?.status === 'in_progress') {
        const [[answer]] = await connection.execute<RowDataPacket[]>(
          'SELECT a.answer_id, a.display_answer FROM answer_keys k JOIN accepted_answers a ON a.answer_id = k.answer_id WHERE k.challenge_date = ? AND k.normalized_answer = ?',
          [session.challenge_date, normalizeAnswer(input!)],
        );
        const [[duplicate]] = answer ? await connection.execute<RowDataPacket[]>(
          "SELECT submission_id FROM player_submissions WHERE session_id = ? AND answer_id = ? AND outcome = 'correct'", [session.session_id, answer.answer_id],
        ) : [[]];
        const outcome = !answer ? 'incorrect' : duplicate ? 'duplicate' : 'correct';
        await connection.execute(
          'INSERT INTO player_submissions (session_id, challenge_date, submitted_at_utc, guess, outcome, answer_id) VALUES (?, ?, ?, ?, ?, ?)',
          [session.session_id, session.challenge_date, new Date(now), input, outcome, answer?.answer_id ?? null],
        );
        accepted = outcome === 'correct';
        if (accepted) {
          const count = session.correct_count + 1;
          await connection.execute('UPDATE game_sessions SET correct_count = ?, status = ?, finished_at_utc = ? WHERE session_id = ?',
            [count, count === MAX_ANSWERS ? 'solved' : 'in_progress', count === MAX_ANSWERS ? new Date(now) : null, session.session_id]);
          feedback = { kind: 'success', text: count === MAX_ANSWERS ? 'Five for five. Beautifully done.' : `${answer!.display_answer} is in. Keep going!` };
        } else {
          feedback = { kind: 'error', text: outcome === 'duplicate' ? 'Already on your list. Think of another!' : 'Not quite. Try another answer.' };
        }
      }

      // Rezultatas ir atsakymų sąrašas skaitomi iš tos pačios patvirtintos serverio būsenos.
      if (session) {
        const [[updated]] = await connection.execute<Session[]>('SELECT * FROM game_sessions WHERE session_id = ?', [session.session_id]);
        session = updated;
      }
      const date = session?.challenge_date ?? today;
      const [[challenge]] = await connection.execute<RowDataPacket[]>('SELECT category, prompt FROM daily_challenges WHERE challenge_date = ?', [date]);
      const [answers] = session ? await connection.execute<RowDataPacket[]>(
        "SELECT a.display_answer FROM player_submissions s JOIN accepted_answers a ON a.answer_id = s.answer_id WHERE s.session_id = ? AND s.outcome = 'correct' ORDER BY s.submission_id", [session.session_id],
      ) : [[]];
      const finished = !!session?.finished_at_utc;
      const remaining = session ? remainingTime(session.started_at_utc.getTime(), session.finished_at_utc?.getTime() ?? now) : GAME_DURATION;
      const correctness = calculateScore(session?.correct_count ?? 0, 0);
      const total = calculateScore(session?.correct_count ?? 0, finished ? remaining : 0);
      if (finished && Number(session!.score) !== total) throw new Error('Database scoring differs from game rules. Apply the precise-scoring migration.');
      const [results] = await connection.execute<RowDataPacket[]>(
        'SELECT challenge_date AS date, correct_count AS correct, score FROM game_sessions WHERE player_id = ? AND finished_at_utc IS NOT NULL ORDER BY challenge_date', [player.player_id],
      );
      const response = {
        game: {
          challenge: { date, number: getDailyChallenge(Date.parse(date)).number, category: challenge.category, prompt: challenge.prompt },
          status: !session ? 'ready' : finished ? 'finished' : 'playing',
          answers: answers.map(answer => answer.display_answer as string),
          startedAt: session?.started_at_utc.getTime() ?? null,
          finishedAt: session?.finished_at_utc?.getTime() ?? null,
          score: { correctness, speed: total - correctness, total },
        },
        serverNow: now, accepted, feedback,
        results: results.map(result => ({ date: result.date as string, correct: Number(result.correct), score: Number(result.score) })),
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
