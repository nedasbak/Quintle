import { GAME_DURATION, getDailyChallenge } from './challenges.js';
import { MAX_ANSWERS, MAX_ANSWER_LENGTH } from '../../../../shared/gameRules.mjs';

const PREFIX = '#results=';

// Senos nuorodos palaikomos, o naujos išsaugo serverio užduoties viešą tekstą.
function restoreResult(payload) {
  if (!payload || ![1, 2, 3, 4].includes(payload.v) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) return null;
  if (payload.v >= 3 && payload.mode !== 'practice') return null;
  const timestamp = Date.parse(payload.date);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== payload.date) return null;
  let challenge = getDailyChallenge(timestamp);
  const { answers, elapsed } = payload;
  if (!Array.isArray(answers) || answers.length > MAX_ANSWERS || new Set(answers).size !== answers.length) return null;
  if (payload.v === 1) {
    if (!answers.every((answer) => challenge.answers.some((variants) => variants[0] === answer))) return null;
  } else {
    const metadata = payload.challenge;
    if (!metadata || typeof metadata.category !== 'string' || !metadata.category.trim() || metadata.category.length > 100
      || typeof metadata.prompt !== 'string' || !metadata.prompt.trim() || metadata.prompt.length > 255) return null;
    if (!answers.every(answer => typeof answer === 'string' && answer.trim() && answer.length <= MAX_ANSWER_LENGTH)) return null;
    challenge = { date: payload.date, number: challenge.number, category: metadata.category, prompt: metadata.prompt };
  }
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > GAME_DURATION) return null;
  if (answers.length < MAX_ANSWERS && elapsed !== GAME_DURATION) return null;
  let questions;
  if (payload.v === 4) {
    if (!Array.isArray(payload.questions) || payload.questions.length !== MAX_ANSWERS
      || !payload.questions.every(question => question && typeof question.theme === 'string' && question.theme.trim()
        && question.theme.length <= 40 && typeof question.category === 'string' && question.category.trim()
        && question.category.length <= 100 && typeof question.prompt === 'string' && question.prompt.trim() && question.prompt.length <= 255)
      || new Set(payload.questions.map(question => question.theme)).size !== MAX_ANSWERS) return null;
    questions = payload.questions.map(({ theme, category, prompt }) => ({ theme, category, prompt }));
  }
  return {
    mode: payload.v >= 3 ? 'practice' : 'daily',
    ...(questions ? { variant: 'random', questions } : {}),
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
    if (token.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(token)) return { kind: 'invalid' };
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
    v: game.variant === 'random' ? 4 : game.mode === 'practice' ? 3 : 2,
    ...(game.mode === 'practice' ? { mode: 'practice' } : {}),
    date: game.challenge.date,
    answers: game.answers,
    ...(game.variant === 'random' ? { questions: game.questions?.map(({ theme, category, prompt }) => ({ theme, category, prompt })) } : {}),
    elapsed: game.finishedAt - game.startedAt,
    challenge: {
      category: game.challenge.category,
      prompt: game.challenge.prompt ?? `Name ${MAX_ANSWERS} ${game.challenge.title.charAt(0).toLowerCase()}${game.challenge.title.slice(1)}`,
    },
  };
  if (game.status !== 'finished' || !restoreResult(payload)) throw new Error('Only completed games can be shared.');
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = PREFIX + token;
  return url.href;
}
