// 開閉とシェイプキーの反映
import { TURN_STAGE_COUNT } from '../config.js';
import { state, flipAnim } from '../state.js';
import { getBookDims, getStackThicknesses, getStackSlope } from '../book/dimensions.js';
import { createPageTexture } from '../textures/pages.js';
import { getTabSpreads, getTabPlacement } from '../book/edge.js';
import { rig } from '../rig.js';

export function refreshPageTextures() {
  const spread = state.spreads[state.currentSpread];
  if (!spread || !rig.leftPageMesh || !rig.rightPageMesh) return;

  const oldLeft = rig.leftPageTex;
  const oldRight = rig.rightPageTex;

  rig.leftPageTex = createPageTexture(spread.left, true, state.currentSpread * 2 + 1);
  rig.rightPageTex = createPageTexture(spread.right, false, state.currentSpread * 2 + 2);

  rig.leftPageMesh.material.map = rig.leftPageTex;
  rig.leftPageMesh.material.needsUpdate = true;

  rig.rightPageMesh.material.map = rig.rightPageTex;
  rig.rightPageMesh.material.needsUpdate = true;

  if (oldLeft) oldLeft.dispose();
  if (oldRight) oldRight.dispose();
}

/**
 * Drives left/right page stack & UI page meshes purely via GPU MorphTarget weights.
 * Bilinear blend:
 *   Basis = Closed_Thin
 *   [0] Closed_Thick = (1 - open) * r
 *   [1] Open_Thin    = open * (1 - r)
 *   [2] Open_Thick   = open * r
 */
export function applyPageStackShapeKeys(dims, open) {
  if (!rig.leftBlockMesh || !rig.rightBlockMesh || !rig.leftPageMesh || !rig.rightPageMesh) return;

  const { ratio, leftT, rightT } = getStackThicknesses(dims);
  const rLeft = ratio;
  const rRight = 1 - ratio;

  const wLeft = [
    (1 - open) * rLeft,
    open * (1 - rLeft),
    open * rLeft
  ];
  const wRight = [
    (1 - open) * rRight,
    open * (1 - rRight),
    open * rRight
  ];

  for (let i = 0; i < 3; i++) {
    rig.leftBlockMesh.morphTargetInfluences[i] = wLeft[i];
    rig.leftPageMesh.morphTargetInfluences[i] = wLeft[i];
    rig.rightBlockMesh.morphTargetInfluences[i] = wRight[i];
    rig.rightPageMesh.morphTargetInfluences[i] = wRight[i];
  }

  // Sync side page-layer stripe density with stack thickness (anchored at bottom cover)
  if (rig.leftEdgeTex) {
    rig.leftEdgeTex.repeat.set(1, Math.max(0.35, leftT * 4.2));
  }
  if (rig.rightEdgeTex) {
    rig.rightEdgeTex.repeat.set(1, Math.max(0.35, rightT * 4.2));
  }

  // 見出しタブを束の端に合わせる
  const tabSpreads = getTabSpreads(state.spreads);
  rig.tabMeshes.forEach((pair, i) => {
    if (i >= tabSpreads.length) return;
    const at = getTabPlacement(dims, open, i, tabSpreads, state.spreadVisual, state.spreads.length);
    pair.left.visible = at.left;
    pair.right.visible = !at.left;
    (at.left ? pair.left : pair.right).position.set(at.x, at.y, at.z);
  });

  // Keep turning page hinge anchored at spine seamY
  if (rig.turningPageGroup) {
    rig.turningPageGroup.position.set(0, dims.seamY + 0.009, 0);
  }

  updateShapeKeyReadout(wLeft, flipAnim.active || flipAnim.manualScrub ? getActiveTurnProgress() : null);
}

export function getActiveTurnProgress() {
  if (flipAnim.manualScrub) return flipAnim.scrubProgress;
  const t = flipAnim.progress;
  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return flipAnim.dir === 1 ? ease : 1 - ease;
}

/**
 * Drives the turning page purely via its 6 progressive Shape Keys (Turn_17..Turn_100)
 * plus a spine-pivot tilt that matches both left & right dynamic stack heights seamlessly.
 */
