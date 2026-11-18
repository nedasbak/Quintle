import { GAME_DURATION, getDailyChallenge, remainingTime } from './challenges.js';
import { getScoreBreakdown } from './scoring.js';

const ATTEMPT_KEY = 'quintle:attempt:v1';
const RESULTS_KEY = 'quintle:results:v1';
const PRACTICE_KEY = 'quintle:practice:v1';

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing and full storage must not prevent a game from running.
  }
}

export function getPracticeId() {
  const id = read(PRACTICE_KEY, null);
  return typeof id === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id) ? id : null;
}
export function savePracticeId(id) { write(PRACTICE_KEY, id); }

export function newGame(now = Date.now()) {
  return { challenge: getDailyChallenge(now), status: 'ready', answers: [], startedAt: null, finishedAt: null };
}

export function finishGame(game, now = Date.now()) {
  return {
    ...game,
    status: 'finished',
    finishedAt: Math.min(now, game.startedAt + GAME_DURATION),
  };
}

export function restoreGame(now = Date.now()) {
  const saved = read(ATTEMPT_KEY, null);
  if (!saved || !/^\d{4}-\d{2}-\d{2}$/.test(saved.date) || !['playing', 'finished'].includes(saved.status)) return newGame(now);
  const date = Date.parse(saved.date);
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== saved.date) return newGame(now);
  const challenge = getDailyChallenge(date);
  if (!Array.isArray(saved.answers) || saved.answers.length > 5 || new Set(saved.answers).size !== saved.answers.length) return newGame(now);
  if (!saved.answers.every((answer) => challenge.answers.some((variants) => variants[0] === answer))) return newGame(now);
  if (!Number.isFinite(saved.startedAt) || !Number.isFinite(new Date(saved.startedAt).getTime()) || saved.startedAt > now || new Date(saved.startedAt).toISOString().slice(0, 10) !== saved.date) return newGame(now);
  if (saved.status === 'finished' && (!Number.isFinite(saved.finishedAt) || saved.finishedAt < saved.startedAt || saved.finishedAt > saved.startedAt + GAME_DURATION)) return newGame(now);
  const game = { challenge, status: saved.status, answers: saved.answers, startedAt: saved.startedAt, finishedAt: saved.finishedAt };
  const expired = remainingTime(saved.startedAt, now) === 0;
  // Preserve an active attempt that crosses midnight, but unlock today's game afterward.
  if (saved.date !== getDailyChallenge(now).date) {
    if (saved.status === 'playing' && !expired) return game;
    saveResult(saved.status === 'playing' ? finishGame(game, now) : game);
    return newGame(now);
  }
  return saved.status === 'playing' && (expired || saved.answers.length === 5) ? finishGame(game, now) : game;
}

export function saveAttempt(game) {
  if (game.status === 'ready') return;
  write(ATTEMPT_KEY, {
    date: game.challenge.date,
    status: game.status,
    answers: game.answers,
    startedAt: game.startedAt,
    finishedAt: game.finishedAt,
  });
}

export function getResults() {
  const saved = read(RESULTS_KEY, []);
  if (!Array.isArray(saved)) return [];
  return saved.filter((result) => result && /^\d{4}-\d{2}-\d{2}$/.test(result.date)
    && Number.isInteger(result.correct) && result.correct >= 0 && result.correct <= 5
    && Number.isInteger(result.score) && result.score >= 0 && result.score <= 1050);
}

export function saveResult(game) {
  const results = getResults();
  const entry = {
    date: game.challenge.date,
    correct: game.answers.length,
    // Naujiems žaidimams naudojamas serverio patvirtintas rezultatas.
    score: game.score?.total ?? getScoreBreakdown(game.answers, remainingTime(game.startedAt, game.finishedAt)).total,
  };
  write(RESULTS_KEY, [...results.filter((result) => result.date !== entry.date), entry]);
}

// Serverio istorija atnaujina atitinkamas dienas, išsaugant seną vietinę istoriją.
export function saveServerResults(results) {
  const dates = new Set(results.map(result => result.date));
  write(RESULTS_KEY, [...getResults().filter(result => !dates.has(result.date)), ...results]);
}

export function getStatistics(results, now = Date.now()) {
  const dates = new Set(results.map((result) => result.date));
  const cursor = new Date(getDailyChallenge(now).date);
  if (!dates.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return {
    played: results.length,
    streak,
    best: results.reduce((best, result) => Math.max(best, result.score), 0),
    completed: results.filter((result) => result.correct === 5).length,
  };
}
