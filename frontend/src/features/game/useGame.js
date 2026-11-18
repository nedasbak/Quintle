import { useCallback, useEffect, useRef, useState } from 'react';
import { GAME_DURATION, getDailyChallenge, remainingTime } from './challenges.js';
import { getGame, startGame, submitAnswer, getPracticeGame, startPracticeGame, submitPracticeAnswer, startRandomGame } from './api.js';
import { getPracticeId, savePracticeId, saveServerResults } from './storage.js';

export default function useGame() {
  const [game, setGame] = useState(null);
  const gameRef = useRef(null);
  const [now, setNow] = useState(Date.now);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState({ kind: 'hint', text: 'A little focus goes a long way.' });
  const requestRef = useRef(null);
  const clockRef = useRef(null);
  const nextRefreshRef = useRef(0);

  // Nauja būsena priimama tik iš serverio; tuo pat metu siunčiama viena užklausa.
  const run = useCallback(async operation => {
    if (requestRef.current) return false;
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    try {
      const response = await operation(controller.signal);
      if (controller.signal.aborted) return false;
      gameRef.current = response.game;
      clockRef.current = { server: response.serverNow, local: performance.now() };
      nextRefreshRef.current = 0;
      setNow(response.serverNow);
      if (response.game.mode !== 'practice') saveServerResults(response.results);
      savePracticeId(response.game.mode === 'practice' ? response.game.id : null);
      setGame(response.game);
      setFeedback(response.feedback);
      setError('');
      return response.accepted;
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message || 'The game request failed. Please try again.');
      return false;
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPending(false);
      }
    }
  }, []);
  const refresh = useCallback(() => run(async signal => {
    const current = gameRef.current;
    const id = current ? current.mode === 'practice' ? current.id : null : getPracticeId();
    if (!id) return getGame(signal);
    try { return await getPracticeGame(id, signal); }
    catch (failure) {
      if (failure.status !== 404 || signal.aborted) throw failure;
      savePracticeId(null);
      return getGame(signal);
    }
  }), [run]);

  useEffect(() => {
    void refresh();
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [refresh]);

  // Ekrano laikmatis sinchronizuojamas su serveriu, o užbaigimą patvirtina API.
  useEffect(() => {
    function tick() {
      const current = gameRef.current;
      const clock = clockRef.current;
      if (!current || !clock) return;
      const time = clock.server + performance.now() - clock.local;
      setNow(time);
      const expired = current.status === 'playing' && remainingTime(current.startedAt, time) === 0;
      const newDay = current.mode !== 'practice' && current.status !== 'playing' && current.challenge.date !== getDailyChallenge(time).date;
      if ((expired || newDay) && performance.now() >= nextRefreshRef.current && !requestRef.current) {
        nextRefreshRef.current = performance.now() + 5000;
        void refresh();
      }
    }
    const interval = window.setInterval(tick, game?.status === 'playing' ? 50 : 1000);
    function reconnect() { tick(); if (!requestRef.current) void refresh(); }
    function visibilityChanged() { if (document.visibilityState === 'visible') reconnect(); }
    window.addEventListener('focus', reconnect);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', reconnect);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [game?.status, refresh]);

  // Dvigubas paspaudimas nepradeda naujo bandymo ir nepateikia atsakymo antrą kartą.
  const start = () => gameRef.current?.status === 'ready' ? run(startGame) : Promise.resolve(false);
  const startPractice = id => gameRef.current?.status !== 'playing'
    ? run(signal => startPracticeGame(id, signal)) : Promise.resolve(false);
  const showDaily = () => gameRef.current?.status !== 'playing'
    ? run(getGame) : Promise.resolve(false);
  const startRandom = () => gameRef.current?.status !== 'playing' ? run(startRandomGame) : Promise.resolve(false);
  const submit = answer => gameRef.current?.status === 'playing' ? run(signal => gameRef.current.mode === 'practice'
    ? gameRef.current.variant === 'random'
      ? submitPracticeAnswer(gameRef.current.id, answer, signal, gameRef.current.questions[gameRef.current.answers.length].id)
      : submitPracticeAnswer(gameRef.current.id, answer, signal)
    : submitAnswer(answer, signal)) : Promise.resolve(false);
  const remaining = !game || game.startedAt === null ? GAME_DURATION
    : remainingTime(game.startedAt, game.status === 'finished' ? game.finishedAt : now);

  return { game, now, remaining, feedback, pending, error, refresh, start, submit, startPractice, showDaily,
    startRandom };
}
