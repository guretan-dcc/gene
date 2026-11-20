const defaultState = {
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

let state = JSON.parse(JSON.stringify(defaultState));
let builtArchipelago = null;
let generationMode = 'realtime'; // 'realtime' | 'manual'
let hasPendingChanges = false;

function markDirtyOrRebuild(forceImmediate = false) {
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
