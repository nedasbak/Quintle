import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import * as api from '../src/features/game/api.js';

const server = vi.hoisted(() => ({ game: null }));

// Sąsajos testuose API atsakymai valdomi atskirai; tikras serveris tikrinamas MySQL testais.
vi.mock('../src/features/game/api.js', async () => {
  const { newGame, finishGame } = await import('../src/features/game/storage.js');
  const { GAME_DURATION, remainingTime, validateAnswer } = await import('../src/features/game/challenges.js');
  const { getScoreBreakdown } = await import('../src/features/game/scoring.js');
  function response(accepted = false, feedback = { kind: 'hint', text: 'You’ve got this. Enter your first answer.' }) {
    server.game ??= newGame();
    if (server.game.status === 'playing' && !remainingTime(server.game.startedAt)) server.game = finishGame(server.game);
    const game = server.game;
    const remaining = game.status === 'finished' ? remainingTime(game.startedAt, game.finishedAt) : 0;
    const score = getScoreBreakdown(game.answers, remaining);
    return {
      game: { ...game, challenge: { ...game.challenge, prompt: `Name 5 ${game.challenge.title.charAt(0).toLowerCase()}${game.challenge.title.slice(1)}` }, score },
      serverNow: Date.now(), accepted, feedback,
      results: game.status === 'finished' ? [{ date: game.challenge.date, correct: game.answers.length, score: score.total }] : [],
    };
  }
  return {
    getGame: vi.fn(async () => response()),
    startGame: vi.fn(async () => {
      server.game ??= newGame();
      if (server.game.status === 'ready') server.game = { ...server.game, status: 'playing', startedAt: Date.now() };
      return response();
    }),
    submitAnswer: vi.fn(async input => {
      if (Date.now() - server.game.startedAt >= GAME_DURATION) return response();
      const result = validateAnswer(server.game.challenge, input, server.game.answers);
      if (result.error) return response(false, { kind: 'error', text: result.error });
      server.game = { ...server.game, answers: [...server.game.answers, result.answer] };
      if (server.game.answers.length === 5) server.game = finishGame(server.game);
      return response(true, { kind: 'success', text: `${result.answer} is in. Keep going!` });
    }),
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-17T12:00:00Z'));
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
  vi.clearAllMocks();
  localStorage.clear();
  server.game = null;
});
async function mount() {
  let view;
  await act(async () => { view = render(<App />); });
  return view;
}
async function start() { await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start challenge' }))); }
async function answer(value) {
  fireEvent.change(screen.getByRole('textbox', { name: /your answer/i }), { target: { value } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit answer' })));
}
async function advance(milliseconds) { await act(async () => vi.advanceTimersByTime(milliseconds)); }

describe('server-connected game interface', () => {
  it('loads the challenge without starting the clock', async () => {
    await mount();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Name 5 countries beginning with M');
    expect(within(screen.getByRole('list', { name: 'Your five answers' })).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('textbox', { name: /your answer/i })).toBeDisabled();
    await advance(5000);
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', '30 seconds remaining');
    expect(api.startGame).not.toHaveBeenCalled();
  });
  it('focuses the input and shows server validation without duplicate points', async () => {
    await mount();
    await start();
    expect(screen.getByRole('textbox', { name: /your answer/i })).toHaveFocus();
    await answer('Moon');
    expect(screen.getByText('Not quite. Try another answer.')).toBeInTheDocument();
    await answer('Burma');
    expect(screen.getByLabelText('Live score')).toHaveTextContent('100 pts');
    await answer('Myanmar');
    expect(screen.getByText('Already on your list. Think of another!')).toBeInTheDocument();
    expect(screen.getByLabelText('Live score')).toHaveTextContent('100 pts');
  });
  it('shows the exact server score, keeps rarity separate, and restores the result', async () => {
    const view = await mount();
    await start();
    await advance(5049);
    for (const value of ['Mexico', 'Malta', 'Morocco', 'Mali', 'Monaco']) await answer(value);
    expect(screen.getByLabelText('Correctness points')).toHaveTextContent('500');
    expect(screen.getByLabelText('Speed bonus')).toHaveTextContent('+249');
    expect(screen.getByLabelText('Rarity preview')).toHaveTextContent('+50');
    expect(screen.getByLabelText('Total score')).toHaveTextContent('749');
    view.unmount();
    await mount();
    expect(screen.getByLabelText('Total score')).toHaveTextContent('749');
  });
  it('asks the server to confirm a timeout and does not restart after refresh', async () => {
    const view = await mount();
    await start();
    await answer('Mexico');
    await advance(30_001);
    expect(screen.getByLabelText('Total score')).toHaveTextContent('100');
    expect(screen.getByText('0.0s remaining')).toBeInTheDocument();
    view.unmount();
    await mount();
    expect(screen.queryByRole('button', { name: 'Start challenge' })).not.toBeInTheDocument();
  });
  it('recovers the server deadline rather than a browser-saved attempt', async () => {
    const view = await mount();
    await start();
    await answer('Mexico');
    await advance(10_000);
    localStorage.setItem('quintle:attempt:v1', JSON.stringify({ startedAt: Date.now(), score: 99999 }));
    view.unmount();
    await mount();
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', '20 seconds remaining');
    expect(screen.getByLabelText('Live score')).toHaveTextContent('100 pts');
  });
  it('handles a late answer even before the display timer updates', async () => {
    await mount();
    await start();
    vi.setSystemTime(new Date('2026-11-17T12:00:31Z'));
    await answer('Mexico');
    expect(screen.queryByText('Mexico')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Total score')).toHaveTextContent('0');
  });
  it('copies the confirmed result without revealing answer names', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await mount();
    await start();
    await answer('Mexico');
    await advance(30_000);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /share your result/i })));
    const text = writeText.mock.calls[0][0];
    expect(text).toContain('1/5 · 100 points');
    expect(text).not.toContain('Mexico');
    expect(screen.getByRole('link', { name: 'View match results' })).toHaveAttribute('href', text.split('\n').at(-1));
  });
  it('offers selectable text when clipboard access is denied', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    await mount();
    await start();
    await advance(30_000);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /share your result/i })));
    expect(screen.getByRole('textbox', { name: 'Result to copy' }).value).toContain('Quintle #001');
  });
  it('shows a retry action when the initial server request fails', async () => {
    vi.mocked(api.getGame).mockRejectedValueOnce(new Error('Cannot reach the game server.'));
    await mount();
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the game server.');
    expect(screen.queryByRole('button', { name: 'Start challenge' })).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Try again' })));
    expect(screen.getByRole('button', { name: 'Start challenge' })).toBeEnabled();
  });
  it('retains the answer and score when a submission fails', async () => {
    await mount();
    await start();
    vi.mocked(api.submitAnswer).mockRejectedValueOnce(new Error('Connection lost.'));
    await answer('Mexico');
    expect(screen.getByText('Connection lost.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /your answer/i })).toHaveValue('Mexico');
    expect(screen.getByLabelText('Live score')).toHaveTextContent('0 pts');
    await answer('Mexico');
    expect(screen.getByLabelText('Live score')).toHaveTextContent('100 pts');
  });
  it('accepts an answer with Enter', async () => {
    vi.useRealTimers();
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-17T12:00:00Z'));
    const user = userEvent.setup();
    await mount();
    await start();
    await user.type(screen.getByRole('textbox', { name: /your answer/i }), 'Mexico{Enter}');
    expect(screen.getByLabelText('Live score')).toHaveTextContent('100 pts');
    expect(screen.getByRole('textbox', { name: /your answer/i })).toHaveValue('');
  });
  it('changes the timer warning at ten and five seconds', async () => {
    await mount();
    await start();
    await advance(20_000);
    expect(screen.getByRole('timer')).toHaveClass('countdown-warning');
    await advance(5000);
    expect(screen.getByRole('timer')).toHaveClass('countdown-critical');
  });
  it('opens and closes the existing help dialog', async () => {
    await mount();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Game information' })).getByRole('button', { name: 'How to play' }));
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryByRole('dialog', { name: 'How to play' })).not.toBeInTheDocument();
  });
});
