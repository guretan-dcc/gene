// 区画の壁の上端（部屋は一番高い床＋壁の高さ、通路は床＋扉の高さ）
import { state, arena } from '../state.js';
import { DOOR_HEIGHT } from '../config/constants.js';
import { getLayerHeight } from '../core/grid.js';

export function getChunkTopY(chunk) {
  const layerH = getLayerHeight();
  if (chunk.kind === 'room') {
    const room = arena.rooms[chunk.roomId];
    return Math.max(room.height, room.exitHeight) * layerH + state.roomWallHeight;
  }
  return arena.doors[chunk.doorId].height * layerH + DOOR_HEIGHT;
}
