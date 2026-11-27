// 配置JSON書き出し
import { state, arena } from '../state.js';
import { getLayerHeight, getPlayerPadHeight, cellCenterX, cellCenterZ } from '../core/grid.js';
import { DOOR_HEIGHT } from '../config/constants.js';
import { showToast } from '../ui/toast.js';
import { downloadFile } from './download.js';
import { getExportFilename, getChunkMeshName } from './filename.js';

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

// グリッド座標と標高(層)をワールド座標へ
function toPosition(x, z, heightLayers) {
  return { x: round(cellCenterX(x)), y: round(heightLayers * getLayerHeight()), z: round(cellCenterZ(z)) };
}

// セルを走査して自機・敵・床トラップを集める
function collectCells() {
  const pedH = state.pedestalHeight;
  const playerPadH = getPlayerPadHeight();
  const result = {
    playerSpawn: null,
    enemySpawns: [],
    jumpPads: [],
    fireTraps: [],
    spikeTraps: [],
    conveyors: []
  };
  const trapLists = {
    jumppad: result.jumpPads,
    fire: result.fireTraps,
    spike: result.spikeTraps,
    conveyor: result.conveyors
  };

  for (const row of arena.grid) {
    for (const cell of row) {
      const { x, z } = cell;
      const position = toPosition(x, z, cell.height);
      const floorY = position.y;

      if (cell.spawn === 'player') {
        result.playerSpawn = {
          gridX: x,
          gridZ: z,
          position: { ...position, y: round(floorY + playerPadH) },
          floorY,
          facing: { x: 0, y: 0, z: -1 }
        };
      } else if (cell.spawn === 'melee' || cell.spawn === 'ranged') {
        result.enemySpawns.push({
          gridX: x,
          gridZ: z,
          position: { ...position, y: round(floorY + pedH) },
          floorY,
          pedestalHeight: pedH,
          role: cell.spawn,
          roomId: cell.roomId
        });
      }

      if (trapLists[cell.trap]) {
        const trap = { gridX: x, gridZ: z, position };
        if (cell.trap === 'conveyor') trap.direction = { ...cell.trapDir };
        trapLists[cell.trap].push(trap);
      }
    }
  }
  return result;
}

function buildLayoutData() {
  const layerH = getLayerHeight();
  const { playerSpawn, enemySpawns, jumpPads, fireTraps, spikeTraps, conveyors } = collectCells();

  const sawTracks = arena.sawTracks.map(s => ({
    axis: s.axis,
    start: toPosition(s.startX, s.z, s.height),
    end: toPosition(s.endX, s.z, s.height),
    speed: round(s.speed, 2)
  }));

  const rooms = arena.rooms.map(r => ({
    id: r.id,
    layer: r.layer,
    lane: r.lane,
    type: r.type,
    center: toPosition((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, r.height),
    size: { x: round((r.x1 - r.x0 + 1) * state.cellSize), z: round((r.z1 - r.z0 + 1) * state.cellSize) },
    exits: arena.doors.filter(d => d.from === r.id).map(d => d.id)
  }));

  // 扉は from の部屋をクリアすると開く想定
  const doors = arena.doors.map(d => {
    const position = toPosition(d.x, d.z, d.height);
    position.z = round(position.z - state.cellSize / 2);
    return {
      id: d.id,
      fromRoom: d.from,
      toRoom: d.to,
      position,
      width: round(d.width * state.cellSize),
      height: DOOR_HEIGHT
    };
  });

  // visibleChunks: その区画にプレイヤーがいる間、描画する区画
  const chunks = arena.chunks.map(c => ({
    id: c.id,
    kind: c.kind,
    roomId: c.roomId,
    doorId: c.doorId,
    mesh: getChunkMeshName(c),
    visibleChunks: c.visible
  }));

  const slopes = arena.slopes.map(sl => ({
    gridX: sl.x,
    gridZ: sl.z,
    position: toPosition(sl.x, sl.z, sl.lowH),
    direction: { x: sl.dirX, z: sl.dirZ },
    lowY: round(sl.lowH * layerH),
    highY: round(sl.highH * layerH)
  }));

  return {
    meta: {
      tier: state.tier,
      gridWidth: state.gridWidth,
      gridDepth: state.gridDepth,
      cellSize: state.cellSize,
      layerHeight: round(layerH),
      coverBlockSize: state.coverBlockSize,
      magmaDepth: state.magmaDepth,
      roomWallHeight: state.roomWallHeight,
      seed: state.seed
    },
    rooms,
    doors,
    chunks,
    playerSpawn,
    enemySpawns,
    slopes,
    traps: {
      jumpPads,
      sawTracks,
      fireTraps,
      spikeTraps,
      conveyors
    },
    magmaPlaneY: round(-state.magmaDepth)
  };
}

export function exportJSON() {
  try {
    const data = buildLayoutData();
    downloadFile(getExportFilename('json'), JSON.stringify(data, null, 2), 'application/json');
    showToast(`JSON書き出し完了（敵${data.enemySpawns.length}体 / トラップ収録）`);
  } catch (err) {
    console.error(err);
    showToast('JSON書き出し中にエラーが発生しました');
  }
}
