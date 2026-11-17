import { describe, expect, it } from 'vitest';
import { GAME_DURATION, getDailyChallenge } from '../src/features/game/challenges.js';
import { createResultLink, readResultLink } from '../src/features/game/resultLinks.js';
import { getScoreBreakdown } from '../src/features/game/scoring.js';

const startedAt = Date.parse('2026-11-17T12:00:00Z');
const game = {
  challenge: getDailyChallenge(startedAt), status: 'finished', startedAt,
  finishedAt: startedAt + 5049, answers: ['Mexico', 'Malta', 'Morocco', 'Mali', 'Monaco'],
};
const baseUrl = 'https://quintle.example/play/?tracking=remove#old';
const encode = (payload) => '#results=' + btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('shareable result links', () => {
  it('round-trips the original challenge, answers, precise duration, and score', () => {
    const url = new URL(createResultLink(game, baseUrl));
    expect(url.origin + url.pathname).toBe('https://quintle.example/play/');
    expect(url.search).toBe('');
    const result = readResultLink(url.hash);
    expect(result.kind).toBe('result');
    expect(result.game.challenge.date).toBe(game.challenge.date);
    expect(result.game.answers).toEqual(game.answers);
    const elapsed = result.game.finishedAt - result.game.startedAt;
    expect(elapsed).toBe(5049);
    expect(getScoreBreakdown(result.game.answers, GAME_DURATION - elapsed)).toEqual(getScoreBreakdown(game.answers, 24_951));
  });

  it('supports timed-out games without requiring local storage', () => {
    const expired = { ...game, answers: ['Mexico'], finishedAt: startedAt + GAME_DURATION };
    expect(readResultLink(new URL(createResultLink(expired, baseUrl)).hash).game.answers).toEqual(['Mexico']);
    expect(() => createResultLink({ ...game, status: 'playing' }, baseUrl)).toThrow(/completed games/);
  });

  it('ignores unrelated fragments and handles corrupt or oversized links', () => {
    expect(readResultLink('#help')).toEqual({ kind: 'none' });
    for (const hash of ['#results=', '#results=invalid!', '#results=' + 'a'.repeat(2049), encode(null)]) {
      expect(readResultLink(hash)).toEqual({ kind: 'invalid' });
    }
  });

  it('rejects invalid dates, answers, duplicate aliases, durations, and versions', () => {
    const valid = { v: 1, date: '2026-11-17', elapsed: 30_000, answers: ['Mexico'] };
    for (const patch of [
      { v: 2 }, { date: '2026-02-30' }, { date: 'invalid' }, { elapsed: -1 },
      { elapsed: 30_001 }, { elapsed: 1000 }, { answers: ['Moon'] },
      { answers: ['Mexico', 'Mexico'] }, { answers: ['Burma'] }, { answers: {} },
    ]) expect(readResultLink(encode({ ...valid, ...patch }))).toEqual({ kind: 'invalid' });
  });
});
