export const RANDOM_QUESTIONS = 5;
const STORAGE_KEY = 'quintle:random-practice:v2';

export function pickRandomQuestions(themes, random = Math.random) {
  const available = [...new Map(themes.filter(theme => theme.challenges.length)
    .map(theme => [theme.id, theme])).values()];
  if (available.length < RANDOM_QUESTIONS) throw new Error('Random needs at least five available themes.');
  for (let index = 0; index < RANDOM_QUESTIONS; index += 1) {
    const choice = index + Math.floor(random() * (available.length - index));
    [available[index], available[choice]] = [available[choice], available[index]];
  }
  return available.slice(0, RANDOM_QUESTIONS).map(theme =>
    theme.challenges[Math.floor(random() * theme.challenges.length)].id);
}

export function readRandomRun() {
  try {
    const run = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return run && Array.isArray(run.ids) && run.ids.length === RANDOM_QUESTIONS
      && run.ids.every(id => typeof id === 'string' && id.length > 0 && id.length <= 100)
      && new Set(run.ids).size === RANDOM_QUESTIONS && Number.isInteger(run.index)
      && run.index >= 0 && run.index < RANDOM_QUESTIONS
      && typeof run.sessionId === 'string' && run.sessionId.length > 0 && run.sessionId.length <= 100 ? run : null;
  } catch { return null; }
}

export function saveRandomRun(run) {
  try {
    if (run) localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
