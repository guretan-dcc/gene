// 戦闘部屋の遮蔽物（左右対称）。出入口付近を空け、歩ける場所が分断されない位置にだけ置く
import { state, arena } from '../state.js';
import { isCombatRoom, isWalkable, canTraverse, cellKey, toCellKeySet } from '../core/grid.js';

export function placeCoverBlocks(rng) {
  const slopeKeys = toCellKeySet(arena.slopes);
  arena.rooms.filter(isCombatRoom).forEach(room => placeInRoom(room, rng, slopeKeys));
}

function placeInRoom(room, rng, slopeKeys) {
  const bs = state.coverBlockSize;
  const centerX = (room.x0 + room.x1 - bs + 1) / 2;

  // 同じ高さの平らな床で、周囲1マスにスロープや遮蔽物が無いか
  function canPlace(bx, bz) {
    const height = arena.grid[bz][bx].height;
    for (let z = bz - 1; z <= bz + bs; z++) {
      for (let x = bx - 1; x <= bx + bs; x++) {
        const cell = arena.grid[z][x];
        const inside = x >= bx && x < bx + bs && z >= bz && z < bz + bs;
        if (cell.type === 'pillar' || slopeKeys.has(cellKey(x, z))) return false;
        if (inside && (cell.type === 'pit' || cell.height !== height)) return false;
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

  // 置けたら true。通路を塞ぐ場合は取り消す
  function tryPlace(bx, bz, obstacleH) {
    if (!canPlace(bx, bz)) return false;
    fill(bx, bz, obstacleH);
    if (isRoomConnected(room, slopeKeys)) return true;
    fill(bx, bz, 0);
    return false;
  }

  for (let z = room.z0 + 5; z <= room.z1 - 3 - bs; z++) {
    for (let x = room.x0 + 1; x <= Math.floor(centerX); x++) {
      if (rng() >= state.coverDensity) continue;
      const obstacleH = 1 + Math.floor(rng() * state.wallHeight);
      if (!tryPlace(x, z, obstacleH)) continue;
      const mirrorX = room.x0 + room.x1 - x - bs + 1;
      if (mirrorX !== x && !tryPlace(mirrorX, z, obstacleH)) fill(x, z, 0);
    }
  }
}

// 部屋内の歩けるセルがすべて入口からつながっているか
function isRoomConnected(room, slopeKeys) {
  const slopes = new Map(arena.slopes.filter(s => slopeKeys.has(cellKey(s.x, s.z))).map(s => [cellKey(s.x, s.z), s]));
  const start = arena.grid[room.z1][room.centerX];
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cell = queue.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = arena.grid[cell.z + dz]?.[cell.x + dx];
      if (!next || next.roomId !== room.id || seen.has(next) || !canTraverse(cell, next, slopes)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  let total = 0;
  for (let z = room.z0; z <= room.z1; z++) {
    for (let x = room.x0; x <= room.x1; x++) {
      if (isWalkable(arena.grid[z][x])) total++;
    }
  }
  return seen.size === total;
}
