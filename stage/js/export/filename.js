import { state, arena } from '../state.js';

export function getExportFilename(extension) {
  const name = state.previewRoom === 'all' ? `rooms${state.roomCount}` : state.previewRoom;
  return `stage_${name}_${state.seed}.${extension}`;
}

// 区画の名前（Unityのオブジェクト名・分割PLY名に使う）
export function getChunkName(chunk) {
  const index = String(chunk.kind === 'room' ? chunk.roomId : chunk.doorId).padStart(2, '0');
  const type = chunk.kind === 'room' ? `_${arena.rooms[chunk.roomId].type}` : '';
  return `${chunk.kind}_${index}${type}`;
}

export function getChunkMeshName(chunk) {
  return `${getChunkName(chunk)}.ply`;
}
