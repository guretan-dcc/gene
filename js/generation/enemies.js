// 敵スポーン自動配置
import { state, arena } from '../state.js';
import { shuffle } from '../core/random.js';
import { getPlayerCoord, isWalkable, cellKey, toCellKeySet, getWaveForRow } from '../core/grid.js';

export function assignEnemySpawns(rng) {
  const W = state.gridWidth;
  const D = state.gridDepth;
  const pCoord = getPlayerCoord();
  const slopeSet = toCellKeySet(arena.slopes);

  const candidates = [];
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const c = arena.grid[z][x];
      if (c.spawn !== 'player') {
        c.spawn = 'none';
        c.wave = 0;
      }
      if (!isWalkable(c) || c.spawn === 'player') continue;
      if (slopeSet.has(cellKey(x, z))) continue;

      const dist = Math.hypot(x - pCoord.x, z - pCoord.z);
      if (dist >= state.safeRadius) {
        candidates.push(c);
      }
    }
  }

  shuffle(candidates, rng);

  const targetCount = Math.min(state.enemyCount, candidates.length);
  for (let i = 0; i < targetCount; i++) {
    const cell = candidates[i];
    const isHighOrFar = cell.height >= 1 || cell.z <= Math.floor(D * 0.25) || cell.x <= 1 || cell.x >= W - 2;

    // 高台や奥・端寄りは遠距離ロールを優先し、平地は近接ロールを主体に配置
    if (isHighOrFar && rng() < 0.65) {
      cell.spawn = 'ranged';
    } else if (!isHighOrFar && rng() < 0.20) {
      cell.spawn = 'ranged';
    } else {
      cell.spawn = 'melee';
    }

    cell.wave = getWaveForRow(cell.z);
  }
}
