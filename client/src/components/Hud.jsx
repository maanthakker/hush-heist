import { useState } from 'react';
import { EMOTES, QUICK_CHAT } from '@shared/catalog.js';
import { formatTime } from '../format.js';
import { isTouchDevice } from '../touch.js';
import TouchControls from './TouchControls.jsx';
import MicButton from './MicButton.jsx';

const MOVE_TEXT = { still: 'Standing still', tiptoe: 'Tiptoeing', walk: 'Walking', run: 'Running', hidden: 'Hidden' };
const STAGE_TEXT = { asleep: 'fast asleep', stirring: 'stirring…', waking: 'waking up!', awake: 'up and chasing!' };
const EMOTE_ICON = { shh: 'Shh', wave: 'Wave', dance: 'Dance', shrug: 'Shrug', thumbs: 'Thumbs' };

function noiseWord(n) {
  if (n < 12) return 'Silent';
  if (n < 55) return 'Quiet';
  return 'Loud';
}

const noFocus = (e) => e.preventDefault();

function ModePanel({ hud }) {
  if (hud.mode === 'heist') {
    return (
      <section className="panel snacks" aria-label="Snacks collected">
        <div className="snack-row">
          <span className="snack-count">
            {hud.snacks}/{hud.totalSnacks}
          </span>
          <span className="snack-slots" aria-hidden="true">
            {Array.from({ length: hud.totalSnacks }, (_, i) => (
              <span key={i} className={`slot${i < hud.snacks ? ' full' : ''}${i < hud.required ? ' needed' : ''}`} />
            ))}
          </span>
        </div>
        <p className={`objective${hud.ready ? ' ready' : ''}`}>{hud.objective}</p>
      </section>
    );
  }
  if (hud.mode === 'race') {
    const me = hud.players.find((p) => p.local);
    return (
      <section className="panel snacks" aria-label="Fridge Race">
        <div className="snack-row">
          <span className="snack-count">Fridge Race</span>
          {me?.busted > 0 && <span className="muted">sent back {me.busted}×</span>}
        </div>
        <p className="objective">{hud.objective}</p>
      </section>
    );
  }
  const left = hud.players.filter((p) => p.role === 'hider' && !p.out).length;
  return (
    <section className="panel snacks" aria-label="Hide and Seek">
      <div className="snack-row">
        <span className="snack-count">{hud.role === 'guard' ? 'Night Guard' : 'Hider'}</span>
        <span className="muted">{left} hiding</span>
      </div>
      <p className="objective">{hud.objective}</p>
      {hud.role === 'hider' && hud.catchMeter > 0.05 && (
        <div className="meter catch" aria-label="Being spotted">
          <i style={{ width: `${Math.round(hud.catchMeter * 100)}%` }} />
        </div>
      )}
    </section>
  );
}

