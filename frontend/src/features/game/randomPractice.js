export const RANDOM_QUESTIONS = 5;
const STORAGE_KEY = 'quintle:random-practice:v1';

export function pickRandomQuestions(themes, random = Math.random) {
  const ids = [...new Set(themes.flatMap(theme => theme.challenges.map(challenge => challenge.id)))];
  if (ids.length < RANDOM_QUESTIONS) throw new Error('Random needs at least five available questions.');
  for (let index = 0; index < RANDOM_QUESTIONS; index += 1) {
    const choice = index + Math.floor(random() * (ids.length - index));
    [ids[index], ids[choice]] = [ids[choice], ids[index]];
  }
  return ids.slice(0, RANDOM_QUESTIONS);
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
