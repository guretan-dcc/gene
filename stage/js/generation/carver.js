// グリッドの初期化と、部屋・通路を彫る操作
import { cellKey } from '../core/grid.js';
import { ROOMS } from '../rooms/index.js';
import { CORRIDOR_HALF } from './roomPlan.js';

export function createEmptyGrid(W, D) {
  return Array.from({ length: D }, (_, z) =>
    Array.from({ length: W }, (_, x) => ({
      x, z,
      type: 'pit',     // 'pit' | 'floor' | 'elevated' | 'pillar'
      height: 0,       // 床の標高(層)。長いスロープ上は小数
      obstacleH: 0,    // 遮蔽物の層数
      thin: false,
      roomId: null,    // 所属する部屋（通路は null）
      chunkId: null,   // 描画区画（部屋または通路）。区画外は null
      spawn: 'none',   // 'none' | 'player' | 'melee' | 'ranged'
      trap: 'none',    // 'none' | 'jumppad' | 'fire' | 'spike' | 'conveyor'
      trapDir: { x: 0, z: -1 }
    }))
  );
}

function setFloor(cell, height) {
  cell.thin = false; // true は下が空いたスロープ板
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
      cell.thin = false;
      slopes.delete(cellKey(cell.x, cell.z));
    });
  }

  // rise の向きに上り下りするスロープを1マス置く
  function addSlope(cell, from, to, extra) {
    const lowH = Math.min(from, to);
    setFloor(cell, lowH);
    slopes.set(cellKey(cell.x, cell.z), {
      x: cell.x, z: cell.z, dirX: 0, dirZ: to > from ? -1 : 1, lowH, highH: Math.max(from, to), ...extra
    });
  }

  // 1段分の階段（見た目は段、歩行はスロープ扱い）
  function stairs(u0, u1, v, rise) {
    forEach(u0, u1, v, v, cell => addSlope(cell, room.height, room.height + rise, { stairs: true }));
  }

  // v0..v1 をかけて rise 層上り下りする、下が空いた長いスロープ
  function longRamp(u0, u1, v0, v1, rise) {
    const length = v1 - v0 + 1;
    const heightAt = i => room.height + (rise * i) / length;
    for (let i = 0; i < length; i++) {
      forEach(u0, u1, v0 + i, v0 + i, cell => {
        addSlope(cell, heightAt(i), heightAt(i + 1), { thin: true });
        cell.thin = true;
      });
    }
  }

  forEach(-hw, hw, 0, d - 1, cell => {
    cell.roomId = room.id;
    cell.chunkId = room.id;
  });
  ROOMS[room.layout].carve({ hw, d, rise: room.exitHeight - room.height }, { floor, pit, stairs, longRamp });

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
