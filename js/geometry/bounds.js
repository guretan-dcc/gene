// 区画の上下の範囲と、部屋の左右の端
import { state, arena } from '../state.js';
import { DOOR_HEIGHT } from '../config/constants.js';
import { ROOMS } from '../rooms/index.js';
import { getLayerHeight, getGridMetrics, cellCenterX } from '../core/grid.js';

export function getChunkTopY(chunk) {
  const layerH = getLayerHeight();
  if (chunk.kind === 'room') {
    const room = arena.rooms[chunk.roomId];
    return Math.max(room.height, room.exitHeight) * layerH + state.roomWallHeight;
  }
  return arena.doors[chunk.doorId].height * layerH + DOOR_HEIGHT;
}

// 区画内で見える一番低い高さ（浅い溶岩面がある部屋はその面、他はマグマ面）
export function getChunkBottomY(chunk) {
  if (chunk.kind === 'room') {
    const room = arena.rooms[chunk.roomId];
    const { lavaDepth } = ROOMS[room.layout];
    if (lavaDepth) return room.height * getLayerHeight() - lavaDepth;
  }
  return -state.magmaDepth;
}

// 部屋の左右の端の X 座標
export function getRoomEdgesX(room) {
  const half = (room.half + 0.5) * getGridMetrics().S;
  const center = cellCenterX(room.centerX);
  return [center - half, center + half];
}
