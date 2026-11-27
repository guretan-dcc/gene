// 3Dシーン全体再構築
import { view } from './context.js';
import { addStaticMeshes } from './staticMeshes.js';
import { addSpawnMarkers } from './markers.js';
import { addTraps } from './traps.js';
import { addSawTracks } from './saws.js';
import { addDoors } from './doors.js';
import { addGridOverlay } from './gridOverlay.js';
import { updateStats } from '../ui/stats.js';
import { syncFrontWallUI, syncVREyeUI } from '../ui/sync.js';

function clearGroup(group) {
  while (group.children.length > 0) {
    const child = group.children.pop();
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  }
}

export function rebuildScene() {
  Object.values(view.groups).forEach(clearGroup);
  view.pickableMeshes = [];
  view.animatedItems = [];

  const meshInfo = addStaticMeshes();
  const spawnCounts = addSpawnMarkers();
  const trapCounts = addTraps();
  addSawTracks();
  addDoors();
  addGridOverlay();

  updateStats(meshInfo, spawnCounts, trapCounts);
  syncFrontWallUI();
  syncVREyeUI();
}
