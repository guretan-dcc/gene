// 部屋と通路を囲む内向きの壁（外側からは裏面カリングで中が見える）
import { arena } from '../state.js';
import { DOOR_HEIGHT } from '../config/constants.js';
import { getChunkStyle } from './styles.js';
import { getChunkTopY, getChunkBottomY } from './bounds.js';
import { getLayerHeight, getGridMetrics, isInGrid } from '../core/grid.js';
import { MeshBuilder } from './MeshBuilder.js';

// セルの4辺。corners は内側から見て左→右の順（セル内の0/1座標）
const SIDES = [
  { dx: 0, dz: -1, corners: [[0, 0], [1, 0]] },
  { dx: 0, dz: 1, corners: [[1, 1], [0, 1]] },
  { dx: -1, dz: 0, corners: [[0, 1], [0, 0]] },
  { dx: 1, dz: 0, corners: [[1, 0], [1, 1]] }
];

export function buildWallGeometry(chunkId) {
  const mesh = new MeshBuilder();
  const color = new THREE.Color(getChunkStyle(chunkId).wall);
  for (const side of SIDES) addSideWalls(mesh, chunkId, side, color);
  return mesh.build();
}

// そのセルの辺に必要な壁の下端（不要なら null）
function getWallBottom(chunk, x, z, { dx, dz }) {
  const cell = arena.grid[z][x];
  if (cell.chunkId !== chunk.id) return null;
  // 溶岩の上は溶岩面まで壁を下ろす
  const floorY = (cell.type === 'pit' || cell.thin) ? getChunkBottomY(chunk) : cell.height * getLayerHeight();
  const next = isInGrid(x + dx, z + dz) ? arena.grid[z + dz][x + dx] : null;

  if (!next || next.chunkId === null) return floorY;      // 外側: 床から天井まで
  if (next.chunkId === chunk.id) return null;             // 同じ区画の内側
  return chunk.kind === 'room' ? floorY + DOOR_HEIGHT : null; // 出入口: 部屋側だけ上部の壁
}

// 同じ向き・同じ高さで連続する辺を1枚にまとめる
function addSideWalls(mesh, chunkId, side, color) {
  const { W, D, S, halfW, halfD } = getGridMetrics();
  const chunk = arena.chunks[chunkId];
  const topY = getChunkTopY(chunk);
  const alongX = side.dz !== 0;
  const lineCount = alongX ? D : W;
  const length = alongX ? W : D;

  for (let line = 0; line < lineCount; line++) {
    const bottomAt = i => (alongX
      ? getWallBottom(chunk, i, line, side)
      : getWallBottom(chunk, line, i, side));

    for (let i = 0; i < length;) {
      const y = bottomAt(i);
      let end = i + 1;
      if (y === null || y >= topY) { i = end; continue; }
      while (end < length && bottomAt(end) === y) end++;

      const [a, b] = side.corners.map(([cx, cz]) => {
        const gx = alongX ? (cx ? end : i) : line + cx;
        const gz = alongX ? line + cz : (cz ? end : i);
        return [gx * S - halfW, gz * S - halfD];
      });
      mesh.addQuad(
        [a[0], y, a[1]], [b[0], y, b[1]], [b[0], topY, b[1]], [a[0], topY, a[1]],
        [-side.dx, 0, -side.dz], color
      );
      i = end;
    }
  }
}
