// ステージ生成（部屋の並び → 彫刻 → 遮蔽物 → 敵・トラップ）
import { state, arena } from '../state.js';
import { createRng } from '../core/random.js';
import { getPlayerCoord } from '../core/grid.js';
import { createRoomPlan, CORRIDOR_HALF } from './roomPlan.js';
import { createEmptyGrid, carveRoom, carveCorridor } from './carver.js';
import { buildChunks, getLinks } from './chunks.js';
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
  // 扉は各部屋の出口に置く（最後の部屋の扉は接続先なし）
  arena.doors = rooms.map((from, id) => ({
    id,
    from: from.id,
    to: id + 1 < rooms.length ? id + 1 : null,
    x: from.centerX,
    z: from.z0, // この行の奥側の辺が扉の位置
    width: CORRIDOR_HALF * 2 + 1,
    height: from.exitHeight
  }));
  getLinks().forEach(d => carveCorridor(grid, rooms.length + d.id, rooms[d.from], rooms[d.to]));
  buildChunks();

  placeCoverBlocks(rng);
  const start = getPlayerCoord();
  grid[start.z][start.x].spawn = 'player';

  assignEnemySpawns(createRng(state.seed + 777));
  assignTraps(createRng(state.seed + 1337));
}
