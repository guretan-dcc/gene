// 外周の巨大アリーナ壁（八角ドーム／長方形・プレビュー手前壁下げ対応）
import { state } from '../state.js';
import { VOX } from '../config/constants.js';
import { getVoxelColor } from '../config/theme.js';
import { getLayerHeight } from '../core/grid.js';
import { MeshBuilder } from './MeshBuilder.js';
import { getChamberPerimeterPoints, isFrontSegment } from './perimeter.js';

export function buildOuterWallGeometry(cutFront) {
  const mesh = new MeshBuilder();
  if (!state.outerWallEnabled) return mesh.build();

  const pts = getChamberPerimeterPoints();
  const n = pts.length;
  const layerH = getLayerHeight();
  const yBot = -state.magmaDepth;
  const fullTopY = state.outerWallHeight * layerH;
  const cutTopY = layerH * 0.5;
  const wallThick = Math.max(state.cellSize, 2.0);
  const col = new THREE.Color(getVoxelColor(VOX.RIM));

  for (let i = 0; i < n; i++) {
    const yTop = (cutFront && isFrontSegment(i)) ? cutTopY : fullTopY;

    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    // 内向き法線
    const inX = -dz / len;
    const inZ = dx / len;
    // 外向きオフセット
    const ox = -inX * wallThick;
    const oz = -inZ * wallThick;

    // 内側面
    mesh.addQuad(
      [a.x, yBot, a.z],
      [b.x, yBot, b.z],
      [b.x, yTop, b.z],
      [a.x, yTop, a.z],
      [inX, 0, inZ], col
    );
    // 外側面
    mesh.addQuad(
      [b.x + ox, yBot, b.z + oz],
      [a.x + ox, yBot, a.z + oz],
      [a.x + ox, yTop, a.z + oz],
      [b.x + ox, yTop, b.z + oz],
      [-inX, 0, -inZ], col
    );
    // 上面リム
    mesh.addQuad(
      [a.x, yTop, a.z],
      [b.x, yTop, b.z],
      [b.x + ox, yTop, b.z + oz],
      [a.x + ox, yTop, a.z + oz],
      [0, 1, 0], col
    );
  }

  return mesh.build();
}
