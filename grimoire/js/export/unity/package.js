// .unitypackage の書き出し:
//   Assets/MyAssets/GameObjects/Grimoire/<名前>/  Prefab・テクスチャ1枚・マテリアル1つ・Meshes/
//   Assets/MyAssets/Scripts/U#/Grimoire/          ページを切り替える UdonSharp
// GUID は名前から決まるので、同じ名前で出し直して取り込むと参照を保ったまま中身が更新される。
import { state } from '../../state.js';
import { showToast } from '../../ui/toast.js';
import { downloadDataUrl } from '../download.js';
import { stableGuid } from '../../../../shared/guid.js';
import { makeUnityPackage } from '../../../../shared/unitypackage.js';
import { MESH_FILE_ID } from '../../../../shared/unity-yaml.js';
import { createAtlas } from './atlas.js';
import { buildBookMeshes } from './book-meshes.js';
import { createUvMeshAsset } from './mesh.js';
import {
  createPrefab, createMaterial, createProgramAsset, nativeMeta, prefabMeta, scriptMeta, textureMeta
} from './assets.js';

const BOOK_DIR = 'Assets/MyAssets/GameObjects/Grimoire';
const SCRIPT_DIR = 'Assets/MyAssets/Scripts/U#/Grimoire';

export const safeName = title => String(title || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Grimoire';

export function canvasToPngBytes(canvas) {
  const bin = atob(canvas.toDataURL('image/png').split(',')[1]);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export async function buildAssets() {
  const name = safeName(state.bookTitle);
  const dir = `${BOOK_DIR}/${name}`;
  const assets = [];
  const add = (key, pathname, createMeta, content) => {
    const guid = stableGuid(`grimoire|${key}`);
    assets.push({ guid, pathname, meta: createMeta(guid), ...content });
    return guid;
  };

  // 解説ページの文字がフォントの読み込み前に描かれないようにする
  await document.fonts?.ready;
  const atlas = createAtlas();
  const { parts, collider } = buildBookMeshes(atlas);

  const textureGuid = add(`${name}|texture`, `${dir}/${name}.png`, textureMeta,
    { bytes: canvasToPngBytes(atlas.canvas) });
  const materialGuid = add(`${name}|material`, `${dir}/${name}.mat`, g => nativeMeta(g, 2100000),
    { text: createMaterial(name, textureGuid) });
  for (const part of parts) {
    const meshName = `${name}_${part.name}`;
    part.meshGuid = add(`${name}|mesh|${part.name}`, `${dir}/Meshes/${meshName}.asset`,
      g => nativeMeta(g, MESH_FILE_ID), { text: createUvMeshAsset(meshName, part.mesh) });
  }
  add(`${name}|prefab`, `${dir}/${name}.prefab`, prefabMeta,
    { text: createPrefab(name, parts, materialGuid, collider) });

  // スクリプトはすべての本で共通
  const response = await fetch(new URL('../../../unity/GrimoireBook.cs', import.meta.url));
  if (!response.ok) throw new Error(`GrimoireBook.cs を読み込めませんでした (${response.status})`);
  const scriptGuid = add('script', `${SCRIPT_DIR}/GrimoireBook.cs`, scriptMeta, { text: await response.text() });
  add('program', `${SCRIPT_DIR}/GrimoireBook.asset`, g => nativeMeta(g, 11400000),
    { text: createProgramAsset('GrimoireBook', scriptGuid) });

  return { name, assets };
}

export async function exportUnityPackage() {
  try {
    showToast('UnityPackageを生成中...');
    const { name, assets } = await buildAssets();
    const blob = new Blob([await makeUnityPackage(assets)], { type: 'application/gzip' });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${name}.unitypackage`);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('.unitypackage を書き出しました');
  } catch (err) {
    console.error('UnityPackage export error:', err);
    showToast('UnityPackageの書き出しに失敗しました');
  }
}
