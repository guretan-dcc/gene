// 起動処理
import { initThree, animate } from './scene/scene.js';
import { bindViewportControls } from './scene/controls.js';
import { showToast } from './ui/toast.js';
import { renderPresets, renderBgSwatches, renderSpreadButtons, syncControlsFromState, syncPageEditorFromState, updateNavUI } from './ui/panels.js';
import { bindUI } from './ui/bindings.js';

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
  } catch (err) {
    console.error('Initialization error:', err);
    showToast('初期化中にエラーが発生しました');
  }
};
