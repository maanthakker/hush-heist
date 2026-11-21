// Your level drafts, saved on this device (published ones also live online).
const KEY = 'hush-heist:my-levels';

export function loadDrafts() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((d) => d && d.localId && d.data) : [];
  } catch {
    return [];
  }
}

function store(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or private browsing */
  }
  return list;
}

export function saveDraft(draft) {
  const list = loadDrafts();
  const next = { ...draft, localId: draft.localId || `lvl-${Date.now().toString(36)}`, updatedAt: Date.now() };
  const i = list.findIndex((d) => d.localId === next.localId);
  if (i >= 0) list[i] = next;
  else list.unshift(next);
  store(list);
  return next;
}

export function deleteDraft(localId) {
  return store(loadDrafts().filter((d) => d.localId !== localId));
}

// A fingerprint of the level, so "you beat it" only counts for this exact version.
export function hashData(data) {
  const s = JSON.stringify(data);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
