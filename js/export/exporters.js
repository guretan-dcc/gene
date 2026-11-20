import { serializeMeshToUnityYaml } from './unity-yaml.js';
import { ColoredMeshBuilder } from '../mesh/colored-mesh-builder.js';
import { builtArchipelago, state } from '../state.js';
import { showToast } from '../ui/toast.js';
import { clamp } from '../utils/math.js';

// Unity版 `FloatingTerrainPrefabCreator` と同じ構成で書き出す:
//   <ステージ名>
//     ├ Terrain : 地形(氷含む) + MeshCollider
//     ├ Water   : 水面（当たり判定なし）
//     ├ Trees   : 木 + 簡易コライダー(幹の筒+葉冠の角錐)のMeshCollider
//     ├ Grass   : 草（当たり判定なし）
//     └ Bridges : 橋(板・橋脚) + 床だけのMeshCollider
const SHARED_MATERIAL_GUID = '0e85f5f68f616314688fac45cd8b35c3';

function concatMeshes(list) {
    const out = new ColoredMeshBuilder();
    for (const mb of list) {
        for (let i = 0; i < mb.v.length; i++) out.v.push(mb.v[i]);
        for (let i = 0; i < mb.c.length; i++) out.c.push(mb.c[i]);
        for (let i = 0; i < mb.a.length; i++) out.a.push(mb.a[i]);
    }
    return out;
}

export function exportUnityPrefab() {
    if (!builtArchipelago) return;
    const islands = builtArchipelago.builtIslands;
    const parts = {
        terrain: concatMeshes(islands.map(i => i.terrainMb)),
        water: concatMeshes(islands.map(i => i.waterMb)),
        trees: concatMeshes(islands.map(i => i.treesMb)),
        treesCol: concatMeshes(islands.map(i => i.treeColMb)),
        grass: concatMeshes(islands.map(i => i.grassMb)),
        bridges: builtArchipelago.allBridgeMb,
        bridgesCol: builtArchipelago.allBridgeColMb
    };

    const MESH_ID = { terrain: 4300001, water: 4300002, trees: 4300003, treesCol: 4300004, grass: 4300005, bridges: 4300006, bridgesCol: 4300007 };
    // [オブジェクト名, 表示メッシュ, コライダーメッシュ, 影を落とすか, 基準ID]
    const objects = [
        ['Terrain', 'terrain', 'terrain', 1, 1100],
        ['Water', 'water', null, 0, 1200],
        ['Trees', 'trees', 'treesCol', 1, 1300],
        ['Grass', 'grass', null, 0, 1400],
        ['Bridges', 'bridges', 'bridgesCol', 1, 1500]
    ].filter(([, vis]) => parts[vis].v.length > 0);

    const ROOT_GO = 1000, ROOT_TR = 1001;
    const docs = [];
    docs.push(`--- !u!1 &${ROOT_GO}
GameObject:
  m_ObjectHideFlags: 0
  m_Name: ${state.stageName}
  m_Component:
  - component: {fileID: ${ROOT_TR}}
  m_IsActive: 1
--- !u!4 &${ROOT_TR}
Transform:
  m_GameObject: {fileID: ${ROOT_GO}}
  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}
  m_LocalPosition: {x: 0, y: 0, z: 0}
  m_LocalScale: {x: 1, y: 1, z: 1}
  m_Children:
${objects.map(o => `  - {fileID: ${o[4] + 1}}`).join('\n')}
  m_Father: {fileID: 0}`);

    const usedMeshes = new Set();
    for (const [name, vis, col, shadow, base] of objects) {
        const go = base, tr = base + 1, mf = base + 2, mr = base + 3, mc = base + 4;
        const comps = [tr, mf, mr].concat(col && parts[col].v.length > 0 ? [mc] : []);
        docs.push(`--- !u!1 &${go}
GameObject:
  m_ObjectHideFlags: 0
  m_Name: ${name}
  m_Component:
${comps.map(c => `  - component: {fileID: ${c}}`).join('\n')}
  m_IsActive: 1
--- !u!4 &${tr}
Transform:
  m_GameObject: {fileID: ${go}}
  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}
  m_LocalPosition: {x: 0, y: 0, z: 0}
  m_LocalScale: {x: 1, y: 1, z: 1}
  m_Children: []
  m_Father: {fileID: ${ROOT_TR}}
--- !u!33 &${mf}
MeshFilter:
  m_GameObject: {fileID: ${go}}
  m_Mesh: {fileID: ${MESH_ID[vis]}}
--- !u!23 &${mr}
MeshRenderer:
  m_GameObject: {fileID: ${go}}
  m_Enabled: 1
  m_CastShadows: ${shadow}
  m_Materials:
  - {fileID: 2100000, guid: ${SHARED_MATERIAL_GUID}, type: 2}`);
        usedMeshes.add(vis);
        if (col && parts[col].v.length > 0) {
            docs.push(`--- !u!64 &${mc}
MeshCollider:
  m_GameObject: {fileID: ${go}}
  m_Enabled: 1
  m_Mesh: {fileID: ${MESH_ID[col]}}`);
            usedMeshes.add(col);
        }
    }

    const meshNames = {
        terrain: 'TerrainMesh', water: 'WaterMesh', trees: 'TreesMesh', treesCol: 'TreesColliderMesh',
        grass: 'GrassMesh', bridges: 'BridgeMesh', bridgesCol: 'BridgeCollider'
    };
    for (const key of usedMeshes) {
        docs.push(serializeMeshToUnityYaml(MESH_ID[key], `${state.stageName}_${meshNames[key]}`, parts[key]).replace(/\n$/, ''));
    }

    const yaml = `%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n${docs.join('\n')}\n`;
    downloadText(`${state.stageName}.prefab`, yaml);
    showToast(`${state.stageName}.prefab を出力しました`);
}

export function exportSettingsJson() {
    downloadText(`${state.stageName}_Settings.json`, JSON.stringify(state, null, 2));
    showToast("設定JSONを保存しました");
}

export function exportPlyMesh() {
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
