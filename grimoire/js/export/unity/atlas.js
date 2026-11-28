// 本で使う絵をすべて1枚のテクスチャにまとめる
import { state } from '../../state.js';
import { createPageCanvas } from '../../textures/pages.js';
import { shadeHex } from '../../textures/canvas-utils.js';
import { TAB_COLORS } from '../../book/edge.js';
import { rig } from '../../rig.js';
import { drawCoverMetal } from './cover-art.js';

const WIDTH = 2048;
const COLUMNS = 4;
const CELL_W = WIDTH / COLUMNS;
const STRIP_H = 128; // 背表紙・小口・単色
const SWATCH = 40;
// ライトを使わないので、面の向きごとの明るさを色に焼き込む
export const SHADES = { top: 1, side: 0.8, end: 0.65 };

function scaleColor(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${[16, 8, 0].map(s => Math.round((n >> s & 255) * k)).join(',')})`;
}

function coverCanvas(overlay, withEmblem) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 680;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = state.coverColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(overlay, 0, 0);
  drawCoverMetal(ctx, withEmblem);
  return canvas;
}

// 戻り値の uv(領域名, 横0〜1, 縦0〜1(下が0)) が Unity の UV になる
export function createAtlas() {
  const pages = state.spreads.flatMap((spread, i) => [
    [`page${i * 2}`, createPageCanvas(spread.left, true, i * 2 + 1)],
    [`page${i * 2 + 1}`, createPageCanvas(spread.right, false, i * 2 + 2)]
  ]);
  const cells = [
    ...pages,
    ['front', coverCanvas(rig.frontCoverTex.image, true)],
    ['back', coverCanvas(rig.backCoverTex.image, false)]
  ];
  const rows = Math.ceil(cells.length / COLUMNS);
  const cellH = Math.min(680, Math.floor((WIDTH - STRIP_H) / rows));
  const height = 2 ** Math.ceil(Math.log2(rows * cellH + STRIP_H));

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = state.paperColor;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.imageSmoothingQuality = 'high';

  const regions = {};
  const place = (name, source, x, y, w, h) => {
    ctx.drawImage(source, x, y, w, h);
    regions[name] = { x, y, w, h };
  };
  cells.forEach(([name, source], i) => {
    place(name, source, (i % COLUMNS) * CELL_W, Math.floor(i / COLUMNS) * cellH, CELL_W, cellH);
  });

  const stripY = rows * cellH;
  const spine = document.createElement('canvas');
  spine.width = 128;
  spine.height = 512;
  const spineCtx = spine.getContext('2d');
  spineCtx.fillStyle = state.coverColor;
  spineCtx.fillRect(0, 0, 128, 512);
  spineCtx.drawImage(rig.spineCoverTex.image, 0, 0);
  place('spine', spine, 0, stripY, 64, STRIP_H);
  place('edge', rig.leftEdgeTex.image, 80, stripY, 128, STRIP_H);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(80, stripY, 128, STRIP_H);

  const colors = {
    cover: state.coverColor,
    metal: state.metalColor,
    paper: shadeHex(state.paperColor, -10),
    ...Object.fromEntries(TAB_COLORS.map((c, i) => [`tab${i}`, c]))
  };
  Object.entries(colors).forEach(([name, color], col) => {
    Object.entries(SHADES).forEach(([shade, k], row) => {
      const x = 224 + col * SWATCH;
      const y = stripY + row * SWATCH;
      ctx.fillStyle = scaleColor(color, k);
      ctx.fillRect(x, y, SWATCH, SWATCH);
      // 単色は中央の1点だけを使う
      regions[`${name}:${shade}`] = { x: x + SWATCH / 2, y: y + SWATCH / 2, w: 0, h: 0 };
    });
  });

  // 隣の領域がにじまないよう、端を少し内側にする
  const uv = (name, u = 0, v = 0) => {
    const r = regions[name];
    const insetX = Math.min(1.5, r.w / 2);
    const insetY = Math.min(1.5, r.h / 2);
    return [
      (r.x + insetX + u * (r.w - insetX * 2)) / WIDTH,
      1 - (r.y + insetY + (1 - v) * (r.h - insetY * 2)) / height
    ];
  };
  return { canvas, uv };
}
