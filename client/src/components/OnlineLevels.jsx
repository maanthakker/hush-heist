import { useCallback, useEffect, useState } from 'react';
import { SIZES, THEMES, levelName } from '@shared/custom.js';
import { api, isOnline } from '../api.js';
import { deleteDraft, loadDrafts } from '../myLevels.js';

const SORTS = [
  ['new', 'New'],
  ['top', 'Top'],
  ['friends', 'Friends'],
];

export default function OnlineLevels({ profile, onPlayOnline, onEdit, onTestDraft }) {
  const online = isOnline();
  const loggedIn = profile.kind === 'user';
  const [sort, setSort] = useState('new');
  const [list, setList] = useState([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(null);
  const [drafts, setDrafts] = useState(loadDrafts);

  const load = useCallback(
    async (p = 0) => {
      if (!online) return;
      setBusy(true);
      setError(null);
      try {
        const res = await api.levels(sort, p);
        setList((l) => (p ? [...l, ...res.levels] : res.levels));
        setMore(res.more);
        setPage(p);
      } catch (err) {
        setError(err.message);
        if (!p) setList([]);
      } finally {
        setBusy(false);
      }
    },
    [online, sort],
  );
  useEffect(() => {
    load(0);
  }, [load]);

  const play = async (card) => {
    try {
      const { level } = await api.level(card.id);
      onPlayOnline(card, level.data);
    } catch (err) {
      setError(err.message);
    }
  };
  const like = async (card) => {
    try {
      const { level } = await api.likeLevel(card.id);
      setList((l) => l.map((x) => (x.id === card.id ? level : x)));
    } catch (err) {
      setError(err.message);
    }
  };
  const report = async (card) => {
    if (reporting !== card.id) return setReporting(card.id);
    setReporting(null);
    try {
      await api.reportLevel(card.id);
      setList((l) => l.filter((x) => x.id !== card.id));
    } catch (err) {
      setError(err.message);
    }
    return null;
  };

  return (
    <div className="tab-body">
      <div className="online-head">
        <h3>My levels</h3>
        <button type="button" className="btn small" onClick={() => onEdit(null)}>
          Make a new level
        </button>
      </div>
      {drafts.length === 0 && <p className="muted">Build your own heist: walls, furniture, snacks, sleepers, patrollers and traps.</p>}
      <ul className="level-cards">
        {drafts.map((d) => (
          <li key={d.localId} className="level-card">
            <div>
              <strong>{levelName(d.data.name)}</strong>
              <span className="muted small">
                {THEMES[d.data.theme]?.label} · {SIZES[d.data.size]?.label}
                {d.onlineId ? ' · published' : ''}
              </span>
            </div>
            <div className="card-actions">
              <button type="button" className="btn small" onClick={() => onTestDraft(d)}>
                Play
              </button>
              <button type="button" className="btn small ghost" onClick={() => onEdit(d)}>
                Edit
              </button>
              <button
                type="button"
                className="btn small ghost"
                onClick={async () => {
                  if (d.onlineId && loggedIn) await api.deleteLevel(d.onlineId).catch(() => {});
                  setDrafts(deleteDraft(d.localId));
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <h3>Online levels</h3>
      {!online ? (
        <p className="callout">Online levels need the online version of the game. You can still build and play your own levels here.</p>
      ) : (
        <>
          <div className="pill-row">
            {SORTS.map(([id, name]) => (
              <button key={id} type="button" className={`pill${sort === id ? ' on' : ''}`} disabled={id === 'friends' && !loggedIn} onClick={() => setSort(id)}>
                {name}
              </button>
            ))}
          </div>
          {error && <p className="form-error">{error}</p>}
          {!busy && list.length === 0 && !error && <p className="muted">No levels here yet. Be the first to publish one!</p>}
          <ul className="level-cards">
            {list.map((c) => (
              <li key={c.id} className="level-card">
                <div>
                  <strong>{c.name}</strong>
                  <span className="muted small">
                    by {c.authorName} · {THEMES[c.theme]?.label} · {c.plays} plays · {c.likes} likes
                  </span>
                </div>
                <div className="card-actions">
                  <button type="button" className="btn small" onClick={() => play(c)}>
                    Play
                  </button>
                  {loggedIn && (
                    <button type="button" className={`btn small ghost${c.liked ? ' liked' : ''}`} onClick={() => like(c)} aria-pressed={c.liked}>
                      {c.liked ? '♥ Liked' : '♡ Like'}
                    </button>
                  )}
                  {loggedIn && !c.mine && (
                    <button type="button" className="btn small ghost" onClick={() => report(c)}>
                      {reporting === c.id ? 'Tap again to report' : 'Report'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {more && (
            <button type="button" className="btn ghost wide" disabled={busy} onClick={() => load(page + 1)}>
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
