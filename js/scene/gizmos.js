import { routeEditState, routeHandleMeshes, segmentToggleMeshes } from './scene.js';
import { state } from '../state.js';

export function createGizmoGroup(arch) {
    const g = new THREE.Group();
    routeHandleMeshes.length = 0;
    segmentToggleMeshes.length = 0;

    const sp = arch.spawnPos;
    const spawnMat = new THREE.LineBasicMaterial({ color: 0x26e6ff, transparent: true, opacity: 0.5 });

    function makeDisc(cx, cy, cz, r, mat) {
        const pts = [];
        for (let i = 0; i <= 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r));
        }
        return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
    }
    if (!routeEditState.soloIsland || state.selectedIslandIdx === 0) {
        g.add(makeDisc(sp.x, sp.y + 0.05, sp.z, 0.55, spawnMat));
        g.add(makeDisc(sp.x, sp.y + 1.75, sp.z, 0.55, spawnMat));
    }

    const gp = arch.goalPos;
    if (!routeEditState.soloIsland || state.selectedIslandIdx === arch.builtIslands.length - 1) {
        const goalBeacon = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.95, 0),
            new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.42, depthWrite: false })
        );
        goalBeacon.position.set(gp.x, gp.y + 2.4, gp.z);
        g.add(goalBeacon);
    }

    // 各島のドラッグ可能なルート＆橋アンカー球と、区間ごとの切断/接続ダイヤモンドマーカー
    arch.builtIslands.forEach((isl, islIdx) => {
        if (routeEditState.soloIsland && islIdx !== state.selectedIslandIdx) return;

        function addHandleSphere(worldPos, colorHex, role, wpIdx = -1, radius = 1.15, groundY = null) {
            const isSelectedIsl = (islIdx === state.selectedIslandIdx);
            const sel = routeEditState.selectedGizmo;
            const isSelectedHandle = Boolean(
                sel && sel.islandIdx === islIdx && sel.role === role && String(sel.wpIdx) === String(wpIdx)
            );
            const rFinal = (isSelectedIsl ? radius * 1.18 : radius * 0.9) * (isSelectedHandle ? 1.2 : 1.0);
            const sphereGeo = new THREE.SphereGeometry(rFinal, 16, 14);
            const sphereMat = new THREE.MeshBasicMaterial({
                color: isSelectedHandle ? 0xffffff : colorHex,
                transparent: true,
                opacity: isSelectedHandle ? 0.62 : (isSelectedIsl ? 0.44 : 0.26),
                depthWrite: false
            });
            const handle = new THREE.Mesh(sphereGeo, sphereMat);
            handle.position.set(worldPos.x, worldPos.y + 1.15, worldPos.z);
            handle.userData = { isRouteHandle: true, islandIdx: islIdx, role, wpIdx };
            g.add(handle);
            routeHandleMeshes.push(handle);

            const basePinY = Number.isFinite(groundY) ? Math.min(groundY, worldPos.y) : worldPos.y;
            const pinPts = [
                new THREE.Vector3(worldPos.x, basePinY, worldPos.z),
                new THREE.Vector3(worldPos.x, worldPos.y + 1.15, worldPos.z)
            ];
            g.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(pinPts),
                new THREE.LineBasicMaterial({
                    color: isSelectedHandle ? 0xffffff : colorHex,
                    transparent: true,
                    opacity: isSelectedHandle ? 0.65 : 0.42
                })
            ));
        }

        addHandleSphere(isl.entryShorePos, 0x22c55e, 'entry', -1, 1.25, isl.entryGroundY);

        function roleToColor(role, fallbackHex) {
            if (role === 'bridgeStart') return 0x38bdf8;
            if (role === 'bridgeEnd') return 0x3b82f6;
            if (role === 'tunnelStart') return 0xf97316;
            if (role === 'tunnelEnd') return 0xef4444;
            return fallbackHex;
        }

        isl.waypointWorldPositions.forEach((wpPos, wIdx) => {
            const roleTag = (isl.waypointRoles && isl.waypointRoles[wIdx]) || 'waypoint';
            const col = roleToColor(roleTag, 0xfacc15);
            const rad = (roleTag !== 'waypoint') ? 1.18 : 1.05;
            const gY = isl.waypointGroundYs ? isl.waypointGroundYs[wIdx] : null;
            addHandleSphere(wpPos, col, 'waypoint', wIdx, rad, gY);
        });
        addHandleSphere(isl.exitShorePos, 0xa855f7, 'exit', -1, 1.25, isl.exitGroundY);

        // 分岐道 (`resolvedBranches`) の各経由点・終点・自由起点ハンドル
        if (isl.resolvedBranches) {
            isl.resolvedBranches.forEach((br, bIdx) => {
                if (br.hasCustomStart) {
                    addHandleSphere(br.startWorld, 0xf472b6, 'branchStart', br.bIdx, 0.98, br.startGroundY);
                }
                br.pointWorlds.forEach((ptW, ptIdx) => {
                    const isLast = (ptIdx === br.pointWorlds.length - 1);
                    const brRole = (isl.branchPointRoles && isl.branchPointRoles[bIdx]) ? isl.branchPointRoles[bIdx][ptIdx] : 'branch';
                    const col = roleToColor(brRole, isLast ? 0xec4899 : 0xf472b6);
                    const gY = br.pointGroundYs ? br.pointGroundYs[ptIdx] : null;
                    addHandleSphere(ptW, col, 'branchPoint', `${br.bIdx}_${ptIdx}`, isLast ? 1.12 : 0.98, gY);
                });
            });
        }

        // 手動河川: 経路ポリラインと点ハンドル (水源=明るい水色 / 河口=濃い青)
        if (isl.riverPointWorlds) {
            isl.riverPointWorlds.forEach((pts, rIdx) => {
                if (pts.length >= 2) {
                    g.add(new THREE.Line(
                        new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, p.y + 1.0, p.z))),
                        new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8 })
                    ));
                }
                pts.forEach((p, pIdx) => {
                    const col = pIdx === 0 ? 0x67e8f9 : (pIdx === pts.length - 1 ? 0x2563eb : 0x06b6d4);
                    addHandleSphere({ x: p.x, y: p.y, z: p.z }, col, 'riverPoint', `${rIdx}_${pIdx}`, 1.0, p.groundY);
                });
            });
        }

        // 区間（セグメント）単位のラインと、クリックで区間選択・種別切替できるダイヤモンドマーカー
        if (isl.segmentVisuals) {
            isl.segmentVisuals.forEach(sv => {
                const sel = routeEditState.selectedGizmo;
                const isSelSeg = Boolean(sel && sel.islandIdx === islIdx && sel.role === 'segment' && sel.segKey === sv.segKey);

                if (sv.mode === 'trail' && sv.pathPts.length >= 2) {
                    const pts = sv.pathPts.map(p => new THREE.Vector3(p.x, p.y + 0.35, p.z));
                    g.add(new THREE.Line(
                        new THREE.BufferGeometry().setFromPoints(pts),
                        new THREE.LineBasicMaterial({
                            color: sv.isBranch ? 0xf472b6 : 0xfacc15,
                            transparent: true,
                            opacity: 0.55
                        })
                    ));
                } else if (sv.mode === 'bridge' || sv.mode === 'tunnel') {
                    const pts = (sv.mode === 'tunnel' && sv.pathPts && sv.pathPts.length >= 2)
                        ? sv.pathPts.map(p => new THREE.Vector3(p.x, p.y, p.z))
                        : [
                            new THREE.Vector3(sv.fromPos.x, sv.fromPos.y + 0.5, sv.fromPos.z),
                            new THREE.Vector3(sv.toPos.x, sv.toPos.y + 0.5, sv.toPos.z)
                        ];
                    g.add(new THREE.Line(
                        new THREE.BufferGeometry().setFromPoints(pts),
                        new THREE.LineBasicMaterial({
                            color: sv.mode === 'bridge' ? 0x38bdf8 : 0xf97316,
                            transparent: true,
                            opacity: 0.52
                        })
                    ));
                } else {
                    const pts = [
                        new THREE.Vector3(sv.fromPos.x, sv.fromPos.y + 0.6, sv.fromPos.z),
                        new THREE.Vector3(sv.toPos.x, sv.toPos.y + 0.6, sv.toPos.z)
                    ];
                    g.add(new THREE.Line(
                        new THREE.BufferGeometry().setFromPoints(pts),
                        new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.28 })
                    ));
                }

                // 中点の「◆区間種別マーカー」
                const diaColor = isSelSeg ? 0xffffff
                    : (sv.mode === 'bridge' ? 0x3b82f6
                    : (sv.mode === 'tunnel' ? 0xf97316
                    : (sv.mode === 'none' ? 0xef4444 : 0x38bdf8)));
                const diaGeo = new THREE.OctahedronGeometry(isSelSeg ? 0.96 : 0.78, 0);
                const diaMat = new THREE.MeshBasicMaterial({
                    color: diaColor,
                    transparent: true,
                    opacity: isSelSeg ? 0.62 : (sv.mode === 'none' ? 0.28 : 0.44),
                    depthWrite: false
                });
                const diaMesh = new THREE.Mesh(diaGeo, diaMat);
                diaMesh.position.set(sv.midPos.x, sv.midPos.y + 1.45, sv.midPos.z);
                diaMesh.userData = { isSegmentToggle: true, islandIdx: islIdx, segKey: sv.segKey };
                g.add(diaMesh);
                segmentToggleMeshes.push(diaMesh);
            });
        }
    });

    return g;
}
