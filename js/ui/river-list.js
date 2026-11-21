import { routeEditState } from '../scene/scene.js';
import { markDirtyOrRebuild, state } from '../state.js';
import { clamp } from '../utils/math.js';
import { selectAndHighlightGizmo } from './gizmo-highlight.js';

// 島ごとの手動河川 (islCfg.manualRivers = [{ points:[{x,z}, ...] }, ...]) の一覧UI。
// x,z は島の半サイズで正規化した値 (-1..1)。点は 水源 → 河口 の順。
export function ensureManualRivers(isl) {
    if (!Array.isArray(isl.manualRivers)) isl.manualRivers = [];
    return isl.manualRivers;
}

export function renderRiverListUI(syncAll) {
    const container = document.getElementById('riverListContainer');
    if (!container) return;
    container.innerHTML = '';
    const isl = state.islands[state.selectedIslandIdx] || state.islands[0];
    const rivers = ensureManualRivers(isl);
    const sel = routeEditState.selectedGizmo;

    const mkBtn = (label, cls, onClick) => {
        const b = document.createElement('button');
        b.className = 'u-btn text-[10.5px] py-0 px-1.5 ' + cls;
        b.textContent = label;
        b.addEventListener('click', onClick);
        return b;
    };
    const changed = () => { markDirtyOrRebuild(true); syncAll(); };

    rivers.forEach((r, ri) => {
        if (!Array.isArray(r.points)) r.points = [];
        const box = document.createElement('div');
        const active = routeEditState.activeRiver === ri;
        box.className = 'rounded border px-1.5 py-1 flex flex-col gap-1 ' + (active ? 'border-cyan-400 bg-[#0f1d22]' : 'border-[#3f3f46] bg-[#14181f]');

        const head = document.createElement('div');
        head.className = 'flex items-center gap-1';
        const title = document.createElement('span');
        title.className = 'flex-1 text-cyan-300 cursor-pointer';
        title.textContent = `川 #${ri + 1}（${r.points.length}点）${active ? ' ◀作図中' : ''}`;
        title.addEventListener('click', () => { routeEditState.activeRiver = ri; syncAll(); });
        head.appendChild(title);
        head.appendChild(mkBtn('点追加', '', () => {
            const last = r.points[r.points.length - 1] || { x: 0, z: 0 };
            r.points.push({ x: clamp(last.x + 0.15, -0.9, 0.9), z: clamp(last.z + 0.1, -0.9, 0.9) });
            routeEditState.activeRiver = ri;
            changed();
        }));
        head.appendChild(mkBtn('削除', '!text-rose-300', () => {
            rivers.splice(ri, 1);
            routeEditState.activeRiver = Math.max(0, rivers.length - 1);
            routeEditState.selectedGizmo = null;
            changed();
        }));
        box.appendChild(head);

        r.points.forEach((p, pi) => {
            const row = document.createElement('div');
            row.className = 'flex items-center gap-1';
            const isSel = sel && sel.role === 'riverPoint' && String(sel.wpIdx) === `${ri}_${pi}`;
            row.setAttribute('data-gizmo-row', `riverPoint_${ri}_${pi}`);
            if (isSel) row.classList.add('u-gizmo-highlight');
            const lab = document.createElement('span');
            lab.className = 'w-14 text-[#a1a1aa] cursor-pointer';
            lab.textContent = pi === 0 ? '水源' : (pi === r.points.length - 1 ? '河口' : `経由${pi}`);
            lab.addEventListener('click', () => selectAndHighlightGizmo({ islandIdx: state.selectedIslandIdx, role: 'riverPoint', wpIdx: `${ri}_${pi}` }, false));
            row.appendChild(lab);
            ['x', 'z'].forEach(axis => {
                const inp = document.createElement('input');
                inp.type = 'number'; inp.step = '0.02'; inp.min = '-0.96'; inp.max = '0.96';
                inp.className = 'u-num w-16';
                inp.value = Number(p[axis]).toFixed(2);
                inp.addEventListener('change', () => {
                    p[axis] = clamp(parseFloat(inp.value) || 0, -0.96, 0.96);
                    changed();
                });
                row.appendChild(inp);
            });
            row.appendChild(mkBtn('×', '!text-rose-300', () => {
                r.points.splice(pi, 1);
                routeEditState.selectedGizmo = null;
                changed();
            }));
            box.appendChild(row);
        });
        container.appendChild(box);
    });
    if (rivers.length === 0) {
        const e = document.createElement('div');
        e.className = 'text-[#71717a]';
        e.textContent = '手動の川はまだありません';
        container.appendChild(e);
    }
}

export function addManualRiver(isl) {
    const rivers = ensureManualRivers(isl);
    const off = (rivers.length % 3) * 0.25 - 0.25;
    rivers.push({ points: [{ x: -0.5, z: off }, { x: 0.0, z: off + 0.1 }, { x: 0.9, z: off }] });
    routeEditState.activeRiver = rivers.length - 1;
}
