import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useGame from '../src/features/game/useGame.js';
import App from '../src/App.jsx';
import * as api from '../src/features/game/api.js';
import { getPracticeId, getResults, newGame, savePracticeId } from '../src/features/game/storage.js';
import { getPracticeChallenge, getPracticeThemes } from '../../shared/practiceChallenges.mjs';
import { validateAnswer } from '../../shared/challenges.mjs';

vi.mock('../src/features/game/api.js', () => ({
  getGame: vi.fn(), startGame: vi.fn(), submitAnswer: vi.fn(), getThemes: vi.fn(),
  getPracticeGame: vi.fn(), startPracticeGame: vi.fn(), submitPracticeAnswer: vi.fn(), startRandomGame: vi.fn(), skipPracticeQuestion: vi.fn(),
}));
const id = '00000000-0000-4000-8000-000000000001';
const themes = [{ id: 'geography', name: 'Geography', challenges: [{ id: 'countries-m', prompt: 'Name 5 countries beginning with M' }] },
  { id: 'space', name: 'Space', challenges: [{ id: 'solar-system-planets', prompt: 'Name 5 solar system planets' }] }];
let practice;
const reply = (game, accepted = false) => ({ game, accepted, serverNow: Date.now(), feedback: { kind: 'hint', text: '' },
  ...(game.mode === 'practice' ? {} : { results: [] }) });
beforeEach(() => {
  vi.restoreAllMocks(); vi.resetAllMocks(); vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-17T23:59:50Z'));
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
  localStorage.clear();
  practice = { ...newGame(), id, mode: 'practice', status: 'playing', startedAt: Date.now() - 5000,
    score: { correctness: 0, speed: 0, total: 0 } };
  api.getGame.mockResolvedValue(reply({ ...newGame(), score: practice.score }));
  api.getPracticeGame.mockImplementation(async () => reply(practice));
  api.startPracticeGame.mockImplementation(async () => reply(practice));
  api.getThemes.mockResolvedValue(themes);
});
async function mount() { let view; await act(async () => { view = renderHook(useGame); }); return view; }

it('restores the server deadline after remount without changing daily history', async () => {
  const history = [{ date: '2026-11-16', correct: 5, score: 700 }];
  localStorage.setItem('quintle:results:v1', JSON.stringify(history));
  savePracticeId(id);
  api.getPracticeGame.mockImplementation(async () => ({ ...reply(practice), results: [{ date: '2026-11-17', correct: 5, score: 800 }] }));
  const view = await mount();
  expect(view.result.current.remaining).toBe(25000);
  expect(api.getGame).not.toHaveBeenCalled();
  expect(getResults()).toEqual(history);
  await act(async () => vi.advanceTimersByTime(3000));
  view.unmount();
  const restored = await mount();
  expect(restored.result.current.remaining).toBe(22000);
  expect(restored.result.current.game.startedAt).toBe(practice.startedAt);
  expect(getPracticeId()).toBe(id);
});

it('routes practice answers by session ID, blocks double submits, and allows replay', async () => {
  const { result } = await mount();
  practice = { ...practice, answers: ['Mexico', 'Malta', 'Morocco', 'Mali'],
    score: { correctness: 400, speed: 0, total: 400 } };
  await act(async () => result.current.startPractice('countries-m'));
  expect(getPracticeId()).toBe(id);
  await act(async () => result.current.showDaily());
  expect(api.getGame).toHaveBeenCalledTimes(1);
  const finished = { ...practice, status: 'finished', answers: [...practice.answers, 'Monaco'], finishedAt: Date.now(),
    score: { correctness: 500, speed: 250, total: 750 } };
  api.submitPracticeAnswer.mockResolvedValue(reply(finished, true));
  await act(async () => { expect(await Promise.all([result.current.submit('Monaco'), result.current.submit('Monaco')])).toEqual([true, false]); });
  expect(api.submitPracticeAnswer).toHaveBeenCalledExactlyOnceWith(id, 'Monaco', expect.any(AbortSignal));
  expect(api.submitAnswer).not.toHaveBeenCalled();
  api.startPracticeGame.mockResolvedValue(reply({ ...practice, id: id.slice(0, -1) + '2', answers: [], startedAt: Date.now(),
    score: { correctness: 0, speed: 0, total: 0 } }));
  await act(async () => result.current.startPractice('countries-m'));
  expect(result.current.game.id).not.toBe(id);
  expect(getPracticeId()).toBe(result.current.game.id);
});

