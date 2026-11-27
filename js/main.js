/**
 * ============================================================================
 * 縦長・超巨大・超ローポリ（3D Greedy Meshing）ボクセルアリーナ ジェネレーター
 * ============================================================================
 * 主な設計ポイント：
 * 1. 超縦長・超巨大化：奥行き最大105マス × 1マス6m（最大630m級）まで対応。
 * 2. 3D Greedy Meshing による徹底的なローポリ化：
 *    - 隣接隠蔽面と底面(-Y)を完全カリング。
 *    - 同色・同一平面上の露出面を2D矩形へ貪欲結合し、1つの BufferGeometry へ統合。
 *    - 広大なマグマ海はたった2ポリゴン（1クワッド）で描画・出力。
 * 3. 超高壁＆プレビュー時手前壁下げ機能：
 *    - 外周の転落防止ガード壁はデフォルト12層（最大30層）まで高く設定可能。
 *    - プレビュー時は見やすさのため手前壁（+Z側）だけを床の高さまで低く表示。
 *    - PLY書き出し時は自動的に全周4面フル高さの壁として出力。
 * 4. 広大マグマ＆転落防止設計：
 *    - 細かい落とし穴は作らず、視認しやすい大きなマグマ池＋幅3マス以上の安全な縦断通路を保証。
 * 5. 敵台座＋自機後端スタート（近接・遠距離の2種）：
 *    - 敵は底面カリング済みの統合ローポリ2段台座の上に配置。
 *    - 自機は最後端中央（z = D - 1, x = center）のスタートパッドから前方(-Z)向きで開始。
 * 6. Clone Drone 風ギミック＆Tier演出：
 *    - ジャンプパッド、往復回転ノコギリ、ベルトコンベア、間欠火炎＆スパイク床、高台スロープ、実況ブース。
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
