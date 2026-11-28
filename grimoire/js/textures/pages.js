// ページ(UI画面)のテクスチャ
import { state } from '../state.js';
import { shadeHex, drawRoundRect, isDarkColor } from './canvas-utils.js';
import { MAGIC_PAGE_TYPES, drawMagicPage } from './magic.js';

/**
 * Draws a clean, ink-styled low-poly UI page canvas for one page of a spread.
 */
export function createPageCanvas(pageData, isLeft, pageNum) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 680;
  const ctx = canvas.getContext('2d');

  const W = canvas.width;
  const H = canvas.height;
  const paperBase = state.paperColor;
  // 紙の色が暗いときは、文字と枠を明るくする
  const dark = isDarkColor(paperBase);
  const paperLight = shadeHex(paperBase, dark ? 16 : 10);
  const paperBorder = shadeHex(paperBase, dark ? 48 : -36);
  const inkDark = dark ? '#f0e8da' : '#3a2e25';
  const inkMuted = dark ? '#b3a896' : '#6d5e50';
  const accent = state.coverColor;
  const gold = shadeHex(state.metalColor, -12);

  // Base warm parchment background
  ctx.fillStyle = paperBase;
  ctx.fillRect(0, 0, W, H);

  // Subtle gutter shadow along spine side
  const gutterGrad = isLeft
    ? ctx.createLinearGradient(W - 58, 0, W, 0)
    : ctx.createLinearGradient(0, 0, 58, 0);
  if (isLeft) {
    gutterGrad.addColorStop(0, 'rgba(55, 40, 28, 0)');
    gutterGrad.addColorStop(1, 'rgba(55, 40, 28, 0.16)');
    ctx.fillStyle = gutterGrad;
    ctx.fillRect(W - 58, 0, 58, H);
  } else {
    gutterGrad.addColorStop(0, 'rgba(55, 40, 28, 0.16)');
    gutterGrad.addColorStop(1, 'rgba(55, 40, 28, 0)');
    ctx.fillStyle = gutterGrad;
    ctx.fillRect(0, 0, 58, H);
  }

  // Subtle inner margin frame
  const mL = isLeft ? 34 : 44;
  const mR = isLeft ? 44 : 34;
  const frameW = W - mL - mR;
  ctx.strokeStyle = paperBorder;
  ctx.lineWidth = 2;
  drawRoundRect(ctx, mL, 32, frameW, H - 64, 10);
  ctx.stroke();

  // Header bar
  const headerX = mL + 18;
  const headerW = frameW - 36;
  const headerY = 56;
  ctx.fillStyle = accent;
  drawRoundRect(ctx, headerX, headerY, headerW, 48, 8);
  ctx.fill();

  ctx.fillStyle = '#f5efe4';
  ctx.font = '700 22px Inter, "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pageData.title || 'PAGE', headerX + headerW * 0.5, headerY + 25, headerW - 24);

  const type = pageData.type || 'menu';
  const items = Array.isArray(pageData.items) && (pageData.items.length > 0 || MAGIC_PAGE_TYPES.includes(type))
    ? pageData.items
    : ['ITEM 1', 'ITEM 2', 'ITEM 3'];

  const bodyX = headerX;
  const bodyW = headerW;
  const bodyTop = 132;

  if (MAGIC_PAGE_TYPES.includes(type)) {
    const theme = {
      ink: inkDark, muted: inkMuted, paperLight, paperBorder,
      accentInk: dark ? shadeHex(state.metalColor, 20) : shadeHex(accent, -10)
    };
    drawMagicPage(ctx, { ...pageData, items }, { x: bodyX, y: bodyTop - 8, w: bodyW, h: H - bodyTop - 70 }, theme);
  } else if (type === 'menu') {
    items.slice(0, 6).forEach((label, idx) => {
      const y = bodyTop + idx * 72;
      const active = idx === 0;
      ctx.fillStyle = active ? shadeHex(gold, 28) : paperLight;
      ctx.strokeStyle = active ? accent : paperBorder;
      ctx.lineWidth = active ? 3 : 2;
      drawRoundRect(ctx, bodyX, y, bodyW, 54, 8);
      ctx.fill();
      ctx.stroke();

      if (active) {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(bodyX + 18, y + 19);
        ctx.lineTo(bodyX + 30, y + 27);
        ctx.lineTo(bodyX + 18, y + 35);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = inkDark;
      ctx.font = active ? '700 19px Inter, "Noto Sans JP", sans-serif' : '600 18px Inter, "Noto Sans JP", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bodyX + bodyW * 0.5, y + 28, bodyW - 60);
    });
  } else if (type === 'sigil') {
    const cx = bodyX + bodyW * 0.5;
    const cy = bodyTop + 175;
    const r = 122;

    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = gold;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 18, 0, Math.PI * 2);
    ctx.stroke();

    // Hexagram
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const ang = -Math.PI * 0.5 + k * Math.PI + (i * Math.PI * 2) / 3;
        const px = cx + Math.cos(ang) * (r - 22);
        const py = cy + Math.sin(ang) * (r - 22);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Inner diamond
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 26);
    ctx.lineTo(cx + 22, cy);
    ctx.lineTo(cx, cy + 26);
    ctx.lineTo(cx - 22, cy);
    ctx.closePath();
    ctx.fill();

    // Bottom rune chips
    const chipCount = Math.min(4, items.length);
    const gap = 10;
    const chipW = (bodyW - gap * (chipCount - 1)) / chipCount;
    items.slice(0, chipCount).forEach((lbl, i) => {
      const x = bodyX + i * (chipW + gap);
      const y = bodyTop + 340;
      ctx.fillStyle = paperLight;
      ctx.strokeStyle = paperBorder;
      ctx.lineWidth = 2;
      drawRoundRect(ctx, x, y, chipW, 42, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = inkDark;
      ctx.font = '700 13px Inter, "Noto Sans JP", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl, x + chipW * 0.5, y + 22, chipW - 10);
    });
  } else if (type === 'stats') {
    // Portrait badge
    ctx.fillStyle = paperLight;
    ctx.strokeStyle = paperBorder;
    ctx.lineWidth = 2;
    drawRoundRect(ctx, bodyX, bodyTop, 110, 110, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(bodyX + 55, bodyTop + 42, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bodyX + 55, bodyTop + 98, 32, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = inkDark;
    ctx.font = '700 20px Inter, "Noto Sans JP", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(items[0] || 'LV 24 MAGE', bodyX + 128, bodyTop + 34, bodyW - 134);

    ctx.fillStyle = inkMuted;
    ctx.font = '600 15px Inter, "Noto Sans JP", sans-serif';
    ctx.fillText('GUILD RANK: A', bodyX + 128, bodyTop + 68);
    ctx.fillText('CLASS: ARCANE', bodyX + 128, bodyTop + 94);

    // Stat bars
    const barColors = ['#b35048', '#4b7b9e', '#5b8a67', '#b58a42'];
    const barFill = [0.88, 0.72, 0.64, 0.92];
    items.slice(1, 5).forEach((lbl, idx) => {
      const y = bodyTop + 144 + idx * 72;
      ctx.fillStyle = inkDark;
      ctx.font = '700 16px Inter, "Noto Sans JP", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(lbl, bodyX + 4, y);

      ctx.fillStyle = shadeHex(paperBase, -20);
      drawRoundRect(ctx, bodyX, y + 16, bodyW, 20, 6);
      ctx.fill();

      ctx.fillStyle = barColors[idx % barColors.length];
      drawRoundRect(ctx, bodyX, y + 16, bodyW * barFill[idx % barFill.length], 20, 6);
      ctx.fill();
    });
  } else if (type === 'spells') {
    const badgeCols = ['#b35048', '#4b7b9e', '#5b8a67', '#7b5b94'];
    items.slice(0, 5).forEach((lbl, idx) => {
      const y = bodyTop + idx * 82;
      ctx.fillStyle = paperLight;
      ctx.strokeStyle = paperBorder;
      ctx.lineWidth = 2;
      drawRoundRect(ctx, bodyX, y, bodyW, 66, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = badgeCols[idx % badgeCols.length];
      drawRoundRect(ctx, bodyX + 12, y + 12, 42, 42, 7);
      ctx.fill();

      ctx.fillStyle = '#f5efe4';
      ctx.beginPath();
      ctx.moveTo(bodyX + 33, y + 21);
      ctx.lineTo(bodyX + 44, y + 33);
      ctx.lineTo(bodyX + 33, y + 45);
      ctx.lineTo(bodyX + 22, y + 33);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = inkDark;
      ctx.font = '700 18px Inter, "Noto Sans JP", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl, bodyX + 68, y + 25, bodyW - 140);

      ctx.fillStyle = inkMuted;
      ctx.font = '600 13px Inter, "Noto Sans JP", sans-serif';
      ctx.fillText(`MP ${(idx + 1) * 12}`, bodyX + 68, y + 47);
    });
  } else if (type === 'inventory') {
    const cols = 3;
    const rows = 3;
    const gap = 12;
    const cellW = (bodyW - gap * (cols - 1)) / cols;
    const cellH = 112;
    const iconCols = ['#b35048', '#4b7b9e', '#b58a42', '#5b8a67', '#7b5b94', '#8c6142'];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const x = bodyX + c * (cellW + gap);
        const y = bodyTop + r * (cellH + gap);

        ctx.fillStyle = paperLight;
        ctx.strokeStyle = paperBorder;
        ctx.lineWidth = 2;
        drawRoundRect(ctx, x, y, cellW, cellH, 8);
        ctx.fill();
        ctx.stroke();

        if (items[idx]) {
          ctx.fillStyle = iconCols[idx % iconCols.length];
          ctx.beginPath();
          ctx.arc(x + cellW * 0.5, y + 42, 20, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = inkDark;
          ctx.font = '700 13px Inter, "Noto Sans JP", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(items[idx], x + cellW * 0.5, y + 86, cellW - 12);
        }
      }
    }
  } else if (type === 'map') {
    const mapH = 310;
    ctx.fillStyle = shadeHex(paperBase, -10);
    ctx.strokeStyle = paperBorder;
    ctx.lineWidth = 2.5;
    drawRoundRect(ctx, bodyX, bodyTop, bodyW, mapH, 10);
    ctx.fill();
    ctx.stroke();

    // Stylized land mass
    ctx.fillStyle = '#c5ba9b';
    ctx.beginPath();
    ctx.moveTo(bodyX + 44, bodyTop + 70);
    ctx.lineTo(bodyX + 165, bodyTop + 36);
    ctx.lineTo(bodyX + 310, bodyTop + 82);
    ctx.lineTo(bodyX + 320, bodyTop + 210);
    ctx.lineTo(bodyX + 200, bodyTop + 264);
    ctx.lineTo(bodyX + 64, bodyTop + 220);
    ctx.closePath();
    ctx.fill();

    // Dotted route
    const pins = [
      [bodyX + 96, bodyTop + 172],
      [bodyX + 196, bodyTop + 124],
      [bodyX + 278, bodyTop + 196]
    ];
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    pins.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    pins.forEach(([px, py], i) => {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = paperLight;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();

      if (items[i]) {
        ctx.fillStyle = inkDark;
        ctx.font = '700 13px Inter, "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(items[i], px, py - 18);
      }
    });

    // Legend below map
    items.slice(0, 3).forEach((lbl, i) => {
      const y = bodyTop + mapH + 26 + i * 32;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(bodyX + 12, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = inkDark;
      ctx.font = '600 15px Inter, "Noto Sans JP", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl, bodyX + 28, y);
    });
  } else {
    // 'settings'
    const vals = [0.75, 0.60, 0.50, 0.85];
    items.slice(0, 5).forEach((lbl, idx) => {
      const y = bodyTop + idx * 82;
      ctx.fillStyle = inkDark;
      ctx.font = '700 16px Inter, "Noto Sans JP", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl, bodyX + 4, y + 10);

      ctx.fillStyle = shadeHex(paperBase, -22);
      drawRoundRect(ctx, bodyX, y + 30, bodyW, 14, 7);
      ctx.fill();

      const ratio = vals[idx % vals.length];
      ctx.fillStyle = accent;
      drawRoundRect(ctx, bodyX, y + 30, bodyW * ratio, 14, 7);
      ctx.fill();

      ctx.fillStyle = paperLight;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bodyX + bodyW * ratio, y + 37, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  // Page number footer
  ctx.fillStyle = inkMuted;
  ctx.font = '600 15px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`- ${pageNum} -`, mL + frameW * 0.5, H - 52);

  return canvas;
}

export function createPageTexture(pageData, isLeft, pageNum) {
  const canvas = createPageCanvas(pageData, isLeft, pageNum);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
