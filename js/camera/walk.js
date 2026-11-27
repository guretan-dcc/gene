// VR目線モードの歩行（WASD／矢印キー・ホイール）
import { VR_EYE_HEIGHT, VR_WALK_SPEED } from '../config/constants.js';
import { arena } from '../state.js';
import { getGridMetrics, isInGrid, isWalkable } from '../core/grid.js';
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

function canStand(wx, wz) {
  const { S, halfW, halfD } = getGridMetrics();
  const x = Math.floor((wx + halfW) / S);
  const z = Math.floor((wz + halfD) / S);
  return isInGrid(x, z) && isWalkable(arena.grid[z][x]);
}

// 壁と遮蔽物を避けて水平移動し、移動先の目線高さを返す
function moveHorizontally(dx, dz) {
  const { S } = getGridMetrics();
  // すり抜けないよう半マス以下に刻み、軸ごとに判定して壁沿いに滑らせる
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (S * 0.5)));
  const pos = camCtrl.vrPos;
  for (let i = 0; i < steps; i++) {
    if (canStand(pos.x + dx / steps, pos.z)) pos.x += dx / steps;
    if (canStand(pos.x, pos.z + dz / steps)) pos.z += dz / steps;
  }
  return getFloorHeightAtWorld(pos.x, pos.z) + VR_EYE_HEIGHT;
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
