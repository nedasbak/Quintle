import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { buildAnswerIndex, getDailyChallenge, normalizeAnswer } from '../../shared/challenges.mjs';
import { findMatchingAnswer } from '../../shared/answerMatching.mjs';
import { calculateScore, GAME_DURATION, MAX_ANSWERS, remainingTime } from '../../shared/gameRules.mjs';

interface Session extends RowDataPacket {
  id: string;
  challenge_id: number;
  challenge_date: string;
  started_at: Date;
  expires_at: Date;
  finished_at: Date | null;
  status: 'active' | 'completed' | 'expired';
  correct_answers: number;
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
  buildAnswerIndex(challenge.answers, MAX_ANSWERS);
  for (const variants of challenge.answers) {
    const [answer] = await connection.execute<ResultSetHeader>(
      'INSERT INTO accepted_answers (challenge_id, challenge_date, answer) VALUES (?, ?, ?)',
      [insert.insertId, challenge.date, variants[0]],
    );
    for (const key of new Set(variants.map(normalizeAnswer))) {
      await connection.execute('INSERT INTO answer_keys (challenge_date, normalized_key, answer_id) VALUES (?, ?, ?)',
        [challenge.date, key, answer.insertId]);
    }
  }
}

// Vieno žaidėjo užklausa užrakinama transakcijoje: vienalaikiai atsakymai nedubliuoja taškų.
export function createGameService(pool: Pool, clock: () => number = Date.now) {
  return async function play(tokenHash: Buffer, action: Action, input?: string) {
    const connection = await pool.getConnection();
    try {
      await connection.query("SET time_zone = '+00:00'");
      await connection.beginTransaction();
      await connection.execute('INSERT INTO players (id, token_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = id', [randomUUID(), tokenHash]);
      const [[player]] = await connection.execute<RowDataPacket[]>(
        'SELECT id AS player_id FROM players WHERE token_hash = ? FOR UPDATE', [tokenHash],
      );
      const now = clock();
      const today = getDailyChallenge(now).date;
      await ensureChallenge(connection, now);
      const [[active]] = await connection.execute<Session[]>(
        "SELECT * FROM game_sessions WHERE player_id = ? AND status = 'active' ORDER BY started_at DESC, id DESC LIMIT 1 FOR UPDATE",
        [player.player_id],
      );
      const [[daily]] = active ? [[]] : await connection.execute<Session[]>(
        'SELECT * FROM game_sessions WHERE player_id = ? AND challenge_date = ? FOR UPDATE', [player.player_id, today],
      );
      let session = active ?? daily;
      // An unattended attempt expires at its original deadline, even after UTC midnight.
      const expired = session?.status === 'active' && now >= session.expires_at.getTime();
      if (session && expired) {
        await connection.execute("UPDATE game_sessions SET status = 'expired', finished_at = ? WHERE id = ?",
          [session.expires_at, session.id]);
        session.status = 'expired';
      }
      // The next Start must use today's session without consuming an extra click.
      if (action === 'start' && session?.status === 'expired' && session.challenge_date !== today) {
        const [[current]] = await connection.execute<Session[]>(
          'SELECT * FROM game_sessions WHERE player_id = ? AND challenge_date = ? FOR UPDATE', [player.player_id, today],
        );
        session = current;
      }
      const date = session?.challenge_date ?? today;
      const [[challenge]] = await connection.execute<RowDataPacket[]>(
        `SELECT category, prompt, time_limit, required_answers, is_active,
          (SELECT COUNT(DISTINCT answer_id) FROM answer_keys WHERE challenge_date = ?) AS answer_count
        FROM daily_challenges WHERE challenge_date = ? FOR SHARE`, [date, date]);
      const available = Boolean(challenge.is_active) && challenge.time_limit * 1000 === GAME_DURATION
        && challenge.required_answers === MAX_ANSWERS && challenge.answer_count >= challenge.required_answers;
      let accepted = false;
      let activityAt: Date | null = null;
      let feedback = { kind: 'hint', text: expired && session?.status === 'expired'
        ? 'Time’s up. Every answer counts.' : 'You’ve got this. Enter your first answer.' };
      if (!session && !available) feedback = { kind: 'hint', text: "Today's challenge is unavailable. Please check again later." };

      // Terminą nustato serveris; klientas negali pateikti savo laiko ar galutinio rezultato.
      if (action === 'start' && !session && available) {
        const sessionId = randomUUID();
        await connection.execute(
          'INSERT INTO game_sessions (id, player_id, challenge_id, challenge_date, started_at, created_at) SELECT ?, ?, id, challenge_date, ?, ? FROM daily_challenges WHERE challenge_date = ?',
          [sessionId, player.player_id, new Date(now), new Date(now), today],
        );
        const [[started]] = await connection.execute<Session[]>('SELECT * FROM game_sessions WHERE id = ?', [sessionId]);
        session = started;
        activityAt = new Date(now);
      } else if (action === 'answer' && session && session.status !== 'completed') {
        const expired = session.status === 'expired';
        const normalized = normalizeAnswer(input!);
        let [[answer]] = expired ? [[]] : await connection.execute<RowDataPacket[]>(
          'SELECT a.id AS answer_id, a.answer AS display_answer FROM answer_keys k JOIN accepted_answers a ON a.id = k.answer_id WHERE k.challenge_date = ? AND k.normalized_key = ?',
          [session.challenge_date, normalized],
        );
        if (!expired && !answer) {
          const [keys] = await connection.execute<RowDataPacket[]>(
            'SELECT k.normalized_key, a.id AS answer_id, a.answer AS display_answer FROM answer_keys k JOIN accepted_answers a ON a.id = k.answer_id WHERE k.challenge_date = ?',
            [session.challenge_date]);
          const index = new Map(keys.map(key => [normalizeAnswer(key.normalized_key), String(key.answer_id)]));
          const storedNames = new Map(keys.map(key => [key.display_answer, String(key.answer_id)]));
          for (const variants of getDailyChallenge(Date.parse(session.challenge_date)).answers) {
            const id = storedNames.get(variants[0]);
            if (!id) continue;
            for (const variant of variants) if (!index.has(normalizeAnswer(variant))) index.set(normalizeAnswer(variant), id);
          }
          const matchedId = findMatchingAnswer(index, normalized);
          answer = keys.find(key => String(key.answer_id) === matchedId)!;
        }
        const [[duplicate]] = answer ? await connection.execute<RowDataPacket[]>(
          "SELECT id FROM player_submissions WHERE session_id = ? AND answer_id = ? AND result = 'correct'", [session.id, answer.answer_id],
        ) : [[]];
        const result = expired ? 'expired' : !answer ? 'incorrect' : duplicate ? 'duplicate' : 'correct';
        await connection.execute(
          'INSERT INTO player_submissions (session_id, challenge_date, submitted_at, submitted_text, normalized_text, response_time_ms, result, answer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [session.id, session.challenge_date, new Date(now), input, normalized,
            Math.max(0, now - session.started_at.getTime()), result, answer?.answer_id ?? null],
        );
        accepted = result === 'correct';
        await connection.execute('UPDATE game_sessions SET total_submissions = total_submissions + 1 WHERE id = ?', [session.id]);
        activityAt = new Date(now);
        if (accepted) {
          const count = session.correct_answers + 1;
          await connection.execute('UPDATE game_sessions SET correct_answers = ?, status = ?, finished_at = ? WHERE id = ?',
            [count, count === MAX_ANSWERS ? 'completed' : 'active', count === MAX_ANSWERS ? new Date(now) : null, session.id]);
          feedback = { kind: 'success', text: count === MAX_ANSWERS ? 'Five for five. Beautifully done.' : `${answer!.display_answer} is in. Keep going!` };
        } else {
          feedback = { kind: 'error', text: expired ? 'Time is up. That answer arrived too late.'
            : result === 'duplicate' ? 'Already on your list. Think of another!' : 'Not quite. Try another answer.' };
        }
      }

      // Rezultatas ir atsakymų sąrašas skaitomi iš tos pačios patvirtintos serverio būsenos.
      if (session) {
        const [[updated]] = await connection.execute<Session[]>('SELECT * FROM game_sessions WHERE id = ?', [session.id]);
        session = updated;
      }
      const [answers] = session ? await connection.execute<RowDataPacket[]>(
        "SELECT a.answer AS display_answer FROM player_submissions s JOIN accepted_answers a ON a.id = s.answer_id WHERE s.session_id = ? AND s.result = 'correct' ORDER BY s.id", [session.id],
      ) : [[]];
      const finished = !!session?.finished_at;
      const remaining = session ? remainingTime(session.started_at.getTime(), session.finished_at?.getTime() ?? now) : GAME_DURATION;
      const correctness = calculateScore(session?.correct_answers ?? 0, 0);
      const total = calculateScore(session?.correct_answers ?? 0, finished ? remaining : 0);
      if (finished && Number(session!.score) !== total) throw new Error('Database scoring differs from game rules. Apply the precise-scoring migration.');
      const [results] = await connection.execute<RowDataPacket[]>(
        'SELECT challenge_date AS date, correct_answers AS correct, score FROM game_sessions WHERE player_id = ? AND finished_at IS NOT NULL ORDER BY challenge_date', [player.player_id],
      );
      const completed = results.filter(result => result.date <= today);
      let streak = 0, longest = 0, lastDate: string | null = null;
      for (const result of completed) {
        streak = lastDate && Date.parse(result.date) - Date.parse(lastDate) === 86_400_000 ? streak + 1 : 1;
        longest = Math.max(longest, streak);
        lastDate = result.date;
      }
      if (!lastDate || Date.parse(today) - Date.parse(lastDate) > 86_400_000) streak = 0;
      await connection.execute(`UPDATE players SET current_streak = ?, longest_streak = ?, last_completed_date = ?,
        total_games = ?, total_score = ?, last_played_at = COALESCE(?, last_played_at) WHERE id = ?`,
      [streak, longest, lastDate, completed.length, completed.reduce((sum, result) => sum + Number(result.score), 0), activityAt, player.player_id]);
      const response = {
        game: {
          challenge: { date, number: getDailyChallenge(Date.parse(date)).number, category: challenge.category, prompt: challenge.prompt },
          status: !session ? available ? 'ready' : 'unavailable' : finished ? 'finished' : 'playing',
          answers: answers.map(answer => answer.display_answer as string),
          startedAt: session?.started_at.getTime() ?? null,
          finishedAt: session?.finished_at?.getTime() ?? null,
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
