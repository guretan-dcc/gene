// パネルの表示と状態の同期
import { PRESETS, BG_PRESETS } from '../data/presets.js';
import { state, flipAnim } from '../state.js';
import { buildBook } from '../book/build.js';
import { refreshPageTextures, updateBookPose } from '../animation/pose.js';
import { endManualScrub, startPageFlipTo } from '../animation/flip.js';
import { rig } from '../rig.js';

export function applyBackground(hex) {
  state.bgColor = hex;
  if (rig.scene) rig.scene.background = new THREE.Color(hex);
  document.body.style.backgroundColor = hex;

  const bgInfo = BG_PRESETS.find(b => b.hex.toLowerCase() === hex.toLowerCase());
  const titleEl = document.getElementById('viewport-title');
  if (titleEl) {
    titleEl.className = bgInfo && bgInfo.dark
      ? 'text-xs font-semibold tracking-wide text-white/80'
      : 'text-xs font-semibold tracking-wide text-neutral-700/80';
  }
  renderBgSwatches();
}

export function renderPresets() {
  const grid = document.getElementById('preset-grid');
  if (!grid) return;
  grid.innerHTML = '';

  PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'flex items-center gap-2 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-md px-2 py-1.5 text-left transition';
    btn.innerHTML = `
          <span class="w-3.5 h-3.5 rounded-sm shrink-0 border border-black/15" style="background:${p.coverColor}"></span>
          <span class="text-xs text-neutral-700 font-medium truncate">${p.name}</span>
        `;
    btn.addEventListener('click', () => {
      state.bookTitle = p.bookTitle;
      state.coverColor = p.coverColor;
      state.metalColor = p.metalColor;
      state.paperColor = p.paperColor;
      state.corners = p.corners;
      state.coverPattern = p.coverPattern || 'arcane';
      state.emblem = p.emblem;
      state.tabs = p.tabs;
      syncControlsFromState();
      buildBook();
    });
    grid.appendChild(btn);
  });
}

export function renderBgSwatches() {
  const wrap = document.getElementById('bg-swatches');
  if (!wrap) return;
  wrap.innerHTML = '';

  BG_PRESETS.forEach(bg => {
    const active = state.bgColor.toLowerCase() === bg.hex.toLowerCase();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = bg.name;
    btn.className = `w-5 h-5 rounded-full border transition ${active ? 'ring-2 ring-neutral-800 ring-offset-1 border-black/20' : 'border-black/20 hover:scale-110'}`;
    btn.style.backgroundColor = bg.hex;
    btn.addEventListener('click', () => applyBackground(bg.hex));
    wrap.appendChild(btn);
  });
}

export function renderSpreadButtons() {
  const group = document.getElementById('spread-selector-group');
  if (!group) return;
  group.innerHTML = '';

  state.spreads.forEach((_, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.spread = String(idx);
    btn.textContent = String(idx + 1);
    btn.className = 'spread-select-btn px-2 py-1 rounded-md text-xs font-medium transition';
    btn.addEventListener('click', () => {
      if (flipAnim.active || idx === state.currentSpread) return;
      if (state.openTarget > 0.5 && state.openCurrent > 0.92) {
        startPageFlipTo(idx);
      } else {
        endManualScrub();
        state.currentSpread = idx;
        state.spreadVisual = idx;
        refreshPageTextures();
        updateBookPose();
        syncPageEditorFromState();
        updateNavUI();
      }
    });
    group.appendChild(btn);
  });
}

export function syncControlsFromState() {
  document.getElementById('ctrl-cover-color').value = state.coverColor;
  document.getElementById('ctrl-metal-color').value = state.metalColor;
  document.getElementById('ctrl-paper-color').value = state.paperColor;
  document.getElementById('ctrl-book-title').value = state.bookTitle;
  document.getElementById('ctrl-proportion').value = state.proportion;
  document.getElementById('ctrl-thickness').value = state.thickness;
  document.getElementById('val-thickness').textContent = Number(state.thickness).toFixed(2);
  document.getElementById('ctrl-corners').value = state.corners;
  document.getElementById('ctrl-cover-pattern').value = state.coverPattern;
  document.getElementById('ctrl-emblem').value = state.emblem;
  document.getElementById('ctrl-tabs').checked = state.tabs;
  document.getElementById('ctrl-flat').checked = state.flatShading;
  document.getElementById('ctrl-autorotate').checked = state.autoRotate;
}

export function syncPageEditorFromState() {
  const spread = state.spreads[state.currentSpread];
  if (!spread) return;

  document.getElementById('ctrl-left-type').value = spread.left.type;
  document.getElementById('ctrl-left-title').value = spread.left.title;
  document.getElementById('ctrl-left-items').value = spread.left.items.join(', ');

  document.getElementById('ctrl-right-type').value = spread.right.type;
  document.getElementById('ctrl-right-title').value = spread.right.title;
  document.getElementById('ctrl-right-items').value = spread.right.items.join(', ');

  document.querySelectorAll('.spread-select-btn').forEach(btn => {
    const idx = Number(btn.dataset.spread);
    if (idx === state.currentSpread) {
      btn.className = 'spread-select-btn px-2 py-1 rounded-md text-xs font-medium transition bg-neutral-900 text-white';
    } else {
      btn.className = 'spread-select-btn px-2 py-1 rounded-md text-xs font-medium transition bg-neutral-100 text-neutral-600 hover:bg-neutral-200';
    }
  });
}

export function updateNavUI() {
  const isOpen = state.openTarget > 0.5;
  document.getElementById('open-btn-label').textContent = isOpen ? '閉じる' : '開く';
  document.getElementById('btn-prev-page').disabled = !isOpen || state.currentSpread === 0;
  document.getElementById('btn-next-page').disabled = !isOpen || state.currentSpread >= state.spreads.length - 1;
  document.getElementById('spread-indicator').textContent = `${state.currentSpread + 1} / ${state.spreads.length}`;
}

export function toggleBookOpen() {
  if (flipAnim.active) return;
  endManualScrub();
  state.openTarget = state.openTarget > 0.5 ? 0.0 : 1.0;
  updateNavUI();
}

export function randomizeBook() {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const coverPalette = ['#7c2d36', '#2c3e5a', '#345947', '#4a3b5c', '#6b442a', '#2f353d', '#5c3a3a', '#2e4f4f'];
  const metalPalette = ['#d4a853', '#c9b37e', '#c9974c', '#9aa4b2', '#b98862'];
  const paperPalette = ['#dcd0b8', '#d8d1c2', '#daceb5', '#d2c9b8'];
  const titles = ['GRIMOIRE', 'ARCANA', 'SPELLBOOK', 'CODEX', 'RUNE TOME', 'CHRONICLE'];

  state.coverColor = pick(coverPalette);
  state.metalColor = pick(metalPalette);
  state.paperColor = pick(paperPalette);
  state.bookTitle = pick(titles);
  state.corners = pick(['chunky', 'round', 'none']);
  state.coverPattern = pick(['arcane', 'classic', 'royal', 'minimal']);
  state.emblem = pick(['compass', 'moon', 'ring', 'crest', 'none']);
  state.thickness = Number((0.36 + Math.random() * 0.42).toFixed(2));
  state.tabs = Math.random() > 0.25;

  syncControlsFromState();
  buildBook();
}
