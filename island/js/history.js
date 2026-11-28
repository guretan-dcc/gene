// Undo / Redo（Ctrl+Z / Ctrl+Y）
// state 全体の JSON スナップショットを履歴として積む。
// 変更箇所ごとにフックせず、ユーザー操作イベントの後に「状態が変わっていれば記録」する方式。
import { routeEditState } from './scene/scene.js';
import { markDirtyOrRebuild, setState, state } from './state.js';
import { syncInspectorUI } from './ui/inspector.js';
import { showToast } from './ui/toast.js';
import { saveLastState } from './persist.js';

const LIMIT = 100;
const DEBOUNCE_MS = 400;

let stack = [];
let index = -1;
let current = '';
let timer = null;

const snapshot = () => JSON.stringify(state);

function updateButtons() {
    const u = document.getElementById('btnUndo');
    const r = document.getElementById('btnRedo');
    if (u) u.disabled = index <= 0;
    if (r) r.disabled = index >= stack.length - 1;
}

function scheduleCommit() {
    clearTimeout(timer);
    timer = setTimeout(commitSnapshot, DEBOUNCE_MS);
}

export function commitSnapshot() {
    clearTimeout(timer);
    const s = snapshot();
    if (s === current) return;
    stack.length = index + 1;
    stack.push(s);
    if (stack.length > LIMIT) stack.shift();
    index = stack.length - 1;
    current = s;
    saveLastState(s);
    updateButtons();
}

function restore(i) {
    index = i;
    setState(JSON.parse(stack[i]));
    routeEditState.selectedGizmo = null;
    markDirtyOrRebuild(true);
    syncInspectorUI();
    current = snapshot(); // 再生成で state に付く内部フラグ込みで基準を取り直す
    updateButtons();
}

export function undo() {
    commitSnapshot();
    if (index <= 0) return;
    restore(index - 1);
    showToast('元に戻しました');
}

export function redo() {
    commitSnapshot();
    if (index >= stack.length - 1) return;
    restore(index + 1);
    showToast('やり直しました');
}

function onKeyDown(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const t = e.target;
    // テキスト入力中はブラウザ標準の入力取り消しを優先
    if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type === 'text'))) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    } else if (k === 'y') {
        e.preventDefault();
        redo();
    }
}

// 初回の描画・UI同期が終わった後に呼ぶ
export function initHistory() {
    stack = [snapshot()];
    index = 0;
    current = stack[0];
    ['pointerup', 'input', 'change', 'click', 'keyup'].forEach(type => {
        document.addEventListener(type, scheduleCommit, true);
    });
    document.addEventListener('keydown', onKeyDown);
    document.getElementById('btnUndo').addEventListener('click', undo);
    document.getElementById('btnRedo').addEventListener('click', redo);
    updateButtons();
}
