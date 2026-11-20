canvas.addEventListener('pointerdown', e => {
    if (e.button === 1) {
        e.preventDefault();
    }
    if (routeEditState.enabled && e.button === 0) {
        if (tryToggleSegmentOnClick(e)) return;
        if (tryBeginDragRouteHandle(e)) {
            canvas.setPointerCapture(e.pointerId);
            return;
        }
    }
    camState.isDown = true;
    camState.button = e.button;
    camState.lastX = e.clientX;
    camState.lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', e => {
    if (routeEditState.draggingHandle) {
        handleDragRouteHandleMove(e);
        return;
    }
    if (!camState.isDown) return;
    const dx = e.clientX - camState.lastX;
    const dy = e.clientY - camState.lastY;
    camState.lastX = e.clientX;
    camState.lastY = e.clientY;

    if (camState.button === 1 || e.shiftKey) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        const up = new THREE.Vector3().crossVectors(right, forward).normalize();
        const panScale = camState.radius * 0.0016;
        camState.target.addScaledVector(right, -dx * panScale);
        camState.target.addScaledVector(up, dy * panScale);
    } else {
        camState.theta -= dx * 0.007;
        camState.phi = clamp(camState.phi - dy * 0.006, 0.12, Math.PI * 0.47);
    }
    updateCamera();
});

canvas.addEventListener('pointerup', e => {
    if (routeEditState.draggingHandle) {
        const finished = routeEditState.draggingHandle;
        routeEditState.draggingHandle = null;
        selectAndHighlightGizmo({
            islandIdx: finished.islandIdx,
            role: finished.role,
            wpIdx: finished.wpIdx
        }, false);
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        return;
    }
    camState.isDown = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
});

canvas.addEventListener('dblclick', e => {
    if (!routeEditState.enabled) return;
    handleAddWaypointOnDoubleClick(e);
});

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    camState.radius = clamp(camState.radius + e.deltaY * 0.11, 18, 420);
    updateCamera();
}, { passive: false });

canvas.addEventListener('contextmenu', e => e.preventDefault());
