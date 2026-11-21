import { buildArchipelagoStage, showFlags } from './archipelago.js';
import { createGizmoGroup } from './gizmos.js';
import { routeEditState, updateCamera, worldGroup } from './scene.js';
import { builtArchipelago, setBuiltArchipelago, state } from '../state.js';

export function rebuildScene() {
    while (worldGroup.children.length > 0) {
        const ch = worldGroup.children.pop();
        if (ch.geometry) ch.geometry.dispose();
    }

    setBuiltArchipelago(buildArchipelagoStage());

    const terrainMat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        wireframe: showFlags.wire
    });
    const waterMat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        wireframe: showFlags.wire
    });

    let totalVerts = 0, totalTris = 0, totalTrees = 0, totalGrass = 0;

    builtArchipelago.builtIslands.forEach((isl, idx) => {
        const visibleIsl = !routeEditState.soloIsland || idx === state.selectedIslandIdx;
        const tGeo = isl.terrainMb.toThreeGeometry();
        const tMesh = new THREE.Mesh(tGeo, terrainMat);
        tMesh.castShadow = true;
        tMesh.receiveShadow = true;
        tMesh.visible = visibleIsl;
        tMesh.userData = { islandIdx: idx };
        worldGroup.add(tMesh);
        isl.terrainMeshObj = tMesh;

        totalVerts += isl.terrainMb.v.length / 3;
        totalTris += isl.terrainMb.v.length / 9;

        if (isl.waterMb.v.length > 0) {
            const wGeo = isl.waterMb.toThreeGeometry();
            const wMesh = new THREE.Mesh(wGeo, waterMat);
            wMesh.visible = showFlags.water && visibleIsl;
            wMesh.userData = { tag: 'water', islandIdx: idx };
            worldGroup.add(wMesh);
            totalVerts += isl.waterMb.v.length / 3;
            totalTris += isl.waterMb.v.length / 9;
        }

        if (isl.vegMb.v.length > 0) {
            const vGeo = isl.vegMb.toThreeGeometry();
            const vMesh = new THREE.Mesh(vGeo, terrainMat);
            vMesh.castShadow = true;
            vMesh.receiveShadow = true;
            vMesh.visible = showFlags.veg && visibleIsl;
            vMesh.userData = { tag: 'veg', islandIdx: idx };
            worldGroup.add(vMesh);
            totalVerts += isl.vegMb.v.length / 3;
            totalTris += isl.vegMb.v.length / 9;
        }

        totalTrees += isl.treeCount;
        totalGrass += isl.grassClumpCount;
    });

    if (builtArchipelago.allBridgeMb.v.length > 0) {
        const bGeo = builtArchipelago.allBridgeMb.toThreeGeometry();
        const bMesh = new THREE.Mesh(bGeo, terrainMat);
        bMesh.castShadow = true;
        bMesh.receiveShadow = true;
        worldGroup.add(bMesh);
        totalVerts += builtArchipelago.allBridgeMb.v.length / 3;
        totalTris += builtArchipelago.allBridgeMb.v.length / 9;
    }

    const gizmo = createGizmoGroup(builtArchipelago);
    gizmo.visible = routeEditState.enabled;
    gizmo.userData = { tag: 'route' };
    worldGroup.add(gizmo);

    // Status Bar 更新
    const selIsl = builtArchipelago.builtIslands[state.selectedIslandIdx] || builtArchipelago.builtIslands[0];
    document.getElementById('hudIslandCount').textContent = `${builtArchipelago.builtIslands.length}島/${builtArchipelago.builtBridges.length}橋`;
    document.getElementById('hudVerts').textContent = totalVerts.toLocaleString();
    document.getElementById('hudTris').textContent = totalTris.toLocaleString();
    document.getElementById('hudVegInfo').textContent = `${totalTrees}本/${totalGrass}株`;
    document.getElementById('lblMeshActual').textContent = `${selIsl.resolution}分割`;

    updateCamera();
}
