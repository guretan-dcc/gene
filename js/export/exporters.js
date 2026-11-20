function exportUnityPrefab() {
    if (!builtArchipelago) return;
    const combTerrain = new ColoredMeshBuilder();
    const combWater = new ColoredMeshBuilder();
    builtArchipelago.builtIslands.forEach(isl => {
        for (let i = 0; i < isl.terrainMb.v.length; i++) {
            combTerrain.v.push(isl.terrainMb.v[i]);
            combTerrain.c.push(isl.terrainMb.c[i]);
            combTerrain.a.push(isl.terrainMb.a[i]);
        }
        for (let i = 0; i < isl.vegMb.v.length; i++) {
            combTerrain.v.push(isl.vegMb.v[i]);
            combTerrain.c.push(isl.vegMb.c[i]);
            combTerrain.a.push(isl.vegMb.a[i]);
        }
        for (let i = 0; i < isl.waterMb.v.length; i++) {
            combWater.v.push(isl.waterMb.v[i]);
            combWater.c.push(isl.waterMb.c[i]);
            combWater.a.push(isl.waterMb.a[i]);
        }
    });
    for (let i = 0; i < builtArchipelago.allBridgeMb.v.length; i++) {
        combTerrain.v.push(builtArchipelago.allBridgeMb.v[i]);
        combTerrain.c.push(builtArchipelago.allBridgeMb.c[i]);
        combTerrain.a.push(builtArchipelago.allBridgeMb.a[i]);
    }

    const yaml = `%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!1 &100000
GameObject:
  m_ObjectHideFlags: 0
  m_Name: ${state.stageName}
  m_Component:
  - component: {fileID: 100001}
  - component: {fileID: 100002}
  - component: {fileID: 100003}
  - component: {fileID: 100004}
  m_IsActive: 1
--- !u!4 &100001
Transform:
  m_GameObject: {fileID: 100000}
  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}
  m_LocalPosition: {x: 0, y: 0, z: 0}
  m_LocalScale: {x: 1, y: 1, z: 1}
--- !u!33 &100002
MeshFilter:
  m_GameObject: {fileID: 100000}
  m_Mesh: {fileID: 4300001}
--- !u!23 &100003
MeshRenderer:
  m_GameObject: {fileID: 100000}
  m_Materials:
  - {fileID: 2100000, guid: 0e85f5f68f616314688fac45cd8b35c3, type: 2}
--- !u!64 &100004
MeshCollider:
  m_GameObject: {fileID: 100000}
  m_Mesh: {fileID: 4300001}
${serializeMeshToUnityYaml(4300001, state.stageName + "_TerrainMesh", combTerrain)}
`;
    downloadText(`${state.stageName}.prefab`, yaml);
    showToast(`${state.stageName}.prefab を出力しました`);
}

function exportSettingsJson() {
    downloadText(`${state.stageName}_Settings.json`, JSON.stringify(state, null, 2));
    showToast("設定JSONを保存しました");
}

function exportPlyMesh() {
    if (!builtArchipelago) return;
    const comb = new ColoredMeshBuilder();
    builtArchipelago.builtIslands.forEach(isl => {
        for (let i = 0; i < isl.terrainMb.v.length; i++) {
            comb.v.push(isl.terrainMb.v[i]);
            comb.c.push(isl.terrainMb.c[i]);
        }
    });
    const vCount = comb.v.length / 3;
    const tCount = vCount / 3;
    let lines = [
        "ply",
        "format ascii 1.0",
        `element vertex ${vCount}`,
        "property float x",
        "property float y",
        "property float z",
        "property uchar red",
        "property uchar green",
        "property uchar blue",
        `element face ${tCount}`,
        "property list uchar int vertex_indices",
        "end_header"
    ];
    for (let i = 0; i < vCount; i++) {
        const x = comb.v[i * 3].toFixed(3), y = comb.v[i * 3 + 1].toFixed(3), z = comb.v[i * 3 + 2].toFixed(3);
        const r = clamp(Math.round(comb.c[i * 3] * 255), 0, 255);
        const g = clamp(Math.round(comb.c[i * 3 + 1] * 255), 0, 255);
        const b = clamp(Math.round(comb.c[i * 3 + 2] * 255), 0, 255);
        lines.push(`${x} ${y} ${z} ${r} ${g} ${b}`);
    }
    for (let t = 0; t < tCount; t++) {
        const base = t * 3;
        lines.push(`3 ${base} ${base + 1} ${base + 2}`);
    }
    downloadText(`${state.stageName}_VertexColor.ply`, lines.join('\n'));
    showToast("頂点カラー付きPLYメッシュを保存しました");
}

function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
