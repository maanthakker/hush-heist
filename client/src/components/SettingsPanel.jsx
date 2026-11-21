import { useEffect, useState } from 'react';
import { isTouchDevice } from '../touch.js';

function Slider({ id, label, value, onChange, disabled }) {
  return (
    <div className="setting">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min="0" max="1" step="0.05" value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="setting-val">{Math.round(value * 100)}%</span>
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }) {
  return (
    <label className="setting toggle">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}

export default function SettingsPanel({ settings, onChange, compact = false }) {
  const set = (k) => (v) => onChange({ ...settings, [k]: v });
  const touch = isTouchDevice();
  const [full, setFull] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const canFull = !!document.documentElement.requestFullscreen && document.fullscreenEnabled;

  return (
    <div className="settings">
      <h3>Sound</h3>
      <Slider id="set-music" label="Music" value={settings.music} onChange={set('music')} disabled={settings.muted} />
      <Slider id="set-sfx" label="Sound effects" value={settings.sfx} onChange={set('sfx')} disabled={settings.muted} />
      <Toggle label="Mute everything" checked={settings.muted} onChange={set('muted')} />

      <h3>Camera</h3>
      <div className="setting">
        <span>View</span>
        <div className="pill-row">
          {[
            ['top', 'Top-down'],
            ['pov', 'First person (POV)'],
          ].map(([v, name]) => (
            <button key={v} type="button" className={`pill${settings.camera === v ? ' on' : ''}`} onClick={() => set('camera')(v)}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <p className="muted">{touch ? 'In first person, drag on the right side to look around.' : 'Press V in a round to switch. In first person, click the game and move the mouse to look (or use the ← → keys); A and D side-step.'}</p>

      <h3>Voice chat</h3>
      <div className="setting">
        <span>Microphone</span>
        <div className="pill-row">
          {[
            ['push', touch ? 'Hold to talk' : 'Push to talk (T)'],
            ['open', 'Open mic'],
          ].map(([v, name]) => (
            <button key={v} type="button" className={`pill${settings.voiceMode === v ? ' on' : ''}`} onClick={() => set('voiceMode')(v)}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <Slider id="set-voice" label="Friends’ voices" value={settings.voiceVolume} onChange={set('voiceVolume')} />
      <p className="muted">Voice chat only works in parties, only between players who are friends with each other, and is never recorded. You can mute anyone in the lobby.</p>

      <h3>Graphics</h3>
      <div className="setting">
        <span>Quality</span>
        <div className="pill-row">
          {[
            ['high', 'High'],
            ['low', 'Battery saver'],
          ].map(([q, name]) => (
            <button key={q} type="button" className={`pill${settings.quality === q ? ' on' : ''}`} onClick={() => set('quality')(q)}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <Toggle label="Reduce motion" hint="Steadier camera, no menu animations" checked={settings.reduceMotion} onChange={set('reduceMotion')} />
      {canFull && (
        <div className="setting">
          <span>Full screen</span>
          <button
            type="button"
            className="btn small ghost"
            onClick={() => (full ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})}
          >
            {full ? 'Exit full screen' : 'Go full screen'}
          </button>
        </div>
      )}

      {touch && (
        <>
          <h3>Touch</h3>
          <Toggle label="Vibration" checked={settings.vibration} onChange={set('vibration')} />
          <Toggle label="Left-handed controls" hint="Stick on the right, buttons on the left" checked={settings.leftHanded} onChange={set('leftHanded')} />
        </>
      )}

      {!compact && (
        <p className="muted about">
          Hush Heist is built with React, three.js, Node, Socket.io and MongoDB. Every model, texture, sound and note of music is made in code.
        </p>
      )}
    </div>
  );
}
