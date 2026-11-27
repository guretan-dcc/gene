// 床ガイドグリッド（視認用）
import { state } from '../state.js';
import { getGridMetrics } from '../core/grid.js';
import { view } from './context.js';

export function addGridOverlay() {
  if (!state.showGridOverlay) return;

  const { W, D, S, halfW, halfD } = getGridMetrics();
  const points = [];
  const gy = 0.03;
  for (let x = 0; x <= W; x++) {
    const wx = x * S - halfW;
    points.push(wx, gy, -halfD, wx, gy, halfD);
  }
  for (let z = 0; z <= D; z++) {
    const wz = z * S - halfD;
    points.push(-halfW, gy, wz, halfW, gy, wz);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.16 });
  view.gridOverlay.add(new THREE.LineSegments(geo, mat));
}
