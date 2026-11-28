import { clamp } from '../utils/math.js';

// =========================================================================
// 8. Unity Prefab (.prefab) / JSON / PLY 出力
// =========================================================================
function floatToHexLE(val) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, val, true);
    const bytes = new Uint8Array(buf);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function uint32ToHexLE(val) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setUint32(0, val >>> 0, true);
    const bytes = new Uint8Array(buf);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// linearFloatColor: true のとき、頂点カラーをリニアfloat(RGBA 16byte)で書き出す（Unityエディターの水メッシュと同じ。
// LowPolyWater.shader は頂点色を変換せずそのまま使う）。false は従来どおり sRGB の Color32。
const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function serializeMeshToUnityYaml(fileId, meshName, mb, linearFloatColor = false) {
    const stride = linearFloatColor ? 40 : 28;
    const geo = mb.toThreeGeometry();
    const pos = geo.getAttribute('position');
    const nrm = geo.getAttribute('normal');
    const col = geo.getAttribute('color');
    const vCount = pos.count;

    let vHex = '', iHex = '';
    let minX = 1e9, minY = 1e9, minZ = 1e9;
    let maxX = -1e9, maxY = -1e9, maxZ = -1e9;

    for (let i = 0; i < vCount; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
        const r = clamp(Math.round(col.getX(i) * 255), 0, 255);
        const g = clamp(Math.round(col.getY(i) * 255), 0, 255);
        const b = clamp(Math.round(col.getZ(i) * 255), 0, 255);
        const a = clamp(Math.round((mb.a[i] !== undefined ? mb.a[i] : 1) * 255), 0, 255);

        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;

        vHex += floatToHexLE(x) + floatToHexLE(y) + floatToHexLE(z);
        vHex += floatToHexLE(nx) + floatToHexLE(ny) + floatToHexLE(nz);
        if (linearFloatColor) {
            vHex += floatToHexLE(srgbToLinear(clamp(col.getX(i), 0, 1))) + floatToHexLE(srgbToLinear(clamp(col.getY(i), 0, 1)))
                + floatToHexLE(srgbToLinear(clamp(col.getZ(i), 0, 1))) + floatToHexLE(a / 255);
        } else {
            vHex += r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0') + a.toString(16).padStart(2, '0');
        }
        iHex += uint32ToHexLE(i);
    }
    geo.dispose();

    const cx = ((minX + maxX) * 0.5).toFixed(3), cy = ((minY + maxY) * 0.5).toFixed(3), cz = ((minZ + maxZ) * 0.5).toFixed(3);
    const ex = Math.max(0.5, (maxX - minX) * 0.5).toFixed(3), ey = Math.max(0.5, (maxY - minY) * 0.5).toFixed(3), ez = Math.max(0.5, (maxZ - minZ) * 0.5).toFixed(3);

    return `--- !u!43 &${fileId}
Mesh:
  m_ObjectHideFlags: 0
  m_Name: ${meshName}
  serializedVersion: 10
  m_SubMeshes:
  - serializedVersion: 2
    firstByte: 0
    indexCount: ${vCount}
    topology: 0
    baseVertex: 0
    firstVertex: 0
    vertexCount: ${vCount}
    localAABB:
      m_Center: {x: ${cx}, y: ${cy}, z: ${cz}}
      m_Extent: {x: ${ex}, y: ${ey}, z: ${ez}}
  m_IndexFormat: 1
  m_IndexBuffer: ${iHex}
  m_VertexData:
    serializedVersion: 3
    m_VertexCount: ${vCount}
    m_Channels:
    - stream: 0
      offset: 0
      format: 0
      dimension: 3
    - stream: 0
      offset: 12
      format: 0
      dimension: 3
    - stream: 0
      offset: 0
      format: 0
      dimension: 0
    - stream: 0
      offset: 24
      format: ${linearFloatColor ? 0 : 2}
      dimension: 4
    - stream: 0
      offset: 0
      format: 0
      dimension: 0
    - stream: 0
      offset: 0
      format: 0
      dimension: 0
    - stream: 0
      offset: 0
      format: 0
      dimension: 0
    - stream: 0
      offset: 0
      format: 0
      dimension: 0
    - stream: 0
      offset: 0
      format: 0
      dimension: 0
    - stream: 0
      offset: 0
      format: 0
      dimension: 0
    - stream: 0
      offset: 0
      format: 0
      dimension: 0
    - stream: 0
      offset: 0
      format: 0
      dimension: 0
    - stream: 0
      offset: 0
      format: 0
      dimension: 0
    - stream: 0
      offset: 0
      format: 0
      dimension: 0
    m_DataSize: ${vCount * stride}
    _typelessdata: ${vHex}
  m_LocalAABB:
    m_Center: {x: ${cx}, y: ${cy}, z: ${cz}}
    m_Extent: {x: ${ex}, y: ${ey}, z: ${ez}}
`;
}
