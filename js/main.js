/**
 * ボクセルステージ ジェネレーター
 * 入口 → 戦闘部屋 → … → ボス部屋を、折れ曲がる通路と扉で一本道につなぐ。
 * 地形は Greedy Meshing でローポリ化し、PLY（地形）と JSON（配置）を書き出す。
 */

import { view } from './render/context.js';
import { setupScene } from './render/setupScene.js';
import { rebuildScene } from './render/rebuildScene.js';
import { startAnimationLoop } from './render/animate.js';
import { generateArena } from './generation/generateArena.js';
import { resetCameraOverview } from './camera/views.js';
import { bindWalkKeys } from './camera/walk.js';
import { bindPointerControls } from './input/pointerControls.js';
import { bindUI } from './ui/bindUI.js';
import { restoreSettings, bindSettingsStorage } from './ui/storage.js';

try {
  setupScene(document.getElementById('viewport'));
  bindPointerControls(view.renderer.domElement);
  bindWalkKeys();
  bindUI();
  restoreSettings();
  bindSettingsStorage();
  generateArena();
  rebuildScene();
  resetCameraOverview();
  startAnimationLoop();
} catch (err) {
  console.error('初期化エラー:', err);
}
