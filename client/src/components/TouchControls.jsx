import { useRef, useState } from 'react';

const RADIUS = 56;
const DEADZONE = 0.18;
const TIPTOE_BELOW = 0.6;

function shortPrompt(prompt) {
  if (!prompt) return null;
  if (/slip out/i.test(prompt)) return 'Slip out';
  if (/search/i.test(prompt)) return 'Search';
  return 'Hide';
}

// Phase 6 touch controls: put your thumb down anywhere on your side of the
// screen and the stick appears under it. Gentle push = tiptoe, full push = walk.
export default function TouchControls({ onMove, onRun, onHide, prompt, leftHanded, onBuzz, pov, onLook }) {
  const lookRef = useRef(null);
  const zoneRef = useRef(null);
  const pointer = useRef(null);
  const [stick, setStick] = useState(null);
  const [running, setRunning] = useState(false);
  const hideLabel = shortPrompt(prompt);

  const update = (e, origin) => {
    let dx = e.clientX - origin.cx;
    let dy = e.clientY - origin.cy;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS;
      dy = (dy / d) * RADIUS;
    }
    const mag = Math.min(1, d / RADIUS);
    const tiptoe = mag < TIPTOE_BELOW;
    setStick({ ...origin, x: dx, y: dy, tiptoe });
    if (mag < DEADZONE) onMove(0, 0, false);
    else onMove(dx / (mag * RADIUS), dy / (mag * RADIUS), tiptoe);
  };

  const release = () => {
    pointer.current = null;
    setStick(null);
    onMove(0, 0, false);
  };

  const setRun = (on) => {
    setRunning(on);
    onRun(on);
  };

  return (
    <>
      <div
        ref={zoneRef}
        className={`touch-zone ${leftHanded ? 'side-right' : 'side-left'}`}
        onPointerDown={(e) => {
          if (pointer.current !== null) return;
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          const rect = zoneRef.current.getBoundingClientRect();
          const origin = { cx: e.clientX, cy: e.clientY, left: e.clientX - rect.left, top: e.clientY - rect.top };
          update(e, origin);
        }}
        onPointerMove={(e) => pointer.current === e.pointerId && stick && update(e, stick)}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
        role="presentation"
      >
        {stick ? (
          <div className={`touch-stick${stick.tiptoe ? ' tiptoe' : ''}`} style={{ left: stick.left, top: stick.top }}>
            <span className="touch-knob" style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }} />
            <span className="touch-hint">{stick.tiptoe ? 'Tiptoe' : 'Walk'}</span>
          </div>
        ) : (
          <span className="touch-ghost">Drag here to move</span>
        )}
      </div>
      {pov && (
        <div
          className={`touch-look ${leftHanded ? 'side-left' : 'side-right'}`}
          onPointerDown={(e) => {
            lookRef.current = { id: e.pointerId, x: e.clientX };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const l = lookRef.current;
            if (!l || l.id !== e.pointerId) return;
            onLook(e.clientX - l.x);
            l.x = e.clientX;
          }}
          onPointerUp={() => (lookRef.current = null)}
          onPointerCancel={() => (lookRef.current = null)}
          role="presentation"
        >
          <span className="touch-ghost">Drag here to look around</span>
        </div>
      )}
      <div className={`touch-buttons ${leftHanded ? 'side-left' : 'side-right'}`}>
        {hideLabel && (
          <button
            type="button"
            className="touch-hide"
            onPointerDown={(e) => {
              e.preventDefault();
              onBuzz?.(15);
              onHide();
            }}
          >
            {hideLabel}
          </button>
        )}
        <button
          type="button"
          className={`touch-run${running ? ' on' : ''}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setRun(true);
          }}
          onPointerUp={() => setRun(false)}
          onPointerCancel={() => setRun(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          Run
        </button>
      </div>
    </>
  );
}
