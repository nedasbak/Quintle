import { createHash, randomBytes } from 'node:crypto';
import express from 'express';
import type { ErrorRequestHandler, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { MAX_ANSWER_LENGTH } from '../../shared/gameRules.mjs';
import { normalizeAnswer } from '../../shared/challenges.mjs';
import { getPracticeChallenge, getPracticeThemes } from '../../shared/practiceChallenges.mjs';
import type { createGameService } from './game.ts';
import type { createPracticeService } from './practice.ts';

// Anoniminį žaidėją identifikuoja HttpOnly slapukas; duomenų bazėje lieka tik jo maiša.
function playerHash(request: Request, response: Response) {
  let token = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('quintle_player='))?.slice('quintle_player='.length);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = randomBytes(32).toString('hex');
    response.cookie('quintle_player', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 365 * 24 * 60 * 60 * 1000, path: '/' });
  }
  return createHash('sha256').update(token).digest();
}

export function createApp(play: ReturnType<typeof createGameService>, practice?: ReturnType<typeof createPracticeService>) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (_request, response, next) => {
    response.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    next();
  }, rateLimit({
    windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many requests. Please try again shortly.' }
  }));
  app.use(express.json({ limit: '2kb' }));

  // Priimami tik reikalingi laukai ir tos pačios svetainės JSON užklausos.

  // Validate browser origins for POST requests.
  app.use('/api', (request, response, next) => {
    if (request.method !== 'POST') return next();

    const origin = request.get('origin');

    if (origin) {
      try {
        const parsedOrigin = new URL(origin);
        const allowedOrigins = new Set([
          'http://localhost:5173',
          'http://127.0.0.1:5173',
        ]);
        const sameHost = parsedOrigin.host === request.get('host');
        const configuredOrigin = process.env.NODE_ENV === 'production' ? process.env.APP_ORIGIN : undefined;

        if (
          configuredOrigin
            ? parsedOrigin.origin !== configuredOrigin
            : !sameHost && (process.env.NODE_ENV === 'production' || !allowedOrigins.has(parsedOrigin.origin))
        ) {
          return response.status(403).json({
            error: 'Request origin is not allowed.',
          });
        }
      } catch {
        return response.status(403).json({
          error: 'Invalid request origin.',
        });
      }
    }

    if (!request.is('application/json')) {
      return response.status(415).json({
        error: 'Send a JSON request.',
      });
    }

    if (
      !request.body ||
      Array.isArray(request.body) ||
      typeof request.body !== 'object'
    ) {
      return response.status(400).json({
        error: 'Invalid request body.',
      });
    }

    next();
  });
  app.get('/api/game/themes', (_request, response) => response.json({ themes: getPracticeThemes() }));
  app.post('/api/game/practice/start', async (request, response) => {
    const { challengeId } = request.body;
    if (Object.keys(request.body).some(key => key !== 'challengeId') || typeof challengeId !== 'string' || !getPracticeChallenge(challengeId)) {
      return response.status(400).json({ error: 'Choose a valid practice challenge.' });
    }
    if (!practice) return response.status(503).json({ error: 'Practice is unavailable.' });
    response.json(await practice(playerHash(request, response), 'start', challengeId));
  });
  app.get('/api/game/practice/:sessionId', async (request, response) => {
    if (!practice) return response.status(503).json({ error: 'Practice is unavailable.' });
    const result = await practice(playerHash(request, response), 'read', request.params.sessionId as string);
    response.status(result.game ? 200 : 404).json(result.game ? result : { error: 'Practice round not found.' });
  });
  app.post('/api/game/practice/:sessionId/answers', async (request, response) => {
    const { answer } = request.body;
    if (Object.keys(request.body).some(key => key !== 'answer') || typeof answer !== 'string' || !answer.trim() || answer.length > MAX_ANSWER_LENGTH) {
      return response.status(400).json({ error: `Send one answer of up to ${MAX_ANSWER_LENGTH} characters.` });
    }
    if ([...normalizeAnswer(answer)].length > 255) return response.status(400).json({ error: 'Answer is too long after normalization.' });
    if (!practice) return response.status(503).json({ error: 'Practice is unavailable.' });
    const result = await practice(playerHash(request, response), 'answer', request.params.sessionId as string, answer);
    response.status(result.game ? 200 : 404).json(result.game ? result : { error: 'Practice round not found.' });
  });
  app.get('/api/game', async (request, response) => response.json(await play(playerHash(request, response), 'read')));
  app.post('/api/game/start', async (request, response) => {
    if (Object.keys(request.body).length) return response.status(400).json({ error: 'Start does not accept game data.' });
    response.json(await play(playerHash(request, response), 'start'));
  });
  app.post('/api/game/answers', async (request, response) => {
    const { answer } = request.body;
    if (Object.keys(request.body).some(key => key !== 'answer') || typeof answer !== 'string' || !answer.trim() || answer.length > MAX_ANSWER_LENGTH) {
      return response.status(400).json({ error: `Send one answer of up to ${MAX_ANSWER_LENGTH} characters.` });
    }
    if ([...normalizeAnswer(answer)].length > 255) return response.status(400).json({ error: 'Answer is too long after normalization.' });
    response.json(await play(playerHash(request, response), 'answer', answer));
  });
  app.use('/api', (_request, response) => response.status(404).json({ error: 'API route was not found.' }));

  // Į naršyklę neperduodami SQL, prisijungimo duomenys ar vidiniai klaidų išrašai.
  const handleError: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error.type === 'entity.parse.failed') return response.status(400).json({ error: 'Invalid JSON.' });
    if (error.type === 'entity.too.large') return response.status(413).json({ error: 'Request is too large.' });
    console.error('Game API failed:', error ?? error.name);
    response.status(503).json({ error: 'Game server is unavailable. Please try again.' });
  };
  app.use(handleError);
  return app;
}
