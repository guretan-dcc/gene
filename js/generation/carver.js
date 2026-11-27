// グリッドの初期化と、部屋・通路を彫る操作
import { cellKey } from '../core/grid.js';
import { LAYOUTS } from './layouts.js';
import { CORRIDOR_HALF } from './roomPlan.js';

export function createEmptyGrid(W, D) {
  return Array.from({ length: D }, (_, z) =>
    Array.from({ length: W }, (_, x) => ({
      x, z,
      type: 'pit',     // 'pit' | 'floor' | 'elevated' | 'pillar'
      height: 0,       // 0..3 (床の標高)
      obstacleH: 0,    // 遮蔽物の層数
      roomId: null,    // 所属する部屋（通路は null）
      chunkId: null,   // 描画区画（部屋または通路）。区画外は null
      spawn: 'none',   // 'none' | 'player' | 'melee' | 'ranged'
      trap: 'none',    // 'none' | 'jumppad' | 'fire' | 'spike' | 'conveyor'
      trapDir: { x: 0, z: -1 }
    }))
  );
}

function setFloor(cell, height) {
  cell.type = height > 0 ? 'elevated' : 'floor';
  cell.height = height;
}

// 部屋を彫る。追加したスロープを返す
export function carveRoom(grid, room) {
  const slopes = new Map();
  const hw = room.half;
  const d = room.depth;

  function forEach(u0, u1, v0, v1, callback) {
    for (let v = Math.max(0, v0); v <= Math.min(d - 1, v1); v++) {
      for (let u = Math.max(-hw, Math.min(u0, u1)); u <= Math.min(hw, Math.max(u0, u1)); u++) {
        callback(grid[room.z1 - v][room.centerX + u]);
      }
    }
  }

  // lift は入口の高さからの段数
  function floor(u0, u1, v0, v1, lift = 0) {
    forEach(u0, u1, v0, v1, cell => {
      setFloor(cell, room.height + lift);
      slopes.delete(cellKey(cell.x, cell.z));
    });
  }

  function pit(u0, u1, v0, v1) {
    forEach(u0, u1, v0, v1, cell => {
      cell.type = 'pit';
      cell.height = 0;
      slopes.delete(cellKey(cell.x, cell.z));
    });
  }

  function addSlope(cell, dirX, dirZ, lowH) {
    setFloor(cell, lowH);
    slopes.set(cellKey(cell.x, cell.z), { x: cell.x, z: cell.z, dirX, dirZ, lowH, highH: lowH + 1 });
  }

  // 奥行き方向の1段スロープ。toward は上る向き ('far' | 'near')
  function ramp(u0, u1, v, toward) {
    forEach(u0, u1, v, v, cell => addSlope(cell, 0, toward === 'far' ? -1 : 1, room.height));
  }

  // 左右方向の1段スロープ。dirX は上る向き
  function sideRamp(u, v0, v1, dirX) {
    forEach(u, u, v0, v1, cell => addSlope(cell, dirX, 0, room.height));
  }

  forEach(-hw, hw, 0, d - 1, cell => {
    cell.roomId = room.id;
    cell.chunkId = room.id;
  });
  LAYOUTS[room.layout]({ hw, d, mid: Math.floor((d - 3) / 2) }, { floor, pit, ramp, sideRamp });
  applyExitStep();

  // 出口の高さが違う場合は、奥3行をまとめて上げ下げしてスロープでつなぐ
  function applyExitStep() {
    const rise = room.exitHeight - room.height;
    if (rise === 0) return;
    floor(-hw, hw, d - 3, d - 1, rise);
    forEach(-hw, hw, d - 4, d - 4, cell => {
      if (cell.type !== 'pit') addSlope(cell, 0, rise > 0 ? -1 : 1, Math.min(room.height, room.exitHeight));
    });
  }

  return [...slopes.values()];
}

// 手前の部屋(from)の出口から奥の部屋(to)の入口まで、途中で横に折れる通路
export function carveCorridor(grid, chunkId, from, to) {
  const near = from.z0 - 1;
  const fill = (xa, xb, za, zb) => {
    for (let z = za; z <= zb; z++) {
      for (let x = Math.min(xa, xb) - CORRIDOR_HALF; x <= Math.max(xa, xb) + CORRIDOR_HALF; x++) {
        setFloor(grid[z][x], to.height);
        grid[z][x].chunkId = chunkId;
      }
    }
  };
  fill(from.centerX, from.centerX, near - 1, near);
  fill(from.centerX, to.centerX, near - 4, near - 2);
  fill(to.centerX, to.centerX, near - 6, near - 5);
}
