// 往復回転ノコギリ（レール＋ブレード）
import { state, arena } from '../state.js';
import { PALETTE } from '../config/constants.js';
import { getLayerHeight, cellCenterX, cellCenterZ } from '../core/grid.js';
import { view } from './context.js';

export function addSawTracks() {
  const S = state.cellSize;
  const layerH = getLayerHeight();

  for (const saw of arena.sawTracks) {
    const group = view.chunkGroups[arena.grid[saw.z][saw.startX].chunkId];
    const x0 = cellCenterX(saw.startX);
    const x1 = cellCenterX(saw.endX);
    const wz = cellCenterZ(saw.z);
    const fy = saw.height * layerH;
    const railLen = (x1 - x0) + S * 0.6;

    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(railLen, 0.10, S * 0.22),
      new THREE.MeshLambertMaterial({ color: 0x0f172a })
    );
    rail.position.set((x0 + x1) / 2, fy + 0.05, wz);
    group.add(rail);

    const bladeGrp = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(S * 0.42, S * 0.42, 0.14, 12),
      new THREE.MeshLambertMaterial({ color: PALETTE.sawBlade })
    );
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(S * 0.42, 0.08, 6, 12),
      new THREE.MeshBasicMaterial({ color: PALETTE.sawEdge })
    );
    rim.rotation.x = Math.PI / 2;
    bladeGrp.add(disc, rim);
    bladeGrp.position.set((x0 + x1) / 2, fy + 0.24, wz);
    group.add(bladeGrp);

    view.animatedItems.push({
      type: 'saw',
      mesh: bladeGrp,
      x0,
      x1,
      speed: saw.speed,
      phase: saw.phase
    });
  }
}
