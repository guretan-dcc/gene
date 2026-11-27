// グリッドの初期化と、部屋・通路・スロープを彫る操作
import { CORRIDOR_HALF } from './roomGraph.js';

export function createEmptyGrid(W, D) {
  return Array.from({ length: D }, (_, z) =>
    Array.from({ length: W }, (_, x) => ({
      x, z,
      type: 'pit',     // 'pit' | 'floor' | 'elevated' | 'pillar'
      height: 0,       // 0..3 (床の標高)
      obstacleH: 0,    // 遮蔽物の層数
      roomId: null,    // 所属する部屋（通路は null）
      spawn: 'none',   // 'none' | 'player' | 'melee' | 'ranged'
      trap: 'none',    // 'none' | 'jumppad' | 'fire' | 'spike' | 'conveyor'
      trapDir: { x: 0, z: -1 }
    }))
  );
}

function setFloor(cell, height, roomId = null) {
  cell.type = height > 0 ? 'elevated' : 'floor';
  cell.height = height;
  cell.roomId = roomId;
}

export function carveRoom(grid, room) {
  for (let z = room.z0; z <= room.z1; z++) {
    for (let x = room.x0; x <= room.x1; x++) {
      setFloor(grid[z][x], room.height, room.id);
    }
  }
}

// 手前の部屋(from)から奥の部屋(to)への通路。段差は途中のスロープでつなぐ。追加したスロープを返す
export function carveCorridor(grid, link, from, to) {
  const slopes = [];
  const rise = to.height - from.height;
  const steps = Math.abs(rise);
  const zNear = from.z0 - 1;
  const zFar = to.z1 + 1;
  const rampStart = zNear - 1; // 両端に平らな踊り場を残す

  for (let z = zNear; z >= zFar; z--) {
    const s = rampStart - z; // スロープ何段目か
    const onRamp = s >= 0 && s < steps;
    let height = s < 0 ? from.height : to.height;
    if (onRamp) height = rise > 0 ? from.height + s : from.height - s - 1;

    for (let x = link.x - CORRIDOR_HALF; x <= link.x + CORRIDOR_HALF; x++) {
      setFloor(grid[z][x], height);
      if (onRamp) {
        slopes.push({ x, z, dirX: 0, dirZ: rise > 0 ? -1 : 1, lowH: height, highH: height + 1 });
      }
    }
  }
  return slopes;
}
