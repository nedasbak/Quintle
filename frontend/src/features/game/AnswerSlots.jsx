import { CircleCheck } from 'lucide-react';
import { getAnswerDetails } from './scoring.js';

export default function AnswerSlots({ answers, status, challengeDate }) {
  const finished = status === 'finished';

  return (
    <ol className={`answer-list ${finished ? 'answer-list-results' : ''}`} aria-label="Your five answers">
      {Array.from({ length: 5 }, (_, index) => {
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
            {answer && <span className="answer-points" aria-label={`${100 + details.bonus} points${details.bonus ? `, including ${details.bonus} rarity bonus` : ''}`}>
              +{100 + details.bonus}
              {finished && details.bonus > 0 && <span>+{details.bonus} rarity</span>}
            </span>}
          </li>
        );
      })}
    </ol>
  );
}
