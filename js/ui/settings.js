// 入力欄の id と state のキーを対応させる（両者は同名）
import { state } from '../state.js';
import { generateArena } from '../generation/generateArena.js';
import { rebuildScene } from '../render/rebuildScene.js';

// 変更時にアリーナを再生成する項目
const REGENERATE_INPUTS = [
  'preset', 'symmetry', 'gridWidth', 'gridDepth', 'cellSize', 'seed',
  'coverBlockSize', 'coverDensity', 'wallHeight',
  'jumpPadCount', 'sawCount', 'floorTrapCount', 'conveyorCount',
  'enemyCount', 'safeRadius'
];
// 見た目の再構築だけで反映できる項目
const REBUILD_INPUTS = [
  'chamberShape', 'tier', 'magmaDepth', 'chasmGap', 'magmaMargin', 'outerWallHeight', 'pedestalHeight'
];
const REGENERATE_CHECKBOXES = ['autoSlopes', 'autoTraps'];
const REBUILD_CHECKBOXES = ['outerWallEnabled', 'previewCutFrontWall', 'showArenaDecor', 'showGridOverlay'];

// 文字列のまま state に入れる項目（それ以外は数値化）
const STRING_KEYS = new Set(['preset', 'chamberShape', 'tier', 'symmetry']);

function apply(regenerate) {
  if (regenerate) generateArena();
  rebuildScene();
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
}
