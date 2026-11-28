// マウス・タッチ・キー操作
import { camOrbit } from '../state.js';
import { startPageFlip } from '../animation/flip.js';
import { handleResize } from './scene.js';
import { toggleBookOpen } from '../ui/panels.js';

export function bindViewportControls() {
  const canvas = document.getElementById('gl-canvas');

  canvas.addEventListener('mousedown', e => {
    camOrbit.isDragging = true;
    camOrbit.prevX = e.clientX;
    camOrbit.prevY = e.clientY;
  });

  window.addEventListener('mousemove', e => {
    if (!camOrbit.isDragging) return;
    const dx = e.clientX - camOrbit.prevX;
    const dy = e.clientY - camOrbit.prevY;
    camOrbit.prevX = e.clientX;
    camOrbit.prevY = e.clientY;
    camOrbit.targetTheta -= dx * 0.008;
    camOrbit.targetPhi = Math.max(0.18, Math.min(Math.PI - 0.18, camOrbit.targetPhi - dy * 0.008));
  });

  window.addEventListener('mouseup', () => {
    camOrbit.isDragging = false;
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    camOrbit.targetRadius = Math.max(3.6, Math.min(12.5, camOrbit.targetRadius + e.deltaY * 0.004));
  }, { passive: false });

  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      camOrbit.isDragging = true;
      camOrbit.prevX = e.touches[0].clientX;
      camOrbit.prevY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      camOrbit.isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      camOrbit.pinchDist = Math.hypot(dx, dy);
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && camOrbit.isDragging) {
      const dx = e.touches[0].clientX - camOrbit.prevX;
      const dy = e.touches[0].clientY - camOrbit.prevY;
      camOrbit.prevX = e.touches[0].clientX;
      camOrbit.prevY = e.touches[0].clientY;
      camOrbit.targetTheta -= dx * 0.009;
      camOrbit.targetPhi = Math.max(0.18, Math.min(Math.PI - 0.18, camOrbit.targetPhi - dy * 0.009));
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (camOrbit.pinchDist > 0) {
        const delta = camOrbit.pinchDist - dist;
        camOrbit.targetRadius = Math.max(3.6, Math.min(12.5, camOrbit.targetRadius + delta * 0.015));
      }
      camOrbit.pinchDist = dist;
    }
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    camOrbit.isDragging = false;
    camOrbit.pinchDist = 0;
  });

  window.addEventListener('keydown', e => {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'ArrowRight') {
      startPageFlip(1);
    } else if (e.code === 'ArrowLeft') {
      startPageFlip(-1);
    } else if (e.code === 'Space') {
      e.preventDefault();
      toggleBookOpen();
    }
  });

  window.addEventListener('resize', handleResize);
}
