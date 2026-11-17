import { CircleCheck } from 'lucide-react';
import { getAnswerDetails } from './scoring.js';
import { MAX_ANSWERS, POINTS_PER_ANSWER } from '../../../../shared/gameRules.mjs';

export default function AnswerSlots({ answers, status, challengeDate }) {
  const finished = status === 'finished';

  return (
    <ol className={`answer-list ${finished ? 'answer-list-results' : ''}`} aria-label="Your five answers">
      {Array.from({ length: MAX_ANSWERS }, (_, index) => {
        const answer = answers[index];
        const details = answer ? getAnswerDetails(answer) : null;
        const current = status === 'playing' && index === answers.length;
        return (
          <li key={`${challengeDate}-${index}`} className={`answer-slot ${answer ? 'slot-filled' : ''} ${current ? 'slot-current' : ''}`}>
            <span className="slot-icon" aria-hidden="true">{answer ? <CircleCheck size={16} /> : index + 1}</span>
            <div className="slot-content">
              <span className="slot-answer">{answer || (finished ? 'No answer' : 'Waiting for answer…')}</span>
              {finished && details && <span className="answer-rarity">{details.label}{details.pickRate !== null && ` · ${details.pickRate}% sample pick rate`}</span>}
            </div>
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
