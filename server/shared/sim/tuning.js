// Every gameplay number lives here so balancing never means hunting through code.
// Noise entries are [radius, intensity]: radius is how far the sound carries
// (world units), intensity is how much wake it adds to a sleeper right next to it.
export const TUNING = {
  playerRadius: 0.38,
  speed: { tiptoe: 2.1, walk: 3.8, run: 6.6 },
  stepInterval: { tiptoe: 0.55, walk: 0.42, run: 0.28 },
  noise: {
    step: { tiptoe: null, walk: [4.2, 4.5], run: [8.5, 11] },
    creak: { tiptoe: [2.6, 4], walk: [6, 13], run: [9, 22] },
    squeak: { tiptoe: [5, 10], walk: [8, 20], run: [10, 28] },
    door: { tiptoe: [2.4, 3], walk: [5.5, 10], run: [9, 20] },
    dance: [4, 4],
    alarm: [10, 30],
  },
  noiseFloor: 0.3,
  wake: { decayDelay: 1.8, decayRate: 5, stirring: 40, waking: 75, afterGrumble: 55 },
  shh: {
    cooldown: 10,
    bubbleRadius: 6,
    bubbleTime: 3,
    calmRadius: 10,
    calmAmount: 45,
    catRadius: 8,
    catNap: 4,
    poseTime: 0.9,
    freezeTime: 0.35,
  },
  detect: {
    rate: 90,
    decay: 40,
    alertTime: 3,
    modeFactor: { still: 0.8, tiptoe: 0.65, walk: 1, run: 1.5 },
  },
  // Grandpa's open eye (Attic boss)
  eye: { rateMul: 1.6, wakeHit: 45 },
  hideseek: { hideTime: 12, seekTime: 90, range: 6.5, fov: (70 * Math.PI) / 180, catchTime: 0.8, tagRadius: 0.9 },
  // Woken family members get up and chase you (wrapped in their blankets).
  chase: {
    speed: 3.0, // faster than tiptoe (2.1), slower than running (6.6)
    catchRadius: 0.8,
    searchTime: 4,
    stunTime: 2.5,
    backToSleepWake: 60,
    cryEvery: 1.6,
    cryNoise: [12, 6],
  },
  countdown: 3,
  bustFreeze: 1.2,
  emoteTime: 2.4,
  pickupRadius: 0.95,
  toyRadius: 0.55,
  toyRearm: 1.0,
  doorRadius: 1.4,
  creakRepeat: 0.9,
  hideRadius: 1.6,
};
