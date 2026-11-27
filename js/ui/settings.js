// 入力欄の id と state のキーを対応させる（両者は同名）
import { state } from '../state.js';
import { generateArena } from '../generation/generateArena.js';
import { resetCameraOverview } from '../camera/views.js';
import { rebuildScene } from '../render/rebuildScene.js';

// 変更時にステージを再生成する項目
const REGENERATE_INPUTS = [
  'previewRoom', 'roomCount', 'roomSize', 'cellSize', 'seed',
  'coverBlockSize', 'coverDensity', 'wallHeight',
  'jumpPadCount', 'sawCount', 'floorTrapCount', 'conveyorCount', 'enemiesPerRoom'
];
// 見た目の再構築だけで反映できる項目
const REBUILD_INPUTS = [
  'magmaDepth', 'magmaMargin', 'roomWallHeight', 'pedestalHeight'
];
const REGENERATE_CHECKBOXES = ['autoTraps'];
const REBUILD_CHECKBOXES = ['showDoors', 'showDetails', 'showGridOverlay'];

// 文字列のまま state に入れる項目（それ以外は数値化）
const STRING_KEYS = new Set(['previewRoom']);

function apply(regenerate) {
  if (regenerate) generateArena();
  rebuildScene();
}

// 表示する部屋を切り替えたら全体が見える視点に戻す
function bindRoomView() {
  document.getElementById('previewRoom').addEventListener('input', resetCameraOverview);
}

function bindInput(id, regenerate) {
  const el = document.getElementById(id);
  const valEl = document.getElementById(id + 'Val');
  el.addEventListener('input', () => {
    state[id] = STRING_KEYS.has(id) ? el.value : Number(el.value);
    if (valEl) valEl.textContent = el.value;
    apply(regenerate);
  });
}

function bindCheckbox(id, regenerate) {
  const el = document.getElementById(id);
  el.addEventListener('change', () => {
    state[id] = el.checked;
    if (id === 'autoTraps') {
      document.getElementById('trapAutoSettings').classList.toggle('opacity-45', !el.checked);
    }
    apply(regenerate);
  });
}

export function bindSettings() {
  REGENERATE_INPUTS.forEach(id => bindInput(id, true));
  REBUILD_INPUTS.forEach(id => bindInput(id, false));
  REGENERATE_CHECKBOXES.forEach(id => bindCheckbox(id, true));
  REBUILD_CHECKBOXES.forEach(id => bindCheckbox(id, false));
  bindRoomView(); // 再生成の後に実行されるよう最後に登録する
}
