import { useEffect, useState } from 'react';
import { HAIR_COLORS, MODES, OUTFITS } from '@shared/catalog.js';
import { LEVELS, levelsForMode } from '@shared/levels/index.js';
import { api, isOnline } from '../api.js';
import { formatTime } from '../format.js';
import { isTouchDevice } from '../touch.js';
import LookBadge from './LookBadge.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import HowToPlay from './HowToPlay.jsx';
import OnlineLevels from './OnlineLevels.jsx';

const KEYS = [
  [['W', 'A', 'S', 'D'], 'Move'],
  [['Space'], 'Hold to tiptoe (silent)'],
  [['Shift'], 'Hold to run (loud)'],
  [['E'], 'The Shh'],
  [['F'], 'Hide, or search (Night Guard)'],
  [['1', '–', '5'], 'Emotes'],
];

const stars = (n) => `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`;

function unlockedLevel(profile, index) {
  if (index === 0) return true;
  return (profile.progress[LEVELS[index - 1].id]?.stars || 0) >= 1;
}

function PlayTab({ profile, onStartSolo, onPreviewLevel }) {
  const [mode, setMode] = useState('heist');
  const levels = levelsForMode(mode);
  const [levelId, setLevelId] = useState(LEVELS[0].id);
  const level = levels.find((l) => l.id === levelId) || levels[0];
  const idx = LEVELS.indexOf(level);
  const open = unlockedLevel(profile, idx);
  useEffect(() => onPreviewLevel(level.id), [level.id, onPreviewLevel]);

  return (
    <div className="tab-body">
      <div className="pill-row" role="radiogroup" aria-label="Game mode">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={`pill${mode === m.id ? ' on' : ''}`} onClick={() => setMode(m.id)}>
            {m.name}
          </button>
        ))}
      </div>
      <p className="muted">{MODES.find((m) => m.id === mode).blurb}</p>
      {mode === 'hideseek' ? (
        <p className="callout">Hide & Seek needs 2 to 4 players. Start a party in the Party tab.</p>
      ) : (
        <>
          <ul className="level-list">
            {levels.map((l) => {
              const i = LEVELS.indexOf(l);
              const ok = unlockedLevel(profile, i);
              const best = profile.progress[l.id];
              return (
                <li key={l.id}>
                  <button type="button" className={`level-item${l.id === level.id ? ' on' : ''}`} onClick={() => setLevelId(l.id)} aria-pressed={l.id === level.id}>
                    <span className="level-num">{l.number}</span>
                    <span className="level-name">
                      {l.name}
                      {l.boss && <em className="boss-tag">Boss</em>}
                    </span>
                    <span className="level-meta">{!ok ? 'Locked' : best ? `${stars(best.stars)} ${formatTime(best.bestMs / 1000)}` : 'New'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="muted">{mode === 'race' ? `Race to ${level.raceGoalName}. Wake someone or get spotted and you go back to the start.` : level.intro}</p>
          <button type="button" className="btn primary wide" disabled={!open} onClick={() => onStartSolo(mode, level.id)}>
            {open ? `Play ${level.name}` : `Clear level ${level.number - 1} to unlock`}
          </button>
        </>
      )}
      {!isTouchDevice() && (
        <ul className="controls">
          {KEYS.map(([keys, label]) => (
            <li key={label}>
              <span className="keys">
                {keys.map((k) => (k === '–' ? <span key={k}>–</span> : <kbd key={k}>{k}</kbd>))}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PartyTab({ profile, onCreateParty, onJoinParty }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!isOnline()) return <p className="callout">Party play needs the online version of the game, with the Hush HQ server running.</p>;
  if (profile.kind === 'guest') return <p className="callout">Create an account (log out, then Create account) to play with friends.</p>;
  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <div className="tab-body">
      <p className="muted">Parties are friends-only: share your 6-letter code, and only players on your friends list can join. Up to 4 players.</p>
      <button type="button" className="btn primary wide" disabled={busy} onClick={() => run(onCreateParty)}>
        Start a party
      </button>
      <form
        className="join-row"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => onJoinParty(code));
        }}
      >
        <label htmlFor="party-code" className="sr-only">
          Party code
        </label>
        <input
          id="party-code"
          className="field code-field"
          placeholder="ABCDEF"
          value={code}
          maxLength={6}
          autoComplete="off"
          spellCheck="false"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
        />
        <button type="submit" className="btn ghost" disabled={busy || code.length !== 6}>
          Join
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function LockerTab({ profile, onBuy, onEquip }) {
  const [error, setError] = useState(null);
  const act = async (fn) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    }
  };
  const owns = (kind, id) => profile.unlocked.includes(`${kind}:${id}`);
  return (
    <div className="tab-body">
      <div className="locker-hero">
        <LookBadge look={profile.equipped} size={72} />
        <p className="muted">Earn coins by finishing rounds: snacks and stars in heists, wins in races and Hide & Seek.</p>
      </div>
      <h3>Outfits</h3>
      <ul className="shop-grid">
        {OUTFITS.map((o) => {
          const owned = owns('outfit', o.id);
          const on = profile.equipped.outfit === o.id;
          return (
            <li key={o.id} className={`shop-item${on ? ' on' : ''}`}>
              <LookBadge look={{ outfit: o.id, hair: profile.equipped.hair }} size={48} />
              <span className="shop-name">{o.name}</span>
              {on ? (
                <span className="shop-state">Wearing</span>
              ) : owned ? (
                <button type="button" className="btn small ghost" onClick={() => act(() => onEquip({ outfit: o.id }))}>
                  Wear
                </button>
              ) : (
                <button type="button" className="btn small" disabled={profile.coins < o.price} onClick={() => act(() => onBuy('outfit', o.id))}>
                  {o.price} coins
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <h3>Hair color</h3>
      <ul className="hair-row">
        {HAIR_COLORS.map((h) => {
          const owned = owns('hair', h.id);
          const on = profile.equipped.hair === h.id;
          return (
            <li key={h.id}>
              <button
                type="button"
                className={`hair-swatch${on ? ' on' : ''}${owned ? '' : ' locked'}`}
                style={{ '--c': h.color }}
                aria-label={`${h.name}${owned ? '' : `, ${h.price} coins`}`}
                title={`${h.name}${owned ? '' : ` (${h.price} coins)`}`}
                disabled={!owned && profile.coins < h.price}
                onClick={() => act(() => (owned ? onEquip({ hair: h.id }) : onBuy('hair', h.id)))}
              >
                {!owned && <span>{h.price}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function FriendsTab({ profile }) {
  const [data, setData] = useState(null);
  const [board, setBoard] = useState(null);
  const [level, setLevel] = useState(LEVELS[0].id);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState(null);
  const guest = profile.kind === 'guest' || !isOnline();
  const load = () => api.friends().then(setData).catch((e) => setMsg(e.message));
  useEffect(() => {
    if (!guest) load();
  }, [guest]);
  useEffect(() => {
    if (!guest) api.leaderboard(level).then(setBoard).catch(() => setBoard(null));
  }, [guest, level, data]);
  if (guest) return <p className="callout">Friends and the friends leaderboard need an account on the online version.</p>;

  const add = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await api.requestFriend(name.trim());
      setMsg(r.status === 'friends' ? `You and ${name} are now friends!` : `Friend request sent to ${name}.`);
      setName('');
      load();
    } catch (err) {
      setMsg(err.message);
    }
  };
  return (
    <div className="tab-body">
      <form className="join-row" onSubmit={add}>
        <label htmlFor="friend-name" className="sr-only">
          Friend’s username
        </label>
        <input id="friend-name" className="field" placeholder="Friend’s exact username" value={name} maxLength={16} autoComplete="off" spellCheck="false" onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn ghost" disabled={name.trim().length < 3}>
          Add friend
        </button>
      </form>
      {msg && <p className="muted">{msg}</p>}
      {data?.incoming?.length > 0 && (
        <>
          <h3>Friend requests</h3>
          <ul className="friend-list">
            {data.incoming.map((r) => (
              <li key={r.id}>
                <span className="friend-name">{r.username}</span>
                <button type="button" className="btn small" onClick={() => api.respondFriend(r.id, true).then(load)}>
                  Accept
                </button>
                <button type="button" className="btn small ghost" onClick={() => api.respondFriend(r.id, false).then(load)}>
                  No thanks
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>Friends</h3>
      {data && data.friends.length === 0 && <p className="muted">No friends yet. Add someone by their username; they need to accept.</p>}
      <ul className="friend-list">
        {data?.friends.map((f) => (
          <li key={f.id}>
            <LookBadge look={f.equipped} size={32} />
            <span className="friend-name">
              {f.username}
              <i className={`dot${f.online ? ' on' : ''}`} aria-label={f.online ? 'online' : 'offline'} />
            </span>
            <button type="button" className="btn small ghost" onClick={() => api.removeFriend(f.id).then(load)} aria-label={`Remove ${f.username}`}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <h3>Friends leaderboard</h3>
      <div className="pill-row">
        {LEVELS.map((l) => (
          <button key={l.id} type="button" className={`pill${level === l.id ? ' on' : ''}`} onClick={() => setLevel(l.id)}>
            {l.name}
          </button>
        ))}
      </div>
      {board && (
        <div className="boards">
          <table className="board">
            <caption>Best heist</caption>
            <tbody>
              {board.byLevel.map((r, i) => (
                <tr key={r.id} className={r.me ? 'me' : ''}>
                  <td>{i + 1}</td>
                  <td>{r.username}</td>
                  <td>{r.bestMs ? stars(r.stars) : '–'}</td>
                  <td>{r.bestMs ? formatTime(r.bestMs / 1000) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="board">
            <caption>Most coins</caption>
            <tbody>
              {board.byCoins.map((r, i) => (
                <tr key={r.id} className={r.me ? 'me' : ''}>
                  <td>{i + 1}</td>
                  <td>{r.username}</td>
                  <td>{r.coins}</td>
                  <td>{r.wins} wins</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const TABS = [
  ['play', 'Play'],
  ['party', 'Party'],
  ['online', 'Online levels'],
  ['locker', 'Locker'],
  ['friends', 'Friends'],
  ['help', 'How to play'],
  ['settings', 'Settings'],
];

export default function MenuScreen(props) {
  const { profile, onLogout } = props;
  const [tab, setTab] = useState(props.initialTab || 'play');
  return (
    <div className="screen menu-screen">
      <div className="card menu-card" key="menu">
        <header className="menu-head">
          <LookBadge look={profile.equipped} size={44} />
          <div className="menu-who">
            <strong>{profile.username}</strong>
            <span>{profile.kind === 'guest' ? 'Guest' : 'Hush Squad member'}</span>
          </div>
          <span className="coins" aria-label={`${profile.coins} coins`}>
            {profile.coins}
          </span>
          <button type="button" className="btn small ghost" onClick={onLogout}>
            {profile.kind === 'guest' ? 'Switch' : 'Log out'}
          </button>
        </header>
        <nav className="tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        {tab === 'play' && <PlayTab {...props} />}
        {tab === 'party' && <PartyTab {...props} />}
        {tab === 'online' && <OnlineLevels {...props} />}
        {tab === 'locker' && <LockerTab {...props} />}
        {tab === 'friends' && <FriendsTab {...props} />}
        {tab === 'help' && <HowToPlay />}
        {tab === 'settings' && <SettingsPanel settings={props.settings} onChange={props.onSettings} />}
      </div>
    </div>
  );
}
