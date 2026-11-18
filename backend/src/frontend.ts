import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import type { Express } from 'express';

export function mountFrontend(app: Express, directory: string) {
  if (existsSync(join(directory, 'index.html'))) {
    app.use(express.static(directory));
    app.get('/', (_request, response) => response.sendFile('index.html', { root: directory }));
  } else {
    app.get('/', (_request, response) => response.json({
      service: 'Quintle API', message: 'Open the frontend app to play.', api: '/api/game',
    }));
  }
}
