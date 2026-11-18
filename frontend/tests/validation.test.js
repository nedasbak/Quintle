import { describe, expect, it } from 'vitest';
import { buildAnswerIndex, getDailyChallenge, validateAnswer } from '../../shared/challenges.mjs';

const day = Date.parse('2026-11-19T12:00:00Z');
const challenge = getDailyChallenge(day);

describe('curated answer validation', () => {
  it('accepts explicit spelling variants, case, accents, and whitespace', () => {
    expect(validateAnswer(challenge, '  BRASIL\t', [])).toEqual({ answer: 'Brazil' });
    expect(validateAnswer(challenge, 'PERÚ', [])).toEqual({ answer: 'Peru' });
    expect(validateAnswer(challenge, 'Surinam', [])).toEqual({ answer: 'Suriname' });
  });
  it('prevents duplicate canonical answers even when history contains aliases', () => {
    for (const [input, previous] of [['Brazil', '  bRaSiL '], ['Brasil', 'BRAZIL'], ['Peru', 'Perú']]) {
      expect(validateAnswer(challenge, input, [previous]).error).toMatch(/already/i);
    }
  });
  it('rejects unlisted words and near-miss spellings without consuming an answer', () => {
    const accepted = ['Peru'];
    for (const input of ['', '   ', 'Moon', 'Perro', 'Br']) expect(validateAnswer(challenge, input, accepted).error).toMatch(/not quite/i);
    expect(accepted).toEqual(['Peru']);
  });
  it('checks every existing daily template has enough unambiguous answers', () => {
    for (let offset = 0; offset < 3; offset++) expect(buildAnswerIndex(getDailyChallenge(day + offset * 86400000).answers).size).toBeGreaterThanOrEqual(5);
  });
  it('counts canonical answers rather than aliases toward the required minimum', () => {
    const planets = [['Earth', 'the Earth'], ['Mars'], ['Venus']];
    expect(() => buildAnswerIndex(planets, 4)).toThrow(/not enough/i);
    expect(buildAnswerIndex(planets, 3).get('the earth')).toBe('Earth');
    for (const count of [0, -1, 1.5, NaN]) expect(() => buildAnswerIndex(planets, count)).toThrow(/count/i);
  });
  it('rejects ambiguous aliases and repeated canonical names', () => {
    expect(() => buildAnswerIndex([['Brazil', 'Brasil'], ['Chile', 'BRASIL']], 2)).toThrow(/ambiguous/i);
    expect(() => buildAnswerIndex([['Peru'], ['Perú']], 2)).toThrow(/duplicate/i);
    expect(buildAnswerIndex([['Peru', 'Perú', 'PERU']], 1).size).toBe(1);
  });
  it('rejects malformed, blank, and oversized keys before database insertion', () => {
    for (const answers of [null, ['Brazil'], [[]], [[123]], [['']], [[' \t']], [['a'.repeat(256)]], [['\uFDFA'.repeat(80)]]]) {
      expect(() => buildAnswerIndex(answers, 1)).toThrow();
    }
  });
});
