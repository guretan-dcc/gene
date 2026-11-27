// グリッド寸法とワールド座標の変換
import { state } from '../state.js';

export function getLayerHeight() {
  return state.cellSize * 0.65;
}

export function getPlayerCoord() {
  return {
    x: Math.floor(state.gridWidth / 2),
    z: state.gridDepth - 1
  };
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
