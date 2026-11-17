import { GAME_DURATION, getDailyChallenge } from './challenges.js';

const PREFIX = '#results=';

// Version 1 stores canonical answer names so fixture ordering can change safely.
function restoreResult(payload) {
  if (!payload || payload.v !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) return null;
  const timestamp = Date.parse(payload.date);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== payload.date) return null;
  const challenge = getDailyChallenge(timestamp);
  const { answers, elapsed } = payload;
  if (!Array.isArray(answers) || answers.length > 5 || new Set(answers).size !== answers.length) return null;
  if (!answers.every((answer) => challenge.answers.some((variants) => variants[0] === answer))) return null;
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > GAME_DURATION) return null;
  if (answers.length < 5 && elapsed !== GAME_DURATION) return null;
  return {
    challenge,
    status: 'finished',
    answers,
    startedAt: timestamp,
    finishedAt: timestamp + elapsed,
  };
}

export function readResultLink(hash) {
  if (!hash.startsWith(PREFIX)) return { kind: 'none' };
  try {
    const token = hash.slice(PREFIX.length);
    if (token.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(token)) return { kind: 'invalid' };
    const binary = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    const json = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
    const game = restoreResult(JSON.parse(json));
    return game ? { kind: 'result', game } : { kind: 'invalid' };
  } catch {
    return { kind: 'invalid' };
  }
}

export function createResultLink(game, baseUrl = window.location.href) {
  const payload = {
    v: 1,
    date: game.challenge.date,
    answers: game.answers,
    elapsed: game.finishedAt - game.startedAt,
  };
  if (game.status !== 'finished' || !restoreResult(payload)) throw new Error('Only completed games can be shared.');
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = PREFIX + token;
  return url.href;
}
