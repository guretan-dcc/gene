import { rebuildScene } from '../scene/rebuild.js';
import { routeEditState } from '../scene/scene.js';
import { markDirtyOrRebuild, state } from '../state.js';
import { selectAndHighlightGizmo } from './gizmo-highlight.js';
import { syncInspectorUI } from './inspector.js';
import { showToast } from './toast.js';
import { clamp } from '../utils/math.js';

export function renderWaypointListUI() {
    const container = document.getElementById('waypointListContainer');
    if (!container) return;
    container.innerHTML = '';
    const isl = state.islands[state.selectedIslandIdx] || state.islands[0];
    if (!Array.isArray(isl.waypointsNorm)) isl.waypointsNorm = [];
    if (!isl.segmentTypes) isl.segmentTypes = {};

    const getMode = (segKey) => isl.segmentTypes[segKey] || 'trail';

    // 本線の指定位置 (insertIdx) に経由点を挿入し、区間タイプと分岐参照を正しくシフトする
    function insertMainWaypointAt(insertIdx) {
        const pts = [isl.entryNorm, ...isl.waypointsNorm, isl.exitNorm];
        const pA = pts[insertIdx] || { x: -0.2, z: 0.2 };
        const pB = pts[insertIdx + 1] || { x: 0.2, z: -0.2 };
        const midPt = {
            x: Number(((pA.x + pB.x) * 0.5).toFixed(3)),
            z: Number(((pA.z + pB.z) * 0.5).toFixed(3)),
            yOffset: 0.0
        };

        const oldCount = isl.waypointsNorm.length + 1;
        const newSegTypes = {};
        Object.keys(isl.segmentTypes).forEach(k => {
            if (!k.startsWith('seg_')) newSegTypes[k] = isl.segmentTypes[k];
        });
        for (let k = 0; k < oldCount; k++) {
            const m = getMode(`seg_${k}`);
            if (k < insertIdx) {
                newSegTypes[`seg_${k}`] = m;
            } else if (k === insertIdx) {
                newSegTypes[`seg_${k}`] = 'trail';
                newSegTypes[`seg_${k + 1}`] = m;
            } else {
                newSegTypes[`seg_${k + 1}`] = m;
            }
        }
        isl.segmentTypes = newSegTypes;
        isl.waypointsNorm.splice(insertIdx, 0, midPt);

        if (Array.isArray(isl.branches)) {
            isl.branches.forEach(br => {
                ['fromRef', 'toRef'].forEach(prop => {
                    if (typeof br[prop] === 'string' && br[prop].startsWith('wp_')) {
                        const w = parseInt(br[prop].slice(3), 10);
                        if (w >= insertIdx) br[prop] = `wp_${w + 1}`;
                    }
                });
            });
        }
        rebuildScene();
        selectAndHighlightGizmo({ islandIdx: state.selectedIslandIdx, role: 'waypoint', wpIdx: insertIdx }, true);
    }

    // 本線の経由点 (delIdx) を削除し、区間タイプと分岐参照を正しく詰める
    function deleteMainWaypointAt(delIdx) {
        const oldCount = isl.waypointsNorm.length + 1;
        const newSegTypes = {};
        Object.keys(isl.segmentTypes).forEach(k => {
            if (!k.startsWith('seg_')) newSegTypes[k] = isl.segmentTypes[k];
        });
        for (let k = 0; k < oldCount - 1; k++) {
            if (k < delIdx) {
                newSegTypes[`seg_${k}`] = getMode(`seg_${k}`);
            } else if (k === delIdx) {
                newSegTypes[`seg_${k}`] = 'trail';
            } else {
                newSegTypes[`seg_${k}`] = getMode(`seg_${k + 1}`);
            }
        }
        isl.segmentTypes = newSegTypes;
        isl.waypointsNorm.splice(delIdx, 1);

        if (Array.isArray(isl.branches)) {
            isl.branches.forEach(br => {
                ['fromRef', 'toRef'].forEach(prop => {
                    if (typeof br[prop] === 'string' && br[prop].startsWith('wp_')) {
                        const w = parseInt(br[prop].slice(3), 10);
                        if (w === delIdx) br[prop] = prop === 'fromRef' ? 'entry' : 'none';
                        else if (w > delIdx) br[prop] = `wp_${w - 1}`;
                    }
                });
            });
        }
        routeEditState.selectedGizmo = null;
        rebuildScene();
        syncInspectorUI();
    }

    // 任意の2点間の「区間コネクタ行（道 / 橋 / トンネル / 切断 の選択 ＋ 点挿入ボタン）」を生成
    function makeSegmentRow(segKey, labelText, onInsertPoint) {
        const mode = getMode(segKey);
        const borderCls = mode === 'bridge' ? 'border-l-sky-400 bg-[#121e2b]'
            : (mode === 'tunnel' ? 'border-l-orange-400 bg-[#261a14]'
            : (mode === 'none' ? 'border-l-rose-500 bg-[#211519]'
            : 'border-l-amber-400/70 bg-[#14181f]'));
        const txtCls = mode === 'bridge' ? 'text-sky-300'
            : (mode === 'tunnel' ? 'text-orange-300'
            : (mode === 'none' ? 'text-rose-300' : 'text-[#a1a1aa]'));

        const segRow = document.createElement('div');
        segRow.setAttribute('data-gizmo-row', `seg_${segKey}`);
        segRow.className = `flex items-center justify-between px-2 py-0.5 ml-2 text-[10px] rounded border border-transparent border-l-2 gap-1 ${borderCls}`;
        segRow.innerHTML = `
            <span class="${txtCls} truncate">↓ ${labelText}</span>
            <div class="flex items-center gap-1 flex-shrink-0">
                <select class="u-select !w-[78px] !py-0 !px-1 text-[10px]" data-seg-mode="${segKey}">
                    <option value="trail" ${mode === 'trail' ? 'selected' : ''}>道</option>
                    <option value="bridge" ${mode === 'bridge' ? 'selected' : ''}>橋</option>
                    <option value="tunnel" ${mode === 'tunnel' ? 'selected' : ''}>トンネル</option>
                    <option value="none" ${mode === 'none' ? 'selected' : ''}>切断</option>
                </select>
                ${onInsertPoint ? `<button class="u-btn !py-0 !px-1.5 text-[9.5px]" data-ins-pt="1" title="この区間の真ん中に新しい点を挿入">＋点</button>` : ''}
            </div>
        `;
        segRow.addEventListener('click', e => {
            if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
            selectAndHighlightGizmo({ islandIdx: state.selectedIslandIdx, role: 'segment', wpIdx: -1, segKey }, false);
            rebuildScene();
        });
        segRow.querySelector('[data-seg-mode]').addEventListener('change', e => {
            isl.segmentTypes[segKey] = e.target.value;
            rebuildScene();
            selectAndHighlightGizmo({ islandIdx: state.selectedIslandIdx, role: 'segment', wpIdx: -1, segKey }, false);
        });
        const insBtn = segRow.querySelector('[data-ins-pt]');
        if (insBtn && onInsertPoint) {
            insBtn.addEventListener('click', e => {
                e.stopPropagation();
                onInsertPoint();
            });
        }
        return segRow;
    }

    // 1. 入口行
    const enRow = document.createElement('div');
    enRow.setAttribute('data-gizmo-row', 'entry');
    enRow.className = 'flex items-center justify-between bg-[#181c22] px-2 py-1 rounded border border-[#2d3748] gap-1 cursor-pointer';
    const enYOff = isl.entryNorm && isl.entryNorm.yOffset ? isl.entryNorm.yOffset : 0;
    enRow.innerHTML = `
        <span class="text-emerald-400 font-semibold truncate">入口 / 橋受け口 (緑球)</span>
        <div class="flex items-center gap-1 flex-shrink-0">
            <span class="text-[10px] text-[#9ca3af]">高さY:</span>
            <input type="number" step="0.5" min="-18" max="35" value="${enYOff}" class="u-num !w-14 !px-1 !py-0 text-[10px]" data-yoff="entry">
        </div>
    `;
    enRow.addEventListener('click', () => {
        selectAndHighlightGizmo({ islandIdx: state.selectedIslandIdx, role: 'entry', wpIdx: -1 }, false);
        rebuildScene();
    });
    enRow.querySelector('[data-yoff="entry"]').addEventListener('click', e => e.stopPropagation());
    enRow.querySelector('[data-yoff="entry"]').addEventListener('change', e => {
        if (!isl.entryNorm) isl.entryNorm = { x: -0.4, z: 0.4, yOffset: 0 };
        isl.entryNorm.yOffset = clamp(parseFloat(e.target.value) || 0, -18, 35);
        markDirtyOrRebuild();
    });
    container.appendChild(enRow);

    // 2. 本線の各区間と経由点（橋やトンネルの端点も順序どおりに真ん中へ表示）
    const totalLinks = isl.waypointsNorm.length + 1;
    for (let i = 0; i < totalLinks; i++) {
        const segKey = `seg_${i}`;
        const segLabel = i === 0
            ? (isl.waypointsNorm.length > 0 ? '入口 → 点#1' : '入口 → 出口')
            : (i === isl.waypointsNorm.length ? `点#${i} → 出口` : `点#${i} → 点#${i + 1}`);
        container.appendChild(makeSegmentRow(segKey, segLabel, () => insertMainWaypointAt(i)));

        if (i < isl.waypointsNorm.length) {
            const wp = isl.waypointsNorm[i];
            const prevMode = getMode(`seg_${i}`);
            const nextMode = getMode(`seg_${i + 1}`);
            let roleLabel = '黄球';
            let roleTextCls = 'text-amber-300';
            if (nextMode === 'bridge') { roleLabel = '橋始・水色球'; roleTextCls = 'text-sky-300 font-semibold'; }
            else if (prevMode === 'bridge') { roleLabel = '橋終・青球'; roleTextCls = 'text-blue-300 font-semibold'; }
            else if (nextMode === 'tunnel') { roleLabel = '坑口・橙球'; roleTextCls = 'text-orange-300 font-semibold'; }
            else if (prevMode === 'tunnel') { roleLabel = '坑終・赤球'; roleTextCls = 'text-rose-300 font-semibold'; }

            const row = document.createElement('div');
            row.setAttribute('data-gizmo-row', `waypoint_${i}`);
            row.className = 'flex items-center justify-between bg-[#181c22] px-2 py-1 rounded border border-[#2d3748] gap-1 cursor-pointer';
            row.innerHTML = `
                <span class="${roleTextCls} truncate">点 #${i + 1} (${roleLabel})</span>
                <div class="flex items-center gap-1 flex-shrink-0">
                    <span class="text-[9.5px] text-[#9ca3af]">Y:</span>
                    <input type="number" step="0.5" min="-18" max="35" value="${wp.yOffset || 0}" class="u-num !w-14 !px-1 !py-0 text-[10px]" data-wp-y="${i}" title="高さオフセット Y (m)">
                    <button class="u-btn !py-0 !px-1.5 text-[10px] text-rose-300" data-del-wp="${i}" title="削除">×</button>
                </div>
            `;
            row.addEventListener('click', () => {
                selectAndHighlightGizmo({ islandIdx: state.selectedIslandIdx, role: 'waypoint', wpIdx: i }, false);
                rebuildScene();
            });
            row.querySelector(`[data-wp-y="${i}"]`).addEventListener('click', e => e.stopPropagation());
            row.querySelector(`[data-wp-y="${i}"]`).addEventListener('change', e => {
                wp.yOffset = clamp(parseFloat(e.target.value) || 0, -18, 35);
                markDirtyOrRebuild();
            });
            row.querySelector('[data-del-wp]').addEventListener('click', e => {
                e.stopPropagation();
                deleteMainWaypointAt(i);
            });
            container.appendChild(row);
        }
    }

    // 3. 出口行
    const exRow = document.createElement('div');
    exRow.setAttribute('data-gizmo-row', 'exit');
    exRow.className = 'flex items-center justify-between bg-[#181c22] px-2 py-1 rounded border border-[#2d3748] gap-1 cursor-pointer';
    const exYOff = isl.exitNorm && isl.exitNorm.yOffset ? isl.exitNorm.yOffset : 0;
    exRow.innerHTML = `
        <span class="text-purple-400 font-semibold truncate">出口 / 橋出し口 (紫球)</span>
        <div class="flex items-center gap-1 flex-shrink-0">
            <span class="text-[10px] text-[#9ca3af]">高さY:</span>
            <input type="number" step="0.5" min="-18" max="35" value="${exYOff}" class="u-num !w-14 !px-1 !py-0 text-[10px]" data-yoff="exit">
        </div>
    `;
    exRow.addEventListener('click', () => {
        selectAndHighlightGizmo({ islandIdx: state.selectedIslandIdx, role: 'exit', wpIdx: -1 }, false);
        rebuildScene();
    });
    exRow.querySelector('[data-yoff="exit"]').addEventListener('click', e => e.stopPropagation());
    exRow.querySelector('[data-yoff="exit"]').addEventListener('change', e => {
        if (!isl.exitNorm) isl.exitNorm = { x: 0.4, z: -0.4, yOffset: 0 };
        isl.exitNorm.yOffset = clamp(parseFloat(e.target.value) || 0, -18, 35);
        markDirtyOrRebuild();
    });
    container.appendChild(exRow);

    // 4. 分岐道 (`isl.branches`) の一覧（各分岐区間も 道 / 橋 / トンネル / 切断 を個別指定可能）
    if (Array.isArray(isl.branches) && isl.branches.length > 0) {
        const brPathHeader = document.createElement('div');
        brPathHeader.className = 'text-[10px] text-pink-300 font-semibold mt-1.5 pt-1 border-t border-[#2d3748]';
        brPathHeader.textContent = '分岐道（各区間を 道 / 橋 / トンネル に設定可能）:';
        container.appendChild(brPathHeader);

        const buildNodeOptions = (selectedVal, includeNone, selfBrIdx) => {
            let html = '';
            if (includeNone) {
                html += `<option value="none" ${selectedVal === 'none' ? 'selected' : ''}>行き止まり(脇道)</option>`;
            }
            html += `<option value="entry" ${selectedVal === 'entry' ? 'selected' : ''}>入口</option>`;
            for (let w = 0; w < isl.waypointsNorm.length; w++) {
                const key = `wp_${w}`;
                html += `<option value="${key}" ${selectedVal === key ? 'selected' : ''}>点 #${w + 1}</option>`;
            }
            html += `<option value="exit" ${selectedVal === 'exit' ? 'selected' : ''}>出口</option>`;
            for (let ob = 0; ob < isl.branches.length; ob++) {
                if (ob === selfBrIdx) continue;
                const key = `br_${ob}_last`;
                html += `<option value="${key}" ${selectedVal === key ? 'selected' : ''}>分岐#${ob + 1}の終点</option>`;
            }
            if (!includeNone) {
                html += `<option value="custom" ${selectedVal === 'custom' ? 'selected' : ''}>自由起点(球)</option>`;
            }
            return html;
        };

        isl.branches.forEach((br, bIdx) => {
            if (!Array.isArray(br.pointsNorm) || br.pointsNorm.length === 0) {
                br.pointsNorm = [br.endNorm ? { x: br.endNorm.x, z: br.endNorm.z, yOffset: 0 } : { x: 0.2, z: 0.3, yOffset: 0 }];
            }

            function insertBranchPointAt(segIdx) {
                const prevPt = segIdx === 0
                    ? (br.startNorm || { x: 0, z: 0 })
                    : br.pointsNorm[segIdx - 1];
                const nextPt = br.pointsNorm[segIdx];
                const midPt = {
                    x: Number(((prevPt.x + nextPt.x) * 0.5).toFixed(3)),
                    z: Number(((prevPt.z + nextPt.z) * 0.5).toFixed(3)),
                    yOffset: 0.0
                };
                const oldLen = br.pointsNorm.length;
                const newModes = {};
                for (let k = 0; k < oldLen; k++) {
                    const m = getMode(`branch_${bIdx}_${k}`);
                    if (k < segIdx) newModes[k] = m;
                    else if (k === segIdx) { newModes[k] = 'trail'; newModes[k + 1] = m; }
                    else newModes[k + 1] = m;
                }
                Object.keys(newModes).forEach(k => {
                    isl.segmentTypes[`branch_${bIdx}_${k}`] = newModes[k];
                });
                br.pointsNorm.splice(segIdx, 0, midPt);
                rebuildScene();
                selectAndHighlightGizmo({ islandIdx: state.selectedIslandIdx, role: 'branchPoint', wpIdx: `${bIdx}_${segIdx}` }, true);
            }

            function deleteBranchPointAt(ptIdx) {
                const oldLen = br.pointsNorm.length;
                const newModes = {};
                for (let k = 0; k < oldLen - 1; k++) {
                    if (k < ptIdx) newModes[k] = getMode(`branch_${bIdx}_${k}`);
                    else if (k === ptIdx) newModes[k] = 'trail';
                    else newModes[k] = getMode(`branch_${bIdx}_${k + 1}`);
                }
                delete isl.segmentTypes[`branch_${bIdx}_${oldLen - 1}`];
                Object.keys(newModes).forEach(k => {
                    isl.segmentTypes[`branch_${bIdx}_${k}`] = newModes[k];
                });
                br.pointsNorm.splice(ptIdx, 1);
                rebuildScene();
                syncInspectorUI();
            }

            const bBox = document.createElement('div');
            bBox.setAttribute('data-gizmo-row', `branch_${bIdx}`);
            bBox.className = 'flex flex-col bg-[#241623] p-1.5 rounded border border-[#5e2750] gap-1';
            bBox.innerHTML = `
                <div class="flex items-center justify-between gap-1 flex-wrap">
                    <span class="text-pink-300 text-[10px] font-semibold">分岐 #${bIdx + 1} (${br.pointsNorm.length}点)</span>
                    <div class="flex items-center gap-1">
                        <button class="u-btn u-btn-primary !py-0 !px-1.5 text-[10px]" data-ext-br="${bIdx}" title="この分岐道の先に続きのポイントを追加">＋ 続き</button>
                        <button class="u-btn !py-0 !px-1.5 text-[10px] text-rose-300" data-del-br="${bIdx}" title="分岐道を削除">×</button>
                    </div>
                </div>
                <div class="flex items-center justify-between gap-1 text-[10px]">
                    <span class="text-pink-200">元:</span>
                    <select class="u-select !w-24 !py-0 text-[10px]" data-br-from="${bIdx}">
                        ${buildNodeOptions(br.fromRef || 'entry', false, bIdx)}
                    </select>
                    <span class="text-pink-200">先:</span>
                    <select class="u-select !w-28 !py-0 text-[10px]" data-br-to="${bIdx}">
                        ${buildNodeOptions(br.toRef || 'none', true, bIdx)}
                    </select>
                </div>
                <div class="flex flex-col gap-1 pt-0.5 border-t border-[#3d1d36]" data-br-pts="${bIdx}"></div>
            `;

            const ptsContainer = bBox.querySelector(`[data-br-pts="${bIdx}"]`);
            br.pointsNorm.forEach((pt, ptIdx) => {
                const segKey = `branch_${bIdx}_${ptIdx}`;
                const segLabel = ptIdx === 0 ? '元 → 点1' : `点${ptIdx} → 点${ptIdx + 1}`;
                ptsContainer.appendChild(makeSegmentRow(segKey, segLabel, () => insertBranchPointAt(ptIdx)));

                const prevMode = getMode(segKey);
                const nextKey = (ptIdx + 1 < br.pointsNorm.length) ? `branch_${bIdx}_${ptIdx + 1}` : (br.toRef && br.toRef !== 'none' ? `branch_${bIdx}_merge` : null);
                const nextMode = nextKey ? getMode(nextKey) : 'none';
                let brRoleText = 'ピンク球';
                let brRoleCls = 'text-pink-200/90';
                if (nextMode === 'bridge') { brRoleText = '橋始・水色'; brRoleCls = 'text-sky-300 font-semibold'; }
                else if (prevMode === 'bridge') { brRoleText = '橋終・青'; brRoleCls = 'text-blue-300 font-semibold'; }
                else if (nextMode === 'tunnel') { brRoleText = '坑口・橙'; brRoleCls = 'text-orange-300 font-semibold'; }
                else if (prevMode === 'tunnel') { brRoleText = '坑終・赤'; brRoleCls = 'text-rose-300 font-semibold'; }

                const ptRow = document.createElement('div');
                ptRow.setAttribute('data-gizmo-sub', `branchPt_${bIdx}_${ptIdx}`);
                ptRow.className = 'flex items-center justify-between text-[10px] bg-[#1a111a] px-1.5 py-0.5 rounded border border-[#4a2240] gap-1 cursor-pointer';
                ptRow.innerHTML = `
                    <span class="${brRoleCls} truncate">点${ptIdx + 1} (${brRoleText})</span>
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <span class="text-[9.5px] text-[#9ca3af]">Y:</span>
                        <input type="number" step="0.5" min="-18" max="35" value="${pt.yOffset || 0}" class="u-num !w-14 !px-1 !py-0 text-[10px]" data-brpt-y="${ptIdx}">
                        ${br.pointsNorm.length > 1 ? `<button class="u-btn !py-0 !px-1 text-[9.5px] text-rose-300" data-del-brpt="${ptIdx}">×</button>` : ''}
                    </div>
                `;
                ptRow.addEventListener('click', () => {
                    selectAndHighlightGizmo({ islandIdx: state.selectedIslandIdx, role: 'branchPoint', wpIdx: `${bIdx}_${ptIdx}` }, false);
                    rebuildScene();
                });
                ptRow.querySelector(`[data-brpt-y="${ptIdx}"]`).addEventListener('click', e => e.stopPropagation());
                ptRow.querySelector(`[data-brpt-y="${ptIdx}"]`).addEventListener('change', e => {
                    pt.yOffset = clamp(parseFloat(e.target.value) || 0, -18, 35);
                    markDirtyOrRebuild();
                });
                const delPtBtn = ptRow.querySelector('[data-del-brpt]');
                if (delPtBtn) {
                    delPtBtn.addEventListener('click', e => {
                        e.stopPropagation();
                        deleteBranchPointAt(ptIdx);
                    });
                }
                ptsContainer.appendChild(ptRow);
            });

            if (br.toRef && br.toRef !== 'none') {
                const mergeKey = `branch_${bIdx}_merge`;
                ptsContainer.appendChild(makeSegmentRow(mergeKey, `点${br.pointsNorm.length} → 合流先`, null));
            }

            bBox.querySelector(`[data-ext-br="${bIdx}"]`).addEventListener('click', () => {
                const lastPt = br.pointsNorm[br.pointsNorm.length - 1];
                const prevPt = br.pointsNorm.length >= 2
                    ? br.pointsNorm[br.pointsNorm.length - 2]
                    : (br.startNorm || { x: 0, z: 0 });
                let dx = lastPt.x - prevPt.x, dz = lastPt.z - prevPt.z;
                const len = Math.hypot(dx, dz);
                if (len < 0.05) { dx = 0.18; dz = 0.14; }
                else { dx = (dx / len) * 0.22; dz = (dz / len) * 0.22; }
                br.pointsNorm.push({
                    x: Number(clamp(lastPt.x + dx, -0.86, 0.86).toFixed(2)),
                    z: Number(clamp(lastPt.z + dz, -0.86, 0.86).toFixed(2)),
                    yOffset: 0.0
                });
                syncInspectorUI();
                rebuildScene();
                showToast(`分岐 #${bIdx + 1} の続きに新しいポイントを追加しました`);
            });

            bBox.querySelector(`[data-br-from="${bIdx}"]`).addEventListener('change', e => {
                br.fromRef = e.target.value;
                syncInspectorUI();
                markDirtyOrRebuild();
            });
            bBox.querySelector(`[data-br-to="${bIdx}"]`).addEventListener('change', e => {
                br.toRef = e.target.value;
                syncInspectorUI();
                markDirtyOrRebuild();
            });
            bBox.querySelector(`[data-del-br="${bIdx}"]`).addEventListener('click', () => {
                isl.branches.splice(bIdx, 1);
                syncInspectorUI();
                rebuildScene();
            });
            container.appendChild(bBox);
        });
    }
}
