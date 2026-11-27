// Three.js の共有オブジェクト
export const view = {
  scene: null,
  camera: null,
  renderer: null,
  stage: null,              // 区画グループとマグマの親
  chunkGroups: [],          // 区画ごとの THREE.Group
  gridOverlay: null,
  pickableMeshes: [],       // クリック判定対象
  animatedItems: [],        // アニメーションするトラップ
  playerMarkerGroup: null
};