export function applyTurningShapeKeys(p) {
  if (!rig.turningFrontMesh || !rig.turningBackMesh || !rig.turningPageGroup) return;
  const clamped = Math.max(0, Math.min(1, p));
  const scaled = clamped * TURN_STAGE_COUNT;
  const seg = Math.min(TURN_STAGE_COUNT - 1, Math.floor(scaled));
  const alpha = scaled - seg;

  for (let i = 0; i < TURN_STAGE_COUNT; i++) {
    rig.turningFrontMesh.morphTargetInfluences[i] = 0;
    rig.turningBackMesh.morphTargetInfluences[i] = 0;
  }

  // seg === 0 blends Basis (Turn_00) -> morph[0] (Turn_17)
  // seg > 0 blends morph[seg-1] -> morph[seg]
  if (seg === 0) {
    rig.turningFrontMesh.morphTargetInfluences[0] = alpha;
    rig.turningBackMesh.morphTargetInfluences[0] = alpha;
  } else {
    rig.turningFrontMesh.morphTargetInfluences[seg - 1] = 1 - alpha;
    rig.turningBackMesh.morphTargetInfluences[seg - 1] = 1 - alpha;
    rig.turningFrontMesh.morphTargetInfluences[seg] = alpha;
    rig.turningBackMesh.morphTargetInfluences[seg] = alpha;
  }

  // Exact rigid spine tilt so p=0 matches right stack slope and p=1 matches left stack slope
  const dims = getBookDims();
  const { leftT, rightT } = getStackThicknesses(dims);
  const slopeMid = getStackSlope(dims.halfT, dims);
  const slopeRight = getStackSlope(rightT, dims);
  const slopeLeft = getStackSlope(leftT, dims);
  rig.turningPageGroup.rotation.z = (slopeRight - slopeMid) * (1 - clamped) - (slopeLeft - slopeMid) * clamped;
}

export function updateShapeKeyReadout(wLeft, turnP) {
  const box = document.getElementById('shapekey-readout');
  if (!box) return;
  const stackLine = `LeftStack: Closed_Thick ${wLeft[0].toFixed(2)} | Open_Thin ${wLeft[1].toFixed(2)} | Open_Thick ${wLeft[2].toFixed(2)}`;
  let turnLine = 'TurnPage: 待機中 (非表示)';
  if (turnP !== null && rig.turningFrontMesh) {
    const names = ['Turn_17', 'Turn_33', 'Turn_50', 'Turn_67', 'Turn_83', 'Turn_100'];
    const activeParts = [];
    for (let i = 0; i < TURN_STAGE_COUNT; i++) {
      const w = rig.turningFrontMesh.morphTargetInfluences[i];
      if (w > 0.005) activeParts.push(`${names[i]} ${w.toFixed(2)}`);
    }
    if (activeParts.length === 0) activeParts.push('Turn_00 (Basis) 1.00');
    turnLine = `TurnPage: ${activeParts.join(' + ')}`;
  }
  box.innerHTML = `${stackLine}<br />${turnLine}`;
}

export function updateBookPose() {
  if (!rig.spineRig || !rig.leftCoverPivot || !rig.rightCoverPivot) return;
  const dims = getBookDims();
  const open = Math.max(0, Math.min(1, state.openCurrent));
  const foldAngle = (1.0 - open) * (Math.PI * 0.5);
  const sinA = Math.sin(foldAngle);

  rig.leftCoverPivot.position.set(-dims.halfT * sinA, 0, 0);
  rig.leftCoverPivot.rotation.z = -foldAngle;

  rig.rightCoverPivot.position.set(dims.halfT * sinA, 0, 0);
  rig.rightCoverPivot.rotation.z = foldAngle;

  if (rig.spineBoxMesh) {
    rig.spineBoxMesh.visible = sinA > 0.015;
    rig.spineBoxMesh.scale.set(Math.max(0.001, sinA), 1, 1);
  }

  rig.spineRig.rotation.z = -foldAngle;
  rig.spineRig.position.x = -dims.w * 0.5 * sinA;
  rig.spineRig.position.y = 0;

  applyPageStackShapeKeys(dims, open);
}
