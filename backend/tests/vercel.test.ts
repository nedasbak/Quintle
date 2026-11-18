import assert from 'node:assert/strict';
import { once } from 'node:events';
import { it, mock } from 'node:test';
import { createApp } from '../src/application.ts';
import { createVercelApp } from '../src/index.ts';

it('initializes the Vercel API at runtime once for concurrent requests and preserves /api paths', async () => {
  let starts = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const app = createVercelApp(async () => {
    starts += 1;
    await gate;
    return createApp(async () => { throw new Error('Theme metadata must not access game state.'); });
  });
  assert.equal(starts, 0);
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    const requests = [fetch(base + '/api/game/themes'), fetch(base + '/api/game/themes')];
    release();
    const responses = await Promise.all(requests);
    assert.equal(starts, 1);
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.equal((await response.json()).themes.length, 16);
      assert.equal(response.headers.get('x-powered-by'), null);
    }
    assert.equal((await fetch(base + '/api/missing')).status, 404);
    assert.equal((await fetch(base + '/')).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

it('retries initialization failures without exposing database details', async () => {
  const log = mock.method(console, 'error', () => {});
  let attempts = 0;
  const app = createVercelApp(async () => {
    if (++attempts === 1) throw new Error('private-database-details');
    return createApp(async () => { throw new Error('Unused'); });
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const url = `http://127.0.0.1:${address.port}/api/game/themes`;
    const failed = await fetch(url);
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get('cache-control'), 'no-store');
    assert.equal((await failed.text()).includes('private-database-details'), false);
    assert.equal((await fetch(url)).status, 200);
    assert.equal(attempts, 2);
  } finally {
    log.mock.restore();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
