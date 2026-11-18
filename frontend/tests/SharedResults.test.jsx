import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import { getDailyChallenge } from '../src/features/game/challenges.js';
import { createResultLink, readResultLink } from '../src/features/game/resultLinks.js';

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
    expect(screen.getByRole('link', { name: 'Play Quintle' })).toHaveAttribute('href', '/');
    expect(write).not.toHaveBeenCalled();
  });

  it('handles invalid links without breaking the homepage', () => {
    window.history.replaceState(null, '', '/#results=broken!');
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid results link');
    expect(screen.getByRole('link', { name: 'Play Quintle' })).toBeInTheDocument();
  });

  it('handles navigation to a shared link and back without reloading', async () => {
    await act(async () => render(<App />));
    act(() => { window.history.replaceState(null, '', link()); window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(screen.getByLabelText('Total score')).toHaveTextContent('100');
    await act(async () => { window.history.replaceState(null, '', '/'); window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(screen.getByRole('button', { name: 'Start challenge' })).toBeInTheDocument();
  });

  it('labels shared practice and copies a spoiler-free result without saving daily progress', async () => {
    const practice = { ...game, mode: 'practice', answers: ['Piano'],
      challenge: { ...game.challenge, category: 'Music', prompt: 'Name 5 musical instruments' } };
    window.history.replaceState(null, '', createResultLink(practice));
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<App />);
    expect(screen.getByText(/^Practice · /)).toBeInTheDocument();
    expect(screen.queryByText(/Daily #/)).not.toBeInTheDocument();
    expect(screen.getByText(practice.challenge.prompt)).toBeInTheDocument();
    expect(screen.getByLabelText('Total score')).toHaveTextContent('100');
    expect(screen.queryByText('Piano')).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Share your result' })));
    const text = writeText.mock.calls[0][0];
    expect(text).toMatch(/^Quintle practice · /);
    expect(text).not.toContain('Piano');
    expect(readResultLink(new URL(text.split('\n').at(-1)).hash).game.mode).toBe('practice');
    fireEvent.click(screen.getByRole('button', { name: 'Show answers (spoilers)' }));
    expect(screen.getByText('Piano')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Play Quintle' })).toHaveAttribute('href', '/');
    expect(write).not.toHaveBeenCalled();
  });

  it('offers another round after an empty practice result', () => {
    window.history.replaceState(null, '', createResultLink({ ...game, mode: 'practice', answers: [] }));
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Try another round' })).toBeInTheDocument();
    expect(screen.queryByText(/tomorrow|Next challenge in/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Total score')).toHaveTextContent('0');
  });
});
