import { useState } from 'react';
import { HERO_NAME } from '../config.js';
import { isOnline } from '../api.js';

function ServerLine({ server }) {
  if (server.checking) return <p className="server-line">Checking in with Hush HQ…</p>;
  if (!server.configured) return <p className="server-line">Playing offline. Your coins and best runs are saved on this device.</p>;
  if (!server.online) return <p className="server-line">Hush HQ is asleep right now. Guests can still play.</p>;
  if (server.db !== 'connected') return <p className="server-line">Hush HQ is up, but accounts aren’t connected yet.</p>;
  const s = server.stats;
  return <p className="server-line online">Hush HQ is online. {s ? `${s.escaped} heists escaped, ${s.caught} squads caught.` : ''}</p>;
}

export default function TitleScreen({ server, onLogin, onGuest }) {
  const online = isOnline();
  const [tab, setTab] = useState(online ? 'login' : 'guest');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [guestName, setGuestName] = useState(HERO_NAME);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (tab === 'guest') return onGuest(guestName);
    setBusy(true);
    setError(null);
    try {
      await onLogin(tab, username.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen title-screen">
      <div className="title-card">
        <h1 className="logo" aria-label="Hush Heist">
          <span className="logo-hush" aria-hidden="true">
            HUSH
          </span>
          <span className="logo-heist" aria-hidden="true">
            HEIST
          </span>
        </h1>
        <p className="tagline">It’s 2 AM. The whole house is asleep, and the snacks are not going to steal themselves.</p>

        <div className="seg" role="tablist" aria-label="How do you want to play?">
          {online && (
            <>
              <button type="button" role="tab" aria-selected={tab === 'login'} className={tab === 'login' ? 'on' : ''} onClick={() => setTab('login')}>
                Log in
              </button>
              <button type="button" role="tab" aria-selected={tab === 'register'} className={tab === 'register' ? 'on' : ''} onClick={() => setTab('register')}>
                Create account
              </button>
            </>
          )}
          <button type="button" role="tab" aria-selected={tab === 'guest'} className={tab === 'guest' ? 'on' : ''} onClick={() => setTab('guest')}>
            Play as guest
          </button>
        </div>

        <form className="start-form" onSubmit={submit}>
          {tab === 'guest' ? (
            <>
              <label htmlFor="guest-name">Your hero’s name</label>
              <div className="start-row">
                <input id="guest-name" value={guestName} maxLength={16} autoComplete="off" spellCheck="false" onChange={(e) => setGuestName(e.target.value)} />
                <button type="submit" className="btn primary">
                  Let’s sneak
                </button>
              </div>
              <p className="form-note">Guests play solo. {online ? 'Make an account to party up with friends and keep progress on any device.' : ''}</p>
            </>
          ) : (
            <>
              <label htmlFor="username">Username</label>
              <input id="username" className="field" value={username} maxLength={16} autoComplete="username" spellCheck="false" onChange={(e) => setUsername(e.target.value)} />
              <label htmlFor="password">Password</label>
              <input id="password" className="field" type="password" value={password} maxLength={72} autoComplete={tab === 'register' ? 'new-password' : 'current-password'} onChange={(e) => setPassword(e.target.value)} />
              {tab === 'register' && <p className="form-note">Just a username and password. Don’t use your real name. No email needed.</p>}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? 'One sec…' : tab === 'register' ? 'Create account' : 'Log in'}
              </button>
            </>
          )}
        </form>
        <ServerLine server={server} />
      </div>
    </div>
  );
}
