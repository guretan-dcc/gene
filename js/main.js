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
    setupInspectorEvents();
    syncInspectorUI();
    onWindowResize();
    requestAnimationFrame(() => onWindowResize());
    rebuildScene();
    syncInspectorUI();

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();
};
