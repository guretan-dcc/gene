// 起動処理
import { initThree, animate } from './scene/scene.js';
import { bindViewportControls } from './scene/controls.js';
import { showToast } from './ui/toast.js';
import { renderPresets, renderBgSwatches, renderSpreadButtons, syncControlsFromState, syncPageEditorFromState, updateNavUI } from './ui/panels.js';
import { bindUI } from './ui/bindings.js';
import { buildBook } from './book/build.js';

window.onload = function () {
  try {
    renderPresets();
    renderBgSwatches();
    renderSpreadButtons();
    syncControlsFromState();
    syncPageEditorFromState();
    updateNavUI();
    initThree();
    bindViewportControls();
    bindUI();
    requestAnimationFrame(animate);
    // Webフォントが読み込まれたら、ページの文字を描き直す
    document.fonts?.ready.then(() => buildBook());
  } catch (err) {
    console.error('Initialization error:', err);
    showToast('初期化中にエラーが発生しました');
  }
};
