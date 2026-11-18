import { CircleCheck, SkipForward } from 'lucide-react';
import { getAnswerDetails } from './scoring.js';
import { MAX_ANSWERS, POINTS_PER_ANSWER } from '../../../../shared/gameRules.mjs';

export default function AnswerSlots({ answers, status, challengeDate, questions, skipped = [], onSkip, skipDisabled = false }) {
  const finished = status === 'finished';

  return (
    <ol className={`answer-list ${finished ? 'answer-list-results' : ''}`} aria-label="Your five answers">
      {Array.from({ length: MAX_ANSWERS }, (_, index) => {
        const isSkipped = skipped.includes(index);
        const answer = isSkipped ? null : answers[index - skipped.filter(position => position < index).length];
        const details = answer ? getAnswerDetails(answer) : null;
        const current = status === 'playing' && index === answers.length + skipped.length;
        return (
          <li key={`${challengeDate}-${index}`} aria-current={current ? 'step' : undefined}
            className={`answer-slot ${answer ? 'slot-filled' : ''} ${current ? 'slot-current' : ''}`}>
            <span className="slot-icon" aria-hidden="true">{answer ? <CircleCheck size={16} /> : index + 1}</span>
            <div className="slot-content">
              {questions?.[index] && <span className="slot-question">{questions[index].prompt}</span>}
              <span className="slot-answer">{answer || (isSkipped ? 'Skipped' : finished ? 'No answer' : 'Waiting for answer…')}</span>
              {finished && details && <span className="answer-rarity">{details.label}{details.pickRate !== null && ` · ${details.pickRate}% sample pick rate`}</span>}
            </div>
            {current && onSkip && <button type="button" className="slot-skip" onClick={onSkip} disabled={skipDisabled}
              aria-label="Skip question" title="Replace this question with a new one. The timer keeps running.">
              <SkipForward size={16} aria-hidden="true" /><span>Skip</span>
            </button>}
            {/* Atsakymo taškai atskirti nuo demonstracinės retumo reikšmės. */}
            {answer && <span className="answer-points" aria-label={`${POINTS_PER_ANSWER} points`}>
              +{POINTS_PER_ANSWER}
              {finished && details.bonus > 0 && <span>Preview +{details.bonus}</span>}
            </span>}
          </li>
        );
      })}
    </ol>
  );
}
