import { randomInt } from 'node:crypto';
import { getPracticeChallenge, getPracticeThemes } from '../../shared/practiceChallenges.mjs';
import { MAX_ANSWERS } from '../../shared/gameRules.mjs';

export interface RandomQuestion {
  id: string;
  theme: string;
  category: string;
  prompt: string;
  answers: string[][];
}

export function createRandomRound(): RandomQuestion[] {
  const themes = getPracticeThemes();
  if (themes.length < MAX_ANSWERS) throw new Error('Random needs five available themes.');
  return Array.from({ length: MAX_ANSWERS }, () => {
    const [theme] = themes.splice(randomInt(themes.length), 1);
    const choice = theme.challenges[randomInt(theme.challenges.length)];
    const challenge = getPracticeChallenge(choice.id)!;
    return { id: challenge.id, theme: challenge.theme, category: challenge.category,
      prompt: `Name one example: ${challenge.title.charAt(0).toLowerCase()}${challenge.title.slice(1)}`,
      answers: challenge.answers };
  });
}
