// Checks for player-made levels.
import { validateCustomLevel, emptyLevel, buildCustomLevel, levelName } from '../shared/custom.js';
import { Simulation } from '../shared/sim/Simulation.js';

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures += 1;
};
const base = emptyLevel('s', 'kitchen');
check(!validateCustomLevel(base).ok, 'an empty level is not playable yet');
const lvl = {
  ...base,
  name: [3, 1, 0],
  required: 2,
  start: [2, 15],
  exit: [2, 15],
  walls: [[10, 0], [10, 1], [10, 2], [10, 3], [10, 4], [10, 5], [10, 6], [10, 7], [10, 8], [10, 9]],
  snacks: [[5, 5], [15, 3], [20, 14]],
  stash: [18, 9],
  sleepers: [{ k: 'dad', x: 14, z: 12, r: 0 }],
  furniture: [{ k: 'closet', x: 4, z: 9, r: 0 }, { k: 'sofa', x: 13, z: 12, r: 0 }, { k: 'diningTable', x: 16, z: 3, r: 1 }],
  patrollers: [{ k: 'cat', path: [[6, 16], [20, 16]] }],
  creaks: [[3, 12]],
  toys: [[8, 13]],
};
const v = validateCustomLevel(lvl);
check(v.ok, `a sensible level passes (${v.errors.join(' ') || 'no problems'})`);
check(levelName(lvl.name) === 'Midnight Kitchen Heist', 'level names come from the word lists');
check(v.level.walls.length === 5, `wall cells merge into boxes (${v.level.walls.length} boxes)`);
check(v.level.hideSpots.length >= 2, `closets and tables become hiding spots (${v.level.hideSpots.length})`);
const sim = new Simulation(v.level);
for (const s of sim.snacks) {
  sim.player.x = s.x;
  sim.player.z = s.z;
  sim.update(1 / 60, { mx: 0, mz: 0 });
}
sim.player.x = v.level.start.x;
sim.player.z = v.level.start.z;
sim.update(1 / 60, { mx: 0, mz: 0 });
check(sim.outcome?.result === 'escaped', 'a player-made level is playable in the real game engine');
const walled = { ...lvl, walls: [...lvl.walls, ...[...Array(18).keys()].map((z) => [12, z])] };
check(!validateCustomLevel(walled).ok, 'a level with snacks sealed behind a wall is rejected');
const overlap = { ...lvl, furniture: [...lvl.furniture, { k: 'car', x: 3, z: 9, r: 0 }] };
check(validateCustomLevel(overlap).errors.some((e) => /overlaps/.test(e)), 'overlapping furniture is caught');
const badPath = { ...lvl, patrollers: [{ k: 'vacuum', path: [[5, 3], [15, 3]] }] };
check(validateCustomLevel(badPath).errors.some((e) => /route/.test(e)), 'a patrol route through a wall is caught');
const evil = { ...lvl, walls: [[999, 2], 'x'], furniture: [{ k: '<script>', x: 1, z: 1 }], name: [99, -1, 'a'], size: 'huge' };
const clean = validateCustomLevel(evil);
check(clean.data.walls.length === 0 && clean.data.furniture.length === 0 && levelName(clean.data.name) === 'Sneaky Hallway Heist', 'junk data is cleaned up');
check(buildCustomLevel(lvl, { id: 'abc' }).id === 'custom:abc', 'online levels get their own id');
console.log(failures ? `\n${failures} check(s) failed` : '\nAll custom level checks passed');
process.exit(failures ? 1 : 0);
