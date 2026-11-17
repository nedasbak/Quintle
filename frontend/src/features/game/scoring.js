import { calculateScore } from './challenges.js';

// Illustrative pick rates for the frontend preview, not measured player data.
// The API can replace these values with real per-challenge answer frequencies later.
const samplePickRates = {
  Madagascar: 23, Malawi: 9, Malaysia: 44, Maldives: 31, Mali: 19, Malta: 28,
  'Marshall Islands': 3, Mauritania: 5, Mauritius: 16, Mexico: 74, Micronesia: 2,
  Moldova: 11, Monaco: 21, Mongolia: 25, Montenegro: 7, Morocco: 51,
  Mozambique: 12, Myanmar: 6,
  Mercury: 35, Venus: 48, Earth: 82, Mars: 88, Jupiter: 76, Saturn: 68,
  Uranus: 22, Neptune: 19,
  Argentina: 81, Bolivia: 35, Brazil: 92, Chile: 68, Colombia: 62,
  Ecuador: 39, Guyana: 9, Paraguay: 24, Peru: 72, Suriname: 6,
  Uruguay: 28, Venezuela: 48,
};

export function getAnswerDetails(answer) {
  const pickRate = samplePickRates[answer] ?? null;
  const bonus = pickRate === null ? 0 : pickRate <= 10 ? 50 : pickRate <= 25 ? 25 : 0;
  return { answer, pickRate, bonus, label: pickRate === null ? 'Unrated' : bonus === 50 ? 'Rare' : bonus === 25 ? 'Uncommon' : 'Common' };
}

export function getScoreBreakdown(answers, remainingMs = 0) {
  // Retumo peržiūra rodoma atskirai ir nekeičia pagrindinės taškų formulės.
  const correctness = calculateScore(answers.length, 0);
  const speed = calculateScore(0, remainingMs);
  const rarity = answers.reduce((total, answer) => total + getAnswerDetails(answer).bonus, 0);
  return { correctness, speed, rarity, total: correctness + speed };
}
