// Tiny in-memory rate limiter (per IP). Good enough for one server instance.
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) if (now - entry.start > windowMs) hits.delete(ip);
  }, windowMs).unref();

  return (req, res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now - entry.start > windowMs) {
      hits.set(ip, { start: now, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) return res.status(429).json({ error: 'Too many requests. Shhh, slow down.' });
    return next();
  };
}
