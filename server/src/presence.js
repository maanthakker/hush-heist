// Who is online right now (by user id), for the friends list.
const counts = new Map();
export const presence = {
  add(id) {
    counts.set(id, (counts.get(id) || 0) + 1);
  },
  remove(id) {
    const n = (counts.get(id) || 1) - 1;
    if (n <= 0) counts.delete(id);
    else counts.set(id, n);
  },
  has: (id) => counts.has(String(id)),
};
