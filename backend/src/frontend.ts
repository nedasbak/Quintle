import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import type { Express } from 'express';

export function mountFrontend(app: Express, directory: string) {
  if (existsSync(join(directory, 'index.html'))) {
    app.use(express.static(directory));
    app.get('/', (_request, response) => response.sendFile('index.html', { root: directory }));
  } else {
    app.get('/', (request, response) => {
      const host = request.get('host');
      if (!host || !/^(?:\[[a-f\d:]+\]|[a-z\d.-]+)(?::\d+)?$/i.test(host)) return response.status(400).send('Invalid host header.');
      let target: URL;
      try { target = new URL(`${request.protocol}://${host}`); }
      catch { return response.status(400).send('Invalid host header.'); }
      const origin = target.origin;
      target.port = '5173';
      if (target.origin === origin) return response.status(503).send('Frontend build is missing. Start the frontend on a separate port.');
      response.redirect(302, target.href);
    });
  }
}
