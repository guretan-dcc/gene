// 解説ページの描画。文字はゲームと同じ図形データと色で描く
import { SHAPES, CHARACTERS, PARTS_OF_SPEECH, WORDS } from '../data/magic-data.js';
import { EXAMPLES, WORD_LAYOUT, findWord } from '../data/magic-pages.js';
import { drawRoundRect } from './canvas-utils.js';

export const MAGIC_PAGE_TYPES = ['shapes', 'compounds', 'words', 'grammar', 'examples', 'notes'];
const FONT = 'Inter, "Noto Sans JP", sans-serif';

// size 四方の中央に文字を描く。暗い色でも読めるように下地を敷く
export function drawGlyph(ctx, charId, cx, cy, size) {
  const character = CHARACTERS[charId];
  if (!character) return;
  ctx.save();
  ctx.fillStyle = '#171a22';
  drawRoundRect(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.18);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 同じ図形を重ねる文字(⇈ など)は上下にずらして見分けられるようにする
  const repeated = character.shapes.length > 1 && new Set(character.shapes).size === 1;
  const scale = size * (repeated ? 0.5 : 0.62);
  // 下地の上で沈まないよう、先に明るい縁を描いてから色を重ねる
  for (const [color, width] of [['rgba(255,255,255,0.55)', size * 0.13], [character.color, size * 0.08]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    character.shapes.forEach((shapeId, n) => {
      const offset = repeated ? (n - (character.shapes.length - 1) / 2) * size * 0.3 : 0;
      const shape = SHAPES[shapeId];
      ctx.beginPath();
      shape.points.forEach(([x, y], i) => {
        ctx[i ? 'lineTo' : 'moveTo'](cx + x * scale, cy - y * scale * (repeated ? 0.7 : 1) + offset);
      });
      if (shape.closed) ctx.closePath();
      ctx.stroke();
    });
  }
  ctx.restore();
}

// 単語を左端 x から並べ、使った幅を返す
function drawWord(ctx, word, x, cy, size) {
  word.chars.forEach((id, i) => drawGlyph(ctx, id, x + size / 2 + i * (size + 3), cy, size));
  return word.chars.length * (size + 3) - 3;
}

// 幅に合わせて折り返す(日本語は文字単位)。最後の行に残りを詰める
function wrapText(ctx, text, x, y, width, lineHeight, maxLines = 2) {
  const lines = [''];
  for (const char of text) {
    const last = lines.length - 1;
    if (ctx.measureText(lines[last] + char).width > width && lines.length < maxLines) lines.push(char);
    else lines[last] += char;
  }
  const top = y - (lines.length - 1) * lineHeight / 2;
  lines.forEach((line, i) => ctx.fillText(line, x, top + i * lineHeight, width));
}

function card(ctx, theme, x, y, w, h) {
  ctx.fillStyle = theme.paperLight;
  ctx.strokeStyle = theme.paperBorder;
  ctx.lineWidth = 2;
  drawRoundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function text(ctx, value, x, y, size, color, { weight = 600, align = 'left', width } = {}) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y, width);
}

const SHAPE_NAMES = ['横線', '縦線', '右下がり', '右上がり', '下向きの山', '上向きの山', '右向き', '左向き', '丸', '四角'];

