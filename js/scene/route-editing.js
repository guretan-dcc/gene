import { rebuildScene } from './rebuild.js';
import { camera, canvas, raycaster, routeEditState, routeHandleMeshes, segmentToggleMeshes } from './scene.js';
import { builtArchipelago, markDirtyOrRebuild, state } from '../state.js';
import { selectAndHighlightGizmo } from '../ui/gizmo-highlight.js';
import { syncInspectorUI } from '../ui/inspector.js';
import { showToast } from '../ui/toast.js';
import { clamp } from '../utils/math.js';

// 3D画面上のダイヤをクリックで区間を強調表示（選択済みを再クリックで 道→橋→トンネル→切断 を切替）
export function tryToggleSegmentOnClick(e) {
    if (!builtArchipelago || segmentToggleMeshes.length === 0) return false;
    raycaster.setFromCamera(getNdcMouse(e), camera);
    const hits = raycaster.intersectObjects(segmentToggleMeshes, false);
    if (hits.length === 0) return false;

    const ud = hits[0].object.userData;
    state.selectedIslandIdx = ud.islandIdx;
    const islCfg = state.islands[ud.islandIdx];
    if (!islCfg.segmentTypes) islCfg.segmentTypes = {};

    const prevSel = routeEditState.selectedGizmo;
    const alreadySelected = Boolean(prevSel && prevSel.islandIdx === ud.islandIdx && prevSel.role === 'segment' && prevSel.segKey === ud.segKey);
    const order = ['trail', 'bridge', 'tunnel', 'none'];
    const curMode = islCfg.segmentTypes[ud.segKey] || 'trail';

    if (alreadySelected) {
        const nextMode = order[(order.indexOf(curMode) + 1) % order.length];
        islCfg.segmentTypes[ud.segKey] = nextMode;
        const modeName = nextMode === 'bridge' ? '橋' : (nextMode === 'tunnel' ? 'トンネル' : (nextMode === 'none' ? '切断' : '道'));
        showToast(`区間を「${modeName}」に切り替えました`);
    } else {
        showToast(`区間を選択しました（右リストまたは再クリックで 道/橋/トンネル/切断 を切替）`);
    }

    rebuildScene();
    selectAndHighlightGizmo({ islandIdx: ud.islandIdx, role: 'segment', wpIdx: -1, segKey: ud.segKey }, true);
    return true;
}

// 3D画面上でのルート・橋アンカー球のドラッグ＆ダブルクリック追加
function getNdcMouse(e) {
    const rect = canvas.getBoundingClientRect();
    return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
}

export function tryBeginDragRouteHandle(e) {
    if (!builtArchipelago || routeHandleMeshes.length === 0) return false;
    raycaster.setFromCamera(getNdcMouse(e), camera);
    const hits = raycaster.intersectObjects(routeHandleMeshes, false);
    if (hits.length === 0) return false;

    const ud = hits[0].object.userData;
    state.selectedIslandIdx = ud.islandIdx;
    routeEditState.draggingHandle = {
        islandIdx: ud.islandIdx,
        role: ud.role,
        wpIdx: ud.wpIdx,
        lastClientY: e.clientY
    };
    selectAndHighlightGizmo({
        islandIdx: ud.islandIdx,
        role: ud.role,
        wpIdx: ud.wpIdx
    }, true);
    if (ud.role !== 'riverPoint') rebuildScene();   // 川の点はドラッグ終了時に再生成
    return true;
}

