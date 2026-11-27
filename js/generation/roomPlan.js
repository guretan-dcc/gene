// 一本道の部屋の並び（入口 → 戦闘部屋 → … → ボス部屋）と寸法
import { state } from '../state.js';
import { shuffle } from '../core/random.js';
import { COMBAT_LAYOUTS } from './layouts.js';

export const CORRIDOR_HALF = 1;   // 通路の半幅（幅3マス）
export const CORRIDOR_LENGTH = 7; // 手前の直線2 + 横移動3 + 奥の直線2
const MAX_ROOM_HEIGHT = 2;        // 部屋内の高台(+1層)を含めて3層まで

export function createRoomPlan(rng) {
  const count = state.roomCount;
  const baseHalf = Math.floor(state.roomSize / 2);
  const rooms = [];
  let height = 0;
  let centerX = 0;
  let layoutQueue = [];

  for (let id = 0; id < count; id++) {
    const type = id === 0 ? 'start' : (id === count - 1 ? 'boss' : 'combat');
    // 全種類を一巡するまで同じ地形を繰り返さない
    if (type === 'combat' && layoutQueue.length === 0) {
      layoutQueue = shuffle(Object.keys(COMBAT_LAYOUTS), rng);
    }
    const layout = type === 'combat' ? layoutQueue.pop() : type;

    const half = type === 'boss' ? baseHalf + 2 : (type === 'start' ? 4 : baseHalf);
    let depth = state.roomSize + 4 + Math.floor(rng() * 5);
    if (type === 'start') depth = 9;
    if (type === 'boss') depth = state.roomSize + 8;

    // 出口の標高（次の部屋の入口と同じ高さ）
    let exitHeight = height;
    if (state.heightVariation && type !== 'boss') {
      const rise = rng() < 0.5 ? 1 : -1;
      exitHeight = height + rise;
      if (exitHeight < 0 || exitHeight > MAX_ROOM_HEIGHT) exitHeight = height - rise;
    }

    // 部屋を左右にずらして通路を折り曲げる
    if (id > 0) {
      const shift = 3 + Math.floor(rng() * (baseHalf - 1));
      centerX += rng() < 0.5 ? -shift : shift;
    }

    rooms.push({ id, type, layout, half, depth, centerX, height, exitHeight });
    height = exitHeight;
  }

  return placeRooms(rooms);
}

// グリッドに収まるように座標を確定する
function placeRooms(rooms) {
  const minX = Math.min(...rooms.map(r => r.centerX - r.half));
  const maxX = Math.max(...rooms.map(r => r.centerX + r.half));
  const width = maxX - minX + 3;
  const totalDepth = rooms.reduce((sum, r) => sum + r.depth, 0) + (rooms.length - 1) * CORRIDOR_LENGTH;

  let nearZ = totalDepth - 1;
  for (const room of rooms) {
    room.centerX += 1 - minX;
    room.x0 = room.centerX - room.half;
    room.x1 = room.centerX + room.half;
    room.z1 = nearZ;
    room.z0 = nearZ - room.depth + 1;
    nearZ = room.z0 - 1 - CORRIDOR_LENGTH;
  }
  return { rooms, width, depth: totalDepth };
}
