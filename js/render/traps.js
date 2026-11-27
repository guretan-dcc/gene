// Clone Drone 風の床トラップ（プレビュー＆アニメーション）
import { arena } from '../state.js';
import { PALETTE } from '../config/constants.js';
import { getLayerHeight, getGridMetrics, cellCenterX, cellCenterZ } from '../core/grid.js';
import { view } from './context.js';

function addJumpPad({ group, x, z, wx, wz, floorY, S }) {
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(S * 0.78, 0.16, S * 0.78),
    new THREE.MeshLambertMaterial({ color: 0x164e63 })
  );
  pad.position.set(wx, floorY + 0.08, wz);
  group.add(pad);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(S * 0.28, S * 0.05, 6, 16),
    new THREE.MeshBasicMaterial({ color: PALETTE.jumpPad })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(wx, floorY + 0.28, wz);
  group.add(ring);
  view.animatedItems.push({ type: 'jumppad', mesh: ring, baseY: floorY + 0.22, phase: (x + z) * 0.7 });
}

function addFire({ group, x, z, wx, wz, floorY, S }) {
  const grate = new THREE.Mesh(
    new THREE.BoxGeometry(S * 0.74, 0.12, S * 0.74),
    new THREE.MeshLambertMaterial({ color: 0x7c2d12 })
  );
  grate.position.set(wx, floorY + 0.06, wz);
  group.add(grate);

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(S * 0.26, S * 1.15, 6),
    new THREE.MeshBasicMaterial({ color: PALETTE.fireTrap, transparent: true, opacity: 0.85 })
  );
  flame.position.set(wx, floorY + S * 0.62, wz);
  group.add(flame);
  view.animatedItems.push({ type: 'fire', mesh: flame, baseY: floorY + 0.12, maxH: S * 1.15, phase: (x * 1.3 + z * 0.5) });
}

function addSpike({ group, x, z, wx, wz, floorY, S }) {
  const basePlate = new THREE.Mesh(
    new THREE.BoxGeometry(S * 0.76, 0.10, S * 0.76),
    new THREE.MeshLambertMaterial({ color: PALETTE.spikeBase })
  );
  basePlate.position.set(wx, floorY + 0.05, wz);
  group.add(basePlate);

  const spikeGrp = new THREE.Group();
  const spGeo = new THREE.ConeGeometry(S * 0.10, S * 0.52, 4);
  const spMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
  const offs = [-0.22, 0.22];
  for (const ox of offs) {
    for (const oz of offs) {
      const sp = new THREE.Mesh(spGeo, spMat);
      sp.position.set(ox * S, S * 0.26, oz * S);
      spikeGrp.add(sp);
    }
  }
  spikeGrp.position.set(wx, floorY + 0.08, wz);
  group.add(spikeGrp);
  view.animatedItems.push({ type: 'spike', mesh: spikeGrp, baseY: floorY - S * 0.16, riseH: S * 0.30, phase: (x * 0.8 + z * 1.1) });
}

function addConveyor({ group, cell, wx, wz, floorY, S }) {
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(S * 0.86, 0.10, S * 0.86),
    new THREE.MeshLambertMaterial({ color: 0x064e3b })
  );
  belt.position.set(wx, floorY + 0.05, wz);
  group.add(belt);

  const chev = new THREE.Mesh(
    new THREE.ConeGeometry(S * 0.20, S * 0.36, 3),
    new THREE.MeshBasicMaterial({ color: PALETTE.conveyor })
  );
  chev.rotation.x = Math.PI / 2;
  if (cell.trapDir.x === 1) chev.rotation.z = -Math.PI / 2;
  else if (cell.trapDir.x === -1) chev.rotation.z = Math.PI / 2;
  else if (cell.trapDir.z === -1) chev.rotation.z = Math.PI;
  chev.position.set(wx, floorY + 0.16, wz);
  group.add(chev);
  view.animatedItems.push({
    type: 'conveyor',
    mesh: chev,
    baseX: wx,
    baseZ: wz,
    dirX: cell.trapDir.x,
    dirZ: cell.trapDir.z,
    span: S * 0.45
  });
}

const TRAP_BUILDERS = {
  jumppad: addJumpPad,
  fire: addFire,
  spike: addSpike,
  conveyor: addConveyor
};

// 床トラップを追加し、種類ごとの数を返す
export function addTraps() {
  const { W, D, S } = getGridMetrics();
  const layerH = getLayerHeight();
  const counts = { jumppad: 0, saw: arena.sawTracks.length, fire: 0, spike: 0, conveyor: 0 };

  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const cell = arena.grid[z][x];
      if (cell.trap === 'none' || cell.type === 'pit') continue;

      counts[cell.trap]++;
      TRAP_BUILDERS[cell.trap]({
        cell, x, z, S,
        group: view.chunkGroups[cell.chunkId],
        wx: cellCenterX(x),
        wz: cellCenterZ(z),
        floorY: cell.height * layerH
      });
    }
  }

  return counts;
}
