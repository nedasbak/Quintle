import { randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getPracticeChallenge } from '../../shared/practiceChallenges.mjs';
import { calculateScore } from '../../shared/gameRules.mjs';
import { getDailyChallenge } from '../../shared/challenges.mjs';

interface PracticeSession extends RowDataPacket {
  id: string;
  challenge_key: string;
  theme: string;
  category: string;
  prompt: string;
  answers: string[];
  started_at: Date;
  finished_at: Date | null;
  status: 'active' | 'completed' | 'expired';
  score: number;
}

export function createPracticeService(pool: Pool, clock: () => number = Date.now) {
  return async (tokenHash: Buffer, action: 'start' | 'read', input: string) => {
    const challenge = action === 'start' ? getPracticeChallenge(input) : null;
    if (action === 'start' && !challenge) throw new Error('Unknown practice challenge.');
    const connection = await pool.getConnection();
    try {
      await connection.query("SET time_zone = '+00:00'");
      await connection.beginTransaction();
      await connection.execute('INSERT INTO players (id, token_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = id', [randomUUID(), tokenHash]);
      // Serialize starts for this player so concurrent requests resume the same timer.
      const [[player]] = await connection.execute<RowDataPacket[]>('SELECT id FROM players WHERE token_hash = ? FOR UPDATE', [tokenHash]);
      const now = clock();
      await connection.execute("UPDATE practice_sessions SET status = 'expired', finished_at = expires_at WHERE player_id = ? AND status = 'active' AND expires_at <= ?",
        [player.id, new Date(now)]);
      let id = input;
      if (action === 'start') {
        const [[active]] = await connection.execute<RowDataPacket[]>("SELECT id FROM practice_sessions WHERE player_id = ? AND status = 'active' FOR UPDATE", [player.id]);
        id = active?.id ?? randomUUID();
        if (!active) await connection.execute(`INSERT INTO practice_sessions
          (id, player_id, challenge_key, theme, category, prompt, answer_keys, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, player.id, challenge!.id, challenge!.theme, challenge!.category, challenge!.prompt, JSON.stringify(challenge!.answers), new Date(now)]);
      }
      const [[session]] = await connection.execute<PracticeSession[]>('SELECT * FROM practice_sessions WHERE id = ? AND player_id = ? FOR UPDATE', [id, player.id]);
      const correctness = calculateScore(session?.answers.length ?? 0, 0);
      const total = Number(session?.score ?? 0);
      const game = session ? {
        id: session.id, mode: 'practice',
        challenge: { id: session.challenge_key, theme: session.theme, category: session.category,
          prompt: session.prompt as string, date: session.started_at.toISOString().slice(0, 10), number: getDailyChallenge(session.started_at.getTime()).number },
        status: session.status === 'active' ? 'playing' : 'finished', answers: session.answers,
        startedAt: session.started_at.getTime(), finishedAt: session.finished_at?.getTime() ?? null,
        score: { correctness, speed: total - correctness, total },
      } : null;
      await connection.commit();
      return { game, serverNow: now, accepted: false,
        feedback: { kind: 'hint', text: game?.status === 'playing' ? 'Enter your first answer.' : 'Practice round finished. Choose a theme to play again.' } };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
