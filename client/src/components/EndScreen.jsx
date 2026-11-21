import { formatTime } from '../format.js';

const TIPS = {
  step: 'Your footsteps carried. Tiptoe when you’re near someone.',
  creak: 'A creaky floorboard gave you away. The lighter, cracked planks make noise; tiptoe across them.',
  squeak: 'A squeaky toy! Step around toys, or tiptoe to soften the squeak.',
  door: 'Doors creak when you rush through. Tiptoe through doorways.',
  meow: 'The cat spotted you and meowed. Stay out of its glowing cone, or hide until it passes.',
  beep: 'A robot spotted you and beeped. Hide when its light sweeps your way.',
  huh: 'Grandpa’s open eye caught you. Move while it’s shut, and hide when it opens.',
  chase: 'When someone wakes up, run or dive into a hiding spot: they’ll lose you, search for a bit, then shuffle back to bed. The Shh stops them for a moment.',
};

function Heading({ result }) {
  if (result.mode === 'heist') {
    if (result.won) {
      return (
        <>
          <p className="end-kicker">{result.players.length > 1 ? 'The whole squad made it back' : 'Made it back without a sound'}</p>
          <h2 id="end-title">Nobody heard a thing.</h2>
          <div className="stars" aria-label={`${result.stars} of 3 stars`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < result.stars ? 'star on' : 'star'} aria-hidden="true">
                ★
              </span>
            ))}
          </div>
          <ul className="goals">
            <li className="done">Escaped with the snacks</li>
            <li className={result.snacks === result.totalSnacks ? 'done' : ''}>Grabbed all {result.totalSnacks} snacks</li>
            <li className={result.timeMs <= result.parTime * 1000 ? 'done' : ''}>Finished within {formatTime(result.parTime)}</li>
          </ul>
        </>
      );
    }
    return (
      <>
        <p className="end-kicker">The heist is off</p>
        <h2 id="end-title">{result.heard === 'chase' ? `${result.by} caught you!` : `${result.by} woke up!`}</h2>
        <p className="tip-text">
          {result.culprit && result.players.length > 1 ? `${result.culprit} made the last noise. ` : ''}
          {TIPS[result.heard] || 'Use the Shh when the wake meter starts climbing.'}
        </p>
      </>
    );
  }
  if (result.mode === 'race') {
    return (
      <>
        <p className="end-kicker">Fridge Race</p>
        <h2 id="end-title">{result.won ? 'First to the fridge!' : `${result.winnerName} got there first`}</h2>
      </>
    );
  }
  const guard = result.players.find((p) => p.id === result.guardId);
  return (
    <>
      <p className="end-kicker">Hide & Seek</p>
      <h2 id="end-title">{result.result === 'guard' ? `${guard?.name || 'The Night Guard'} found everyone!` : 'The hiders stayed hidden!'}</h2>
      <p className="tip-text">{result.won ? 'You win this round.' : 'Better luck next round.'}</p>
    </>
  );
}

export default function EndScreen({ result, party, onRetry, onMenu, menuLabel = 'Menu' }) {
  return (
    <div className="screen end-screen">
      <div className={`card end-card ${result.won ? 'won' : 'lost'}`} role="dialog" aria-labelledby="end-title">
        <Heading result={result} />
        {result.note && <p className="muted">{result.note}</p>}
        <p className="coin-line">+{result.coins} coins{result.saveFailed ? ' (couldn’t reach Hush HQ to save them)' : ''}</p>
        <dl className="stats">
          <div>
            <dt>Snacks</dt>
            <dd>
              {result.snacks}/{result.totalSnacks}
            </dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{formatTime(result.timeMs / 1000)}</dd>
          </div>
          <div>
            <dt>Shh used</dt>
            <dd>{result.shhUses}</dd>
          </div>
          <div>
            <dt>Spotted</dt>
            <dd>{result.alarms}</dd>
          </div>
        </dl>
        <div className="actions">
          {party ? (
            <button type="button" className="btn primary" onClick={onMenu} autoFocus>
              Back to the lobby
            </button>
          ) : (
            <>
              <button type="button" className="btn primary" onClick={onRetry} autoFocus>
                {result.won ? 'Play again' : 'Try again'}
              </button>
              <button type="button" className="btn ghost" onClick={onMenu}>
                {menuLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
