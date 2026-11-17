import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateScore, GAME_DURATION, MAX_ANSWERS, remainingTime } from '../../shared/gameRules.mjs';

// Tikrinamos ribos ir trupmeninės sekundės, nepriklausomai nuo ekrano laikmačio.
describe('scoring rules', () => {
  it('awards 100 per answer and 10 per remaining second', () => {
    assert.equal(calculateScore(5, 24_951), 749);
    assert.equal(calculateScore(5, GAME_DURATION), 800);
    assert.equal(calculateScore(5, 0), 500);
    assert.equal(calculateScore(2, 0), 200);
    assert.equal(calculateScore(5, 99), 500);
    assert.equal(calculateScore(5, 100), 501);
  });
  it('clamps remaining time and rejects invalid scoring input', () => {
    assert.equal(calculateScore(MAX_ANSWERS, GAME_DURATION * 2), 800);
    assert.equal(calculateScore(0, -1), 0);
    for (const count of [-1, 6, 1.5, NaN, Infinity]) assert.throws(() => calculateScore(count, 0), RangeError);
    for (const time of [NaN, Infinity, -Infinity]) assert.throws(() => calculateScore(0, time), RangeError);
    assert.equal(remainingTime(1000, 31_001), 0);
  });
});
