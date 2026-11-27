// ローポリ幅広スロープジオメトリ（並列スロープを自動結合し4三角形/基）
import { arena } from '../state.js';
import { getChunkStyle } from './styles.js';
import { getRoomEdgesX } from './bounds.js';
import { getLayerHeight, getGridMetrics, cellKey } from '../core/grid.js';
import { MeshBuilder } from './MeshBuilder.js';

const SLAB_THICKNESS = 0.45;
const STEP_COUNT = 5;

// forCollision: true なら階段を段にせず坂にする
export function buildSlopeGeometry(chunkId, forCollision = false) {
  const { S, halfW, halfD } = getGridMetrics();
  const layerH = getLayerHeight();
  const mesh = new MeshBuilder();
  const style = getChunkStyle(chunkId);
  const col = new THREE.Color(style.ramp || style.floor);

  // 隣り合う同向き・同標高のスロープを1つの幅広ウェッジへ結合してポリゴン削減
  const slopes = arena.slopes.filter(sl => arena.grid[sl.z][sl.x].chunkId === chunkId);
  const slopeMap = new Map(slopes.map(sl => [cellKey(sl.x, sl.z), sl]));
  const visited = new Set();

  for (const sl of slopes) {
    if (visited.has(cellKey(sl.x, sl.z))) continue;

    // 進行方向と直交する軸に沿って連続セルを統合
    const stepX = sl.dirZ !== 0 ? 1 : 0;
    const stepZ = sl.dirX !== 0 ? 1 : 0;

    const canMerge = (x, z) => {
      const nb = slopeMap.get(cellKey(x, z));
      return Boolean(nb) && !visited.has(cellKey(x, z)) &&
        nb.dirX === sl.dirX && nb.dirZ === sl.dirZ && nb.lowH === sl.lowH && nb.highH === sl.highH && nb.thin === sl.thin && nb.stairs === sl.stairs;
    };

    let minX = sl.x, maxX = sl.x;
    let minZ = sl.z, maxZ = sl.z;

    // 負方向・正方向へ伸ばす
    while (canMerge(minX - stepX, minZ - stepZ)) {
      minX -= stepX;
      minZ -= stepZ;
    }
    while (canMerge(maxX + stepX, maxZ + stepZ)) {
      maxX += stepX;
      maxZ += stepZ;
    }

    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        visited.add(cellKey(x, z));
      }
    }

    const x0 = minX * S - halfW;
    const x1 = (maxX + 1) * S - halfW;
    const z0 = minZ * S - halfD;
    const z1 = (maxZ + 1) * S - halfD;
    const yL = sl.lowH * layerH;
    const yH = sl.highH * layerH;

    let lA, lB, hA, hB, bA, bB;
    if (sl.dirZ === -1) {
      lA = [x0, yL, z1]; lB = [x1, yL, z1];
      hA = [x0, yH, z0]; hB = [x1, yH, z0];
      bA = [x0, yL, z0]; bB = [x1, yL, z0];
    } else if (sl.dirZ === 1) {
      lA = [x1, yL, z0]; lB = [x0, yL, z0];
      hA = [x1, yH, z1]; hB = [x0, yH, z1];
      bA = [x1, yL, z1]; bB = [x0, yL, z1];
    } else if (sl.dirX === 1) {
      lA = [x0, yL, z0]; lB = [x0, yL, z1];
      hA = [x1, yH, z0]; hB = [x1, yH, z1];
      bA = [x1, yL, z0]; bB = [x1, yL, z1];
    } else {
      lA = [x1, yL, z1]; lB = [x1, yL, z0];
      hA = [x0, yH, z1]; hB = [x0, yH, z0];
      bA = [x0, yL, z1]; bB = [x0, yL, z0];
    }

    if (sl.stairs && !forCollision) addSteps(mesh, [lA, lB, hA, hB], yH, col);
    else if (sl.thin) addSlab(mesh, [lA, lB, hA, hB], col, new THREE.Color(style.trim), isAtWall(chunkId));
    else addWedge(mesh, [lA, lB, hA, hB, bA, bB], col);
  }

  return mesh.build();
}

// 楔形: 傾斜上面（2三角形）＋両側面（各1三角形）
function addWedge(mesh, [lA, lB, hA, hB, bA, bB], color) {
  mesh.addTriangle(lA, lB, hB, color);
  mesh.addTriangle(lA, hB, hA, color);
  mesh.addTriangle(lA, hA, bA, color);
  mesh.addTriangle(lB, bB, hB, color);
}

// その点が部屋の左右の壁に接しているか調べる関数を返す
function isAtWall(chunkId) {
  const { kind, roomId } = arena.chunks[chunkId];
  if (kind !== 'room') return () => false;
  const edges = getRoomEdgesX(arena.rooms[roomId]);
  return p => edges.some(x => Math.abs(p[0] - x) < 0.001);
}

// 下が空いた板（壁に接する側面は省く）
function addSlab(mesh, [lA, lB, hA, hB], color, edgeColor, atWall) {
  const down = p => [p[0], p[1] - SLAB_THICKNESS, p[2]];
  const quad = (a, b, c, d, col) => {
    mesh.addTriangle(a, b, c, col);
    mesh.addTriangle(a, c, d, col);
  };
  quad(lA, lB, hB, hA, color);
  quad(down(lA), down(hA), down(hB), down(lB), edgeColor);
  if (!(atWall(lA) && atWall(hA))) quad(lA, hA, down(hA), down(lA), edgeColor);
  if (!(atWall(lB) && atWall(hB))) quad(lB, down(lB), down(hB), hB, edgeColor);
}

// 低い側から高い側へ向かう段
function addSteps(mesh, [lA, lB, hA], yH, color) {
  const yL = lA[1];
  for (let i = 0; i < STEP_COUNT; i++) {
    const at = (a, b, t) => a + (b - a) * t;
    const t0 = i / STEP_COUNT;
    const t1 = (i + 1) / STEP_COUNT;
    const xs = [lA[0], lB[0], at(lA[0], hA[0], t0), at(lA[0], hA[0], t1)];
    const zs = [lA[2], lB[2], at(lA[2], hA[2], t0), at(lA[2], hA[2], t1)];
    // 進行方向の軸だけ段ごとの範囲を使う
    const alongX = lA[0] !== hA[0];
    const xRange = alongX ? xs.slice(2) : [lA[0], lB[0]];
    const zRange = alongX ? [lA[2], lB[2]] : zs.slice(2);
    // 底面と、次の段（または高い床）に隠れる奥の面は省く
    const far = alongX
      ? (hA[0] > lA[0] ? '+x' : '-x')
      : (hA[2] > lA[2] ? '+z' : '-z');
    mesh.addBox(Math.min(...xRange), Math.max(...xRange), yL, at(yL, yH, t1),
      Math.min(...zRange), Math.max(...zRange), color, ['-y', far]);
  }
}
