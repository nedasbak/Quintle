import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowUp, CircleHelp, Trophy } from 'lucide-react';
import Dialog from './components/Dialog.jsx';
import AnswerSlots from './features/game/AnswerSlots.jsx';
import Countdown from './features/game/Countdown.jsx';
import Results from './features/game/Results.jsx';
import PracticePicker from './features/game/PracticePicker.jsx';
import { MAX_ANSWER_LENGTH, POINTS_PER_ANSWER, POINTS_PER_SECOND } from '../../shared/gameRules.mjs';
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
  const { game, now, remaining, feedback, pending, error, refresh, start, submit, startPractice, showDaily,
    startRandom } = useGame();
  const [answer, setAnswer] = useState('');
  const [dialog, setDialog] = useState(null);
  const inputRef = useRef(null);
  const { challenge, status, answers } = game ?? { challenge: null, status: 'loading', answers: [] };
  const playing = status === 'playing';
  const finished = status === 'finished';
  const practice = game?.mode === 'practice';
  const random = practice && game?.variant === 'random';
  const statistics = useMemo(() => getStatistics(getResults()), [game]);
  // Sąsaja rodo serverio patvirtintus taškus ir užduoties tekstą.
  const liveScore = game?.score.correctness ?? 0;
  const prompt = challenge?.prompt;

  useEffect(() => {
    if (playing && !pending && !dialog) inputRef.current?.focus();
  }, [playing, pending, dialog]);

  useEffect(() => {
    setAnswer('');
    if (game?.mode === 'practice') setDialog(current => current === 'practice' ? null : current);
  }, [game?.id, game?.mode, challenge?.date]);

  async function onSubmit(event) {
    event.preventDefault();
    if (await submit(answer)) setAnswer('');
    else inputRef.current?.select();
    inputRef.current?.focus();
  }

  // Kol serveris neatsakė, nepradedamas vietinis ar nepatvirtintas žaidimas.
  if (!game) return (
    <div className="site-shell"><main className="results-screen">
      <h1>quintle</h1>
      <p className="rarity-disclaimer" role={error ? 'alert' : 'status'}>{error || 'Loading today’s challenge…'}</p>
      {error && <button type="button" className="primary-button" disabled={pending} onClick={refresh}>Try again</button>}
    </main></div>
  );

  return (
    <div className={'site-shell ' + (playing ? 'is-playing' : '')}>
      <header className="site-header">
        <a href="/" className="wordmark" aria-label="Quintle home">quintle</a>
        <nav className="header-actions" aria-label="Game information">
          <button type="button" className="text-button" disabled={playing || pending} onClick={startRandom}
            title="Five themes. One answer per theme. One 30-second round.">Random</button>
          <button type="button" className="text-button" disabled={playing || pending} onClick={() => setDialog('practice')}>Practice</button>
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
          <span title={'Challenge for ' + challenge.date + ' UTC'}>{random ? `Random · ${answers.length} / 5`
            : practice ? 'Practice' : `Daily #${String(challenge.number).padStart(3, '0')}`}</span>
          <span>{challenge.category}</span>
        </div>

        {finished ? <Results key={game.id ?? challenge.date} game={game} remaining={remaining} now={now} /> : (
          <section className="game-screen" aria-labelledby="challenge-title">
            <div className="challenge-heading">
              {playing ? (
                <>
                  <Countdown remaining={remaining} status={status} />
                  <h1 id="challenge-title">{prompt}</h1>
                  <p>{random ? 'One answer per question. Five themes. One timer.' : 'Be quick. Be accurate. Think differently.'}</p>
                </>
              ) : (
                <>
                  <h1 id="challenge-title">
                    {status === 'ready' ? 'Ready to play?' : 'Challenge unavailable'}
                  </h1>
                  {status === 'ready' && (
                    <p>Press Begin when you're ready to reveal the question.</p>
                  )}
                </>
              )}
            </div>

            <AnswerSlots answers={answers} status={status} challengeDate={challenge.date} questions={game.questions} />

            <div className="entry-area">
              <form className="answer-form" onSubmit={onSubmit} noValidate>
                <label htmlFor="answer-input" className="sr-only">Your answer</label>
                <input ref={inputRef} id="answer-input" name="answer" value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder={playing ? 'Type your next answer…' : status === 'unavailable' ? 'Challenge unavailable' : 'Press Start when you’re ready…'}
                  disabled={!playing || pending} autoComplete="off" autoCapitalize="words" spellCheck={false}
                  maxLength={MAX_ANSWER_LENGTH} enterKeyHint="send" aria-describedby="answer-feedback"
                  aria-invalid={playing && feedback.kind === 'error'} />
                {playing ? (
                  <button type="submit" className="submit-button" disabled={pending || !answer.trim()} aria-label="Submit answer"><ArrowUp size={20} /></button>
                ) : (
                  <button type="button" className="primary-button start-button" disabled={pending || status !== 'ready'} aria-label="Start challenge" onClick={start}>Start<ArrowUp size={18} /></button>
                )}
              </form>
              <div className="game-scoreline">
                <span>{answers.length} of 5 answers</span>
                <output className="live-score" aria-label="Live score" aria-live="polite">{liveScore.toLocaleString('en-US')} pts</output>
              </div>
              <p id="answer-feedback" className={'answer-feedback ' + (error ? 'feedback-error' : playing ? 'feedback-' + feedback.kind : '')} role="status" aria-live="polite">
                {error || (playing || status === 'unavailable' ? feedback.text : 'Five answers. Thirty seconds. Your time starts with Start.')}
              </p>
              {status === 'unavailable' && <button type="button" className="text-button" disabled={pending} onClick={refresh}>Check again</button>}
              {error && <button type="button" className="text-button" disabled={pending} onClick={refresh}>Reconnect</button>}
            </div>
          </section>
        )}

        {practice && finished && <div className="practice-actions">
          <button type="button" className="primary-button" disabled={pending}
            onClick={random ? startRandom : () => startPractice(challenge.id)}>
            {random ? 'Play another random round' : 'Play again'}
          </button>
          <button type="button" className="text-button" disabled={pending} onClick={showDaily}>Daily challenge</button>
          {error && <p role="alert">{error}</p>}
        </div>}
        {finished && !practice && error && <p className="answer-feedback feedback-error" role="alert">{error}</p>}
        <footer className="game-footer">
          <span>{practice ? 'Practice leaves your daily streak unchanged' : 'A new challenge every day at 00:00 UTC'}</span>
          <button type="button" className="text-button" onClick={() => setDialog('help')}>How to play</button>
        </footer>
      </main>

      {dialog === 'practice' && <PracticePicker pending={pending} error={error} onStart={startPractice} onClose={() => setDialog(null)} />}
      <Dialog open={dialog === 'help'} title="How to play" onClose={() => setDialog(null)}>
        <p className="dialog-intro">Five answers. Thirty seconds. One daily challenge.</p>
        <ol className="how-to-list">
          <li><strong>Start the clock</strong><p>Read the category, then press Start. The 30-second timer keeps running if you leave or refresh.</p></li>
          <li><strong>Find your five</strong><p>Type one answer at a time and press Enter or the arrow. Invalid answers and duplicates won’t use a slot.</p></li>
          <li><strong>Think differently</strong><p>Earn {POINTS_PER_ANSWER} points per accepted answer and {POINTS_PER_SECOND} per second left at the end. The server confirms your score.</p></li>
        </ol>
        <div className="rarity-explanation">
          <h3>Rarity preview</h3>
          <p>Pick rates and rarity values are samples for this preview. They do not change your score.</p>
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
