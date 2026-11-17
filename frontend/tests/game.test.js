import { beforeEach, describe, expect, it } from 'vitest';
import { calculateScore, getDailyChallenge, nextChallengeIn, remainingTime, validateAnswer } from '../src/features/game/challenges.js';
import { finishGame, getResults, getStatistics, newGame, restoreGame, saveAttempt, saveResult } from '../src/features/game/storage.js';
import { getAnswerDetails, getScoreBreakdown } from '../src/features/game/scoring.js';

const now = Date.parse('2026-11-17T12:00:00Z');

beforeEach(() => localStorage.clear());

describe('daily game rules', () => {
  it('changes the category exactly at UTC midnight', () => {
    const before = getDailyChallenge(Date.parse('2026-11-17T23:59:59.999Z'));
    const after = getDailyChallenge(Date.parse('2026-11-18T00:00:00Z'));
    expect(before.number).toBe(1);
    expect(after.number).toBe(2);
    expect(before.title).not.toBe(after.title);
    expect(getDailyChallenge(now).title).toBe(before.title);
  });

  it('normalizes case and whitespace and counts aliases as duplicates', () => {
    const challenge = getDailyChallenge(now);
    expect(validateAnswer(challenge, '  mAlAySiA  ', [])).toEqual({ answer: 'Malaysia' });
    expect(validateAnswer(challenge, 'Burma', [])).toEqual({ answer: 'Myanmar' });
    expect(validateAnswer(challenge, 'Burma', ['Myanmar']).error).toMatch(/already/i);
    expect(validateAnswer(challenge, 'moon', []).error).toMatch(/not quite/i);
  });

  it('scores precise remaining time, not rounded displayed seconds', () => {
    expect(calculateScore(5, 24_951)).toBe(749);
    expect(calculateScore(5, 30_000)).toBe(800);
    expect(calculateScore(5, 0)).toBe(500);
    expect(calculateScore(2, 0)).toBe(200);
    expect(calculateScore(0, -500)).toBe(0);
    expect(remainingTime(now, now + 30_001)).toBe(0);
  });

  it('counts down to the next UTC day', () => {
    expect(nextChallengeIn(Date.parse('2026-11-17T23:59:58Z'))).toBe('00:00:02');
    expect(nextChallengeIn(Date.parse('2026-11-18T00:00:00Z'))).toBe('24:00:00');
  });
});

describe('local progress', () => {
  it('restores an active deadline and ends an expired attempt', () => {
    const game = { ...newGame(now), startedAt: now, status: 'playing', answers: ['Mexico'] };
    saveAttempt(game);
    expect(restoreGame(now + 5000).startedAt).toBe(now);
    const restored = restoreGame(now + 60_000);
    expect(restored.status).toBe('finished');
    expect(restored.finishedAt).toBe(now + 30_000);
    expect(restored.answers).toEqual(['Mexico']);
  });

  it('preserves a live attempt crossing midnight and unlocks the next date afterward', () => {
    const start = Date.parse('2026-11-17T23:59:55Z');
    saveAttempt({ ...newGame(start), startedAt: start, status: 'playing', answers: ['Mexico'] });
    expect(restoreGame(start + 10_000).challenge.date).toBe('2026-11-17');
    const next = restoreGame(start + 60_000);
    expect(next.challenge.date).toBe('2026-11-18');
    expect(next.status).toBe('ready');
    expect(getResults()).toEqual([{ date: '2026-11-17', correct: 1, score: 100 }]);
  });

  it('saves a completed date once and counts consecutive UTC days', () => {
    const game = finishGame({ ...newGame(now), status: 'playing', startedAt: now, answers: ['Mexico'] }, now + 30_000);
    saveResult(game);
    saveResult(game);
    expect(getResults()).toHaveLength(1);
    const results = [
      { date: '2026-11-16', correct: 5, score: 600 },
      ...getResults(),
    ];
    expect(getStatistics(results, now)).toEqual({ played: 2, streak: 2, best: 600, completed: 1 });
    expect(getStatistics(results, now + 86_400_000).streak).toBe(2);
    expect(getStatistics(results, now + 2 * 86_400_000).streak).toBe(0);
  });

  it('ignores corrupted or unavailable storage', () => {
    localStorage.setItem('quintle:attempt:v1', '{broken');
    localStorage.setItem('quintle:results:v1', '{}');
    expect(restoreGame(now).status).toBe('ready');
    expect(getResults()).toEqual([]);
  });
});

describe('frontend sample rarity scoring', () => {
  it('awards more points to rarer accepted answers', () => {
    expect(getAnswerDetails('Mexico')).toMatchObject({ bonus: 0, label: 'Common' });
    expect(getAnswerDetails('Mongolia')).toMatchObject({ bonus: 25, label: 'Uncommon' });
    expect(getAnswerDetails('Micronesia')).toMatchObject({ bonus: 50, label: 'Rare' });
    expect(getAnswerDetails('Unknown')).toMatchObject({ pickRate: null, bonus: 0, label: 'Unrated' });
  });

  it('separates correctness, precise speed, and rarity into one deterministic total', () => {
    expect(getScoreBreakdown(['Mexico', 'Mali', 'Micronesia'], 12_345)).toEqual({ correctness: 300, speed: 123, rarity: 75, total: 498 });
    expect(getScoreBreakdown([])).toEqual({ correctness: 0, speed: 0, rarity: 0, total: 0 });
  });

  it('preserves a score above the previous 800-point cap in local history', () => {
    const answers = ['Malawi', 'Marshall Islands', 'Mauritania', 'Micronesia', 'Montenegro'];
    saveResult(finishGame({ ...newGame(now), status: 'playing', startedAt: now, answers }, now));
    expect(getResults()).toEqual([{ date: '2026-11-17', correct: 5, score: 1050 }]);
  });
});
