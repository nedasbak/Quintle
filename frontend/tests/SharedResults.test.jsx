import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import { getDailyChallenge } from '../src/features/game/challenges.js';
import { createResultLink } from '../src/features/game/resultLinks.js';

const startedAt = Date.parse('2026-11-17T12:00:00Z');
const game = { challenge: getDailyChallenge(startedAt), status: 'finished', answers: ['Mexico'], startedAt, finishedAt: startedAt + 30_000 };
const link = () => createResultLink(game);
// Grįžtant į pradžią imituojamas tik pradinis serverio atsakymas.
vi.mock('../src/features/game/api.js', async () => {
  const { getDailyChallenge } = await import('../src/features/game/challenges.js');
  return { getGame: vi.fn(async () => ({
    game: { challenge: { ...getDailyChallenge(), prompt: 'Today’s challenge' }, status: 'ready', answers: [], startedAt: null, finishedAt: null,
      score: { correctness: 0, speed: 0, total: 0 } },
    serverNow: Date.now(), accepted: false, feedback: { kind: 'hint', text: '' }, results: [],
  })), startGame: vi.fn(), submitAnswer: vi.fn() };
});
beforeEach(() => { window.history.replaceState(null, '', '/'); localStorage.clear(); });
afterEach(() => window.history.replaceState(null, '', '/'));

describe('shared match results', () => {
  it('opens without local progress, hides spoilers, and never saves another player’s game', () => {
    window.history.replaceState(null, '', link());
    const write = vi.spyOn(Storage.prototype, 'setItem');
    render(<App />);
    expect(screen.getByText('Shared result')).toBeInTheDocument();
    expect(screen.getByLabelText('Total score')).toHaveTextContent('100');
    expect(screen.queryByText('Mexico')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show answers (spoilers)' }));
    expect(screen.getByText('Mexico')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Play today’s challenge' })).toHaveAttribute('href', '/');
    expect(write).not.toHaveBeenCalled();
  });

  it('handles invalid links without breaking the homepage', () => {
    window.history.replaceState(null, '', '/#results=broken!');
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid results link');
    expect(screen.getByRole('link', { name: 'Play today’s challenge' })).toBeInTheDocument();
  });

  it('handles navigation to a shared link and back without reloading', async () => {
    await act(async () => render(<App />));
    act(() => { window.history.replaceState(null, '', link()); window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(screen.getByLabelText('Total score')).toHaveTextContent('100');
    await act(async () => { window.history.replaceState(null, '', '/'); window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(screen.getByRole('button', { name: 'Start challenge' })).toBeInTheDocument();
  });
});
