// 壁ネオン帯＆奥壁の実況ブース装飾（八角／長方形の外周壁に沿って配置）
import { state } from '../state.js';
import { getTierTheme } from '../config/theme.js';
import { getLayerHeight, getGridMetrics } from '../core/grid.js';
import { getChamberPerimeterPoints, isFrontSegment } from '../geometry/perimeter.js';
import { view } from './context.js';

export function addArenaDecor() {
  if (!state.showArenaDecor || !state.outerWallEnabled) return;

  const { W, S, halfD } = getGridMetrics();
  const layerH = getLayerHeight();
  const theme = getTierTheme();

  const pts = getChamberPerimeterPoints();
  const n = pts.length;
  const wallTopY = state.outerWallHeight * layerH;
  const neonMat = new THREE.MeshBasicMaterial({ color: theme.neon });
  const stripY = Math.max(layerH * 2.0, wallTopY * 0.52);

  for (let i = 0; i < n; i++) {
    if (state.previewCutFrontWall && isFrontSegment(i)) continue;

    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const segLen = Math.hypot(dx, dz);
    const midX = (a.x + b.x) / 2;
    const midZ = (a.z + b.z) / 2;
    // 内側へ少しオフセット
    const inX = -dz / (segLen || 1);
    const inZ = dx / (segLen || 1);

    const bar = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.55, 0.25), neonMat);
    bar.position.set(midX + inX * 0.16, stripY, midZ + inZ * 0.16);
    bar.rotation.y = -Math.atan2(dz, dx);
    view.groups.decor.add(bar);
  }

  // 奥壁上部の実況ブースシルエット
  const backWallZ = -(halfD + state.chasmGap * S);
  const boothW = Math.min(W * S * 0.55, 22);
  const boothH = Math.max(4.5, layerH * 2.6);
  const boothY = wallTopY + boothH * 0.45;
  const boothBody = new THREE.Mesh(
    new THREE.BoxGeometry(boothW, boothH, S * 1.6),
    new THREE.MeshLambertMaterial({ color: theme.rim })
  );
  boothBody.position.set(0, boothY, backWallZ - S * 0.6);
  const boothWindow = new THREE.Mesh(
    new THREE.BoxGeometry(boothW * 0.82, boothH * 0.42, 0.3),
    new THREE.MeshBasicMaterial({ color: theme.neon })
  );
  boothWindow.position.set(0, boothY + boothH * 0.08, backWallZ + 0.25);
  view.groups.decor.add(boothBody, boothWindow);
}
