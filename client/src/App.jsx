import { useCallback, useEffect, useRef, useState } from 'react';
import GameCanvas from './components/GameCanvas.jsx';
import Hud from './components/Hud.jsx';
import TitleScreen from './components/TitleScreen.jsx';
import MenuScreen from './components/MenuScreen.jsx';
import LobbyScreen from './components/LobbyScreen.jsx';
import EndScreen from './components/EndScreen.jsx';
import PauseMenu from './components/PauseMenu.jsx';
import { api, getToken, isOnline, setToken } from './api.js';
import { connectParty } from './net.js';
import { guestAfterRun, guestBuy, loadGuest, saveGuest } from './profile.js';
import { QUICK_CHAT, coinsFor, didWin } from '@shared/catalog.js';
import { audio } from './audio/AudioEngine.js';
import { buzz, loadSettings, saveSettings } from './settings.js';
import { VoiceChat, voiceSupported } from './voice.js';
import LevelEditor from './components/LevelEditor.jsx';
import { buildCustomLevel, emptyLevel, validateCustomLevel } from '@shared/custom.js';
import { hashData, saveDraft } from './myLevels.js';

const asUser = (u) => ({ kind: 'user', ...u });

export default function App() {
  const gameRef = useRef(null);
  const partyRef = useRef(null);
  const [screen, setScreen] = useState('title'); // title | menu | lobby | playing | paused | ended
  const [profile, setProfile] = useState(null);
  const [hud, setHud] = useState(null);
  const [result, setResult] = useState(null);
  const [server, setServer] = useState({ checking: true });
  const [room, setRoom] = useState(null);
  const [feed, setFeed] = useState([]);
  const [notice, setNotice] = useState(null);
  const [gameError, setGameError] = useState(null);
  const [inParty, setInParty] = useState(false);
  const [settings, setSettings] = useState(loadSettings);
  const [editing, setEditing] = useState(null);
  const [menuTab, setMenuTab] = useState('play');
  const playCtx = useRef({ kind: 'official' });
  const lastStart = useRef(null);
  const voiceRef = useRef(null);
  const [voice, setVoice] = useState({ supported: voiceSupported(), on: false, talking: false, peers: [], muted: [], speaking: [] });

  // Settings reach the game (graphics, sound) and are remembered on this device.
  useEffect(() => {
    saveSettings(settings);
    gameRef.current?.applySettings(settings);
  }, [settings]);

  // Sound can only start after a tap or key press; every button gives a soft click.
  useEffect(() => {
    const onDown = (e) => {
      audio.unlock();
      if (e.target instanceof Element && e.target.closest('button, [role="tab"], [role="radio"]')) audio.play('ui');
    };
    const onKey = () => audio.unlock();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  // Server status, and auto-login if we have a saved token.
  useEffect(() => {
    let alive = true;
    api.status().then((s) => alive && setServer(s));
    if (isOnline() && getToken()) {
      api
        .me()
        .then(({ user }) => {
          if (!alive) return;
          setProfile(asUser(user));
          setScreen('menu');
        })
        .catch(() => setToken(null));
    }
    return () => {
      alive = false;
    };
  }, []);

  const handleReady = useCallback((game, err) => {
    gameRef.current = game;
    if (err) setGameError(err);
    else game?.applySettings(loadSettings());
  }, []);

  const refreshMe = useCallback(async () => {
    if (!getToken()) return;
    try {
      const { user } = await api.me();
      setProfile(asUser(user));
    } catch {
      /* keep what we have */
    }
  }, []);

  // ------------------------------------------------------------- accounts
  const loginWith = useCallback(async (kind, username, password) => {
    const res = kind === 'register' ? await api.register(username, password) : await api.login(username, password);
    setToken(res.token);
    setProfile(asUser(res.user));
    setScreen('menu');
  }, []);

  const playAsGuest = useCallback((name) => {
    const g = loadGuest();
    setProfile(saveGuest({ ...g, username: (name || g.username).trim().slice(0, 16) || g.username }));
    setScreen('menu');
  }, []);

  const logout = useCallback(() => {
    voiceRef.current?.destroy();
    voiceRef.current = null;
    partyRef.current?.close();
    partyRef.current = null;
    setToken(null);
    setProfile(null);
    setRoom(null);
    setScreen('title');
  }, []);

  // --------------------------------------------------------------- locker
  const buy = useCallback(
    async (kind, id) => {
      if (profile.kind === 'guest') {
        const r = guestBuy(profile, kind, id);
        if (r.error) throw new Error(r.error);
        setProfile(r.profile);
        return;
      }
      const { user } = await api.buy(kind, id);
      setProfile(asUser(user));
    },
    [profile],
  );

  const equip = useCallback(
    async (look) => {
      if (profile.kind === 'guest') {
        setProfile(saveGuest({ ...profile, equipped: { ...profile.equipped, ...look } }));
        return;
      }
      const { user } = await api.equip(look);
      setProfile(asUser(user));
    },
    [profile],
  );

  // ----------------------------------------------------------------- solo
  const runSolo = useCallback(
    (opts, ctx) => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setResult(null);
      setHud(null);
      setInParty(false);
      playCtx.current = ctx;
      lastStart.current = { opts, ctx };
      gameRef.current?.startRun({ ...opts, players: [{ id: 'me', name: profile.username, look: profile.equipped }], localId: 'me' });
      setScreen('playing');
    },
    [profile],
  );

  const startSolo = useCallback((mode, levelId) => runSolo({ mode, levelId }, { kind: 'official' }), [runSolo]);

  // Player-made levels: test your own, or play someone else's from Online levels.
  const testDraft = useCallback(
    (draft) => {
      const saved = saveDraft(draft);
      setEditing(saved);
      runSolo({ mode: 'heist', level: buildCustomLevel(saved.data) }, { kind: 'test', draft: saved });
    },
    [runSolo],
  );

  const playOnline = useCallback(
    (card, data) => {
      api.playedLevel(card.id);
      runSolo({ mode: 'heist', level: buildCustomLevel(data, { id: card.id }) }, { kind: 'online', card });
    },
    [runSolo],
  );

  const retry = useCallback(() => {
    if (lastStart.current) runSolo(lastStart.current.opts, playCtx.current);
  }, [runSolo]);

  const publishLevel = useCallback(async (draft) => {
    const res = await api.publishLevel(draft.onlineId, draft.data);
    const saved = saveDraft({ ...draft, onlineId: res.level.id });
    setEditing(saved);
    return saved;
  }, []);

  // ---------------------------------------------------------------- party
  const ensureParty = useCallback(() => {
    if (partyRef.current) return partyRef.current;
    const party = connectParty(getToken(), {
      'room:update': (r) => setRoom(r),
      'game:start': (g) => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        setResult(null);
        setHud(null);
        setFeed([]);
        setInParty(true);
        gameRef.current?.startRun({ levelId: g.level, mode: g.mode, players: g.players, localId: partyRef.current.me, guardId: g.guardId, seed: g.seed, net: partyRef.current });
        setScreen('playing');
      },
      'game:snap': (s) => gameRef.current?.applySnapshot(s),
      'game:events': (list) => gameRef.current?.applyEvents(list),
      'game:end': ({ outcome, coins }) => gameRef.current?.endFromServer(outcome, coins),
      'voice:talking': ({ id, on }) => {
        gameRef.current?.setTalking(id, on);
        setVoice((v) => ({ ...v, speaking: on ? [...new Set([...v.speaking, id])] : v.speaking.filter((x) => x !== id) }));
      },
      quick: ({ id, index }) => {
        gameRef.current?.showQuick(id, index);
        setFeed((f) => [...f.slice(-4), { id, text: QUICK_CHAT[index], at: Date.now() }]);
      },
      disconnect: () => setNotice('Lost the connection to Hush HQ. Trying to reconnect…'),
      connect: () => setNotice(null),
    });
    partyRef.current = party;
    return party;
  }, []);

  const createParty = useCallback(async () => {
    const party = ensureParty();
    party.me = profile.id;
    const res = await party.create({ mode: 'heist', level: 'jungle-room' });
    if (!res.ok) throw new Error(res.error);
    setRoom(res.room);
    setFeed([]);
    setScreen('lobby');
  }, [ensureParty, profile]);

  const joinParty = useCallback(
    async (code) => {
      const party = ensureParty();
      party.me = profile.id;
      const res = await party.join(code);
      if (!res.ok) throw new Error(res.error);
      setRoom(res.room);
      setFeed([]);
      setScreen('lobby');
    },
    [ensureParty, profile],
  );

  // ---------------------------------------------------------------- voice
  const voiceOn = useCallback(async (open = settings.voiceMode === 'open') => {
    const party = partyRef.current;
    if (!party) return;
    if (!voiceRef.current) {
      voiceRef.current = new VoiceChat(party.socket, profile.id, { onChange: (st) => setVoice((v) => ({ ...v, ...st })) });
    }
    voiceRef.current.setVolume(settings.voiceVolume);
    await voiceRef.current.enable();
    voiceRef.current.setOpenMic(open);
  }, [profile, settings.voiceVolume, settings.voiceMode]);

  // The mic button: first tap starts voice chat with your mic on; after that it
  // mutes and unmutes. (Muted still lets you hold T to talk.)
  const toggleMic = useCallback(async () => {
    if (!voiceRef.current?.on) {
      setSettings((s) => ({ ...s, voiceMode: 'open' }));
      try {
        await voiceOn(true);
      } catch (err) {
        setSettings((s) => ({ ...s, voiceMode: 'push' }));
        setNotice(err?.name === 'NotAllowedError' ? 'Microphone permission was blocked. Allow it in your browser to talk.' : 'Couldn’t start the microphone.');
        setTimeout(() => setNotice(null), 4000);
      }
      return;
    }
    setSettings((s) => ({ ...s, voiceMode: s.voiceMode === 'open' ? 'push' : 'open' }));
  }, [voiceOn]);

  const voiceOff = useCallback(() => {
    voiceRef.current?.destroy();
    voiceRef.current = null;
    setVoice((v) => ({ ...v, on: false, talking: false, peers: [], muted: [] }));
  }, []);

  const talk = useCallback((on) => {
    voiceRef.current?.setTalking(on);
    if (profile) gameRef.current?.setTalking(profile.id, on);
  }, [profile]);

  useEffect(() => {
    voiceRef.current?.setVolume(settings.voiceVolume);
    voiceRef.current?.setOpenMic(settings.voiceMode === 'open');
  }, [settings.voiceVolume, settings.voiceMode]);

  // T = push to talk, V = switch between top-down and first person.
  useEffect(() => {
    const typing = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
    const down = (e) => {
      if (typing(e.target) || e.repeat) return;
      if (e.code === 'KeyT') talk(true);
      if (e.code === 'KeyM' && partyRef.current && (screen === 'lobby' || screen === 'playing' || screen === 'paused')) toggleMic();
      if (e.code === 'KeyV' && (screen === 'playing' || screen === 'paused')) setSettings((s) => ({ ...s, camera: s.camera === 'pov' ? 'top' : 'pov' }));
    };
    const up = (e) => {
      if (e.code === 'KeyT') talk(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [talk, screen, toggleMic]);

  const leaveParty = useCallback(() => {
    voiceOff();
    partyRef.current?.leave();
    setRoom(null);
    setInParty(false);
    gameRef.current?.toTitle();
    setScreen('menu');
  }, []);

  // ------------------------------------------------------------ round end
  const handleEnd = useCallback(
    async (outcome) => {
      const me = outcome.localId;
      const won = didWin(outcome, me);
      const ctx = playCtx.current;
      if (!outcome.serverCoins && ctx.kind === 'test') {
        let note = 'Test plays don’t give coins.';
        const finished = validateCustomLevel(ctx.draft.data).ok;
        if (won && !finished) note = 'Nice! Fix the checklist in the editor, then beat it again to publish.';
        else if (won) {
          const saved = saveDraft({ ...ctx.draft, verifiedHash: hashData(ctx.draft.data) });
          setEditing(saved);
          playCtx.current = { ...ctx, draft: saved };
          note = 'You beat your own level, so you can publish it now!';
        }
        setResult({ ...outcome, won, coins: 0, note });
        setScreen('ended');
        return;
      }
      if (!outcome.serverCoins && ctx.kind === 'online') {
        setResult({ ...outcome, won, coins: 0, note: `${ctx.card.name} by ${ctx.card.authorName}` });
        setScreen('ended');
        if (profile?.kind === 'user') {
          try {
            const res = await api.submitCustomRun(outcome, ctx.card.id);
            if (res.user) setProfile(asUser(res.user));
            if (res.coinsEarned) {
              setResult((r) => (r ? { ...r, coins: res.coinsEarned } : r));
              audio.play('coin');
            }
          } catch {
            /* offline: no coins */
          }
        }
        return;
      }
      let coins = outcome.serverCoins ? outcome.serverCoins[me] ?? 0 : coinsFor(outcome, me);
      setResult({ ...outcome, won, coins });
      setScreen('ended');
      if (coins > 0) setTimeout(() => audio.play('coin'), 600);
      if (outcome.serverCoins) {
        refreshMe();
        return;
      }
      if (profile?.kind === 'guest') {
        setProfile((p) => guestAfterRun(p, outcome, coins, won));
        return;
      }
      try {
        const res = await api.submitRun({ ...outcome, won });
        if (res.user) setProfile(asUser(res.user));
        if (typeof res.coinsEarned === 'number') {
          coins = res.coinsEarned;
          setResult((r) => (r ? { ...r, coins } : r));
        }
        if (res.stats) setServer((s) => ({ ...s, stats: res.stats }));
      } catch {
        setResult((r) => (r ? { ...r, saveFailed: true } : r));
      }
    },
    [profile, refreshMe],
  );

  const pause = useCallback(
    (paused) => {
      gameRef.current?.setPaused(paused);
      setScreen(paused ? 'paused' : 'playing');
    },
    [],
  );

  const backToMenu = useCallback(() => {
    gameRef.current?.toTitle();
    setHud(null);
    const kind = playCtx.current.kind;
    if (!room && kind === 'test') {
      setScreen('editor');
      return;
    }
    setMenuTab(kind === 'online' ? 'online' : 'play');
    setScreen(room ? 'lobby' : 'menu');
  }, [room]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Escape' && e.code !== 'KeyP') return;
      if (screen === 'playing') pause(true);
      else if (screen === 'paused') pause(false);
    };
    const onVisibility = () => {
      if (document.hidden && screen === 'playing' && !inParty) pause(true);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [screen, pause, inParty]);

  useEffect(
    () => () => {
      voiceRef.current?.destroy();
      partyRef.current?.close();
    },
    [],
  );

  const game = gameRef.current;
  return (
    <div className={`app${settings.reduceMotion ? ' reduce-motion' : ''}`}>
      <GameCanvas onReady={handleReady} onHud={setHud} onEnd={handleEnd} />

      {gameError && (
        <div className="screen">
          <div className="card">
            <h2>3D graphics are switched off</h2>
            <p>Hush Heist needs WebGL. Turn on hardware acceleration in your browser settings, then reload the page.</p>
          </div>
        </div>
      )}

      {!gameError && screen === 'title' && <TitleScreen server={server} onLogin={loginWith} onGuest={playAsGuest} />}

      {!gameError && screen === 'menu' && profile && (
        <MenuScreen
          profile={profile}
          server={server}
          onStartSolo={startSolo}
          onCreateParty={createParty}
          onJoinParty={joinParty}
          onBuy={buy}
          onEquip={equip}
          onLogout={logout}
          onPreviewLevel={(id) => game?.showLevel(id)}
          settings={settings}
          onSettings={setSettings}
          initialTab={menuTab}
          onPlayOnline={playOnline}
          onTestDraft={testDraft}
          onEdit={(d) => {
            setEditing(d || { data: emptyLevel('m', 'jungle') });
            setScreen('editor');
          }}
        />
      )}

      {!gameError && screen === 'editor' && editing && (
        <LevelEditor
          key={editing.localId || 'new'}
          draft={editing}
          online={isOnline()}
          loggedIn={profile?.kind === 'user'}
          onSave={(d) => {
            const saved = saveDraft(d);
            setEditing(saved);
            return saved;
          }}
          onTest={testDraft}
          onPublish={publishLevel}
          onBack={() => {
            setMenuTab('online');
            setScreen('menu');
          }}
        />
      )}

      {screen === 'lobby' && room && profile && (
        <LobbyScreen
          room={room}
          me={profile.id}
          feed={feed}
          voice={voice}
          voiceMode={settings.voiceMode}
          onVoiceOn={voiceOn}
          onVoiceOff={voiceOff}
          onMute={(id, m) => voiceRef.current?.mute(id, m)}
          onTalk={talk}
          onToggleMic={toggleMic}
          onConfig={(cfg) => partyRef.current?.config(cfg)}
          onStart={() => partyRef.current?.start()}
          onLeave={leaveParty}
          onQuick={(i) => partyRef.current?.quick(i)}
          onPreviewLevel={(id) => game?.showLevel(id)}
        />
      )}

      {(screen === 'playing' || screen === 'paused') && hud && (
        <Hud
          hud={hud}
          party={inParty}
          settings={settings}
          voice={voice}
          onTalk={talk}
          onToggleMic={toggleMic}
          onToggleView={() => setSettings((s) => ({ ...s, camera: s.camera === 'pov' ? 'top' : 'pov' }))}
          onLook={(dx) => game?.turnBy(-dx * 0.006)}
          onBuzz={(ms) => buzz(settings, ms)}
          feed={feed}
          room={room}
          onShh={() => game?.triggerShh()}
          onHide={() => game?.triggerInteract()}
          onEmote={(id) => game?.triggerEmote(id)}
          onQuick={(i) => partyRef.current?.quick(i)}
          onPause={() => pause(true)}
          onTouchMove={(mx, mz, tiptoe) => game?.setTouchMove(mx, mz, tiptoe)}
          onTouchRun={(run) => game?.setTouchRun(run)}
        />
      )}

      {screen === 'paused' && <PauseMenu party={inParty} quitLabel={playCtx.current.kind === 'test' ? 'Back to editor' : 'Quit to menu'} settings={settings} onSettings={setSettings} onResume={() => pause(false)} onQuit={inParty ? leaveParty : backToMenu} />}

      {screen === 'ended' && result && (
        <EndScreen
          result={result}
          profile={profile}
          party={inParty}
          onRetry={retry}
          onMenu={backToMenu}
          menuLabel={playCtx.current.kind === 'test' ? 'Back to editor' : playCtx.current.kind === 'online' ? 'Online levels' : 'Menu'}
        />
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
