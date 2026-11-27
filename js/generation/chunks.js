// 区画（部屋と通路）の分割と、各区画にいるとき描画が必要な区画の一覧（ゲーム側の表示切替用）
import { arena } from '../state.js';
import { CORRIDOR_HALF } from './roomGraph.js';

// 区画ID: 0..部屋数-1 が部屋、それ以降が通路（部屋数 + 扉ID）
export function buildChunks() {
  const { grid, rooms, doors } = arena;

  for (const room of rooms) {
    forEachCell(room.x0, room.x1, room.z0, room.z1, cell => { cell.chunkId = room.id; });
  }
  for (const door of doors) {
    const from = rooms[door.from];
    forEachCell(door.x - CORRIDOR_HALF, door.x + CORRIDOR_HALF, door.z, from.z0 - 1, cell => {
      cell.chunkId = rooms.length + door.id;
    });
  }

  const chunks = [
    ...rooms.map(r => ({ id: r.id, kind: 'room', roomId: r.id, doorId: null })),
    ...doors.map(d => ({ id: rooms.length + d.id, kind: 'corridor', roomId: null, doorId: d.id }))
  ];
  for (const chunk of chunks) chunk.visible = getVisibleIds(chunk);
  arena.chunks = chunks;

  function forEachCell(x0, x1, z0, z1, callback) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) callback(grid[z][x]);
    }
  }
}

// 部屋にいるとき: 自室＋つながる通路と部屋 / 通路にいるとき: 両端の部屋と、そこに接する通路
function getVisibleIds(chunk) {
  const { rooms, doors } = arena;
  const ids = new Set([chunk.id]);
  if (chunk.kind === 'room') {
    for (const d of doors) {
      if (d.from !== chunk.roomId && d.to !== chunk.roomId) continue;
      ids.add(rooms.length + d.id).add(d.from).add(d.to);
    }
  } else {
    const { from, to } = doors[chunk.doorId];
    ids.add(from).add(to);
    for (const d of doors) {
      if ([d.from, d.to].some(r => r === from || r === to)) ids.add(rooms.length + d.id);
    }
  }
  return [...ids].sort((a, b) => a - b);
}
