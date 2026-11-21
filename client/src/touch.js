// True on phones and tablets, where we show the on-screen stick.
export const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