export function handleDragRouteHandleMove(e) {
    const drag = routeEditState.draggingHandle;
    if (!drag || !builtArchipelago) return;
    const isl = builtArchipelago.builtIslands[drag.islandIdx];
    if (!isl || !isl.terrainMeshObj) return;
    const islCfg = state.islands[drag.islandIdx];

    // Shiftキーを押しながらドラッグすると、各ポイント（入口・経由点・分岐点・出口）の3次元高さ(yOffset)を上下に変更できる
    if (e.shiftKey) {
        const dyPx = (drag.lastClientY !== undefined ? drag.lastClientY : e.clientY) - e.clientY;
        drag.lastClientY = e.clientY;
        const deltaY = dyPx * 0.12;
        const adjustYOffset = (obj) => {
            if (!obj) return;
            obj.yOffset = Number(clamp((obj.yOffset || 0) + deltaY, -18.0, 35.0).toFixed(2));
        };
        if (drag.role === 'riverPoint') return;
        if (drag.role === 'entry') adjustYOffset(islCfg.entryNorm);
        else if (drag.role === 'exit') adjustYOffset(islCfg.exitNorm);
        else if (drag.role === 'waypoint' && islCfg.waypointsNorm && islCfg.waypointsNorm[drag.wpIdx]) {
            adjustYOffset(islCfg.waypointsNorm[drag.wpIdx]);
        } else if (drag.role === 'branchStart' && islCfg.branches && islCfg.branches[drag.wpIdx]) {
            adjustYOffset(islCfg.branches[drag.wpIdx].startNorm);
        } else if (drag.role === 'branchPoint' && typeof drag.wpIdx === 'string') {
            const [bIdxStr, ptIdxStr] = drag.wpIdx.split('_');
            const bIdx = parseInt(bIdxStr, 10), ptIdx = parseInt(ptIdxStr, 10);
            if (islCfg.branches && islCfg.branches[bIdx] && islCfg.branches[bIdx].pointsNorm && islCfg.branches[bIdx].pointsNorm[ptIdx]) {
                adjustYOffset(islCfg.branches[bIdx].pointsNorm[ptIdx]);
            }
        }
        rebuildScene();
        return;
    }
    drag.lastClientY = e.clientY;

    raycaster.setFromCamera(getNdcMouse(e), camera);
    const hits = raycaster.intersectObject(isl.terrainMeshObj, false);
    let pt = null;
    if (hits.length > 0) {
        pt = hits[0].point;
    } else {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(isl.oy + 8));
        const target = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, target)) pt = target;
    }
    if (!pt) return;

    const nx = clamp((pt.x - isl.ox) / isl.half, -0.96, 0.96);
    const nz = clamp((pt.z - isl.oz) / isl.half, -0.96, 0.96);

    if (drag.role === 'riverPoint') {
        // 地形の再生成は重いので、ドラッグ中は値と球の位置だけ更新し、離した時に再生成する
        const [rI, pI] = String(drag.wpIdx).split('_').map(v => parseInt(v, 10));
        const rv = islCfg.manualRivers && islCfg.manualRivers[rI];
        if (rv && rv.points[pI]) {
            rv.points[pI] = { x: Number(nx.toFixed(3)), z: Number(nz.toFixed(3)) };
            drag.moved = true;
            const mesh = routeHandleMeshes.find(m => m.userData.role === 'riverPoint'
                && m.userData.islandIdx === drag.islandIdx && String(m.userData.wpIdx) === String(drag.wpIdx));
            if (mesh) mesh.position.set(isl.ox + nx * isl.half, (hits.length ? pt.y : mesh.position.y - 1.15) + 1.15, isl.oz + nz * isl.half);
        }
        return;
    }

    if (drag.role === 'entry') {
        islCfg.entryNorm = { x: Number(nx.toFixed(3)), z: Number(nz.toFixed(3)), yOffset: islCfg.entryNorm ? (islCfg.entryNorm.yOffset || 0) : 0 };
    } else if (drag.role === 'exit') {
        islCfg.exitNorm = { x: Number(nx.toFixed(3)), z: Number(nz.toFixed(3)), yOffset: islCfg.exitNorm ? (islCfg.exitNorm.yOffset || 0) : 0 };
    } else if (drag.role === 'waypoint' && islCfg.waypointsNorm && islCfg.waypointsNorm[drag.wpIdx]) {
        const prevY = islCfg.waypointsNorm[drag.wpIdx].yOffset || 0;
        islCfg.waypointsNorm[drag.wpIdx] = { x: Number(nx.toFixed(3)), z: Number(nz.toFixed(3)), yOffset: prevY };
    } else if (drag.role === 'branchStart' && islCfg.branches && islCfg.branches[drag.wpIdx]) {
        const prevY = islCfg.branches[drag.wpIdx].startNorm ? (islCfg.branches[drag.wpIdx].startNorm.yOffset || 0) : 0;
        islCfg.branches[drag.wpIdx].startNorm = { x: Number(nx.toFixed(3)), z: Number(nz.toFixed(3)), yOffset: prevY };
    } else if (drag.role === 'branchPoint' && typeof drag.wpIdx === 'string') {
        const [bIdxStr, ptIdxStr] = drag.wpIdx.split('_');
        const bIdx = parseInt(bIdxStr, 10), ptIdx = parseInt(ptIdxStr, 10);
        if (islCfg.branches && islCfg.branches[bIdx] && islCfg.branches[bIdx].pointsNorm && islCfg.branches[bIdx].pointsNorm[ptIdx]) {
            const prevY = islCfg.branches[bIdx].pointsNorm[ptIdx].yOffset || 0;
            islCfg.branches[bIdx].pointsNorm[ptIdx] = { x: Number(nx.toFixed(3)), z: Number(nz.toFixed(3)), yOffset: prevY };
        }
    }
    rebuildScene();
}

