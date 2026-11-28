// 長さが変わらないページの曲線
import { PAGE_ARCH_AMP } from '../config.js';
import { getStackSlope } from './dimensions.js';

/**
 * Integrates a constant-arc-length open page curve of exact length pageW.
 * Guarantees UV coordinates stay 1:1 with paper distance (zero texture stretch).
 */
export function sampleOpenPageCurve(segX, stackT, dims) {
  const slope = getStackSlope(stackT, dims);
  const ds = dims.pageW / segX;
  const pts = new Array(segX + 1);
  let x = 0;
  let y = dims.seamY;
  pts[0] = { x, y, theta: slope + PAGE_ARCH_AMP };

  for (let i = 0; i < segX; i++) {
    const sMid = (i + 0.5) / segX;
    const thetaMid = slope + PAGE_ARCH_AMP * (1 - 2 * sMid);
    x += Math.cos(thetaMid) * ds;
    y += Math.sin(thetaMid) * ds;
    const sEnd = (i + 1) / segX;
    pts[i + 1] = { x, y, theta: slope + PAGE_ARCH_AMP * (1 - 2 * sEnd) };
  }
  return pts;
}

/**
 * Integrates a constant-arc-length turning page curve at progress p in [0, 1].
 * At p=0 it matches the right open page arch exactly; at p=1 it mirrors onto the left arch.
 */
export function sampleTurnPageCurve(segX, p, dims) {
  const slopeMid = getStackSlope(dims.halfT, dims);
  const ds = dims.pageW / segX;
  const pts = new Array(segX + 1);
  let x = 0;
  let y = 0;

  const evalTheta = s => {
    const t0 = slopeMid + PAGE_ARCH_AMP * (1 - 2 * s);
    const t1 = (Math.PI - slopeMid) - PAGE_ARCH_AMP * (1 - 2 * s);
    const curlWave = Math.sin(p * Math.PI) * 0.30 * (2 * s - 1);
    return t0 * (1 - p) + t1 * p + curlWave;
  };

  pts[0] = { x, y, theta: evalTheta(0) };
  for (let i = 0; i < segX; i++) {
    const sMid = (i + 0.5) / segX;
    const thetaMid = evalTheta(sMid);
    x += Math.cos(thetaMid) * ds;
    y += Math.sin(thetaMid) * ds;
    pts[i + 1] = { x, y, theta: evalTheta((i + 1) / segX) };
  }
  return pts;
}

/**
 * Linearly samples a precomputed curve array at u in [0, 1].
 */
export function evalCurveAt(pts, u) {
  const clamped = Math.max(0, Math.min(1, u));
  const f = clamped * (pts.length - 1);
  const i0 = Math.min(pts.length - 1, Math.floor(f));
  const i1 = Math.min(pts.length - 1, i0 + 1);
  const frac = f - i0;
  return {
    x: pts[i0].x * (1 - frac) + pts[i1].x * frac,
    y: pts[i0].y * (1 - frac) + pts[i1].y * frac,
    theta: pts[i0].theta * (1 - frac) + pts[i1].theta * frac
  };
}
