// 統合ローポリ台座ジオメトリ（底面カリング済み 2段台座）
import { state, arena } from '../state.js';
import { PALETTE } from '../config/constants.js';
import { getLayerHeight, getPlayerPadHeight, getGridMetrics, cellCenterX, cellCenterZ } from '../core/grid.js';
import { MeshBuilder } from './MeshBuilder.js';

export function buildPedestalGeometry() {
  const { W, D, S } = getGridMetrics();
  const layerH = getLayerHeight();
  const pedH = state.pedestalHeight;
  const playerPadH = getPlayerPadHeight();
  const mesh = new MeshBuilder();

  const colBase = new THREE.Color(PALETTE.pedBase);
  const colMelee = new THREE.Color(PALETTE.pedMelee);
  const colRange = new THREE.Color(PALETTE.pedRange);
  const colPlay = new THREE.Color(PALETTE.pedPlay);

  // 底面中心と寸法を指定してボックスを追加
  function addBox(cx, yBottom, cz, bw, bh, bd, col) {
    mesh.addNoBottomBox(cx - bw / 2, cx + bw / 2, yBottom, yBottom + bh, cz - bd / 2, cz + bd / 2, col);
  }

  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const cell = arena.grid[z][x];
      if (cell.type === 'pit' || cell.spawn === 'none') continue;

      const wx = cellCenterX(x);
      const wz = cellCenterZ(z);
      const floorTopY = cell.height * layerH;

      const isPlayer = cell.spawn === 'player';
      const totalH = isPlayer ? playerPadH : pedH;
      const baseH = totalH * 0.72;
      const capH = totalH * 0.28;
      const capCol = isPlayer ? colPlay : (cell.spawn === 'ranged' ? colRange : colMelee);

      addBox(wx, floorTopY, wz, S * 0.84, baseH, S * 0.84, colBase);
      addBox(wx, floorTopY + baseH, wz, S * 0.70, capH, S * 0.70, capCol);
    }
  }

  return mesh.build();
}
