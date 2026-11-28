import { serializeMeshToUnityYaml } from './unity-yaml.js';
import { stableGuid } from '../../../shared/guid.js';
import { makeUnityPackage } from '../../../shared/unitypackage.js';
import { ColoredMeshBuilder, fixInwardFacing } from '../mesh/colored-mesh-builder.js';
import { builtArchipelago, state } from '../state.js';
import { showToast } from '../ui/toast.js';
import { clamp } from '../utils/math.js';

// Unity版 `FloatingTerrainPrefabCreator` と同じ構成で書き出す:
//   <ステージ名>
//     ├ Terrain : 地形(氷含む) + MeshCollider
//     ├ Water   : 水面・滝（LowPolyWater.mat・当たり判定なし）
//     ├ WaterVolume : 湖・川の水を囲む閉じた立体（LowPolyWaterVolume.mat・水中に入ったときの色付け用・当たり判定なし）
//     ├ Trees   : 木 + 簡易コライダー(幹の筒+葉冠の角錐)のMeshCollider
//     ├ Grass   : 草（当たり判定なし）
//     └ Bridges : 橋(板・橋脚) + 床だけのMeshCollider
// 出力は .unitypackage（Unityの Assets > Import Package > Custom Package で取り込む）:
//   Assets/MyAssets/GameObjects/Stages/<ステージ名>/<ステージ名>.prefab         … 構成だけを持つPrefab
//   Assets/MyAssets/GameObjects/Stages/<ステージ名>/Meshes/<ステージ名>_*Mesh.asset … メッシュは1つずつ別の .asset
// GUID はステージ名から決まる固定値なので、同じステージ名で出し直して上書きすれば、Unity側の参照
// (シーンに置いたPrefabなど)を保ったまま中身だけ更新される。
// マテリアルのGUID（unity/ フォルダ内のアセットと対応）
//   LowPolyVertexColor.mat : お使いのプロジェクトの共有マテリアル（不透明・頂点カラー）
//   LowPolyWater.mat       : 水用の半透明マテリアル（unity/LowPolyWater.unitypackage で取り込み）
const SHARED_MATERIAL_GUID = '4b6c0ee4556d04f4ba685ab776a31dad';
const WATER_MATERIAL_GUID = '3c4247bb74ca45c8ac318105ca24571c';
//   LowPolyWaterVolume.mat : 水中の色付け用（水の体積メッシュ WaterVolume に付ける。ステンシルで水の中だけ塗る）
const WATER_VOLUME_MATERIAL_GUID = '08980ca0595a45338cda755a1104b331';

// ファイル名に使えない文字を除く(ステージ名はそのままフォルダ名・ファイル名になる)
function safeName(name) {
    return String(name || 'Stage').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Stage';
}

function concatMeshes(list) {
    const out = new ColoredMeshBuilder();
    for (const mb of list) {
        for (let i = 0; i < mb.v.length; i++) out.v.push(mb.v[i]);
        for (let i = 0; i < mb.c.length; i++) out.c.push(mb.c[i]);
        for (let i = 0; i < mb.a.length; i++) out.a.push(mb.a[i]);
    }
    return out;
}

