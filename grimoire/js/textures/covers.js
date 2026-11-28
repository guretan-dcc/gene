// 小口・表紙・背表紙のテクスチャ
import { state } from '../state.js';
import { shadeHex, drawRoundRect } from './canvas-utils.js';

/**
 * Generates subtle horizontal paper-layer stripes for the 4 side faces of each page stack.
 */
export function createPageEdgeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = shadeHex(state.paperColor, -14);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lineDark = shadeHex(state.paperColor, -34);
  const lineLight = shadeHex(state.paperColor, -4);

  for (let y = 0; y < canvas.height; y += 8) {
    ctx.fillStyle = lineDark;
    ctx.fillRect(0, y, canvas.width, 2);
    ctx.fillStyle = lineLight;
    ctx.fillRect(0, y + 3, canvas.width, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a transparent-background foil overlay for the front cover so base leather color
 * always matches the back cover and spine 100%.
 */
export function createFrontCoverTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 680;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const W = canvas.width;
  const H = canvas.height;
  const foil = state.metalColor;
  const foilSoft = shadeHex(state.metalColor, -24);
  const pattern = state.coverPattern || 'arcane';

  ctx.strokeStyle = foil;
  ctx.fillStyle = foil;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Spine-side subtle vertical binding crease lines
  if (pattern !== 'minimal') {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = foilSoft;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(42, 34);
    ctx.lineTo(42, H - 34);
    ctx.stroke();
    ctx.restore();
  }

  // Outer & inner decorative borders based on pattern
  if (pattern === 'minimal') {
    ctx.lineWidth = 4;
    ctx.strokeRect(46, 46, W - 92, H - 92);
  } else if (pattern === 'classic') {
    ctx.lineWidth = 5;
    ctx.strokeRect(50, 42, W - 92, H - 84);
    ctx.lineWidth = 2.5;
    ctx.strokeRect(64, 56, W - 120, H - 112);

    // Corner accent dots
    [[78, 70], [W - 70, 70], [78, H - 70], [W - 70, H - 70]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (pattern === 'royal') {
    ctx.lineWidth = 5;
    drawRoundRect(ctx, 50, 42, W - 92, H - 84, 14);
    ctx.stroke();

    // Notched inner frame
    const x0 = 68, y0 = 60, x1 = W - 60, y1 = H - 60, c = 26;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0 + c, y0);
    ctx.lineTo(x1 - c, y0);
    ctx.lineTo(x1, y0 + c);
    ctx.lineTo(x1, y1 - c);
    ctx.lineTo(x1 - c, y1);
    ctx.lineTo(x0 + c, y1);
    ctx.lineTo(x0, y1 - c);
    ctx.lineTo(x0, y0 + c);
    ctx.closePath();
    ctx.stroke();

    // Top & bottom filigree diamonds
    const cx = (x0 + x1) * 0.5;
    [y0 + 18, y1 - 18].forEach(cy => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx + 12, cy);
      ctx.lineTo(cx, cy + 8);
      ctx.lineTo(cx - 12, cy);
      ctx.closePath();
      ctx.fill();

      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 80, cy);
      ctx.lineTo(cx - 22, cy);
      ctx.moveTo(cx + 22, cy);
      ctx.lineTo(cx + 80, cy);
      ctx.stroke();
    });
  } else {
    // 'arcane': chamfered double border + central arcane geometric ring behind emblem
    const x0 = 54, y0 = 42, x1 = W - 44, y1 = H - 42, cut = 22;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0 + cut, y0);
    ctx.lineTo(x1 - cut, y0);
    ctx.lineTo(x1, y0 + cut);
    ctx.lineTo(x1, y1 - cut);
    ctx.lineTo(x1 - cut, y1);
    ctx.lineTo(x0 + cut, y1);
    ctx.lineTo(x0, y1 - cut);
    ctx.lineTo(x0, y0 + cut);
    ctx.closePath();
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.strokeRect(x0 + 14, y0 + 14, (x1 - x0) - 28, (y1 - y0) - 28);

    // Subtle geometric arcane ring centered around emblem region
    const cx = W * 0.5 + 4;
    const cy = H * 0.55;
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 126, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([7, 7]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 8 cardinal ticks on outer circle
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const r1 = 126;
      const r2 = i % 2 === 0 ? 142 : 136;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Title banner (kept cleanly above the central emblem)
  const titleText = (state.bookTitle || '').trim();
  if (titleText) {
    const cx = W * 0.5 + (pattern === 'minimal' ? 0 : 4);
    const titleY = 148;

    ctx.fillStyle = foil;
    ctx.font = '700 34px Inter, "Noto Sans JP", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(titleText, cx, titleY, W - 156);

    // Clean underline divider
    ctx.strokeStyle = foil;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 108, titleY + 28);
    ctx.lineTo(cx + 108, titleY + 28);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a matching transparent-background foil overlay for the back cover.
 */
export function createBackCoverTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 680;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const W = canvas.width;
  const H = canvas.height;
  const foil = state.metalColor;

  ctx.strokeStyle = foil;
  ctx.fillStyle = foil;
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 46, W - 96, H - 92);

  if (state.coverPattern !== 'minimal') {
    ctx.lineWidth = 2;
    ctx.strokeRect(64, 62, W - 128, H - 124);

    // Small central foil diamond mark
    const cx = W * 0.5;
    const cy = H * 0.5;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 28);
    ctx.lineTo(cx + 22, cy);
    ctx.lineTo(cx, cy + 28);
    ctx.lineTo(cx - 22, cy);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates flush horizontal gold foil bands for the flat spine (zero geometry protrusion).
 */
export function createSpineCoverTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = state.metalColor;

  const bands = [0.14, 0.28, 0.72, 0.86];
  bands.forEach(f => {
    const y = H * f;
    ctx.fillRect(10, y - 5, W - 20, 6);
    ctx.fillRect(18, y + 4, W - 36, 2);
  });

  if (state.coverPattern !== 'minimal') {
    const cx = W * 0.5;
    const cy = H * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx + 12, cy);
    ctx.lineTo(cx, cy + 16);
    ctx.lineTo(cx - 12, cy);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
