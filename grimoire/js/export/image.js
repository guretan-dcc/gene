// PNG書き出し
import { state } from '../state.js';
import { createPageCanvas } from '../textures/pages.js';
import { showToast } from '../ui/toast.js';
import { downloadDataUrl } from './download.js';
import { rig } from '../rig.js';

export function exportCanvasPNG(transparent) {
  const prevBg = rig.scene.background;
  if (transparent) {
    rig.scene.background = null;
    rig.renderer.setClearColor(0x000000, 0);
  }
  rig.renderer.render(rig.scene, rig.camera);
  const dataUrl = rig.renderer.domElement.toDataURL('image/png');
  if (transparent) {
    rig.scene.background = prevBg;
  }
  rig.renderer.render(rig.scene, rig.camera);
  downloadDataUrl(dataUrl, transparent ? 'grimoire-transparent.png' : 'grimoire.png');
  showToast(transparent ? '透過PNGを保存しました' : 'PNG画像を保存しました');
}

export function exportSpreadTexture() {
  const spread = state.spreads[state.currentSpread];
  const leftC = createPageCanvas(spread.left, true, state.currentSpread * 2 + 1);
  const rightC = createPageCanvas(spread.right, false, state.currentSpread * 2 + 2);

  const out = document.createElement('canvas');
  out.width = leftC.width + rightC.width;
  out.height = leftC.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(leftC, 0, 0);
  ctx.drawImage(rightC, leftC.width, 0);

  downloadDataUrl(out.toDataURL('image/png'), `grimoire-spread-${state.currentSpread + 1}.png`);
  showToast('見開きテクスチャを保存しました');
}
