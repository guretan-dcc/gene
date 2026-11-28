// 初期の見開きデータと配色プリセット

export const DEFAULT_SPREADS = [
  {
    left: { type: 'menu', title: 'MAIN MENU', items: ['CONTINUE', 'NEW QUEST', 'SPELLBOOK', 'LOAD DATA', 'OPTIONS'] },
    right: { type: 'sigil', title: 'ARCANE CREST', items: ['FIRE', 'WATER', 'WIND', 'EARTH'] }
  },
  {
    left: { type: 'stats', title: 'HERO STATUS', items: ['LV 24 MAGE', 'HP 420 / 420', 'MP 310 / 310', 'ATK 68  INT 145'] },
    right: { type: 'spells', title: 'MAGIC LIST', items: ['FIREBALL', 'ICE LANCE', 'HEAL LIGHT', 'TELEPORT'] }
  },
  {
    left: { type: 'inventory', title: 'ITEM BAG', items: ['POTION', 'ELIXIR', 'KEY', 'SCROLL', 'COMPASS', 'RING'] },
    right: { type: 'map', title: 'WORLD MAP', items: ['ROYAL CITY', 'CRYSTAL LAKE', 'DRAGON PEAK'] }
  },
  {
    left: { type: 'menu', title: 'QUEST LOG', items: ['THE ANCIENT SEAL', 'HERB GATHERING', 'LOST TOWER', 'GUILD REPORT'] },
    right: { type: 'spells', title: 'RUNE NOTES', items: ['IGNIS', 'GLACIES', 'VENTUS', 'TERRA'] }
  },
  {
    left: { type: 'settings', title: 'SYSTEM', items: ['BGM VOLUME', 'SFX VOLUME', 'CAMERA SPEED', 'SUBTITLES'] },
    right: { type: 'sigil', title: 'FINIS', items: ['CHAPTER I', 'CHAPTER II', 'CHAPTER III'] }
  }
];

export const PRESETS = [
  {
    id: 'burgundy',
    name: '紅革の魔導書',
    bookTitle: 'GRIMOIRE',
    coverColor: '#7c2d36',
    metalColor: '#d4a853',
    paperColor: '#dcd0b8',
    corners: 'chunky',
    coverPattern: 'arcane',
    emblem: 'compass',
    tabs: true
  },
  {
    id: 'navy',
    name: '紺碧の秘典',
    bookTitle: 'OCEAN TOME',
    coverColor: '#2c3e5a',
    metalColor: '#c9b37e',
    paperColor: '#d8d1c2',
    corners: 'chunky',
    coverPattern: 'royal',
    emblem: 'ring',
    tabs: true
  },
  {
    id: 'moss',
    name: '深緑の薬草書',
    bookTitle: 'HERB CODEX',
    coverColor: '#345947',
    metalColor: '#cfa65c',
    paperColor: '#daceb5',
    corners: 'round',
    coverPattern: 'classic',
    emblem: 'crest',
    tabs: true
  },
  {
    id: 'plum',
    name: '星辰の占星書',
    bookTitle: 'STAR ATLAS',
    coverColor: '#4a3b5c',
    metalColor: '#d8b263',
    paperColor: '#dbd4c6',
    corners: 'chunky',
    coverPattern: 'arcane',
    emblem: 'moon',
    tabs: true
  },
  {
    id: 'leather',
    name: '古革の冒険録',
    bookTitle: 'FIELD LOG',
    coverColor: '#6b442a',
    metalColor: '#c9974c',
    paperColor: '#d8cbb1',
    corners: 'chunky',
    coverPattern: 'classic',
    emblem: 'compass',
    tabs: true
  },
  {
    id: 'slate',
    name: '黒鉄の禁書',
    bookTitle: 'DARK TOME',
    coverColor: '#2f353d',
    metalColor: '#9aa4b2',
    paperColor: '#d2c9b8',
    corners: 'round',
    coverPattern: 'royal',
    emblem: 'ring',
    tabs: false
  }
];

export const BG_PRESETS = [
  { name: 'ウォームグレー', hex: '#e4e2dd', dark: false },
  { name: 'ライトグレー', hex: '#dfe3e8', dark: false },
  { name: 'セージ', hex: '#d7dfd9', dark: false },
  { name: 'ダークスレート', hex: '#262b33', dark: true }
];
