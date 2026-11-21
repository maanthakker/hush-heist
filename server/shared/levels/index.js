import { JUNGLE_ROOM } from './jungleRoom.js';
import { KITCHEN } from './kitchen.js';
import { GARAGE } from './garage.js';
import { ATTIC } from './attic.js';

export const LEVELS = [JUNGLE_ROOM, KITCHEN, GARAGE, ATTIC];
export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
export const levelsForMode = (mode) => (mode === 'race' ? LEVELS.filter((l) => l.raceGoal) : LEVELS);
export { JUNGLE_ROOM, KITCHEN, GARAGE, ATTIC };
