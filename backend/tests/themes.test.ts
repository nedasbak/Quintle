import assert from 'node:assert/strict';
import { once } from 'node:events';
import { it } from 'node:test';
import { createApp } from '../src/app.ts';
import { getPracticeChallenge, getPracticeThemes } from '../../shared/practiceChallenges.mjs';
import { buildAnswerIndex, validateAnswer } from '../../shared/challenges.mjs';

it('provides distinct themes and stable challenges with at least five valid answers', () => {
  const themes = getPracticeThemes();
  assert.equal(themes.length, 11);
  for (const theme of themes) assert.ok(theme.challenges.length >= 5, `${theme.name} needs at least five challenges.`);
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
  const themes = getPracticeThemes(), originalCount = themes[0].challenges.length;
  themes[0].challenges.length = 0;
  assert.equal(getPracticeThemes()[0].challenges.length, originalCount);
});

it('keeps new challenge boundaries and aliases consistent', () => {
  const cats = getPracticeChallenge('panthera-cats')!;
  assert.deepEqual(validateAnswer(cats, 'SNOW LEOPARDS', []), { answer: 'Snow leopard' });
  assert.match(validateAnswer(cats, 'Cheetah', []).error!, /try another/i);
  const units = getPracticeChallenge('si-base-units')!;
  assert.deepEqual(validateAnswer(units, 'meters', []), { answer: 'Metre' });
  assert.match(validateAnswer(units, 'meter', ['Metre']).error!, /already/i);
});

it('validates the new themes without conflating similar names or accepting out-of-scope answers', () => {
  const cases = [
    ['programming-languages', 'CPP', 'C++', 'HTML'],
    ['ancient-civilizations', 'Harappans', 'Indus Valley', 'Inca'],
    ['elements-starting-c', 'Cesium', 'Caesium', 'Oxygen'],
    ['nolan-films-before-2025', 'Prestige', 'The Prestige', 'Avatar'],
    ['minecraft-nether-biomes', 'Basalt Delta', 'Basalt Deltas', 'The End'],
  ];
  for (const [id, alias, canonical, invalid] of cases) {
    const challenge = getPracticeChallenge(id)!;
    assert.deepEqual(validateAnswer(challenge, alias, []), { answer: canonical });
    assert.match(validateAnswer(challenge, invalid, []).error!, /try another/i);
  }
  assert.deepEqual(validateAnswer(getPracticeChallenge('programming-languages')!, 'CSharp', ['C', 'C++']), { answer: 'C#' });
  assert.match(validateAnswer(getPracticeChallenge('first-ten-us-presidents')!, 'Adams', []).error!, /try another/i);
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

it('accepts same-host and local frontend origins while respecting production configuration', async () => {
  const previousMode = process.env.NODE_ENV, previousOrigin = process.env.APP_ORIGIN;
  const server = createApp(async () => { throw new Error('Origin checks must not read a daily game.'); }).listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    const status = async (origin: string) => (await fetch(`${base}/api/game/practice/start`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: 'countries-m' }),
    })).status;
    process.env.NODE_ENV = 'development';
    for (const origin of [base, 'http://localhost:5173', 'http://127.0.0.1:5173']) assert.equal(await status(origin), 503);
    assert.equal(await status('https://other.example'), 403);
    process.env.NODE_ENV = 'production';
    delete process.env.APP_ORIGIN;
    assert.equal(await status(base), 503);
    assert.equal(await status('http://localhost:5173'), 403);
    process.env.APP_ORIGIN = 'https://quintle.example';
    assert.equal(await status('https://quintle.example'), 503);
    assert.equal(await status(base), 403);
    assert.equal(await status('https://other.example'), 403);
  } finally {
    if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = previousOrigin;
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
