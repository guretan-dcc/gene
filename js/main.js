import { initHistory } from './history.js';
import { rebuildScene } from './scene/rebuild.js';
import { camera, renderer, scene } from './scene/scene.js';
import { setupInspectorEvents, syncInspectorUI } from './ui/inspector.js';
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
    setupTabs();
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
