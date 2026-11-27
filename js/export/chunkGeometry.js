// 書き出し用の区画ジオメトリ（PLY / unitypackage 共通。座標はステージ全体の座標系）
import { buildTerrainGeometry } from '../geometry/terrain.js';
import { buildWallGeometry } from '../geometry/walls.js';
import { buildPedestalGeometry } from '../geometry/pedestals.js';
import { buildSlopeGeometry } from '../geometry/slopes.js';
import { buildDecorGeometry } from '../geometry/decor.js';
import { buildMagmaGeometry } from '../geometry/magma.js';

export function isChecked(id) {
  return document.getElementById(id).checked;
}

// 床・壁・遮蔽物と、チェックに応じた台座・スロープ
function collectBody(chunkId, forCollision) {
  const geos = [buildTerrainGeometry(chunkId).geometry, buildWallGeometry(chunkId)];
  if (isChecked('includePedestals')) geos.push(buildPedestalGeometry(chunkId));
  if (isChecked('includeSlopes')) geos.push(buildSlopeGeometry(chunkId, forCollision));
  return geos;
}

// 見た目
export function collectChunkGeometries(chunkId) {
  const decor = buildDecorGeometry(chunkId);
  return [...collectBody(chunkId, false), decor.solid, decor.glow];
}

// 当たり判定。装飾と浅い溶岩面は含めず、階段は1枚の坂にする
export function collectColliderGeometries(chunkId) {
  return collectBody(chunkId, true);
}

export function collectMagma() {
  return isChecked('includeMagma') ? [buildMagmaGeometry()] : [];
}
