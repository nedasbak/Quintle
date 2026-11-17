import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-17T12:00:00Z'));
  localStorage.clear();
});

function start() {
  fireEvent.click(screen.getByRole('button', { name: 'Start challenge' }));
}

function answer(value) {
  fireEvent.change(screen.getByRole('textbox', { name: /your answer/i }), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
}

describe('main game interface', () => {
  it('shows the daily challenge and five slots without starting the clock', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Name 5 countries beginning with M');
    expect(within(screen.getByRole('list', { name: 'Your five answers' })).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('textbox', { name: /your answer/i })).toBeDisabled();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', '30 seconds remaining');
  });

  it('starts on click, focuses the input, and rejects invalid or duplicate aliases', () => {
    render(<App />);
    start();
    expect(screen.getByRole('textbox', { name: /your answer/i })).toHaveFocus();
    answer('Moon');
    expect(screen.getByText('Not quite. Try another answer.')).toBeInTheDocument();
    answer('Burma');
    expect(screen.getByText('Myanmar')).toBeInTheDocument();
    answer('Myanmar');
    expect(screen.getByText('Already on your list. Think of another!')).toBeInTheDocument();
    expect(screen.getAllByText('+150')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', '29 seconds remaining');
  });

  it('finishes at five correct answers with an exact score and restores the result', () => {
    const view = render(<App />);
    start();
    act(() => vi.advanceTimersByTime(5000));
    ['Mexico', 'Malta', 'Morocco', 'Mali', 'Monaco'].forEach(answer);
    expect(screen.getByLabelText('Total score')).toHaveTextContent('800');
    expect(screen.getByRole('button', { name: /share your result/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /your answer/i })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('25.0s remaining')).toBeInTheDocument();
    view.unmount();
    render(<App />);
    expect(screen.getByLabelText('Total score')).toHaveTextContent('800');
  });

  it('automatically ends on timeout and cannot restart by reloading', () => {
    const view = render(<App />);
    start();
    answer('Mexico');
    act(() => vi.advanceTimersByTime(30_001));
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByText('0.0s remaining')).toBeInTheDocument();
    expect(screen.getByLabelText('Total score')).toHaveTextContent('100');
    expect(screen.getByRole('button', { name: /share your result/i })).toBeInTheDocument();
    view.unmount();
    render(<App />);
    expect(screen.queryByRole('button', { name: 'Start challenge' })).not.toBeInTheDocument();
  });

  it('retains the original active deadline after a refresh', () => {
    const view = render(<App />);
    start();
    answer('Mexico');
    act(() => vi.advanceTimersByTime(10_000));
    view.unmount();
    render(<App />);
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', '20 seconds remaining');
    expect(screen.getByText('Mexico')).toBeInTheDocument();
  });

  it('rejects a late answer even if the timer callback has not run', () => {
    render(<App />);
    start();
    vi.setSystemTime(new Date('2026-11-17T12:00:31Z'));
    answer('Mexico');
    expect(screen.queryByText('Mexico')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your result' })).toBeInTheDocument();
  });

  it('copies a spoiler-free result', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<App />);
    start();
    answer('Mexico');
    act(() => vi.advanceTimersByTime(30_000));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /share your result/i })));
    const shared = writeText.mock.calls[0][0];
    expect(shared).toContain('1/5 · 100 points');
    expect(shared).not.toContain('Mexico');
    expect(screen.getByText('Copied to clipboard!')).toBeInTheDocument();
  });

  it('offers selectable text when clipboard access is denied', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<App />);
    start();
    act(() => vi.advanceTimersByTime(30_000));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /share your result/i })));
    expect(screen.getByRole('textbox', { name: 'Result to copy' }).value).toContain('Quintle #001');
  });

  it('opens and closes the help dialog', () => {
    render(<App />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Game information' })).getByRole('button', { name: 'How to play' }));
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryByRole('dialog', { name: 'How to play' })).not.toBeInTheDocument();
  });

  it('updates the live score only when answers are accepted, with sample rarity bonuses', () => {
    render(<App />);
    expect(screen.getByLabelText('Live score')).toHaveTextContent('0 pts');
    start();
    answer('Mexico');
    expect(screen.getByLabelText('Live score')).toHaveTextContent('100 pts');
    answer('Burma');
    expect(screen.getByLabelText('Live score')).toHaveTextContent('250 pts');
    answer('Myanmar');
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByLabelText('Live score')).toHaveTextContent('250 pts');
  });

  it('changes the countdown to orange at ten seconds and red at five', () => {
    render(<App />);
    start();
    expect(screen.getByRole('timer')).toHaveClass('countdown-normal');
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByRole('timer')).toHaveClass('countdown-warning');
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', '10 seconds remaining');
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole('timer')).toHaveClass('countdown-critical');
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', '5 seconds remaining');
  });

  it('submits an answer with the Enter key', async () => {
    vi.useRealTimers();
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-17T12:00:00Z'));
    const user = userEvent.setup();
    render(<App />);
    start();
    await user.type(screen.getByRole('textbox', { name: /your answer/i }), 'Mexico{Enter}');
    expect(screen.getByText('Mexico')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /your answer/i })).toHaveValue('');
    expect(screen.getByLabelText('Live score')).toHaveTextContent('100 pts');
  });

  it('shows correctness, speed, sample rarity percentages, and their total on results', () => {
    render(<App />);
    start();
    act(() => vi.advanceTimersByTime(5000));
    ['Mexico', 'Malta', 'Morocco', 'Mali', 'Monaco'].forEach(answer);
    expect(screen.getByLabelText('Correctness points')).toHaveTextContent('500');
    expect(screen.getByLabelText('Speed bonus')).toHaveTextContent('+250');
    expect(screen.getByLabelText('Rarity bonus')).toHaveTextContent('+50');
    expect(screen.getByLabelText('Total score')).toHaveTextContent('800');
    expect(screen.getByText('Common · 74% sample pick rate')).toBeInTheDocument();
    expect(screen.getByText('Uncommon · 19% sample pick rate')).toBeInTheDocument();
    expect(screen.getByText(/not live player data/)).toBeInTheDocument();
  });
});
