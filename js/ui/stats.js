// ポリゴン削減統計＆ステータス表示
import { state, arena } from '../state.js';
import { getTierTheme } from '../config/theme.js';
import { getLayerHeight, getGridMetrics } from '../core/grid.js';

export function updateStats(meshInfo, counts, trapCounts) {
  const { W, D, S } = getGridMetrics();
  const branches = arena.rooms.filter(r => r.lane === 'left').length;
  const layerH = getLayerHeight();
  const theme = getTierTheme();
  const terrainRes = meshInfo.terrain;

  const outerWallTris = meshInfo.outerWall.index.count / 3;
  const pedTris = meshInfo.pedestal.index.count / 3;
  const slopeTris = meshInfo.slope.index.count / 3;
  const magmaTris = 2;
  const totalOptTris = terrainRes.optimizedTriangles + outerWallTris + pedTris + slopeTris + magmaTris;
  const totalVerts =
    terrainRes.geometry.attributes.position.count +
    meshInfo.outerWall.attributes.position.count +
    meshInfo.pedestal.attributes.position.count +
    meshInfo.slope.attributes.position.count + 4;

  const reductionPct = terrainRes.naiveTriangles > 0
    ? ((1 - terrainRes.optimizedTriangles / terrainRes.naiveTriangles) * 100).toFixed(1)
    : '0.0';

  document.getElementById('polySummary').textContent =
    `${Math.round(totalOptTris).toLocaleString()} tris（地形本体のみ ${Math.round(terrainRes.optimizedTriangles)} tris / -${reductionPct}%）`;

  const worldW = (W * S).toFixed(1);
  const worldD = (D * S).toFixed(1);
  const wallMeters = state.outerWallEnabled ? (state.outerWallHeight * layerH).toFixed(1) : '0.0';
  const totalEnemies = counts.melee + counts.ranged;

  document.getElementById('stats').innerHTML =
    `Tier: ${theme.label} / 足場枠 ${W}×${D} (${worldW}m×${worldD}m)<br>` +
    `部屋: ${arena.rooms.length} / 分岐: ${branches} / 扉: ${arena.doors.length}<br>` +
    `マグマ深さ: -${state.magmaDepth}m（底まで一体Cube） / 外周谷: ${(state.chasmGap * S).toFixed(0)}m<br>` +
    `スロープ: ${arena.slopes.length}マス(${slopeTris}tris)<br>` +
    `巨大壁: +${wallMeters}m / 敵(${totalEnemies}): 近${counts.melee} 遠${counts.ranged} / 頂点: ${totalVerts.toLocaleString()}<br>` +
    `トラップ: 跳${trapCounts.jumppad} 鋸${trapCounts.saw} 炎${trapCounts.fire} 棘${trapCounts.spike} 搬${trapCounts.conveyor}`;
}
