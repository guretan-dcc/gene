// VR目線モードの歩行（WASD／矢印キー・ホイール）
import { VR_EYE_HEIGHT, VR_WALK_SPEED } from '../config/constants.js';
import { getGridMetrics } from '../core/grid.js';
import { camCtrl } from './cameraState.js';
import { getFloorHeightAtWorld } from './floorHeight.js';
import { updateCameraPosition } from './views.js';

// キー入力状態
const keysPressed = {};

export function bindWalkKeys() {
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
    keysPressed[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    keysPressed[e.code] = false;
  });
}

function isPressed(...codes) {
  return codes.some(code => keysPressed[code]);
}

// 水平移動してアリーナ内に収め、移動先の目線高さを返す
function moveHorizontally(dx, dz) {
  const { halfW, halfD } = getGridMetrics();
  const limitX = halfW - 0.5;
  const limitZ = halfD - 0.5;
  camCtrl.vrPos.x = Math.max(-limitX, Math.min(limitX, camCtrl.vrPos.x + dx));
  camCtrl.vrPos.z = Math.max(-limitZ, Math.min(limitZ, camCtrl.vrPos.z + dz));
  return getFloorHeightAtWorld(camCtrl.vrPos.x, camCtrl.vrPos.z) + VR_EYE_HEIGHT;
}

// ホイール1ノッチ分の前後移動（高さは即時反映）
export function stepForward(step) {
  camCtrl.vrPos.y = moveHorizontally(-Math.sin(camCtrl.vrYaw) * step, -Math.cos(camCtrl.vrYaw) * step);
  updateCameraPosition();
}

// 毎フレームのキー歩行（高さはなめらかに追従）
export function updateVRWalk(dt) {
  let moveForward = 0;
  let moveRight = 0;
  if (isPressed('KeyW', 'ArrowUp')) moveForward += 1;
  if (isPressed('KeyS', 'ArrowDown')) moveForward -= 1;
  if (isPressed('KeyD', 'ArrowRight')) moveRight += 1;
  if (isPressed('KeyA', 'ArrowLeft')) moveRight -= 1;
  if (moveForward === 0 && moveRight === 0) return;

  const len = Math.hypot(moveForward, moveRight);
  moveForward /= len;
  moveRight /= len;
  const dist = VR_WALK_SPEED * dt;
  const fwdX = -Math.sin(camCtrl.vrYaw);
  const fwdZ = -Math.cos(camCtrl.vrYaw);
  const rightX = Math.cos(camCtrl.vrYaw);
  const rightZ = -Math.sin(camCtrl.vrYaw);

  const targetY = moveHorizontally(
    (fwdX * moveForward + rightX * moveRight) * dist,
    (fwdZ * moveForward + rightZ * moveRight) * dist
  );
  camCtrl.vrPos.y += (targetY - camCtrl.vrPos.y) * Math.min(1, dt * 12);
  updateCameraPosition();
}
