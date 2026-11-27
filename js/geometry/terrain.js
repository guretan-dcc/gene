// 巨大ソリッドCube Greedy Meshing エンジン（支柱なし・マグマ底まで1枚板）
import { state, arena } from '../state.js';
import { VOX } from '../config/constants.js';
import { getVoxelColor } from '../config/theme.js';
import { getLayerHeight, getGridMetrics, isInGrid } from '../core/grid.js';
import { MeshBuilder } from './MeshBuilder.js';

export function buildTerrainGeometry(chunkId) {
  const mesh = new MeshBuilder();
  addFloorTops(mesh, chunkId);
  addPlatformSides(mesh, chunkId);
  addCoverBlocks(mesh, chunkId);

  return {
    geometry: mesh.build(),
    naiveTriangles: countNaiveVoxels(chunkId) * 12,
    optimizedTriangles: mesh.indices.length / 3
  };
}

// ナイーブ実装時（1ボクセル=12三角形）の比較用カウント
function countNaiveVoxels(chunkId) {
  const baseDepthLayers = Math.max(1, Math.ceil(state.magmaDepth / getLayerHeight()));
  let count = 0;
  for (const row of arena.grid) {
    for (const c of row) {
      if (c.chunkId !== chunkId) continue;
      count += baseDepthLayers + c.height + (c.type === 'pillar' ? c.obstacleH : 0);
    }
  }
  return count;
}

// --- A. 床上面 (+Y) の非くり抜き（ワイルドカード貫通）Greedy Meshing ---
function addFloorTops(mesh, chunkId) {
  const { W, D, S, halfW, halfD } = getGridMetrics();
  const layerH = getLayerHeight();

  for (let h = 0; h <= 3; h++) {
    // 0: 不可/済, 1: 必須描画, 2: ワイルドカード（上に高台や遮蔽物があり隠れる面）
    const mask = Array.from({ length: D }, () => new Uint8Array(W));
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const c = arena.grid[z][x];
        if (c.chunkId !== chunkId || c.height < h) continue;
        if (c.height === h && !(c.type === 'pillar' && c.obstacleH > 0)) {
          mask[z][x] = 1;
        } else if (state.noCarveMerge) {
          mask[z][x] = 2;
        }
      }
    }

    const col = new THREE.Color(getVoxelColor(VOX.FLOOR0 + h));
    const yTop = h * layerH;

    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (mask[z][x] !== 1) continue;

        // X方向へ必須またはワイルドカードで最大拡張
        let w = 1;
        while (x + w < W && mask[z][x + w] !== 0) w++;
        // 右端がワイルドカードのみなら不要なはみ出しを詰める
        while (w > 1 && mask[z][x + w - 1] === 2) w--;

        // Z方向へ同幅で拡張
        let d = 1;
        outerD: while (z + d < D) {
          for (let dx = 0; dx < w; dx++) {
            if (mask[z + d][x + dx] === 0) break outerD;
          }
          d++;
        }
        // 下端の行がワイルドカードのみなら詰める
        while (d > 1) {
          let hasReq = false;
          for (let dx = 0; dx < w; dx++) {
            if (mask[z + d - 1][x + dx] === 1) { hasReq = true; break; }
          }
          if (hasReq) break;
          d--;
        }

        // 描画済みセルを0にして重複（Z-fighting）を完全に防ぐ
        for (let dz = 0; dz < d; dz++) {
          for (let dx = 0; dx < w; dx++) {
            mask[z + dz][x + dx] = 0;
          }
        }

        const x0 = x * S - halfW;
        const x1 = (x + w) * S - halfW;
        const z0 = z * S - halfD;
        const z1 = (z + d) * S - halfD;
        mesh.addQuad([x0, yTop, z0], [x0, yTop, z1], [x1, yTop, z1], [x1, yTop, z0], [0, 1, 0], col);
      }
    }
  }
}

