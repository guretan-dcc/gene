// 自機スタート位置（最後端中央）を確実に確保
import { getPlayerCoord, isInGrid } from '../core/grid.js';

export function ensurePlayerStart(grid, { setFloorRect }) {
  const pCoord = getPlayerCoord();
  if (grid[pCoord.z][pCoord.x].type === 'pit') {
    setFloorRect(pCoord.x - 1, Math.max(0, pCoord.z - 2), pCoord.x + 1, pCoord.z, 0);
  }
  const playerH = grid[pCoord.z][pCoord.x].height;
  for (let dz = -1; dz <= 0; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = pCoord.x + dx;
      const nz = pCoord.z + dz;
      if (!isInGrid(nx, nz)) continue;
      if (grid[nz][nx].type === 'pillar') {
        grid[nz][nx].type = playerH > 0 ? 'elevated' : 'floor';
        grid[nz][nx].obstacleH = 0;
      }
    }
  }
  grid[pCoord.z][pCoord.x].type = playerH > 0 ? 'elevated' : 'floor';
  grid[pCoord.z][pCoord.x].obstacleH = 0;
  grid[pCoord.z][pCoord.x].spawn = 'player';
}
