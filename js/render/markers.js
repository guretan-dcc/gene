// 敵・自機マーカー（プレビュー専用：PLYには含めない）
import { state, arena } from '../state.js';
import { PALETTE, VR_EYE_HEIGHT } from '../config/constants.js';
import { getLayerHeight, getPlayerPadHeight, getGridMetrics, cellCenterX, cellCenterZ } from '../core/grid.js';
import { view } from './context.js';

// マーカーを追加し、敵の数を返す
export function addSpawnMarkers() {
  const { W, D, S } = getGridMetrics();
  const layerH = getLayerHeight();
  const pedH = state.pedestalHeight;
  const playerPadH = getPlayerPadHeight();
  const markerGroup = view.groups.marker;
  const counts = { melee: 0, ranged: 0 };

  const markerH = Math.max(1.7, S * 0.72); // 人間アバター基準(1.7m)を下回らないサイズ
  const meleeGeo = new THREE.CylinderGeometry(Math.min(0.45, S * 0.22), Math.min(0.45, S * 0.22), markerH, 6);
  const rangedGeo = new THREE.ConeGeometry(Math.min(0.52, S * 0.26), markerH, 4);
  const playerGeo = new THREE.CylinderGeometry(Math.min(0.42, S * 0.22), Math.min(0.42, S * 0.22), 1.7, 8);
  const arrowGeo = new THREE.ConeGeometry(Math.min(0.28, S * 0.16), Math.min(0.6, S * 0.36), 4);

  const meleeMat = new THREE.MeshLambertMaterial({ color: PALETTE.melee });
  const rangedMat = new THREE.MeshLambertMaterial({ color: PALETTE.ranged });
  const playerMat = new THREE.MeshLambertMaterial({ color: PALETTE.player });
  const arrowMat = new THREE.MeshLambertMaterial({ color: 0xe0f2fe });

  view.playerMarkerGroup = new THREE.Group();
  markerGroup.add(view.playerMarkerGroup); // 表示状態は syncVREyeUI() が設定する

  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const cell = arena.grid[z][x];
      if (cell.type === 'pit' || cell.spawn === 'none') continue;

      const wx = cellCenterX(x);
      const wz = cellCenterZ(z);
      const floorTopY = cell.height * layerH;

      if (cell.spawn === 'player') {
        const m = new THREE.Mesh(playerGeo, playerMat);
        m.position.set(wx, floorTopY + playerPadH + 1.7 / 2 + 0.02, wz);
        view.playerMarkerGroup.add(m);

        // 前方(-Z)インジケータ（VR目線1.6m付近に配置）
        const arr = new THREE.Mesh(arrowGeo, arrowMat);
        arr.rotation.x = -Math.PI / 2;
        arr.position.set(wx, floorTopY + playerPadH + VR_EYE_HEIGHT, wz - Math.min(0.65, S * 0.34));
        view.playerMarkerGroup.add(arr);
      } else if (cell.spawn === 'melee') {
        counts.melee++;
        const m = new THREE.Mesh(meleeGeo, meleeMat);
        m.position.set(wx, floorTopY + pedH + markerH / 2 + 0.04, wz);
        markerGroup.add(m);
      } else if (cell.spawn === 'ranged') {
        counts.ranged++;
        const m = new THREE.Mesh(rangedGeo, rangedMat);
        m.position.set(wx, floorTopY + pedH + markerH / 2 + 0.04, wz);
        markerGroup.add(m);
      }
    }
  }

  return counts;
}
