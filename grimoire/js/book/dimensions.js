// 本の寸法と左右の厚み
import { STACK_MIN_FRAC } from '../config.js';
import { state } from '../state.js';

export function getBookDims() {
  let w = 2.05;
  let h = 2.75;
  if (state.proportion === 'tall') {
    w = 1.85;
    h = 3.05;
  } else if (state.proportion === 'square') {
    w = 2.35;
    h = 2.40;
  } else if (state.proportion === 'wide') {
    w = 2.55;
    h = 2.10;
  }
  const t = state.thickness;
  const halfT = t * 0.5;
  const minT = t * STACK_MIN_FRAC;
  const maxT = t * (1 - STACK_MIN_FRAC);
  const seamY = minT * 0.78;
  const coverThick = 0.085;
  const spineFullW = t + coverThick * 2;
  const pageW = w - 0.14;
  const pageH = h - 0.18;
  return { w, h, t, halfT, minT, maxT, seamY, coverThick, spineFullW, pageW, pageH };
}

/**
 * Computes normalized thickness ratio (0 = first spread, 1 = last spread)
 * and exact left/right stack thicknesses.
 */
export function getStackThicknesses(dims) {
  const maxIdx = Math.max(1, state.spreads.length - 1);
  const ratio = Math.max(0, Math.min(1, state.spreadVisual / maxIdx));
  const leftT = dims.minT + (dims.maxT - dims.minT) * ratio;
  const rightT = dims.t - leftT;
  return { ratio, leftT, rightT, seamY: dims.seamY };
}

export function getStackSlope(stackT, dims) {
  const val = (stackT - dims.seamY) / dims.pageW;
  return Math.asin(Math.max(-0.48, Math.min(0.48, val)));
}
