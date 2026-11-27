// ポリゴン統計＆ステータス表示
import { state, arena } from '../state.js';
import { getTierTheme } from '../config/theme.js';
import { getGridMetrics } from '../core/grid.js';

function sumOf(items, key) {
  return items.reduce((sum, item) => sum + item[key], 0);
}

export function updateStats(meshInfo, counts, trapCounts) {
  const { W, D, S } = getGridMetrics();
  const theme = getTierTheme();
  const terrain = sumOf(meshInfo, 'terrainTriangles');
  const naive = sumOf(meshInfo, 'naiveTriangles');
  const reductionPct = naive > 0 ? ((1 - terrain / naive) * 100).toFixed(1) : '0.0';

  const total = sumOf(meshInfo, 'triangles') + 2; // +2 はマグマ
  document.getElementById('polySummary').textContent =
    `${total.toLocaleString()} tris（区画 ${meshInfo.length}）`;

  document.getElementById('stats').innerHTML =
    `Tier: ${theme.label} / 全体 ${W}×${D} (${(W * S).toFixed(1)}m×${(D * S).toFixed(1)}m)<br>` +
    `部屋: ${arena.rooms.length} / 扉: ${arena.doors.length}<br>` +
    `壁の高さ: ${state.roomWallHeight}m / 地形 ${terrain} tris (-${reductionPct}%)<br>` +
    `スロープ: ${arena.slopes.length}マス(${sumOf(meshInfo, 'slopeTriangles')}tris) / 頂点: ${(sumOf(meshInfo, 'vertices') + 4).toLocaleString()}<br>` +
    `敵(${counts.melee + counts.ranged}): 近${counts.melee} 遠${counts.ranged}<br>` +
    `トラップ: 跳${trapCounts.jumppad} 鋸${trapCounts.saw} 炎${trapCounts.fire} 棘${trapCounts.spike} 搬${trapCounts.conveyor}`;
}
