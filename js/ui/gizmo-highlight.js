import { routeEditState } from '../scene/scene.js';
import { state } from '../state.js';
import { syncInspectorUI } from './inspector.js';

export function setFoldoutOpen(panelId, isOpen) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.toggle('hidden', !isOpen);
    const header = document.querySelector(`[data-fold-target="${panelId}"]`);
    if (header) {
        const arrow = header.querySelector('.fold-arrow');
        if (arrow) arrow.textContent = isOpen ? '▼' : '▶';
    }
}

export function selectAndHighlightGizmo(sel, shouldScroll = true) {
    routeEditState.selectedGizmo = sel;
    syncInspectorUI();

    document.querySelectorAll('.u-gizmo-highlight, .u-section-highlight').forEach(el => {
        el.classList.remove('u-gizmo-highlight', 'u-section-highlight');
    });

    const banner = document.getElementById('selectedGizmoBanner');
    if (!sel) {
        if (banner) banner.textContent = '3D画面の球をクリックで該当設定を強調';
        return;
    }

    setFoldoutOpen('panelRouteBridge', true);
    let focusEl = null;
    let labelText = '';
    const islCfg = state.islands[sel.islandIdx] || state.islands[state.selectedIslandIdx];
    const segTypes = (islCfg && islCfg.segmentTypes) ? islCfg.segmentTypes : {};

    function highlightRelatedPanels(segKeys) {
        let hasBr = false, hasTun = false, hasTr = false;
        segKeys.forEach(k => {
            const m = segTypes[k] || 'trail';
            if (m === 'bridge') hasBr = true;
            else if (m === 'tunnel') hasTun = true;
            else if (m === 'trail') hasTr = true;
            const sRow = document.querySelector(`[data-gizmo-row="seg_${k}"]`);
            if (sRow && (m === 'bridge' || m === 'tunnel')) sRow.classList.add('u-gizmo-highlight');
        });
        if (hasBr) {
            const brBox = document.getElementById('bridgeParamsBox');
            if (brBox) brBox.classList.add('u-section-highlight');
        }
        if (hasTun) {
            const caveBox = document.getElementById('caveSettingsBox');
            if (caveBox) caveBox.classList.add('u-section-highlight');
        }
        if (!hasBr && !hasTun && hasTr) {
            const trailBox = document.getElementById('trailShapeControlsBox');
            if (trailBox) trailBox.classList.add('u-section-highlight');
        }
    }

    if (sel.role === 'entry') {
        labelText = '選択中: 入口 / 橋受け口 (緑球)';
        focusEl = document.querySelector('[data-gizmo-row="entry"]');
        const brBox = document.getElementById('bridgeParamsBox');
        if (brBox) brBox.classList.add('u-section-highlight');
        highlightRelatedPanels(['seg_0']);
    } else if (sel.role === 'exit') {
        labelText = '選択中: 出口 / 次の島への吊り橋出し口 (紫球)';
        focusEl = document.querySelector('[data-gizmo-row="exit"]');
        const brBox = document.getElementById('bridgeParamsBox');
        if (brBox) brBox.classList.add('u-section-highlight');
        const chkNext = document.getElementById('lblChkBridgeToNext');
        if (chkNext) chkNext.classList.add('u-gizmo-highlight');
        const lastSegIdx = islCfg && Array.isArray(islCfg.waypointsNorm) ? islCfg.waypointsNorm.length : 0;
        highlightRelatedPanels([`seg_${lastSegIdx}`]);
    } else if (sel.role === 'waypoint') {
        const wi = sel.wpIdx || 0;
        labelText = `選択中: 経由点 #${wi + 1}`;
        focusEl = document.querySelector(`[data-gizmo-row="waypoint_${wi}"]`);
        highlightRelatedPanels([`seg_${wi}`, `seg_${wi + 1}`]);
    } else if (sel.role === 'branchStart' || sel.role === 'branchPoint') {
        const isPtStr = typeof sel.wpIdx === 'string';
        const bIdx = isPtStr ? parseInt(sel.wpIdx.split('_')[0], 10) : sel.wpIdx;
        const ptIdx = isPtStr ? parseInt(sel.wpIdx.split('_')[1], 10) : -1;
        labelText = ptIdx >= 0
            ? `選択中: 分岐 #${bIdx + 1} - 点${ptIdx + 1}`
            : `選択中: 分岐 #${bIdx + 1} 起点`;
        focusEl = document.querySelector(`[data-gizmo-row="branch_${bIdx}"]`);
        if (isPtStr) {
            const subPt = document.querySelector(`[data-gizmo-sub="branchPt_${sel.wpIdx}"]`);
            if (subPt) {
                subPt.classList.add('u-gizmo-highlight');
                focusEl = subPt;
            }
            const adjKeys = [`branch_${bIdx}_${ptIdx}`, `branch_${bIdx}_${ptIdx + 1}`, `branch_${bIdx}_merge`];
            highlightRelatedPanels(adjKeys);
        } else {
            highlightRelatedPanels([`branch_${bIdx}_0`]);
        }
    } else if (sel.role === 'segment') {
        const mode = segTypes[sel.segKey] || 'trail';
        const modeLabel = mode === 'bridge' ? '橋' : (mode === 'tunnel' ? 'トンネル' : (mode === 'none' ? '切断' : '道'));
        labelText = `選択中: 区間 (${modeLabel})`;
        focusEl = document.querySelector(`[data-gizmo-row="seg_${sel.segKey}"]`);
        highlightRelatedPanels([sel.segKey]);
    }

    if (banner) banner.textContent = labelText;
    if (focusEl) {
        focusEl.classList.add('u-gizmo-highlight');
        if (shouldScroll) {
            focusEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}
