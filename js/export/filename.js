import { state, arena } from '../state.js';

export function getExportFilename(extension) {
  return `stage_rooms${state.roomLayers}_branch${state.branchCount}_${state.seed}.${extension}`;
}

// 分割書き出し時の区画ごとのPLY名
export function getChunkMeshName(chunk) {
  const index = String(chunk.kind === 'room' ? chunk.roomId : chunk.doorId).padStart(2, '0');
  const type = chunk.kind === 'room' ? `_${arena.rooms[chunk.roomId].type}` : '';
  return `${chunk.kind}_${index}${type}.ply`;
}