it('keeps practice on network failure and falls back to daily only for a missing round', async () => {
  savePracticeId(id);
  api.getPracticeGame.mockRejectedValue(new Error('Offline'));
  const { result } = await mount();
  expect(result.current.error).toBe('Offline');
  expect(getPracticeId()).toBe(id);
  expect(api.getGame).not.toHaveBeenCalled();
  api.getPracticeGame.mockRejectedValueOnce(Object.assign(new Error('Missing'), { status: 404 }));
  await act(async () => result.current.refresh());
  expect(result.current.game.status).toBe('ready');
  expect(getPracticeId()).toBeNull();
});

it('confirms practice expiry without repeatedly refreshing daily after UTC midnight', async () => {
  savePracticeId(id);
  const { result } = await mount();
  api.getPracticeGame.mockImplementation(async () => reply({ ...practice, status: 'finished', finishedAt: practice.startedAt + 30000 }));
  await act(async () => vi.advanceTimersByTime(26000));
  expect(result.current.game.status).toBe('finished');
  await act(async () => vi.advanceTimersByTime(6000));
  expect(api.getPracticeGame).toHaveBeenCalledTimes(2);
  expect(api.getGame).not.toHaveBeenCalled();
  await act(async () => result.current.showDaily());
  expect(getPracticeId()).toBeNull();
});

it('accepts practice API responses without daily results and preserves HTTP status', async () => {
  const real = await vi.importActual('../src/features/game/api.js');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => reply(practice) })));
  expect((await real.getPracticeGame(id)).game.id).toBe(id);
  fetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'Missing' }) });
  await expect(real.getPracticeGame(id)).rejects.toMatchObject({ status: 404 });
});

it('previews a chosen theme, starts explicitly, and supports replay and returning to daily', async () => {
  await act(async () => render(<App />));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Practice' })));
  const picker = screen.getByRole('dialog', { name: 'Choose practice' });
  fireEvent.change(within(picker).getByLabelText('Theme'), { target: { value: 'space' } });
  expect(within(picker).getByRole('radio', { name: 'Name 5 solar system planets' })).toBeChecked();
  expect(api.startPracticeGame).not.toHaveBeenCalled();
  practice = { ...practice, challenge: { ...practice.challenge, ...themes[1].challenges[0], category: 'Space' } };
  let resolveStart;
  api.startPracticeGame.mockImplementationOnce(() => new Promise(resolve => { resolveStart = resolve; }));
  await act(async () => fireEvent.click(within(picker).getByRole('button', { name: 'Start practice' })));
  expect(within(picker).getByRole('button', { name: 'Starting…' })).toBeDisabled();
  await act(async () => resolveStart(reply(practice)));
  expect(api.startPracticeGame).toHaveBeenCalledWith('solar-system-planets', expect.any(AbortSignal));
  expect(screen.queryByRole('dialog', { name: 'Choose practice' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Your answer' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Practice' })).toBeDisabled();
  const finished = { ...practice, status: 'finished', finishedAt: Date.now(), answers: ['Earth', 'Mars', 'Venus', 'Jupiter', 'Saturn'],
    score: { correctness: 500, speed: 250, total: 750 } };
  api.submitPracticeAnswer.mockResolvedValue(reply(finished, true));
  fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: 'Saturn' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit answer' })));
  expect(screen.queryByText(/Next challenge in/)).not.toBeInTheDocument();
  practice = { ...practice, id: id.slice(0, -1) + '2', answers: [], startedAt: Date.now() };
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play again' })));
  expect(screen.getByRole('textbox', { name: 'Your answer' })).toHaveValue('');
  expect(getPracticeId()).toBe(practice.id);
  api.getPracticeGame.mockResolvedValue(reply({ ...finished, id: practice.id }));
  await act(async () => window.dispatchEvent(new Event('focus')));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Daily challenge' })));
  expect(getPracticeId()).toBeNull();
  expect(screen.getByRole('button', { name: 'Start challenge' })).toBeEnabled();
});

