import { isTouchDevice } from './touch.js';

// Player settings, kept on this device.
const KEY = 'hush-heist:settings';
export const DEFAULT_SETTINGS = {
  music: 0.5,
  sfx: 0.8,
  muted: false,
  quality: isTouchDevice() ? 'low' : 'high',
  vibration: true,
  reduceMotion: typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  leftHanded: false,
  camera: 'top', // 'top' = angled top-down, 'pov' = first person
  voiceMode: 'push', // 'push' = push-to-talk, 'open' = open mic
  voiceVolume: 0.9,
};

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private browsing */
  }
  return s;
}

export function buzz(settings, pattern) {
  if (settings?.vibration && typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* not allowed */
    }
  }
}
