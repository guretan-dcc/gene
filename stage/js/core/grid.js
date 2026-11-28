// グリッド寸法とワールド座標の変換
import { state, arena } from '../state.js';

export function getLayerHeight() {
  return state.cellSize * 0.65;
}

// 自機は入口の部屋の最後端中央
export function getPlayerCoord() {
  const start = arena.rooms[0];
  return { x: start.centerX, z: start.z1 };
}

export function getPlayerPadHeight() {
  return Math.min(0.35, state.pedestalHeight * 0.4);
}

export function getGridMetrics() {
  const W = state.gridWidth;
  const D = state.gridDepth;
  const S = state.cellSize;
  return { W, D, S, halfW: (W * S) / 2, halfD: (D * S) / 2 };
}

// セル中心のワールドX / Z座標
export function cellCenterX(x) {
  const { S, halfW } = getGridMetrics();
  return x * S - halfW + S / 2;
}

export function cellCenterZ(z) {
  const { S, halfD } = getGridMetrics();
  return z * S - halfD + S / 2;
}

export function isInGrid(x, z) {
  return x >= 0 && x < state.gridWidth && z >= 0 && z < state.gridDepth;
}

export function isWalkable(cell) {
  return Boolean(cell) && cell.type !== 'pit' && cell.type !== 'pillar';
}

export function cellKey(x, z) {
  return `${x},${z}`;
}

// 敵やトラップを置く部屋か
export function isCombatRoom(room) {
  return room.type === 'combat' || room.type === 'boss';
}

// セル座標を持つ要素の並びから、キー集合を作る
export function toCellKeySet(cells) {
  return new Set(cells.map(c => cellKey(c.x, c.z)));
}

// セルの (dx, dz) 側の辺の高さ。スロープの側面は同じ形のスロープ同士だけがつながる
function getEdgeHeight(cell, dx, dz, slopes) {
  const sl = slopes.get(cellKey(cell.x, cell.z));
  if (!sl) return cell.height;
  if (dx === sl.dirX && dz === sl.dirZ) return sl.highH;
  if (dx === -sl.dirX && dz === -sl.dirZ) return sl.lowH;
  return `side${sl.dirX},${sl.dirZ},${sl.lowH}`;
}

// 隣のセルへ段差なしで歩けるか。slopes は cellKey → スロープ の Map
export function canTraverse(from, to, slopes) {
  if (!isWalkable(to)) return false;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return getEdgeHeight(from, dx, dz, slopes) === getEdgeHeight(to, -dx, -dz, slopes);
}
