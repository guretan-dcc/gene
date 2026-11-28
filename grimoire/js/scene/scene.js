// シーン・ライト・カメラ・描画ループ
import { state, camOrbit, flipAnim } from '../state.js';
import { createToonGradientTexture } from '../book/materials.js';
import { buildBook } from '../book/build.js';
import { updateBookPose } from '../animation/pose.js';
import { updateFlipAnimation } from '../animation/flip.js';
import { rig } from '../rig.js';

let lastTime = 0;

export function initThree() {
  const container = document.getElementById('viewport-container');
  const canvas = document.getElementById('gl-canvas');

  rig.scene = new THREE.Scene();
  rig.scene.background = new THREE.Color(state.bgColor);

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  rig.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);

  rig.renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  rig.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  rig.renderer.setSize(width, height, false);
  rig.renderer.outputEncoding = THREE.LinearEncoding;

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8a857d, 0.56);
  rig.scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfffaf2, 0.56);
  keyLight.position.set(5, 9, 6);
  rig.scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xeef2f7, 0.24);
  fillLight.position.set(-5, 4, -5);
  rig.scene.add(fillLight);

  rig.toonGradientTex = createToonGradientTexture();
  buildBook();
  updateCameraPosition();
}

export function updateCameraPosition() {
  const sinPhi = Math.sin(camOrbit.phi);
  const x = camOrbit.radius * sinPhi * Math.sin(camOrbit.theta);
  const y = camOrbit.radius * Math.cos(camOrbit.phi);
  const z = camOrbit.radius * sinPhi * Math.cos(camOrbit.theta);
  rig.camera.position.set(x, y, z);
  rig.camera.lookAt(0, 0.12, 0);
}

export function handleResize() {
  const container = document.getElementById('viewport-container');
  if (!container || !rig.renderer || !rig.camera) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w === 0 || h === 0) return;
  rig.camera.aspect = w / h;
  rig.camera.updateProjectionMatrix();
  rig.renderer.setSize(w, h, false);
}

export function animate(now) {
  requestAnimationFrame(animate);
  const timeSec = (now || 0) * 0.001;
  const dt = Math.min(0.05, Math.max(0.001, timeSec - lastTime));
  lastTime = timeSec;

  let poseDirty = false;

  // Smooth book open / close interpolation
  const openDiff = state.openTarget - state.openCurrent;
  if (Math.abs(openDiff) > 0.0005) {
    state.openCurrent += openDiff * Math.min(1, dt * 8.5);
    if (Math.abs(state.openTarget - state.openCurrent) < 0.001) {
      state.openCurrent = state.openTarget;
    }
    poseDirty = true;
  }

  // Smooth stack thickness transition when jumping spreads via the editor tab
  if (!flipAnim.active && !flipAnim.manualScrub) {
    const spreadDiff = state.currentSpread - state.spreadVisual;
    if (Math.abs(spreadDiff) > 0.0005) {
      state.spreadVisual += spreadDiff * Math.min(1, dt * 9.0);
      if (Math.abs(state.currentSpread - state.spreadVisual) < 0.001) {
        state.spreadVisual = state.currentSpread;
      }
      poseDirty = true;
    }
  }

  if (poseDirty) {
    updateBookPose();
  }

  // Page turning animation
  updateFlipAnimation(dt);

  // Optional auto-rotate
  if (state.autoRotate && !camOrbit.isDragging) {
    camOrbit.targetTheta += dt * 0.45;
  }

  // Smooth damped rig.camera orbit
  camOrbit.theta += (camOrbit.targetTheta - camOrbit.theta) * Math.min(1, dt * 10);
  camOrbit.phi += (camOrbit.targetPhi - camOrbit.phi) * Math.min(1, dt * 10);
  camOrbit.radius += (camOrbit.targetRadius - camOrbit.radius) * Math.min(1, dt * 10);
  updateCameraPosition();

  rig.renderer.render(rig.scene, rig.camera);
}
