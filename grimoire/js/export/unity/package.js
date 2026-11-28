// .unitypackage の書き出し
import { state } from '../../state.js';
import { createPageCanvas } from '../../textures/pages.js';
import { showToast } from '../../ui/toast.js';
import { downloadDataUrl } from '../download.js';
import { generateUnityGuid, createUnityMeta } from './meta.js';
import { serializeBookForUnity } from './serialize.js';
import { rig } from '../../rig.js';
import { makeUnityPackage } from '../../../../shared/unitypackage.js';

const encoder = new TextEncoder();
const utf8Bytes = str => encoder.encode(str);

// unity/ に置いたスクリプトと説明書を読み込んで同梱する
async function loadTemplate(file) {
  const response = await fetch(new URL(`../../../unity/${file}`, import.meta.url));
  if (!response.ok) throw new Error(`${file} を読み込めませんでした (${response.status})`);
  return response.text();
}

export function canvasToPngBytes(canvas) {
  const dataUrl = canvas.toDataURL('image/png');
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function exportUnityPackage() {
  try {
    showToast('UnityPackageを生成中...');
    const pkgAssets = [];
    const addAsset = (unityPath, bytes, metaKind, metaOpts) => {
      const guid = generateUnityGuid();
      pkgAssets.push({
        guid,
        pathname: unityPath,
        bytes: bytes instanceof Uint8Array ? bytes : utf8Bytes(String(bytes)),
        meta: createUnityMeta(metaKind, guid, metaOpts)
      });
    };

    // 1. Serialize current 3D model, hierarchy & BlendShapes
    const unityBookData = serializeBookForUnity();
    addAsset('Assets/GrimoireForge/Data/grimoire_data.json', JSON.stringify(unityBookData), 'text');

    // 2. Render & bundle all cover / spine / page-edge PNG textures
    addAsset('Assets/GrimoireForge/Textures/Cover_Front.png', canvasToPngBytes(rig.frontCoverTex.image), 'texture', { alpha: true });
    addAsset('Assets/GrimoireForge/Textures/Cover_Back.png', canvasToPngBytes(rig.backCoverTex.image), 'texture', { alpha: true });
    addAsset('Assets/GrimoireForge/Textures/Cover_Spine.png', canvasToPngBytes(rig.spineCoverTex.image), 'texture', { alpha: true });
    addAsset('Assets/GrimoireForge/Textures/Page_Edge.png', canvasToPngBytes(rig.leftEdgeTex.image), 'texture', { alpha: false, repeat: true });

    // 3. Render & bundle all spreads (2 PNG pages per spread)
    for (let s = 0; s < state.spreads.length; s++) {
      const sp = state.spreads[s];
      const numL = String(s * 2 + 1).padStart(2, '0');
      const numR = String(s * 2 + 2).padStart(2, '0');
      const canvasL = createPageCanvas(sp.left, true, s * 2 + 1);
      const canvasR = createPageCanvas(sp.right, false, s * 2 + 2);
      addAsset(`Assets/GrimoireForge/Textures/Page_${numL}.png`, canvasToPngBytes(canvasL), 'texture', { alpha: false });
      addAsset(`Assets/GrimoireForge/Textures/Page_${numR}.png`, canvasToPngBytes(canvasR), 'texture', { alpha: false });
    }

    // 4. Bundle Standard Unity Controller, VRChat UdonSharp Controller, Auto Prefab Builder & README
    addAsset('Assets/GrimoireForge/Scripts/GrimoireBookController.cs', await loadTemplate('GrimoireBookController.cs'), 'script');
    addAsset('Assets/GrimoireForge/Scripts/GrimoireBookUdon.cs', await loadTemplate('GrimoireBookUdon.cs'), 'script');
    addAsset('Assets/GrimoireForge/Editor/GrimoireBookBuilder.cs', await loadTemplate('GrimoireBookBuilder.cs'), 'script');
    addAsset('Assets/GrimoireForge/README.txt', await loadTemplate('README.txt'), 'text');

    // 5. Pack into UnityPackage (<guid>/asset, asset.meta, pathname)
    const gzBytes = await makeUnityPackage(pkgAssets);

    const safeName = (state.bookTitle || 'GrimoireBook').replace(/[^a-zA-Z0-9_-]/g, '_') || 'GrimoireBook';
    const blob = new Blob([gzBytes], { type: 'application/gzip' });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${safeName}.unitypackage`);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('.unitypackage を書き出しました');
  } catch (err) {
    console.error('UnityPackage export error:', err);
    showToast('UnityPackageの書き出しに失敗しました');
  }
}
