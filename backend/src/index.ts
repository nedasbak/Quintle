import express from 'express';
import type { Express } from 'express';
import { createRuntime } from './runtime.ts';

export function createVercelApp(initialize: () => Promise<Express> = async () => (await createRuntime()).app) {
  const app = express();
  app.disable('x-powered-by');
  let initialization: Promise<Express> | null = null;
  app.use(async (request, response, next) => {
    let current: Promise<Express> | null = null;
    try {
      current = initialization ??= initialize();
      const api = await current;
      api(request, response, next);
    } catch (error) {
      if (initialization === current) initialization = null;
      console.error('Game API initialization failed:', error);
      response.status(503).set('Cache-Control', 'no-store').json({ error: 'Game server is unavailable. Please try again.' });
    }
  });
  return app;
}

export default createVercelApp();
