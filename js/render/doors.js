// 部屋の入口の扉（プレビュー専用：PLYには含めずJSONに座標を出力）
import { state, arena } from '../state.js';
import { DOOR_HEIGHT } from '../config/constants.js';
import { getLayerHeight, cellCenterX, cellCenterZ } from '../core/grid.js';
import { view } from './context.js';

export function addDoors() {
  if (!state.showDoors) return;
  const S = state.cellSize;
  const layerH = getLayerHeight();

  for (const door of arena.doors) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(door.width * S, DOOR_HEIGHT, 0.2),
      new THREE.MeshLambertMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 })
    );
    slab.position.set(cellCenterX(door.x), door.height * layerH + DOOR_HEIGHT / 2, cellCenterZ(door.z) - S / 2);
    view.chunkGroups[arena.rooms.length + door.id].add(slab);
  }
}
