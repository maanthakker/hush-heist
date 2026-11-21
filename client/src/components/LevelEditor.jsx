import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FURNITURE, LIMITS, NAME_WORDS, PATROLLERS, SIZES, SLEEPERS, THEMES, emptyLevel, footprint, levelName, sanitize, validateCustomLevel } from '@shared/custom.js';
import { hashData } from '../myLevels.js';

const TOOLS = [
  ['wall', 'Wall'],
  ['erase', 'Eraser'],
  ['furniture', 'Furniture'],
  ['snack', 'Snack'],
  ['stash', 'Stash'],
  ['sleeper', 'Sleeper'],
  ['patroller', 'Patroller'],
  ['creak', 'Creaky board'],
  ['toy', 'Squeaky toy'],
  ['start', 'Start'],
  ['exit', 'Exit mat'],
];
const HELP = {
  wall: 'Tap or drag to draw walls.',
  erase: 'Tap or drag to remove anything.',
  furniture: 'Tap to place. Closets, boxes, trunks, tables and cars are hiding spots. Press R or Rotate to turn it.',
  snack: 'Tap to add or remove snacks.',
  stash: 'The big golden stash. Optional, but if it’s there, players must grab it.',
  sleeper: 'Tap to add a sleeping family member. Put them on a bed or sofa, or on the floor. A Baby who wakes wakes everyone!',
  patroller: 'Tap to place a patroller, then keep tapping to draw its route (2 to 6 points).',
  creak: 'Tap or drag: creaky boards make noise unless you tiptoe.',
  toy: 'Tap to drop a squeaky toy.',
  start: 'Where players begin.',
  exit: 'Players must get back here (3×3 mat) with the snacks to win.',
};
const FLOOR = { jungle: '#3a2f28', kitchen: '#4a4f55', garage: '#3d4148', attic: '#3e3024' };
const PATROL_COLOR = { cat: '#d9f56b', vacuum: '#4fd6ff', mower: '#ffd23f' };
const same = (a, x, z) => a && a[0] === x && a[1] === z;

