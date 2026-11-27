// ガイドグリッド（視認用＋手書き魔法10m/s射程ライン）
import { state } from '../state.js';
import { getPlayerCoord, getGridMetrics, cellCenterZ } from '../core/grid.js';
import { view } from './context.js';

function addLines(points, color, opacity) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  view.groups.gridOverlay.add(new THREE.LineSegments(geo, mat));
}

export function addGridOverlay() {
  if (!state.showGridOverlay) return;

  const { W, D, S, halfW, halfD } = getGridMetrics();

  const lines = [];
  const gy = 0.03;
  for (let x = 0; x <= W; x++) {
    const wx = x * S - halfW;
    lines.push(wx, gy, -halfD, wx, gy, halfD);
  }
  for (let z = 0; z <= D; z++) {
    const wz = z * S - halfD;
    lines.push(-halfW, gy, wz, halfW, gy, wz);
  }
  addLines(lines, 0x94a3b8, 0.16);

  // 自機スタート位置から10mごと（弾速10m/s＝1秒・2秒・3秒...）の射程目安ライン
  const pWz = cellCenterZ(getPlayerCoord().z);
  const rangeLines = [];
  for (let dist = 10; pWz - dist > -halfD; dist += 10) {
    const rz = pWz - dist;
    rangeLines.push(-halfW, gy + 0.03, rz, halfW, gy + 0.03, rz);
  }
  if (rangeLines.length > 0) addLines(rangeLines, 0x38bdf8, 0.48);
}
