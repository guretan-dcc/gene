// .unitypackage 書き出し。地形ジェネレーター(gene)と同じ構成:
//   Assets/MyAssets/GameObjects/Stages/<ステージ名>/<ステージ名>.prefab
//   Assets/MyAssets/GameObjects/Stages/<ステージ名>/Meshes/*.asset
//   Assets/MyAssets/GameObjects/Stages/Editor/StageSpawnSetup.cs（開始位置を設定するメニュー）
// Prefab の子は部屋・通路ごとのオブジェクト（表示の切り替え単位）で、それぞれ判定用の MeshCollider を持つ。
// GUID はステージ名から決まるので、同じ名前で出し直して取り込むと参照を保ったまま中身が更新される。
import { arena } from '../state.js';
import { getLayerHeight, getPlayerPadHeight, cellCenterX, cellCenterZ } from '../core/grid.js';
import { showToast } from '../ui/toast.js';
import { downloadFile } from './download.js';
import { getChunkName } from './filename.js';
import { isChecked, collectChunkGeometries, collectColliderGeometries, collectMagma } from './chunkGeometry.js';
import { createMeshAsset, createPrefab, MESH_FILE_ID } from './unityYaml.js';
import { createUnityPackage } from './unitypackage.js';
import { stableGuid } from './guid.js';

// プロジェクトの共有マテリアル LowPolyVertexColor.mat
const MATERIAL_GUID = '4b6c0ee4556d04f4ba685ab776a31dad';
const STAGES_DIR = 'Assets/MyAssets/GameObjects/Stages';
const EDITOR_SCRIPT = new URL('../../unity/StageSpawnSetup.cs', import.meta.url);

// 自機の開始位置（台座を含めるときはその上）
function getSpawnPosition() {
  const cell = arena.grid.flat().find(c => c.spawn === 'player');
  const padHeight = isChecked('includePedestals') ? getPlayerPadHeight() : 0;
  return {
    x: Number(cellCenterX(cell.x).toFixed(3)),
    y: Number((cell.height * getLayerHeight() + padHeight).toFixed(3)),
    z: Number(cellCenterZ(cell.z).toFixed(3))
  };
}

// 開始位置を設定するエディタースクリプト（全ステージ共通）
async function createEditorScriptAsset() {
  const response = await fetch(EDITOR_SCRIPT);
  if (!response.ok) throw new Error(`StageSpawnSetup.cs を読み込めません (${response.status})`);
  const guid = stableGuid('stageGenerator|editor|StageSpawnSetup');
  return {
    guid,
    pathname: `${STAGES_DIR}/Editor/StageSpawnSetup.cs`,
    text: await response.text(),
    meta: `fileFormatVersion: 2\nguid: ${guid}\nMonoImporter:\n  externalObjects: {}\n  serializedVersion: 2\n  defaultReferences: []\n  executionOrder: 0\n  icon: {instanceID: 0}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`
  };
}

function getStageName() {
  const input = document.getElementById('stageName').value;
  return input.replace(/[\\/:*?"<>|]/g, '_').trim() || 'ArenaStage';
}

function buildAssets(stage) {
  const dir = `${STAGES_DIR}/${stage}`;
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
    text: createPrefab(stage, objects, MATERIAL_GUID, getSpawnPosition()),
    meta: `fileFormatVersion: 2\nguid: ${prefabGuid}\nPrefabImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`
  });
  return assets;
}

export async function exportUnityPackage() {
  try {
    const stage = getStageName();
    const blob = await createUnityPackage([...buildAssets(stage), await createEditorScriptAsset()]);
    downloadFile(`${stage}.unitypackage`, blob);
    showToast(`${stage}.unitypackage を書き出しました`);
  } catch (err) {
    console.error(err);
    showToast('unitypackage書き出し中にエラーが発生しました');
  }
}
