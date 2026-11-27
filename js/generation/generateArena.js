// アリーナ・グリッド生成（非矩形・通路連結・多段高低差＆幅広スロープ）
import { state, arena } from '../state.js';
import { createRng } from '../core/random.js';
import { createEmptyGrid, createCarver } from './carver.js';
import { LAYOUTS, gauntlet } from './layouts/index.js';
import { placeCoverBlocks } from './cover.js';
import { ensurePlayerStart } from './playerStart.js';
import { generateSlopes } from './slopes.js';
import { assignEnemySpawns } from './enemies.js';
import { assignTraps } from './traps.js';

export function generateArena() {
  const W = state.gridWidth;
  const D = state.gridDepth;
  const rng = createRng(state.seed);

  // 全セルを「深いマグマ谷(pit)」で初期化し、部屋・通路・高台を彫刻して非矩形シルエットを作る
  const grid = createEmptyGrid(W, D);
  const carver = createCarver(grid, W, D);

  // ステップ1: プリセット別の非矩形・立体通路レイアウト彫刻
  const carveLayout = LAYOUTS[state.preset] || gauntlet;
  carveLayout({ W, D, cx: Math.floor(W / 2), cz: Math.floor(D / 2), rng }, carver);

  // ステップ2: 遮蔽物の配置 / ステップ3: 自機スタート位置の確保
  placeCoverBlocks(grid, carver.rampKeys, rng);
  ensurePlayerStart(grid, carver);

  // 生成結果を反映してから後続処理を実行
  arena.grid = grid;
  arena.slopes = carver.slopes;

  // ステップ4: 追加スロープ補完・敵スポーン・トラップを順次配置
  generateSlopes(createRng(state.seed + 313));
  assignEnemySpawns(createRng(state.seed + 777));
  assignTraps(createRng(state.seed + 1337));
}
