import { MAX_ANSWERS } from './gameRules.mjs';
export { GAME_DURATION, calculateScore, remainingTime } from './gameRules.mjs';

// Esamas kategorijų rinkinys naudojamas pradiniams duomenims ir senoms rezultatų nuorodoms.
export const starterChallenges = [
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

const DAY = 86_400_000;
const EPOCH = Date.UTC(2026, 10, 17);

// UTC data visiems žaidėjams parenka tą pačią pradinę dienos kategoriją.
export function getDailyChallenge(now = Date.now()) {
  const date = new Date(now).toISOString().slice(0, 10);
  const offset = Math.floor((Date.parse(date) - EPOCH) / DAY);
  const index = ((offset % starterChallenges.length) + starterChallenges.length) % starterChallenges.length;
  return { ...starterChallenges[index], date, number: Math.max(1, offset + 1) };
}

// Rašybos registras, diakritiniai ženklai ir papildomi tarpai suvienodinami.
export function normalizeAnswer(answer) {
  return answer.normalize('NFKD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Check curated lists before publishing: aliases must identify exactly one canonical answer.
export function buildAnswerIndex(answers, requiredAnswers = MAX_ANSWERS) {
  if (!Number.isSafeInteger(requiredAnswers) || requiredAnswers < 1) throw new RangeError('Invalid required answer count.');
  if (!Array.isArray(answers) || answers.length < requiredAnswers) throw new Error('Not enough distinct accepted answers.');
  const index = new Map();
  const names = new Set();
  for (const variants of answers) {
    if (!Array.isArray(variants) || !variants.length || variants.some(value => typeof value !== 'string')) {
      throw new TypeError('Each answer needs a canonical name and optional text aliases.');
    }
    const canonical = variants[0];
    const name = normalizeAnswer(canonical);
    if (names.has(name)) throw new Error(`Duplicate canonical answer: ${canonical}`);
    names.add(name);
    for (const variant of variants) {
      const key = normalizeAnswer(variant);
      if (!key || [...variant].length > 255 || [...key].length > 255) throw new RangeError('Answer keys must contain 1–255 characters.');
      if (index.has(key) && index.get(key) !== canonical) throw new Error(`Ambiguous answer alias: ${variant}`);
      index.set(key, canonical);
    }
  }
  return index;
}

// Aliases, accents, casing, and spacing resolve before checking previous submissions.
export function validateAnswer(challenge, input, accepted) {
  const index = buildAnswerIndex(challenge.answers);
  const answer = index.get(normalizeAnswer(input));
  if (!answer) return { error: 'Not quite. Try another answer.' };
  if (accepted.some(previous => index.get(normalizeAnswer(previous)) === answer)) return { error: 'Already on your list. Think of another!' };
  return { answer };
}

// Likęs laikas iki kitos UTC dienos pateikiamas sąsajai.
export function nextChallengeIn(now = Date.now()) {
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const total = Math.max(0, Math.floor((midnight.getTime() - now) / 1000));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((value) => String(value).padStart(2, '0')).join(':');
}
