// 設定JSONのコピーと読み込み
import { state } from '../state.js';
import { buildBook } from '../book/build.js';
import { showToast } from '../ui/toast.js';
import { applyBackground, renderSpreadButtons, syncControlsFromState, syncPageEditorFromState, updateNavUI } from '../ui/panels.js';

export function copyJSON() {
  const payload = {
    bookTitle: state.bookTitle,
    coverColor: state.coverColor,
    metalColor: state.metalColor,
    paperColor: state.paperColor,
    bgColor: state.bgColor,
    proportion: state.proportion,
    corners: state.corners,
    coverPattern: state.coverPattern,
    emblem: state.emblem,
    thickness: state.thickness,
    tabs: state.tabs,
    flatShading: state.flatShading,
    spreads: state.spreads
  };
  const text = JSON.stringify(payload, null, 2);
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('設定JSONをコピーしました');
  } catch (err) {
    showToast('コピーに失敗しました');
  }
  document.body.removeChild(ta);
}

export function applyJSON() {
  const raw = document.getElementById('json-import-input').value.trim();
  if (!raw) {
    showToast('JSONを入力してください');
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    const keys = [
      'bookTitle', 'coverColor', 'metalColor', 'paperColor',
      'bgColor', 'proportion', 'corners', 'coverPattern', 'emblem', 'thickness',
      'tabs', 'flatShading'
    ];
    keys.forEach(k => {
      if (parsed[k] !== undefined) state[k] = parsed[k];
    });
    if (state.emblem === 'gem') state.emblem = 'compass';
    if (state.emblem === 'star') state.emblem = 'compass';
    if (Array.isArray(parsed.spreads) && parsed.spreads.length > 0) {
      state.spreads = parsed.spreads;
      state.currentSpread = Math.min(state.currentSpread, state.spreads.length - 1);
      state.spreadVisual = state.currentSpread;
    }
    applyBackground(state.bgColor);
    renderSpreadButtons();
    syncControlsFromState();
    syncPageEditorFromState();
    updateNavUI();
    buildBook();
    showToast('設定を適用しました');
  } catch (err) {
    showToast('JSONの形式が正しくありません');
  }
}
