// クイックサイズ切替ボタン（VR Hyperdome適正スケール含む）
import { state } from '../state.js';
import { generateArena } from '../generation/generateArena.js';
import { rebuildScene } from '../render/rebuildScene.js';
import { camCtrl } from '../camera/cameraState.js';
import { resetCameraOverview, setCameraVREyeView } from '../camera/views.js';
import { showToast } from './toast.js';

// data-size と data-vr-preset の値の並び順
const SIZE_KEYS = ['roomLayers', 'branchCount', 'roomSize', 'corridorLength', 'cellSize'];
// スケールに応じて連動調整する項目
const VR_PRESET_KEYS = ['enemiesPerRoom', 'magmaDepth', 'chasmGap', 'outerWallHeight'];

// カンマ区切りの値を state と入力欄の両方へ反映
function applyValues(keys, csv) {
  const values = csv.split(',').map(Number);
  keys.forEach((key, i) => {
    state[key] = values[i];
    document.getElementById(key).value = values[i];
    document.getElementById(key + 'Val').textContent = values[i];
  });
}

function applySizePreset(btn) {
  applyValues(SIZE_KEYS, btn.dataset.size);
  if (btn.dataset.vrPreset) applyValues(VR_PRESET_KEYS, btn.dataset.vrPreset);

  generateArena();
  rebuildScene();
  if (camCtrl.mode === 'vr') {
    setCameraVREyeView();
  } else {
    resetCameraOverview();
  }

  const { gridWidth: w, gridDepth: d, cellSize: s } = state;
  showToast(`サイズ変更: ${(w * s).toFixed(0)}m×${(d * s).toFixed(0)}m`);
}

export function bindSizePresets() {
  document.querySelectorAll('.quick-size-btn').forEach(btn => {
    btn.addEventListener('click', () => applySizePreset(btn));
  });
}
