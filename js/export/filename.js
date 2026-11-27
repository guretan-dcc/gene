import { state } from '../state.js';

export function getExportFilename(extension) {
  return `stage_rooms${state.roomLayers}_branch${state.branchCount}_${state.seed}.${extension}`;
}