export default function LevelEditor({ draft, online, loggedIn, onSave, onTest, onPublish, onBack }) {
  const [data, setData] = useState(() => sanitize(draft?.data || emptyLevel('m', 'jungle')));
  const [tool, setTool] = useState('wall');
  const [kind, setKind] = useState({ furniture: 'closet', sleeper: 'dad', patroller: 'cat' });
  const [rot, setRot] = useState(0);
  const [active, setActive] = useState(null); // patroller being routed
  const [hover, setHover] = useState(null);
  const [msg, setMsg] = useState(null);
  const history = useRef([]);
  const painting = useRef(false);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [cell, setCell] = useState(18);
  const { w: W, d: D } = SIZES[data.size];

  const check = useMemo(() => validateCustomLevel(data), [data]);
  const verified = draft?.verifiedHash && draft.verifiedHash === hashData(data);

  // Fit the grid to the screen.
  useEffect(() => {
    const fit = () => {
      const width = wrapRef.current?.clientWidth || 600;
      setCell(Math.max(8, Math.min(26, Math.floor(width / W))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [W]);

  const commit = useCallback((next, keepHistory = false) => {
    if (!keepHistory) history.current = [...history.current.slice(-49), data];
    setData(sanitize(next));
  }, [data]);

  const undo = () => {
    const prev = history.current.pop();
    if (prev) setData(prev);
  };

  // ---------------------------------------------------------------- editing
  const cellKind = (d, x, z) => {
    if (d.walls.some((c) => same(c, x, z))) return 'wall';
    if (d.furniture.some((f) => footprint(f).some((c) => same(c, x, z)))) return 'furniture';
    return null;
  };
  const restFurniture = (d, x, z) => d.furniture.find((f) => ['bed', 'sofa', 'daybed'].includes(f.k) && footprint(f).some((c) => same(c, x, z)));

  const apply = (x, z, d) => {
    const n = JSON.parse(JSON.stringify(d));
    const at = cellKind(n, x, z);
    const toggle = (list, max) => {
      const i = list.findIndex((c) => same(c, x, z));
      if (i >= 0) list.splice(i, 1);
      else if (!at && list.length < max) list.push([x, z]);
    };
    switch (tool) {
      case 'wall':
        if (!at) n.walls.push([x, z]);
        break;
      case 'erase': {
        const pi = n.patrollers.findIndex((p) => p.path.some((c) => same(c, x, z)));
        if (pi >= 0) {
          n.patrollers[pi].path = n.patrollers[pi].path.filter((c) => !same(c, x, z));
          if (!n.patrollers[pi].path.length) n.patrollers.splice(pi, 1);
          break;
        }
        const before = JSON.stringify(n);
        n.sleepers = n.sleepers.filter((s) => !(s.x === x && s.z === z));
        n.snacks = n.snacks.filter((c) => !same(c, x, z));
        n.toys = n.toys.filter((c) => !same(c, x, z));
        n.creaks = n.creaks.filter((c) => !same(c, x, z));
        if (same(n.stash, x, z)) n.stash = null;
        if (JSON.stringify(n) !== before) break;
        n.furniture = n.furniture.filter((f) => !footprint(f).some((c) => same(c, x, z)));
        n.walls = n.walls.filter((c) => !same(c, x, z));
        break;
      }
      case 'furniture': {
        const f = { k: kind.furniture, x, z, r: rot };
        const cells = footprint(f);
        if (n.furniture.length >= LIMITS.furniture) return setMsg('That’s the most furniture a level can have.');
        if (cells.some(([cx, cz]) => cx >= W || cz >= D || cellKind(n, cx, cz))) return setMsg('No room there.');
        n.furniture.push(f);
        break;
      }
      case 'snack':
        toggle(n.snacks, LIMITS.snacks);
        break;
      case 'creak':
        toggle(n.creaks, LIMITS.creaks);
        break;
      case 'toy':
        toggle(n.toys, LIMITS.toys);
        break;
      case 'stash':
        if (!at) n.stash = same(n.stash, x, z) ? null : [x, z];
        break;
      case 'start':
        if (!at) n.start = [x, z];
        break;
      case 'exit':
        if (!at) n.exit = [x, z];
        break;
      case 'sleeper': {
        const i = n.sleepers.findIndex((s) => s.x === x && s.z === z);
        if (i >= 0) n.sleepers.splice(i, 1);
        else if (at === 'wall' || (at === 'furniture' && !restFurniture(n, x, z))) return setMsg('Sleepers go on the floor, a bed, a sofa or a daybed.');
        else if (n.sleepers.length >= LIMITS.sleepers) return setMsg(`Up to ${LIMITS.sleepers} sleepers.`);
        else n.sleepers.push({ k: kind.sleeper, x, z, r: rot });
        break;
      }
      case 'patroller': {
        if (at) return setMsg('Patrollers walk on the floor.');
        const cur = active !== null ? n.patrollers[active] : null;
        if (cur && cur.k === kind.patroller && cur.path.length < LIMITS.pathPoints) {
          cur.path.push([x, z]);
        } else if (n.patrollers.length < LIMITS.patrollers) {
          n.patrollers.push({ k: kind.patroller, path: [[x, z]] });
          setActive(n.patrollers.length - 1);
        } else return setMsg(`Up to ${LIMITS.patrollers} patrollers.`);
        break;
      }
      default:
        break;
    }
    setMsg(null);
    return n;
  };

  const toCell = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / cell);
    const z = Math.floor((e.clientY - r.top) / cell);
    return x >= 0 && z >= 0 && x < W && z < D ? [x, z] : null;
  };
  const paintTool = ['wall', 'erase', 'creak'].includes(tool);

  const onDown = (e) => {
    const c = toCell(e);
    if (!c) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    painting.current = paintTool;
    const n = apply(c[0], c[1], data);
    if (n) commit(n);
  };
  const onMove = (e) => {
    const c = toCell(e);
    setHover(c);
    if (!c || !painting.current) return;
    setData((d) => {
      const n = apply(c[0], c[1], d);
      return n ? sanitize(n) : d;
    });
  };
  const onUp = () => {
    painting.current = false;
  };

  useEffect(() => {
    const key = (e) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'SELECT'].includes(e.target.tagName)) return;
      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) setRot((r) => (r + 1) % 4);
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onTest({ ...draft, data });
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  // ----------------------------------------------------------------- drawing
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * cell * dpr;
    cv.height = D * cell * dpr;
    cv.style.width = `${W * cell}px`;
    cv.style.height = `${D * cell}px`;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const C = cell;
    const px = (x) => x * C;
    g.fillStyle = FLOOR[data.theme];
    g.fillRect(0, 0, W * C, D * C);
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 1;
    for (let x = 0; x <= W; x++) {
      g.beginPath();
      g.moveTo(px(x) + 0.5, 0);
      g.lineTo(px(x) + 0.5, D * C);
      g.stroke();
    }
    for (let z = 0; z <= D; z++) {
      g.beginPath();
      g.moveTo(0, px(z) + 0.5);
      g.lineTo(W * C, px(z) + 0.5);
      g.stroke();
    }
    const label = (text, x, y, color = '#10132e', size = 0.42) => {
      if (C < 12) return;
      g.fillStyle = color;
      g.font = `700 ${Math.round(C * size)}px Fredoka, system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, x, y);
    };
    // exit mat
    g.fillStyle = 'rgba(127,227,198,0.22)';
    g.strokeStyle = '#7fe3c6';
    g.lineWidth = 2;
    g.fillRect(px(data.exit[0] - 1), px(data.exit[1] - 1), 3 * C, 3 * C);
    g.strokeRect(px(data.exit[0] - 1) + 1, px(data.exit[1] - 1) + 1, 3 * C - 2, 3 * C - 2);
    label('EXIT', px(data.exit[0]) + C / 2, px(data.exit[1]) + C / 2, '#7fe3c6', 0.4);
    for (const [x, z] of data.creaks) {
      g.fillStyle = '#a5794c';
      g.fillRect(px(x) + 1, px(z) + 1, C - 2, C - 2);
      g.strokeStyle = '#3b2216';
      g.beginPath();
      g.moveTo(px(x) + C * 0.2, px(z) + C * 0.3);
      g.lineTo(px(x) + C * 0.5, px(z) + C * 0.55);
      g.lineTo(px(x) + C * 0.8, px(z) + C * 0.4);
      g.stroke();
    }
    g.fillStyle = '#d9cfb8';
    for (const [x, z] of data.walls) g.fillRect(px(x), px(z), C, C);
    for (const f of data.furniture) {
      const cells = footprint(f);
      const xs = cells.map((c) => c[0]);
      const zs = cells.map((c) => c[1]);
      const x0 = Math.min(...xs);
      const z0 = Math.min(...zs);
      const w = Math.max(...xs) - x0 + 1;
      const d = Math.max(...zs) - z0 + 1;
      const def = FURNITURE[f.k];
      g.fillStyle = def.color;
      g.fillRect(px(x0) + 1, px(z0) + 1, w * C - 2, d * C - 2);
      if (def.hide) {
        g.strokeStyle = '#7fe3c6';
        g.lineWidth = 2;
        g.setLineDash([4, 3]);
        g.strokeRect(px(x0) + 2, px(z0) + 2, w * C - 4, d * C - 4);
        g.setLineDash([]);
      }
      const light = ['#e9e3d6', '#d9dadf', '#e8ecf1', '#efe9e0', '#d9d2c2'].includes(def.color);
      label(def.label.split(' ')[0], px(x0) + (w * C) / 2, px(z0) + (d * C) / 2, light ? '#10132e' : '#f1ece2', 0.36);
    }
    const dot = (x, z, color, r = 0.3) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(px(x) + C / 2, px(z) + C / 2, C * r, 0, Math.PI * 2);
      g.fill();
    };
    for (const [x, z] of data.toys) dot(x, z, '#f06aa0', 0.25);
    for (const [x, z] of data.snacks) dot(x, z, '#e2b65a', 0.32);
    if (data.stash) {
      g.fillStyle = '#ffd27a';
      g.fillRect(px(data.stash[0]) + C * 0.1, px(data.stash[1]) + C * 0.1, C * 0.8, C * 0.8);
      label('★', px(data.stash[0]) + C / 2, px(data.stash[1]) + C / 2, '#c94b3a', 0.6);
    }
    for (const s of data.sleepers) {
      g.fillStyle = s.k === 'baby' ? '#f5a7c0' : '#b9b3ff';
      g.fillRect(px(s.x) + C * 0.1, px(s.z) + C * 0.15, C * 0.8, C * 0.7);
      label(SLEEPERS[s.k].name[0], px(s.x) + C / 2, px(s.z) + C / 2, '#10132e', 0.5);
    }
    data.patrollers.forEach((p, i) => {
      const col = PATROL_COLOR[p.k];
      g.strokeStyle = col;
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      g.beginPath();
      p.path.forEach(([x, z], k) => (k ? g.lineTo(px(x) + C / 2, px(z) + C / 2) : g.moveTo(px(x) + C / 2, px(z) + C / 2)));
      if (p.path.length > 2) g.closePath();
      g.stroke();
      g.setLineDash([]);
      p.path.forEach(([x, z], k) => {
        dot(x, z, col, k === 0 ? 0.38 : 0.2);
        if (k === 0) label(p.k[0].toUpperCase(), px(x) + C / 2, px(z) + C / 2, '#10132e', 0.5);
      });
      if (i === active && tool === 'patroller') {
        g.strokeStyle = '#ffffff';
        g.lineWidth = 2;
        g.strokeRect(px(p.path[0][0]) - 2, px(p.path[0][1]) - 2, C + 4, C + 4);
      }
    });
    dot(data.start[0], data.start[1], '#7fe3c6', 0.4);
    label('S', px(data.start[0]) + C / 2, px(data.start[1]) + C / 2, '#10132e', 0.5);
    if (hover && tool === 'furniture') {
      const cells = footprint({ k: kind.furniture, x: hover[0], z: hover[1], r: rot });
      g.fillStyle = 'rgba(255,255,255,0.25)';
      for (const [x, z] of cells) g.fillRect(px(x), px(z), C, C);
    } else if (hover) {
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 2;
      g.strokeRect(px(hover[0]) + 1, px(hover[1]) + 1, C - 2, C - 2);
    }
  }, [data, cell, hover, tool, kind, rot, active, W, D]);

  // ------------------------------------------------------------------ saving
  const save = () => {
    const saved = onSave({ ...draft, data });
    setMsg(saved ? 'Saved on this device.' : null);
  };
  const publish = async () => {
    setMsg('Publishing…');
    try {
      await onPublish({ ...draft, data });
      setMsg('Published! Find it in Online levels.');
    } catch (err) {
      setMsg(err.message);
    }
  };
  const setName = (i, v) => commit({ ...data, name: data.name.map((n, k) => (k === i ? Number(v) : n)) });

  return (
    <div className="screen editor-screen">
      <div className="card editor-card">
        <header className="editor-head">
          <button type="button" className="btn small ghost" onClick={onBack}>
            ← Back
          </button>
          <strong className="editor-title">{levelName(data.name)}</strong>
          <button type="button" className="btn small ghost" onClick={undo} disabled={!history.current.length}>
            Undo
          </button>
          <button type="button" className="btn small" onClick={() => onTest({ ...draft, data })} title="Test play (Ctrl+Enter)">
            ▶ Test
          </button>
        </header>

        <div className="editor-tools" role="toolbar" aria-label="Building tools">
          {TOOLS.map(([id, name]) => (
            <button key={id} type="button" className={`pill${tool === id ? ' on' : ''}`} onClick={() => setTool(id)}>
              {name}
            </button>
          ))}
        </div>
        <div className="editor-options">
          {tool === 'furniture' && (
            <select value={kind.furniture} onChange={(e) => setKind({ ...kind, furniture: e.target.value })} aria-label="Furniture">
              {Object.entries(FURNITURE).map(([k, f]) => (
                <option key={k} value={k}>
                  {f.label}
                  {f.hide ? ' (hiding spot)' : ''}
                </option>
              ))}
            </select>
          )}
          {tool === 'sleeper' && (
            <select value={kind.sleeper} onChange={(e) => setKind({ ...kind, sleeper: e.target.value })} aria-label="Who's sleeping">
              {Object.entries(SLEEPERS).map(([k, s]) => (
                <option key={k} value={k}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {tool === 'patroller' && (
            <>
              <select
                value={kind.patroller}
                onChange={(e) => {
                  setKind({ ...kind, patroller: e.target.value });
                  setActive(null);
                }}
                aria-label="Patroller"
              >
                {Object.entries(PATROLLERS).map(([k, p]) => (
                  <option key={k} value={k}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button type="button" className="btn small ghost" onClick={() => setActive(null)}>
                New patroller
              </button>
            </>
          )}
          {(tool === 'furniture' || tool === 'sleeper') && (
            <button type="button" className="btn small ghost" onClick={() => setRot((r) => (r + 1) % 4)}>
              Rotate (R)
            </button>
          )}
          <span className="muted small">{HELP[tool]}</span>
        </div>

        <div className="editor-grid" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => setHover(null)}
            aria-label="Level grid"
          />
        </div>

        <div className="editor-settings">
          <div className="name-pickers" aria-label="Level name">
            {NAME_WORDS.map((words, i) => (
              <select key={i} value={data.name[i]} onChange={(e) => setName(i, e.target.value)} aria-label={`Name word ${i + 1}`}>
                {words.map((wd, k) => (
                  <option key={wd} value={k}>
                    {wd}
                  </option>
                ))}
              </select>
            ))}
          </div>
          <div className="pill-row">
            {Object.entries(THEMES).map(([k, t]) => (
              <button key={k} type="button" className={`pill${data.theme === k ? ' on' : ''}`} onClick={() => commit({ ...data, theme: k })}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="pill-row">
            {Object.entries(SIZES).map(([k, s]) => (
              <button key={k} type="button" className={`pill${data.size === k ? ' on' : ''}`} onClick={() => commit({ ...data, size: k })}>
                {s.label}
              </button>
            ))}
            <label className="req">
              Snacks needed
              <input type="number" min="1" max={Math.max(1, data.snacks.length)} value={data.required} onChange={(e) => commit({ ...data, required: Number(e.target.value) || 1 })} />
            </label>
          </div>
        </div>

        {check.ok ? <p className="editor-ok">Looks playable! Test it, then save or publish.</p> : (
          <ul className="editor-errors" aria-label="Still to fix before publishing (you can test any time)">
            {check.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {!check.ok && <p className="muted small">You can test your level any time, even unfinished. These just need fixing before you publish.</p>}
        {msg && <p className="muted">{msg}</p>}

        <div className="actions">
          <button type="button" className="btn primary" onClick={() => onTest({ ...draft, data })}>
            Test play
          </button>
          <button type="button" className="btn ghost" onClick={save}>
            Save
          </button>
          {online && (
            <button type="button" className="btn ghost" disabled={!check.ok || !verified || !loggedIn} onClick={publish}>
              {draft?.onlineId ? 'Update online' : 'Publish online'}
            </button>
          )}
        </div>
        {online && check.ok && (!loggedIn ? <p className="muted small">Log in to publish your levels.</p> : !verified && <p className="muted small">Beat your level in Test play to unlock publishing.</p>)}
      </div>
    </div>
  );
}
