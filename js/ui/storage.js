// サイドバーの設定をブラウザに自動保存し、次に開いたときに復元する
// （クリックで編集した敵・トラップの配置は保存しない）
import { state } from '../state.js';

const STORAGE_KEY = 'stageGenerator.settings';

function getFields() {
  return [...document.querySelectorAll('aside input[id], aside select[id]')];
}

// 保存領域が使えない環境（プライベートウィンドウなど）でも動くようにする
function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function save() {
  const values = Object.fromEntries(
    getFields().map(el => [el.id, el.type === 'checkbox' ? el.checked : el.value])
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // 保存できなくても生成には影響しない
  }
}

// 保存値を入力欄に戻し、同名の state にも反映する
function restoreField(el, value) {
  if (el.type === 'checkbox') {
    el.checked = value === true;
    if (el.id in state) state[el.id] = el.checked;
    return;
  }
  // 選択肢が無くなった値は使わない
  if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === value)) return;

  const before = el.value;
  el.value = value; // スライダーは範囲外の値を自動で丸める
  if (el.id in state) {
    state[el.id] = typeof state[el.id] === 'number' ? Number(el.value) : el.value;
  }
  const label = document.getElementById(el.id + 'Val');
  if (label && el.value !== before) label.textContent = el.value;
}

// 最初の生成より前に呼ぶ
export function restoreSettings() {
  const saved = readSaved();
  getFields().forEach(el => {
    if (el.id in saved) restoreField(el, saved[el.id]);
  });
  document.getElementById('trapAutoSettings').classList.toggle('opacity-45', !state.autoTraps);
}

export function bindSettingsStorage() {
  const sidebar = document.querySelector('aside');
  // click はシード抽選やサイズ切替ボタンのように、コードから値を変える操作を拾う
  ['input', 'change', 'click'].forEach(type => sidebar.addEventListener(type, save));

  document.getElementById('btnResetSettings').addEventListener('click', event => {
    event.stopPropagation(); // この後に保存し直さない
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 保存領域が使えなければ消すものもない
    }
    // 再読み込み時にブラウザが入力値を復元しないよう、先に初期値へ戻す
    getFields().forEach(el => {
      if (el.type === 'checkbox') el.checked = el.defaultChecked;
      else if (el.tagName === 'SELECT') el.value = [...el.options].find(o => o.defaultSelected)?.value ?? el.options[0].value;
      else el.value = el.defaultValue;
    });
    location.reload();
  });
}
