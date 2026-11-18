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

it('shares one mixed-theme round with five question labels and no private answer lists', () => {
  const questions = Array.from({ length: 5 }, (_, index) => ({ id: `private-id-${index}`, theme: `theme-${index}`,
    category: `Category ${index}`, prompt: `Name one example: category ${index}`, answers: [['private-answer-list']] }));
  const random = { ...game, mode: 'practice', variant: 'random', id: 'private-session', questions,
    challenge: { ...game.challenge, category: 'Mixed themes', prompt: 'Five questions. Five themes. One round.' } };
  const hash = new URL(createResultLink(random, baseUrl)).hash;
  const restored = readResultLink(hash).game;
  expect(restored.variant).toBe('random');
  expect(restored.questions).toEqual(questions.map(({ theme, category, prompt }) => ({ theme, category, prompt })));
  expect(restored.answers).toEqual(game.answers);
  expect(restored.finishedAt - restored.startedAt).toBe(5049);
  const payload = atob(hash.slice('#results='.length).replace(/-/g, '+').replace(/_/g, '/'));
  for (const secret of ['private-id', 'private-session', 'private-answer-list']) expect(payload).not.toContain(secret);
  for (const patch of [{ questions: questions.slice(0, 4) }, { questions: questions.map(question => ({ ...question, theme: 'same' })) },
    { questions: questions.map(question => ({ ...question, prompt: '' })) }]) {
    expect(readResultLink(encode({ ...JSON.parse(payload), ...patch }))).toEqual({ kind: 'invalid' });
  }
});

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

  it('preserves practice metadata and precise scores without sharing private session data', () => {
    const practice = { ...game, mode: 'practice', id: 'private-session', token: 'private-token',
      challenge: { ...game.challenge, category: 'Music', prompt: 'Name 5 musical instruments', answer_keys: ['private-key'] },
      answers: ['Piano', 'Guitar', 'Flute', 'Violin', 'Trumpet'] };
    const hash = new URL(createResultLink(practice, baseUrl)).hash;
    const result = readResultLink(hash);
    expect(result.kind).toBe('result');
    expect(result.game.mode).toBe('practice');
    expect(result.game.challenge).toMatchObject({ category: 'Music', prompt: 'Name 5 musical instruments' });
    expect(result.game.answers).toEqual(practice.answers);
    const elapsed = result.game.finishedAt - result.game.startedAt;
    expect(elapsed).toBe(5049);
    expect(getScoreBreakdown(result.game.answers, GAME_DURATION - elapsed).total).toBe(749);
    const payload = atob(hash.slice('#results='.length).replace(/-/g, '+').replace(/_/g, '/'));
    expect(JSON.parse(payload)).toMatchObject({ v: 3, mode: 'practice' });
    for (const value of ['private-session', 'private-token', 'private-key', 'answer_keys']) expect(payload).not.toContain(value);
  });

  it('keeps older links daily and rejects unsupported practice modes', () => {
    const payload = { date: game.challenge.date, elapsed: 30000, answers: ['Mexico'],
      challenge: { category: 'Geography', prompt: 'Name 5 countries beginning with M' } };
    for (const v of [1, 2]) expect(readResultLink(encode({ ...payload, v, mode: 'practice' })).game.mode).toBe('daily');
    for (const mode of [undefined, null, 'daily', 'other', 0]) {
      expect(readResultLink(encode({ ...payload, v: 3, mode }))).toEqual({ kind: 'invalid' });
    }
    const daily = new URL(createResultLink(game, baseUrl)).hash;
    expect(JSON.parse(atob(daily.slice('#results='.length).replace(/-/g, '+').replace(/_/g, '/'))).v).toBe(2);
  });
});
