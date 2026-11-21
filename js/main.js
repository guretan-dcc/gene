import { initHistory } from './history.js';
import { restoreLastState, saveCurrentState } from './persist.js';
import { rebuildScene } from './scene/rebuild.js';
import { camera, renderer, scene } from './scene/scene.js';
// カメラ操作（pointer/wheel イベント）を canvas に登録する副作用インポート。
// この import が無いとリスナーが一切登録されず、カメラ操作が効かなくなる。
import './scene/camera-controls.js';
import { setupInspectorEvents, syncInspectorUI } from './ui/inspector.js';
import { setupNumberScrub } from './ui/scrub.js';
import { setupTabs } from './ui/tabs.js';

function onWindowResize() {
    const container = document.getElementById('viewportContainer');
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', onWindowResize);

window.onload = function () {
    restoreLastState();
    window.addEventListener('pagehide', saveCurrentState);
    setupTabs();
    setupNumberScrub();
    setupInspectorEvents();
    syncInspectorUI();
    onWindowResize();
    requestAnimationFrame(() => onWindowResize());
    rebuildScene();
    syncInspectorUI();
    initHistory();

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();
};
