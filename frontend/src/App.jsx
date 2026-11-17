import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowUp, CircleHelp, Trophy } from 'lucide-react';
import Dialog from './components/Dialog.jsx';
import AnswerSlots from './features/game/AnswerSlots.jsx';
import Countdown from './features/game/Countdown.jsx';
import Results from './features/game/Results.jsx';
import { getScoreBreakdown } from './features/game/scoring.js';
import { getResults, getStatistics } from './features/game/storage.js';
import useGame from './features/game/useGame.js';
import SharedResults from './features/game/SharedResults.jsx';
import { readResultLink } from './features/game/resultLinks.js';

function subscribeToHash(callback) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export default function App() {
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash);
  const result = useMemo(() => readResultLink(hash), [hash]);
  return result.kind === 'none' ? <GameApp /> : <SharedResults key={hash} result={result} />;
}

function GameApp() {
  const { game, now, remaining, feedback, start, submit } = useGame();
  const [answer, setAnswer] = useState('');
  const [dialog, setDialog] = useState(null);
  const inputRef = useRef(null);
  const { challenge, status, answers } = game;
  const playing = status === 'playing';
  const finished = status === 'finished';
  const statistics = useMemo(() => getStatistics(getResults()), [game]);
  const liveScore = getScoreBreakdown(answers).total;
  const prompt = 'Name 5 ' + challenge.title.charAt(0).toLowerCase() + challenge.title.slice(1);

  useEffect(() => {
    if (playing) inputRef.current?.focus();
  }, [playing]);

  useEffect(() => { setAnswer(''); }, [challenge.date]);

  function onSubmit(event) {
    event.preventDefault();
    if (submit(answer)) setAnswer('');
    else inputRef.current?.select();
    inputRef.current?.focus();
  }

  return (
    <div className={'site-shell ' + (playing ? 'is-playing' : '')}>
      <header className="site-header">
        <a href="/" className="wordmark" aria-label="Quintle home">quintle</a>
        <nav className="header-actions" aria-label="Game information">
          <button type="button" className="icon-button" aria-label="How to play" onClick={() => setDialog('help')}>
            <CircleHelp size={18} />
          </button>
          <button type="button" className="best-score" aria-label="Your statistics" title="Your best score" onClick={() => setDialog('stats')}>
            <Trophy size={15} strokeWidth={1.7} /><span>{statistics.best.toLocaleString('en-US')}</span>
          </button>
        </nav>
      </header>

      <main className="main-content">
        <div className="challenge-meta">
          <span title={'Challenge for ' + challenge.date + ' UTC'}>Daily #{String(challenge.number).padStart(3, '0')}</span>
          <span>{challenge.category}</span>
        </div>

        {finished ? <Results key={challenge.date} game={game} remaining={remaining} now={now} /> : (
          <section className="game-screen" aria-labelledby="challenge-title">
            <div className="challenge-heading">
              <Countdown remaining={remaining} status={status} />
              <h1 id="challenge-title">{prompt}</h1>
              <p>Be quick. Be accurate. Think differently.</p>
            </div>

            <AnswerSlots answers={answers} status={status} challengeDate={challenge.date} />

            <div className="entry-area">
              <form className="answer-form" onSubmit={onSubmit} noValidate>
                <label htmlFor="answer-input" className="sr-only">Your answer</label>
                <input ref={inputRef} id="answer-input" name="answer" value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder={playing ? 'Type your next answer…' : 'Press Start when you’re ready…'}
                  disabled={!playing} autoComplete="off" autoCapitalize="words" spellCheck={false}
                  maxLength={80} enterKeyHint="send" aria-describedby="answer-feedback"
                  aria-invalid={playing && feedback.kind === 'error'} />
                {playing ? (
                  <button type="submit" className="submit-button" disabled={!answer.trim()} aria-label="Submit answer"><ArrowUp size={20} /></button>
                ) : (
                  <button type="button" className="primary-button start-button" aria-label="Start challenge" onClick={start}>Start<ArrowUp size={18} /></button>
                )}
              </form>
              <div className="game-scoreline">
                <span>{answers.length} of 5 answers</span>
                <output className="live-score" aria-label="Live score" aria-live="polite">{liveScore.toLocaleString('en-US')} pts</output>
              </div>
              <p id="answer-feedback" className={'answer-feedback ' + (playing ? 'feedback-' + feedback.kind : '')} role="status" aria-live="polite">
                {playing ? feedback.text : 'Five answers. Thirty seconds. Your time starts with Start.'}
              </p>
            </div>
          </section>
        )}

        <footer className="game-footer">
          <span>A new challenge every day at 00:00 UTC</span>
          <button type="button" className="text-button" onClick={() => setDialog('help')}>How to play</button>
        </footer>
      </main>

      <Dialog open={dialog === 'help'} title="How to play" onClose={() => setDialog(null)}>
        <p className="dialog-intro">Five answers. Thirty seconds. One daily challenge.</p>
        <ol className="how-to-list">
          <li><strong>Start the clock</strong><p>Read the category, then press Start. The 30-second timer keeps running if you leave or refresh.</p></li>
          <li><strong>Find your five</strong><p>Type one answer at a time and press Enter or the arrow. Invalid answers and duplicates won’t use a slot.</p></li>
          <li><strong>Think differently</strong><p>Earn 100 points per accepted answer and 10 per second left at the end. Less common answers earn an extra bonus.</p></li>
        </ol>
        <div className="rarity-explanation">
          <h3>Rarity preview</h3>
          <p>Pick rates are sample values for this preview. Answers with a pick rate of 11–25% earn +25 points. At 10% or less, they earn +50.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setDialog(null)}>Got it</button>
      </Dialog>

      <Dialog open={dialog === 'stats'} title="Your statistics" onClose={() => setDialog(null)}>
        <p className="dialog-intro">Your daily progress, saved in this browser.</p>
        <div className="statistics-grid">
          <div><strong>{statistics.played}</strong><span>Played</span></div>
          <div><strong>{statistics.completed}</strong><span>Five for five</span></div>
          <div><strong>{statistics.streak}</strong><span>Day streak</span></div>
          <div><strong>{statistics.best}</strong><span>Best score</span></div>
        </div>
        <p className="stats-note">{statistics.played ? 'Come back tomorrow and keep your streak going.' : 'Your first challenge is waiting.'}</p>
        <button type="button" className="primary-button" onClick={() => setDialog(null)}>Back to the challenge</button>
      </Dialog>
    </div>
  );
}