it('retries failed theme loading and preserves the picker after a failed start', async () => {
  api.getThemes.mockRejectedValueOnce(new Error('Themes offline'));
  api.startPracticeGame.mockRejectedValueOnce(new Error('Start offline'));
  await act(async () => render(<App />));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Practice' })));
  expect(screen.getByText('Themes offline')).toBeVisible();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry themes' })));
  const picker = screen.getByRole('dialog', { name: 'Choose practice' });
  await act(async () => fireEvent.click(within(picker).getByRole('button', { name: 'Start practice' })));
  expect(within(picker).getByRole('alert')).toHaveTextContent('Start offline');
  expect(within(picker).getByRole('button', { name: 'Start practice' })).toBeEnabled();
  await act(async () => fireEvent.click(within(picker).getByRole('button', { name: 'Start practice' })));
  expect(screen.queryByRole('dialog', { name: 'Choose practice' })).not.toBeInTheDocument();
});

function configureRandom() {
  const ids = ['programming-languages', 'pasta-types', 'dog-breeds', 'solar-system-planets', 'nolan-films-before-2025'];
  const questions = ids.map(id => {
    const challenge = getPracticeChallenge(id);
    return { id, theme: challenge.theme, category: challenge.category, prompt: `Name one example: ${challenge.title.toLowerCase()}` };
  });
  let count = 0;
  api.startRandomGame.mockImplementation(async () => {
    practice = { ...practice, id: id.slice(0, -3) + String(++count).padStart(3, '0'), variant: 'random', questions,
      challenge: { ...practice.challenge, ...questions[0], id: 'random' }, status: 'playing', answers: [], skipped: [],
      startedAt: Date.now(), finishedAt: null, score: { correctness: 0, speed: 0, total: 0 } };
    return reply(practice);
  });
  api.submitPracticeAnswer.mockImplementation(async (_id, input) => {
    const questions = practice.questions;
    const current = getPracticeChallenge(questions[practice.answers.length + practice.skipped.length].id);
    const match = validateAnswer(current, input, practice.answers);
    if (match.error) return { ...reply(practice), feedback: { kind: 'error', text: match.error } };
    const answers = [...practice.answers, match.answer];
    const finished = answers.length + practice.skipped.length === 5;
    practice = { ...practice, answers, status: finished ? 'finished' : 'playing', finishedAt: finished ? Date.now() : null,
      challenge: { ...practice.challenge, ...(finished ? { category: 'Mixed themes', prompt: 'Five questions. Five themes. One round.' }
        : { ...questions[answers.length + practice.skipped.length], id: 'random' }) },
      score: { correctness: answers.length * 100, speed: answers.length === 5 ? 300 : 0, total: answers.length * 100 + (answers.length === 5 ? 300 : 0) } };
    return reply(practice, true);
  });
  api.skipPracticeQuestion.mockImplementation(async () => {
    const index = practice.answers.length + practice.skipped.length;
    const otherThemes = practice.questions.filter((_, position) => position !== index).map(question => question.theme);
    const seen = practice.questions.flatMap(question => [question.id, ...(question.replacedIds ?? [])]);
    const choice = getPracticeThemes().filter(theme => !otherThemes.includes(theme.id))
      .flatMap(theme => theme.challenges).find(question => !seen.includes(question.id));
    const replacement = getPracticeChallenge(choice.id);
    const changed = { id: replacement.id, theme: replacement.theme, category: replacement.category,
      prompt: `Name one example: ${replacement.title.toLowerCase()}`,
      replacedIds: [...(practice.questions[index].replacedIds ?? []), practice.questions[index].id] };
    practice = { ...practice, questions: practice.questions.map((question, position) => position === index ? changed : question),
      challenge: { ...practice.challenge, ...changed, id: 'random' } };
    return reply(practice, true);
  });
}

async function submitRandom(value) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit answer' })));
}

