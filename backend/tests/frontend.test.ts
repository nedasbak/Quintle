import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { it } from 'node:test';
import { createApp } from '../src/application.ts';
import { mountFrontend } from '../src/frontend.ts';
import { getPracticeThemes } from '../../shared/practiceChallenges.mjs';

for (const built of [false, true]) {
  it(built ? 'serves the built frontend and its assets alongside the API' : 'redirects to the frontend when no build exists', async () => {
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
      const withHost = (host: string) => new Promise<IncomingMessage>((resolve, reject) => {
        const request = httpRequest(base, { headers: { Host: host } }, response => { response.resume(); resolve(response); });
        request.on('error', reject);
        request.end();
      });
      const response = await fetch(base + '/', { redirect: 'manual' });
      if (built) {
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type')!, /text\/html/);
        assert.equal(await response.text(), html);
        const asset = await fetch(base + '/asset.txt');
        assert.equal(asset.status, 200);
        assert.equal(await asset.text(), 'Quintle asset');
      } else {
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), 'http://127.0.0.1:5173/');
        const local = await withHost(`localhost:${address.port}`);
        assert.equal(local.headers.location, 'http://localhost:5173/');
        const loop = await withHost('127.0.0.1:5173');
        assert.equal(loop.statusCode, 503);
        assert.equal(loop.headers.location, undefined);
        const invalid = await withHost('user@other.example');
        assert.equal(invalid.statusCode, 400);
      }
      const themes = await fetch(base + '/api/game/themes');
      assert.equal(themes.status, 200);
      assert.deepEqual((await themes.json()).themes, getPracticeThemes());
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
