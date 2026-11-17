// UI fixtures only. The Express API will own authoritative content and validation.
const examples = [
  {
    title: 'Countries beginning with M',
    emphasis: 'M',
    category: 'Geography',
    description: 'Think around the world. Name five different countries that start with the letter M.',
    placeholder: 'Type a country…',
    answers: [
      ['Madagascar'], ['Malawi'], ['Malaysia'], ['Maldives', 'the Maldives'],
      ['Mali'], ['Malta'], ['Marshall Islands', 'the Marshall Islands'],
      ['Mauritania'], ['Mauritius'], ['Mexico'],
      ['Micronesia', 'Federated States of Micronesia'], ['Moldova'], ['Monaco'],
      ['Mongolia'], ['Montenegro'], ['Morocco'], ['Mozambique'], ['Myanmar', 'Burma'],
    ],
  },
  {
    title: 'Planets in our solar system',
    emphasis: 'solar system',
    category: 'Space',
    description: 'A little out-of-this-world thinking. Name five of the eight planets in our solar system.',
    placeholder: 'Type a planet…',
    answers: [['Mercury'], ['Venus'], ['Earth', 'the Earth'], ['Mars'], ['Jupiter'], ['Saturn'], ['Uranus'], ['Neptune']],
  },
  {
    title: 'Countries in South America',
    emphasis: 'South America',
    category: 'Geography',
    description: 'Head south. Name five different sovereign countries on the South American continent.',
    placeholder: 'Type a country…',
    answers: [
      ['Argentina'], ['Bolivia'], ['Brazil', 'Brasil'], ['Chile'], ['Colombia'],
      ['Ecuador'], ['Guyana'], ['Paraguay'], ['Peru', 'Perú'], ['Suriname', 'Surinam'],
      ['Uruguay'], ['Venezuela'],
    ],
  },
];

export const GAME_DURATION = 30_000;
const DAY = 86_400_000;
const EPOCH = Date.UTC(2026, 10, 17);

export function getDailyChallenge(now = Date.now()) {
  const date = new Date(now).toISOString().slice(0, 10);
  const offset = Math.floor((Date.parse(date) - EPOCH) / DAY);
  const index = ((offset % examples.length) + examples.length) % examples.length;
  return { ...examples[index], date, number: Math.max(1, offset + 1) };
}

export function normalizeAnswer(answer) {
  return answer.normalize('NFKD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function validateAnswer(challenge, input, accepted) {
  const normalized = normalizeAnswer(input);
  const answer = challenge.answers.find((variants) => variants.some((variant) => normalizeAnswer(variant) === normalized));
  if (!answer) return { error: 'Not quite. Try another answer.' };
  if (accepted.includes(answer[0])) return { error: 'Already on your list. Think of another!' };
  return { answer: answer[0] };
}

export function remainingTime(startedAt, now = Date.now()) {
  return Math.max(0, Math.min(GAME_DURATION, GAME_DURATION - (now - startedAt)));
}

export function calculateScore(correct, remainingMs) {
  return correct * 100 + Math.floor(Math.max(0, Math.min(GAME_DURATION, remainingMs)) / 100);
}

export function nextChallengeIn(now = Date.now()) {
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const total = Math.max(0, Math.floor((midnight.getTime() - now) / 1000));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((value) => String(value).padStart(2, '0')).join(':');
}
