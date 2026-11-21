import { createPresetIslands } from '../data/presets.js';
import { importSettingsFile } from '../export/importers.js';
import { exportPlyMesh, exportSettingsJson, exportUnityPrefab } from '../export/exporters.js';
import { showFlags } from '../scene/archipelago.js';
import { rebuildScene } from '../scene/rebuild.js';
import { camState, routeEditState, updateCamera, worldGroup } from '../scene/scene.js';
import { builtArchipelago, defaultState, hasPendingChanges, markDirtyOrRebuild, setGenerationMode, setState, state } from '../state.js';
import { setFoldoutOpen } from './gizmo-highlight.js';
import { renderIslandListUI } from './island-list.js';
import { showToast } from './toast.js';
import { renderWaypointListUI } from './waypoint-list.js';
import { addManualRiver, ensureManualRivers, renderRiverListUI } from './river-list.js';
import { clamp } from '../utils/math.js';

// 色ピッカーのID → state のキー
const COLOR_MAP = {
    colGrass: 'grassColor',
    colForest: 'forestGroundColor',
    colSand: 'sandColor',
    colRock: 'rockColor',
    colSnow: 'snowColor',
    colUnder: 'underColor',
    colWater: 'waterColor',
    colWood: 'woodColor'
};

export function syncInspectorUI() {
    renderIslandListUI();
    renderWaypointListUI();
    renderRiverListUI(syncInspectorUI);
    {
        const isl = state.islands[state.selectedIslandIdx];
        document.getElementById('chkAutoRivers').checked = isl.autoRivers !== false;
        document.getElementById('chkLakeOutletRiver').checked = isl.lakeOutletRiver === true;
        document.getElementById('btnRiverDraw').classList.toggle('active', !!routeEditState.riverDraw);
    }
    const isl = state.islands[state.selectedIslandIdx] || state.islands[0];
    document.getElementById('selectedIslandTitle').textContent = `2. 島の配置・サイズ (${isl.name})`;
    document.getElementById('inpStageName').value = state.stageName;
    document.getElementById('selArchPreset').value = state.archPreset;
    document.getElementById('inpSeed').value = isl.seed;
    document.getElementById('btnToggleGizmos').classList.toggle('active', Boolean(routeEditState.enabled));
    document.getElementById('chkHasTrail').checked = isl.hasTrail !== false;
    document.getElementById('chkHasInternalBridge').checked = isl.hasInternalBridge !== false;
    document.getElementById('chkBridgeToNext').checked = isl.hasBridgeToNext !== false;

    Object.entries(COLOR_MAP).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el && state[key]) el.value = state[key];
    });

    document.querySelectorAll('[data-isl-bind]').forEach(row => {
        const key = row.getAttribute('data-isl-bind');
        const min = parseFloat(row.getAttribute('data-min'));
        const max = parseFloat(row.getAttribute('data-max'));
        const step = parseFloat(row.getAttribute('data-step'));
        const slider = row.querySelector('.u-slider');
        const num = row.querySelector('.u-num');
        slider.min = min; slider.max = max; slider.step = step;
        num.min = min; num.max = max; num.step = step;
        const fallbackVal = key === 'caveWidth' ? 3.2 : min;
        const val = isl[key] !== undefined ? isl[key] : fallbackVal;
        slider.value = val;
        num.value = val;
    });

    document.querySelectorAll('[data-global-bind]').forEach(row => {
        const key = row.getAttribute('data-global-bind');
        const min = parseFloat(row.getAttribute('data-min'));
        const max = parseFloat(row.getAttribute('data-max'));
        const step = parseFloat(row.getAttribute('data-step'));
        const slider = row.querySelector('.u-slider');
        const num = row.querySelector('.u-num');
        slider.min = min; slider.max = max; slider.step = step;
        num.min = min; num.max = max; num.step = step;
        const val = state[key];
        slider.value = val;
        num.value = val;
    });
}

function focusSelectedIsland() {
    if (!builtArchipelago) return;
    const selIsl = builtArchipelago.builtIslands[state.selectedIslandIdx];
    if (!selIsl) return;
    camState.target.set(selIsl.ox, selIsl.oy + 8, selIsl.oz);
    camState.radius = Math.max(52, selIsl.half * 2.05);
    updateCamera();
}

