// 前回の設定値の自動保存・復元 (localStorage)。保存できない環境でも動作に影響しない。
import { defaultState, setState, state } from './state.js';

const KEY = 'gene.lastState.v1';

export function saveLastState(json) {
    try { localStorage.setItem(KEY, json); } catch (_) { /* 保存できなくても続行 */ }
}

// 起動時に呼ぶ。復元できたら true
export function restoreLastState() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.islands) || data.islands.length === 0) return false;
        const ok = data.islands.every(i => i && ['width', 'posX', 'posY', 'posZ'].every(k => Number.isFinite(i[k])));
        if (!ok) return false;
        const next = { ...JSON.parse(JSON.stringify(defaultState)), ...data };
        next.selectedIslandIdx = Math.min(Math.max(0, next.selectedIslandIdx | 0), next.islands.length - 1);
        setState(next);
        return true;
    } catch (_) {
        return false;
    }
}

export function saveCurrentState() {
    saveLastState(JSON.stringify(state));
}
