// Three.js の共有オブジェクト
export const view = {
  scene: null,
  camera: null,
  renderer: null,
  groups: {},               // 用途別の THREE.Group
  pickableMeshes: [],       // クリック判定対象
  animatedItems: [],        // アニメーションするトラップ
  playerMarkerGroup: null
};
