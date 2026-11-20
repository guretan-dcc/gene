import { createPresetIslands } from './data/presets.js';
import { rebuildScene } from './scene/rebuild.js';

export const defaultState = {
    stageName: "AdventureArchipelago",
    archPreset: "canyon_pass_3",
    selectedIslandIdx: 1,
    globalSnowLine: 32,
    bridgeWidth: 1.5,
    bridgeSag: 0.65,
    bridgeIrregularity: 0.55,
    grassColor: "#73b845",
    forestGroundColor: "#4d8c38",
    sandColor: "#c8b482",
    rockColor: "#85807a",
    snowColor: "#f2f7ff",
    underColor: "#59473a",
    waterColor: "#388bfd",
    trunkColor: "#734d2e",
    leafColor: "#338040",
    woodColor: "#7a4a1f",
    islands: createPresetIslands("canyon_pass_3")
};

export let state = JSON.parse(JSON.stringify(defaultState));
export let builtArchipelago = null;
let generationMode = 'realtime'; // 'realtime' | 'manual'
export let hasPendingChanges = false;

// ES Module では import した変数を他ファイルから再代入できないため、setter 経由で更新する
export function setState(v) { state = v; }
export function setBuiltArchipelago(v) { builtArchipelago = v; }
export function setGenerationMode(v) { generationMode = v; }

export function markDirtyOrRebuild(forceImmediate = false) {
    if (forceImmediate || generationMode === 'realtime') {
        hasPendingChanges = false;
        updatePendingBadgeUI();
        rebuildScene();
    } else {
        hasPendingChanges = true;
        updatePendingBadgeUI();
    }
}

function updatePendingBadgeUI() {
    const badge = document.getElementById('badgePendingChanges');
    if (!badge) return;
    badge.classList.toggle('hidden', !hasPendingChanges);
}
