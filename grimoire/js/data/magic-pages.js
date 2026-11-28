// 呪文データから解説ページと設定ページの見開きを組み立てる
import { CHARACTERS, PARTS_OF_SPEECH, WORDS } from './magic-data.js';

// 例文は語句IDの並びで書く(並びの規則に合っているかは isValidSpell で確かめられる)
export const EXAMPLES = [
  { words: [1, 12], text: '球体を出して、前に飛ばす' },
  { words: [2, 8], text: '立方体を出して、大きくする' },
  { words: [2, 5], text: '立方体を出して、空中に固定する' },
  { words: [1, 12, 4, 17], text: '球体を出して、5秒後に前へ飛ばす' },
  { words: [2, 8, 4, 7], text: '立方体を出して、接触したら大きくする' },
  { words: [1, 3, 14], text: '球体を再生成して、上に飛ばす' }
];

export const findWord = id => WORDS.find(w => w.id === id);

export function isValidSpell(ids) {
  const words = ids.map(findWord);
  if (words.some(w => !w) || !words.length) return false;
  if (!words[0].canStart || !words[words.length - 1].canEnd) return false;
  return words.slice(1).every((next, i) => words[i].next.some(rule =>
    rule.pos === next.pos && (!rule.words.length || rule.words.includes(next.id))));
}

// 語句ページの寸法(textures/magic.js の描画と合わせる)
export const WORD_LAYOUT = { height: 490, heading: 32, row: 50 };

// 品詞ごとの語句を、ページに収まる分ずつに分ける
function paginateWords() {
  const order = [0, 3, 1, 2, 4];
  const pages = [];
  let ids = [];
  let used = 0;
  const flush = () => {
    if (ids.length) pages.push(ids);
    ids = [];
    used = 0;
  };
  for (const pos of order.filter(p => p < PARTS_OF_SPEECH.length)) {
    const group = WORDS.filter(w => w.pos === pos);
    const need = WORD_LAYOUT.heading + group.length * WORD_LAYOUT.row;
    // 品詞はなるべく同じページにまとめる
    if (used + need > WORD_LAYOUT.height) flush();
    let heading = WORD_LAYOUT.heading;
    for (const word of group) {
      if (used + heading + WORD_LAYOUT.row > WORD_LAYOUT.height) {
        flush();
        heading = WORD_LAYOUT.heading;
      }
      ids.push(word.id);
      used += heading + WORD_LAYOUT.row;
      heading = 0;
    }
  }
  flush();
  return pages;
}

const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
const page = (type, title, extra = {}) => ({ type, title, items: [], ...extra });
const numbered = (title, i, total) => (total > 1 ? `${title} ${i + 1}` : title);

// 図形 → 単語 → 例文 → 設定 の順。section は見出しタブを付ける位置
export function buildMagicSpreads() {
  const shapeIds = CHARACTERS.map((c, i) => i).filter(i => CHARACTERS[i].shapes.length === 1);
  const compoundIds = CHARACTERS.map((c, i) => i).filter(i => CHARACTERS[i].shapes.length > 1);
  const shapePages = [
    ...chunk(shapeIds, 10).map(ids => page('shapes', '図形の種類', { ids })),
    ...chunk(compoundIds, 6).map(ids => page('compounds', '重ねて書く文字', { ids }))
  ];
  const wordIds = paginateWords();
  const wordPages = [
    ...wordIds.map((ids, i) => page('words', numbered('単語の種類', i, wordIds.length), { ids })),
    page('grammar', '言葉のつなぎ方')
  ];
  const examples = chunk(EXAMPLES.map((_, i) => i), 3);
  const examplePages = examples.map((ids, i) => page('examples', numbered('例文', i, examples.length), { ids }));
  const settingPages = [
    { type: 'settings', title: '設定', items: ['BGMの音量', '効果音の音量', '線の太さ', '文字の明るさ'] },
    { type: 'notes', title: '操作方法', items: [
      '書く: ペンを持ち、Use を押している間だけ線が出る',
      '一画: Use を離すと一画が終わる',
      '発動: 書いた呪文にペン先を重ねて Use',
      '消す: 呪文の左から右へ、横線でなぞる',
      '全消去: ペンを手放す'
    ] }
  ];

  const spreads = [];
  for (const [section, pages] of [['図形', shapePages], ['単語', wordPages], ['例文', examplePages], ['設定', settingPages]]) {
    chunk(pages, 2).forEach(([left, right], i) => {
      spreads.push({ ...(i === 0 ? { section } : {}), left, right: right || page('notes', 'メモ') });
    });
  }
  return spreads;
}
