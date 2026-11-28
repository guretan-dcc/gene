// アニメーションループ
import { state } from '../state.js';
import { camCtrl } from '../camera/cameraState.js';
import { updateVRWalk } from '../camera/walk.js';
import { view } from './context.js';

function animateTrap(item, t) {
  if (item.type === 'jumppad') {
    const pulse = (Math.sin(t * 4 + item.phase) + 1) * 0.5;
    item.mesh.position.y = item.baseY + pulse * 0.55;
    item.mesh.scale.setScalar(0.85 + pulse * 0.35);
  } else if (item.type === 'saw') {
    const u = (Math.sin(t * item.speed * 2.1 + item.phase) + 1) * 0.5;
    item.mesh.position.x = item.x0 + (item.x1 - item.x0) * u;
    item.mesh.rotation.y = t * 14;
  } else if (item.type === 'fire') {
    const cycle = Math.sin(t * 2.2 + item.phase);
    const active = cycle > 0.15;
    item.mesh.visible = active;
    if (active) {
      const s = 0.75 + Math.sin(t * 18 + item.phase) * 0.25;
      item.mesh.scale.set(1, s, 1);
      item.mesh.position.y = item.baseY + (item.maxH * s) / 2;
    }
  } else if (item.type === 'spike') {
    const cycle = Math.sin(t * 2.0 + item.phase);
    const ext = cycle > 0.2 ? 1 : 0;
    item.mesh.position.y = item.baseY + ext * item.riseH;
  } else if (item.type === 'conveyor') {
    const flow = ((t * 1.8) % 1.0) - 0.5;
    item.mesh.position.x = item.baseX + item.dirX * flow * item.span;
    item.mesh.position.z = item.baseZ + item.dirZ * flow * item.span;
  }
}

export function startAnimationLoop() {
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (camCtrl.mode === 'vr') updateVRWalk(dt);

    if (state.animateTraps) {
      for (const item of view.animatedItems) animateTrap(item, t);
    }

    view.renderer.render(view.scene, view.camera);
  }

  animate();
}
