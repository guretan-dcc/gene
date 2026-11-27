// 敵スポーン自動配置（戦闘部屋とボス部屋のみ）
import { state, arena } from '../state.js';
import { shuffle } from '../core/random.js';
import { isCombatRoom, isWalkable } from '../core/grid.js';

export function assignEnemySpawns(rng) {
  for (const row of arena.grid) {
    for (const cell of row) {
      if (cell.spawn !== 'player') cell.spawn = 'none';
    }
  }
  arena.rooms.filter(isCombatRoom).forEach(room => spawnInRoom(room, rng));
}

function spawnInRoom(room, rng) {
  const candidates = [];
  // 入口側の3行には配置しない（扉を抜けた直後の安全地帯）
  for (let z = room.z0; z <= room.z1 - 3; z++) {
    for (let x = room.x0; x <= room.x1; x++) {
      const cell = arena.grid[z][x];
      if (isWalkable(cell)) candidates.push(cell);
    }
  }
  shuffle(candidates, rng);

  const wanted = room.type === 'boss' ? Math.ceil(state.enemiesPerRoom * 1.5) : state.enemiesPerRoom;
  for (const cell of candidates.slice(0, wanted)) {
    // 奥や左右の端は遠距離、それ以外は近接を主体にする
    const isBackOrEdge = cell.z <= room.z0 + 1 || cell.x <= room.x0 + 1 || cell.x >= room.x1 - 1;
    cell.spawn = rng() < (isBackOrEdge ? 0.65 : 0.2) ? 'ranged' : 'melee';
  }
}
