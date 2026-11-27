// ワールド座標の床の高さ（VR目線の歩行用）
import { arena } from '../state.js';
import { VR_EYE_HEIGHT } from '../config/constants.js';
import { getLayerHeight, getPlayerPadHeight, getGridMetrics, isInGrid } from '../core/grid.js';
import { camCtrl } from './cameraState.js';

export function getFloorHeightAtWorld(wx, wz) {
  const { S, halfW, halfD } = getGridMetrics();
  const fxFull = (wx + halfW) / S;
  const fzFull = (wz + halfD) / S;
  const gx = Math.floor(fxFull);
  const gz = Math.floor(fzFull);
  if (!isInGrid(gx, gz)) return 0;

  const layerH = getLayerHeight();
  // スロープ上なら傾斜に沿って滑らかに高さを補間する
  const slope = arena.slopes.find(s => s.x === gx && s.z === gz);
  if (slope) {
    const fx = Math.max(0, Math.min(1, fxFull - gx));
    const fz = Math.max(0, Math.min(1, fzFull - gz));
    let t = 0;
    if (slope.dirZ === -1) t = 1 - fz;
    else if (slope.dirZ === 1) t = fz;
    else if (slope.dirX === 1) t = fx;
    else if (slope.dirX === -1) t = 1 - fx;
    return (slope.lowH + t * (slope.highH - slope.lowH)) * layerH;
  }

  const cell = arena.grid[gz][gx];
  if (!cell || cell.type === 'pit') {
    // マグマ谷の上は現在高さを維持（VR確認時に落下せず谷底を覗き込める）
    return Math.max(0, camCtrl.vrPos.y - VR_EYE_HEIGHT);
  }
  const base = cell.height * layerH;
  if (cell.spawn === 'player') {
    return base + getPlayerPadHeight();
  }
  return base;
}
