// クリック編集（敵スポーン / トラップ配置）
import { state, arena } from '../state.js';
import { getGridMetrics, isInGrid, isWalkable, getWaveForRow } from '../core/grid.js';
import { view } from '../render/context.js';
import { rebuildScene } from '../render/rebuildScene.js';

const SPAWN_CYCLE = { none: 'melee', melee: 'ranged', ranged: 'none' };
const TRAP_CYCLE = { none: 'jumppad', jumppad: 'fire', fire: 'spike', spike: 'conveyor', conveyor: 'none' };

// 画面座標の下にあるセルを返す（無ければ null）
function pickCell(clientX, clientY) {
  const rect = view.renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, view.camera);

  const hits = raycaster.intersectObjects(view.pickableMeshes, false);
  if (hits.length === 0) return null;

  const { S, halfW, halfD } = getGridMetrics();
  const gx = Math.floor((hits[0].point.x + halfW) / S);
  const gz = Math.floor((hits[0].point.z + halfD) / S);
  return isInGrid(gx, gz) ? arena.grid[gz][gx] : null;
}

function cycleSpawn(cell) {
  cell.spawn = SPAWN_CYCLE[cell.spawn] || 'none';
  if (cell.spawn !== 'none') {
    cell.trap = 'none';
    cell.wave = getWaveForRow(cell.z);
  } else {
    cell.wave = 0;
  }
}

function cycleTrap(cell) {
  cell.trap = TRAP_CYCLE[cell.trap] || 'none';
  if (cell.trap !== 'none') {
    cell.spawn = 'none';
    cell.wave = 0;
    cell.trapDir = { x: 0, z: -1 };
  }
}

export function handleViewportClick(clientX, clientY) {
  const cell = pickCell(clientX, clientY);
  if (!isWalkable(cell) || cell.spawn === 'player') return;

  if (state.clickMode === 'enemy') cycleSpawn(cell);
  else cycleTrap(cell);

  rebuildScene();
}