const painters = {
  shapes(ctx, page, area, theme) {
    const ids = page.ids || CHARACTERS.slice(0, 10).map((_, i) => i);
    const w = (area.w - 12) / 2;
    ids.slice(0, 10).forEach((id, i) => {
      const x = area.x + (i % 2) * (w + 12);
      const y = area.y + Math.floor(i / 2) * 98;
      card(ctx, theme, x, y, w, 88);
      drawGlyph(ctx, id, x + 44, y + 44, 66);
      ctx.fillStyle = theme.ink;
      ctx.font = `700 18px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      wrapText(ctx, SHAPE_NAMES[CHARACTERS[id].shapes[0]] || CHARACTERS[id].name, x + 88, y + 44, w - 96, 22);
    });
  },

  compounds(ctx, page, area, theme) {
    const ids = page.ids || CHARACTERS.map((_, i) => i).filter(i => CHARACTERS[i].shapes.length > 1);
    ids.slice(0, 6).forEach((id, i) => {
      const y = area.y + i * 82;
      card(ctx, theme, area.x, y, area.w, 74);
      drawGlyph(ctx, id, area.x + 40, y + 37, 60);
      text(ctx, '＝', area.x + 98, y + 37, 22, theme.muted, { align: 'center' });
      CHARACTERS[id].shapes.forEach((shapeId, n) => {
        const x = area.x + 150 + n * 100;
        if (n) text(ctx, '＋', x - 50, y + 37, 20, theme.muted, { align: 'center' });
        drawGlyph(ctx, shapeId, x, y + 37, 54);
      });
    });
    text(ctx, '同じ場所に重ねて書くと、1つの文字になる', area.x + area.w / 2, area.y + area.h - 14, 16, theme.muted, { align: 'center', width: area.w });
  },

  words(ctx, page, area, theme) {
    const words = (page.ids || WORDS.slice(0, 5).map(w => w.id)).map(findWord).filter(Boolean);
    let y = area.y - 8;
    let pos = null;
    for (const word of words) {
      if (word.pos !== pos) {
        pos = word.pos;
        text(ctx, `■ ${PARTS_OF_SPEECH[pos]}`, area.x, y + 18, 19, theme.accentInk, { weight: 700 });
        y += WORD_LAYOUT.heading;
      }
      card(ctx, theme, area.x, y + 2, area.w, WORD_LAYOUT.row - 6);
      drawWord(ctx, word, area.x + 6, y + 24, 36);
      ctx.fillStyle = word.implemented ? theme.ink : theme.muted;
      ctx.font = `600 16px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      wrapText(ctx, word.meaning + (word.implemented ? '' : '(未実装)'), area.x + 94, y + 24, area.w - 102, 19);
      y += WORD_LAYOUT.row;
    }
  },

  grammar(ctx, page, area, theme) {
    const rows = [
      ['最初に書く', '主体(作用だけで始められる語もある)'],
      ['主体の次', '作用、または接続詞(再生成)'],
      ['作用の次', '接続詞(条件を書くとき)'],
      ['「/」の次', '条件'],
      ['条件の次', '条件接続詞(かつ・または)'],
      ['最後に置ける', '主体・作用・条件']
    ];
    rows.forEach(([head, body], i) => {
      const y = area.y + i * 82;
      card(ctx, theme, area.x, y, area.w, 70);
      text(ctx, head, area.x + 16, y + 20, 16, theme.accentInk, { weight: 700 });
      text(ctx, body, area.x + 16, y + 48, 18, theme.ink, { width: area.w - 32 });
    });
  },

  examples(ctx, page, area, theme) {
    const ids = page.ids || [0, 1, 2];
    ids.slice(0, 3).forEach((id, i) => {
      const example = EXAMPLES[id];
      if (!example) return;
      const words = example.words.map(findWord);
      const y = area.y + i * 164;
      card(ctx, theme, area.x, y, area.w, 150);
      const count = words.reduce((sum, w) => sum + w.chars.length, 0);
      const size = Math.min(54, (area.w - 24 - (words.length - 1) * 14) / count - 3);
      let x = area.x + 14;
      for (const word of words) x += drawWord(ctx, word, x, y + 44, size) + 14;
      ctx.fillStyle = theme.ink;
      ctx.font = `700 18px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      wrapText(ctx, example.text, area.x + 14, y + 110, area.w - 28, 25);
    });
  },

  notes(ctx, page, area, theme) {
    page.items.slice(0, 6).forEach((item, i) => {
      const y = area.y + i * 82;
      card(ctx, theme, area.x, y, area.w, 70);
      ctx.fillStyle = theme.ink;
      ctx.font = `600 18px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      wrapText(ctx, item, area.x + 16, y + 35, area.w - 32, 24);
    });
  }
};

export function drawMagicPage(ctx, page, area, theme) {
  painters[page.type]?.(ctx, page, area, theme);
}
