// 状態に合わせてUI表示をそろえる
import { state } from '../state.js';
import { camCtrl } from '../camera/cameraState.js';
import { view } from '../render/context.js';

export function syncFrontWallUI() {
  const cut = state.previewCutFrontWall;
  document.getElementById('frontCutBadge').style.display = cut ? 'inline-block' : 'none';
  document.getElementById('previewCutFrontWall').checked = cut;
}

export function syncVREyeUI() {
  const isVR = camCtrl.mode === 'vr';
  const btn = document.getElementById('btnVREyeCamera');
  const badge = document.getElementById('vrEyeBadge');
  if (btn) {
    btn.textContent = `VR目線 (1.6m): ${isVR ? 'ON' : 'OFF'}`;
    btn.classList.toggle('bg-fuchsia-700/80', isVR);
    btn.classList.toggle('text-white', isVR);
    btn.classList.toggle('bg-slate-900/85', !isVR);
    btn.classList.toggle('text-fuchsia-300', !isVR);
  }
  if (badge) {
    badge.style.display = isVR ? 'inline-block' : 'none';
  }
  if (view.playerMarkerGroup) {
    view.playerMarkerGroup.visible = !isVR;
  }
}
