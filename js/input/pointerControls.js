// マウス・タッチ操作（回転 / 平行移動 / ズーム / クリック）
import { state } from '../state.js';
import { camCtrl } from '../camera/cameraState.js';
import { updateCameraPosition } from '../camera/views.js';
import { stepForward } from '../camera/walk.js';
import { handleViewportClick } from './cellEdit.js';

function lookVR(dx, dy, sensitivity) {
  camCtrl.vrYaw -= dx * sensitivity;
  camCtrl.vrPitch = Math.max(-1.25, Math.min(1.25, camCtrl.vrPitch - dy * sensitivity));
}

function orbit(dx, dy, sensitivity) {
  camCtrl.theta -= dx * sensitivity;
  camCtrl.phi = Math.max(0.12, Math.min(1.52, camCtrl.phi - dy * sensitivity));
}

function pan(dx, dy) {
  const panSpeed = camCtrl.radius * 0.0014;
  const right = new THREE.Vector3(Math.cos(camCtrl.theta), 0, -Math.sin(camCtrl.theta));
  const forward = new THREE.Vector3(-Math.sin(camCtrl.theta), 0, -Math.cos(camCtrl.theta));
  camCtrl.target.addScaledVector(right, -dx * panSpeed);
  camCtrl.target.addScaledVector(forward, dy * panSpeed);
}

function zoom(factor) {
  camCtrl.radius = Math.max(camCtrl.minRadius, Math.min(camCtrl.maxRadius, camCtrl.radius * factor));
}

function startDrag(point, mode) {
  camCtrl.isDragging = true;
  camCtrl.dragMode = mode;
  camCtrl.lastX = camCtrl.downX = point.clientX;
  camCtrl.lastY = camCtrl.downY = point.clientY;
}

// 前回位置からの移動量を返して現在位置を記録する
function consumeDrag(point) {
  const dx = point.clientX - camCtrl.lastX;
  const dy = point.clientY - camCtrl.lastY;
  camCtrl.lastX = point.clientX;
  camCtrl.lastY = point.clientY;
  return { dx, dy };
}

function isClick(point, tolerance) {
  return Math.hypot(point.clientX - camCtrl.downX, point.clientY - camCtrl.downY) < tolerance;
}

function getPinchDistance(touches) {
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );
}

// マウス操作（左: 回転, 右/Shift+左: パン, ホイール: ズーム）
function bindMouse(dom) {
  dom.addEventListener('contextmenu', e => e.preventDefault());

  dom.addEventListener('mousedown', (e) => {
    startDrag(e, (e.button === 2 || e.shiftKey) ? 'pan' : 'orbit');
  });

  window.addEventListener('mousemove', (e) => {
    if (!camCtrl.isDragging) return;
    const { dx, dy } = consumeDrag(e);
    if (camCtrl.mode === 'vr') lookVR(dx, dy, 0.0048);
    else if (camCtrl.dragMode === 'orbit') orbit(dx, dy, 0.0065);
    else pan(dx, dy);
    updateCameraPosition();
  });

  window.addEventListener('mouseup', (e) => {
    if (!camCtrl.isDragging) return;
    camCtrl.isDragging = false;
    if (e.button === 0 && !e.shiftKey && isClick(e, 5)) {
      handleViewportClick(e.clientX, e.clientY);
    }
  });

  dom.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (camCtrl.mode === 'vr') {
      // VR目線モードではホイールで前後に歩行移動
      stepForward((e.deltaY > 0 ? -1 : 1) * Math.max(1.2, state.cellSize * 0.7));
      return;
    }
    zoom(e.deltaY > 0 ? 1.1 : 0.91);
    updateCameraPosition();
  }, { passive: false });
}

// タッチ操作（1本指: 回転/タップ, 2本指: ピンチズーム）
function bindTouch(dom) {
  dom.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      startDrag(e.touches[0], 'orbit');
    } else if (e.touches.length === 2) {
      camCtrl.isDragging = false;
      camCtrl.pinchDist = getPinchDistance(e.touches);
    }
  }, { passive: true });

  dom.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && camCtrl.isDragging) {
      const { dx, dy } = consumeDrag(e.touches[0]);
      if (camCtrl.mode === 'vr') lookVR(dx, dy, 0.0055);
      else orbit(dx, dy, 0.007);
      updateCameraPosition();
    } else if (e.touches.length === 2) {
      const dist = getPinchDistance(e.touches);
      if (camCtrl.pinchDist > 0) {
        zoom(camCtrl.pinchDist / Math.max(1, dist));
        updateCameraPosition();
      }
      camCtrl.pinchDist = dist;
    }
  }, { passive: true });

  dom.addEventListener('touchend', (e) => {
    if (camCtrl.isDragging && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      if (isClick(t, 8)) handleViewportClick(t.clientX, t.clientY);
    }
    camCtrl.isDragging = false;
    camCtrl.pinchDist = 0;
  });
}

export function bindPointerControls(dom) {
  bindMouse(dom);
  bindTouch(dom);
}
