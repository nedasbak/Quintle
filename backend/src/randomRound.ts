import { randomInt } from 'node:crypto';
import { getPracticeChallenge, getPracticeThemes } from '../../shared/practiceChallenges.mjs';
import { MAX_ANSWERS } from '../../shared/gameRules.mjs';

export interface RandomQuestion {
  id: string;
  theme: string;
  category: string;
  prompt: string;
  answers: string[][];
  replacedIds?: string[];
}

function questionFromId(id: string): RandomQuestion {
  const challenge = getPracticeChallenge(id)!;
  return { id: challenge.id, theme: challenge.theme, category: challenge.category,
    prompt: `Name one example: ${challenge.title.charAt(0).toLowerCase()}${challenge.title.slice(1)}`,
    answers: challenge.answers };
}

export function createRandomRound(): RandomQuestion[] {
  const themes = getPracticeThemes();
  if (themes.length < MAX_ANSWERS) throw new Error('Random needs five available themes.');
  return Array.from({ length: MAX_ANSWERS }, () => {
    const [theme] = themes.splice(randomInt(themes.length), 1);
    const choice = theme.challenges[randomInt(theme.challenges.length)];
    return questionFromId(choice.id);
  });
}

export function replaceRandomQuestion(questions: RandomQuestion[], index: number): RandomQuestion | null {
  const previous = questions[index];
  const seen = new Set(questions.flatMap(question => [question.id, ...(question.replacedIds ?? [])]));
  const otherThemes = new Set(questions.filter((_, position) => position !== index).map(question => question.theme));
  const available = getPracticeThemes().filter(theme => !otherThemes.has(theme.id))
    .map(theme => ({ ...theme, challenges: theme.challenges.filter((choice: { id: string }) => !seen.has(choice.id)) }))
    .filter(theme => theme.challenges.length);
  const different = available.filter(theme => theme.id !== previous.theme);
  const themes = different.length ? different : available;
  if (!themes.length) return null;
  const theme = themes[randomInt(themes.length)];
  const choice = theme.challenges[randomInt(theme.challenges.length)];
  return { ...questionFromId(choice.id), replacedIds: [...(previous.replacedIds ?? []), previous.id] };
}
