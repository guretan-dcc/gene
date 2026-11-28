// 一本道の部屋の並び（入口 → 戦闘部屋 → … → ボス部屋）と寸法
import { state } from '../state.js';
import { shuffle } from '../core/random.js';
import { ROOMS, COMBAT_ROOM_IDS } from '../rooms/index.js';

export const CORRIDOR_HALF = 1;   // 通路の半幅（幅3マス）
export const CORRIDOR_LENGTH = 7; // 手前の直線2 + 横移動3 + 奥の直線2
const BOSS_ROOM_ID = 'arena';

// 並べる部屋の { type, layout }。1部屋表示のときはその部屋だけ
function createSequence(rng) {
  if (state.previewRoom !== 'all') return [{ type: 'combat', layout: state.previewRoom }];

  const sequence = [{ type: 'start', layout: 'start' }];
  let queue = [];
  while (sequence.length < state.roomCount - 1) {
    // 全種類を一巡するまで同じ部屋を繰り返さない
    if (queue.length === 0) queue = shuffle([...COMBAT_ROOM_IDS], rng);
    sequence.push({ type: 'combat', layout: queue.pop() });
  }
  sequence.push({ type: 'boss', layout: BOSS_ROOM_ID });
  return sequence;
}

export function createRoomPlan(rng) {
  let height = 0;
  let centerX = 0;

  const rooms = createSequence(rng).map(({ type, layout }, id) => {
    const def = ROOMS[layout];
    const { half, depth } = def.size(state.roomSize);
    const exitHeight = height + def.rise(height);

    // 部屋を左右にずらして通路を折り曲げる
    if (id > 0) {
      const shift = 3 + Math.floor(rng() * 5);
      centerX += rng() < 0.5 ? -shift : shift;
    }

    const room = { id, type, layout, half, depth, centerX, height, exitHeight };
    height = exitHeight;
    return room;
  });

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
