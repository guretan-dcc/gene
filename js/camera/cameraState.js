import { VR_EYE_HEIGHT } from '../config/constants.js';

// カメラ軌道制御状態（Orbit/Pan/Zoom + VR目線1.6mモード）
export const camCtrl = {
  mode: 'orbit',    // 'orbit' | 'vr'
  target: new THREE.Vector3(0, 0, 0),
  theta: 0.35,      // 水平角
  phi: 0.92,        // 天頂角 (0.1..1.52)
  radius: 50,
  minRadius: 8,
  maxRadius: 900,
  vrPos: new THREE.Vector3(0, VR_EYE_HEIGHT, 0),
  vrYaw: 0,         // 0 = 前方(-Z)
  vrPitch: -0.04,
  isDragging: false,
  dragMode: 'orbit', // 'orbit' | 'pan'
  lastX: 0,
  lastY: 0,
  downX: 0,
  downY: 0,
  pinchDist: 0
};
