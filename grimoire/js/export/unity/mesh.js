// 位置・法線・UVだけのメッシュと、その Unity .asset
import { HEADER, MESH_FILE_ID } from '../../../../shared/unity-yaml.js';

const STRIDE = 32;
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export class UvMesh {
  positions = [];
  normals = [];
  uvs = [];
  indices = [];

  // points: 一周する順の4点 / normal: 表にする向き / uvs: 各点のUV(1組なら全点で共通)
  // 座標は three.js(右手系)で指定し、書き出し時に Unity(左手系)へ変換する
  quad(points, normal, uvs) {
    const n = cross(sub(points[1], points[0]), sub(points[2], points[0]));
    const flipped = cross(sub(points[2], points[0]), sub(points[3], points[0]));
    const facing = dot(n, normal) + dot(flipped, normal);
    const length = Math.hypot(...normal) || 1;
    const base = this.positions.length / 3;
    points.forEach((p, i) => {
      this.positions.push(p[0], p[1], -p[2]);
      this.normals.push(normal[0] / length, normal[1] / length, -normal[2] / length);
      this.uvs.push(...(uvs.length === 2 && typeof uvs[0] === 'number' ? uvs : uvs[i]));
    });
    // z を反転するので、Unity で表になる順は右手系の表と逆
    const order = facing > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    this.indices.push(...order.map(i => base + i));
  }

  // faces: { top, bottom, left, right, front, back } ごとに (点) => UV。ない面は作らない
  box([x0, y0, z0], [x1, y1, z1], faces) {
    const sides = {
      top: [[0, 1, 0], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]],
      bottom: [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
      left: [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
      right: [[1, 0, 0], [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]]],
      front: [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
      back: [[0, 0, -1], [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]]]
    };
    for (const [name, uvAt] of Object.entries(faces)) {
      const [normal, points] = sides[name];
      this.quad(points, normal, points.map(uvAt));
    }
  }

  get vertexCount() {
    return this.positions.length / 3;
  }

  get triangleCount() {
    return this.indices.length / 3;
  }
}

const toHex = buffer => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');

export function createUvMeshAsset(name, mesh) {
  const count = mesh.vertexCount;
  if (count > 65535) throw new Error(`${name} の頂点が多すぎます`);
  const vertices = new DataView(new ArrayBuffer(count * STRIDE));
  const indices = new DataView(new ArrayBuffer(mesh.indices.length * 2));
  mesh.indices.forEach((v, i) => indices.setUint16(i * 2, v, true));
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    const p = mesh.positions.slice(i * 3, i * 3 + 3);
    [...p, ...mesh.normals.slice(i * 3, i * 3 + 3), ...mesh.uvs.slice(i * 2, i * 2 + 2)]
      .forEach((v, k) => vertices.setFloat32(i * STRIDE + k * 4, v, true));
    p.forEach((v, k) => {
      min[k] = Math.min(min[k], v);
      max[k] = Math.max(max[k], v);
    });
  }

  const vector = values => `{x: ${values[0].toFixed(4)}, y: ${values[1].toFixed(4)}, z: ${values[2].toFixed(4)}}`;
  const center = vector(min.map((v, k) => (v + max[k]) / 2));
  const extent = vector(min.map((v, k) => (max[k] - v) / 2));
  // 位置(0)・法線(1)・UV(4)
  const used = { 0: [0, 0, 3], 1: [12, 0, 3], 4: [24, 0, 2] };
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
    indexCount: ${mesh.indices.length}
    topology: 0
    baseVertex: 0
    firstVertex: 0
    vertexCount: ${count}
    localAABB:
      m_Center: ${center}
      m_Extent: ${extent}
  m_IndexFormat: 0
  m_IndexBuffer: ${toHex(indices.buffer)}
  m_VertexData:
    serializedVersion: 3
    m_VertexCount: ${count}
    m_Channels:
${channels}
    m_DataSize: ${count * STRIDE}
    _typelessdata: ${toHex(vertices.buffer)}
  m_LocalAABB:
    m_Center: ${center}
    m_Extent: ${extent}
`;
}
