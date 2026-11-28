// 全ジェネレーター共通: Unity の YAML アセット（メッシュと Prefab の部品）
export const HEADER = '%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n';
export const MESH_FILE_ID = 4300000; // 単独の .asset のメッシュの fileID
const VERTEX_STRIDE = 28;            // 位置12 + 法線12 + 色4 byte

// StaticEditorFlags: ContributeGI=1, OccluderStatic=2, BatchingStatic=4, OccludeeStatic=16
export const STATIC_FLAGS = 23;

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
}

// geos: 頂点カラー付き BufferGeometry の配列を1つのメッシュにまとめる（渡したジオメトリは破棄する）
// 座標と頂点の順序は変換せずそのまま書く
export function createMeshAsset(name, geos) {
  const vertexCount = geos.reduce((sum, g) => sum + g.attributes.position.count, 0);
  const indexCount = geos.reduce((sum, g) => sum + g.index.count, 0);
  const vertices = new DataView(new ArrayBuffer(vertexCount * VERTEX_STRIDE));
  const indices = new DataView(new ArrayBuffer(indexCount * 4));
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let vertex = 0;
  let index = 0;

  for (const g of geos) {
    const { position, normal, color } = g.attributes;
    for (let i = 0; i < g.index.count; i++, index++) {
      indices.setUint32(index * 4, g.index.getX(i) + vertex, true);
    }
    for (let i = 0; i < position.count; i++, vertex++) {
      const offset = vertex * VERTEX_STRIDE;
      const p = [position.getX(i), position.getY(i), position.getZ(i)];
      [...p, normal.getX(i), normal.getY(i), normal.getZ(i)]
        .forEach((v, k) => vertices.setFloat32(offset + k * 4, v, true));
      [color.getX(i), color.getY(i), color.getZ(i), 1]
        .forEach((v, k) => vertices.setUint8(offset + 24 + k, Math.round(Math.min(1, Math.max(0, v)) * 255)));
      p.forEach((v, k) => {
        min[k] = Math.min(min[k], v);
        max[k] = Math.max(max[k], v);
      });
    }
    g.dispose();
  }

  const vector = values => `{x: ${values[0].toFixed(3)}, y: ${values[1].toFixed(3)}, z: ${values[2].toFixed(3)}}`;
  const center = vector(min.map((v, k) => (v + max[k]) / 2));
  const extent = vector(min.map((v, k) => (max[k] - v) / 2));
  // 位置(0)・法線(1)・色(3) 以外のチャンネルは未使用
  const used = { 0: [0, 0, 3], 1: [12, 0, 3], 3: [24, 2, 4] };
  const channels = Array.from({ length: 14 }, (_, i) => {
    const [offset, format, dimension] = used[i] || [0, 0, 0];
    return `    - stream: 0\n      offset: ${offset}\n      format: ${format}\n      dimension: ${dimension}`;
  }).join('\n');

  return `${HEADER}--- !u!43 &${MESH_FILE_ID}
Mesh:
  m_ObjectHideFlags: 0
  m_Name: ${name}
  serializedVersion: 10
  m_SubMeshes:
  - serializedVersion: 2
    firstByte: 0
    indexCount: ${indexCount}
    topology: 0
    baseVertex: 0
    firstVertex: 0
    vertexCount: ${vertexCount}
    localAABB:
      m_Center: ${center}
      m_Extent: ${extent}
  m_IndexFormat: 1
  m_IndexBuffer: ${toHex(indices.buffer)}
  m_VertexData:
    serializedVersion: 3
    m_VertexCount: ${vertexCount}
    m_Channels:
${channels}
    m_DataSize: ${vertexCount * VERTEX_STRIDE}
    _typelessdata: ${toHex(vertices.buffer)}
  m_LocalAABB:
    m_Center: ${center}
    m_Extent: ${extent}
`;
}

export const COMMON = `  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}`;

export function gameObject(id, name, components, staticFlags = STATIC_FLAGS, active = true) {
  return `--- !u!1 &${id}
GameObject:
${COMMON}
  serializedVersion: 6
  m_Component:
${components.map(c => `  - component: {fileID: ${c}}`).join('\n')}
  m_Layer: 0
  m_Name: ${name}
  m_TagString: Untagged
  m_Icon: {fileID: 0}
  m_NavMeshLayer: 0
  m_StaticEditorFlags: ${staticFlags}
  m_IsActive: ${active ? 1 : 0}`;
}

// position: { x, y, z } / yaw180: true なら -Z 方向を向ける
export function transform(id, owner, father, children, position = { x: 0, y: 0, z: 0 }, yaw180 = false, scale = 1) {
  const list = children.length ? '\n' + children.map(c => `  - {fileID: ${c}}`).join('\n') : ' []';
  return `--- !u!4 &${id}
Transform:
${COMMON}
  m_GameObject: {fileID: ${owner}}
  serializedVersion: 2
  m_LocalRotation: ${yaw180 ? '{x: 0, y: 1, z: 0, w: 0}' : '{x: 0, y: 0, z: 0, w: 1}'}
  m_LocalPosition: {x: ${position.x}, y: ${position.y}, z: ${position.z}}
  m_LocalScale: {x: ${scale}, y: ${scale}, z: ${scale}}
  m_ConstrainProportionsScale: 0
  m_Children:${list}
  m_Father: {fileID: ${father}}
  m_LocalEulerAnglesHint: {x: 0, y: ${yaw180 ? 180 : 0}, z: 0}`;
}

export function meshFilter(id, owner, meshRef) {
  return `--- !u!33 &${id}
MeshFilter:
${COMMON}
  m_GameObject: {fileID: ${owner}}
  m_Mesh: ${meshRef}`;
}

export function meshRenderer(id, owner, materialGuid) {
  return `--- !u!23 &${id}
MeshRenderer:
${COMMON}
  m_GameObject: {fileID: ${owner}}
  m_Enabled: 1
  m_CastShadows: 1
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
  - {fileID: 2100000, guid: ${materialGuid}, type: 2}
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
  m_SortingOrder: 0`;
}

export function meshCollider(id, owner, meshRef) {
  return `--- !u!64 &${id}
MeshCollider:
${COMMON}
  m_GameObject: {fileID: ${owner}}
  m_Material: {fileID: 0}
  m_IsTrigger: 0
  m_Enabled: 1
  serializedVersion: 4
  m_Convex: 0
  m_CookingOptions: 30
  m_Mesh: ${meshRef}`;
}