export async function exportUnityPrefab() {
    if (!builtArchipelago) return;
    const islands = builtArchipelago.builtIslands;
    // 凹凸で折れ返った（裏向きになった）崖の三角形を直す。島ごとに独立した立体として判定する
    const terrainFixed = islands.map(i => fixInwardFacing(i.terrainMb));
    const parts = {
        terrain: concatMeshes(terrainFixed),
        water: concatMeshes(islands.map(i => i.waterMb)),
        waterVol: concatMeshes(islands.map(i => i.waterVolMb)),
        trees: concatMeshes(islands.map(i => i.treesMb)),
        treesCol: concatMeshes(islands.map(i => i.treeColMb)),
        grass: concatMeshes(islands.map(i => i.grassMb)),
        bridges: builtArchipelago.allBridgeMb,
        bridgesCol: builtArchipelago.allBridgeColMb
    };

    const stage = safeName(state.stageName);
    // メッシュは .asset ごとに1つ。単独の .asset のメインオブジェクトのfileIDは 4300000
    const MESH_FILE_ID = 4300000;
    const meshGuid = (key) => stableGuid(`${stage}|mesh|${key}`);
    const meshRef = (key) => `{fileID: ${MESH_FILE_ID}, guid: ${meshGuid(key)}, type: 2}`;
    // [オブジェクト名, 表示メッシュ, コライダーメッシュ, 影を落とすか, 基準ID]
    const objects = [
        ['Terrain', 'terrain', 'terrain', 1, 1100],
        ['Water', 'water', null, 0, 1200],
        ['WaterVolume', 'waterVol', null, 0, 1600],
        ['Trees', 'trees', 'treesCol', 1, 1300],
        ['Grass', 'grass', null, 0, 1400],
        ['Bridges', 'bridges', 'bridgesCol', 1, 1500]
    ].filter(([, vis]) => parts[vis].v.length > 0);

    const ROOT_GO = 1000, ROOT_TR = 1001;
    // StaticEditorFlags: ContributeGI=1, OccluderStatic=2, BatchingStatic=4, OccludeeStatic=16
    // Unityエディターの FloatingTerrainPrefabCreator と同じ設定にする（橋は isStatic=true 相当で全フラグ）
    const STATIC_FLAGS = { Terrain: 23, Water: 20, WaterVolume: 0, Trees: 21, Grass: 20, Bridges: 4294967295 };
    const ROOT_STATIC = 23;
    const COMMON = `  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}`;
    const gameObject = (id, name, comps, flags) => `--- !u!1 &${id}
GameObject:
${COMMON}
  serializedVersion: 6
  m_Component:
${comps.map(c => `  - component: {fileID: ${c}}`).join('\n')}
  m_Layer: 0
  m_Name: ${name}
  m_TagString: Untagged
  m_Icon: {fileID: 0}
  m_NavMeshLayer: 0
  m_StaticEditorFlags: ${flags}
  m_IsActive: 1`;
    const transform = (id, go, father, children, order) => `--- !u!4 &${id}
Transform:
${COMMON}
  m_GameObject: {fileID: ${go}}
  serializedVersion: 2
  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}
  m_LocalPosition: {x: 0, y: 0, z: 0}
  m_LocalScale: {x: 1, y: 1, z: 1}
  m_ConstrainProportionsScale: 0
  m_Children:${children.length ? '\n' + children.map(c => `  - {fileID: ${c}}`).join('\n') : ' []'}
  m_Father: {fileID: ${father}}
  m_LocalEulerAnglesHint: {x: 0, y: 0, z: 0}`;

    const docs = [];
    docs.push(gameObject(ROOT_GO, stage, [ROOT_TR], ROOT_STATIC));
    docs.push(transform(ROOT_TR, ROOT_GO, 0, objects.map(o => o[4] + 1), 0));

    const usedMeshes = new Set();
    objects.forEach(([name, vis, col, shadow, base], order) => {
        const go = base, tr = base + 1, mf = base + 2, mr = base + 3, mc = base + 4;
        const hasCol = col && parts[col].v.length > 0;
        const comps = [tr, mf, mr].concat(hasCol ? [mc] : []);
        docs.push(gameObject(go, name, comps, STATIC_FLAGS[name]));
        docs.push(transform(tr, go, ROOT_TR, [], order));
        docs.push(`--- !u!33 &${mf}
MeshFilter:
${COMMON}
  m_GameObject: {fileID: ${go}}
  m_Mesh: ${meshRef(vis)}`);
        docs.push(`--- !u!23 &${mr}
MeshRenderer:
${COMMON}
  m_GameObject: {fileID: ${go}}
  m_Enabled: 1
  m_CastShadows: ${shadow}
  m_ReceiveShadows: 1
  m_DynamicOccludee: 1
  m_StaticShadowCaster: 0
  m_MotionVectors: 1
  m_LightProbeUsage: 1
  m_ReflectionProbeUsage: 1
  m_RayTracingMode: 2
  m_RenderingLayerMask: 1
  m_RendererPriority: 0
  m_Materials:
  - {fileID: 2100000, guid: ${name === 'Water' ? WATER_MATERIAL_GUID : name === 'WaterVolume' ? WATER_VOLUME_MATERIAL_GUID : SHARED_MATERIAL_GUID}, type: 2}
  m_StaticBatchInfo:
    firstSubMesh: 0
    subMeshCount: 0
  m_StaticBatchRoot: {fileID: 0}
  m_ProbeAnchor: {fileID: 0}
  m_LightProbeVolumeOverride: {fileID: 0}
  m_ScaleInLightmap: 1
  m_ReceiveGI: 1
  m_PreserveUVs: 0
  m_IgnoreNormalsForChartDetection: 0
  m_ImportantGI: 0
  m_StitchLightmapSeams: 1
  m_SelectedEditorRenderState: 3
  m_MinimumChartSize: 4
  m_AutoUVMaxDistance: 0.5
  m_AutoUVMaxAngle: 89
  m_LightmapParameters: {fileID: 0}
  m_SortingLayerID: 0
  m_SortingLayer: 0
  m_SortingOrder: 0`);
        usedMeshes.add(vis);
        if (hasCol) {
            docs.push(`--- !u!64 &${mc}
MeshCollider:
${COMMON}
  m_GameObject: {fileID: ${go}}
  m_Material: {fileID: 0}
  m_IsTrigger: 0
  m_Enabled: 1
  serializedVersion: 4
  m_Convex: 0
  m_CookingOptions: 30
  m_Mesh: ${meshRef(col)}`);
            usedMeshes.add(col);
        }
    });

    const meshNames = {
        terrain: 'TerrainMesh', water: 'WaterMesh', waterVol: 'WaterVolumeMesh', trees: 'TreesMesh', treesCol: 'TreesColliderMesh',
        grass: 'GrassMesh', bridges: 'BridgeMesh', bridgesCol: 'BridgeCollider'
    };
    const header = '%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n';
    const dir = `Assets/MyAssets/GameObjects/Stages/${stage}`;
    const assets = [];
    for (const key of usedMeshes) {
        const fileName = `${stage}_${meshNames[key]}.asset`;
        const body = serializeMeshToUnityYaml(MESH_FILE_ID, `${stage}_${meshNames[key]}`, parts[key], key === 'water').replace(/\n$/, '');
        assets.push({
            guid: meshGuid(key),
            pathname: `${dir}/Meshes/${fileName}`,
            text: `${header}${body}\n`,
            meta: `fileFormatVersion: 2\nguid: ${meshGuid(key)}\nNativeFormatImporter:\n  externalObjects: {}\n  mainObjectFileID: ${MESH_FILE_ID}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`
        });
    }
    const prefabGuid = stableGuid(`${stage}|prefab`);
    assets.push({
        guid: prefabGuid,
        pathname: `${dir}/${stage}.prefab`,
        text: `${header}${docs.join('\n')}\n`,
        meta: `fileFormatVersion: 2\nguid: ${prefabGuid}\nPrefabImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`
    });

    const bytes = await makeUnityPackage(assets);
    downloadBlob(`${stage}.unitypackage`, new Blob([bytes], { type: 'application/gzip' }));
    showToast(`${stage}.unitypackage を出力しました（Unityで取り込んでください）`);
}

export function exportSettingsJson() {
    downloadText(`${state.stageName}_Settings.json`, JSON.stringify(state, null, 2));
    showToast("生成設定を書き出しました");
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

function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
