// トゥーンマテリアル
import { state } from '../state.js';
import { rig } from '../rig.js';

export function createToonGradientTexture() {
  const colors = new Uint8Array([
    148, 148, 148, 255,
    212, 212, 212, 255,
    255, 255, 255, 255
  ]);
  const tex = new THREE.DataTexture(colors, 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function makeToonMat(colorHex) {
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(colorHex),
    gradientMap: rig.toonGradientTex,
    flatShading: state.flatShading
  });
}
