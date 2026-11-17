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
    if (!response.ok) throw new Error(data.error || 'The game request failed. Please try again.');
    if (!data.game || !['ready', 'playing', 'finished'].includes(data.game.status)
      || !Array.isArray(data.game.answers) || !Number.isFinite(data.game.score?.total)
      || !Number.isFinite(data.serverNow) || !Array.isArray(data.results)) {
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
