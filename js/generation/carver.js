// グリッドの初期化と、足場・部屋・計画スロープを彫る操作
import { cellKey } from '../core/grid.js';

export function createEmptyGrid(W, D) {
  return Array.from({ length: D }, (_, z) =>
    Array.from({ length: W }, (_, x) => ({
      x, z,
      type: 'pit',     // 'pit' | 'floor' | 'elevated' | 'pillar'
      height: 0,       // 0..3 (床の標高)
      obstacleH: 0,    // 遮蔽物の層数
      spawn: 'none',   // 'none' | 'player' | 'melee' | 'ranged'
      wave: 0,         // 1 | 2 | 3
      trap: 'none',    // 'none' | 'jumppad' | 'fire' | 'spike' | 'conveyor'
      trapDir: { x: 0, z: -1 }
    }))
  );
}

export function createCarver(grid, W, D) {
  const slopes = [];          // 計画スロープ
  const rampKeys = new Set(); // 計画スロープがあるセル

  // セルを指定標高の足場にする
  function setFloor(x, z, h) {
    grid[z][x].type = h > 0 ? 'elevated' : 'floor';
    grid[z][x].height = h;
    grid[z][x].obstacleH = 0;
  }

  function setFloorRect(x0, z0, x1, z1, h = 0) {
    const minX = Math.max(0, Math.min(x0, x1));
    const maxX = Math.min(W - 1, Math.max(x0, x1));
    const minZ = Math.max(0, Math.min(z0, z1));
    const maxZ = Math.min(D - 1, Math.max(z0, z1));
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        setFloor(x, z, h);
      }
    }
  }

  function setOctaRoom(rcx, rcz, rx, rz, h = 0) {
    const cut = Math.max(1, Math.floor(Math.min(rx, rz) * 0.45));
    for (let z = Math.max(0, rcz - rz); z <= Math.min(D - 1, rcz + rz); z++) {
      for (let x = Math.max(0, rcx - rx); x <= Math.min(W - 1, rcx + rx); x++) {
        const dx = Math.abs(x - rcx);
        const dz = Math.abs(z - rcz);
        if (dx + dz <= rx + rz - cut) {
          setFloor(x, z, h);
        }
      }
    }
  }

  // 指定セルに計画スロープを登録（足場ベースもlowHで確保）
  function addPlannedRamp(x, z, dirX, dirZ, lowH) {
    if (x < 0 || x >= W || z < 0 || z >= D) return;
    const key = cellKey(x, z);
    if (rampKeys.has(key)) return;
    setFloor(x, z, lowH);
    slopes.push({ x, z, dirX, dirZ, lowH, highH: lowH + 1 });
    rampKeys.add(key);
  }

  // 幅広スロープ帯を設置（例：z方向に段差を登る/下る幅3マスの連続スロープ）
  function addWideZRamp(x0, x1, zLow, dirZ, fromH, toH) {
    const steps = Math.abs(toH - fromH);
    const stepDir = toH > fromH ? 1 : -1;
    // dirZ: -1(奥へ進む) または +1(手前へ進む)
    for (let s = 0; s < steps; s++) {
      const z = zLow + dirZ * s;
      const lowH = stepDir > 0 ? (fromH + s) : (fromH - s - 1);
      const slopeDirZ = stepDir > 0 ? dirZ : -dirZ;
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
        addPlannedRamp(x, z, 0, slopeDirZ, lowH);
      }
    }
  }

  function addWideXRamp(z0, z1, xLow, dirX, fromH, toH) {
    const steps = Math.abs(toH - fromH);
    const stepDir = toH > fromH ? 1 : -1;
    for (let s = 0; s < steps; s++) {
      const x = xLow + dirX * s;
      const lowH = stepDir > 0 ? (fromH + s) : (fromH - s - 1);
      const slopeDirX = stepDir > 0 ? dirX : -dirX;
      for (let z = Math.max(0, z0); z <= Math.min(D - 1, z1); z++) {
        addPlannedRamp(x, z, slopeDirX, 0, lowH);
      }
    }
  }

  return { slopes, rampKeys, setFloorRect, setOctaRoom, addWideZRamp, addWideXRamp };
}
