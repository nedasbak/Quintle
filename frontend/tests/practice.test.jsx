import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useGame from '../src/features/game/useGame.js';
import App from '../src/App.jsx';
import * as api from '../src/features/game/api.js';
import { getPracticeId, getResults, newGame, savePracticeId } from '../src/features/game/storage.js';

vi.mock('../src/features/game/api.js', () => ({
  getGame: vi.fn(), startGame: vi.fn(), submitAnswer: vi.fn(), getThemes: vi.fn(),
  getPracticeGame: vi.fn(), startPracticeGame: vi.fn(), submitPracticeAnswer: vi.fn(),
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