export default function Hud({ hud, party, feed, room, settings, voice, onShh, onHide, onEmote, onQuick, onPause, onTouchMove, onTouchRun, onBuzz, onToggleView, onLook, onTalk, onToggleMic }) {
  const touch = isTouchDevice();
  const [chatOpen, setChatOpen] = useState(false);
  const [emotesOpen, setEmotesOpen] = useState(!touch);
  const shhReady = hud.shhCooldown <= 0;
  const charge = shhReady ? 100 : Math.round(100 - (hud.shhCooldown / hud.shhMax) * 100);
  const word = noiseWord(hud.noise);
  const lit = Math.round(hud.noise / 10);
  const clock = hud.mode === 'hideseek' && hud.phase !== 'hiding' ? formatTime(hud.phaseTimer) : formatTime(hud.time);
  const big = hud.phase === 'countdown' || hud.phase === 'hiding' ? Math.ceil(hud.phaseTimer) : null;
  const nameOf = (id) => room?.members.find((m) => m.id === id)?.name || '';

  return (
    <div className={`hud${touch ? ' is-touch' : ''}${settings?.leftHanded ? ' left-handed' : ''}`}>
      <div className="hud-top">
        <ModePanel hud={hud} />
{hud.wake ? (
        <section className={`panel wake stage-${hud.wake.stage}`} aria-label="Wake meter">
          <div className="wake-head">
            <span>Wake meter</span>
            <span>
              {hud.wake.name} is {STAGE_TEXT[hud.wake.stage]}
            </span>
          </div>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hud.wake.value}>
            <i style={{ width: `${hud.wake.value}%` }} />
          </div>
        </section>
        ) : (
          <span />
        )}
        <section className="panel clock">
          {party && voice?.supported && <MicButton state={voice.on ? (voice.openMic ? 'live' : 'muted') : 'off'} onToggle={onToggleMic} />}
          <span className="time">{clock}</span>
          <button type="button" className="view-btn" onMouseDown={noFocus} onClick={onToggleView} title={touch ? 'Switch view' : 'Switch view (V)'}>
            {settings?.camera === 'pov' ? 'Top' : 'POV'}
          </button>
          <button type="button" className="icon-btn" onMouseDown={noFocus} onClick={onPause} aria-label={party ? 'Menu' : 'Pause'}>
            <span className="pause-glyph" />
          </button>
        </section>
      </div>

      {big !== null && big > 0 && (
        <div className="countdown" role="status">
          <span>{big}</span>
          <small>{hud.phase === 'countdown' ? 'Get ready' : hud.role === 'guard' ? 'Counting… no peeking' : 'Hide!'}</small>
        </div>
      )}

      {hud.time < 9 && hud.mode === 'heist' && (
        <div className="tip" role="status">
          {touch ? 'Push the stick gently to tiptoe past sleepers.' : <>Hold <kbd>Space</kbd> to tiptoe past sleepers.</>} Light, cracked planks make noise.
        </div>
      )}

      {party && feed.length > 0 && (
        <ul className="feed hud-feed" aria-live="polite">
          {feed.slice(-3).map((f) => (
            <li key={f.at}>
              <strong>{nameOf(f.id)}</strong> {f.text}
            </li>
          ))}
        </ul>
      )}

      {touch && (
        <TouchControls
          onMove={onTouchMove}
          onRun={onTouchRun}
          onHide={onHide}
          prompt={hud.prompt}
          leftHanded={settings?.leftHanded}
          onBuzz={onBuzz}
          pov={settings?.camera === 'pov'}
          onLook={onLook}
        />
      )}

      {party && voice?.on && (
        <div className="voice-bar" aria-live="polite">
          {settings?.voiceMode === 'open' ? (
            <span className="voice-pill live">Mic on</span>
          ) : (
            <button
              type="button"
              className={`voice-pill talk${voice.talking ? ' live' : ''}`}
              onPointerDown={(e) => {
                e.preventDefault();
                onTalk(true);
              }}
              onPointerUp={() => onTalk(false)}
              onPointerCancel={() => onTalk(false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {voice.talking ? 'Talking…' : touch ? 'Hold to talk' : 'Hold T to talk'}
            </button>
          )}
          {voice.speaking.map((id) => (
            <span key={id} className="voice-pill speaking">
              {room?.members.find((m) => m.id === id)?.name}
            </span>
          ))}
        </div>
      )}

      <div className="hud-bottom">
        <section className={`panel noise is-${word.toLowerCase()}`} aria-label="Noise meter">
          <div className="noise-bars" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={i < lit ? 'on' : ''} />
            ))}
          </div>
          <div className="noise-text">
            <strong>{word}</strong>
            <span>{MOVE_TEXT[hud.moveMode]}</span>
          </div>
        </section>

        <div className="center-stack" aria-live="polite">
          {hud.crying && <div className="alert-pill">{hud.crying} is crying! Use the Shh near her.</div>}
          {hud.chase && <div className="alert-pill chase">{hud.chase.join(' & ')} {hud.chase.length > 1 ? 'are' : 'is'} chasing you! Run or hide!</div>}
          {hud.spotted && <div className="alert-pill">{hud.spotted} is watching you!</div>}
          {hud.prompt && !touch && (
            <button type="button" className="prompt" onMouseDown={noFocus} onClick={onHide}>
              {hud.prompt}
            </button>
          )}
          {chatOpen && party && (
            <div className="quick-row hud-quick">
              {QUICK_CHAT.map((q, i) => (
                <button
                  key={q}
                  type="button"
                  className="btn small"
                  onMouseDown={noFocus}
                  onClick={() => {
                    onQuick(i);
                    setChatOpen(false);
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <div className="emote-row">
            {touch && (
              <button type="button" className={`emote-btn${emotesOpen ? ' on' : ''}`} onClick={() => setEmotesOpen((o) => !o)} aria-expanded={emotesOpen}>
                Emotes
              </button>
            )}
            {emotesOpen && EMOTES.map((e) => (
              <button key={e.id} type="button" className="emote-btn" onMouseDown={noFocus} onClick={() => onEmote(e.id)} title={`${e.name}${touch ? '' : ` (${e.key})`}`}>
                {EMOTE_ICON[e.id]}
              </button>
            ))}
            {party && (
              <button type="button" className={`emote-btn chat${chatOpen ? ' on' : ''}`} onMouseDown={noFocus} onClick={() => setChatOpen((o) => !o)} aria-expanded={chatOpen}>
                Chat
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          className={`shh-btn${shhReady ? ' ready' : ''}${hud.bubble ? ' active' : ''}`}
          style={{ '--charge': `${charge}%` }}
          onMouseDown={noFocus}
          onClick={onShh}
          aria-label={shhReady ? 'Use the Shh' : `The Shh recharges in ${Math.ceil(hud.shhCooldown)} seconds`}
        >
          <span className="shh-word">Shh</span>
          <span className="shh-key">{shhReady ? (touch ? 'tap' : 'E') : Math.ceil(hud.shhCooldown)}</span>
        </button>
      </div>
    </div>
  );
}
