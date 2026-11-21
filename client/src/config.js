// Put your own name here and it becomes the hero's default name.
// (Players can still type a different name on the title screen.)
export const HERO_NAME = 'Hero';

// Where the Node backend lives. Set VITE_API_URL in client/.env (local) or in
// Netlify's environment variables (production). Empty = play offline.
// "same" means the game and the API are served from the same site (one Render service).
const raw = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '');
const fromEnv = raw === 'same' && typeof window !== 'undefined' ? window.location.origin : raw;
export const API_URL = fromEnv.replace(/\/+$/, '');

export const STORAGE = {
  name: 'hush-heist:hero-name',
  best: (levelId) => `hush-heist:best:${levelId}`,
};