// --- B. 足場側面（マグマ底まで一体の巨大ソリッド壁）の水平マージ ---
function addPlatformSides(mesh, chunkId) {
  const { W, D, S, halfW, halfD } = getGridMetrics();
  const layerH = getLayerHeight();
  const magmaY = -state.magmaDepth;

  const underCol = new THREE.Color(getVoxelColor(VOX.UNDER));

  function getPlatformTopY(x, z) {
    if (!isInGrid(x, z)) return magmaY;
    const c = arena.grid[z][x];
    if (!c || c.type === 'pit') return magmaY;
    return c.height * layerH;
  }

  // この区画のセルの天面高さ（区画外は面を作らない）
  function getOwnTopY(x, z) {
    return arena.grid[z][x].chunkId === chunkId ? getPlatformTopY(x, z) : magmaY;
  }

  // Z方向法線の壁（+Z: dz=+1, -Z: dz=-1）をX軸に沿って1枚板マージ
  for (const dz of [1, -1]) {
    for (let z = 0; z < D; z++) {
      let x = 0;
      while (x < W) {
        const yTop = getOwnTopY(x, z);
        const nbTop = getPlatformTopY(x, z + dz);
        if (yTop <= nbTop) { x++; continue; }

        const yBot = state.noCarveMerge ? magmaY : nbTop;
        let run = 1;
        while (x + run < W) {
          const nTop = getOwnTopY(x + run, z);
          const nNb = getPlatformTopY(x + run, z + dz);
          if (nTop !== yTop || nTop <= nNb) break;
          if (!state.noCarveMerge && nNb !== nbTop) break;
          run++;
        }

        const x0 = x * S - halfW;
        const x1 = (x + run) * S - halfW;
        const wz = (dz === 1 ? (z + 1) : z) * S - halfD;
        if (dz === 1) {
          mesh.addQuad([x0, yBot, wz], [x1, yBot, wz], [x1, yTop, wz], [x0, yTop, wz], [0, 0, 1], underCol);
        } else {
          mesh.addQuad([x1, yBot, wz], [x0, yBot, wz], [x0, yTop, wz], [x1, yTop, wz], [0, 0, -1], underCol);
        }
        x += run;
      }
    }
  }

  // X方向法線の壁（+X: dx=+1, -X: dx=-1）をZ軸に沿って1枚板マージ
  for (const dx of [1, -1]) {
    for (let x = 0; x < W; x++) {
      let z = 0;
      while (z < D) {
        const yTop = getOwnTopY(x, z);
        const nbTop = getPlatformTopY(x + dx, z);
        if (yTop <= nbTop) { z++; continue; }

        const yBot = state.noCarveMerge ? magmaY : nbTop;
        let run = 1;
        while (z + run < D) {
          const nTop = getOwnTopY(x, z + run);
          const nNb = getPlatformTopY(x + dx, z + run);
          if (nTop !== yTop || nTop <= nNb) break;
          if (!state.noCarveMerge && nNb !== nbTop) break;
          run++;
        }

        const z0 = z * S - halfD;
        const z1 = (z + run) * S - halfD;
        const wx = (dx === 1 ? (x + 1) : x) * S - halfW;
        if (dx === 1) {
          mesh.addQuad([wx, yBot, z1], [wx, yBot, z0], [wx, yTop, z0], [wx, yTop, z1], [1, 0, 0], underCol);
        } else {
          mesh.addQuad([wx, yBot, z0], [wx, yBot, z1], [wx, yTop, z1], [wx, yTop, z0], [-1, 0, 0], underCol);
        }
        z += run;
      }
    }
  }
}

// --- C. 遮蔽物（大型Cube）の矩形統合（底面カリング済み・10ポリゴン/塊） ---
function addCoverBlocks(mesh, chunkId) {
  const { W, D, S, halfW, halfD } = getGridMetrics();
  const layerH = getLayerHeight();

  const pillarVisited = Array.from({ length: D }, () => new Uint8Array(W));
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      if (pillarVisited[z][x]) continue;
      const c = arena.grid[z][x];
      if (c.chunkId !== chunkId || c.type !== 'pillar' || c.obstacleH <= 0) continue;

      const baseH = c.height;
      const obsH = c.obstacleH;
      let w = 1;
      while (x + w < W && !pillarVisited[z][x + w]) {
        const nc = arena.grid[z][x + w];
        if (nc.chunkId !== chunkId || nc.type !== 'pillar' || nc.height !== baseH || nc.obstacleH !== obsH) break;
        w++;
      }
      let d = 1;
      outerP: while (z + d < D) {
        for (let dx = 0; dx < w; dx++) {
          if (pillarVisited[z + d][x + dx]) break outerP;
          const nc = arena.grid[z + d][x + dx];
          if (nc.chunkId !== chunkId || nc.type !== 'pillar' || nc.height !== baseH || nc.obstacleH !== obsH) break outerP;
        }
        d++;
      }
      for (let dz = 0; dz < d; dz++) {
        for (let dx = 0; dx < w; dx++) {
          pillarVisited[z + dz][x + dx] = 1;
        }
      }

      const x0 = x * S - halfW;
      const x1 = (x + w) * S - halfW;
      const z0 = z * S - halfD;
      const z1 = (z + d) * S - halfD;
      const y0 = baseH * layerH;
      const y1 = (baseH + obsH) * layerH;
      const pCol = new THREE.Color(getVoxelColor(obsH >= 2 ? VOX.PILLAR2 : VOX.PILLAR1));

      // 天面 + 4側面（底面は床に接するためカリング）
      mesh.addNoBottomBox(x0, x1, y0, y1, z0, z1, pCol);
    }
  }
}
