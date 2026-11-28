// 立体の紋章と四隅の金具の代わりに、表紙の絵に直接描く(512×680 のキャンバス)
import { state } from '../../state.js';
import { getBookDims } from '../../book/dimensions.js';

function polygon(ctx, cx, cy, radius, sides, scaleX = 1, scaleY = 1) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = i / sides * Math.PI * 2 - Math.PI / 2;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * radius * scaleX, cy + Math.sin(a) * radius * scaleY);
  }
  ctx.closePath();
}

const circle = (ctx, x, y, r) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
};

const EMBLEMS = {
  compass(ctx, cx, cy, s) {
    ctx.lineWidth = s * 0.052;
    circle(ctx, cx, cy, s * 0.3);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const length = s * (i % 2 ? 0.23 : 0.33);
      const half = s * (i % 2 ? 0.025 : 0.045);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * length, cy + Math.sin(a) * length);
      ctx.lineTo(cx - Math.sin(a) * half, cy + Math.cos(a) * half);
      ctx.lineTo(cx + Math.sin(a) * half, cy - Math.cos(a) * half);
      ctx.fill();
    }
    circle(ctx, cx, cy, s * 0.08);
    ctx.fill();
  },
  moon(ctx, cx, cy, s) {
    ctx.beginPath();
    ctx.arc(cx - s * 0.04, cy, s * 0.28, Math.PI * 0.4, Math.PI * 1.6);
    ctx.quadraticCurveTo(cx - s * 0.2, cy, cx - s * 0.04 + Math.cos(Math.PI * 0.4) * s * 0.28, cy + Math.sin(Math.PI * 0.4) * s * 0.28);
    ctx.fill();
    polygon(ctx, cx + s * 0.14, cy - s * 0.04, s * 0.09, 4);
    ctx.fill();
  },
  ring(ctx, cx, cy, s) {
    ctx.lineWidth = s * 0.055;
    circle(ctx, cx, cy, s * 0.32);
    ctx.stroke();
    ctx.lineWidth = s * 0.042;
    circle(ctx, cx, cy, s * 0.19);
    ctx.stroke();
    polygon(ctx, cx, cy, s * 0.09, 6);
    ctx.fill();
  },
  crest(ctx, cx, cy, s) {
    ctx.lineWidth = s * 0.075;
    polygon(ctx, cx, cy, s * 0.27, 6, 0.88, 1.12);
    ctx.stroke();
    ctx.fillRect(cx - s * 0.025, cy - s * 0.17, s * 0.05, s * 0.34);
    ctx.fillRect(cx - s * 0.13, cy - s * 0.075, s * 0.26, s * 0.05);
  }
};

export function drawCoverMetal(ctx, withEmblem) {
  const { w, h } = getBookDims();
  const { width: W, height: H } = ctx.canvas;
  const sx = W / w;
  const sy = H / h;
  ctx.save();
  ctx.fillStyle = state.metalColor;
  ctx.strokeStyle = state.metalColor;

  if (state.corners !== 'none') {
    for (const [x, y, dx, dy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]) {
      if (state.corners === 'chunky') {
        ctx.fillRect(x, y, dx * 0.34 * sx, dy * 0.085 * sy);
        ctx.fillRect(x, y, dx * 0.085 * sx, dy * 0.34 * sy);
      } else {
        polygon(ctx, x + dx * 0.135 * sx, y + dy * 0.135 * sy, 0.12 * sx, 6);
        ctx.fill();
      }
    }
  }
  if (withEmblem) EMBLEMS[state.emblem]?.(ctx, W / 2 + 4, H * 0.56, sx);
  ctx.restore();
}
