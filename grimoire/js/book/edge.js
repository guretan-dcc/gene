// ページの束の外側の端の位置と、見出しタブの配置
import { sampleOpenPageCurve } from './curves.js';

export const TAB_SIZE = { w: 0.2, h: 0.02, d: 0.24 };
export const TAB_COLORS = ['#c9974c', '#b85a52', '#52879e', '#5a8f6f', '#7b5b94', '#8c6142'];

// 見出しタブを付ける見開き番号。section の指定がなければ等間隔にする
export function getTabSpreads(spreads) {
  const marked = spreads.map((s, i) => (s.section ? i : -1)).filter(i => i >= 0);
  if (marked.length) return marked;
  const count = Math.min(4, spreads.length);
  return Array.from({ length: count }, (_, i) => Math.floor(i * spreads.length / count));
}

// ratio: 束の厚みの割合(0〜1)、v: 束の下からの高さの割合
function edgePoint(dims, ratio, open, v) {
  const lerp = (a, b, t) => a + (b - a) * t;
  const thin = sampleOpenPageCurve(10, dims.minT, dims)[10];
  const thick = sampleOpenPageCurve(10, dims.maxT, dims)[10];
  return {
    x: lerp(dims.pageW, lerp(thin.x, thick.x, ratio), open),
    y: v * lerp(lerp(dims.minT, dims.maxT, ratio), lerp(thin.y, thick.y, ratio), open)
  };
}

// 読み終えた見出しは左の束、これからの見出しは右の束の、そのページの高さに付く
// fixedRatio を指定すると、束の厚みをその割合に固定する
export function getTabPlacement(dims, open, tabIndex, tabSpreads, spreadVisual, spreadCount, fixedRatio) {
  const target = tabSpreads[tabIndex];
  const left = target <= spreadVisual + 0.5;
  const last = Math.max(1, spreadCount - 1);
  const ratio = fixedRatio ?? Math.max(0, Math.min(1, spreadVisual / last));
  const v = left
    ? (target + 0.5) / (spreadVisual + 0.5)
    : 1 - (target - spreadVisual) / (spreadCount - spreadVisual);
  const edge = edgePoint(dims, left ? ratio : 1 - ratio, open, Math.max(0.08, Math.min(0.96, v)));
  const n = tabSpreads.length;
  return {
    left,
    // 根元の 0.04 は束の中に差し込む
    x: (left ? -1 : 1) * (edge.x + TAB_SIZE.w / 2 - 0.04),
    y: Math.max(TAB_SIZE.h / 2, edge.y),
    z: dims.pageH * (n > 1 ? -0.34 + tabIndex * 0.68 / (n - 1) : 0)
  };
}
