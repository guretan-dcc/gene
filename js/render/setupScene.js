import { view } from './context.js';

const GROUP_NAMES = ['terrain', 'outerWall', 'pedestal', 'slope', 'magma', 'trap', 'marker', 'decor', 'gridOverlay'];

export function setupScene(viewport) {
  view.scene = new THREE.Scene();
  view.scene.background = new THREE.Color(0x0a0d14);

  view.camera = new THREE.PerspectiveCamera(45, viewport.clientWidth / viewport.clientHeight, 0.5, 2500);
  view.renderer = new THREE.WebGLRenderer({ antialias: true });
  view.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  view.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  viewport.appendChild(view.renderer.domElement);

  const amb = new THREE.AmbientLight(0xffffff, 0.62);
  view.scene.add(amb);
  const dir1 = new THREE.DirectionalLight(0xffffff, 0.95);
  dir1.position.set(80, 160, 100);
  view.scene.add(dir1);
  const dir2 = new THREE.DirectionalLight(0x93c5fd, 0.35);
  dir2.position.set(-90, 70, -110);
  view.scene.add(dir2);

  for (const name of GROUP_NAMES) {
    view.groups[name] = new THREE.Group();
    view.scene.add(view.groups[name]);
  }

  window.addEventListener('resize', () => {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    if (w > 0 && h > 0) {
      view.camera.aspect = w / h;
      view.camera.updateProjectionMatrix();
      view.renderer.setSize(w, h);
    }
  });
}
