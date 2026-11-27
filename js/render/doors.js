// 各部屋の出口の両開き扉（プレビュー専用：PLYには含めずJSONに座標を出力）
import { state, arena } from '../state.js';
import { DOOR_HEIGHT } from '../config/constants.js';
import { getLayerHeight, cellCenterX, cellCenterZ } from '../core/grid.js';
import { view } from './context.js';

const PANEL_COLOR = 0x7d828c;
const SEAM_COLOR = 0x2b2d34;
const THICKNESS = 0.2;
const SEAM_WIDTH = 0.08;

export function addDoors() {
  if (!state.showDoors) return;
  const S = state.cellSize;
  const layerH = getLayerHeight();

  for (const door of arena.doors) {
    const x = cellCenterX(door.x);
    const y = door.height * layerH + DOOR_HEIGHT / 2;
    const z = cellCenterZ(door.z) - S / 2 + THICKNESS / 2;

    const addPanel = (width, thickness, color) => {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(width, DOOR_HEIGHT, thickness),
        new THREE.MeshLambertMaterial({ color })
      );
      panel.position.set(x, y, z);
      view.chunkGroups[door.from].add(panel);
    };
    // 1枚の扉板に、中央の合わせ目を少し厚くして重ねる
    addPanel(door.width * S, THICKNESS, PANEL_COLOR);
    addPanel(SEAM_WIDTH, THICKNESS + 0.04, SEAM_COLOR);
  }
}
