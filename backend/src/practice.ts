import { randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getPracticeChallenge } from '../../shared/practiceChallenges.mjs';
import { calculateScore, MAX_ANSWERS } from '../../shared/gameRules.mjs';
import { getDailyChallenge, validateAnswer } from '../../shared/challenges.mjs';
import { createRandomRound, replaceRandomQuestion } from './randomRound.ts';
import type { RandomQuestion } from './randomRound.ts';

interface PracticeSession extends RowDataPacket {
  id: string;
  challenge_key: string;
  theme: string;
  category: string;
  prompt: string;
  answers: string[];
  skipped_questions: number[];
  answer_keys: string[][] | RandomQuestion[];
  started_at: Date;
  finished_at: Date | null;
  status: 'active' | 'completed' | 'expired';
  score: number;
}

export function createPracticeService(pool: Pool, clock: () => number = Date.now) {
  return async (tokenHash: Buffer, action: 'start' | 'random' | 'read' | 'answer' | 'skip', input: string, answer?: string, questionId?: string) => {
    const starting = action === 'start' || action === 'random';
    const challenge = action === 'random' ? { id: 'random', theme: 'random', category: 'Mixed themes',
      prompt: 'Five questions. Five themes. One round.', answers: createRandomRound() }
      : action === 'start' ? getPracticeChallenge(input) : null;
    if (starting && !challenge) throw new Error('Unknown practice challenge.');
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
      if (starting) {
        const [[active]] = await connection.execute<RowDataPacket[]>("SELECT id FROM practice_sessions WHERE player_id = ? AND status = 'active' FOR UPDATE", [player.id]);
        id = active?.id ?? randomUUID();
        if (!active) await connection.execute(`INSERT INTO practice_sessions
          (id, player_id, challenge_key, theme, category, prompt, answer_keys, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, player.id, challenge!.id, challenge!.theme, challenge!.category, challenge!.prompt, JSON.stringify(challenge!.answers), new Date(now)]);
      }
      let [[session]] = await connection.execute<PracticeSession[]>('SELECT * FROM practice_sessions WHERE id = ? AND player_id = ? FOR UPDATE', [id, player.id]);
      let accepted = false;
      let feedback = { kind: 'hint', text: session?.status === 'active' ? 'Enter your next answer.' : 'Practice round finished. Choose a theme to play again.' };
      if ((action === 'answer' || action === 'skip') && session) {
        const index = session.answers.length + session.skipped_questions.length;
        if (session.status !== 'active') {
          feedback = { kind: 'error', text: session.status === 'expired' ? 'Time is up. That answer arrived too late.' : 'This practice round has already finished.' };
        } else if (action === 'skip' && session.theme !== 'random') {
          feedback = { kind: 'error', text: 'Skipping is available in Random rounds.' };
        } else if (session.theme === 'random' && questionId !== (session.answer_keys as RandomQuestion[])[index].id) {
          feedback = { kind: 'error', text: 'The question has changed. Answer the current question.' };
        } else if (action === 'skip') {
          const questions = session.answer_keys as RandomQuestion[];
          const replacement = replaceRandomQuestion(questions, index);
          if (!replacement) feedback = { kind: 'error', text: 'All available replacements have been used. Try this question.' };
          else {
            questions[index] = replacement;
            await connection.execute('UPDATE practice_sessions SET answer_keys = ? WHERE id = ?', [JSON.stringify(questions), session.id]);
            accepted = true;
            feedback = { kind: 'hint', text: 'New question. The timer keeps running.' };
            [[session]] = await connection.execute<PracticeSession[]>('SELECT * FROM practice_sessions WHERE id = ? AND player_id = ?', [id, player.id]);
          }
        } else {
          const keys = session.theme === 'random'
            ? (session.answer_keys as RandomQuestion[])[index].answers : session.answer_keys as string[][];
          const result = validateAnswer({ answers: keys }, answer ?? '', session.answers);
          if (result.error) feedback = { kind: 'error', text: result.error };
          else {
            const answers = [...session.answers, result.answer];
            const completed = answers.length + session.skipped_questions.length === MAX_ANSWERS;
            await connection.execute('UPDATE practice_sessions SET answers = ?, status = ?, finished_at = ? WHERE id = ?',
              [JSON.stringify(answers), completed ? 'completed' : 'active', completed ? new Date(now) : null, session.id]);
            accepted = true;
            feedback = { kind: 'success', text: completed ? answers.length === MAX_ANSWERS ? 'Five for five. Beautifully done.' : 'Round finished.' : `${result.answer} is in. Keep going!` };
            [[session]] = await connection.execute<PracticeSession[]>('SELECT * FROM practice_sessions WHERE id = ? AND player_id = ?', [id, player.id]);
          }
        }
      }
      const correctness = calculateScore(session?.answers.length ?? 0, 0);
      const total = Number(session?.score ?? 0);
      const questions = session?.theme === 'random' ? (session.answer_keys as RandomQuestion[])
        .map(({ id, theme, category, prompt }) => ({ id, theme, category, prompt })) : null;
      const currentQuestion = session?.status === 'active' ? questions?.[session.answers.length + session.skipped_questions.length] : null;
      const game = session ? {
        id: session.id, mode: 'practice',
        ...(questions ? { variant: 'random', questions, skipped: session.skipped_questions } : {}),
        challenge: { id: session.challenge_key, theme: currentQuestion?.theme ?? session.theme,
          category: currentQuestion?.category ?? session.category,
          prompt: currentQuestion?.prompt ?? session.prompt, date: session.started_at.toISOString().slice(0, 10), number: getDailyChallenge(session.started_at.getTime()).number },
        status: session.status === 'active' ? 'playing' : 'finished', answers: session.answers,
        startedAt: session.started_at.getTime(), finishedAt: session.finished_at?.getTime() ?? null,
        score: { correctness, speed: total - correctness, total },
      } : null;
      await connection.commit();
      return { game, serverNow: now, accepted, feedback };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
