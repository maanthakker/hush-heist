export const box = (minX, maxX, minZ, maxZ, extra = {}) => ({ minX, maxX, minZ, maxZ, ...extra });
export const at = (x, z, w, d, extra = {}) => box(x - w / 2, x + w / 2, z - d / 2, z + d / 2, extra);
export const deg = (d) => (d * Math.PI) / 180;
export function outerWalls(minX, maxX, minZ, maxZ, h = 3) {
  return [
    box(minX - 0.4, maxX + 0.4, minZ - 0.4, minZ, { id: 'north', h }),
    box(minX - 0.4, maxX + 0.4, maxZ, maxZ + 0.4, { id: 'south', h: 0.6 }),
    box(minX - 0.4, minX, minZ, maxZ, { id: 'west', h }),
    box(maxX, maxX + 0.4, minZ, maxZ, { id: 'east', h }),
  ];
}
