import { rebuildScene } from '../scene/rebuild.js';
import { markDirtyOrRebuild, state } from '../state.js';
import { syncInspectorUI } from './inspector.js';
import { clamp } from '../utils/math.js';

export function renderIslandListUI() {
    const container = document.getElementById('islandListContainer');
    if (!container) return;
    container.innerHTML = '';
    state.islands.forEach((isl, idx) => {
        const div = document.createElement('div');
        div.className = `island-pill ${idx === state.selectedIslandIdx ? 'active' : ''}`;
        div.innerHTML = `
            <span class="truncate pr-2">${isl.label}</span>
            <div class="flex items-center gap-1 flex-shrink-0">
                <span class="text-[10px] font-mono opacity-75">${isl.width}m / Y:</span>
                <input type="number" step="1" min="-40" max="85" value="${isl.posY}" class="u-num !w-12 !py-0 text-[10px]" title="島の高さ（標高 Y m）">
            </div>
        `;
        const yInput = div.querySelector('input');
        yInput.addEventListener('click', e => e.stopPropagation());
        yInput.addEventListener('change', e => {
            e.stopPropagation();
            isl.posY = clamp(parseFloat(e.target.value) || 0, -40, 85);
            if (state.selectedIslandIdx === idx) syncInspectorUI();
            markDirtyOrRebuild();
        });
        div.addEventListener('click', () => {
            state.selectedIslandIdx = idx;
            syncInspectorUI();
            rebuildScene();
        });
        container.appendChild(div);
    });
}
