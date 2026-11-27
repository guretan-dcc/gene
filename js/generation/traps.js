// トラップ自動配置（ノコギリ → ジャンプパッド → コンベア → 炎・スパイクの順）
import { state, arena } from '../state.js';
import { shuffle } from '../core/random.js';
import { isInGrid, isWalkable, isCombatRoom, cellKey, toCellKeySet } from '../core/grid.js';

const NEIGHBOR_DIRS = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 }
];

export function assignTraps(rng) {
  clearTraps();
  if (!state.autoTraps) return;

  const isTrapFreeCell = createTrapFreeChecker();
  const sawCells = placeSawTracks(rng, isTrapFreeCell);
  const isAvailable = (x, z) => isTrapFreeCell(x, z) && !sawCells.has(cellKey(x, z));

  placeJumpPads(rng, isAvailable);
  placeConveyors(rng, isAvailable);
  placeFloorTraps(rng, isAvailable);
}

function clearTraps() {
  for (const row of arena.grid) {
    for (const cell of row) {
      cell.trap = 'none';
      cell.trapDir = { x: 0, z: -1 };
    }
  }
  arena.sawTracks = [];
}

// トラップは戦闘部屋の中だけ（出入口に接する行は除く）
function createTrapFreeChecker() {
  const slopeKeys = toCellKeySet(arena.slopes);

  return function isTrapFreeCell(x, z) {
    if (!isInGrid(x, z)) return false;
    const c = arena.grid[z][x];
    if (!isWalkable(c) || c.roomId === null) return false;
    const room = arena.rooms[c.roomId];
    if (!isCombatRoom(room) || z <= room.z0 || z >= room.z1) return false;
    return c.spawn === 'none' && c.trap === 'none' && !slopeKeys.has(cellKey(x, z));
  };
}

// 候補範囲（奥1行と手前2行を除く）の使用可能セルを走査
function forEachAvailableCell(isAvailable, callback) {
  for (let z = 1; z < state.gridDepth - 2; z++) {
    for (let x = 0; x < state.gridWidth; x++) {
      if (isAvailable(x, z)) callback(arena.grid[z][x], x, z);
    }
  }
}

// 1. 往復回転ノコギリ（横方向の平坦通路に配置）。使用したセルのキー集合を返す
function placeSawTracks(rng, isTrapFreeCell) {
  const W = state.gridWidth;
  const D = state.gridDepth;

  const sawCandidates = [];
  for (let z = 3; z < D - 4; z += 2) {
    let x = 1;
    while (x < W - 1) {
      if (!isTrapFreeCell(x, z)) { x++; continue; }
      const baseH = arena.grid[z][x].height;
      let endX = x;
      while (endX + 1 < W - 1 && isTrapFreeCell(endX + 1, z) && arena.grid[z][endX + 1].height === baseH) {
        endX++;
      }
      if (endX - x >= 2) {
        sawCandidates.push({ startX: x, endX: Math.min(endX, x + 5), z, height: baseH });
      }
      x = endX + 2;
    }
  }
  shuffle(sawCandidates, rng);
  const sawUsedCells = new Set();
  for (let i = 0; i < Math.min(state.sawCount, sawCandidates.length); i++) {
    const s = sawCandidates[i];
    arena.sawTracks.push({
      axis: 'x',
      startX: s.startX,
      endX: s.endX,
      z: s.z,
      height: s.height,
      speed: 0.7 + rng() * 0.6,
      phase: rng() * Math.PI * 2
    });
    for (let sx = s.startX; sx <= s.endX; sx++) {
      sawUsedCells.add(cellKey(sx, s.z));
    }
  }

  return sawUsedCells;
}

// 2. ジャンプパッド（高台付近または溶岩際を優先）
function placeJumpPads(rng, isAvailable) {
  const jumpCandidates = [];
  forEachAvailableCell(isAvailable, (cell, x, z) => {
    const nearLedge = NEIGHBOR_DIRS.some(d => {
      const nx = x + d.x, nz = z + d.z;
      if (!isInGrid(nx, nz)) return false;
      const nb = arena.grid[nz][nx];
      return nb.type !== 'pit' && nb.height > cell.height;
    });
    jumpCandidates.push({ cell, priority: nearLedge ? 1 : 0 });
  });
  shuffle(jumpCandidates, rng);
  jumpCandidates.sort((a, b) => b.priority - a.priority);
  for (let i = 0; i < Math.min(state.jumpPadCount, jumpCandidates.length); i++) {
    jumpCandidates[i].cell.trap = 'jumppad';
  }
}

// 3. ベルトコンベア（マグマ谷の縁を優先し、谷へ向かって押し出す）
function placeConveyors(rng, isAvailable) {
  const convCandidates = [];
  forEachAvailableCell(isAvailable, (cell, x, z) => {
    const pitDir = NEIGHBOR_DIRS.find(d => {
      const nx = x + d.x, nz = z + d.z;
      return !isInGrid(nx, nz) || arena.grid[nz][nx].type === 'pit';
    });
    convCandidates.push({ cell, dir: pitDir || { x: 0, z: 1 }, priority: pitDir ? 1 : 0 });
  });
  shuffle(convCandidates, rng);
  convCandidates.sort((a, b) => b.priority - a.priority);
  for (let i = 0; i < Math.min(state.conveyorCount, convCandidates.length); i++) {
    const item = convCandidates[i];
    item.cell.trap = 'conveyor';
    item.cell.trapDir = { x: item.dir.x, z: item.dir.z };
  }
}

// 4. 炎・スパイク床
function placeFloorTraps(rng, isAvailable) {
  const floorCandidates = [];
  forEachAvailableCell(isAvailable, cell => floorCandidates.push(cell));
  shuffle(floorCandidates, rng);
  for (let i = 0; i < Math.min(state.floorTrapCount, floorCandidates.length); i++) {
    floorCandidates[i].trap = (i % 2 === 0) ? 'fire' : 'spike';
  }
}
