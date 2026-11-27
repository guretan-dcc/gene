// .unitypackage 書き出し。地形ジェネレーター(gene)と同じ構成:
//   Assets/MyAssets/GameObjects/Stages/<ステージ名>/<ステージ名>.prefab
//   Assets/MyAssets/GameObjects/Stages/<ステージ名>/Meshes/*.asset
// Prefab の子は部屋・通路ごとのオブジェクト（表示の切り替え単位）で、それぞれ判定用の MeshCollider を持つ。
// GUID はステージ名から決まるので、同じ名前で出し直して取り込むと参照を保ったまま中身が更新される。
import { arena } from '../state.js';
import { showToast } from '../ui/toast.js';
import { downloadFile } from './download.js';
import { getChunkName } from './filename.js';
import { collectChunkGeometries, collectColliderGeometries, collectMagma } from './chunkGeometry.js';
import { createMeshAsset, createPrefab, MESH_FILE_ID } from './unityYaml.js';
import { createUnityPackage } from './unitypackage.js';
import { stableGuid } from './guid.js';

// プロジェクトの共有マテリアル LowPolyVertexColor.mat
const MATERIAL_GUID = '4b6c0ee4556d04f4ba685ab776a31dad';

function getStageName() {
  const input = document.getElementById('stageName').value;
  return input.replace(/[\\/:*?"<>|]/g, '_').trim() || 'ArenaStage';
}

function buildAssets(stage) {
  const dir = `Assets/MyAssets/GameObjects/Stages/${stage}`;
  const assets = [];

  // メッシュを1つ .asset にして GUID を返す
  const addMesh = (key, geos) => {
    const name = `${stage}_${key}`;
    const guid = stableGuid(`${stage}|mesh|${key}`);
    assets.push({
      guid,
      pathname: `${dir}/Meshes/${name}.asset`,
      text: createMeshAsset(name, geos),
      meta: `fileFormatVersion: 2\nguid: ${guid}\nNativeFormatImporter:\n  externalObjects: {}\n  mainObjectFileID: ${MESH_FILE_ID}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`
    });
    return guid;
  };

  const objects = arena.chunks.map(chunk => {
    const name = getChunkName(chunk);
    return {
      name,
      meshGuid: addMesh(name, collectChunkGeometries(chunk.id)),
      colliderGuid: addMesh(`${name}_collider`, collectColliderGeometries(chunk.id))
    };
  });
  const magma = collectMagma();
  if (magma.length > 0) objects.push({ name: 'magma', meshGuid: addMesh('magma', magma) });

  const prefabGuid = stableGuid(`${stage}|prefab`);
  assets.push({
    guid: prefabGuid,
    pathname: `${dir}/${stage}.prefab`,
    text: createPrefab(stage, objects, MATERIAL_GUID),
    meta: `fileFormatVersion: 2\nguid: ${prefabGuid}\nPrefabImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`
  });
  return assets;
}

export async function exportUnityPackage() {
  try {
    const stage = getStageName();
    const blob = await createUnityPackage(buildAssets(stage));
    downloadFile(`${stage}.unitypackage`, blob);
    showToast(`${stage}.unitypackage を書き出しました`);
  } catch (err) {
    console.error(err);
    showToast('unitypackage書き出し中にエラーが発生しました');
  }
}
