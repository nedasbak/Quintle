import { useEffect, useRef, useState } from 'react';
import { GAME_DURATION, getDailyChallenge, remainingTime, validateAnswer } from './challenges.js';
import { finishGame, newGame, restoreGame, saveAttempt, saveResult } from './storage.js';

export default function useGame() {
  const [game, setGame] = useState(() => restoreGame());
  const gameRef = useRef(game);
  const [now, setNow] = useState(Date.now);
  const [feedback, setFeedback] = useState({ kind: 'hint', text: 'A little focus goes a long way.' });

  function update(next) {
    gameRef.current = next;
    saveAttempt(next);
    if (next.status === 'finished') saveResult(next);
    setGame(next);
  }

  useEffect(() => {
    saveAttempt(game);
    if (game.status === 'finished') saveResult(game);
  }, [game]);

  useEffect(() => {
    function tick() {
      const time = Date.now();
      setNow(time);
      const current = gameRef.current;
      if (current.status === 'playing' && remainingTime(current.startedAt, time) === 0) {
        update(finishGame(current, time));
        setFeedback({ kind: 'hint', text: 'Time’s up. Every answer counts.' });
      } else if (current.status !== 'playing' && current.challenge.date !== getDailyChallenge(time).date) {
        update(newGame(time));
        setFeedback({ kind: 'hint', text: 'A fresh challenge is ready for you.' });
      }
    }
    tick();
    const interval = window.setInterval(tick, game.status === 'playing' ? 50 : 1000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [game.status]);

  function start() {
    const current = gameRef.current;
    if (current.status !== 'ready') return;
    const time = Date.now();
    const challenge = getDailyChallenge(time);
    update({ ...newGame(time), challenge, status: 'playing', startedAt: time });
    setNow(time);
    setFeedback({ kind: 'hint', text: 'You’ve got this. Enter your first answer.' });
  }

  function submit(input) {
    const current = gameRef.current;
    if (current.status !== 'playing') return false;
    const time = Date.now();
    setNow(time);
    if (remainingTime(current.startedAt, time) === 0) {
      update(finishGame(current, time));
      return false;
    }
    if (!input.trim()) {
      setFeedback({ kind: 'error', text: 'Type an answer first.' });
      return false;
    }
    const result = validateAnswer(current.challenge, input, current.answers);
    if (result.error) {
      setFeedback({ kind: 'error', text: result.error });
      return false;
    }
    const next = { ...current, answers: [...current.answers, result.answer] };
    update(next.answers.length === 5 ? finishGame(next, time) : next);
    setFeedback({ kind: 'success', text: next.answers.length === 5 ? 'Five for five. Beautifully done.' : `${result.answer} is in. Keep going!` });
    return true;
  }

  const remaining = game.status === 'ready' ? GAME_DURATION
    : remainingTime(game.startedAt, game.status === 'finished' ? game.finishedAt : now);

  return { game, now, remaining, feedback, start, submit };
}
