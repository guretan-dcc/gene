// サイドバーとビューポートボタンのイベント登録
import { state } from '../state.js';
import { createRng } from '../core/random.js';
import { generateArena } from '../generation/generateArena.js';
import { assignEnemySpawns } from '../generation/enemies.js';
import { rebuildScene } from '../render/rebuildScene.js';
import { camCtrl } from '../camera/cameraState.js';
import { resetCameraOverview, setCameraPlayerView, setCameraVREyeView } from '../camera/views.js';
import { exportPLY } from '../export/ply.js';
import { exportJSON } from '../export/json.js';
import { showToast } from './toast.js';
import { bindSettings } from './settings.js';
import { bindSizePresets } from './sizePresets.js';

function onClick(id, handler) {
  document.getElementById(id).addEventListener('click', handler);
}

function regenerate() {
  generateArena();
  rebuildScene();
}

function toggleClickMode() {
  state.clickMode = state.clickMode === 'enemy' ? 'trap' : 'enemy';
  const isEnemy = state.clickMode === 'enemy';
  document.getElementById('btnClickMode').textContent = isEnemy ? 'クリック編集: 敵スポーン' : 'クリック編集: トラップ配置';
  document.getElementById('clickModeDesc').textContent = isEnemy
    ? '敵スポーン切替（なし → 近接 → 遠距離）'
    : 'トラップ配置（なし → ジャンプ → 炎 → スパイク → コンベア）';
  showToast(isEnemy ? 'クリック編集: 敵スポーンモード' : 'クリック編集: トラップ配置モード');
}

function toggleVREyeView() {
  if (camCtrl.mode === 'vr') {
    resetCameraOverview();
    showToast('全体視点に戻りました');
  } else {
    setCameraVREyeView();
  }
}

export function bindUI() {
  bindSettings();
  bindSizePresets();

  onClick('btnGenerate', () => {
    regenerate();
    showToast('アリーナを再生成しました');
  });
  onClick('btnRandomSeed', () => {
    state.seed = Math.floor(Math.random() * 99999);
    document.getElementById('seed').value = state.seed;
    regenerate();
    showToast(`シード値 ${state.seed} で生成しました`);
  });
  onClick('btnRespawnEnemies', () => {
    assignEnemySpawns(createRng(Date.now() & 0xffff));
    rebuildScene();
    showToast('敵スポーン位置を再抽選しました');
  });

  onClick('btnExportPLY', exportPLY);
  onClick('btnExportJSON', exportJSON);

  onClick('btnClickMode', toggleClickMode);
  onClick('btnResetCamera', resetCameraOverview);
  onClick('btnPlayerCamera', setCameraPlayerView);
  onClick('btnVREyeCamera', toggleVREyeView);
}
