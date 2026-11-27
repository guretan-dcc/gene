// ローポリ幅広スロープジオメトリ（並列スロープを自動結合し4三角形/基）
import { arena } from '../state.js';
import { PALETTE } from '../config/constants.js';
import { getLayerHeight, getGridMetrics, cellKey } from '../core/grid.js';
import { MeshBuilder } from './MeshBuilder.js';

export function buildSlopeGeometry() {
  const { S, halfW, halfD } = getGridMetrics();
  const layerH = getLayerHeight();
  const mesh = new MeshBuilder();
  const col = new THREE.Color(PALETTE.slope);

  // 隣り合う同向き・同標高のスロープを1つの幅広ウェッジへ結合してポリゴン削減
  const slopeMap = new Map(arena.slopes.map(sl => [cellKey(sl.x, sl.z), sl]));
  const visited = new Set();

  for (const sl of arena.slopes) {
    if (visited.has(cellKey(sl.x, sl.z))) continue;

    // 進行方向と直交する軸に沿って連続セルを統合
    const stepX = sl.dirZ !== 0 ? 1 : 0;
    const stepZ = sl.dirX !== 0 ? 1 : 0;

    const canMerge = (x, z) => {
      const nb = slopeMap.get(cellKey(x, z));
      return Boolean(nb) && !visited.has(cellKey(x, z)) &&
        nb.dirX === sl.dirX && nb.dirZ === sl.dirZ && nb.lowH === sl.lowH && nb.highH === sl.highH;
    };

    let minX = sl.x, maxX = sl.x;
    let minZ = sl.z, maxZ = sl.z;

    // 負方向・正方向へ伸ばす
    while (canMerge(minX - stepX, minZ - stepZ)) {
      minX -= stepX;
      minZ -= stepZ;
    }
    while (canMerge(maxX + stepX, maxZ + stepZ)) {
      maxX += stepX;
      maxZ += stepZ;
    }

    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        visited.add(cellKey(x, z));
      }
    }

    const x0 = minX * S - halfW;
    const x1 = (maxX + 1) * S - halfW;
    const z0 = minZ * S - halfD;
    const z1 = (maxZ + 1) * S - halfD;
    const yL = sl.lowH * layerH;
    const yH = sl.highH * layerH;

    let lA, lB, hA, hB, bA, bB;
    if (sl.dirZ === -1) {
      lA = [x0, yL, z1]; lB = [x1, yL, z1];
      hA = [x0, yH, z0]; hB = [x1, yH, z0];
      bA = [x0, yL, z0]; bB = [x1, yL, z0];
    } else if (sl.dirZ === 1) {
      lA = [x1, yL, z0]; lB = [x0, yL, z0];
      hA = [x1, yH, z1]; hB = [x0, yH, z1];
      bA = [x1, yL, z1]; bB = [x0, yL, z1];
    } else if (sl.dirX === 1) {
      lA = [x0, yL, z0]; lB = [x0, yL, z1];
      hA = [x1, yH, z0]; hB = [x1, yH, z1];
      bA = [x1, yL, z0]; bB = [x1, yL, z1];
    } else {
      lA = [x1, yL, z1]; lB = [x1, yL, z0];
      hA = [x0, yH, z1]; hB = [x0, yH, z0];
      bA = [x0, yL, z1]; bB = [x0, yL, z0];
    }

    // 傾斜上面（2三角形）
    mesh.addTriangle(lA, lB, hB, col);
    mesh.addTriangle(lA, hB, hA, col);
    // 両側面（各1三角形＝計2三角形）
    mesh.addTriangle(lA, hA, bA, col);
    mesh.addTriangle(lB, bB, hB, col);
  }

  return mesh.build();
}
