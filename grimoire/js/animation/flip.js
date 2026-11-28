// ページめくり
import { state, flipAnim } from '../state.js';
import { getBookDims } from '../book/dimensions.js';
import { createPageTexture } from '../textures/pages.js';
import { refreshPageTextures, applyPageStackShapeKeys, applyTurningShapeKeys, updateBookPose } from './pose.js';
import { syncPageEditorFromState, updateNavUI } from '../ui/panels.js';
import { rig } from '../rig.js';

export function prepareTurningTextures(fromIdx, toIdx) {
  const dir = toIdx > fromIdx ? 1 : -1;
  const cur = state.spreads[fromIdx];
  const nxt = state.spreads[toIdx];

  if (rig.turningFrontMat.map && rig.turningFrontMat.map !== rig.leftPageTex && rig.turningFrontMat.map !== rig.rightPageTex) {
    rig.turningFrontMat.map.dispose();
  }
  if (rig.turningBackMat.map && rig.turningBackMat.map !== rig.leftPageTex && rig.turningBackMat.map !== rig.rightPageTex) {
    rig.turningBackMat.map.dispose();
  }

  if (dir === 1) {
    // Peeling right page (cur.right) over to land on left (nxt.left), revealing nxt.right underneath
    rig.turningFrontMat.map = createPageTexture(cur.right, false, fromIdx * 2 + 2);
    rig.turningBackMat.map = createPageTexture(nxt.left, true, toIdx * 2 + 1);

    const oldRight = rig.rightPageTex;
    rig.rightPageTex = createPageTexture(nxt.right, false, toIdx * 2 + 2);
    rig.rightPageMesh.material.map = rig.rightPageTex;
    rig.rightPageMesh.material.needsUpdate = true;
    if (oldRight) oldRight.dispose();
  } else {
    // Peeling left page (cur.left) back to land on right (nxt.right), revealing nxt.left underneath
    rig.turningBackMat.map = createPageTexture(cur.left, true, fromIdx * 2 + 1);
    rig.turningFrontMat.map = createPageTexture(nxt.right, false, toIdx * 2 + 2);

    const oldLeft = rig.leftPageTex;
    rig.leftPageTex = createPageTexture(nxt.left, true, toIdx * 2 + 1);
    rig.leftPageMesh.material.map = rig.leftPageTex;
    rig.leftPageMesh.material.needsUpdate = true;
    if (oldLeft) oldLeft.dispose();
  }

  rig.turningFrontMat.needsUpdate = true;
  rig.turningBackMat.needsUpdate = true;
}

export function endManualScrub() {
  if (!flipAnim.manualScrub) return;
  flipAnim.manualScrub = false;
  flipAnim.scrubProgress = 0;
  if (rig.turningPageGroup) rig.turningPageGroup.visible = false;
  const scrubEl = document.getElementById('ctrl-flip-scrub');
  const scrubVal = document.getElementById('val-flip-scrub');
  if (scrubEl) scrubEl.value = '0';
  if (scrubVal) scrubVal.textContent = 'OFF';
  state.spreadVisual = state.currentSpread;
  refreshPageTextures();
  updateBookPose();
}

export function startPageFlipTo(targetSpread) {
  if (flipAnim.active) return;
  if (state.openTarget < 0.5 || state.openCurrent < 0.92) return;
  if (targetSpread < 0 || targetSpread >= state.spreads.length || targetSpread === state.currentSpread) return;

  endManualScrub();
  const dir = targetSpread > state.currentSpread ? 1 : -1;
  prepareTurningTextures(state.currentSpread, targetSpread);

  flipAnim.active = true;
  flipAnim.dir = dir;
  flipAnim.progress = 0;
  flipAnim.fromSpread = state.currentSpread;
  flipAnim.nextSpread = targetSpread;
  rig.turningPageGroup.visible = true;
  applyTurningShapeKeys(dir === 1 ? 0 : 1);
  applyPageStackShapeKeys(getBookDims(), state.openCurrent);
}

export function startPageFlip(dir) {
  startPageFlipTo(state.currentSpread + dir);
}

export function updateFlipAnimation(dt) {
  if (!flipAnim.active) return;

  flipAnim.progress += dt * 1.75;
  if (flipAnim.progress >= 1.0) {
    flipAnim.active = false;
    flipAnim.progress = 0;
    rig.turningPageGroup.visible = false;
    state.currentSpread = flipAnim.nextSpread;
    state.spreadVisual = state.currentSpread;
    refreshPageTextures();
    updateBookPose();
    syncPageEditorFromState();
    updateNavUI();
  } else {
    const t = flipAnim.progress;
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const p = flipAnim.dir === 1 ? ease : 1 - ease;
    state.spreadVisual = flipAnim.fromSpread + (flipAnim.nextSpread - flipAnim.fromSpread) * ease;
    applyTurningShapeKeys(p);
    applyPageStackShapeKeys(getBookDims(), state.openCurrent);
  }
}
