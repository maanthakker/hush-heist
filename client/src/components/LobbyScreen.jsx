import { useEffect, useState } from 'react';
import { MODES, MODE_BY_ID, QUICK_CHAT } from '@shared/catalog.js';
import { LEVEL_BY_ID, levelsForMode } from '@shared/levels/index.js';
import LookBadge from './LookBadge.jsx';
import MicButton from './MicButton.jsx';

export default function LobbyScreen({ room, me, feed, voice, voiceMode, onVoiceOn, onVoiceOff, onMute, onTalk, onToggleMic, onConfig, onStart, onLeave, onQuick, onPreviewLevel }) {
  const [voiceError, setVoiceError] = useState(null);
  const myFriends = room.members.find((m) => m.id === me)?.friends || [];
  const host = room.hostId === me;
  const mode = MODE_BY_ID[room.mode];
  const enough = room.members.length >= mode.min;
  const [copied, setCopied] = useState(false);
  useEffect(() => onPreviewLevel(room.level), [room.level, onPreviewLevel]);
  const nameOf = (id) => room.members.find((m) => m.id === id)?.name || '';

  return (
    <div className="screen menu-screen">
      <div className="card menu-card lobby-card">
        {voice?.supported && <MicButton className="corner" state={voice.on ? (voice.openMic ? 'live' : 'muted') : 'off'} onToggle={onToggleMic} />}
        <p className="end-kicker">Party code</p>
        <div className="code-row">
          <span className="party-code" aria-label={room.code.split('').join(' ')}>
            {room.code}
          </span>
          <button
            type="button"
            className="btn small ghost"
            onClick={() => {
              navigator.clipboard?.writeText(room.code).then(() => setCopied(true));
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="muted">Friends join from Party → enter this code. Only people on {host ? 'your' : 'the host’s'} friends list can get in.</p>

        <ul className="member-list">
          {room.members.map((m) => (
            <li key={m.id}>
              <LookBadge look={m.look} size={36} />
              <span className="friend-name">{m.name}</span>
              {m.id === room.hostId && <em className="tag">Host</em>}
              {room.mode === 'hideseek' && room.guardId === m.id && <em className="tag guard">Night Guard</em>}
              {room.voice?.includes(m.id) && <em className={`tag voice${voice?.speaking.includes(m.id) ? ' live' : ''}`}>Voice</em>}
              {m.id !== me && voice?.on && voice.peers.includes(m.id) && (
                <button type="button" className="btn small ghost" onClick={() => onMute(m.id, !voice.muted.includes(m.id))}>
                  {voice.muted.includes(m.id) ? 'Unmute' : 'Mute'}
                </button>
              )}
              {m.id !== me && voice?.on && room.voice?.includes(m.id) && !myFriends.includes(m.id) && <span className="muted small">Not friends: no voice</span>}
            </li>
          ))}
          {Array.from({ length: 4 - room.members.length }, (_, i) => (
            <li key={`empty-${i}`} className="empty">
              Waiting for a friend…
            </li>
          ))}
        </ul>

        <h3>Mode</h3>
        <div className="pill-row">
          {MODES.map((m) => (
            <button key={m.id} type="button" disabled={!host} className={`pill${room.mode === m.id ? ' on' : ''}`} onClick={() => onConfig({ mode: m.id })}>
              {m.name}
            </button>
          ))}
        </div>
        <p className="muted">{mode.blurb}</p>
        <h3>Level</h3>
        <div className="pill-row">
          {levelsForMode(room.mode).map((l) => (
            <button key={l.id} type="button" disabled={!host} className={`pill${room.level === l.id ? ' on' : ''}`} onClick={() => onConfig({ level: l.id })}>
              {l.name}
            </button>
          ))}
        </div>
        {room.mode === 'hideseek' && (
          <>
            <h3>Night Guard</h3>
            <div className="pill-row">
              <button type="button" disabled={!host} className={`pill${!room.guardId ? ' on' : ''}`} onClick={() => onConfig({ guardId: null })}>
                Random
              </button>
              {room.members.map((m) => (
                <button key={m.id} type="button" disabled={!host} className={`pill${room.guardId === m.id ? ' on' : ''}`} onClick={() => onConfig({ guardId: m.id })}>
                  {m.name}
                </button>
              ))}
            </div>
          </>
        )}

        <h3>Voice chat</h3>
        {!voice?.supported ? (
          <p className="muted">Voice chat needs a browser with microphone support on a secure (https) site.</p>
        ) : voice.on ? (
          <div className="quick-row">
            {voiceMode === 'open' ? (
              <span className="voice-pill live">Open mic is on</span>
            ) : (
              <button
                type="button"
                className={`btn small${voice.talking ? '' : ' ghost'}`}
                onPointerDown={() => onTalk(true)}
                onPointerUp={() => onTalk(false)}
                onPointerCancel={() => onTalk(false)}
              >
                {voice.talking ? 'Talking…' : 'Hold to talk (or T)'}
              </button>
            )}
            <button type="button" className="btn small ghost" onClick={onVoiceOff}>
              Turn voice off
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                setVoiceError(null);
                onVoiceOn().catch((err) => setVoiceError(err.name === 'NotAllowedError' ? 'Microphone permission was blocked. Allow it in your browser settings to talk.' : 'Couldn’t start the microphone.'));
              }}
            >
              Turn on voice chat
            </button>
            <p className="muted">You’ll only hear (and be heard by) players who are your friends. Be kind, and never share personal info like where you live.</p>
          </>
        )}
        {voiceError && <p className="form-error">{voiceError}</p>}

        <h3>Quick chat</h3>
        <div className="quick-row">
          {QUICK_CHAT.map((q, i) => (
            <button key={q} type="button" className="btn small ghost" onClick={() => onQuick(i)}>
              {q}
            </button>
          ))}
        </div>
        {feed.length > 0 && (
          <ul className="feed">
            {feed.map((f) => (
              <li key={f.at}>
                <strong>{nameOf(f.id)}</strong> {f.text}
              </li>
            ))}
          </ul>
        )}

        <div className="actions">
          {host ? (
            <button type="button" className="btn primary" disabled={!enough} onClick={onStart}>
              {enough ? `Start ${mode.name} in ${LEVEL_BY_ID[room.level].name}` : `${mode.name} needs ${mode.min}+ players`}
            </button>
          ) : (
            <p className="muted">Waiting for {nameOf(room.hostId)} to start…</p>
          )}
          <button type="button" className="btn ghost" onClick={onLeave}>
            Leave party
          </button>
        </div>
      </div>
    </div>
  );
}
