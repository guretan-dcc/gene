// .unitypackage 書き出し:
//   Assets/MyAssets/GameObjects/Enemies/<名前>/<名前>.prefab
//   Assets/MyAssets/GameObjects/Enemies/<名前>/Meshes/<名前>_<部品>.asset
// GUID は名前から決まるので、同じ名前で出し直して取り込むと参照を保ったまま中身が更新される。
import { createMeshAsset, MESH_FILE_ID } from '../../../shared/unity-yaml.js';
import { stableGuid } from '../../../shared/guid.js';
import { makeUnityPackage } from '../../../shared/unitypackage.js';
import { mirrorX, measureRobot, buildRobot } from '../model/robot.js';
import { createEnemyPrefab } from './prefab.js';

// プロジェクトの共有マテリアル LowPolyVertexColor.mat
const MATERIAL_GUID = '4b6c0ee4556d04f4ba685ab776a31dad';
const ENEMIES_DIR = 'Assets/MyAssets/GameObjects/Enemies';

export const safeName = name => String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Enemy';

// createMeshAsset が読む形(BufferGeometry と同じ読み出し方)にする
function toGeometry(mesh) {
  const attribute = array => ({
    count: array.length / 3,
    getX: i => array[i * 3],
    getY: i => array[i * 3 + 1],
    getZ: i => array[i * 3 + 2]
  });
  return {
    attributes: { position: attribute(mesh.positions), normal: attribute(mesh.normals), color: attribute(mesh.colors) },
    index: { count: mesh.indices.length, getX: i => mesh.indices[i] },
    dispose() {}
  };
}

function boundsOf(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  positions.forEach((v, i) => {
    min[i % 3] = Math.min(min[i % 3], v);
    max[i % 3] = Math.max(max[i % 3], v);
  });
  return { center: min.map((v, k) => (v + max[k]) / 2), size: min.map((v, k) => max[k] - v) };
}

export function buildAssets(settings) {
  const name = safeName(settings.name);
  const dir = `${ENEMIES_DIR}/${name}`;
  const parts = buildRobot(settings);
  const { max } = measureRobot(parts.filter(p => p.name !== 'Weapon' && p.name !== 'Shield'));
  const torso = boundsOf(parts.find(p => p.name === 'Torso').mesh.positions);
  const body = { radius: torso.size[0] * 0.55, height: max[1] };
  const assets = [];

  const prefabParts = parts.map(part => {
    // プレビューは右手系なので、Unity(左手系)で左右が入れ替わらないように x を反転する
    mirrorX(part.mesh);
    const key = part.name;
    const guid = stableGuid(`enemy|${name}|mesh|${key}`);
    assets.push({
      guid,
      pathname: `${dir}/Meshes/${name}_${key}.asset`,
      text: createMeshAsset(`${name}_${key}`, [toGeometry(part.mesh)]),
      meta: `fileFormatVersion: 2\nguid: ${guid}\nNativeFormatImporter:\n  externalObjects: {}\n  mainObjectFileID: ${MESH_FILE_ID}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`
    });
    return {
      name: key,
      parent: part.parent,
      position: [-part.position[0], part.position[1], part.position[2]],
      meshGuid: guid,
      trigger: key === 'Weapon' ? boundsOf(part.mesh.positions) : null
    };
  });

  const prefabGuid = stableGuid(`enemy|${name}|prefab`);
  assets.push({
    guid: prefabGuid,
    pathname: `${dir}/${name}.prefab`,
    text: createEnemyPrefab(name, prefabParts, MATERIAL_GUID, body),
    meta: `fileFormatVersion: 2\nguid: ${prefabGuid}\nPrefabImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`
  });
  return assets;
}

export async function createEnemyPackage(settings) {
  return new Blob([await makeUnityPackage(buildAssets(settings))], { type: 'application/gzip' });
}
