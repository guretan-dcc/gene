// 区画の配色
import { arena } from '../state.js';
import { ROOMS, CORRIDOR_STYLE } from '../rooms/index.js';

export function getChunkStyle(chunkId) {
  const { kind, roomId } = arena.chunks[chunkId];
  return kind === 'room' ? ROOMS[arena.rooms[roomId].layout].style : CORRIDOR_STYLE;
}
