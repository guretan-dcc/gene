import { state } from '../state.js';

export function getExportFilename(extension) {
  return `arena_${state.preset}_${state.gridWidth}x${state.gridDepth}_${state.seed}.${extension}`;
}
