// パネルの操作
import { state, camOrbit, flipAnim } from '../state.js';
import { getBookDims } from '../book/dimensions.js';
import { buildBook } from '../book/build.js';
import { refreshPageTextures, applyPageStackShapeKeys, applyTurningShapeKeys } from '../animation/pose.js';
import { prepareTurningTextures, endManualScrub, startPageFlip } from '../animation/flip.js';
import { updateNavUI, toggleBookOpen, randomizeBook } from './panels.js';
import { exportCanvasPNG, exportSpreadTexture } from '../export/image.js';
import { exportOBJ, exportGLB } from '../export/models.js';
import { copyJSON, applyJSON } from '../export/settings-json.js';
import { exportUnityPackage } from '../export/unity/package.js';
import { rig } from '../rig.js';

export function bindUI() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        const active = b.dataset.tab === tab;
        b.classList.toggle('tab-btn-active', active);
        b.classList.toggle('tab-btn-inactive', !active);
      });
      document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('hidden', panel.id !== `panel-${tab}`);
      });
    });
  });

  // Camera view shortcuts
  document.getElementById('btn-cam-spread').addEventListener('click', () => {
    state.openTarget = 1.0;
    camOrbit.targetTheta = 0.0;
    camOrbit.targetPhi = 0.72;
    camOrbit.targetRadius = 6.8;
    updateNavUI();
  });

  document.getElementById('btn-cam-side').addEventListener('click', () => {
    state.openTarget = 1.0;
    camOrbit.targetTheta = 0.0;
    camOrbit.targetPhi = 1.24;
    camOrbit.targetRadius = 6.0;
    updateNavUI();
  });

  document.getElementById('btn-cam-cover').addEventListener('click', () => {
    state.openTarget = 0.0;
    camOrbit.targetTheta = 0.35;
    camOrbit.targetPhi = 0.72;
    camOrbit.targetRadius = 5.4;
    updateNavUI();
  });

  // Playback bar
  document.getElementById('btn-toggle-open').addEventListener('click', toggleBookOpen);
  document.getElementById('btn-prev-page').addEventListener('click', () => startPageFlip(-1));
  document.getElementById('btn-next-page').addEventListener('click', () => startPageFlip(1));

  // Appearance controls
  document.getElementById('btn-randomize').addEventListener('click', randomizeBook);

  document.getElementById('ctrl-cover-color').addEventListener('input', e => {
    state.coverColor = e.target.value;
    buildBook();
  });
  document.getElementById('ctrl-metal-color').addEventListener('input', e => {
    state.metalColor = e.target.value;
    buildBook();
  });
  document.getElementById('ctrl-paper-color').addEventListener('input', e => {
    state.paperColor = e.target.value;
    buildBook();
  });
  document.getElementById('ctrl-book-title').addEventListener('input', e => {
    state.bookTitle = e.target.value;
    buildBook();
  });
  document.getElementById('ctrl-proportion').addEventListener('change', e => {
    state.proportion = e.target.value;
    buildBook();
  });
  document.getElementById('ctrl-thickness').addEventListener('input', e => {
    state.thickness = parseFloat(e.target.value);
    document.getElementById('val-thickness').textContent = state.thickness.toFixed(2);
    buildBook();
  });
  document.getElementById('ctrl-corners').addEventListener('change', e => {
    state.corners = e.target.value;
    buildBook();
  });
  document.getElementById('ctrl-cover-pattern').addEventListener('change', e => {
    state.coverPattern = e.target.value;
    buildBook();
  });
  document.getElementById('ctrl-emblem').addEventListener('change', e => {
    state.emblem = e.target.value;
    buildBook();
  });
  document.getElementById('ctrl-tabs').addEventListener('change', e => {
    state.tabs = e.target.checked;
    buildBook();
  });
  document.getElementById('ctrl-flat').addEventListener('change', e => {
    state.flatShading = e.target.checked;
    buildBook();
  });
  document.getElementById('ctrl-autorotate').addEventListener('change', e => {
    state.autoRotate = e.target.checked;
  });

  const updatePageField = (side, field, value) => {
    const page = state.spreads[state.currentSpread][side];
    if (field === 'items') {
      page.items = value.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      page[field] = value;
    }
    refreshPageTextures();
  };

  document.getElementById('ctrl-left-type').addEventListener('change', e => updatePageField('left', 'type', e.target.value));
  document.getElementById('ctrl-left-title').addEventListener('input', e => updatePageField('left', 'title', e.target.value));
  document.getElementById('ctrl-left-items').addEventListener('input', e => updatePageField('left', 'items', e.target.value));

  document.getElementById('ctrl-right-type').addEventListener('change', e => updatePageField('right', 'type', e.target.value));
  document.getElementById('ctrl-right-title').addEventListener('input', e => updatePageField('right', 'title', e.target.value));
  document.getElementById('ctrl-right-items').addEventListener('input', e => updatePageField('right', 'items', e.target.value));

  // Export & JSON buttons
  document.getElementById('btn-export-unitypackage').addEventListener('click', exportUnityPackage);
  document.getElementById('btn-export-glb').addEventListener('click', exportGLB);
  document.getElementById('btn-export-png').addEventListener('click', () => exportCanvasPNG(true));
  document.getElementById('btn-export-png-bg').addEventListener('click', () => exportCanvasPNG(false));
  document.getElementById('btn-export-obj').addEventListener('click', exportOBJ);
  document.getElementById('btn-export-spread-tex').addEventListener('click', exportSpreadTexture);

  // Manual Shape Key scrub test for inspecting Turn_00..Turn_100 frame-by-frame
  document.getElementById('ctrl-flip-scrub').addEventListener('input', e => {
    if (flipAnim.active) return;
    const p = parseFloat(e.target.value);
    const valEl = document.getElementById('val-flip-scrub');

    if (p <= 0.001) {
      endManualScrub();
      return;
    }

    if (state.openTarget < 0.5) {
      state.openTarget = 1.0;
      state.openCurrent = 1.0;
      updateNavUI();
    }

    const nextIdx = state.currentSpread < state.spreads.length - 1
      ? state.currentSpread + 1
      : Math.max(0, state.currentSpread - 1);

    if (!flipAnim.manualScrub) {
      flipAnim.manualScrub = true;
      const fromIdx = nextIdx > state.currentSpread ? state.currentSpread : nextIdx;
      const toIdx = nextIdx > state.currentSpread ? nextIdx : state.currentSpread;
      prepareTurningTextures(fromIdx, toIdx);
      rig.turningPageGroup.visible = true;
    }

    flipAnim.scrubProgress = p;
    const baseSpread = nextIdx > state.currentSpread ? state.currentSpread : nextIdx;
    state.spreadVisual = baseSpread + p;
    if (valEl) valEl.textContent = `${Math.round(p * 100)}%`;

    applyTurningShapeKeys(p);
    applyPageStackShapeKeys(getBookDims(), state.openCurrent);
  });

  document.getElementById('btn-copy-json').addEventListener('click', copyJSON);
  document.getElementById('btn-toggle-import').addEventListener('click', () => {
    document.getElementById('json-import-box').classList.toggle('hidden');
  });
  document.getElementById('btn-apply-json').addEventListener('click', applyJSON);
}
