import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { it } from 'node:test';
import { createApp } from '../src/app.ts';
import { mountFrontend } from '../src/frontend.ts';

for (const built of [false, true]) {
  it(built ? 'serves the built frontend and its assets alongside the API' : 'returns API status when no frontend build exists', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'quintle-frontend-'));
    const html = '<!doctype html><title>Quintle</title>';
    if (built) {
      await writeFile(join(directory, 'index.html'), html);
      await writeFile(join(directory, 'asset.txt'), 'Quintle asset');
    }
    const app = createApp(async () => { throw new Error('Static requests must not access game state.'); });
    mountFrontend(app, directory);
    const server = app.listen(0, '127.0.0.1');
    try {
      await once(server, 'listening');
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      const base = `http://127.0.0.1:${address.port}`;
      const response = await fetch(base + '/');
      assert.equal(response.status, 200);
      if (built) {
        assert.match(response.headers.get('content-type')!, /text\/html/);
        assert.equal(await response.text(), html);
        const asset = await fetch(base + '/asset.txt');
        assert.equal(asset.status, 200);
        assert.equal(await asset.text(), 'Quintle asset');
      } else {
        assert.deepEqual(await response.json(), {
          service: 'Quintle API', message: 'Open the frontend app to play.', api: '/api/game',
        });
      }
      const themes = await fetch(base + '/api/game/themes');
      assert.equal(themes.status, 200);
      assert.equal((await themes.json()).themes.length, 6);
      assert.equal((await fetch(base + '/api/missing')).status, 404);
      assert.equal((await fetch(base + '/missing')).status, 404);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
      assert.ok(basename(directory).startsWith('quintle-frontend-'));
      await rm(directory, { recursive: true, force: true });
    }
  });
}
