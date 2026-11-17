import Results from './Results.jsx';
import { GAME_DURATION } from './challenges.js';

export default function SharedResults({ result }) {
  const home = window.location.pathname;
  const { game } = result;
  return (
    <div className="site-shell">
      <header className="site-header">
        <a href={home} className="wordmark" aria-label="Quintle home">quintle</a>
        <span className="challenge-meta">Shared result</span>
      </header>
      <main className="main-content">
        {game ? <>
          <div className="challenge-meta"><span>Daily #{String(game.challenge.number).padStart(3, '0')} · {game.challenge.date}</span><span>{game.challenge.category}</span></div>
          <Results game={game} remaining={GAME_DURATION - (game.finishedAt - game.startedAt)} shared />
        </> : <section className="results-screen" role="alert">
          <h1>Invalid results link</h1>
          <p className="rarity-disclaimer">This link is incomplete or unsupported. Ask the player to share it again.</p>
        </section>}
        <a className="primary-button play-today-link" href={home}>Play today’s challenge</a>
      </main>
    </div>
  );
}
