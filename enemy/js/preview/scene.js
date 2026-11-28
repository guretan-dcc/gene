// プレビュー用のシーン・視点操作・モデルの差し替え
const view = { yaw: 0.6, pitch: 0.18, distance: 4.2, targetY: 0.95 };
let renderer, scene, camera, robot = null;
let material = null;
export const joints = new Map(); // 部品名 → Object3D

export function initScene(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0d14');
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404858, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  scene.add(new THREE.GridHelper(8, 16, 0x334155, 0x1e293b)); // 1マス 0.5m
  material = new THREE.MeshLambertMaterial({ vertexColors: true });
  bindControls(canvas);
  window.addEventListener('resize', resize);
  resize();
}

function resize() {
  const { clientWidth: w, clientHeight: h } = renderer.domElement.parentElement;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function toGeometry(mesh) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(mesh.colors, 3));
  geo.setIndex(mesh.indices);
  return geo;
}

export function showRobot(parts, height) {
  if (robot) {
    scene.remove(robot);
    for (const object of joints.values()) object.children.filter(c => c.isMesh).forEach(c => c.geometry.dispose());
  }
  joints.clear();
  robot = new THREE.Group();
  for (const part of parts) {
    const joint = new THREE.Group();
    joint.position.set(...part.position);
    joint.userData.rest = [...part.position];
    joint.add(new THREE.Mesh(toGeometry(part.mesh), material));
    (joints.get(part.parent) || robot).add(joint);
    joints.set(part.name, joint);
  }
  scene.add(robot);
  view.targetY = height * 0.52;
}

export function resetCamera(height) {
  Object.assign(view, { yaw: 0.6, pitch: 0.18, distance: height * 2.4, targetY: height * 0.52 });
}

export function render() {
  const flat = Math.cos(view.pitch) * view.distance;
  camera.position.set(Math.sin(view.yaw) * flat, view.targetY + Math.sin(view.pitch) * view.distance, Math.cos(view.yaw) * flat);
  camera.lookAt(0, view.targetY, 0);
  renderer.render(scene, camera);
}

// ドラッグで回転、ホイール・2本指でズーム
function bindControls(canvas) {
  const pointers = new Map();
  const zoom = factor => { view.distance = Math.min(14, Math.max(1.2, view.distance * factor)); };
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  canvas.addEventListener('pointermove', e => {
    const last = pointers.get(e.pointerId);
    if (!last) return;
    const before = pointers.size === 2 ? spread() : 0;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      view.yaw -= dx * 0.008;
      view.pitch = Math.min(1.3, Math.max(-0.3, view.pitch + dy * 0.006));
    } else if (before > 0) {
      zoom(before / Math.max(1, spread()));
    }
  });
  const release = e => pointers.delete(e.pointerId);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoom(Math.exp(e.deltaY * 0.001));
  }, { passive: false });
}
