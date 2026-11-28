import { routeEditState } from '../scene/scene.js';
import { defaultState, markDirtyOrRebuild, setState } from '../state.js';
import { syncInspectorUI } from '../ui/inspector.js';
import { showToast } from '../ui/toast.js';

function validate(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.islands) || data.islands.length === 0) {
        throw new Error('islands（島のリスト）がありません');
    }
    data.islands.forEach((isl, i) => {
        const ok = isl && typeof isl === 'object'
            && ['width', 'posX', 'posY', 'posZ'].every(k => Number.isFinite(isl[k]));
        if (!ok) throw new Error(`${i + 1}番目の島に width / posX / posY / posZ がありません`);
    });
}

// 「生成設定書き出し」で書き出したファイルを読み込んで復元する
export async function importSettingsFile(file) {
    try {
        const data = JSON.parse(await file.text());
        validate(data);
        const next = { ...JSON.parse(JSON.stringify(defaultState)), ...data };
        next.selectedIslandIdx = Math.min(Math.max(0, next.selectedIslandIdx | 0), next.islands.length - 1);
        setState(next);
        routeEditState.selectedGizmo = null;
        markDirtyOrRebuild(true);
        syncInspectorUI();
        showToast(`${file.name} を読み込みました`);
    } catch (err) {
        showToast(`生成設定を読み込めませんでした: ${err.message}`);
    }
}
