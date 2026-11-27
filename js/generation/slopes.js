// 計画スロープの整合性チェックと補助スロープの追加
import { state, arena } from '../state.js';
import { isInGrid, isWalkable, cellKey } from '../core/grid.js';

export function generateSlopes(rng) {
  if (!state.autoSlopes) {
    arena.slopes = [];
    return;
  }

  const W = state.gridWidth;
  const D = state.gridDepth;
  const validSlopes = [];
  const used = new Set();

  // 計画済みスロープの整合性チェック
  for (const sl of arena.slopes) {
    if (!isInGrid(sl.x, sl.z)) continue;
    const c = arena.grid[sl.z][sl.x];
    if (!isWalkable(c) || c.spawn === 'player') continue;
    const key = cellKey(sl.x, sl.z);
    if (used.has(key)) continue;
    used.add(key);
    validSlopes.push(sl);
  }

  // 1段差があるのに近くにスロープが無い箇所へ補助スロープを追加
  const dirs = [
    { dx: 0, dz: -1 },
    { dx: 0, dz: 1 },
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 }
  ];

  for (let z = 1; z < D - 1; z++) {
    for (let x = 1; x < W - 1; x++) {
      const c = arena.grid[z][x];
      if (!isWalkable(c) || c.spawn === 'player') continue;
      if (used.has(cellKey(x, z))) continue;

      // 周囲2マス以内に既存スロープがあるなら重複追加しない
      let nearSlope = false;
      for (const s of validSlopes) {
        if (Math.abs(s.x - x) <= 2 && Math.abs(s.z - z) <= 2) {
          nearSlope = true;
          break;
        }
      }
      if (nearSlope) continue;

      for (const { dx, dz } of dirs) {
        const hx = x + dx;
        const hz = z + dz;
        const lx = x - dx;
        const lz = z - dz;
        if (!isInGrid(hx, hz) || !isInGrid(lx, lz)) continue;

        const highCell = arena.grid[hz][hx];
        const lowCell = arena.grid[lz][lx];
        if (!isWalkable(highCell) || !isWalkable(lowCell)) continue;

        if (highCell.height === c.height + 1 && lowCell.height === c.height) {
          if (rng() < 0.35) {
            validSlopes.push({ x, z, dirX: dx, dirZ: dz, lowH: c.height, highH: c.height + 1 });
            used.add(cellKey(x, z));
          }
          break;
        }
      }
    }
  }

  arena.slopes = validSlopes;
}
