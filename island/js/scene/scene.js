import { clamp } from '../utils/math.js';

// =========================================================================
// 3. Three.js シーン & カメラ制御
// =========================================================================
export const canvas = document.getElementById('sceneCanvas');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x161d26);
scene.fog = new THREE.FogExp2(0x161d26, 0.0011);

export const camera = new THREE.PerspectiveCamera(48, 1, 0.3, 2500);

const hemiLight = new THREE.HemisphereLight(0xe2f1ff, 0x3d312a, 0.78);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xfffbeb, 0.96);
dirLight.position.set(110, 185, 95);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 10;
dirLight.shadow.camera.far = 550;
const dBound = 165;
dirLight.shadow.camera.left = -dBound;
dirLight.shadow.camera.right = dBound;
dirLight.shadow.camera.top = dBound;
dirLight.shadow.camera.bottom = -dBound;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(420, 28, 0x2d3848, 0x1e2631);
gridHelper.position.y = -28;
scene.add(gridHelper);

export const worldGroup = new THREE.Group();
scene.add(worldGroup);

export const camState = {
    target: new THREE.Vector3(0, 12, 0),
    theta: -0.58,
    phi: 1.06,
    radius: 155,
    isDown: false,
    button: 0,
    lastX: 0,
    lastY: 0
};

export function updateCamera() {
    const phi = clamp(camState.phi, 0.10, Math.PI * 0.48);
    camera.position.set(
        camState.target.x + camState.radius * Math.sin(phi) * Math.sin(camState.theta),
        camState.target.y + camState.radius * Math.cos(phi),
        camState.target.z + camState.radius * Math.sin(phi) * Math.cos(camState.theta)
    );
    camera.lookAt(camState.target);
}

export let routeEditState = {
    enabled: true,
    soloIsland: false,
    activeTab: 'island',
    riverDraw: false,     // 川タブ表示中: ダブルクリックで川の点を置く
    activeRiver: 0,
    draggingHandle: null, // { islandIdx, role, wpIdx, lastClientY }
    selectedGizmo: null   // { islandIdx, role, wpIdx, segKey }
};
export const routeHandleMeshes = [];
export const segmentToggleMeshes = [];
export const raycaster = new THREE.Raycaster();
