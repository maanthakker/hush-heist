// Level 1: The Jungle Room.
// Coordinates are world units on the floor: x grows to the right of the screen,
// z grows toward the camera. North (negative z) is the far wall with the windows.
import { box, at } from './helpers.js';

export const JUNGLE_ROOM = {
  id: 'jungle-room',
  number: 1,
  name: 'The Jungle Room',
  intro: 'Grab at least 4 snacks, then sneak back to your bed.',
  theme: { floor: 'wood', wall: 'palm', sky: '#151938' },
  exitName: 'your bed',
  creakWord: 'creak',
  spawns: [
    [-14.8, -8.2],
    [-15.8, -7.0],
    [-13.6, -6.8],
    [-16.4, -8.6],
  ],
  guardSpawn: [-17.5, -9.8],
  bounds: box(-20, 20, -14, 14),
  start: { x: -14.8, z: -8.2, facing: Math.PI / 2 },
  exitZone: box(-19.8, -14.2, -13.8, -9.0),
  snacksRequired: 4,
  parTime: 40, // seconds, for the third star

  walls: [
    box(-20.4, 20.4, -14.4, -14.0, { id: 'north', h: 3.0 }),
    box(-20.4, 20.4, 14.0, 14.4, { id: 'south', h: 0.6 }),
    box(-20.4, -20.0, -14.0, 14.0, { id: 'west', h: 3.0 }),
    box(20.0, 20.4, -14.0, 14.0, { id: 'east', h: 3.0 }),
    box(-11.2, -10.8, -14.0, -9.2, { id: 'bedroom-east-a', h: 2.4 }),
    box(-11.2, -10.8, -7.2, -3.8, { id: 'bedroom-east-b', h: 2.4 }),
    box(-20.0, -10.8, -4.2, -3.8, { id: 'bedroom-south', h: 2.4, fadeable: true }),
    box(-11.2, -10.8, 6.0, 14.0, { id: 'den-wall', h: 2.4 }),
  ],

  // Doors creak when you pass through them. Hinge is at the minZ end of the gap.
  doors: [{ id: 'bedroom-door', x: -11.0, z: -8.2, width: 2.0 }],

  // Everything here blocks movement. blocksSight = patrollers can't see through it.
  furniture: [
    box(-19.8, -16.6, -13.8, -10.4, { id: 'bed', type: 'bed' }),
    box(-14.2, -11.6, -13.8, -12.8, { id: 'desk', type: 'desk' }),
    at(-19.3, -4.9, 1.0, 1.0, { id: 'palm-bedroom', type: 'palm' }),

    box(-4.5, 1.5, -2.2, -0.6, { id: 'sofa', type: 'sofa' }),
    box(-3.2, 0.2, 1.0, 2.4, { id: 'coffee-table', type: 'coffeeTable' }),
    box(3.0, 4.4, 0.6, 2.0, { id: 'armchair', type: 'armchair', face: 'w' }),
    box(2.0, 2.8, -2.0, -1.2, { id: 'side-table', type: 'sideTable' }),
    at(-5.8, -1.6, 0.8, 0.8, { id: 'palm-sofa', type: 'palm' }),
    at(-9.1, -13.1, 1.0, 1.0, { id: 'palm-window', type: 'palm' }),
    at(17.1, 12.1, 1.0, 1.0, { id: 'palm-corner', type: 'palm' }),
    at(4.9, 12.7, 1.0, 1.0, { id: 'palm-south', type: 'palm' }),
    at(-9.8, 11.0, 0.8, 0.8, { id: 'palm-den', type: 'palm' }),

    box(9.0, 14.0, 3.0, 6.0, { id: 'dining-table', type: 'diningTable' }),
    box(8.2, 8.9, 4.1, 4.9, { id: 'chair-w', type: 'chair', face: 'e' }),
    box(14.1, 14.8, 4.1, 4.9, { id: 'chair-e', type: 'chair', face: 'w' }),
    box(10.0, 10.8, 2.2, 2.9, { id: 'chair-n1', type: 'chair', face: 's' }),
    box(12.2, 13.0, 2.2, 2.9, { id: 'chair-n2', type: 'chair', face: 's' }),
    box(10.0, 10.8, 6.1, 6.8, { id: 'chair-s1', type: 'chair', face: 'n' }),
    box(12.2, 13.0, 6.1, 6.8, { id: 'chair-s2', type: 'chair', face: 'n' }),

    box(14.6, 17.6, -12.6, -10.6, { id: 'crib', type: 'crib' }),
    box(19.2, 20.0, 5.0, 9.0, { id: 'bookshelf', type: 'bookshelf', blocksSight: true }),
    box(18.6, 20.0, -4.0, -1.2, { id: 'closet-east', type: 'closet', face: 'w', blocksSight: true }),
    box(-20.0, -17.4, 11.6, 14.0, { id: 'closet-den', type: 'closet', face: 'n', blocksSight: true }),
    at(-15.5, 5.5, 2.2, 2.2, { id: 'beanbag', type: 'beanbag' }),
  ],

  // Purely visual floor decoration.
  rugs: [
    { x: -15.0, z: -8.0, r: 2.2, color: '#2c3672', round: true },
    { x: -1.5, z: 1.6, w: 7.5, d: 4.6, color: '#7a3a2f' },
    { x: -15.2, z: 6.0, w: 6, d: 5, color: '#2d5a57' },
  ],

  windows: [
    { x: -5, w: 2.4 },
    { x: 4, w: 2.4 },
    { x: 13, w: 2.4 },
  ],
  chandelier: { x: -1.5, z: 0.4 },
  nightlight: { x: -16.2, z: -13.5 },

  creaks: [
    at(-9.6, -8.2, 1.4, 2.0, { id: 'creak-door' }),
    at(6.0, 0.5, 1.4, 2.4, { id: 'creak-mid' }),
    at(-1.5, 5.6, 2.4, 1.2, { id: 'creak-rug' }),
    at(12.6, -7.8, 1.6, 1.6, { id: 'creak-crib' }),
    at(-13.6, 2.4, 1.6, 1.6, { id: 'creak-den' }),
    at(16.4, 9.6, 2.0, 1.4, { id: 'creak-corner' }),
    at(-6.8, -6.0, 1.4, 1.4, { id: 'creak-hall' }),
  ],

  toys: [
    { id: 'toy-1', kind: 'bone', x: -7.0, z: 3.2 },
    { id: 'toy-2', kind: 'ball', x: 6.4, z: -5.6 },
    { id: 'toy-3', kind: 'bone', x: -12.2, z: 4.0 },
    { id: 'toy-4', kind: 'ball', x: 15.6, z: -5.4 },
    { id: 'toy-5', kind: 'bone', x: 2.6, z: 8.8 },
    { id: 'toy-6', kind: 'ball', x: 8.6, z: -11.6 },
  ],

  // x/z = where you stand to use it, hideX/hideZ = where you end up,
  // peek = where your eyes peek out from (purely visual).
  hideSpots: [
    { id: 'curtain-west', type: 'curtain', x: -7.4, z: -12.5, hideX: -7.4, hideZ: -13.6, peek: [-7.4, 1.35, -13.2], label: 'Hide behind the curtain' },
    { id: 'curtain-east', type: 'curtain', x: 8.0, z: -12.5, hideX: 8.0, hideZ: -13.6, peek: [8.0, 1.35, -13.2], label: 'Hide behind the curtain' },
    { id: 'under-coffee', type: 'table', x: -1.5, z: 3.2, hideX: -1.5, hideZ: 1.7, peek: [-1.5, 0.3, 2.45], label: 'Slide under the coffee table' },
    { id: 'under-dining', type: 'table', x: 11.5, z: 7.5, hideX: 11.5, hideZ: 4.5, peek: [11.5, 0.33, 6.02], label: 'Slide under the dining table' },
    { id: 'closet-east', type: 'closet', x: 17.8, z: -2.6, hideX: 19.3, hideZ: -2.6, peek: [18.52, 1.5, -2.6], label: 'Squeeze into the closet' },
    { id: 'closet-den', type: 'closet', x: -18.7, z: 10.8, hideX: -18.7, hideZ: 12.8, peek: [-18.7, 1.5, 11.52], label: 'Squeeze into the closet' },
  ],

  snacks: [
    { id: 'choco', kind: 'choco', name: 'Choco bar', x: 3.4, z: -0.6 },
    { id: 'chips', kind: 'chips', name: 'Chips', x: 11.5, z: 8.2 },
    { id: 'juice', kind: 'juice', name: 'Juice box', x: 12.6, z: -11.4 },
    { id: 'donut', kind: 'donut', name: 'Donut', x: -13.0, z: 8.8 },
    { id: 'popcorn', kind: 'popcorn', name: 'Popcorn', x: 17.6, z: 0.8 },
    { id: 'cookie', kind: 'cookie', name: 'Cookie', x: 2.6, z: -12.8 },
  ],

  // sens = how easily they wake (1 = normal). rot turns the sleeper (head points +x at 0).
  sleepers: [
    { id: 'dad', name: 'Dad', x: -1.5, z: -1.4, rot: 0, y: 0.5, sens: 0.7, scale: 1, look: 'dad' },
    { id: 'sis', name: 'Big Sis', x: -15.5, z: 5.5, rot: 0.6, y: 0.42, sens: 1.0, scale: 0.85, look: 'sis' },
    { id: 'baby', name: 'Baby', x: 16.1, z: -11.6, rot: Math.PI, y: 0.48, sens: 1.5, scale: 0.5, look: 'baby' },
  ],

  patrollers: [
    {
      id: 'cat',
      type: 'cat',
      name: 'Mochi the cat',
      speed: 1.1,
      turnRate: 3.5,
      range: 4.5,
      fov: (80 * Math.PI) / 180,
      napChance: 0.45,
      path: [
        [-7.5, 0.5],
        [-13.0, 0.5],
        [-13.0, 9.0],
        [-12.0, 4.5],
        [-6.0, 4.5],
      ],
    },
    {
      id: 'vacuum',
      type: 'vacuum',
      name: 'Dusty the robot vacuum',
      speed: 1.7,
      turnRate: 2.2,
      range: 6.0,
      fov: (55 * Math.PI) / 180,
      napChance: 0,
      path: [
        [5.0, -8.5],
        [17.0, -8.5],
        [17.0, 10.5],
        [5.0, 10.5],
      ],
    },
  ],
};
