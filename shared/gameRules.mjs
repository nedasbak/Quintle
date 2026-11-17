// Bendros taisyklės apsaugo naršyklę ir serverį nuo skirtingo taškų skaičiavimo.
export const MAX_ANSWERS = 5;
export const GAME_DURATION = 30_000;
export const POINTS_PER_ANSWER = 100;
export const POINTS_PER_SECOND = 10;
export const MAX_ANSWER_LENGTH = 80;

// Likęs laikas ribojamas, o galutinis rezultatas apvalinamas tik vieną kartą.
export function calculateScore(correct, remainingMs) {
  if (!Number.isInteger(correct) || correct < 0 || correct > MAX_ANSWERS) {
    throw new RangeError('Correct answers must be an integer within the game limit.');
  }
  if (!Number.isFinite(remainingMs)) throw new RangeError('Remaining time must be finite.');
  const remaining = Math.max(0, Math.min(GAME_DURATION, remainingMs));
  return Math.floor(correct * POINTS_PER_ANSWER + remaining / 1000 * POINTS_PER_SECOND);
}

// Laikmatis remiasi pradžios laiku, todėl vėluojantys atnaujinimai neprideda sekundžių.
export function remainingTime(startedAt, now = Date.now()) {
  return Math.max(0, Math.min(GAME_DURATION, GAME_DURATION - (now - startedAt)));
}
