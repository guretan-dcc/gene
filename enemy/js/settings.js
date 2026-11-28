// 設定値・種類ごとの初期値・自動保存
const STORAGE_KEY = 'gene.enemy.settings';

// 種類はステージジェネレーターの敵(近接・遠距離)とボス部屋に合わせる
export const TYPES = {
  melee: {
    name: 'Enemy_Melee', height: 1.7, bulk: 1, head: 'box', weapon: 'sword', shield: false,
    bodyColor: '#a8453d', jointColor: '#3a3f47', trimColor: '#d9d4c7', eyeColor: '#ffe066'
  },
  ranged: {
    name: 'Enemy_Ranged', height: 1.65, bulk: 0.8, head: 'wedge', weapon: 'bow', shield: false,
    bodyColor: '#c98a2e', jointColor: '#3a3f47', trimColor: '#d9d4c7', eyeColor: '#7df9ff'
  },
  boss: {
    name: 'Enemy_Boss', height: 2.6, bulk: 1.35, head: 'dome', weapon: 'axe', shield: true,
    bodyColor: '#5b4a7a', jointColor: '#2b2e35', trimColor: '#c9a45c', eyeColor: '#ff5a5a'
  }
};

export const state = { type: 'melee', seed: 1, motion: 'idle', ...TYPES.melee };

export function applyType(type) {
  Object.assign(state, { type }, TYPES[type]);
}

export function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* 保存できなくても続行 */ }
}

export function restoreSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    if (TYPES[saved.type]) applyType(saved.type);
    for (const key of Object.keys(state)) {
      if (typeof saved[key] === typeof state[key]) state[key] = saved[key];
    }
  } catch (_) { /* 壊れた保存値は無視 */ }
}

export function resetSettings() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* noop */ }
  Object.assign(state, { seed: 1, motion: 'idle' });
  applyType('melee');
}