export function setupInspectorEvents() {
    const btnRealtime = document.getElementById('btnModeRealtime');
    const btnManual = document.getElementById('btnModeManual');
    const btnGenerateNow = document.getElementById('btnGenerateNow');

    function setGenMode(mode) {
        setGenerationMode(mode);
        const isRT = (mode === 'realtime');
        btnRealtime.className = isRT
            ? 'px-2.5 py-1 text-[11px] rounded bg-[#2563eb] text-white font-medium'
            : 'px-2.5 py-1 text-[11px] rounded text-[#a1a1aa] hover:text-white';
        btnManual.className = !isRT
            ? 'px-2.5 py-1 text-[11px] rounded bg-[#2563eb] text-white font-medium'
            : 'px-2.5 py-1 text-[11px] rounded text-[#a1a1aa] hover:text-white';
        // リアルタイム中は変更が即反映されるので、生成ボタンは押せなくする
        btnGenerateNow.disabled = isRT;
        btnGenerateNow.title = isRT ? 'リアルタイムモードでは自動で反映されます' : '現在の設定で生成';
        if (isRT && hasPendingChanges) {
            markDirtyOrRebuild(true);
        }
    }
    setGenMode('realtime');

    btnRealtime.addEventListener('click', () => setGenMode('realtime'));
    btnManual.addEventListener('click', () => setGenMode('manual'));
    btnGenerateNow.addEventListener('click', () => {
        markDirtyOrRebuild(true);
        showToast("現在の設定で生成しました");
    });

    document.querySelectorAll('[data-isl-bind]').forEach(row => {
        const key = row.getAttribute('data-isl-bind');
        const min = parseFloat(row.getAttribute('data-min'));
        const max = parseFloat(row.getAttribute('data-max'));
        const slider = row.querySelector('.u-slider');
        const num = row.querySelector('.u-num');
        const apply = (raw) => {
            const v = clamp(parseFloat(raw) || 0, min, max);
            state.islands[state.selectedIslandIdx][key] = v;
            slider.value = v;
            num.value = v;
            markDirtyOrRebuild();
        };
        slider.addEventListener('input', e => apply(e.target.value));
        num.addEventListener('change', e => apply(e.target.value));
    });

    document.querySelectorAll('[data-global-bind]').forEach(row => {
        const key = row.getAttribute('data-global-bind');
        const min = parseFloat(row.getAttribute('data-min'));
        const max = parseFloat(row.getAttribute('data-max'));
        const slider = row.querySelector('.u-slider');
        const num = row.querySelector('.u-num');
        const apply = (raw) => {
            const v = clamp(parseFloat(raw) || 0, min, max);
            state[key] = v;
            slider.value = v;
            num.value = v;
            markDirtyOrRebuild();
        };
        slider.addEventListener('input', e => apply(e.target.value));
        num.addEventListener('change', e => apply(e.target.value));
    });

    document.getElementById('inpStageName').addEventListener('change', e => {
        state.stageName = e.target.value.trim() || 'AdventureArchipelago';
    });

    document.getElementById('selArchPreset').addEventListener('change', e => {
        state.archPreset = e.target.value;
        state.islands = createPresetIslands(state.archPreset);
        state.selectedIslandIdx = Math.min(1, state.islands.length - 1);
        routeEditState.selectedGizmo = null;
        markDirtyOrRebuild(true);
        syncInspectorUI();
    });

    document.getElementById('btnAddWaypoint').addEventListener('click', () => {
        const isl = state.islands[state.selectedIslandIdx];
        if (!Array.isArray(isl.waypointsNorm)) isl.waypointsNorm = [];
        const last = isl.waypointsNorm.length > 0 ? isl.waypointsNorm[isl.waypointsNorm.length - 1] : (isl.entryNorm || { x: -0.3, z: 0.3 });
        const ex = isl.exitNorm || { x: 0.3, z: -0.3 };
        isl.waypointsNorm.push({
            x: Number(((last.x + ex.x) * 0.5).toFixed(2)),
            z: Number(((last.z + ex.z) * 0.5).toFixed(2)),
            yOffset: 0.0
        });
        rebuildScene();
        syncInspectorUI();
    });

    document.getElementById('chkAutoRivers').addEventListener('change', e => {
        state.islands[state.selectedIslandIdx].autoRivers = e.target.checked;
        markDirtyOrRebuild();
    });
    document.getElementById('chkLakeOutletRiver').addEventListener('change', e => {
        state.islands[state.selectedIslandIdx].lakeOutletRiver = e.target.checked;
        markDirtyOrRebuild();
    });
    document.getElementById('btnAddManualRiver').addEventListener('click', () => {
        addManualRiver(state.islands[state.selectedIslandIdx]);
        markDirtyOrRebuild();
        syncInspectorUI();
    });
    document.getElementById('btnRiverDraw').addEventListener('click', e => {
        routeEditState.riverDraw = !routeEditState.riverDraw;
        e.currentTarget.classList.toggle('active', routeEditState.riverDraw);
        if (routeEditState.riverDraw) {
            const rv = ensureManualRivers(state.islands[state.selectedIslandIdx]);
            if (rv.length === 0) { rv.push({ points: [] }); routeEditState.activeRiver = 0; syncInspectorUI(); }
            showToast('3D上をダブルクリックで川の点を追加（水源→河口の順）');
        }
    });

    document.getElementById('btnAddBranch').addEventListener('click', () => {
        const isl = state.islands[state.selectedIslandIdx];
        if (!Array.isArray(isl.branches)) isl.branches = [];
        const defaultFrom = (Array.isArray(isl.waypointsNorm) && isl.waypointsNorm.length > 0)
            ? `wp_${Math.floor((isl.waypointsNorm.length - 1) / 2)}`
            : 'entry';
        const offset = (isl.branches.length % 3) * 0.16;
        isl.branches.push({
            fromRef: defaultFrom,
            toRef: 'none',
            startNorm: { x: -0.15 + offset, z: 0.10, yOffset: 0.0 },
            pointsNorm: [
                { x: Number((0.18 - offset).toFixed(2)), z: Number((0.36 - offset * 0.5).toFixed(2)), yOffset: 0.0 }
            ]
        });
        rebuildScene();
        syncInspectorUI();
    });

    document.getElementById('btnResetIslandRoute').addEventListener('click', () => {
        const presetIslands = createPresetIslands(state.archPreset);
        const defIsl = presetIslands[state.selectedIslandIdx];
        const curIsl = state.islands[state.selectedIslandIdx];
        if (defIsl && curIsl) {
            curIsl.entryNorm = JSON.parse(JSON.stringify(defIsl.entryNorm));
            curIsl.exitNorm = JSON.parse(JSON.stringify(defIsl.exitNorm));
            curIsl.waypointsNorm = JSON.parse(JSON.stringify(defIsl.waypointsNorm));
            curIsl.branches = [];
            curIsl.segmentTypes = {};
            delete curIsl._autoBridgeInitialized;
        }
        routeEditState.selectedGizmo = null;
        rebuildScene();
        syncInspectorUI();
        showToast("選択島の動線をリセットしました");
    });

    document.getElementById('btnToggleGizmos').addEventListener('click', e => {
        routeEditState.enabled = !routeEditState.enabled;
        e.currentTarget.classList.toggle('active', routeEditState.enabled);
        worldGroup.children.forEach(ch => {
            if (ch.userData && ch.userData.tag === 'route') ch.visible = routeEditState.enabled;
        });
    });

    document.getElementById('btnSoloIsland').addEventListener('click', e => {
        routeEditState.soloIsland = !routeEditState.soloIsland;
        e.currentTarget.classList.toggle('active', routeEditState.soloIsland);
        if (routeEditState.soloIsland) focusSelectedIsland();
        rebuildScene();
    });

    document.getElementById('chkHasTrail').addEventListener('change', e => {
        state.islands[state.selectedIslandIdx].hasTrail = e.target.checked;
        markDirtyOrRebuild();
    });

    document.getElementById('chkHasInternalBridge').addEventListener('change', e => {
        state.islands[state.selectedIslandIdx].hasInternalBridge = e.target.checked;
        syncInspectorUI();
        markDirtyOrRebuild();
    });

    document.getElementById('chkBridgeToNext').addEventListener('change', e => {
        state.islands[state.selectedIslandIdx].hasBridgeToNext = e.target.checked;
        markDirtyOrRebuild();
    });

    document.getElementById('inpSeed').addEventListener('change', e => {
        state.islands[state.selectedIslandIdx].seed = parseInt(e.target.value, 10) || 1234;
        markDirtyOrRebuild();
    });

    document.getElementById('btnRandomSeed').addEventListener('click', () => {
        const nextSeed = Math.floor(Math.random() * 90000) + 1000;
        const isl = state.islands[state.selectedIslandIdx];
        isl.seed = nextSeed;
        isl.waypointsNorm = [];
        isl.segmentTypes = {};
        delete isl._autoBridgeInitialized;
        document.getElementById('inpSeed').value = nextSeed;
        markDirtyOrRebuild();
        syncInspectorUI();
    });

    const fileInput = document.getElementById('fileImportJson');
    document.getElementById('btnImportJson').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        fileInput.value = '';
        if (file) await importSettingsFile(file);
    });

    document.getElementById('btnResetAll').addEventListener('click', () => {
        setState(JSON.parse(JSON.stringify(defaultState)));
        routeEditState.selectedGizmo = null;
        rebuildScene();
        syncInspectorUI();
        showToast("初期設定に戻しました");
    });

    Object.entries(COLOR_MAP).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', e => {
            state[key] = e.target.value;
            markDirtyOrRebuild();
        });
    });

    document.querySelectorAll('.u-foldout[data-fold-target]').forEach(header => {
        const targetId = header.getAttribute('data-fold-target');
        header.addEventListener('click', () => {
            const panel = document.getElementById(targetId);
            if (!panel) return;
            setFoldoutOpen(targetId, panel.classList.contains('hidden'));
        });
    });

    document.getElementById('btnExpandAllFolds').addEventListener('click', () => {
        document.querySelectorAll('.u-foldout[data-fold-target]').forEach(h => {
            setFoldoutOpen(h.getAttribute('data-fold-target'), true);
        });
    });

    document.getElementById('btnCollapseAllFolds').addEventListener('click', () => {
        document.querySelectorAll('.u-foldout[data-fold-target]').forEach(h => {
            setFoldoutOpen(h.getAttribute('data-fold-target'), false);
        });
    });

    document.getElementById('btnViewOrbit').addEventListener('click', () => {
        camState.target.set(0, 12, 0);
        camState.theta = -0.58;
        camState.phi = 1.06;
        camState.radius = 155;
        updateCamera();
    });

    document.getElementById('btnFocusIsland').addEventListener('click', focusSelectedIsland);

    document.getElementById('btnToggleWire').addEventListener('click', e => {
        showFlags.wire = !showFlags.wire;
        e.currentTarget.classList.toggle('active', showFlags.wire);
        rebuildScene();
    });
    document.getElementById('btnToggleWater').addEventListener('click', e => {
        showFlags.water = !showFlags.water;
        e.currentTarget.classList.toggle('active', showFlags.water);
        worldGroup.children.forEach(ch => {
            if (ch.userData && ch.userData.tag === 'water') ch.visible = showFlags.water;
        });
    });
    document.getElementById('btnToggleVeg').addEventListener('click', e => {
        showFlags.veg = !showFlags.veg;
        e.currentTarget.classList.toggle('active', showFlags.veg);
        worldGroup.children.forEach(ch => {
            if (ch.userData && ch.userData.tag === 'veg') ch.visible = showFlags.veg;
        });
    });

    document.getElementById('btnExportPrefab').addEventListener('click', exportUnityPrefab);
    document.getElementById('btnExportJson').addEventListener('click', exportSettingsJson);
    document.getElementById('btnExportPly').addEventListener('click', exportPlyMesh);
}
