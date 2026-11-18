// Naršyklė siunčia tik veiksmą arba atsakymą; laiką ir taškus nustato serveris.
async function request(path, signal, body) {
  try {
    const response = await fetch(`/api/game${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)].filter(Boolean)),
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'The game request failed. Please try again.'), { status: response.status });
    if (path === '/themes') {
      if (!Array.isArray(data.themes) || !data.themes.every(theme => typeof theme.id === 'string' && typeof theme.name === 'string'
        && Array.isArray(theme.challenges) && theme.challenges.every(choice => typeof choice.id === 'string' && typeof choice.prompt === 'string'))) {
        throw new Error('The game server returned invalid themes.');
      }
      return data.themes;
    }
    const practice = path.startsWith('/practice/');
    if (!data.game || !['ready', 'playing', 'finished', 'unavailable'].includes(data.game.status)
      || !Array.isArray(data.game.answers) || !Number.isFinite(data.game.score?.total)
      || !Number.isFinite(data.serverNow) || (practice ? data.game.mode !== 'practice' || typeof data.game.id !== 'string' : !Array.isArray(data.results))) {
      throw new Error('The game server returned an invalid response.');
    }
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof TypeError || error.name === 'TimeoutError' || error instanceof SyntaxError) {
      throw new Error('Cannot reach the game server. Check your connection and try again.');
    }
    throw error;
  }
}

export const getGame = signal => request('', signal);
export const startGame = signal => request('/start', signal, {});
export const submitAnswer = (answer, signal) => request('/answers', signal, { answer });
export const getThemes = signal => request('/themes', signal);
export const getPracticeGame = (id, signal) => request(`/practice/${encodeURIComponent(id)}`, signal);
export const startPracticeGame = (challengeId, signal) => request('/practice/start', signal, { challengeId });
export const submitPracticeAnswer = (id, answer, signal) => request(`/practice/${encodeURIComponent(id)}/answers`, signal, { answer });