it('fills one slot per theme and switches the prompt after each accepted answer in a single round', async () => {
  configureRandom();
  await act(async () => render(<App />));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Random' })));
  const originalId = practice.id, originalStart = practice.startedAt;
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('programming languages');
  const slots = within(screen.getByRole('list', { name: 'Your five answers' })).getAllByRole('listitem');
  expect(slots).toHaveLength(5);
  for (let index = 0; index < 5; index += 1) expect(slots[index]).toHaveTextContent(practice.questions[index].prompt);
  expect(within(slots[0]).getByRole('button', { name: 'Skip question' })).toBeEnabled();
  expect(screen.getAllByRole('button', { name: 'Skip question' })).toHaveLength(1);
  await submitRandom('brainfck');
  expect(api.submitPracticeAnswer).toHaveBeenLastCalledWith(originalId, 'brainfck', expect.any(AbortSignal), 'programming-languages');
  expect(practice.answers).toEqual(['Brainfuck']);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('types of pasta');
  expect(slots[0]).toHaveTextContent('Brainfuck');
  expect(slots[1]).toHaveAttribute('aria-current', 'step');
  expect(within(slots[0]).queryByRole('button', { name: 'Skip question' })).not.toBeInTheDocument();
  expect(within(slots[1]).getByRole('button', { name: 'Skip question' })).toBeEnabled();
  await submitRandom('Java');
  expect(api.submitPracticeAnswer).toHaveBeenLastCalledWith(originalId, 'Java', expect.any(AbortSignal), 'pasta-types');
  expect(practice.answers).toEqual(['Brainfuck']);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('types of pasta');
  for (const value of ['Spaghetti', 'Labrador', 'Earth', 'Inception']) await submitRandom(value);
  expect(practice.answers).toEqual(['Brainfuck', 'Spaghetti', 'Labrador Retriever', 'Earth', 'Inception']);
  expect(practice.id).toBe(originalId);
  expect(practice.startedAt).toBe(originalStart);
  expect(screen.getByRole('region', { name: 'Your result' })).toBeVisible();
  expect(api.startRandomGame).toHaveBeenCalledTimes(1);
  expect(api.startPracticeGame).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Next random question' })).not.toBeInTheDocument();
  expect(getResults()).toEqual([]);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play again' })));
  expect(practice.id).not.toBe(originalId);
  expect(practice.answers).toEqual([]);
});

it('restores random question progress with the original shared deadline', async () => {
  configureRandom();
  const view = await mount();
  await act(async () => view.result.current.startRandom());
  await act(async () => view.result.current.submit('Python'));
  expect(view.result.current.game.answers).toEqual(['Python']);
  const startedAt = practice.startedAt;
  await act(async () => vi.advanceTimersByTime(5000));
  view.unmount();
  const restored = await mount();
  expect(restored.result.current.remaining).toBe(25000);
  expect(restored.result.current.game.startedAt).toBe(startedAt);
  expect(restored.result.current.game.challenge.prompt).toContain('types of pasta');
  expect(restored.result.current.game.questions).toHaveLength(5);
  expect(restored.result.current.game.answers).toEqual(['Python']);
  expect(api.startRandomGame).toHaveBeenCalledTimes(1);
});

it('ends the whole random round on timeout and keeps unanswered prompts in the result', async () => {
  configureRandom();
  await act(async () => render(<App />));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Random' })));
  await submitRandom('Python');
  api.getPracticeGame.mockResolvedValueOnce(reply({ ...practice, status: 'finished', finishedAt: practice.startedAt + 30000 }));
  await act(async () => vi.advanceTimersByTime(30000));
  expect(screen.getByRole('region', { name: 'Your result' })).toHaveTextContent('1 of 5 correct');
  expect(screen.getAllByText('No answer')).toHaveLength(4);
  expect(screen.getByRole('region', { name: 'Your result' })).toHaveTextContent('types of pasta');
  expect(api.startRandomGame).toHaveBeenCalledTimes(1);
});

it('blocks double starts and keeps failed random starts retryable', async () => {
  configureRandom();
  const { result } = await mount();
  api.startRandomGame.mockRejectedValueOnce(new Error('Random offline'));
  await act(async () => result.current.startRandom());
  expect(result.current.error).toBe('Random offline');
  expect(result.current.game.status).toBe('ready');
  await act(async () => Promise.all([result.current.startRandom(), result.current.startRandom()]));
  expect(result.current.game.variant).toBe('random');
  expect(api.startRandomGame).toHaveBeenCalledTimes(2);
  await act(async () => result.current.startRandom());
  expect(api.startRandomGame).toHaveBeenCalledTimes(2);
});

it('sends the current question ID and rejects malformed mixed-theme server metadata', async () => {
  configureRandom();
  await api.startRandomGame();
  const real = await vi.importActual('../src/features/game/api.js');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => reply(practice) })));
  await real.submitPracticeAnswer(practice.id, 'Python', undefined, 'programming-languages');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ answer: 'Python', questionId: 'programming-languages' });
  for (const questions of [[], [null, null, null, null, null], practice.questions.map(question => ({ ...question, theme: 'same' }))]) {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => reply({ ...practice, questions }) });
    await expect(real.getPracticeGame(practice.id)).rejects.toThrow('invalid random questions');
  }
});

