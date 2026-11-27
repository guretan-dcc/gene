import { state, arena } from '../state.js';

export function getExportFilename(extension) {
  const name = state.previewRoom === 'all' ? `rooms${state.roomCount}` : state.previewRoom;
  return `stage_${name}_${state.seed}.${extension}`;
}

// 分割書き出し時の区画ごとのPLY名
export function getChunkMeshName(chunk) {
  const index = String(chunk.kind === 'room' ? chunk.roomId : chunk.doorId).padStart(2, '0');
  const type = chunk.kind === 'room' ? `_${arena.rooms[chunk.roomId].type}` : '';
  return `${chunk.kind}_${index}${type}.ply`;
}
