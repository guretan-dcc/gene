// 3Dシーン全体再構築
import { arena } from '../state.js';
import { view } from './context.js';
import { addStaticMeshes } from './staticMeshes.js';
import { addSpawnMarkers } from './markers.js';
import { addTraps } from './traps.js';
import { addSawTracks } from './saws.js';
import { addDoors } from './doors.js';
import { addGridOverlay } from './gridOverlay.js';
import { updateStats } from '../ui/stats.js';
import { syncVREyeUI } from '../ui/sync.js';

// 子孫まで含めてジオメトリとマテリアルを解放する
function clearGroup(group) {
  while (group.children.length > 0) {
    const child = group.children.pop();
    clearGroup(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  }
}

export function rebuildScene() {
  clearGroup(view.stage);
  clearGroup(view.gridOverlay);
  view.pickableMeshes = [];
  view.animatedItems = [];
  view.chunkGroups = arena.chunks.map(() => new THREE.Group());
  view.chunkGroups.forEach(group => view.stage.add(group));

  const meshInfo = addStaticMeshes();
  const spawnCounts = addSpawnMarkers();
  const trapCounts = addTraps();
  addSawTracks();
  addDoors();
  addGridOverlay();

  updateStats(meshInfo, spawnCounts, trapCounts);
  syncVREyeUI();
}
