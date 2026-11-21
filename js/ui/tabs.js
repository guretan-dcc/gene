import { routeEditState } from '../scene/scene.js';
import { refreshGizmos } from '../scene/rebuild.js';

const DEFAULT_TAB = 'island';
const STORAGE_KEY = 'gene.activeTab';

export function activateTab(name) {
    const panes = document.querySelectorAll('[data-tab-pane]');
    if (![...panes].some(p => p.dataset.tabPane === name)) name = DEFAULT_TAB;
    document.querySelectorAll('[data-tab]').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === name);
    });
    panes.forEach(p => p.classList.toggle('hidden', p.dataset.tabPane !== name));
    const scroller = document.getElementById('inspectorScroll');
    if (scroller) scroller.scrollTop = 0;
    const prev = routeEditState.activeTab;
    routeEditState.activeTab = name;
    routeEditState.riverDraw = (name === 'terrain');
    if ((prev === 'terrain') !== (name === 'terrain')) refreshGizmos();
    try { localStorage.setItem(STORAGE_KEY, name); } catch (_) { /* 保存できなくても動作に影響なし */ }
}

export function setupTabs() {
    document.querySelectorAll('[data-tab]').forEach(b => {
        b.addEventListener('click', () => activateTab(b.dataset.tab));
    });
    let saved = DEFAULT_TAB;
    try { saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_TAB; } catch (_) { /* noop */ }
    activateTab(saved);
}
