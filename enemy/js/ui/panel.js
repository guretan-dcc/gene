// サイドバーと状態の同期
import { state, applyType, resetSettings } from '../settings.js';
import { WEAPONS } from '../model/weapons.js';
import { HEADS } from '../model/robot.js';
import { MOTIONS } from '../preview/motion.js';

const $ = id => document.getElementById(id);
const FIELDS = ['name', 'seed', 'height', 'bulk', 'head', 'weapon', 'bodyColor', 'jointColor', 'trimColor', 'eyeColor', 'motion'];

export function syncPanel() {
  for (const key of FIELDS) $(key).value = state[key];
  $('shield').checked = state.shield;
  $('heightVal').textContent = `${state.height.toFixed(2)}m`;
  $('bulkVal').textContent = state.bulk.toFixed(2);
  document.querySelectorAll('[data-type]').forEach(button => {
    const active = button.dataset.type === state.type;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

// onChange(frame): frame が true ならカメラも合わせ直す
export function bindPanel(onChange) {
  const fill = (id, options) => {
    $(id).replaceChildren(...Object.entries(options).map(([value, label]) => new Option(label, value)));
  };
  fill('head', HEADS);
  fill('weapon', WEAPONS);
  fill('motion', MOTIONS);

  for (const key of FIELDS) {
    $(key).addEventListener('input', e => {
      if (typeof state[key] === 'number') {
        const value = Number(e.target.value);
        if (!Number.isFinite(value) || e.target.value === '') return;
        state[key] = value;
      } else {
        state[key] = e.target.value;
      }
      if (key !== 'name') syncPanel();
      onChange(false);
    });
  }
  $('shield').addEventListener('change', e => { state.shield = e.target.checked; onChange(false); });
  document.querySelectorAll('[data-type]').forEach(button => {
    button.addEventListener('click', () => { applyType(button.dataset.type); syncPanel(); onChange(true); });
  });
  $('btnRandomSeed').addEventListener('click', () => {
    state.seed = Math.floor(Math.random() * 100000);
    syncPanel();
    onChange(false);
  });
  $('btnReset').addEventListener('click', () => { resetSettings(); syncPanel(); onChange(true); });
}

let toastTimer = null;
export function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.remove('opacity-0');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('opacity-0'), 2400);
}
