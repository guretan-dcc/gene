// 戦闘部屋の遮蔽物（左右対称）。外周2マスと遮蔽物同士の間隔1マスを空けて通行路を残す
import { state, arena } from '../state.js';
import { isCombatRoom } from '../core/grid.js';

const EDGE_MARGIN = 2;

export function placeCoverBlocks(rng) {
  arena.rooms.filter(isCombatRoom).forEach(room => placeInRoom(room, rng));
}

function placeInRoom(room, rng) {
  const bs = state.coverBlockSize;
  const minX = room.x0 + EDGE_MARGIN;
  const maxX = room.x1 - EDGE_MARGIN - bs + 1;
  const maxZ = room.z1 - EDGE_MARGIN - bs + 1;
  const centerX = (room.x0 + room.x1 - bs + 1) / 2;

  // ブロック本体と周囲1マスに他の遮蔽物が無いか
  function canPlace(bx, bz) {
    for (let z = bz - 1; z <= bz + bs; z++) {
      for (let x = bx - 1; x <= bx + bs; x++) {
        if (arena.grid[z][x].type === 'pillar') return false;
      }
    }
    return true;
  }

  function fill(bx, bz, obstacleH) {
    for (let z = bz; z < bz + bs; z++) {
      for (let x = bx; x < bx + bs; x++) {
        const cell = arena.grid[z][x];
        cell.type = obstacleH > 0 ? 'pillar' : (cell.height > 0 ? 'elevated' : 'floor');
        cell.obstacleH = obstacleH;
      }
    }
  }

  for (let z = room.z0 + EDGE_MARGIN; z <= maxZ; z++) {
    for (let x = minX; x <= Math.min(maxX, Math.floor(centerX)); x++) {
      if (rng() >= state.coverDensity || !canPlace(x, z)) continue;
      const obstacleH = 1 + Math.floor(rng() * state.wallHeight);
      const mirrorX = room.x0 + room.x1 - x - bs + 1;
      fill(x, z, obstacleH);
      if (mirrorX === x) continue;
      if (canPlace(mirrorX, z)) fill(mirrorX, z, obstacleH);
      else fill(x, z, 0); // 対称に置けない場合は取り消す
    }
  }
}
