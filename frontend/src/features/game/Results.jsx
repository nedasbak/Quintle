import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Share2, Trophy } from 'lucide-react';
import AnswerSlots from './AnswerSlots.jsx';
import { nextChallengeIn } from './challenges.js';
import { getScoreBreakdown } from './scoring.js';
import { createResultLink } from './resultLinks.js';
import { POINTS_PER_ANSWER } from '../../../../shared/gameRules.mjs';

export default function Results({ game, remaining, now, shared = false }) {
  const [showAnswers, setShowAnswers] = useState(!shared);
  const [shareStatus, setShareStatus] = useState('');
  const [shareFallback, setShareFallback] = useState('');
  const ref = useRef(null);
  const { answers, challenge } = game;
  const practice = game.mode === 'practice';
  // Bendras rezultatas imamas iš serverio, retumas lieka atskira peržiūra.
  const preview = getScoreBreakdown(answers, remaining);
  const score = game.score ?? preview;
  const elapsed = ((game.finishedAt - game.startedAt) / 1000).toFixed(1);
  const resultLink = createResultLink(game);

  useEffect(() => { ref.current?.focus(); }, []);

  async function shareResult() {
    const blocks = Array.from({ length: 5 }, (_, index) => index < answers.length ? '🟩' : '⬛').join('');
    const title = practice ? 'Quintle practice' : `Quintle #${String(challenge.number).padStart(3, '0')}`;
    const text = `${title} · ${challenge.date}\n${blocks}\n${answers.length}/5 · ${score.total} points\nFive answers. Thirty seconds.\n${resultLink}`;
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus('Copied to clipboard!');
    } catch {
      setShareFallback(text);
      setShareStatus('Select and copy your result below.');
    }
  }

  return (
    <section ref={ref} className="results-screen" role="region" aria-label="Your result" tabIndex={-1}>
      <div className="result-hero">
        <Trophy className="result-trophy" size={26} strokeWidth={1.7} aria-hidden="true" />
        <h1>{answers.length === 5 ? 'Five for five' : answers.length > 0 ? 'Every answer counts' : practice ? 'Try another round' : 'A fresh chance tomorrow'}</h1>
        <p>{answers.length} of 5 correct in {elapsed} seconds</p>
        <output className="total-score" aria-label="Total score"><strong>{score.total.toLocaleString('en-US')}</strong><span>Total points</span></output>
      </div>

      <div className="score-breakdown" aria-label="Score breakdown">
        <div aria-label="Correctness points"><span>Correctness</span><strong>{score.correctness}</strong><small>{answers.length} × {POINTS_PER_ANSWER} points</small></div>
        <div aria-label="Speed bonus"><span>Speed</span><strong>+{score.speed}</strong><small>{(remaining / 1000).toFixed(1)}s remaining</small></div>
        <div aria-label="Rarity preview"><span>Rarity preview</span><strong>+{preview.rarity}</strong><small>Not added to score</small></div>
      </div>

      {shared && <button type="button" className="text-button" aria-expanded={showAnswers} aria-controls="result-answers" onClick={() => setShowAnswers(!showAnswers)}>{showAnswers ? 'Hide answers' : 'Show answers (spoilers)'}</button>}
      {showAnswers && <div id="result-answers">
      <div className="results-list-heading"><h2>{shared ? 'Match answers' : 'Your answers'}</h2><span>Points · rarity preview</span></div>
      <AnswerSlots answers={answers} status="finished" challengeDate={challenge.date} />
      </div>}
      <p className="rarity-disclaimer">Rarity uses sample pick rates for this preview, not live player data. Preview values do not change your score.</p>

      <button type="button" className="primary-button share-button" onClick={shareResult}>
        {shareStatus === 'Copied to clipboard!' ? <Check size={17} /> : <Share2 size={17} />}
        {shareStatus === 'Copied to clipboard!' ? 'Result copied' : 'Share your result'}
        <Copy size={15} />
      </button>
      <p className="share-status" role="status">{shareStatus || 'Spoiler-free preview. Full match details in the link.'}</p>
      <a className="result-link" href={resultLink} target="_blank" rel="noopener noreferrer">View match results</a>
      {shareFallback && <textarea className="share-fallback" aria-label="Result to copy" readOnly value={shareFallback} onFocus={(event) => event.target.select()} />}
      {!shared && game.mode !== 'practice' && <p className="next-challenge">Next challenge in <strong>{nextChallengeIn(now)}</strong></p>}
    </section>
  );
}
