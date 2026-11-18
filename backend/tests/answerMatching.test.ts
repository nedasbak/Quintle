import assert from 'node:assert/strict';
import { it } from 'node:test';
import { findMatchingAnswer, normalizeAnswer } from '../../shared/answerMatching.mjs';
import { buildAnswerIndex, validateAnswer } from '../../shared/challenges.mjs';
import { getPracticeChallenge, getPracticeThemes } from '../../shared/practiceChallenges.mjs';
import { practiceAnswerExpansions } from '../../shared/practiceAnswerExpansions.mjs';

it('corrects insertions, deletions, substitutions, and adjacent transpositions', () => {
  const challenge = getPracticeChallenge('programming-languages')!;
  for (const typo of ['brainfck', 'brainfuk', 'brainfucj', 'brainfukc', 'brainffuck']) {
    assert.deepEqual(validateAnswer(challenge, typo, []), { answer: 'Brainfuck' });
    assert.match(validateAnswer(challenge, typo, ['Brainfuck']).error!, /already/i);
  }
  assert.deepEqual(validateAnswer(challenge, 'holy c', []), { answer: 'HolyC' });
  assert.match(validateAnswer(challenge, 'Holy C', ['HolyC']).error!, /already/i);
});

it('prefers exact answers and rejects ambiguous or distant guesses', () => {
  const index = buildAnswerIndex([['Malta'], ['Malta blue', 'Malta blues'], ['Malti'], ['Chile'], ['China']]);
  assert.equal(findMatchingAnswer(index, 'Malta'), 'Malta');
  assert.equal(findMatchingAnswer(index, 'Malte'), undefined);
  assert.equal(findMatchingAnswer(index, 'Chila'), undefined);
  assert.equal(findMatchingAnswer(index, 'not a country'), undefined);
  assert.equal(findMatchingAnswer(index, 'Chil'), 'Chile');
});

it('does not guess short codes, punctuation-sensitive languages, or numeric answers', () => {
  const index = buildAnswerIndex([['C'], ['C++'], ['C#'], ['R'], ['D'], ['Java'], ['Rust']]);
  for (const value of ['B', 'C+', 'C##', 'C--', 'Jav', '11', '++']) assert.equal(findMatchingAnswer(index, value), undefined);
  for (const value of ['C', 'C++', 'C#', 'R', 'D']) assert.equal(findMatchingAnswer(index, value), value);
});

it('treats multiple aliases of one answer as one candidate and normalizes typography', () => {
  const index = buildAnswerIndex([["A Bug's Life", 'A Bugs Life'], ['Bigint', 'Big integer'], ['Ceres'], ['Earth'], ['Venus']]);
  assert.equal(findMatchingAnswer(index, 'A Bug’s Life'), "A Bug's Life");
  assert.equal(findMatchingAnswer(index, 'Big ingeter'), 'Bigint');
  assert.equal(normalizeAnswer('  BÉCHAMEL  '), 'bechamel');
  assert.equal(normalizeAnswer('Nineteen Eighty–Four'), 'nineteen eighty-four');
});

it('audits all eighty rounds and supports obscure answers across all sixteen themes', () => {
  const ids = getPracticeThemes().flatMap(theme => theme.challenges.map(challenge => challenge.id));
  assert.deepEqual(Object.keys(practiceAnswerExpansions).sort(), ids.sort());
  const cases = [
    ['countries-m', 'FSM', 'Micronesia'], ['iau-dwarf-planets', '2003 UB313', 'Eris'],
    ['dog-breeds', 'Xolo', 'Xoloitzcuintli'], ['musical-instruments', 'Nyckelharpa', 'Nyckelharpa'],
    ['traditional-senses', 'Gustation', 'Taste'], ['rhymes-with-light', 'Proselyte', 'Proselyte'],
    ['programming-languages', 'Chef', 'Chef'], ['programming-languages', 'Holy C', 'HolyC'],
    ['programming-languages', 'Malbolge', 'Malbolge'], ['programming-languages', 'Whitespace', 'Whitespace'],
    ['ancient-civilizations', 'Dilmun', 'Dilmun'], ['elements-starting-c', 'Cn', 'Copernicium'],
    ['peter-jackson-middle-earth', 'FOTR', 'The Fellowship of the Ring'], ['first-nine-pokemon', 'Fushigidane', 'Bulbasaur'],
    ['pasta-types', 'Malloreddus', 'Gnocchetti sardi'], ['rock-bands-before-1990', 'Univers Zéro', 'Univers Zero'],
    ['smartphone-brands', 'Geeksphone', 'Geeksphone'], ['harry-potter-characters', 'Hokey', 'Hokey'],
    ['decathlon-events', '110 m hurdles', '110 metres hurdles'],
  ];
  for (const [id, alias, canonical] of cases) {
    const challenge = getPracticeChallenge(id)!;
    assert.deepEqual(validateAnswer(challenge, alias, []), { answer: canonical });
    assert.match(validateAnswer(challenge, alias, [canonical]).error!, /already/i);
  }
  assert.ok(getPracticeChallenge('programming-languages')!.answers.length > 600);
  assert.ok(getPracticeChallenge('dog-breeds')!.answers.length > 200);
  assert.ok(getPracticeChallenge('rock-bands-before-1990')!.answers.length > 200);
});

it('preserves finite prompt boundaries instead of admitting unrelated rare answers', () => {
  for (const [id, wrong] of [
    ['iau-dwarf-planets', 'Sedna'], ['panthera-cats', 'Cheetah'], ['minecraft-nether-biomes', 'The End'],
    ['first-nine-pokemon', 'Pikachu'], ['stardew-valley-skills', 'Luck'], ['paris-2024-ball-sports', 'Baseball'],
    ['rock-bands-before-1990', 'Melt-Banana'], ['first-folio-plays', 'Pericles'], ['henry-viii-wives', 'Elizabeth I'],
  ]) assert.match(validateAnswer(getPracticeChallenge(id)!, wrong, []).error!, /try another/i);
});
