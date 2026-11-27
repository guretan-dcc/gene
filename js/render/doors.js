// 各部屋の出口のシャッター扉（プレビュー専用：PLYには含めずJSONに座標を出力）
import { state, arena } from '../state.js';
import { DOOR_HEIGHT } from '../config/constants.js';
import { getLayerHeight, cellCenterX, cellCenterZ } from '../core/grid.js';
import { view } from './context.js';

const SLAT_HEIGHT = 0.25;

export function addDoors() {
  if (!state.showDoors) return;
  const S = state.cellSize;
  const layerH = getLayerHeight();

  for (const door of arena.doors) {
    const group = view.chunkGroups[door.from];
    const count = Math.round(DOOR_HEIGHT / SLAT_HEIGHT);
    for (let i = 0; i < count; i++) {
      // 厚みと色を交互に変えてシャッターの段を表現する
      const slat = new THREE.Mesh(
        new THREE.BoxGeometry(door.width * S, SLAT_HEIGHT, i % 2 ? 0.2 : 0.32),
        new THREE.MeshLambertMaterial({ color: i % 2 ? 0x6b7078 : 0x8d929b })
      );
      slat.position.set(
        cellCenterX(door.x),
        door.height * layerH + (i + 0.5) * SLAT_HEIGHT,
        cellCenterZ(door.z) - S / 2 + 0.1
      );
      group.add(slat);
    }
  }
}
