import { GAME_DURATION } from './challenges.js';

export default function Countdown({ remaining, status }) {
  const seconds = Math.ceil(remaining / 1000);
  const phase = remaining <= 5000 ? 'critical' : remaining <= 10_000 ? 'warning' : 'normal';
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={`countdown countdown-${phase}`} role="timer" aria-label={`${seconds} seconds remaining`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="timer-track" cx="60" cy="60" r={radius} />
        <circle className="timer-progress" cx="60" cy="60" r={radius} strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - remaining / GAME_DURATION)} />
      </svg>
      <div className="countdown-content"><span className="countdown-number">{seconds}</span><span className="countdown-label">Seconds</span></div>
      <span className="sr-only" role="status" aria-live="polite">{status === 'playing' && seconds === 10 ? 'Ten seconds remaining.' : status === 'playing' && seconds === 5 ? 'Five seconds remaining.' : ''}</span>
    </div>
  );
}