it('replaces the current question without filling a slot and replays after five correct answers', async () => {
  configureRandom();
  await act(async () => render(<App />));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Random' })));
  const startedAt = practice.startedAt, original = practice.questions;
  fireEvent.change(screen.getByRole('textbox', { name: 'Your answer' }), { target: { value: 'draft' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Skip question' })));
  expect(api.skipPracticeQuestion).toHaveBeenCalledWith(practice.id, 'programming-languages', expect.any(AbortSignal));
  expect(screen.getByRole('textbox', { name: 'Your answer' })).toHaveValue('');
  expect(practice.questions[0].id).not.toBe(original[0].id);
  expect(practice.questions.slice(1)).toEqual(original.slice(1));
  expect(new Set(practice.questions.map(question => question.theme)).size).toBe(5);
  expect(practice.answers).toEqual([]);
  expect(practice.skipped).toEqual([]);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(practice.questions[0].prompt);
  expect(screen.getByRole('status', { name: 'Live score' })).toHaveTextContent('0 pts');
  const replacement = practice.questions[0];
  await submitRandom(getPracticeChallenge(replacement.id).answers[0][0]);
  for (const value of ['Spaghetti', 'Labrador', 'Earth', 'Inception']) await submitRandom(value);
  const result = screen.getByRole('region', { name: 'Your result' });
  const slots = within(result).getAllByRole('listitem');
  expect(slots[0]).toHaveTextContent(replacement.prompt);
  expect(slots[1]).toHaveTextContent('Spaghetti');
  expect(screen.queryByText('Skipped')).not.toBeInTheDocument();
  expect(result).toHaveTextContent('5 of 5 correct');
  expect(within(result).getByLabelText('Total score')).toHaveTextContent('800');
  expect(practice.startedAt).toBe(startedAt);
  await act(async () => fireEvent.click(within(result).getByRole('button', { name: 'Play again' })));
  expect(practice.answers).toEqual([]);
  expect(practice.questions[0].id).toBe('programming-languages');
});

it('restores replacement questions and accepted answers without resetting the timer', async () => {
  configureRandom();
  const view = await mount();
  await act(async () => view.result.current.startRandom());
  await act(async () => view.result.current.submit('Python'));
  const first = practice.questions[0];
  await act(async () => Promise.all([view.result.current.skip(), view.result.current.skip()]));
  expect(api.skipPracticeQuestion).toHaveBeenCalledTimes(1);
  expect(practice.questions[0]).toEqual(first);
  expect(practice.questions[1].id).not.toBe('pasta-types');
  expect(practice.answers).toEqual(['Python']);
  expect(practice.score.total).toBe(100);
  const replacement = practice.questions[1];
  await act(async () => vi.advanceTimersByTime(5000));
  view.unmount();
  const restored = await mount();
  expect(restored.result.current.remaining).toBe(25000);
  expect(restored.result.current.game.questions[1]).toEqual(replacement);
  expect(restored.result.current.game.answers).toEqual(['Python']);
  expect(restored.result.current.game.challenge.prompt).toBe(replacement.prompt);
});

it('keeps failed replacements retryable and does not end a round after repeated skips', async () => {
  configureRandom();
  await act(async () => render(<App />));
  expect(screen.queryByRole('button', { name: 'Skip question' })).not.toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Random' })));
  api.skipPracticeQuestion.mockRejectedValueOnce(new Error('Skip offline'));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Skip question' })));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('programming languages');
  expect(screen.getByText('Skip offline')).toBeVisible();
  const seen = new Set(practice.questions.map(question => question.id));
  for (let index = 0; index < 5; index += 1) {
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Skip question' })));
    expect(seen.has(practice.questions[0].id)).toBe(false);
    seen.add(practice.questions[0].id);
    expect(new Set(practice.questions.map(question => question.theme)).size).toBe(5);
  }
  expect(practice.status).toBe('playing');
  expect(practice.answers).toEqual([]);
  expect(practice.score.total).toBe(0);
  expect(screen.queryByRole('region', { name: 'Your result' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Skip question' })).toBeEnabled();
});
