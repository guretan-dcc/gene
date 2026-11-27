// ステージ生成（部屋の並び → 彫刻 → 遮蔽物 → 敵・トラップ）
import { state, arena } from '../state.js';
import { createRng } from '../core/random.js';
import { getPlayerCoord } from '../core/grid.js';
import { createRoomPlan, CORRIDOR_HALF } from './roomPlan.js';
import { createEmptyGrid, carveRoom, carveCorridor } from './carver.js';
import { buildChunks } from './chunks.js';
import { placeCoverBlocks } from './cover.js';
import { assignEnemySpawns } from './enemies.js';
import { assignTraps } from './traps.js';

export function generateArena() {
  const rng = createRng(state.seed);
  const { rooms, width, depth } = createRoomPlan(rng);
  state.gridWidth = width;
  state.gridDepth = depth;

  const grid = createEmptyGrid(width, depth);
  arena.grid = grid;
  arena.rooms = rooms;
  arena.slopes = rooms.flatMap(room => carveRoom(grid, room));
  // 扉は通路が次の部屋へ入る境目に置く
  arena.doors = rooms.slice(1).map((to, id) => ({
    id,
    from: to.id - 1,
    to: to.id,
    x: to.centerX,
    z: to.z1 + 1, // この行の奥側の辺が扉の位置
    width: CORRIDOR_HALF * 2 + 1,
    height: to.height
  }));
  arena.doors.forEach(d => carveCorridor(grid, rooms.length + d.id, rooms[d.from], rooms[d.to]));
  buildChunks();

  placeCoverBlocks(rng);
  const start = getPlayerCoord();
  grid[start.z][start.x].spawn = 'player';

  assignEnemySpawns(createRng(state.seed + 777));
  assignTraps(createRng(state.seed + 1337));
}
