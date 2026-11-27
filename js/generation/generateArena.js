// ステージ生成（部屋グラフ → 彫刻 → 遮蔽物 → 敵・トラップ）
import { state, arena } from '../state.js';
import { createRng } from '../core/random.js';
import { getPlayerCoord } from '../core/grid.js';
import { createRoomGraph, getStageDimensions, CORRIDOR_HALF } from './roomGraph.js';
import { createEmptyGrid, carveRoom, carveCorridor } from './carver.js';
import { placeCoverBlocks } from './cover.js';
import { assignEnemySpawns } from './enemies.js';
import { assignTraps } from './traps.js';

export function generateArena() {
  const { width, depth } = getStageDimensions();
  state.gridWidth = width;
  state.gridDepth = depth;

  const rng = createRng(state.seed);
  const { rooms, links } = createRoomGraph(rng);
  const grid = createEmptyGrid(width, depth);

  rooms.forEach(room => carveRoom(grid, room));
  arena.slopes = links.flatMap(link => carveCorridor(grid, link, rooms[link.from], rooms[link.to]));
  arena.grid = grid;
  arena.rooms = rooms;
  // 扉は通路が次の部屋へ入る境目に置く
  arena.doors = links.map(link => ({
    id: link.id,
    from: link.from,
    to: link.to,
    x: link.x,
    z: rooms[link.to].z1 + 1, // この行の奥側の辺が扉の位置
    width: CORRIDOR_HALF * 2 + 1,
    height: rooms[link.to].height
  }));

  placeCoverBlocks(rng);
  const start = getPlayerCoord();
  grid[start.z][start.x].spawn = 'player';

  assignEnemySpawns(createRng(state.seed + 777));
  assignTraps(createRng(state.seed + 1337));
}
