/**
 * ボクセルステージ ジェネレーター
 * 入口 → 戦闘部屋 → … → ボス部屋を通路と扉で連結する。中間の段は左右に分岐する。
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

try {
  setupScene(document.getElementById('viewport'));
  bindPointerControls(view.renderer.domElement);
  bindWalkKeys();
  bindUI();
  generateArena();
  rebuildScene();
  resetCameraOverview();
  startAnimationLoop();
} catch (err) {
  console.error('初期化エラー:', err);
}