export function handleAddWaypointOnDoubleClick(e) {
    if (!builtArchipelago) return;
    raycaster.setFromCamera(getNdcMouse(e), camera);
    const terrainMeshes = builtArchipelago.builtIslands.map(isl => isl.terrainMeshObj).filter(Boolean);
    const hits = raycaster.intersectObjects(terrainMeshes, false);
    if (hits.length === 0) return;

    if (routeEditState.riverDraw) {
        const hi = hits[0].object.userData.islandIdx;
        state.selectedIslandIdx = hi;
        const isl2 = builtArchipelago.builtIslands[hi];
        const cfg2 = state.islands[hi];
        if (!Array.isArray(cfg2.manualRivers)) cfg2.manualRivers = [];
        if (cfg2.manualRivers.length === 0) cfg2.manualRivers.push({ points: [] });
        const ai = clamp(routeEditState.activeRiver, 0, cfg2.manualRivers.length - 1);
        routeEditState.activeRiver = ai;
        const p2 = hits[0].point;
        cfg2.manualRivers[ai].points.push({
            x: Number(clamp((p2.x - isl2.ox) / isl2.half, -0.96, 0.96).toFixed(3)),
            z: Number(clamp((p2.z - isl2.oz) / isl2.half, -0.96, 0.96).toFixed(3))
        });
        syncInspectorUI();
        markDirtyOrRebuild();
        showToast(`川 #${ai + 1} に点を追加しました`);
        return;
    }

    const hitIslIdx = hits[0].object.userData.islandIdx;
    state.selectedIslandIdx = hitIslIdx;
    const isl = builtArchipelago.builtIslands[hitIslIdx];
    const islCfg = state.islands[hitIslIdx];
    const pt = hits[0].point;
    const nx = clamp((pt.x - isl.ox) / isl.half, -0.85, 0.85);
    const nz = clamp((pt.z - isl.oz) / isl.half, -0.85, 0.85);

    if (!Array.isArray(islCfg.waypointsNorm)) islCfg.waypointsNorm = [];
    islCfg.waypointsNorm.push({ x: Number(nx.toFixed(3)), z: Number(nz.toFixed(3)), yOffset: 0.0 });
    syncInspectorUI();
    rebuildScene();
    showToast(`${isl.name} に新しい道の経由点（黄球）を追加しました`);
}
