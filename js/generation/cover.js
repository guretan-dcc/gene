// 遮蔽物（大型Cubeブロック）の配置（通路やスロープを絶対に塞がない）
import { state } from '../state.js';
import { getPlayerCoord, cellKey } from '../core/grid.js';

export function placeCoverBlocks(grid, rampKeys, rng) {
  const W = state.gridWidth;
  const D = state.gridDepth;
  const pCoord = getPlayerCoord();

  const bs = state.coverBlockSize;
  const maxXLoop = state.symmetry === '2way' ? Math.floor((W - bs) / 2) : (W - bs);
  const blockStep = bs >= 2 ? 2 : 1;

  // 指定ブロック範囲とその周囲1マスに十分な平地があり、通路やスロープを塞がないか判定
  function canPlaceCoverBlock(bx, bz) {
    if (bx < 0 || bz < 0 || bx + bs > W || bz + bs > D) return false;
    const baseCell = grid[bz][bx];
    if (!baseCell || baseCell.type === 'pit' || baseCell.type === 'pillar') return false;
    const baseH = baseCell.height;

    // ブロック本体チェック（同一標高・スロープ除外・自機周辺除外）
    for (let dz = 0; dz < bs; dz++) {
      for (let dx = 0; dx < bs; dx++) {
        const x = bx + dx;
        const z = bz + dz;
        const c = grid[z][x];
        if (!c || c.type === 'pit' || c.type === 'pillar' || c.height !== baseH) return false;
        if (rampKeys.has(cellKey(x, z))) return false;
        if (Math.hypot(x - pCoord.x, z - pCoord.z) < 3.2) return false;
      }
    }

    // 周囲1マスに十分な迂回スペース（同一標高の床）があるか確認し、細い橋を塞がないようにする
    let walkableRing = 0;
    let totalRing = 0;
    for (let dz = -1; dz <= bs; dz++) {
      for (let dx = -1; dx <= bs; dx++) {
        if (dx >= 0 && dx < bs && dz >= 0 && dz < bs) continue;
        totalRing++;
        const nx = bx + dx;
        const nz = bz + dz;
        if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
        const nc = grid[nz][nx];
        if (!nc || nc.type === 'pit') continue;
        if (nc.type === 'pillar') return false; // 既存遮蔽物とは1マス以上空ける
        if (rampKeys.has(cellKey(nx, nz))) return false; // スロープ出入口を塞がない
        if (nc.height === baseH) walkableRing++;
      }
    }
    return walkableRing >= Math.ceil(totalRing * 0.65);
  }

  function placeCoverBlock(bx, bz, h) {
    for (let dz = 0; dz < bs; dz++) {
      for (let dx = 0; dx < bs; dx++) {
        const c = grid[bz + dz][bx + dx];
        c.type = 'pillar';
        c.obstacleH = h;
      }
    }
  }

  for (let z = 2; z < D - 3; z += blockStep) {
    for (let x = 1; x <= maxXLoop; x += blockStep) {
      if (rng() >= state.coverDensity) continue;
      if (!canPlaceCoverBlock(x, z)) continue;

      const obsH = 1 + Math.floor(rng() * state.wallHeight);
      if (state.symmetry === '2way') {
        const mx = W - bs - x;
        // 中央を跨がない場合のみ左右対称配置
        if (mx > x + bs && canPlaceCoverBlock(mx, z)) {
          placeCoverBlock(x, z, obsH);
          placeCoverBlock(mx, z, obsH);
        } else if (mx === x) {
          placeCoverBlock(x, z, obsH);
        }
      } else {
        placeCoverBlock(x, z, obsH);
      }
    }
  }
}
