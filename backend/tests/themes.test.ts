import assert from 'node:assert/strict';
import { once } from 'node:events';
import { it } from 'node:test';
import { createApp } from '../src/app.ts';
import { getPracticeChallenge, getPracticeThemes } from '../../shared/practiceChallenges.mjs';
import { buildAnswerIndex, validateAnswer } from '../../shared/challenges.mjs';

it('provides distinct themes and stable challenges with at least five valid answers', () => {
  const themes = getPracticeThemes();
  assert.equal(themes.length, 6);
  assert.equal(new Set(themes.map(theme => theme.id)).size, themes.length);
  const choices = themes.flatMap(theme => theme.challenges);
  assert.equal(new Set(choices.map(choice => choice.id)).size, choices.length);
  for (const choice of choices) {
    const challenge = getPracticeChallenge(choice.id)!;
    assert.ok(buildAnswerIndex(challenge.answers).size >= 5);
    assert.match(choice.prompt, /^Name 5 /);
    for (const variants of challenge.answers) {
      for (const alias of variants) {
        assert.deepEqual(validateAnswer(challenge, alias, []), { answer: variants[0] });
        assert.match(validateAnswer(challenge, alias, [variants[0]]).error!, /already/i);
      }
    }
  }
});

it('rejects unknown challenge IDs and isolates catalog data from caller mutations', () => {
  for (const id of ['missing', '__proto__', '', null]) assert.equal(getPracticeChallenge(id), null);
  const challenge = getPracticeChallenge('dog-breeds')!;
  challenge.answers[0][0] = 'Changed';
  assert.equal(getPracticeChallenge('dog-breeds')!.answers[0][0], 'Labrador Retriever');
  getPracticeThemes()[0].challenges.length = 0;
  assert.equal(getPracticeThemes()[0].challenges.length, 2);
});

it('serves theme metadata without answers, player cookies, or a game request', async () => {
  const server = createApp(async () => { throw new Error('Theme browsing must not start or read a game.'); }).listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/game/themes`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json();
    assert.deepEqual(data, { themes: getPracticeThemes() });
    for (const theme of data.themes) {
      assert.deepEqual(Object.keys(theme).sort(), ['challenges', 'id', 'name']);
      for (const choice of theme.challenges) assert.deepEqual(Object.keys(choice).sort(), ['id', 'prompt']);
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
