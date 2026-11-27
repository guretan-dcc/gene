// カメラ反映と視点切替（全体 / 自機後方 / VR目線1.6m）
import { state, arena } from '../state.js';
import { VR_EYE_HEIGHT } from '../config/constants.js';
import { getLayerHeight, getPlayerCoord, getGridMetrics, cellCenterX, cellCenterZ } from '../core/grid.js';
import { view } from '../render/context.js';
import { syncVREyeUI } from '../ui/sync.js';
import { showToast } from '../ui/toast.js';
import { camCtrl } from './cameraState.js';
import { getFloorHeightAtWorld } from './floorHeight.js';

function setLens(fov, near) {
  view.camera.fov = fov;
  view.camera.near = near;
  view.camera.updateProjectionMatrix();
}

export function updateCameraPosition() {
  const { camera } = view;

  if (camCtrl.mode === 'vr') {
    camera.position.copy(camCtrl.vrPos);
    const cosP = Math.cos(camCtrl.vrPitch);
    const lookDir = new THREE.Vector3(
      -Math.sin(camCtrl.vrYaw) * cosP,
      Math.sin(camCtrl.vrPitch),
      -Math.cos(camCtrl.vrYaw) * cosP
    );
    camera.lookAt(camCtrl.vrPos.clone().add(lookDir));
    return;
  }

  const sinPhi = Math.sin(camCtrl.phi);
  camera.position.set(
    camCtrl.target.x + camCtrl.radius * sinPhi * Math.sin(camCtrl.theta),
    camCtrl.target.y + camCtrl.radius * Math.cos(camCtrl.phi),
    camCtrl.target.z + camCtrl.radius * sinPhi * Math.cos(camCtrl.theta)
  );
  camera.lookAt(camCtrl.target);
}

export function exitVREyeMode() {
  if (camCtrl.mode !== 'vr') return;
  camCtrl.mode = 'orbit';
  setLens(45, 0.5);
  syncVREyeUI();
}

export function resetCameraOverview() {
  exitVREyeMode();
  const maxSpan = (Math.max(state.gridWidth, state.gridDepth) + state.chasmGap * 1.4) * state.cellSize;
  camCtrl.target.set(0, -state.magmaDepth * 0.15, 0);
  camCtrl.theta = 0.46;
  camCtrl.phi = 0.94;
  camCtrl.radius = Math.max(46, maxSpan * 1.05);
  updateCameraPosition();
}

export function setCameraPlayerView() {
  exitVREyeMode();
  const { halfD } = getGridMetrics();
  const pCoord = getPlayerCoord();
  const pCell = arena.grid[pCoord.z] && arena.grid[pCoord.z][pCoord.x];
  const pY = pCell ? pCell.height * getLayerHeight() : 0;
  camCtrl.target.set(0, pY + state.cellSize * 0.9, halfD - state.cellSize * 5);
  camCtrl.theta = 0;
  camCtrl.phi = 1.24;
  camCtrl.radius = Math.max(14, state.cellSize * 8);
  updateCameraPosition();
}

export function setCameraVREyeView() {
  const pCoord = getPlayerCoord();
  const wx = cellCenterX(pCoord.x);
  const wz = cellCenterZ(pCoord.z);
  const floorY = getFloorHeightAtWorld(wx, wz);

  camCtrl.mode = 'vr';
  camCtrl.vrPos.set(wx, floorY + VR_EYE_HEIGHT, wz);
  camCtrl.vrYaw = 0;
  camCtrl.vrPitch = -0.04;

  // VRヘッドセットに近い広めの視野角と近接クリップ
  setLens(72, 0.1);
  syncVREyeUI();
  updateCameraPosition();
  showToast('VR目線モード (高さ1.6m)：ドラッグで見回し、WASD/ホイールで歩行できます');
}
