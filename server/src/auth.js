import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[auth] JWT_SECRET is not set. Using a temporary secret: everyone is logged out when the server restarts.');
}

// Passwords are salted and hashed with scrypt (built into Node). Never stored as text.
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export const signToken = (user) => jwt.sign({ sub: String(user._id), name: user.username }, SECRET, { expiresIn: '30d' });

export function readToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  req.auth = token ? readToken(token) : null;
  next();
}

export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => (req.auth ? next() : res.status(401).json({ error: 'Please log in first.' })));
}

const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'porn', 'sex', 'nazi', 'kill', 'slut', 'whore', 'penis', 'vagina'];

export function usernameProblem(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_]{3,16}$/.test(name)) return 'Usernames are 3 to 16 letters, numbers or underscores.';
  const lower = name.toLowerCase();
  if (BLOCKED.some((w) => lower.includes(w))) return 'Please pick a different username.';
  return null;
}

export function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 6 || pw.length > 72) return 'Passwords need 6 to 72 characters.';
  return null;
}
