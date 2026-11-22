import { ColoredMeshBuilder, unifyWinding } from '../mesh/colored-mesh-builder.js';
import { carveRivers } from './hydrology-rivers.js';
import { state } from '../state.js';
import { clamp, lerpColor, shadeColor, smoothstep } from '../utils/math.js';
import { PerlinNoise2D, SeededRandom } from '../utils/random.js';

// =========================================================================
// 5. 単一浮島ジェネレーター (`FloatingTerrainBuilder.cs` 小島最適化 + 6近傍直結洞窟)
// =========================================================================
const EvenDX = [1, 0, -1, -1, -1, 0];
const EvenDZ = [0, 1, 1, 0, -1, -1];
const OddDX  = [1, 1, 0, -1, 0, 1];
const OddDZ  = [0, 1, 1, 0, -1, -1];

export function buildSingleIsland(islCfg, prevCfg, nextCfg, palette) {
    const ZStep = 0.8660254;
    const width = clamp(islCfg.width, 36, 120);
    const targetCell = clamp(islCfg.cellSize, 1.5, 3.5);
    const resolution = clamp(Math.round(width / targetCell), 22, 64);
    const cellSize = width / resolution;
    const half = width * 0.5;
    const cellZ = cellSize * ZStep;

    const nx = resolution + 1;
    const nzCells = (Math.round(resolution / ZStep) + 1) & ~1;
    const nz = nzCells + 1;
    const n = nx * nz;

    const r0 = new SeededRandom(islCfg.seed);
    const perlin = new PerlinNoise2D(islCfg.seed);
    const ox = islCfg.posX, oy = islCfg.posY, oz = islCfg.posZ;
    const bottomDepth = Math.max(8, width * (islCfg.bottomDepthRatio || 0.16));
    const cliffWidth = 0.095;

    // 6近傍千鳥格子の生成
    const baseXz = new Array(n);
    const xz = new Array(n);
    const maxJitter = 0.28;
    for (let iz = 0; iz < nz; iz++) {
        const rowOff = (iz & 1) === 1 ? 0.5 : 0.0;
        const bz = (iz - nzCells * 0.5) * cellZ;
        for (let ix = 0; ix < nx; ix++) {
            const i = iz * nx + ix;
            const bx = (ix + rowOff - resolution * 0.5 - 0.25) * cellSize;
            baseXz[i] = { x: bx, y: bz, z: bz };
            if (ix > 0 && iz > 0 && ix < nx - 1 && iz < nz - 1) {
                const ang = r0.next() * Math.PI * 2.0;
                const rad = Math.sqrt(r0.next()) * maxJitter * cellSize;
                const jx = bx + Math.cos(ang) * rad;
                const jz = bz + Math.sin(ang) * rad;
                xz[i] = { x: jx, y: jz, z: jz };
            } else {
                xz[i] = { x: bx, y: bz, z: bz };
            }
        }
    }

    function Pos(i, y) {
        const pt = xz[i] || { x: 0, z: 0 };
        return { x: pt.x + ox, y: y + oy, z: pt.z + oz };
    }

    function Nb(i, k) {
        const ix = i % nx;
        const iz = (i / nx) | 0;
        const odd = (iz & 1) === 1;
        const x = ix + (odd ? OddDX[k] : EvenDX[k]);
        const z = iz + (odd ? OddDZ[k] : EvenDZ[k]);
        if (x < 0 || z < 0 || x >= nx || z >= nz) return -1;
        return z * nx + x;
    }

    // ---- 1. BuildHeights (輪郭マスクと高さ配列の初期化) ----
    const H = new Float32Array(n);
    const mask = new Float32Array(n);
    const bottomY = new Float32Array(n);
    const inside = new Uint8Array(n);
    const mountain = new Float32Array(n);
    const rawM = new Float32Array(n);
    const outlineNoise = 0.20;

    for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {
            const i = iz * nx + ix;
            const px = xz[i].x / half;
            const pz = xz[i].z / half;
            const r = Math.hypot(px, pz);
            let raw = 1.0 - (r * 1.05 + (perlin.fbm(px, pz, 0, 1.3, 3) - 0.5) * 2.0 * outlineNoise);
            if (ix === 0 || iz === 0 || ix === nx - 1 || iz === nz - 1) raw = -1.0;
            rawM[i] = raw;
            inside[i] = raw > 0.0 ? 1 : 0;
            mask[i] = clamp(raw, 0.0, 1.0);
        }
    }

    // 外周のゼロ交差スナップ（一直線の筒状壁にならないよう、裾野を少し外側へ広げつつ岩の凹凸を持たせる）
    const cragStrength = islCfg.cliffCragginess !== undefined ? islCfg.cliffCragginess : 0.68;
    for (let iz = 0; iz < nz; iz++) {
        for (let ix = 0; ix < nx; ix++) {
            const i = iz * nx + ix;
            if (inside[i]) continue;
            let sx = 0, sz = 0, cnt = 0;
            const px = baseXz[i].x / half, pz = baseXz[i].z / half;
            const rimJag = (perlin.fbm(px * 2.1, pz * 2.1, 14, 1.8, 2) - 0.5) * 0.28 * cragStrength;
            for (let dz = -1; dz <= 1; dz++) {
                const nzIdx = iz + dz;
                if (nzIdx < 0 || nzIdx >= nz) continue;
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dz === 0) continue;
                    const nxIdx = ix + dx;
                    if (nxIdx < 0 || nxIdx >= nx) continue;
                    const nb = nzIdx * nx + nxIdx;
                    if (!inside[nb]) continue;
                    const baseT = clamp(rawM[nb] / (rawM[nb] - rawM[i]), 0.30, 0.72);
                    const t = clamp(baseT + rimJag, 0.24, 0.82);
                    sx += xz[nb].x + (xz[i].x - xz[nb].x) * t;
                    sz += xz[nb].z + (xz[i].z - xz[nb].z) * t;
                    cnt++;
                }
            }
            if (cnt > 0) {
                const nxz = sx / cnt, nzz = sz / cnt;
                xz[i] = { x: nxz, y: nzz, z: nzz };
            }
        }
    }

    const mtRad = (islCfg.mountainAngle || 30) * Math.PI / 180;
    const mtDirX = Math.cos(mtRad), mtDirZ = Math.sin(mtRad);
    const canyonDirX = -mtDirZ, canyonDirZ = mtDirX;
    const edgeSharpness = islCfg.edgeSharpness !== undefined ? islCfg.edgeSharpness : 0.85;

    for (let i = 0; i < n; i++) {
        if (!inside[i]) continue;
        const px = xz[i].x / half;
        const pz = xz[i].z / half;

        // 小島向けに緩やかな2〜3オクターブのドメインワープ
        const wx = px + (perlin.fbm(px, pz, 5, 1.1, 2) - 0.5) * 0.26;
        const wz = pz + (perlin.fbm(px + 7.3, pz - 3.1, 5, 1.1, 2) - 0.5) * 0.26;

        const broadPlains = perlin.fbm(wx, wz, 2, 1.25, 2) - 0.5;
        const rollingHills = perlin.fbm(wx + 3.1, wz - 2.3, 9, 1.6, 2) - 0.5;
        const gentlePlains = (broadPlains * 0.6 + rollingHills * 0.4) * 2.2 * islCfg.plainsAmp;

        // 山塊の配置：裾野(foothills)から山頂(peak)、さらに島の縁の岩壁まで自然に連続させる
        const sideProj = px * mtDirX + pz * mtDirZ;
        const mtNoise = perlin.fbm(wx * 0.85 + 0.2, wz * 0.85 - 0.15, 1, 1.0, 2);
        const mtRaw = mtNoise * 0.58 + (sideProj * 0.5 + 0.22) * 0.56;
        const mtMask = smoothstep(0.32, 0.72, mtRaw);
        mountain[i] = mtMask;

        const detail = perlin.fbm(wx, wz, 2, 1.75, 2);
        const ridge = 1.0 - Math.abs(2.0 * perlin.fbm(wx, wz, 3, 1.35, 2) - 1.0);
        const foothills = smoothstep(0.20, 0.52, mtRaw) * (islCfg.mountainAmp * 0.28);
        const peak = mtMask * (detail * islCfg.mountainAmp * 0.28 + Math.pow(ridge, 1.35) * islCfg.mountainAmp * 0.72);

        let h = islCfg.baseHeight + gentlePlains + foothills + peak;

        // 山塊の中央を割る自然な渓谷
        if (islCfg.canyonDepth > 0.1) {
            const across = px * canyonDirX + pz * canyonDirZ + (perlin.fbm(wx, wz, 4, 1.4, 2) - 0.5) * 0.24;
            const band = Math.abs(across);
            const cm = 1.0 - smoothstep(islCfg.canyonWidth * 0.35, islCfg.canyonWidth, band);
            const basinBoost = 1.0 + 0.35 * Math.exp(-Math.pow((sideProj - 0.22) / 0.25, 2));
            h -= cm * islCfg.canyonDepth * basinBoost * smoothstep(0.08, 0.38, mtMask);
        }

        h = Math.max(h, 2.2);
        const m = mask[i];
        // 崖縁付近に岩の稜線リブ（張り出し・窪み）を加え、垂直な円筒壁になるのを防ぐ
        const cliffRib = (1.0 - Math.abs(2.0 * perlin.fbm(px * 1.8, pz * 1.8, 12, 1.9, 2) - 1.0) - 0.45) * 2.8 * cragStrength * (1.0 - smoothstep(0.0, 0.32, m));
        const plainH = Math.max(2.0, islCfg.baseHeight + gentlePlains);
        const mtExtraH = Math.max(0.0, h - plainH);
        const minPlainRim = 0.32 + 0.32 * edgeSharpness;
        const cliffPlain = minPlainRim + (1.0 - minPlainRim) * Math.pow(clamp(m / (cliffWidth * 1.15), 0, 1), 0.48);
        const cliffMt = 0.20 + 0.80 * Math.pow(clamp(m / (cliffWidth * 1.95), 0, 1), 0.68);
        H[i] = Math.max(1.8, plainH * cliffPlain + mtExtraH * cliffMt + cliffRib);
    }

    // 下部岩盤と外周リムの構築：
    // 1) 水系計算前は外周 (!inside) を y=0 に保ち、水系・道計算後に呼ばれる際には水平な一直線シームを消すため外周リム高さを岩ノイズで上下に揺らす
    // 2) 下部岩盤 (bottomY) は丸いお椀型 (1 - exp) を廃止し、外周からすぐ内向きに絞られる角張った逆円錐＋鋭い岩稜ファセットにする
    const river = new Uint8Array(n);
    const halfW = Math.max(cellSize * 1.12, islCfg.riverWidth * 0.5);

    function rebuildRimAndUndersideProfile(applyRimUndulation = false) {
        for (let i = 0; i < n; i++) {
            const px = xz[i].x / half;
            const pz = xz[i].z / half;
            const rimWave = (perlin.fbm(px * 1.35 + 1.7, pz * 1.35 - 2.3, 11, 1.6, 2) - 0.5) * 2.0;
            const rimJag = (1.0 - Math.abs(2.0 * perlin.fbm(px * 2.3, pz * 2.3, 13, 2.0, 2) - 1.0) - 0.5) * 2.0;
            const localRimY = applyRimUndulation
                ? (islCfg.baseHeight * 0.15 + (rimWave * 3.2 + rimJag * 2.1) * cragStrength)
                : 0.0;

            if (!inside[i]) {
                if (!applyRimUndulation) {
                    H[i] = 0.0;
                    bottomY[i] = 0.0;
                } else {
                    let minInH = 1e9;
                    let touchesRiver = false;
                    const iz = (i / nx) | 0, ix = i % nx;
                    for (let dz = -1; dz <= 1; dz++) {
                        const nzIdx = iz + dz;
                        if (nzIdx < 0 || nzIdx >= nz) continue;
                        for (let dx = -1; dx <= 1; dx++) {
                            const nxIdx = ix + dx;
                            if (nxIdx < 0 || nxIdx >= nx) continue;
                            const nb = nzIdx * nx + nxIdx;
                            if (!inside[nb]) continue;
                            if (H[nb] < minInH) minInH = H[nb];
                            if (typeof river !== 'undefined' && river[nb]) touchesRiver = true;
                        }
                    }
                    if (minInH < 1e8) {
                        const maxAllowedRim = touchesRiver ? (minInH - 0.95) : (minInH - 1.25);
                        const rv = clamp(localRimY, -5.5, maxAllowedRim);
                        H[i] = rv;
                        bottomY[i] = rv;
                    } else {
                        H[i] = 0.0;
                        bottomY[i] = 0.0;
                    }
                }
                continue;
            }

            const m = clamp(mask[i], 0.0, 1.0);
            // 丸いお椀になる指数関数 (1 - exp) を廃止し、外周から直線〜鋭角に絞られる逆円錐・岩柱プロファイルにする
            const linearCone = Math.pow(m, 1.12);
            const ridgeA = 1.0 - Math.abs(2.0 * perlin.fbm(px * 1.1, pz * 1.1, 6, 1.45, 2) - 1.0);
            const ridgeB = 1.0 - Math.abs(2.0 * perlin.fbm(px * 1.8 - 3.1, pz * 1.8 + 1.9, 15, 1.85, 2) - 1.0);
            const cragSpike = Math.pow(ridgeA, 1.45) * 0.75 + Math.pow(ridgeB, 1.6) * 0.45;
            // 岩の段差（ステップ感）を少し混ぜて丸みを消す
            const rawFactor = linearCone * (0.52 + (0.48 + 0.55 * cragStrength) * cragSpike);
            const steps = 4.5;
            const steppedFactor = rawFactor * (1.0 - 0.22 * cragStrength) + (Math.round(rawFactor * steps) / steps) * (0.22 * cragStrength);
            const rimBlend = localRimY * Math.pow(Math.max(0.0, 1.0 - m * 1.35), 1.4);
            bottomY[i] = Math.min(H[i] - 0.8, rimBlend - bottomDepth * steppedFactor);
        }
    }
    rebuildRimAndUndersideProfile(false);

    function SafeBedFloor(i) {
        if (mask[i] < cliffWidth * 0.65) return 0.5;
        return Math.max(bottomY[i] + 2.5, -bottomDepth * 0.35);
    }

    // ---- 2. BuildHydrology (Priority-Flood 渓谷湖抽出 & 単一蛇行河川の掘り込み) ----
    const F = new Float32Array(n);
    const closed = new Uint8Array(n);
    const pq = [];
    function pqPush(val, idx) {
        pq.push({ val, idx });
        let c = pq.length - 1;
        while (c > 0) {
            const p = (c - 1) >> 1;
            if (pq[p].val <= pq[c].val) break;
            const tmp = pq[p]; pq[p] = pq[c]; pq[c] = tmp;
            c = p;
        }
    }
    function pqPop() {
        const top = pq[0];
        const last = pq.pop();
        if (pq.length > 0) {
            pq[0] = last;
            let c = 0;
            while (true) {
                let l = c * 2 + 1, r = l + 1, sm = c;
                if (l < pq.length && pq[l].val < pq[sm].val) sm = l;
                if (r < pq.length && pq[r].val < pq[sm].val) sm = r;
                if (sm === c) break;
                const tmp = pq[c]; pq[c] = pq[sm]; pq[sm] = tmp;
                c = sm;
            }
        }
        return top;
    }

    for (let i = 0; i < n; i++) {
        if (inside[i]) continue;
        closed[i] = 1;
        F[i] = H[i];
        for (let k = 0; k < 6; k++) {
            const nb = Nb(i, k);
            if (nb >= 0 && inside[nb]) {
                pqPush(F[i], i);
                break;
            }
        }
    }
    while (pq.length > 0) {
        const cur = pqPop();
        const c = cur.idx;
        for (let k = 0; k < 6; k++) {
            const nb = Nb(c, k);
            if (nb < 0 || closed[nb]) continue;
            closed[nb] = 1;
            F[nb] = Math.max(H[nb], F[c] + 0.0002);
            pqPush(F[nb], nb);
        }
    }

    // 窪地コンポーネントを抽出し、体積上位の maxLakes 個のみを渓谷湖にして残りは埋め戻す
    const dep = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        dep[i] = (inside[i] && (F[i] - H[i] > 0.04)) ? 1 : 0;
    }
    const visited = new Uint8Array(n);
    const candidates = [];
    for (let i = 0; i < n; i++) {
        if (!dep[i] || visited[i]) continue;
        const comp = [];
        const stack = [i];
        visited[i] = 1;
        let maxDepth = 0, sumVol = 0, minRimH = 1e9;
        while (stack.length > 0) {
            const c = stack.pop();
            comp.push(c);
            const d = F[c] - H[c];
            if (d > maxDepth) maxDepth = d;
            sumVol += d;
            for (let k = 0; k < 6; k++) {
                const nb = Nb(c, k);
                if (nb < 0) continue;
                if (dep[nb]) {
                    if (!visited[nb]) { visited[nb] = 1; stack.push(nb); }
                } else if (inside[nb]) {
                    if (H[nb] < minRimH) minRimH = H[nb];
                }
            }
        }
        candidates.push({ comp, maxDepth, sumVol, minRimH });
    }
    candidates.sort((a, b) => b.sumVol - a.sumVol);

    const lakeId = new Int32Array(n);
    const lakeLevels = [0];
    let keptLakes = 0;
    for (let ci = 0; ci < candidates.length; ci++) {
        const cand = candidates[ci];
        if (keptLakes < islCfg.maxLakes && cand.comp.length >= 4 && cand.maxDepth >= 0.45 && cand.minRimH < 1e8) {
            keptLakes++;
            const id = lakeLevels.length;
            const level = cand.minRimH;
            lakeLevels.push(level);
            for (const c of cand.comp) {
                lakeId[c] = id;
                const desiredY = level - Math.max(islCfg.riverDepth * 0.85, (level - H[c]) * 1.15);
                H[c] = clamp(desiredY, SafeBedFloor(c), level - 0.65);
            }
        } else {
            // 小さな水たまり窪地はすべて平坦に埋め戻し、島の水没を防ぐ
            for (const c of cand.comp) {
                H[c] = F[c];
            }
        }
    }

    // 雪線: 積雪帯では川を通さず、湖は凍らせる（Unity版の snowZone / snowBuffer / lakeFrozen 相当）
    const sharedWorldSnowLine = state.globalSnowLine !== undefined ? state.globalSnowLine : 32;
    const snowThresholdAt = (c) => {
        const px = xz[c].x / half, pz = xz[c].z / half;
        const jitter = (perlin.fbm(px * 2.2, pz * 2.2, 10, 1.6, 2) - 0.5) * 4.5;
        return sharedWorldSnowLine + 0.25 + jitter; // 雪ブレンドの中間点 (snowW = 0.5)
    };
    const lakeFrozen = [false];
    for (let lid = 1; lid < lakeLevels.length; lid++) {
        let cnt = 0, sumThr = 0;
        for (let c = 0; c < n; c++) {
            if (lakeId[c] !== lid) continue;
            cnt++;
            sumThr += snowThresholdAt(c);
        }
        if (cnt === 0) { lakeFrozen.push(false); continue; }
        const worldLevel = lakeLevels[lid] + oy;
        const avgThr = sumThr / cnt;
        // 小さな水たまりが単独で氷化して白い斑点にならないよう、小規模湖は雪線を厳密に見る
        lakeFrozen.push(cnt < 24
            ? (worldLevel >= avgThr && worldLevel >= sharedWorldSnowLine - 6.0)
            : (worldLevel >= avgThr - 2.5));
    }
    const isLakeFrozen = (lid) => lid > 0 && lid < lakeFrozen.length && lakeFrozen[lid];
    const snowZone = new Uint8Array(n);
    const snowBuffer = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        if (inside[i] && (H[i] + oy) >= snowThresholdAt(i) - 6.0) snowZone[i] = 1;
    }
    for (let i = 0; i < n; i++) {
        if (!inside[i]) continue;
        if (snowZone[i]) { snowBuffer[i] = 1; continue; }
        for (let k = 0; k < 6; k++) {
            const nb = Nb(i, k);
            if (nb >= 0 && snowZone[nb]) { snowBuffer[i] = 1; break; }
        }
    }

    // 河川ネットワークの生成と河道の彫り込み (Unity版 BuildHydrology の移植。hydrology-rivers.js)
    const centerRiver = new Uint8Array(n);
    const bankSlopeFlag = new Uint8Array(n);
    const riverW = new Float32Array(n).fill(NaN);
    const { riverCenterOrdered, riverPaths } = carveRivers({
        n, resolution, cellSize, half, cliffWidth, jitter: maxJitter, perlin, islCfg, Nb, SafeBedFloor,
        inside, H, mask, mountain, xz, baseXz, lakeId, lakeLevels, lakeFrozen,
        centerRiver, river, riverW, bankSlopeFlag, snowZone, snowBuffer
    });

    // 水辺距離フィールド (shore)
    const shore = new Float32Array(n);
    const distQueue = [];
    const waterDist = new Int16Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
        if (lakeId[i] > 0 || river[i]) {
            waterDist[i] = 0;
            distQueue.push(i);
        }
    }
    let qHead = 0;
    while (qHead < distQueue.length) {
        const c = distQueue[qHead++];
        if (waterDist[c] >= 4) continue;
        for (let k = 0; k < 6; k++) {
            const nb = Nb(c, k);
            if (nb < 0 || !inside[nb] || waterDist[nb] >= 0) continue;
            waterDist[nb] = waterDist[c] + 1;
            distQueue.push(nb);
        }
    }
    for (let i = 0; i < n; i++) {
        if (waterDist[i] >= 0) shore[i] = smoothstep(3.0, 0.0, waterDist[i]);
    }

    // 各頂点そのものの局所傾斜（周囲6近傍との最大高低差 / 距離）と、尾根曲率（周囲平均より高い凸稜線か）を計算
    const cellSteepness = new Float32Array(n);
    const ridgeCurv = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        if (!inside[i]) {
            cellSteepness[i] = 99.0;
            ridgeCurv[i] = 0.0;
            continue;
        }
        let maxLocalSlope = 0;
        let sumNbH = 0, nbCnt = 0;
        for (let k = 0; k < 6; k++) {
            const nb = Nb(i, k);
            if (nb < 0 || !inside[nb]) {
                maxLocalSlope = Math.max(maxLocalSlope, 2.0);
                continue;
            }
            const d = Math.hypot(xz[i].x - xz[nb].x, xz[i].z - xz[nb].z) || cellSize;
            const s = Math.abs(H[i] - H[nb]) / d;
            if (s > maxLocalSlope) maxLocalSlope = s;
            sumNbH += H[nb];
            nbCnt++;
        }
        cellSteepness[i] = maxLocalSlope;
        if (nbCnt > 0) {
            const diff = H[i] - (sumNbH / nbCnt);
            ridgeCurv[i] = clamp(diff / Math.max(0.8, cellSize * 0.45), -1.0, 1.0);
        }
    }

    // ---- 3. カスタム編集対応のルート・橋アンカー・等高線追従山道・6近傍直結洞窟トンネルの構築 ----
    function computeDefaultAnchors() {
        let enDir = { x: -0.54, z: 0.46 };
        if (prevCfg) {
            const dx = prevCfg.posX - ox, dz = prevCfg.posZ - oz;
            const len = Math.hypot(dx, dz) || 1;
            enDir = { x: (dx / len) * 0.62, z: (dz / len) * 0.62 };
        }
        let exDir = { x: 0.46, z: -0.54 };
        if (nextCfg) {
            const dx = nextCfg.posX - ox, dz = nextCfg.posZ - oz;
            const len = Math.hypot(dx, dz) || 1;
            exDir = { x: (dx / len) * 0.62, z: (dz / len) * 0.62 };
        }
        return { enDir, exDir };
    }

    const defAnchors = computeDefaultAnchors();
    if (!islCfg.entryNorm) islCfg.entryNorm = { x: defAnchors.enDir.x, z: defAnchors.enDir.z };
    if (!islCfg.exitNorm) islCfg.exitNorm = { x: defAnchors.exDir.x, z: defAnchors.exDir.z };
    if (!Array.isArray(islCfg.waypointsNorm)) {
        islCfg.waypointsNorm = [{
            x: (islCfg.entryNorm.x + islCfg.exitNorm.x) * 0.4 - mtDirX * 0.22,
            z: (islCfg.entryNorm.z + islCfg.exitNorm.z) * 0.4 - mtDirZ * 0.22
        }];
    }
    if (islCfg.hasTrail === undefined) islCfg.hasTrail = true;
    if (islCfg.hasInternalBridge === undefined) islCfg.hasInternalBridge = true;
    if (islCfg.hasBridgeToNext === undefined) islCfg.hasBridgeToNext = true;
    if (islCfg.trailBenchCut === undefined) islCfg.trailBenchCut = 0.78;
    if (islCfg.ridgeFlatten === undefined) islCfg.ridgeFlatten = 0.88;
    if (!islCfg.segmentTypes) islCfg.segmentTypes = {};
    if (islCfg.disabledSegments) {
        Object.keys(islCfg.disabledSegments).forEach(k => {
            if (islCfg.disabledSegments[k] && !islCfg.segmentTypes[k]) {
                islCfg.segmentTypes[k] = 'none';
            }
        });
        delete islCfg.disabledSegments;
    }
    if (!Array.isArray(islCfg.branches)) islCfg.branches = [];
    if (islCfg.entryNorm.yOffset === undefined) islCfg.entryNorm.yOffset = 0.0;
    if (islCfg.exitNorm.yOffset === undefined) islCfg.exitNorm.yOffset = 0.0;
    islCfg.waypointsNorm.forEach(wp => {
        if (wp.yOffset === undefined) wp.yOffset = 0.0;
    });

    function getSegMode(segKey) {
        const raw = islCfg.segmentTypes[segKey];
        if (raw === 'bridge' || raw === 'tunnel' || raw === 'none' || raw === 'trail') return raw;
        return 'trail';
    }

    // 指定したローカル座標 (tx, tz) と高さオフセット (yOffset) から、3次元ワールド座標と最近傍頂点を返す
    function resolveExactPointOnIsland(normX, normZ, yOffset = 0.0) {
        let tx = (normX || 0) * half;
        let tz = (normZ || 0) * half;
        let bestNode = -1, bestDistSq = 1e12;
        for (let i = 0; i < n; i++) {
            if (!inside[i]) continue;
            const dx = xz[i].x - tx, dz = xz[i].z - tz;
            const d2 = dx * dx + dz * dz;
            if (d2 < bestDistSq) {
                bestDistSq = d2;
                bestNode = i;
            }
        }
        if (bestNode < 0) bestNode = Math.floor(n / 2);

        let sumW = 0, sumY = 0;
        for (let i = 0; i < n; i++) {
            if (!inside[i]) continue;
            const dx = xz[i].x - tx, dz = xz[i].z - tz;
            const d = Math.hypot(dx, dz);
            if (d < cellSize * 1.45) {
                const w = 1.0 / (0.08 + d * d);
                sumW += w;
                sumY += H[i] * w;
            }
        }
        const exactLocalX = sumW > 0 ? clamp(tx, -half * 0.95, half * 0.95) : xz[bestNode].x;
        const exactLocalZ = sumW > 0 ? clamp(tz, -half * 0.95, half * 0.95) : xz[bestNode].z;
        const dxN = exactLocalX - xz[bestNode].x;
        const dzN = exactLocalZ - xz[bestNode].z;
        const dN = Math.hypot(dxN, dzN);
        const maxOff = cellSize * 0.55;
        const finalLX = dN > maxOff ? xz[bestNode].x + (dxN / dN) * maxOff : exactLocalX;
        const finalLZ = dN > maxOff ? xz[bestNode].z + (dzN / dN) * maxOff : exactLocalZ;
        const groundLY = sumW > 0 ? (sumY / sumW) : H[bestNode];
        const extraY = Number.isFinite(yOffset) ? yOffset : 0.0;
        const finalLY = groundLY + extraY;

        return {
            nodeIdx: bestNode,
            groundWorldY: groundLY + oy,
            yOffset: extraY,
            worldPos: { x: finalLX + ox, y: finalLY + oy, z: finalLZ + oz }
        };
    }

    // 任意の座標(lx, lz)での地表高・水・谷判定を行うヘルパー
    function sampleTerrainAtLocal(lx, lz) {
        let bestIdx = -1, bestD2 = 1e12;
        for (let i = 0; i < n; i++) {
            const dx = xz[i].x - lx, dz = xz[i].z - lz;
            const d2 = dx * dx + dz * dz;
            if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
        }
        return bestIdx;
    }

    // 2点間の直線上に地面の出っ張り（めり込み）がなく、本当に橋が必要な川または深い渓谷かを検証する
    function isValidBridgeSpan(aNode, bNode, hasRiverBetween) {
        if (aNode < 0 || aNode >= n || bNode < 0 || bNode >= n || aNode === bNode) return false;
        const ax = xz[aNode].x, az = xz[aNode].z, ay = H[aNode];
        const bx = xz[bNode].x, bz = xz[bNode].z, by = H[bNode];
        const dist = Math.hypot(bx - ax, bz - az);
        if (dist < cellSize * 1.1 || dist > half * 1.25) return false;
        if (!hasRiverBetween && Math.abs(ay - by) > 3.5) return false;

        const steps = Math.max(6, Math.ceil(dist / (cellSize * 0.5)));
        let maxDepthBelow = 0;
        for (let s = 1; s < steps; s++) {
            const t = s / steps;
            const sx = ax + (bx - ax) * t;
            const sz = az + (bz - az) * t;
            const lineY = ay + (by - ay) * t;
            const nearIdx = sampleTerrainAtLocal(sx, sz);
            if (nearIdx < 0 || !inside[nearIdx]) return false;
            if (!hasRiverBetween && H[nearIdx] > lineY - 0.15) return false;
            if (hasRiverBetween && !river[nearIdx] && !bankSlopeFlag[nearIdx] && H[nearIdx] > lineY + 0.6) return false;
            maxDepthBelow = Math.max(maxDepthBelow, Math.min(ay, by) - H[nearIdx]);
        }
        return hasRiverBetween ? (maxDepthBelow >= 0.35) : (maxDepthBelow >= 3.8);
    }

    const caveExcludedCenters = new Set();
    const portalApproachByCenter = new Map();
    const portalBoundaryEdgeKeys = new Set();
    const cavePortalRimVerts = new Uint8Array(n); // 1: 床敷居, 2: 壁・アーチ眉

    // 平原優先・山岳域では尾根筋（稜線）を優先して辿るA*経路探索
    function findGridPath(rawStartIdx, rawGoalIdx, allowWaterCross) {
        const startIdx = portalApproachByCenter.has(rawStartIdx) ? portalApproachByCenter.get(rawStartIdx) : rawStartIdx;
        const goalIdx = portalApproachByCenter.has(rawGoalIdx) ? portalApproachByCenter.get(rawGoalIdx) : rawGoalIdx;
        if (startIdx < 0 || goalIdx < 0 || startIdx === goalIdx) return [Math.max(0, startIdx)];
        const gScore = new Float32Array(n).fill(1e12);
        const fScore = new Float32Array(n).fill(1e12);
        const parent = new Int32Array(n).fill(-1);
        const inClosed = new Uint8Array(n);
        const isMountainTarget = (mountain[startIdx] > 0.18 || mountain[goalIdx] > 0.18 || Math.abs(H[goalIdx] - H[startIdx]) > 5.0);
        const ridgePref = islCfg.ridgeFlatten !== undefined ? islCfg.ridgeFlatten : 0.88;

        pq.length = 0;
        gScore[startIdx] = 0;
        const h0 = Math.hypot(xz[goalIdx].x - xz[startIdx].x, xz[goalIdx].z - xz[startIdx].z);
        fScore[startIdx] = h0;
        pqPush(h0, startIdx);

        while (pq.length > 0) {
            const cur = pqPop();
            const u = cur.idx;
            if (u === goalIdx) break;
            if (inClosed[u]) continue;
            inClosed[u] = 1;

            const prev = parent[u];
            let prevDx = 0, prevDz = 0;
            if (prev >= 0) {
                const pdx = xz[u].x - xz[prev].x, pdz = xz[u].z - xz[prev].z;
                const plen = Math.hypot(pdx, pdz) || 1;
                prevDx = pdx / plen; prevDz = pdz / plen;
            }

            for (let k = 0; k < 6; k++) {
                const nb = Nb(u, k);
                if (nb < 0 || !inside[nb] || inClosed[nb] || mask[nb] < cliffWidth * 1.15) continue;
                if (lakeId[nb] > 0 || (caveExcludedCenters.has(nb) && nb !== goalIdx)) continue;
                if (!allowWaterCross && river[nb]) continue;

                const stepDist = Math.hypot(xz[nb].x - xz[u].x, xz[nb].z - xz[u].z) || cellSize;
                const dy = Math.abs(H[nb] - H[u]);
                const grade = dy / stepDist;

                const onRidge = ridgeCurv[nb] > 0.04 ? clamp(ridgeCurv[nb] * 1.8, 0.0, 0.85) * ridgePref : 0.0;
                const steepRelief = 1.0 - onRidge * 0.72;

                let cost = stepDist * (1.0 + grade * grade * (isMountainTarget ? 9.5 : 14.0) * steepRelief);
                cost += cellSteepness[nb] * cellSteepness[nb] * stepDist * 6.0 * steepRelief;
                if (!isMountainTarget) {
                    cost += mountain[nb] * stepDist * 3.0;
                } else {
                    if (ridgeCurv[nb] < -0.05) cost += (-ridgeCurv[nb]) * stepDist * 5.5;
                    else if (onRidge > 0) cost *= (1.0 - onRidge * 0.35);
                }
                if (mask[nb] < 0.25) cost += (0.25 - mask[nb]) * stepDist * 12.0;
                if (river[nb]) cost += stepDist * 3.8;
                if (bankSlopeFlag[nb]) cost += stepDist * 1.8;

                if (prev >= 0) {
                    const ndx = (xz[nb].x - xz[u].x) / stepDist;
                    const ndz = (xz[nb].z - xz[u].z) / stepDist;
                    const dot = prevDx * ndx + prevDz * ndz;
                    if (dot < 0.7) cost += (0.7 - dot) * stepDist * 1.6;
                }

                const tentativeG = gScore[u] + cost;
                if (tentativeG < gScore[nb]) {
                    parent[nb] = u;
                    gScore[nb] = tentativeG;
                    const h = Math.hypot(xz[goalIdx].x - xz[nb].x, xz[goalIdx].z - xz[nb].z);
                    fScore[nb] = tentativeG + h;
                    pqPush(fScore[nb], nb);
                }
            }
        }

        const path = [];
        let cur = goalIdx;
        if (parent[cur] < 0 && cur !== startIdx) {
            return [startIdx, goalIdx];
        }
        while (cur >= 0) {
            path.push(cur);
            if (cur === startIdx) break;
            cur = parent[cur];
        }
        path.reverse();
        return path;
    }

    const entryResolved = resolveExactPointOnIsland(islCfg.entryNorm.x, islCfg.entryNorm.z, islCfg.entryNorm.yOffset);
    const exitResolved = resolveExactPointOnIsland(islCfg.exitNorm.x, islCfg.exitNorm.z, islCfg.exitNorm.yOffset);

    // 初回ビルド時：川を跨ぐ島（経由点が未設定かつ自動渡河橋がON）では、川の左右両岸を自動的に
    // 入口と出口の「真ん中の経由点（橋の始点・終点）」として順序通りに組み込む
    if (islCfg.hasInternalBridge !== false && !islCfg._autoBridgeInitialized && islCfg.waypointsNorm.length === 0 && riverCenterOrdered.length >= 2) {
        islCfg._autoBridgeInitialized = true;
        const probePath = findGridPath(entryResolved.nodeIdx, exitResolved.nodeIdx, true);
        if (probePath.length >= 4) {
            let idx = 0;
            while (idx < probePath.length - 1) {
                const u = probePath[idx];
                if (river[u] || bankSlopeFlag[u]) {
                    let bankStart = Math.max(0, idx - 1);
                    while (bankStart > 0 && (river[probePath[bankStart]] || bankSlopeFlag[probePath[bankStart]])) {
                        bankStart--;
                    }
                    let bankEnd = idx + 1;
                    while (bankEnd < probePath.length - 1 && (river[probePath[bankEnd]] || bankSlopeFlag[probePath[bankEnd]])) {
                        bankEnd++;
                    }
                    let crossesActualRiver = false;
                    for (let m = bankStart; m <= bankEnd; m++) {
                        if (river[probePath[m]]) { crossesActualRiver = true; break; }
                    }
                    const aNode = probePath[bankStart];
                    const bNode = probePath[bankEnd];
                    const spanDist = Math.hypot(xz[aNode].x - xz[bNode].x, xz[aNode].z - xz[bNode].z);
                    const maxAllowedInternalSpan = islCfg.riverWidth * 2.3 + cellSize * 2.2;
                    if (crossesActualRiver && aNode !== entryResolved.nodeIdx && bNode !== exitResolved.nodeIdx
                        && spanDist <= maxAllowedInternalSpan && Math.abs(H[aNode] - H[bNode]) <= 2.4
                        && isValidBridgeSpan(aNode, bNode, true)) {
                        islCfg.waypointsNorm = [
                            { x: Number((xz[aNode].x / half).toFixed(3)), z: Number((xz[aNode].z / half).toFixed(3)), yOffset: 0.0 },
                            { x: Number((xz[bNode].x / half).toFixed(3)), z: Number((xz[bNode].z / half).toFixed(3)), yOffset: 0.0 }
                        ];
                        islCfg.segmentTypes['seg_0'] = 'trail';
                        islCfg.segmentTypes['seg_1'] = 'bridge';
                        islCfg.segmentTypes['seg_2'] = 'trail';
                        break;
                    }
                    idx = bankEnd + 1;
                } else {
                    idx++;
                }
            }
        }
    } else {
        islCfg._autoBridgeInitialized = true;
    }

    const waypointResolved = islCfg.waypointsNorm.map(wp => resolveExactPointOnIsland(wp.x, wp.z, wp.yOffset || 0));
    const entryNode = entryResolved.nodeIdx;
    const exitNode = exitResolved.nodeIdx;
    const waypointNodes = waypointResolved.map(r => r.nodeIdx);
    const caveW = clamp(islCfg.caveWidth !== undefined ? islCfg.caveWidth : 3.2, 2.0, 5.5);
    const caveH = clamp(islCfg.caveHeight !== undefined ? islCfg.caveHeight : 2.8, 2.0, 5.0);

    // トンネルポータル用ヘルパー（6近傍リングが全て島内にある頂点へスナップし開口部を成形）
    function isValidCaveCenter(c) {
        if (c < 0 || !inside[c] || mask[c] < 0.12 || lakeId[c] > 0) return false;
        for (let k = 0; k < 6; k++) {
            const nb = Nb(c, k);
            if (nb < 0 || !inside[nb]) return false;
        }
        return true;
    }

    function findNearestValidCaveNodeFromNode(startNodeIdx, avoidSet = null) {
        if (isValidCaveCenter(startNodeIdx) && (!avoidSet || !avoidSet.has(startNodeIdx))) return startNodeIdx;
        const tx = xz[startNodeIdx].x, tz = xz[startNodeIdx].z;
        let bestNode = -1, bestD2 = 1e12;
        for (let i = 0; i < n; i++) {
            if (!isValidCaveCenter(i)) continue;
            if (avoidSet && avoidSet.has(i)) continue;
            const dx = xz[i].x - tx, dz = xz[i].z - tz;
            const d2 = dx * dx + dz * dz;
            if (d2 < bestD2) { bestD2 = d2; bestNode = i; }
        }
        return bestNode;
    }

    // トンネル進入方向 (inDir) を基準に、必ず「0:床左 → 1:床右 → 2:右壁 → 3:右天井 → 4:左天井 → 5:左壁」の順でリングを揃え、
    // 山肌のごつごつ感(cragStrength)に合わせた自然な非対称の岩の坑口へ成形する
    function shapePortalRing(centerIdx, oppositeIdx, targetLocalFloorY, userYOffset = 0.0) {
        const ring = [];
        for (let k = 0; k < 6; k++) ring.push(Nb(centerIdx, k));

        const cx = xz[centerIdx].x, cz = xz[centerIdx].z;
        const tx = xz[oppositeIdx].x, tz = xz[oppositeIdx].z;
        let inX = tx - cx, inZ = tz - cz;
        const inLen = Math.hypot(inX, inZ) || 1;
        inX /= inLen; inZ /= inLen;
        const outX = -inX, outZ = -inZ;
        const rightX = -inZ, rightZ = inX;

        // 外側 (outDir) に最も正面を向く辺を入口敷居 (Floor-Left 〜 Floor-Right) として選ぶ
        let bestK = 0, bestScore = -1e9;
        for (let k = 0; k < 6; k++) {
            const n0 = ring[k], n1 = ring[(k + 1) % 6];
            const mx = (xz[n0].x + xz[n1].x) * 0.5 - cx;
            const mz = (xz[n0].z + xz[n1].z) * 0.5 - cz;
            const mLen = Math.hypot(mx, mz) || 1;
            const align = (mx * outX + mz * outZ) / mLen;
            const score = align * 10.0 - (H[n0] + H[n1]) * 0.06;
            if (score > bestScore) { bestScore = score; bestK = k; }
        }

        // 敷居辺が必ず「左(0) → 右(1)」向きになるようリング巡回方向を正規化（ねじれ完全防止）
        const nA = ring[bestK], nB = ring[(bestK + 1) % 6];
        const edgeDotRight = (xz[nB].x - xz[nA].x) * rightX + (xz[nB].z - xz[nA].z) * rightZ;
        const archRing = [];
        if (edgeDotRight >= 0) {
            for (let k = 0; k < 6; k++) archRing.push(ring[(bestK + k) % 6]);
        } else {
            for (let k = 0; k < 6; k++) archRing.push(ring[(bestK + 1 - k + 6) % 6]);
        }

        // 急斜面で手前の敷居2頂点を持ち上げてベランダ状にせり出させないよう、元の敷居の標高を基準に床高を決定する
        const origH0 = H[archRing[0]];
        const origH1 = H[archRing[1]];
        const origLowThresh = Math.min(origH0, origH1);
        const origAvgThresh = (origH0 + origH1) * 0.5;
        const minSafeFloor = Math.max(1.6, bottomY[centerIdx] + 1.8);
        const naturalFloorY = Math.min(targetLocalFloorY - userYOffset, origAvgThresh + 0.12);
        const desiredFloorY = naturalFloorY + userYOffset;
        const maxNoJutFloor = Math.max(origLowThresh + 0.55, origAvgThresh + 0.20) + Math.max(0.0, userYOffset);
        const floorY = clamp(desiredFloorY, minSafeFloor, Math.min(Math.max(H[centerIdx] + 16.0, minSafeFloor + 2.0), maxNoJutFloor));

        // 坑口の6頂点が水平に寝すぎたり横壁がパックリ開きすぎないよう、地形メッシュ生成前に安全な範囲で XZ を正面アーチ形状へ微調整する
        const desiredHalfW = clamp(caveW * 0.54, cellSize * 0.62, cellSize * 1.18);
        const maxShift = cellSize * 0.30;
        const shiftVertSafely = (vIdx, dxS, dzS) => {
            if (cavePortalRimVerts[vIdx] > 0 || !inside[vIdx] || river[vIdx] || lakeId[vIdx] > 0) return;
            const sLen = Math.hypot(dxS, dzS);
            if (sLen < 1e-4) return;
            const scale = sLen > maxShift ? (maxShift / sLen) : 1.0;
            const nxz = xz[vIdx].x + dxS * scale;
            const nzz = xz[vIdx].z + dzS * scale;
            xz[vIdx] = { x: nxz, y: nzz, z: nzz };
        };
        // 天井眉 (3, 4) をわずかに手前へ起こして自然な洞窟の口にし、左右壁 (2, 5) の過度な横開きを抑える
        shiftVertSafely(archRing[3], outX * cellSize * 0.24, outZ * cellSize * 0.24);
        shiftVertSafely(archRing[4], outX * cellSize * 0.24, outZ * cellSize * 0.24);
        for (const [wIdx, sideSign] of [[archRing[2], 1], [archRing[5], -1]]) {
            const relX = xz[wIdx].x - cx, relZ = xz[wIdx].z - cz;
            const curLat = relX * rightX + relZ * rightZ;
            const targetLat = sideSign * desiredHalfW;
            const latDelta = clamp(targetLat - curLat, -cellSize * 0.28, cellSize * 0.28);
            shiftVertSafely(wIdx, rightX * latDelta, rightZ * latDelta);
        }

        // 山肌のノイズとゴツゴツ感を使って、左右非対称の自然な岩の坑口高さを決定（壁より天井が低くなる逆転・極端な縦スリットを防止）
        const cragBias = (idx, salt) => (perlin.fbm(xz[idx].x / half * 3.1, xz[idx].z / half * 3.1, salt, 2.2, 2) - 0.5) * 2.0 * cragStrength;
        const sillTilt = clamp((origH1 - origH0) * 0.25, -0.18, 0.18) * (0.4 + 0.6 * cragStrength);
        H[archRing[0]] = floorY - sillTilt;
        H[archRing[1]] = floorY + sillTilt;
        H[archRing[2]] = clamp(H[archRing[2]], floorY + caveH * (0.46 + cragBias(archRing[2], 3) * 0.12), floorY + caveH * (0.82 + cragBias(archRing[2], 4) * 0.12));
        H[archRing[5]] = clamp(H[archRing[5]], floorY + caveH * (0.46 + cragBias(archRing[5], 5) * 0.12), floorY + caveH * (0.82 + cragBias(archRing[5], 6) * 0.12));
        const minCeilR = Math.max(H[archRing[2]] + 0.38, floorY + caveH * (0.94 + cragBias(archRing[3], 7) * 0.14));
        const minCeilL = Math.max(H[archRing[5]] + 0.38, floorY + caveH * (0.94 + cragBias(archRing[4], 9) * 0.14));
        H[archRing[3]] = clamp(H[archRing[3]], minCeilR, Math.max(minCeilR + 0.25, floorY + caveH * (1.28 + cragBias(archRing[3], 8) * 0.16)));
        H[archRing[4]] = clamp(H[archRing[4]], minCeilL, Math.max(minCeilL + 0.25, floorY + caveH * (1.28 + cragBias(archRing[4], 10) * 0.16)));
        H[centerIdx] = floorY;

        // 坑口背後の土かぶりは確実に山体奥側 (dotIn > 0.38) かつ高低差が小さい頂点のみに限定し、周囲のせり出しを防止
        for (const browIdx of [archRing[3], archRing[4]]) {
            for (let k = 0; k < 6; k++) {
                const bnb = Nb(browIdx, k);
                if (bnb < 0 || !inside[bnb] || bnb === centerIdx || archRing.includes(bnb)) continue;
                if (river[bnb] || lakeId[bnb] > 0) continue;
                const dotIn = (xz[bnb].x - cx) * inX + (xz[bnb].z - cz) * inZ;
                const browCoverY = floorY + caveH * (0.85 + 0.22 * Math.max(0, cragBias(bnb, 11)));
                if (dotIn > 0.38 && H[bnb] < browCoverY && (browCoverY - H[bnb]) < 2.8) {
                    H[bnb] = browCoverY;
                }
            }
        }

        // 境界エッジを未分割テーブルに登録（地形の崖多段分割による隙間・背景透けを100%防止）
        for (let k = 0; k < 6; k++) {
            const u = archRing[k], v = archRing[(k + 1) % 6];
            const ek = u < v ? `${u}_${v}` : `${v}_${u}`;
            portalBoundaryEdgeKeys.add(ek);
            cavePortalRimVerts[u] = (k === 0 || k === 1) ? 1 : 2;
        }

        // 坑口手前のアプローチ頂点を登録（A*経路探索が坑口の正面から接続するようにする）
        const sillMidX = (xz[archRing[0]].x + xz[archRing[1]].x) * 0.5;
        const sillMidZ = (xz[archRing[0]].z + xz[archRing[1]].z) * 0.5;
        let approachNode = archRing[0];
        let bestAppScore = -1e9;
        for (const sIdx of [archRing[0], archRing[1]]) {
            for (let k = 0; k < 6; k++) {
                const nb = Nb(sIdx, k);
                if (nb < 0 || !inside[nb] || nb === centerIdx || archRing.includes(nb)) continue;
                if (river[nb] || lakeId[nb] > 0) continue;
                const dxA = xz[nb].x - sillMidX, dzA = xz[nb].z - sillMidZ;
                const dLen = Math.hypot(dxA, dzA) || 1;
                const align = (dxA * outX + dzA * outZ) / dLen;
                const score = align * 5.0 - Math.abs(H[nb] - floorY) * 0.4;
                if (score > bestAppScore) { bestAppScore = score; approachNode = nb; }
            }
        }
        portalApproachByCenter.set(centerIdx, approachNode);

        const sillMidWorld = {
            x: sillMidX + ox,
            y: floorY + oy,
            z: sillMidZ + oz
        };

        return {
            centerIdx,
            archRing,
            floorY,
            approachNode,
            sillMidWorld,
            inDirX: inX,
            inDirZ: inZ
        };
    }

    // ---- 3.1 本線と分岐道の全セグメント構築 ----
    const routeSegments = [];
    const waypointRoles = new Array(waypointResolved.length).fill('waypoint');
    const branchPointRoles = [];
    const resolvedBranches = [];

    const mainPoints = [entryResolved, ...waypointResolved, exitResolved];
    for (let i = 0; i < mainPoints.length - 1; i++) {
        const segKey = `seg_${i}`;
        const mode = getSegMode(segKey);
        if (i > 0) {
            if (mode === 'bridge') waypointRoles[i - 1] = 'bridgeStart';
            else if (mode === 'tunnel') waypointRoles[i - 1] = 'tunnelStart';
        }
        if (i < waypointResolved.length) {
            if (mode === 'bridge' && waypointRoles[i] === 'waypoint') waypointRoles[i] = 'bridgeEnd';
            else if (mode === 'tunnel' && waypointRoles[i] === 'waypoint') waypointRoles[i] = 'tunnelEnd';
        }
        routeSegments.push({
            segKey,
            mode,
            isBranch: false,
            fromResolved: mainPoints[i],
            toResolved: mainPoints[i + 1],
            nodes: []
        });
    }

    // 分岐道の全ポイントを事前解決
    const branchPointResolvedLists = [];
    for (let bIdx = 0; bIdx < islCfg.branches.length; bIdx++) {
        const br = islCfg.branches[bIdx];
        if (!Array.isArray(br.pointsNorm) || br.pointsNorm.length === 0) {
            br.pointsNorm = [{ x: 0.2, z: 0.3, yOffset: 0.0 }];
        }
        const ptsRes = br.pointsNorm.map(pt => resolveExactPointOnIsland(pt.x, pt.z, pt.yOffset || 0));
        branchPointResolvedLists.push(ptsRes);
        branchPointRoles.push(new Array(ptsRes.length).fill('branch'));
    }

    function resolveRouteRef(refStr, customNorm) {
        if (refStr === 'entry') return entryResolved;
        if (refStr === 'exit') return exitResolved;
        if (typeof refStr === 'string' && refStr.startsWith('wp_')) {
            const wi = parseInt(refStr.slice(3), 10);
            if (waypointResolved[wi]) return waypointResolved[wi];
        }
        if (typeof refStr === 'string' && refStr.startsWith('br_') && refStr.endsWith('_last')) {
            const bi = parseInt(refStr.slice(3, -5), 10);
            const list = branchPointResolvedLists[bi];
            if (list && list.length > 0) return list[list.length - 1];
        }
        if (refStr === 'custom' && customNorm) {
            return resolveExactPointOnIsland(customNorm.x, customNorm.z, customNorm.yOffset || 0);
        }
        return entryResolved;
    }

    for (let bIdx = 0; bIdx < islCfg.branches.length; bIdx++) {
        const br = islCfg.branches[bIdx];
        const ptsRes = branchPointResolvedLists[bIdx];
        const hasCustomStart = (br.fromRef === 'custom');
        const startRes = resolveRouteRef(br.fromRef || 'entry', br.startNorm || { x: 0, z: 0, yOffset: 0 });

        resolvedBranches.push({
            bIdx,
            hasCustomStart,
            startWorld: startRes.worldPos,
            startGroundY: startRes.groundWorldY,
            pointWorlds: ptsRes.map(r => r.worldPos),
            pointGroundYs: ptsRes.map(r => r.groundWorldY)
        });

        let prevRes = startRes;
        for (let ptIdx = 0; ptIdx < ptsRes.length; ptIdx++) {
            const segKey = `branch_${bIdx}_${ptIdx}`;
            const mode = getSegMode(segKey);
            if (ptIdx > 0) {
                if (mode === 'bridge') branchPointRoles[bIdx][ptIdx - 1] = 'bridgeStart';
                else if (mode === 'tunnel') branchPointRoles[bIdx][ptIdx - 1] = 'tunnelStart';
            }
            if (mode === 'bridge' && branchPointRoles[bIdx][ptIdx] === 'branch') branchPointRoles[bIdx][ptIdx] = 'bridgeEnd';
            else if (mode === 'tunnel' && branchPointRoles[bIdx][ptIdx] === 'branch') branchPointRoles[bIdx][ptIdx] = 'tunnelEnd';

            routeSegments.push({
                segKey,
                mode,
                isBranch: true,
                fromResolved: prevRes,
                toResolved: ptsRes[ptIdx],
                nodes: []
            });
            prevRes = ptsRes[ptIdx];
        }

        if (br.toRef && br.toRef !== 'none') {
            const mergeKey = `branch_${bIdx}_merge`;
            const mergeMode = getSegMode(mergeKey);
            const mergeRes = resolveRouteRef(br.toRef, null);
            const lastIdx = ptsRes.length - 1;
            if (mergeMode === 'bridge') branchPointRoles[bIdx][lastIdx] = 'bridgeStart';
            else if (mergeMode === 'tunnel') branchPointRoles[bIdx][lastIdx] = 'tunnelStart';
            routeSegments.push({
                segKey: mergeKey,
                mode: mergeMode,
                isBranch: true,
                fromResolved: prevRes,
                toResolved: mergeRes,
                nodes: []
            });
        }
    }

    // ---- 3.2 トンネル区間の坑口成形・山体土かぶり処理 ----
    const allTunnels = [];
    const tunnelCoverRock = new Float32Array(n);

    for (let si = 0; si < routeSegments.length; si++) {
        const segObj = routeSegments[si];
        if (segObj.mode !== 'tunnel') continue;

        const vEntry = findNearestValidCaveNodeFromNode(segObj.fromResolved.nodeIdx, caveExcludedCenters);
        if (vEntry < 0) continue;
        const avoidExit = new Set(caveExcludedCenters);
        avoidExit.add(vEntry);
        const vExit = findNearestValidCaveNodeFromNode(segObj.toResolved.nodeIdx, avoidExit);
        if (vExit < 0 || vExit === vEntry) continue;

        const targetFloorA = segObj.fromResolved.worldPos.y - oy;
        const targetFloorB = segObj.toResolved.worldPos.y - oy;
        const entryPortal = shapePortalRing(vEntry, vExit, targetFloorA, segObj.fromResolved.yOffset || 0);
        const exitPortal = shapePortalRing(vExit, vEntry, targetFloorB, segObj.toResolved.yOffset || 0);
        caveExcludedCenters.add(vEntry);
        caveExcludedCenters.add(vExit);

        // 接続する橋・道・ギズモ球を坑口敷居の中央へ揃える
        Object.assign(segObj.fromResolved.worldPos, entryPortal.sillMidWorld);
        Object.assign(segObj.toResolved.worldPos, exitPortal.sillMidWorld);

        const centerA = Pos(vEntry, entryPortal.floorY);
        const centerB = Pos(vExit, exitPortal.floorY);
        const dxT = centerB.x - centerA.x, dzT = centerB.z - centerA.z;
        const lenT = Math.hypot(dxT, dzT) || 1;
        const sideTX = -dzT / lenT, sideTZ = dxT / lenT;
        const curveT = islCfg.caveCurve !== undefined ? islCfg.caveCurve : 0.2;
        const sampleSteps = Math.max(8, Math.ceil(lenT / Math.max(1.2, cellSize * 0.7)));
        const centerlineWorld = [];
        for (let s = 0; s <= sampleSteps; s++) {
            const t = s / sampleSteps;
            const bend = Math.sin(t * Math.PI) * curveT * lenT * 0.22;
            centerlineWorld.push({
                t,
                x: centerA.x + dxT * t + sideTX * bend,
                y: centerA.y + (centerB.y - centerA.y) * t,
                z: centerA.z + dzT * t + sideTZ * bend
            });
        }

        // 浅い鞍部を通過する中間区間には、滑らかなカマボコ型ではなく山肌と同じ稜線ノイズ付きの岩屋根を被せる（坑口付近では0へ減衰させせり出し防止）
        const coverCoreW = caveW * 0.50;
        const coverOuterW = coverCoreW + cellSize * 0.95;
        for (let s = 1; s < sampleSteps; s++) {
            const cp = centerlineWorld[s];
            if (cp.t < 0.20 || cp.t > 0.80) continue;
            const endFade = smoothstep(0.20, 0.34, cp.t) * (1.0 - smoothstep(0.66, 0.80, cp.t));
            if (endFade <= 0.01) continue;
            const localX = cp.x - ox, localZ = cp.z - oz;
            const baseNeededH = (cp.y - oy) + caveH + 0.75;
            for (let i = 0; i < n; i++) {
                if (!inside[i] || river[i] || lakeId[i] > 0 || caveExcludedCenters.has(i) || cavePortalRimVerts[i] > 0) continue;
                const d = Math.hypot(xz[i].x - localX, xz[i].z - localZ);
                if (d >= coverOuterW) continue;
                const rNoise = 1.0 - Math.abs(2.0 * perlin.fbm(xz[i].x / half * 2.4, xz[i].z / half * 2.4, 3, 1.8, 2) - 1.0);
                const craggyRoofY = baseNeededH + (rNoise - 0.30) * 1.8 * cragStrength;
                if (H[i] < craggyRoofY && (craggyRoofY - H[i]) <= 3.4) {
                    const w = (d <= coverCoreW ? 1.0 : (1.0 - smoothstep(coverCoreW, coverOuterW, d))) * endFade;
                    const raised = H[i] + (craggyRoofY - H[i]) * w;
                    if (raised > H[i]) {
                        H[i] = raised;
                        tunnelCoverRock[i] = Math.max(tunnelCoverRock[i], w);
                    }
                }
            }
        }

        allTunnels.push({
            segKey: segObj.segKey,
            entryPortal,
            exitPortal,
            entryWorldPos: entryPortal.sillMidWorld,
            exitWorldPos: exitPortal.sillMidWorld,
            curve: curveT
        });
    }

    // ---- 3.3 島内橋の収集 & 道の経路探索・勾配緩和・切土テラス・尾根平坦化 ----
    const internalBridges = [];
    const trailWeight = new Float32Array(n);

    for (let si = 0; si < routeSegments.length; si++) {
        const segObj = routeSegments[si];
        if (segObj.mode === 'bridge') {
            const pA = segObj.fromResolved.worldPos;
            const pB = segObj.toResolved.worldPos;
            const dist = Math.hypot(pB.x - pA.x, pB.z - pA.z);
            internalBridges.push({
                start: pA,
                end: pB,
                startGroundY: segObj.fromResolved.groundWorldY,
                endGroundY: segObj.toResolved.groundWorldY,
                sag: clamp(dist * 0.032, 0.14, state.bridgeSag)
            });
        } else if (segObj.mode === 'trail' && islCfg.hasTrail !== false) {
            const nodes = findGridPath(segObj.fromResolved.nodeIdx, segObj.toResolved.nodeIdx, islCfg.hasInternalBridge !== false);
            segObj.nodes = nodes;

            // 自動渡河橋がONの場合、道が川を横断する箇所へ自動で小橋を架ける
            if (islCfg.hasInternalBridge !== false && nodes.length >= 4) {
                let idx = 0;
                while (idx < nodes.length - 1) {
                    const u = nodes[idx];
                    if (river[u] || bankSlopeFlag[u]) {
                        let bankStart = Math.max(0, idx - 1);
                        while (bankStart > 0 && (river[nodes[bankStart]] || bankSlopeFlag[nodes[bankStart]])) {
                            bankStart--;
                        }
                        let bankEnd = idx + 1;
                        while (bankEnd < nodes.length - 1 && (river[nodes[bankEnd]] || bankSlopeFlag[nodes[bankEnd]])) {
                            bankEnd++;
                        }
                        let crossesActualRiver = false;
                        for (let m = bankStart; m <= bankEnd; m++) {
                            if (river[nodes[m]]) { crossesActualRiver = true; break; }
                        }
                        const aNode = nodes[bankStart];
                        const bNode = nodes[bankEnd];
                        const spanDist = Math.hypot(xz[aNode].x - xz[bNode].x, xz[aNode].z - xz[bNode].z);
                        const maxAutoSpan = islCfg.riverWidth * 2.5 + cellSize * 2.5;
                        if (crossesActualRiver && spanDist <= maxAutoSpan && isValidBridgeSpan(aNode, bNode, true)) {
                            const sPos = Pos(aNode, H[aNode]);
                            const ePos = Pos(bNode, H[bNode]);
                            internalBridges.push({
                                start: sPos,
                                end: ePos,
                                startGroundY: sPos.y,
                                endGroundY: ePos.y,
                                sag: clamp(spanDist * 0.025, 0.12, 0.45)
                            });
                        }
                        idx = bankEnd + 1;
                    } else {
                        idx++;
                    }
                }
            }
        }
    }

    // 1. 道の縦断勾配緩和 & 距離フィールド構築
    const origPreTrailH = new Float32Array(H);
    const gradeSmooth = clamp(islCfg.trailGradeSmooth !== undefined ? islCfg.trailGradeSmooth : 0.65, 0.0, 0.95);
    const benchCut = clamp(islCfg.trailBenchCut !== undefined ? islCfg.trailBenchCut : 0.78, 0.0, 1.0);
    const ridgeFlatten = clamp(islCfg.ridgeFlatten !== undefined ? islCfg.ridgeFlatten : 0.88, 0.0, 1.0);
    const halfTrail = clamp(islCfg.trailWidth !== undefined ? islCfg.trailWidth : 1.0, 0.5, 2.2);
    const flatCoreW = Math.max(cellSize * 0.88, halfTrail * 1.35);
    const blendOuterW = flatCoreW + cellSize * 1.10;
    const roadNearestDist = new Float32Array(n).fill(1e9);
    const roadTargetYAtVert = new Float32Array(n);
    const roadIsRidgeAtVert = new Float32Array(n);

    for (let si = 0; si < routeSegments.length; si++) {
        const segObj = routeSegments[si];
        if (segObj.mode !== 'trail' || islCfg.hasTrail === false || segObj.nodes.length < 2) continue;

        const pathNodes = segObj.nodes;
        const targetRoadY = pathNodes.map(nd => origPreTrailH[nd]);
        const smoothIters = Math.round(gradeSmooth * 8);
        for (let iter = 0; iter < smoothIters; iter++) {
            const nextY = targetRoadY.slice();
            for (let s = 1; s < pathNodes.length - 1; s++) {
                const nd = pathNodes[s];
                if (river[nd] || bankSlopeFlag[nd] || lakeId[nd] > 0) continue;
                const avg = targetRoadY[s - 1] * 0.25 + targetRoadY[s] * 0.5 + targetRoadY[s + 1] * 0.25;
                // 平地が堤防状に盛り上がるのを防ぐため、元標高より上への持ち上げは最小限に制限
                nextY[s] = Math.min(origPreTrailH[nd] + 0.12, avg);
            }
            for (let s = 1; s < pathNodes.length - 1; s++) targetRoadY[s] = nextY[s];
        }

        // 尾根の尖ったピークを通る区間は頭をわずかに削って平坦な尾根道へ導く
        if (ridgeFlatten > 0.01) {
            for (let s = 1; s < pathNodes.length - 1; s++) {
                const nd = pathNodes[s];
                if (ridgeCurv[nd] > 0.12 && !river[nd] && lakeId[nd] === 0) {
                    targetRoadY[s] = Math.max(1.8, targetRoadY[s] - ridgeCurv[nd] * 0.55 * ridgeFlatten);
                }
            }
        }

        // 2. 各路面セグメントから周囲頂点への距離・目標路面高・尾根度を集計
        for (let s = 0; s < pathNodes.length - 1; s++) {
            const ia = pathNodes[s], ib = pathNodes[s + 1];
            if (river[ia] || river[ib] || lakeId[ia] > 0 || lakeId[ib] > 0) continue;
            const ax = xz[ia].x, az = xz[ia].z, ay = targetRoadY[s];
            const bx = xz[ib].x, bz = xz[ib].z, by = targetRoadY[s + 1];
            const vx = bx - ax, vz = bz - az;
            const lenSq = vx * vx + vz * vz || 1;
            // 単なる山腹の斜面で谷側を持ち上げてせり出させないよう、実際に凸の尾根 (ridgeCurv > 0) のみを尾根判定に使う
            const segRidgeFactor = Math.max(
                ridgeCurv[ia] > 0 ? ridgeCurv[ia] : 0,
                ridgeCurv[ib] > 0 ? ridgeCurv[ib] : 0
            );

            const minX = Math.min(ax, bx) - blendOuterW, maxX = Math.max(ax, bx) + blendOuterW;
            const minZ = Math.min(az, bz) - blendOuterW, maxZ = Math.max(az, bz) + blendOuterW;
            for (let i = 0; i < n; i++) {
                if (!inside[i] || river[i] || lakeId[i] > 0 || caveExcludedCenters.has(i) || cavePortalRimVerts[i] > 0) continue;
                const px = xz[i].x, pz = xz[i].z;
                if (px < minX || px > maxX || pz < minZ || pz > maxZ) continue;
                const t = clamp(((px - ax) * vx + (pz - az) * vz) / lenSq, 0, 1);
                const d = Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
                if (d >= blendOuterW) continue;
                const pathY = ay + (by - ay) * t;
                const tw = 1.0 - smoothstep(halfTrail * 0.72, halfTrail * 1.65, d);
                if (tw > trailWeight[i]) trailWeight[i] = tw;
                if (d < roadNearestDist[i]) {
                    roadNearestDist[i] = d;
                    roadTargetYAtVert[i] = pathY;
                    roadIsRidgeAtVert[i] = Math.max(segRidgeFactor, ridgeCurv[i] > 0 ? ridgeCurv[i] : 0);
                }
            }
        }
    }

    // 3. 尾根の平坦化（クレストカット＆路肩レベリング）および山腹切土の適用
    if (benchCut > 0.01 || ridgeFlatten > 0.01) {
        const portalNoLiftRadius = cellSize * 2.6;
        for (let i = 0; i < n; i++) {
            const d = roadNearestDist[i];
            if (d >= blendOuterW) continue;
            const pathY = roadTargetYAtVert[i];
            const origY = origPreTrailH[i];
            const terraceProfile = d <= flatCoreW ? 1.0 : (1.0 - smoothstep(flatCoreW, blendOuterW, d));
            const isTrueRidge = smoothstep(0.10, 0.36, roadIsRidgeAtVert[i]);

            if (origY >= pathY) {
                // 路面より高い尾根の頭・山側の斜面は、路面高 pathY まで削り込んで平らにする（切土）
                const cutRate = Math.max(benchCut, ridgeFlatten * isTrueRidge);
                const carvedY = Math.max(pathY, origY - 4.2);
                H[i] = Math.max(1.5, origY + (carvedY - origY) * terraceProfile * cutRate);
            } else if (isTrueRidge > 0.05 && ridgeFlatten > 0.01 && mask[i] > cliffWidth * 1.35) {
                // 坑口周辺では谷側の持ち上げ（せり出し）を禁止し、純粋な尾根筋のみ路肩レベリングを行う
                let nearPortal = false;
                for (let ti = 0; ti < allTunnels.length; ti++) {
                    const ePos = allTunnels[ti].entryWorldPos;
                    const xPos = allTunnels[ti].exitWorldPos;
                    const vx = xz[i].x + ox, vz = xz[i].z + oz;
                    if (Math.hypot(vx - ePos.x, vz - ePos.z) < portalNoLiftRadius ||
                        Math.hypot(vx - xPos.x, vz - xPos.z) < portalNoLiftRadius) {
                        nearPortal = true;
                        break;
                    }
                }
                if (!nearPortal) {
                    const shoulderSupport = terraceProfile * isTrueRidge * ridgeFlatten * 0.88;
                    const liftedY = Math.min(pathY, origY + 2.2);
                    H[i] = Math.max(1.5, origY + (liftedY - origY) * shoulderSupport);
                }
            }
        }
    }

    // 外周境界の崖高さと下部岩盤プロファイルを最新の H に同期（水平シームを消すリム揺らぎを有効化）
    rebuildRimAndUndersideProfile(true);

    // ---- 4. セル分割（6近傍トポロジー＆水路保護）・法線・距離場・バイオーム・頂点カラー計算 ----
    function CellTri(a, b, c, d, iz, t) {
        if ((iz & 1) === 0) {
            return t === 0 ? [a, c, b] : [b, c, d];
        } else {
            return t === 0 ? [a, c, d] : [a, d, b];
        }
    }

    function CellTriContour(a, b, c, d, iz, t) {
        // トンネル坑口周辺は厳密な6近傍分割を固定し、隙間を完全に防ぐ
        if (caveExcludedCenters.has(a) || caveExcludedCenters.has(b) || caveExcludedCenters.has(c) || caveExcludedCenters.has(d) ||
            cavePortalRimVerts[a] > 0 || cavePortalRimVerts[b] > 0 || cavePortalRimVerts[c] > 0 || cavePortalRimVerts[d] > 0) {
            return CellTri(a, b, c, d, iz, t);
        }
        const wa = river[a] || lakeId[a] > 0;
        const wb = river[b] || lakeId[b] > 0;
        const wc = river[c] || lakeId[c] > 0;
        const wd = river[d] || lakeId[d] > 0;
        // 水場セルでは必ず水面頂点同士を結ぶ対角線を選び、土手ポリゴンが川を横切って塞ぐのを防ぐ
        if (wa && wd && !wb && !wc) return t === 0 ? [a, c, d] : [a, d, b];
        if (wb && wc && !wa && !wd) return t === 0 ? [a, c, b] : [b, c, d];
        return CellTri(a, b, c, d, iz, t);
    }

    // 頂点法線 (vNormY) の算出
    const vNormX = new Float32Array(n);
    const vNormY = new Float32Array(n);
    const vNormZ = new Float32Array(n);
    for (let iz = 0; iz < nz - 1; iz++) {
        for (let ix = 0; ix < nx - 1; ix++) {
            const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
            for (let t = 0; t < 2; t++) {
                const [i0, i1, i2] = CellTriContour(a, b, c, d, iz, t);
                if (!(inside[i0] && inside[i1] && inside[i2])) continue;
                const ux = xz[i1].x - xz[i0].x, uy = H[i1] - H[i0], uz = xz[i1].z - xz[i0].z;
                const vx = xz[i2].x - xz[i0].x, vy = H[i2] - H[i0], vz = xz[i2].z - xz[i0].z;
                let nx0 = uy * vz - uz * vy;
                let ny0 = uz * vx - ux * vz;
                let nz0 = ux * vy - uy * vx;
                if (ny0 < 0) { nx0 = -nx0; ny0 = -ny0; nz0 = -nz0; }
                vNormX[i0] += nx0; vNormY[i0] += ny0; vNormZ[i0] += nz0;
                vNormX[i1] += nx0; vNormY[i1] += ny0; vNormZ[i1] += nz0;
                vNormX[i2] += nx0; vNormY[i2] += ny0; vNormZ[i2] += nz0;
            }
        }
    }
    for (let i = 0; i < n; i++) {
        const l = Math.hypot(vNormX[i], vNormY[i], vNormZ[i]);
        vNormY[i] = l > 1e-6 ? (vNormY[i] / l) : 1.0;
    }

    // 崖縁からの距離 (rimDist) と急斜面からの距離 (steepDist) のBFS計算
    const rimDist = new Float32Array(n).fill(1e6);
    const steepDist = new Float32Array(n).fill(1e6);
    const bfsQ = [];
    for (let i = 0; i < n; i++) {
        if (!inside[i]) {
            rimDist[i] = 0;
            bfsQ.push(i);
        }
    }
    let bHead = 0;
    while (bHead < bfsQ.length) {
        const u = bfsQ[bHead++];
        const dNext = rimDist[u] + cellSize;
        if (dNext > 32) continue;
        for (let k = 0; k < 6; k++) {
            const nb = Nb(u, k);
            if (nb < 0 || rimDist[nb] <= dNext) continue;
            rimDist[nb] = dNext;
            bfsQ.push(nb);
        }
    }

    bfsQ.length = 0;
    bHead = 0;
    for (let i = 0; i < n; i++) {
        if (!inside[i] || vNormY[i] < islCfg.rockSlope || cellSteepness[i] > 0.72) {
            steepDist[i] = 0;
            bfsQ.push(i);
        }
    }
    while (bHead < bfsQ.length) {
        const u = bfsQ[bHead++];
        const dNext = steepDist[u] + cellSize;
        if (dNext > 24) continue;
        for (let k = 0; k < 6; k++) {
            const nb = Nb(u, k);
            if (nb < 0 || steepDist[nb] <= dNext) continue;
            steepDist[nb] = dNext;
            bfsQ.push(nb);
        }
    }

    // バイオーム重み関数（森 / 草原 / 裸地芝）
    const forestSpread = clamp(islCfg.forestSpread !== undefined ? islCfg.forestSpread : 0.46, 0.0, 1.0);
    const meadowSpread = clamp(islCfg.meadowSpread !== undefined ? islCfg.meadowSpread : 0.45, 0.0, 1.0);
    const grassSlopeMargin = islCfg.grassSlopeMargin !== undefined ? islCfg.grassSlopeMargin : 1.2;
    const sharedWorldGreeneryLine = sharedWorldSnowLine - 5.0;

    function BiomeWeights(lx, lz) {
        const bx = lx / Math.max(18.0, half);
        const bz = lz / Math.max(18.0, half);
        const fNoise = perlin.fbm(bx * 1.4 + 2.1, bz * 1.4 - 1.7, 7, 1.2, 2);
        const mNoise = perlin.fbm(bx * 1.5 - 3.3, bz * 1.5 + 2.8, 8, 1.2, 2);
        const fThr = 1.0 - forestSpread;
        const mThr = 1.0 - meadowSpread;
        const forest = forestSpread > 0.01 ? smoothstep(fThr - 0.16, fThr + 0.16, fNoise) : 0.0;
        const meadowRaw = meadowSpread > 0.01 ? smoothstep(mThr - 0.16, mThr + 0.16, mNoise) : 0.0;
        const meadow = meadowRaw * (1.0 - forest * 0.72);
        const bare = Math.max(0.0, 1.0 - forest - meadow);
        return { forest, meadow, bare };
    }

    // 頂点カラー配列の生成（崖と底面の外周リムで色がパッキリ分かれないよう中間岩色で連続させる）
    const topCols = new Array(n);
    const underCols = new Array(n);
    const rimRockCol = lerpColor(palette.rock, palette.under, 0.44);

    for (let i = 0; i < n; i++) {
        if (!inside[i]) {
            topCols[i] = rimRockCol;
            underCols[i] = rimRockCol;
            continue;
        }
        const bw = BiomeWeights(xz[i].x, xz[i].z);
        const worldY = H[i] + oy;
        const px = xz[i].x / half, pz = xz[i].z / half;
        const snowJitter = (perlin.fbm(px * 2.2, pz * 2.2, 10, 1.6, 2) - 0.5) * 4.5;

        let col = lerpColor(palette.grass, palette.forest, bw.forest * 0.78);

        // 水辺・川底・土手・山道の砂色ブレンド
        const sandW = Math.max(shore[i] * 0.85, trailWeight[i] * 0.92);
        if (sandW > 0.01) {
            col = lerpColor(col, palette.sand, clamp(sandW, 0, 1));
        }
        if (river[i] || lakeId[i] > 0) {
            col = lerpColor(palette.sand, palette.rock, 0.35);
        }

        // 傾斜・高標高・トンネル屋根に基づく岩肌ブレンド
        const slopeRock = smoothstep(islCfg.rockSlope + 0.06, islCfg.rockSlope - 0.08, vNormY[i]);
        const altRock = smoothstep(sharedWorldGreeneryLine - 2.5, sharedWorldGreeneryLine + 3.5, worldY) * (0.45 + 0.55 * mountain[i]);
        const rockW = clamp(Math.max(slopeRock, altRock, tunnelCoverRock[i] * 0.95), 0, 1);
        if (rockW > 0.01) {
            col = lerpColor(col, palette.rock, rockW);
        }

        // 雪線以上の雪ブレンド
        const snowW = smoothstep(sharedWorldSnowLine - 2.5 + snowJitter, sharedWorldSnowLine + 3.0 + snowJitter, worldY)
            * smoothstep(0.42, 0.68, vNormY[i]);
        if (snowW > 0.01) {
            col = lerpColor(col, palette.snow, snowW);
        }

        topCols[i] = col;
        underCols[i] = lerpColor(rimRockCol, palette.under, smoothstep(0.02, 0.34, mask[i]));
    }

    // ---- 5. BuildTerrainMesh (上面・多段ゴツゴツ岩壁崖・荒いローポリ下部岩盤) ----
    const terrainMb = new ColoredMeshBuilder();
    const cr = new SeededRandom(islCfg.seed + 31);
    const upVec = { x: 0, y: 1, z: 0 };
    const downVec = { x: 0, y: -1, z: 0 };

    // 外周の縦崖エッジを3段へ多段分割し、外側・横方向へランダムに張り出す3D岩肌チェーンをキャッシュ共有（完全防水）
    const cliffSteps = 3;
    const cliffEdgeChains = new Map();
    function getOrCreateCliffEdgeChain(inIdx, outIdx) {
        const key = `${inIdx}_${outIdx}`;
        if (cliffEdgeChains.has(key)) return cliffEdgeChains.get(key);

        const pTop = Pos(inIdx, H[inIdx]);
        const pBot = Pos(outIdx, H[outIdx]);
        const chain = [pTop];
        const ek = inIdx < outIdx ? `${inIdx}_${outIdx}` : `${outIdx}_${inIdx}`;
        const skipCrag = portalBoundaryEdgeKeys.has(ek) || river[inIdx] || !Number.isNaN(riverW[inIdx]);

        const dx = pBot.x - pTop.x;
        const dy = pBot.y - pTop.y;
        const dz = pBot.z - pTop.z;
        const hLen = Math.hypot(dx, dz) || 1;
        const outX = dx / hLen;
        const outZ = dz / hLen;
        const sideX = -outZ;
        const sideZ = outX;

        for (let s = 1; s < cliffSteps; s++) {
            const t = s / cliffSteps;
            let px = pTop.x + dx * t;
            let py = pTop.y + dy * t;
            let pz = pTop.z + dz * t;
            if (!skipCrag && cragStrength > 0.01) {
                const env = Math.sin(t * Math.PI);
                const nxS = (px - ox) / half * 2.4;
                const nzS = (pz - oz) / half * 2.4;
                const nOut = (perlin.fbm(nxS + s * 1.7, nzS - s * 1.3, 12, 2.0, 2) - 0.48) * 2.0;
                const nSide = (perlin.fbm(nxS - s * 2.1, nzS + s * 1.9, 13, 2.0, 2) - 0.5) * 2.0;
                const bulge = nOut * cellSize * 0.34 * cragStrength * env;
                const shift = nSide * cellSize * 0.22 * cragStrength * env;
                const yJit = (nOut * 0.35 - nSide * 0.25) * cragStrength * env;
                px += outX * bulge + sideX * shift;
                pz += outZ * bulge + sideZ * shift;
                py += yJit;
            }
            chain.push({ x: px, y: py, z: pz });
        }
        chain.push(pBot);
        cliffEdgeChains.set(key, chain);
        return chain;
    }

    // 上面地形および外周の多段ゴツゴツ岩壁メッシュを生成
    for (let iz = 0; iz < nz - 1; iz++) {
        for (let ix = 0; ix < nx - 1; ix++) {
            const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
            if (!(inside[a] || inside[b] || inside[c] || inside[d])) continue;
            for (let t = 0; t < 2; t++) {
                const [i0, i1, i2] = CellTriContour(a, b, c, d, iz, t);
                const in0 = inside[i0], in1 = inside[i1], in2 = inside[i2];
                const inCnt = in0 + in1 + in2;
                if (inCnt === 0) continue;
                if (caveExcludedCenters.has(i0) || caveExcludedCenters.has(i1) || caveExcludedCenters.has(i2)) continue;

                if (inCnt === 3) {
                    const j = cr.range(-0.045, 0.045);
                    terrainMb.tri(
                        Pos(i0, H[i0]), Pos(i1, H[i1]), Pos(i2, H[i2]),
                        shadeColor(topCols[i0], j), shadeColor(topCols[i1], j), shadeColor(topCols[i2], j),
                        upVec, 1.0
                    );
                } else if (inCnt === 1) {
                    let vIn, vO1, vO2;
                    if (in0) { vIn = i0; vO1 = i1; vO2 = i2; }
                    else if (in1) { vIn = i1; vO1 = i2; vO2 = i0; }
                    else { vIn = i2; vO1 = i0; vO2 = i1; }

                    const ch1 = getOrCreateCliffEdgeChain(vIn, vO1);
                    const ch2 = getOrCreateCliffEdgeChain(vIn, vO2);
                    const pTop = ch1[0];
                    const pO1 = ch1[cliffSteps], pO2 = ch2[cliffSteps];
                    const oxDir = (pO1.x + pO2.x) * 0.5 - pTop.x;
                    const ozDir = (pO1.z + pO2.z) * 0.5 - pTop.z;
                    const oLen = Math.hypot(oxDir, ozDir) || 1;
                    const outDir = { x: oxDir / oLen, y: 0.28, z: ozDir / oLen };

                    const colTop = lerpColor(topCols[vIn], palette.rock, 0.78);
                    const colBot1 = topCols[vO1];
                    const colBot2 = topCols[vO2];

                    const j0 = cr.range(-0.075, 0.075);
                    const cMid1 = lerpColor(colTop, colBot1, 1 / cliffSteps);
                    const cMid2 = lerpColor(colTop, colBot2, 1 / cliffSteps);
                    terrainMb.tri(
                        pTop, ch1[1], ch2[1],
                        shadeColor(colTop, j0), shadeColor(cMid1, j0), shadeColor(cMid2, j0),
                        outDir, 0.0
                    );
                    for (let s = 1; s < cliffSteps; s++) {
                        const tA = s / cliffSteps, tB = (s + 1) / cliffSteps;
                        const c1A = lerpColor(colTop, colBot1, tA);
                        const c2A = lerpColor(colTop, colBot2, tA);
                        const c1B = lerpColor(colTop, colBot1, tB);
                        const c2B = lerpColor(colTop, colBot2, tB);
                        const jA = cr.range(-0.075, 0.075);
                        const jB = cr.range(-0.075, 0.075);
                        terrainMb.tri(
                            ch1[s], ch1[s + 1], ch2[s + 1],
                            shadeColor(c1A, jA), shadeColor(c1B, jA), shadeColor(c2B, jA),
                            outDir, 0.0
                        );
                        terrainMb.tri(
                            ch1[s], ch2[s + 1], ch2[s],
                            shadeColor(c1A, jB), shadeColor(c2B, jB), shadeColor(c2A, jB),
                            outDir, 0.0
                        );
                    }
                } else if (inCnt === 2) {
                    let vI1, vI2, vOut;
                    if (!in0) { vOut = i0; vI1 = i1; vI2 = i2; }
                    else if (!in1) { vOut = i1; vI1 = i2; vI2 = i0; }
                    else { vOut = i2; vI1 = i0; vI2 = i1; }

                    const ch1 = getOrCreateCliffEdgeChain(vI1, vOut);
                    const ch2 = getOrCreateCliffEdgeChain(vI2, vOut);
                    const pOut = ch1[cliffSteps];
                    const oxDir = pOut.x - (ch1[0].x + ch2[0].x) * 0.5;
                    const ozDir = pOut.z - (ch1[0].z + ch2[0].z) * 0.5;
                    const oLen = Math.hypot(oxDir, ozDir) || 1;
                    const outDir = { x: oxDir / oLen, y: 0.28, z: ozDir / oLen };

                    const colTop1 = lerpColor(topCols[vI1], palette.rock, 0.78);
                    const colTop2 = lerpColor(topCols[vI2], palette.rock, 0.78);
                    const colBot = topCols[vOut];

                    for (let s = 0; s < cliffSteps - 1; s++) {
                        const tA = s / cliffSteps, tB = (s + 1) / cliffSteps;
                        const c1A = lerpColor(colTop1, colBot, tA);
                        const c2A = lerpColor(colTop2, colBot, tA);
                        const c1B = lerpColor(colTop1, colBot, tB);
                        const c2B = lerpColor(colTop2, colBot, tB);
                        const jA = cr.range(-0.075, 0.075);
                        const jB = cr.range(-0.075, 0.075);
                        terrainMb.tri(
                            ch1[s], ch1[s + 1], ch2[s + 1],
                            shadeColor(c1A, jA), shadeColor(c1B, jA), shadeColor(c2B, jA),
                            outDir, 0.0
                        );
                        terrainMb.tri(
                            ch1[s], ch2[s + 1], ch2[s],
                            shadeColor(c1A, jB), shadeColor(c2B, jB), shadeColor(c2A, jB),
                            outDir, 0.0
                        );
                    }
                    const tLast = (cliffSteps - 1) / cliffSteps;
                    const c1L = lerpColor(colTop1, colBot, tLast);
                    const c2L = lerpColor(colTop2, colBot, tLast);
                    const jL = cr.range(-0.075, 0.075);
                    terrainMb.tri(
                        ch1[cliffSteps - 1], pOut, ch2[cliffSteps - 1],
                        shadeColor(c1L, jL), shadeColor(colBot, jL), shadeColor(c2L, jL),
                        outDir, 0.0
                    );
                }
            }
        }
    }

    // ---- 5.5 荒いローポリ下部岩盤 (2x2粗分割＋境界1x1シームレス接続) ----
    const nbx = Math.floor((nx - 1) / 2);
    const nbz = Math.floor((nz - 1) / 2);
    const isCoarseBlock = new Uint8Array(nbx * nbz);
    for (let bz = 0; bz < nbz; bz++) {
        const iz0 = bz * 2;
        for (let bx = 0; bx < nbx; bx++) {
            const ix0 = bx * 2;
            let allIn = true;
            for (let dz = 0; dz <= 2 && allIn; dz++) {
                for (let dx = 0; dx <= 2; dx++) {
                    if (!inside[(iz0 + dz) * nx + (ix0 + dx)]) {
                        allIn = false;
                        break;
                    }
                }
            }
            if (allIn) isCoarseBlock[bz * nbx + bx] = 1;
        }
    }
    const blockIsCoarse = (bx, bz) => (
        bx >= 0 && bz >= 0 && bx < nbx && bz < nbz && isCoarseBlock[bz * nbx + bx] === 1
    );

    for (let bz = 0; bz < nbz; bz++) {
        const iz0 = bz * 2;
        for (let bx = 0; bx < nbx; bx++) {
            if (!blockIsCoarse(bx, bz)) continue;
            const ix0 = bx * 2;
            const v00 = iz0 * nx + ix0, v10 = v00 + 1, v20 = v00 + 2;
            const v01 = (iz0 + 1) * nx + ix0, v11 = v01 + 1, v21 = v01 + 2;
            const v02 = (iz0 + 2) * nx + ix0, v12 = v02 + 1, v22 = v02 + 2;

            const cTop = blockIsCoarse(bx, bz - 1);
            const cRight = blockIsCoarse(bx + 1, bz);
            const cBot = blockIsCoarse(bx, bz + 1);
            const cLeft = blockIsCoarse(bx - 1, bz);

            if (cTop && cRight && cBot && cLeft) {
                const jA = cr.range(-0.08, 0.08);
                const jB = cr.range(-0.08, 0.08);
                if (((bx + bz) & 1) === 0) {
                    terrainMb.tri(
                        Pos(v00, bottomY[v00]), Pos(v22, bottomY[v22]), Pos(v20, bottomY[v20]),
                        shadeColor(underCols[v00], jA), shadeColor(underCols[v22], jA), shadeColor(underCols[v20], jA),
                        downVec, 0.0
                    );
                    terrainMb.tri(
                        Pos(v00, bottomY[v00]), Pos(v02, bottomY[v02]), Pos(v22, bottomY[v22]),
                        shadeColor(underCols[v00], jB), shadeColor(underCols[v02], jB), shadeColor(underCols[v22], jB),
                        downVec, 0.0
                    );
                } else {
                    terrainMb.tri(
                        Pos(v00, bottomY[v00]), Pos(v02, bottomY[v02]), Pos(v20, bottomY[v20]),
                        shadeColor(underCols[v00], jA), shadeColor(underCols[v02], jA), shadeColor(underCols[v20], jA),
                        downVec, 0.0
                    );
                    terrainMb.tri(
                        Pos(v20, bottomY[v20]), Pos(v02, bottomY[v02]), Pos(v22, bottomY[v22]),
                        shadeColor(underCols[v20], jB), shadeColor(underCols[v02], jB), shadeColor(underCols[v22], jB),
                        downVec, 0.0
                    );
                }
            } else {
                const perim = [v00];
                if (!cTop) perim.push(v10);
                perim.push(v20);
                if (!cRight) perim.push(v21);
                perim.push(v22);
                if (!cBot) perim.push(v12);
                perim.push(v02);
                if (!cLeft) perim.push(v01);
                const pCenter = Pos(v11, bottomY[v11]);
                for (let k = 0; k < perim.length; k++) {
                    const u = perim[k];
                    const v = perim[(k + 1) % perim.length];
                    const j = cr.range(-0.08, 0.08);
                    terrainMb.tri(
                        pCenter, Pos(v, bottomY[v]), Pos(u, bottomY[u]),
                        shadeColor(underCols[v11], j), shadeColor(underCols[v], j), shadeColor(underCols[u], j),
                        downVec, 0.0
                    );
                }
            }
        }
    }

    for (let iz = 0; iz < nz - 1; iz++) {
        const bz = iz >> 1;
        for (let ix = 0; ix < nx - 1; ix++) {
            const bx = ix >> 1;
            if (blockIsCoarse(bx, bz)) continue;
            const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
            if (!(inside[a] || inside[b] || inside[c] || inside[d])) continue;
            for (let t = 0; t < 2; t++) {
                const [i0, i1, i2] = CellTriContour(a, b, c, d, iz, t);
                if (!(inside[i0] || inside[i1] || inside[i2])) continue;
                const j = cr.range(-0.07, 0.07);
                terrainMb.tri(
                    Pos(i0, bottomY[i0]), Pos(i2, bottomY[i2]), Pos(i1, bottomY[i1]),
                    shadeColor(underCols[i0], j), shadeColor(underCols[i2], j), shadeColor(underCols[i1], j),
                    downVec, 0.0
                );
            }
        }
    }

    // 6近傍リング直結＋山肌同調ゴツゴツ岩洞窟トンネルメッシュ（完全防水溶接・斜め移行カラーリング・3分割ゴツゴツ岩床・奥行AO・露出岩外殻）
    const tunnelCurveBySegKey = new Map();
    const RING_VERTS = 8; // 0:床左端, 1:床左中央, 2:床右中央, 3:床右端, 4:右壁, 5:右天井, 6:左天井, 7:左壁
    for (let tIdx = 0; tIdx < allTunnels.length; tIdx++) {
        const tun = allTunnels[tIdx];
        const rAIdx = tun.entryPortal.archRing;
        const rBIdxRaw = tun.exitPortal.archRing;
        const rA6 = rAIdx.map(idx => Pos(idx, H[idx]));
        const rB_raw = rBIdxRaw.map(idx => Pos(idx, H[idx]));
        const rB6 = [rB_raw[1], rB_raw[0], rB_raw[5], rB_raw[4], rB_raw[3], rB_raw[2]];
        const rA6Cols = rAIdx.map(idx => topCols[idx]);
        const rB6Cols = [
            topCols[rBIdxRaw[1]], topCols[rBIdxRaw[0]], topCols[rBIdxRaw[5]],
            topCols[rBIdxRaw[4]], topCols[rBIdxRaw[3]], topCols[rBIdxRaw[2]]
        ];

        // 坑口敷居エッジ(0-1)を3等分して8頂点化（地形メッシュの敷居エッジと厳密一致させ隙間ゼロのまま3分割のゴツゴツ岩床へ接続）
        const lerpPt = (p, q, u) => ({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u, z: p.z + (q.z - p.z) * u });
        const rA = [rA6[0], lerpPt(rA6[0], rA6[1], 1 / 3), lerpPt(rA6[0], rA6[1], 2 / 3), rA6[1], rA6[2], rA6[3], rA6[4], rA6[5]];
        const rB = [rB6[0], lerpPt(rB6[0], rB6[1], 1 / 3), lerpPt(rB6[0], rB6[1], 2 / 3), rB6[1], rB6[2], rB6[3], rB6[4], rB6[5]];
        const rACols = [rA6Cols[0], lerpColor(rA6Cols[0], rA6Cols[1], 1 / 3), lerpColor(rA6Cols[0], rA6Cols[1], 2 / 3), rA6Cols[1], rA6Cols[2], rA6Cols[3], rA6Cols[4], rA6Cols[5]];
        const rBCols = [rB6Cols[0], lerpColor(rB6Cols[0], rB6Cols[1], 1 / 3), lerpColor(rB6Cols[0], rB6Cols[1], 2 / 3), rB6Cols[1], rB6Cols[2], rB6Cols[3], rB6Cols[4], rB6Cols[5]];

        const centerA = Pos(tun.entryPortal.centerIdx, tun.entryPortal.floorY);
        const centerB = Pos(tun.exitPortal.centerIdx, tun.exitPortal.floorY);
        const dx = centerB.x - centerA.x, dz = centerB.z - centerA.z;
        const len = Math.hypot(dx, dz) || 1;
        const inDirX = dx / len, inDirZ = dz / len;
        const sideX = -inDirZ, sideZ = inDirX;
        const curve = tun.curve !== undefined ? tun.curve : 0.2;

        // 坑口リング rA / rB の各頂点の軸方向投影位置 (projA, projB) を調べ、天井が折り返して黒いひさしになる自己交差を数学的に防止する
        const projA = new Float32Array(RING_VERTS);
        const projB = new Float32Array(RING_VERTS);
        let maxProjA = -1e9, minProjB = 1e9;
        for (let k = 0; k < RING_VERTS; k++) {
            projA[k] = (rA[k].x - centerA.x) * inDirX + (rA[k].z - centerA.z) * inDirZ;
            projB[k] = (rB[k].x - centerA.x) * inDirX + (rB[k].z - centerA.z) * inDirZ;
            if (projA[k] > maxProjA) maxProjA = projA[k];
            if (projB[k] < minProjB) minProjB = projB[k];
        }

        const halfW = caveW * 0.5;
        // 山肌と同じ角張った8頂点天然岩断面（壁際がわずかにせり上がるU字の岩底＋3分割床で平らな板感を払拭）
        const rockCaveProfile = [
            { u: -halfW,        v: 0.20 },
            { u: -halfW * 0.34, v: 0.00 },
            { u:  halfW * 0.34, v: 0.00 },
            { u:  halfW,        v: 0.20 },
            { u:  halfW * 1.12, v: caveH * 0.50 },
            { u:  halfW * 0.52, v: caveH * 0.98 },
            { u: -halfW * 0.52, v: caveH * 0.98 },
            { u: -halfW * 1.12, v: caveH * 0.50 }
        ];

        const cragAmp = 0.45 + 0.55 * cragStrength;
        const sampleAxisFrame = (t) => {
            const tc = clamp(t, 0.0, 1.0);
            const bend = Math.sin(tc * Math.PI) * curve * len * 0.22;
            const cx = centerA.x + dx * tc + sideX * bend;
            const cy = centerA.y + (centerB.y - centerA.y) * tc;
            const cz = centerA.z + dz * tc + sideZ * bend;
            const dBend = Math.cos(tc * Math.PI) * Math.PI * curve * len * 0.22;
            const tx = dx + sideX * dBend;
            const tz = dz + sideZ * dBend;
            const tNorm = Math.hypot(tx, tz) || 1;
            const fwdX = tx / tNorm, fwdZ = tz / tNorm;
            return { cx, cy, cz, fwdX, fwdZ, rx: -fwdZ, rz: fwdX };
        };

        const makeCraggyRockRingAtT = (t, allowAlongJitter = true, minProjArr = null, maxProjArr = null) => {
            const fr = sampleAxisFrame(t);
            const sectionScaleW = 1.0 + (perlin.fbm((fr.cx - ox) / half * 2.5, (fr.cz - oz) / half * 2.5, 2, 1.9, 2) - 0.5) * 0.46 * cragAmp;
            const sectionScaleH = 1.0 + (perlin.fbm((fr.cx - ox) / half * 2.5 + 4.1, (fr.cz - oz) / half * 2.5 - 3.3, 3, 2.0, 2) - 0.5) * 0.40 * cragAmp;

            let isExposed = false;
            const ring = [];
            for (let k = 0; k < RING_VERTS; k++) {
                const baseU = rockCaveProfile[k].u;
                const baseV = rockCaveProfile[k].v;
                const nU = (perlin.fbm((fr.cx - ox) * 0.22 + k * 2.7, (fr.cz - oz) * 0.22 - t * 5.2, (k + 4) & 15, 1.7, 2) - 0.5) * 2.0;
                const nV = (perlin.fbm((fr.cx - ox) * 0.22 - k * 3.1, (fr.cz - oz) * 0.22 + t * 5.8, (k + 9) & 15, 1.8, 2) - 0.5) * 2.0;

                let u = baseU * (k >= 4 ? sectionScaleW : (0.94 + 0.14 * sectionScaleW));
                let v = baseV * sectionScaleH;
                let alongJitter = 0.0;

                if (k === 0 || k === 3) {
                    // 床の両端（壁際）：岩の足元らしいうねりとせり上がりを付与
                    const sign = k === 0 ? -1 : 1;
                    u += (nU * 0.20 + cr.signed() * 0.12) * halfW * cragAmp;
                    u = sign < 0 ? Math.min(u, -halfW * 0.66) : Math.max(u, halfW * 0.66);
                    v += (nV * 0.22 + cr.signed() * 0.15) * cragAmp;
                    v = clamp(v, -0.10, 0.48);
                    if (allowAlongJitter) alongJitter = (nU * 0.14 + cr.signed() * 0.16) * cellSize * cragAmp;
                } else if (k === 1 || k === 2) {
                    // 床の中央2頂点：歩きやすさを損なわない範囲で、フラットシェーディングの凹凸が明確に出るゴツゴツ岩床にする
                    const sign = k === 1 ? -1 : 1;
                    const altSign = ((Math.round(t * 10) + k) & 1) === 0 ? 1 : -1;
                    u += (nU * 0.22 + cr.signed() * 0.15) * halfW * cragAmp;
                    u = sign < 0 ? clamp(u, -halfW * 0.58, -halfW * 0.10) : clamp(u, halfW * 0.10, halfW * 0.58);
                    v = (nV * 0.28 + cr.signed() * 0.20 + altSign * 0.09) * cragAmp;
                    v = clamp(v, -0.26, 0.36);
                    if (allowAlongJitter) alongJitter = (nV * 0.16 + cr.signed() * 0.20) * cellSize * cragAmp;
                } else {
                    // 側壁・天井：山肌と同じ粗さでゴツゴツと張り出し・窪み・前後ジッターを付与
                    const sign = (k === 4 || k === 5) ? 1 : -1;
                    u += (nU * 0.34 + cr.signed() * 0.24) * halfW * cragAmp;
                    const minAbsU = (k === 4 || k === 7) ? halfW * 0.62 : halfW * 0.22;
                    u = sign > 0 ? Math.max(u, minAbsU) : Math.min(u, -minAbsU);

                    v += (nV * 0.28 + cr.signed() * 0.20) * caveH * cragAmp;
                    const minV = (k === 4 || k === 7) ? caveH * 0.34 : caveH * 0.80;
                    const maxV = (k === 4 || k === 7) ? caveH * 0.84 : caveH * 1.38;
                    v = clamp(v, minV, maxV);

                    if (allowAlongJitter) alongJitter = (nU * 0.16 + cr.signed() * 0.18) * cellSize * cragAmp;
                }

                let px = fr.cx + fr.rx * u + fr.fwdX * alongJitter;
                let py = fr.cy + v;
                let pz = fr.cz + fr.rz * u + fr.fwdZ * alongJitter;

                // 軸方向投影が隣接リング（特に坑口天井）を絶対に追い越さないよう安全クランプ
                const curProj = (px - centerA.x) * inDirX + (pz - centerA.z) * inDirZ;
                let clampedProj = curProj;
                if (minProjArr && clampedProj < minProjArr[k]) clampedProj = minProjArr[k];
                if (maxProjArr && clampedProj > maxProjArr[k]) clampedProj = maxProjArr[k];
                if (clampedProj !== curProj) {
                    const dP = clampedProj - curProj;
                    px += inDirX * dP;
                    pz += inDirZ * dP;
                }

                if (k >= 4 && t > 0.18 && t < 0.82) {
                    const nearIdx = sampleTerrainAtLocal(px - ox, pz - oz);
                    if (nearIdx < 0 || !inside[nearIdx] || py > (H[nearIdx] + oy) + 0.30) {
                        isExposed = true;
                    }
                }
                ring.push({ x: px, y: py, z: pz });
            }
            return { ring, isExposed, center: { x: fr.cx, y: fr.cy + 0.6, z: fr.cz } };
        };

        // 坑口の斜め六角形から垂直岩断面へ滑らかに橋渡しする「斜め移行カラーリング (Collar Ring)」を構築
        const buildPortalCollar = (portalRing, portalProj, isEntrySide, limitProj) => {
            const dirSign = isEntrySide ? 1 : -1;
            const collar = [];
            for (let k = 0; k < RING_VERTS; k++) {
                const p0 = portalRing[k];
                const spanToLimit = (limitProj - portalProj[k]) * dirSign;
                const stepAdv = clamp(Math.max(spanToLimit * 0.52, cellSize * 0.42), cellSize * 0.26, Math.max(cellSize * 0.45, spanToLimit * 0.85));
                const targetProj = portalProj[k] + dirSign * stepAdv;
                const tLocal = clamp(targetProj / len, 0.04, 0.96);
                const fr = sampleAxisFrame(tLocal);
                const baseU = rockCaveProfile[k].u;
                const baseV = rockCaveProfile[k].v;
                const idealPt = { x: fr.cx + fr.rx * baseU, y: fr.cy + baseV, z: fr.cz + fr.rz * baseU };
                const blend = (k <= 3) ? 0.68 : 0.58;
                let mx = p0.x + (idealPt.x - p0.x) * blend;
                let my = p0.y + (idealPt.y - p0.y) * blend;
                let mz = p0.z + (idealPt.z - p0.z) * blend;

                // 入口直後の床・壁・天井にも山肌と同調したゴツゴツ凹凸を付与（入口足元の平板感を払拭）
                if (k <= 3) {
                    const bump = ((k === 1 || k === 2) ? (cr.signed() * 0.24) : (cr.signed() * 0.14 + 0.08)) * cragAmp;
                    my += clamp(bump, -0.22, 0.30);
                    const latJ = cr.signed() * halfW * 0.10 * cragAmp;
                    mx += fr.rx * latJ;
                    mz += fr.rz * latJ;
                } else {
                    const wallJ = cr.signed() * 0.24 * cragAmp;
                    my += wallJ;
                    mx += fr.rx * (cr.signed() * halfW * 0.14 * cragAmp);
                    mz += fr.rz * (cr.signed() * halfW * 0.14 * cragAmp);
                }

                // 必ず坑口より内側 (targetProj 付近) に留めて折り返しを完全防止
                const curP = (mx - centerA.x) * inDirX + (mz - centerA.z) * inDirZ;
                const dP = targetProj - curP;
                mx += inDirX * dP;
                mz += inDirZ * dP;
                collar.push({ x: mx, y: my, z: mz });
            }
            return collar;
        };

        const rings = [];
        const ringTs = [];
        const ringExposed = [];
        const gizmoPts = [tun.entryWorldPos];

        rings.push(rA);
        ringTs.push(0.0);
        ringExposed.push(false);

        const safeStartProj = Math.min(len * 0.44, maxProjA + cellSize * 0.72);
        const safeEndProj = Math.max(len * 0.56, minProjB - cellSize * 0.72);

        if (safeEndProj > safeStartProj + cellSize * 0.35) {
            const collarA = buildPortalCollar(rA, projA, true, safeStartProj);
            rings.push(collarA);
            ringTs.push(clamp(safeStartProj * 0.5 / len, 0.04, 0.25));
            ringExposed.push(false);

            const collarB = buildPortalCollar(rB, projB, false, safeEndProj);
            const collarAProj = new Float32Array(RING_VERTS);
            const collarBProj = new Float32Array(RING_VERTS);
            for (let k = 0; k < RING_VERTS; k++) {
                collarAProj[k] = (collarA[k].x - centerA.x) * inDirX + (collarA[k].z - centerA.z) * inDirZ + cellSize * 0.22;
                collarBProj[k] = (collarB[k].x - centerA.x) * inDirX + (collarB[k].z - centerA.z) * inDirZ - cellSize * 0.22;
            }

            const tStart = clamp(safeStartProj / len, 0.10, 0.44);
            const tEnd = clamp(safeEndProj / len, 0.56, 0.90);
            const innerSpan = safeEndProj - safeStartProj;
            const innerSegs = clamp(Math.round(innerSpan / Math.max(1.35, cellSize * 0.82)), 2, 22);

            const prevProjGuard = new Float32Array(collarAProj);
            for (let j = 0; j <= innerSegs; j++) {
                const frac = j / innerSegs;
                const t = tStart + (tEnd - tStart) * frac;
                const built = makeCraggyRockRingAtT(t, true, prevProjGuard, collarBProj);
                rings.push(built.ring);
                ringTs.push(t);
                ringExposed.push(built.isExposed);
                gizmoPts.push(built.center);
                for (let k = 0; k < RING_VERTS; k++) {
                    const pNow = (built.ring[k].x - centerA.x) * inDirX + (built.ring[k].z - centerA.z) * inDirZ;
                    prevProjGuard[k] = Math.min(collarBProj[k] - 0.08, pNow + 0.12);
                }
            }

            rings.push(collarB);
            ringTs.push(clamp((len + safeEndProj) * 0.5 / len, 0.75, 0.96));
            ringExposed.push(false);
        } else {
            // 極端に短いトンネルでも自己交差を起こさず中央にゴツゴツ断面を1枚挟む
            const minP = new Float32Array(RING_VERTS);
            const maxP = new Float32Array(RING_VERTS);
            for (let k = 0; k < RING_VERTS; k++) {
                const midP = (projA[k] + projB[k]) * 0.5;
                minP[k] = Math.min(midP, projA[k] + 0.20);
                maxP[k] = Math.max(midP, projB[k] - 0.20);
            }
            const mid = makeCraggyRockRingAtT(0.5, false, minP, maxP);
            rings.push(mid.ring);
            ringTs.push(0.5);
            ringExposed.push(mid.isExposed);
            gizmoPts.push(mid.center);
        }

        rings.push(rB);
        ringTs.push(1.0);
        ringExposed.push(false);
        gizmoPts.push(tun.exitWorldPos);
        tunnelCurveBySegKey.set(tun.segKey, gizmoPts);

        // 山肌の岩色(palette.rock)をベースに、床中央の踏み跡だけ砂岩色をわずかに混ぜて自然な岩洞窟にする
        const floorCenterCol = lerpColor(palette.rock, palette.sand, 0.34);
        const floorEdgeCol = lerpColor(palette.rock, palette.under, 0.24);
        const wallColBase = lerpColor(palette.rock, palette.under, 0.30);
        const outerRockCol = lerpColor(palette.rock, palette.under, 0.16);

        const getRingVertColor = (rIdx, k, isFloor) => {
            const t = ringTs[rIdx];
            const aoDepth = Math.sin(t * Math.PI);
            const floorVertBase = (k === 1 || k === 2) ? floorCenterCol : floorEdgeCol;
            if (rIdx === 0) {
                return lerpColor(rACols[k], isFloor ? floorVertBase : wallColBase, isFloor ? 0.38 : 0.30);
            }
            if (rIdx === rings.length - 1) {
                return lerpColor(rBCols[k], isFloor ? floorVertBase : wallColBase, isFloor ? 0.38 : 0.30);
            }
            const base = isFloor ? floorVertBase : wallColBase;
            const darkAmt = isFloor ? (-0.06 - aoDepth * 0.34) : (-0.10 - aoDepth * 0.48);
            return shadeColor(base, darkAmt);
        };

        // 露出区間のゴツゴツ天然岩外殻（滑らかな筒ではなく、山肌と同じ角張った石橋・岩アーチ）を事前にリング単位で計算して連続接続
        const outerShellRings = rings.map((ring, rIdx) => {
            if (rIdx === 0 || rIdx === rings.length - 1) return ring;
            let mx = 0, my = 0, mz = 0;
            for (let k = 0; k < RING_VERTS; k++) { mx += ring[k].x; my += ring[k].y; mz += ring[k].z; }
            mx /= RING_VERTS; my /= RING_VERTS; mz /= RING_VERTS;
            return ring.map((pt, k) => {
                let oxv = pt.x - mx, oyv = pt.y - my, ozv = pt.z - mz;
                const ol = Math.hypot(oxv, oyv, ozv) || 1;
                const rNoise = 1.0 - Math.abs(2.0 * perlin.fbm((pt.x - ox) / half * 3.0, (pt.z - oz) / half * 3.0, (k + 6) & 15, 2.0, 2) - 1.0);
                const cragThick = (k <= 3 ? 0.52 : 0.84) + (0.45 + 1.25 * rNoise) * (0.35 + 0.65 * cragStrength);
                const topRidgeBoost = (k === 5 || k === 6) ? (rNoise * 0.85 * cragStrength) : 0.0;
                const botHang = (k <= 3) ? -(0.35 + rNoise * 0.58 * cragStrength) : 0.0;
                return {
                    x: pt.x + (oxv / ol) * cragThick + cr.signed() * 0.20 * cragStrength,
                    y: pt.y + (oyv / ol) * cragThick + topRidgeBoost + botHang,
                    z: pt.z + (ozv / ol) * cragThick + cr.signed() * 0.20 * cragStrength
                };
            });
        });

        // 内壁・床・露出岩外殻の出力（交互対角分割＋面ごとの明暗ジッターで山肌と同じローポリ岩ファセットに統一）
        const totalRings = rings.length;
        for (let s = 0; s < totalRings - 1; s++) {
            const ring0 = rings[s], ring1 = rings[s + 1];
            for (let k = 0; k < RING_VERTS; k++) {
                const kNext = (k + 1) % RING_VERTS;
                const p00 = ring0[k], p01 = ring0[kNext];
                const p10 = ring1[k], p11 = ring1[kNext];
                const isFloor = (k <= 2);
                const jAmp = isFloor ? 0.10 : 0.085;
                const jA = cr.range(-jAmp, jAmp);
                const jB = cr.range(-jAmp, jAmp);
                const base00 = getRingVertColor(s, k, isFloor);
                const base01 = getRingVertColor(s, kNext, isFloor);
                const base10 = getRingVertColor(s + 1, k, isFloor);
                const base11 = getRingVertColor(s + 1, kNext, isFloor);
                const alpha = isFloor ? 1.0 : 0.0;

                if (((s + k) & 1) === 0) {
                    terrainMb.emit(p00, p01, p11, shadeColor(base00, jA), shadeColor(base01, jA), shadeColor(base11, jA), alpha);
                    terrainMb.emit(p00, p11, p10, shadeColor(base00, jB), shadeColor(base11, jB), shadeColor(base10, jB), alpha);
                } else {
                    terrainMb.emit(p00, p01, p10, shadeColor(base00, jA), shadeColor(base01, jA), shadeColor(base10, jA), alpha);
                    terrainMb.emit(p01, p11, p10, shadeColor(base01, jB), shadeColor(base11, jB), shadeColor(base10, jB), alpha);
                }
            }

            // 谷や急崖を跨いで露出した中間区間のみ、山肌と繋がるゴツゴツした天然岩アーチ外殻を生成（坑口・移行カラーリングは除外）
            if (s > 1 && s < totalRings - 3 && (ringExposed[s] || ringExposed[s + 1])) {
                const out0 = outerShellRings[s];
                const out1 = outerShellRings[s + 1];
                for (let k = 0; k < RING_VERTS; k++) {
                    const kNext = (k + 1) % RING_VERTS;
                    const ocA = shadeColor(outerRockCol, cr.range(-0.085, 0.085));
                    const ocB = shadeColor(outerRockCol, cr.range(-0.085, 0.085));
                    if (((s + k) & 1) === 0) {
                        terrainMb.emit(out0[k], out1[kNext], out0[kNext], ocA, ocA, ocA, 0.0);
                        terrainMb.emit(out0[k], out1[k], out1[kNext], ocB, ocB, ocB, 0.0);
                    } else {
                        terrainMb.emit(out0[k], out1[k], out0[kNext], ocA, ocA, ocA, 0.0);
                        terrainMb.emit(out0[kNext], out1[k], out1[kNext], ocB, ocB, ocB, 0.0);
                    }
                }
            }
        }
    }

    // ---- 7. BuildWaterMesh (渓谷湖・河川・崖縁から自然に流れ落ちる立体滝) ----
    const waterMb = new ColoredMeshBuilder();
    let waterVertCount = 0;

    function computeWaterDepthColor(depth, jitterVal) {
        const shallow = shadeColor(palette.water, 0.06 + jitterVal);
        const deep = shadeColor({
            r: palette.water.r * 0.56,
            g: palette.water.g * 0.72,
            b: Math.min(1.0, palette.water.b * 0.94)
        }, jitterVal * 0.5);
        return lerpColor(shallow, deep, smoothstep(0.5, 4.5, depth));
    }

    // ---- 7.0 湖の凍結 (判定は河川生成の前に済ませてある: lakeFrozen / isLakeFrozen) ----
    const iceBase = lerpColor(palette.water, palette.snow, 0.72);
    const iceShore = lerpColor(iceBase, palette.snow, 0.55);
    const iceRng = new SeededRandom(islCfg.seed + 97);

    // 水面: 湖と河川を島上面 (inside) の崖縁までに収めて出力（崖外への板状のはみ出しを防ぐ）
    for (let iz = 0; iz < nz - 1; iz++) {
        for (let ix = 0; ix < nx - 1; ix++) {
            const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
            for (let t = 0; t < 2; t++) {
                const [i0, i1, i2] = CellTriContour(a, b, c, d, iz, t);
                if (!inside[i0] || !inside[i1] || !inside[i2]) continue;

                const lid = lakeId[i0] > 0 ? lakeId[i0] : (lakeId[i1] > 0 ? lakeId[i1] : lakeId[i2]);
                if (lid > 0) {
                    const lvl = lakeLevels[lid];
                    const y0 = (lakeId[i0] === lid) ? lvl : (!Number.isNaN(riverW[i0]) ? riverW[i0] : lvl);
                    const y1 = (lakeId[i1] === lid) ? lvl : (!Number.isNaN(riverW[i1]) ? riverW[i1] : lvl);
                    const y2 = (lakeId[i2] === lid) ? lvl : (!Number.isNaN(riverW[i2]) ? riverW[i2] : lvl);
                    if (isLakeFrozen(lid)) {
                        // 凍結湖: 水面の代わりに氷を地形メッシュへ追加（地形と同じマテリアルで描画・歩行可能）
                        const iv = iceRng.next() * 0.05 - 0.025;
                        const ic = (i) => shadeColor(lakeId[i] === lid ? iceBase : iceShore, iv);
                        terrainMb.tri(Pos(i0, y0), Pos(i1, y1), Pos(i2, y2), ic(i0), ic(i1), ic(i2), upVec, 0.0);
                        continue;
                    }
                    waterMb.tri(
                        Pos(i0, y0), Pos(i1, y1), Pos(i2, y2),
                        computeWaterDepthColor(y0 - H[i0], 0),
                        computeWaterDepthColor(y1 - H[i1], 0),
                        computeWaterDepthColor(y2 - H[i2], 0),
                        upVec, 1.0
                    );
                    waterVertCount += 3;
                    continue;
                }

                if (!river[i0] && !river[i1] && !river[i2]) continue;
                if (Number.isNaN(riverW[i0]) || Number.isNaN(riverW[i1]) || Number.isNaN(riverW[i2])) continue;

                waterMb.tri(
                    Pos(i0, riverW[i0]), Pos(i1, riverW[i1]), Pos(i2, riverW[i2]),
                    computeWaterDepthColor(riverW[i0] - H[i0], 0),
                    computeWaterDepthColor(riverW[i1] - H[i1], 0),
                    computeWaterDepthColor(riverW[i2] - H[i2], 0),
                    upVec, 1.0
                );
                waterVertCount += 3;
            }
        }
    }

    // ---- 7.1 河口の滝 (Unity版 `AddWaterfalls` の移植) ----
    // 中心線の河口セルから外周リングを両岸まで辿って川幅いっぱいの滝口(lip)を作り、
    // 落下するにつれて細く絞られる半透明の水柱を立体メッシュで構築する。
    const isNbInside = (i, k) => {
        const nb = Nb(i, k);
        return nb >= 0 && inside[nb] === 1;
    };
    const waterSurfaceY = (idx) => {
        if (idx >= 0 && idx < n) {
            if (lakeId[idx] > 0) return lakeLevels[lakeId[idx]];
            if (!Number.isNaN(riverW[idx])) return riverW[idx];
        }
        return null;
    };
    const effectiveBankRatio = (wRiver, hRiver, wBank, hBank) => {
        if (hBank <= wBank + 0.02) return 0.98;
        const wGap = Math.max(0.05, wRiver - hRiver);
        const bankRise = Math.max(0.05, hBank - wBank);
        return clamp(wGap / (wGap + bankRise) + 0.04, 0.12, 0.96);
    };
    // 外周リング (外側に隣接する内側頂点) に沿って targetDir 方向へ1歩進む
    const stepRiverMouthRim = (curr, tx, tz) => {
        let bestNb = -1, bestScore = -Infinity;
        for (let k = 0; k < 6; k++) {
            const nb = Nb(curr, k);
            if (nb < 0 || !inside[nb]) continue;
            const adjOut = !isNbInside(curr, (k + 1) % 6) || !isNbInside(curr, (k + 5) % 6);
            if (!adjOut) continue;
            const dx = xz[nb].x - xz[curr].x, dz = xz[nb].z - xz[curr].z;
            const len = Math.hypot(dx, dz);
            if (len * len < 1e-6) continue;
            const score = (dx / len) * tx + (dz / len) * tz;
            if (score > bestScore) { bestScore = score; bestNb = nb; }
        }
        return (bestNb >= 0 && bestScore > -0.25) ? bestNb : -1;
    };
    const lerpPt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    const lerpNum = (a, b, t) => a + (b - a) * t;
    const addQuadWithCenter = (a0, a1, b0, b1, ca, cb, outward) => {
        waterMb.tri(a0, a1, b1, ca, ca, cb, outward, 1.0);
        waterMb.tri(a0, b1, b0, ca, cb, cb, outward, 1.0);
        waterVertCount += 6;
    };
    const samplePolyline = (pts, cum, total, dist) => {
        if (pts.length === 1 || total <= 1e-5) return { x: pts[0].x, z: pts[0].z, y: pts[0].y };
        const d = clamp(dist, 0, total);
        for (let i = 0; i < pts.length - 1; i++) {
            const a = cum[i], b = cum[i + 1];
            if (d <= b || i === pts.length - 2) {
                const u = (b > a + 1e-5) ? clamp((d - a) / (b - a), 0, 1) : 0;
                const p = lerpPt(pts[i], pts[i + 1], u);
                return { x: p.x, z: p.z, y: p.y };
            }
        }
        const last = pts[pts.length - 1];
        return { x: last.x, z: last.z, y: last.y };
    };

    (function addWaterfalls() {
        const curveSteps = 14;
        const curveEndLocal = -Math.max(bottomDepth * 1.35, 60);
        const deepBottom = Math.min(curveEndLocal - 60, -920);
        const extYs = [];
        for (const ey of [-320, -630, -750, deepBottom]) {
            if (ey < curveEndLocal - 10 && (extYs.length === 0 || ey < extYs[extYs.length - 1] - 1)) extYs.push(ey);
        }
        const steps = curveSteps + extYs.length;
        const curveEndY = curveEndLocal + oy;
        const mouthUsed = new Uint8Array(n);
        const rng = new SeededRandom(islCfg.seed + 53);
        const waterCol = palette.water;
        const foamTint = lerpColor(waterCol, { r: 1, g: 1, b: 1 }, 0.45);
        const riverWidth = islCfg.riverWidth;

        for (let m = 0; m < n; m++) {
            if (!centerRiver[m] || mouthUsed[m] || Number.isNaN(riverW[m])) continue;

            const mPos = xz[m];
            let outCnt = 0, hasLowerRiver = false, osx = 0, osz = 0;
            for (let k = 0; k < 6; k++) {
                const nb = Nb(m, k);
                if (nb < 0 || !inside[nb]) {
                    outCnt++;
                    if (nb >= 0) {
                        const dx = xz[nb].x - mPos.x, dz = xz[nb].z - mPos.z;
                        const l = Math.hypot(dx, dz);
                        if (l * l > 1e-6) { osx += dx / l; osz += dz / l; }
                    }
                } else if (centerRiver[nb] && (riverW[nb] < riverW[m] || (riverW[nb] === riverW[m] && nb < m))) {
                    hasLowerRiver = true;
                }
            }
            if (outCnt === 0 || hasLowerRiver) continue;

            let startOutK = -1;
            for (let k = 0; k < 6; k++) {
                if (!isNbInside(m, k) && isNbInside(m, (k + 5) % 6)) { startOutK = k; break; }
            }
            if (startOutK < 0) continue;
            let endOutK = startOutK;
            for (let s = 0; s < 5; s++) {
                const nextK = (endOutK + 1) % 6;
                if (isNbInside(m, nextK)) break;
                endOutK = nextK;
            }
            const rightFallback = Nb(m, (startOutK + 5) % 6);
            const leftFallback = Nb(m, (endOutK + 1) % 6);
            if (rightFallback < 0 || leftFallback < 0 || rightFallback === leftFallback) continue;

            const wCenter = riverW[m];
            let fsx = 0, fsz = 0;
            for (let k = 0; k < 6; k++) {
                const nb = Nb(m, k);
                if (nb >= 0 && inside[nb] && centerRiver[nb] && riverW[nb] > wCenter) {
                    const dx = mPos.x - xz[nb].x, dz = mPos.z - xz[nb].z;
                    const l = Math.hypot(dx, dz);
                    if (l * l > 1e-6) { fsx += dx / l; fsz += dz / l; }
                }
            }
            const flowLen = Math.hypot(fsx, fsz);
            const hasFlow = flowLen * flowLen > 1e-6;
            let geoX, geoZ;
            if (osx * osx + osz * osz > 1e-6) {
                const l = Math.hypot(osx, osz); geoX = osx / l; geoZ = osz / l;
            } else {
                const pl = Math.hypot(mPos.x, mPos.z);
                if (pl * pl > 1e-6) { geoX = mPos.x / pl; geoZ = mPos.z / pl; } else { geoX = 1; geoZ = 0; }
            }
            const blendOut = (gx, gz) => {
                if (!hasFlow) return { x: gx, z: gz };
                const bx = gx * 0.72 + (fsx / flowLen) * 0.28, bz = gz * 0.72 + (fsz / flowLen) * 0.28;
                const bl = Math.hypot(bx, bz) || 1;
                return { x: bx / bl, z: bz / bl };
            };
            let outDir = blendOut(geoX, geoZ);
            let sideAxis = { x: -outDir.z, z: outDir.x };

            // 外周リングに沿って実際の河川幅(両岸の岸辺)まで辿る
            const visitedRim = new Set([m]);
            const leftChain = [], rightChain = [];
            let bankL = -1, bankR = -1;
            const maxWalkSpan = Math.max(cellSize * 2.5, riverWidth * 1.4);

            const walk = (dirX, dirZ, chain) => {
                let cur = m, bank = -1;
                for (let h = 0; h < 14; h++) {
                    const nextV = stepRiverMouthRim(cur, dirX, dirZ);
                    if (nextV < 0 || visitedRim.has(nextV)) break;
                    if (Math.hypot(xz[nextV].x - mPos.x, xz[nextV].z - mPos.z) > maxWalkSpan || lakeId[nextV] > 0 || mouthUsed[nextV]) break;
                    if (!river[nextV]) { bank = nextV; break; }
                    visitedRim.add(nextV);
                    chain.push(nextV);
                    cur = nextV;
                }
                return bank;
            };
            bankL = walk(sideAxis.x, sideAxis.z, leftChain);
            if (bankL < 0 && leftFallback >= 0 && !river[leftFallback] && inside[leftFallback]) bankL = leftFallback;
            bankR = walk(-sideAxis.x, -sideAxis.z, rightChain);
            if (bankR < 0 && rightFallback >= 0 && !river[rightFallback] && inside[rightFallback]) bankR = rightFallback;

            const rimVerts = [...leftChain.slice().reverse(), m, ...rightChain];
            for (const rv of rimVerts) mouthUsed[rv] = 1;

            const lastL = rimVerts[0], lastR = rimVerts[rimVerts.length - 1];
            const wLastL = waterSurfaceY(lastL) ?? wCenter;
            const wLastR = waterSurfaceY(lastR) ?? wCenter;

            let startL = Pos(lastL, wLastL);
            if (bankL >= 0) {
                const wb = waterSurfaceY(bankL);
                if (wb !== null) startL = lerpPt(Pos(lastL, wLastL), Pos(bankL, wb), effectiveBankRatio(wLastL, H[lastL], wb, H[bankL]));
            }
            let startR = Pos(lastR, wLastR);
            if (bankR >= 0) {
                const wb = waterSurfaceY(bankR);
                if (wb !== null) startR = lerpPt(Pos(lastR, wLastR), Pos(bankR, wb), effectiveBankRatio(wLastR, H[lastR], wb, H[bankR]));
            }

            // 河口全体の法線で外向き方向と左右軸を整える
            let rosx = 0, rosz = 0;
            for (const rv of rimVerts) {
                for (let k = 0; k < 6; k++) {
                    const nb = Nb(rv, k);
                    if (nb >= 0 && !inside[nb]) {
                        const dx = xz[nb].x - xz[rv].x, dz = xz[nb].z - xz[rv].z;
                        const l = Math.hypot(dx, dz);
                        if (l * l > 1e-6) { rosx += dx / l; rosz += dz / l; }
                    }
                }
            }
            if (rosx * rosx + rosz * rosz > 1e-6) {
                const l = Math.hypot(rosx, rosz); outDir = blendOut(rosx / l, rosz / l);
            } else {
                outDir = blendOut(geoX, geoZ);
            }
            sideAxis = { x: -outDir.z, z: outDir.x };
            const chordX = startL.x - startR.x, chordZ = startL.z - startR.z;
            if (chordX * sideAxis.x + chordZ * sideAxis.z < 0) sideAxis = { x: -sideAxis.x, z: -sideAxis.z };

            const lipPts = [startL];
            const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
            for (const rv of rimVerts) {
                const wy = waterSurfaceY(rv) ?? wCenter;
                const rp = Pos(rv, wy);
                if (dist3(lipPts[lipPts.length - 1], rp) > 0.05) lipPts.push(rp);
            }
            if (dist3(lipPts[lipPts.length - 1], startR) > 0.05) lipPts.push(startR);
            if (lipPts.length < 2) continue;

            const cumLen = new Array(lipPts.length).fill(0);
            for (let k = 1; k < lipPts.length; k++) {
                cumLen[k] = cumLen[k - 1] + Math.hypot(lipPts[k].x - lipPts[k - 1].x, lipPts[k].z - lipPts[k - 1].z);
            }
            const totalPolyLen = cumLen[lipPts.length - 1];
            const mouthWidth = Math.max(cellSize * 0.65, Math.hypot(chordX, chordZ));
            // 滝口の列は川の縁の頂点そのものを使う（川の水面と辺を共有して隙間を作らない）。
            // 頂点が多すぎる場合だけ、弧長で間引く。
            const cols = Math.min(lipPts.length - 1, 12);
            const useVerts = (lipPts.length - 1) <= 12;

            const midX = 0.5 * (startL.x + startR.x), midZ = 0.5 * (startL.z + startR.z);
            const lat0 = [], fwd0 = [], y0 = [], uArc = [];
            let maxFwd0 = -Infinity, sumY0 = 0;
            for (let j = 0; j <= cols; j++) {
                const sp = useVerts
                    ? lipPts[j]
                    : samplePolyline(lipPts, cumLen, totalPolyLen, totalPolyLen * (j / cols));
                const rx = sp.x - midX, rz = sp.z - midZ;
                lat0.push(rx * sideAxis.x + rz * sideAxis.z);
                fwd0.push(rx * outDir.x + rz * outDir.z);
                y0.push(sp.y);
                uArc.push(useVerts ? (totalPolyLen > 1e-5 ? cumLen[j] / totalPolyLen : j / cols) : j / cols);
                sumY0 += sp.y;
                if (fwd0[j] > maxFwd0) maxFwd0 = fwd0[j];
            }
            const avgLipY = sumY0 / (cols + 1);

            let maxRimFwd = 0;
            for (const rv of rimVerts) {
                for (let k = 0; k < 6; k++) {
                    const nb = Nb(rv, k);
                    if (nb >= 0 && !inside[nb]) {
                        const proj = (xz[nb].x - (midX - ox)) * outDir.x + (xz[nb].z - (midZ - oz)) * outDir.z;
                        if (proj > maxRimFwd) maxRimFwd = proj;
                    }
                }
            }
            const jetReach = Math.max(cellSize * 1.15, Math.max(maxRimFwd, maxFwd0) + cellSize * 0.50);

            // 川幅に合わせて滝口を始め、落下するにつれて削られた筋のように自然に細く絞る
            const endWidthRatio = lerpNum(0.36, 0.54, clamp(mouthWidth / Math.max(1, riverWidth * 1.4), 0, 1));

            // ---- 滝の形状 ----
            // 方針: (1) 川の水面を地形の最も外側(岩の舌の先端)まで延ばして「水が縁まで満ちている」状態にし、
            //       (2) そこから先は地形に刺さらないよう余白(CLEAR)を取りつつ、外側へ戻らない(単調な)曲線で落とす。
            // 地形との位置関係は、(滝口の前後軸, 高さ, 横軸) 座標系に変換した三角形で調べる。
            const CLEAR = 0.28;
            const cand = [];
            {
                const tv = terrainMb.v, triN = tv.length / 9;
                let latMin = Infinity, latMax = -Infinity, y0min = Infinity, y0max = -Infinity;
                for (let j = 0; j <= cols; j++) {
                    latMin = Math.min(latMin, lat0[j]); latMax = Math.max(latMax, lat0[j]);
                    y0min = Math.min(y0min, y0[j]); y0max = Math.max(y0max, y0[j]);
                }
                latMin -= 3.5; latMax += 3.5;
                const yTop = y0max + 3, yBot = y0min - 40;
                const loc = new Float64Array(9);
                for (let t = 0; t < triN; t++) {
                    const bI = t * 9;
                    let fMax = -Infinity, lMin = Infinity, lMax = -Infinity, yMin = Infinity, yMax = -Infinity;
                    for (let v = 0; v < 3; v++) {
                        const wx = tv[bI + v * 3] - midX, wy = tv[bI + v * 3 + 1], wz = tv[bI + v * 3 + 2] - midZ;
                        const f = wx * outDir.x + wz * outDir.z;
                        const l = wx * sideAxis.x + wz * sideAxis.z;
                        loc[v * 3] = f; loc[v * 3 + 1] = wy; loc[v * 3 + 2] = l;
                        if (f > fMax) fMax = f;
                        if (l < lMin) lMin = l; if (l > lMax) lMax = l;
                        if (wy < yMin) yMin = wy; if (wy > yMax) yMax = wy;
                    }
                    if (fMax < -10 || lMax < latMin || lMin > latMax || yMax < yBot || yMin > yTop) continue;
                    cand.push(Float64Array.from(loc));
                }
            }
            // 横位置 lat・高さ y の位置にある地形の最も外側(前方)の位置。無ければ null
            const extentAt = (lat, y) => {
                let best = -Infinity;
                for (const c of cand) {
                    const ax = c[2], ay = c[1], bx = c[5], by = c[4], cx = c[8], cy = c[7];
                    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
                    if (Math.abs(d) < 1e-9) continue;
                    const l1 = ((by - cy) * (lat - cx) + (cx - bx) * (y - cy)) / d;
                    const l2 = ((cy - ay) * (lat - cx) + (ax - cx) * (y - cy)) / d;
                    const l3 = 1 - l1 - l2;
                    if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
                    const f = l1 * c[0] + l2 * c[3] + l3 * c[6];
                    if (f > best) best = f;
                }
                return best === -Infinity ? null : best;
            };
            const maxOf = (a, b) => (a === null ? b : (b === null ? a : Math.max(a, b)));

            // (1) 滝口の延長: 水面の高さで、岩の舌の先端まで水面を延ばす
            const rawExt = [];
            for (let j = 0; j <= cols; j++) {
                let e = null;
                for (let k = 0; k <= 14; k++) {
                    const yy = y0[j] - 0.25 - k * 0.5;
                    for (const dl of [-0.35, 0, 0.35]) e = maxOf(e, extentAt(lat0[j] + dl, yy));
                }
                rawExt.push(e === null ? fwd0[j] + 0.4 : Math.max(fwd0[j] + 0.25, e + CLEAR));
            }
            let lipFwd = rawExt.map((v, j) => Math.min(v, fwd0[j] + cellSize * 3.6));
            for (let pass = 0; pass < 2; pass++) {
                const nx_ = lipFwd.slice();
                for (let j = 1; j < cols; j++) nx_[j] = (lipFwd[j - 1] + 2 * lipFwd[j] + lipFwd[j + 1]) / 4;
                lipFwd = nx_.map((v, j) => Math.max(v, Math.min(rawExt[j], fwd0[j] + cellSize * 3.6)));
            }

            // (2) 行の定義: 0=川の縁 / 1=延長した滝口 / 以降=滝口からの深さ d / 最後=カーブ終端・延長行
            const D_ROWS = [0.04, 0.12, 0.25, 0.45, 0.72, 1.05, 1.45, 1.9, 2.4, 3.2, 4.3, 5.8, 7.8, 10.2, 13.2, 17.0, 22.0];
            const rowSpec = [{ kind: 'rim' }, { kind: 'lip' }];
            for (const d of D_ROWS) rowSpec.push({ kind: 'd', d });
            rowSpec.push({ kind: 'abs', y: curveEndY, ext: false });
            for (const ey of extYs) rowSpec.push({ kind: 'abs', y: ey + oy, ext: true, yLocal: ey });
            const nRows = rowSpec.length;
            const nSteps = nRows - 1;

            const rowY = [], rowLat = [], rowW = [], rowD = [];
            for (let k = 0; k < nRows; k++) {
                const sp = rowSpec[k];
                const ys = [], ls = [];
                let wS = 1.0, dd = 0;
                if (sp.kind === 'd') {
                    wS = lerpNum(1.0, endWidthRatio, smoothstep(2.5, 22, sp.d));
                    dd = sp.d;
                } else if (sp.kind === 'abs') {
                    wS = endWidthRatio; dd = 60;
                }
                for (let j = 0; j <= cols; j++) {
                    ys.push(sp.kind === 'abs' ? sp.y : (sp.kind === 'd' ? y0[j] - sp.d : y0[j]));
                    // 縁〜落ち始めは川岸へ少し食い込ませ、水と岸の間に砂色の隙間が見えないようにする
                    const sideExtra = (sp.kind === 'rim') ? 0 : 0.38 * (1 - smoothstep(0, 6, dd));
                    ls.push(lat0[j] * wS + Math.sign(lat0[j]) * sideExtra);
                }
                rowY.push(ys); rowLat.push(ls); rowW.push(wS); rowD.push(dd);
            }

            // 各行・各列で「ここまで外側に出ていないと地形に刺さる」前方位置(必要位置)を求める
            const reqF = [];
            for (let k = 0; k < nRows; k++) {
                const row = [];
                for (let j = 0; j <= cols; j++) {
                    if (k === 0) { row.push(fwd0[j]); continue; }
                    if (k === 1) { row.push(lipFwd[j]); continue; }
                    const sp = rowSpec[k];
                    // 縁を 1/4 円で丸く越える(縁では水平→落ちるにつれ垂直)。直角の折れ目を作らない
                    const RC = 2.4;
                    const arch = sp.kind === 'd'
                        ? RC * Math.sqrt(Math.max(0, 1 - (1 - Math.min(sp.d, RC) / RC) ** 2))
                        : RC;
                    let need = null;
                    const yc = rowY[k][j];
                    const yPrev = rowY[k - 1][j], yNext = k + 1 < nRows ? rowY[k + 1][j] : yc - 2;
                    const ySamples = [yc, yc + 0.5 * (yPrev - yc), yc - 0.5 * (yc - yNext)];
                    const lc = rowLat[k][j];
                    const lStep = 0.5 * (cols > 0 ? Math.abs(lat0[Math.min(cols, j + 1)] - lat0[Math.max(0, j - 1)]) * 0.5 * rowW[k] : 0.3);
                    for (const yy of ySamples) {
                        for (const dl of [-lStep, 0, lStep]) need = maxOf(need, extentAt(lc + dl, yy));
                    }
                    row.push(Math.max(lipFwd[j] + arch, need === null ? -Infinity : need + CLEAR));
                }
                reqF.push(row);
            }
            // 前方位置: 外側へ戻らない(単調)・横方向になめらか・必要位置を下回らない
            let fwdRows = reqF.map(r => r.slice());
            for (let pass = 0; pass < 3; pass++) {
                for (let k = 2; k < nRows; k++) {
                    for (let j = 0; j <= cols; j++) fwdRows[k][j] = Math.max(fwdRows[k][j], fwdRows[k - 1][j]);
                }
                const sm = fwdRows.map(r => r.slice());
                for (let k = 2; k < nRows; k++) {
                    for (let j = 1; j < cols; j++) sm[k][j] = (fwdRows[k][j - 1] + 2 * fwdRows[k][j] + fwdRows[k][j + 1]) / 4;
                }
                for (let k = 2; k < nRows; k++) {
                    for (let j = 0; j <= cols; j++) sm[k][j] = Math.max(sm[k][j], reqF[k][j]);
                }
                fwdRows = sm;
            }
            for (let k = 2; k < nRows; k++) {
                for (let j = 0; j <= cols; j++) fwdRows[k][j] = Math.max(fwdRows[k][j], fwdRows[k - 1][j]);
            }

            const front = [], back = [];
            for (let k = 0; k < nRows; k++) {
                const row = [];
                for (let j = 0; j <= cols; j++) {
                    row.push({
                        x: midX + outDir.x * fwdRows[k][j] + sideAxis.x * rowLat[k][j],
                        y: rowY[k][j],
                        z: midZ + outDir.z * fwdRows[k][j] + sideAxis.z * rowLat[k][j]
                    });
                }
                front.push(row);
            }
            // 背面: 各列の落下方向に対して垂直に、崖側(内側)へ厚みを持たせる
            for (let k = 0; k < nRows; k++) {
                const row = [];
                const dEff = rowD[k];
                const thickBase = k <= 1 ? 0.0 : lerpNum(0.34, 0.2, smoothstep(0, 8, dEff));
                for (let j = 0; j <= cols; j++) {
                    const kp = Math.max(1, k - 1), kn = Math.min(nRows - 1, k + 1);
                    const dfwd = fwdRows[kn][j] - fwdRows[kp][j];
                    const dy = rowY[kn][j] - rowY[kp][j];
                    let bx = 0, by = -1, bz = 0;
                    if (dy * dy + dfwd * dfwd > 1e-6) {
                        const vx = outDir.x * dy, vy = -dfwd, vz = outDir.z * dy;
                        const vl = Math.hypot(vx, vy, vz) || 1;
                        bx = vx / vl; by = vy / vl; bz = vz / vl;
                    }
                    const uNorm = 2 * uArc[j] - 1;
                    const colThick = thickBase * (0.65 + 0.35 * (1 - uNorm * uNorm));
                    const f = front[k][j];
                    row.push({ x: f.x + bx * colThick, y: f.y + by * colThick, z: f.z + bz * colThick });
                }
                back.push(row);
            }

            // 色: 落ちるほど泡立つ白へ
            const ringCol = new Array(nRows);
            for (let k = 0; k < nRows; k++) {
                const sp = rowSpec[k];
                if (sp.kind === 'rim' || sp.kind === 'lip') { ringCol[k] = waterCol; continue; }
                if (sp.kind === 'd') {
                    const foam = lerpColor(waterCol, foamTint, clamp(sp.d / 22 * 0.65, 0, 1));
                    ringCol[k] = shadeColor(foam, rng.next() * 0.06 - 0.03);
                } else if (!sp.ext) {
                    ringCol[k] = shadeColor(lerpColor(waterCol, foamTint, 0.65), rng.next() * 0.06 - 0.03);
                } else {
                    const foamPhase = clamp((-sp.yLocal - 100) / 650, 0, 1);
                    ringCol[k] = shadeColor(lerpColor(waterCol, foamTint, lerpNum(0.65, 0.78, foamPhase)), rng.next() * 0.06 - 0.03);
                }
            }

            // 面の生成
            const up3 = { x: 0, y: 1, z: 0 };
            for (let j = 0; j < cols; j++) {
                // 川の縁 → 延長した滝口: 水面の続き
                addQuadWithCenter(front[0][j], front[0][j + 1], front[1][j], front[1][j + 1], ringCol[0], ringCol[1], up3);
            }
            const side3 = { x: sideAxis.x, y: 0, z: sideAxis.z };
            const sideNeg = { x: -sideAxis.x, y: 0, z: -sideAxis.z };
            const cj = cols >> 1;
            for (let s = 1; s < nSteps; s++) {
                const c0 = ringCol[s], c1 = ringCol[s + 1];
                const dfwd = fwdRows[s + 1][cj] - fwdRows[s][cj];
                const dy = rowY[s + 1][cj] - rowY[s][cj];
                let fwdOut = { x: outDir.x * 0.7071, y: 0.7071, z: outDir.z * 0.7071 };
                if (dy * dy + dfwd * dfwd > 1e-6) {
                    const vx = outDir.x * -dy, vy = dfwd, vz = outDir.z * -dy;
                    const vl = Math.hypot(vx, vy, vz) || 1;
                    fwdOut = { x: vx / vl, y: vy / vl, z: vz / vl };
                }
                const fwdIn = { x: -fwdOut.x, y: -fwdOut.y, z: -fwdOut.z };
                for (let j = 0; j < cols; j++) {
                    addQuadWithCenter(front[s][j], front[s][j + 1], front[s + 1][j], front[s + 1][j + 1], c0, c1, fwdOut);
                    addQuadWithCenter(back[s][j + 1], back[s][j], back[s + 1][j + 1], back[s + 1][j], c0, c1, fwdIn);
                }
                addQuadWithCenter(back[s][0], front[s][0], back[s + 1][0], front[s + 1][0], c0, c1, side3);
                addQuadWithCenter(front[s][cols], back[s][cols], front[s + 1][cols], back[s + 1][cols], c0, c1, sideNeg);
            }

            const cBot = ringCol[nSteps];
            const down = { x: 0, y: -1, z: 0 };
            for (let j = 0; j < cols; j++) {
                waterMb.tri(front[nSteps][j], front[nSteps][j + 1], back[nSteps][j + 1], cBot, cBot, cBot, down, 1.0);
                waterMb.tri(front[nSteps][j], back[nSteps][j + 1], back[nSteps][j], cBot, cBot, cBot, down, 1.0);
                waterVertCount += 6;
            }
        }
    })();

    // ---- 8. BuildTrees & BuildGrassMesh (`FloatingTerrainBuilder.cs` Poissonサンプリング + 疎密再現) ----
    const vegMb = new ColoredMeshBuilder();
    // 木の簡易当たり判定メッシュ（幹: 蓋なし6角柱 / 葉冠: 底面を閉じた7角錐）。見た目メッシュより大幅に軽い。
    const treeColMb = new ColoredMeshBuilder();
    const vr = new SeededRandom(islCfg.seed + 7);
    let treeCount = 0, grassClumpCount = 0;

    // 2D重心座標による連続地表サンプリング (`SampleSurface` 移植)
    function barycentric2D(px, pz, a, b, c) {
        const v0x = b.x - a.x, v0z = b.z - a.z;
        const v1x = c.x - a.x, v1z = c.z - a.z;
        const v2x = px - a.x, v2z = pz - a.z;
        const den = v0x * v1z - v1x * v0z;
        if (Math.abs(den) < 1e-8) return null;
        const v = (v2x * v1z - v1x * v2z) / den;
        const w = (v0x * v2z - v2x * v0z) / den;
        const u = 1.0 - v - w;
        if (u >= -1e-4 && v >= -1e-4 && w >= -1e-4) return { u, v, w };
        return null;
    }

    function sampleContinuousSurface(lx, lz, minRimRequirement) {
        const fz = lz / cellZ + nzCells * 0.5;
        const cz = clamp(Math.floor(fz), 0, nz - 2);
        const rowOff = (cz & 1) === 1 ? 0.5 : 0.0;
        const fx = lx / cellSize + resolution * 0.5 + 0.25 - rowOff;
        const cx = clamp(Math.floor(fx), 0, nx - 2);

        for (let dz = -1; dz <= 1; dz++) {
            const iz = cz + dz;
            if (iz < 0 || iz >= nz - 1) continue;
            for (let dx = -1; dx <= 1; dx++) {
                const ix = cx + dx;
                if (ix < 0 || ix >= nx - 1) continue;
                const a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
                if (!(inside[a] || inside[b] || inside[c] || inside[d])) continue;

                for (let t = 0; t < 2; t++) {
                    const [i0, i1, i2] = CellTriContour(a, b, c, d, iz, t);
                    if (!(inside[i0] && inside[i1] && inside[i2])) continue;
                    if (caveExcludedCenters.has(i0) || caveExcludedCenters.has(i1) || caveExcludedCenters.has(i2)) continue;
                    const bary = barycentric2D(lx, lz, xz[i0], xz[i1], xz[i2]);
                    if (!bary) continue;

                    const { u, v, w } = bary;
                    const rDist = u * Math.min(rimDist[i0], 50) + v * Math.min(rimDist[i1], 50) + w * Math.min(rimDist[i2], 50);
                    if (rDist < minRimRequirement) return null;

                    const wet = Boolean(river[i0] || river[i1] || river[i2] || lakeId[i0] > 0 || lakeId[i1] > 0 || lakeId[i2] > 0 || bankSlopeFlag[i0] || bankSlopeFlag[i1] || bankSlopeFlag[i2]);
                    const trailW = u * trailWeight[i0] + v * trailWeight[i1] + w * trailWeight[i2];
                    const y = u * H[i0] + v * H[i1] + w * H[i2];
                    const steepD = u * Math.min(steepDist[i0], 50) + v * Math.min(steepDist[i1], 50) + w * Math.min(steepDist[i2], 50);

                    const ux = xz[i1].x - xz[i0].x, uy = H[i1] - H[i0], uz = xz[i1].z - xz[i0].z;
                    const vx = xz[i2].x - xz[i0].x, vy = H[i2] - H[i0], vz = xz[i2].z - xz[i0].z;
                    let nx0 = uy * vz - uz * vy;
                    let ny0 = uz * vx - ux * vz;
                    let nz0 = ux * vy - uy * vx;
                    const nLen = Math.hypot(nx0, ny0, nz0) || 1;
                    nx0 /= nLen; ny0 /= nLen; nz0 /= nLen;
                    if (ny0 < 0) { nx0 = -nx0; ny0 = -ny0; nz0 = -nz0; }

                    return { y, ny: ny0, normal: { x: nx0, y: ny0, z: nz0 }, wet, steepD, trailW };
                }
            }
        }
        return null;
    }

    // 2D Poisson Disk Sampling (`FloatingTerrainBuilder.Poisson` 移植)
    function poissonSample2D(radius) {
        const cell = radius / 1.41421356;
        const gw = Math.max(4, Math.ceil((2.0 * half) / cell));
        const grid = new Int32Array(gw * gw).fill(-1);
        const pts = [];
        const active = [];

        const first = { x: vr.signed() * half * 0.6, z: vr.signed() * half * 0.6 };
        pts.push(first);
        active.push(0);
        const fgx = clamp(Math.floor((first.x + half) / cell), 0, gw - 1);
        const fgz = clamp(Math.floor((first.z + half) / cell), 0, gw - 1);
        grid[fgz * gw + fgx] = 0;

        const rSq = radius * radius;
        while (active.length > 0) {
            const ai = Math.floor(vr.next() * active.length);
            const p = pts[active[ai]];
            let found = false;
            for (let t = 0; t < 18; t++) {
                const ang = vr.next() * Math.PI * 2.0;
                const rad = radius * (1.0 + vr.next());
                const qx = p.x + Math.cos(ang) * rad;
                const qz = p.z + Math.sin(ang) * rad;
                if (qx * qx + qz * qz >= half * half * 0.96) continue;
                const gx = Math.floor((qx + half) / cell);
                const gz = Math.floor((qz + half) / cell);
                if (gx < 0 || gz < 0 || gx >= gw || gz >= gw) continue;

                let ok = true;
                for (let dz = -2; dz <= 2 && ok; dz++) {
                    const zz = gz + dz;
                    if (zz < 0 || zz >= gw) continue;
                    for (let dx = -2; dx <= 2; dx++) {
                        const xx = gx + dx;
                        if (xx < 0 || xx >= gw) continue;
                        const id = grid[zz * gw + xx];
                        if (id >= 0) {
                            const ddx = pts[id].x - qx, ddz = pts[id].z - qz;
                            if (ddx * ddx + ddz * ddz < rSq) { ok = false; break; }
                        }
                    }
                }
                if (!ok) continue;
                const newIdx = pts.length;
                pts.push({ x: qx, z: qz });
                grid[gz * gw + gx] = newIdx;
                active.push(newIdx);
                found = true;
                break;
            }
            if (!found) {
                active[ai] = active[active.length - 1];
                active.pop();
            }
        }
        return pts;
    }

    function addConeWithCap(cx, cy, cz, y0, h, rad, sides, col, scaleXZ, scaleY, yawRad) {
        const apex = { x: cx, y: cy + (y0 + h) * scaleY, z: cz };
        const capInset = Math.min(h * 0.20, rad * 0.24);
        const capCenter = { x: cx, y: cy + (y0 + capInset) * scaleY, z: cz };
        const edgeUnderCol = shadeColor(col, -0.05);
        const innerUnderCol = shadeColor(col, -0.20);
        const ring = [];
        for (let s = 0; s < sides; s++) {
            const a = yawRad + (s * Math.PI * 2.0) / sides;
            ring.push({ x: cx + Math.cos(a) * rad * scaleXZ, y: cy + y0 * scaleY, z: cz + Math.sin(a) * rad * scaleXZ });
        }
        for (let s = 0; s < sides; s++) {
            const p0 = ring[s], p1 = ring[(s + 1) % sides];
            const out = { x: (p0.x + p1.x) * 0.5 - cx, y: 0.35, z: (p0.z + p1.z) * 0.5 - cz };
            vegMb.tri(p0, p1, apex, col, col, col, out, 1.0);
            vegMb.tri(p1, p0, capCenter, edgeUnderCol, edgeUnderCol, innerUnderCol, { x: 0, y: -1, z: 0 }, 1.0);
        }
    }

    function addPrism(cx, cy, cz, y0, y1, rBot, rTop, sides, col, scaleXZ, scaleY) {
        for (let s = 0; s < sides; s++) {
            const a0 = (s * Math.PI * 2.0) / sides, a1 = ((s + 1) * Math.PI * 2.0) / sides;
            const b0 = { x: cx + Math.cos(a0) * rBot * scaleXZ, y: cy + y0 * scaleY, z: cz + Math.sin(a0) * rBot * scaleXZ };
            const b1 = { x: cx + Math.cos(a1) * rBot * scaleXZ, y: cy + y0 * scaleY, z: cz + Math.sin(a1) * rBot * scaleXZ };
            const t0 = { x: cx + Math.cos(a0) * rTop * scaleXZ, y: cy + y1 * scaleY, z: cz + Math.sin(a0) * rTop * scaleXZ };
            const t1 = { x: cx + Math.cos(a1) * rTop * scaleXZ, y: cy + y1 * scaleY, z: cz + Math.sin(a1) * rTop * scaleXZ };
            const out = { x: Math.cos((a0 + a1) * 0.5), y: 0, z: Math.sin((a0 + a1) * 0.5) };
            vegMb.quad(b0, b1, t1, t0, col, col, col, col, out, 1.0);
        }
    }

    // 木の当たり判定（Unity版 `AddOpenCylinder` + `AddSimpleCone` 相当）
    function addTreeCollider(cx, cy, cz, crownStart, span, crownRad, scaleXZ, scaleY) {
        const col = { r: 0.5, g: 0.5, b: 0.5 };
        const trunkSides = 6, coneSides = 7;
        const trunkY0 = cy - 0.2 * scaleY;
        const trunkY1 = cy + Math.max(2.05, crownStart + 0.35) * scaleY;
        const trunkR = 0.18 * scaleXZ;
        for (let i = 0; i < trunkSides; i++) {
            const a0 = (i * Math.PI * 2.0) / trunkSides, a1 = ((i + 1) * Math.PI * 2.0) / trunkSides;
            const am = (a0 + a1) * 0.5;
            const b0 = { x: cx + Math.cos(a0) * trunkR, y: trunkY0, z: cz + Math.sin(a0) * trunkR };
            const b1 = { x: cx + Math.cos(a1) * trunkR, y: trunkY0, z: cz + Math.sin(a1) * trunkR };
            const t0 = { x: b0.x, y: trunkY1, z: b0.z };
            const t1 = { x: b1.x, y: trunkY1, z: b1.z };
            treeColMb.quad(b0, b1, t1, t0, col, col, col, col, { x: Math.cos(am), y: 0, z: Math.sin(am) }, 1.0);
        }
        const coneY0 = cy + crownStart * scaleY;
        const apex = { x: cx, y: cy + (crownStart + span) * scaleY, z: cz };
        const baseC = { x: cx, y: coneY0, z: cz };
        const rad = crownRad * scaleXZ;
        for (let i = 0; i < coneSides; i++) {
            const a0 = (i * Math.PI * 2.0) / coneSides, a1 = ((i + 1) * Math.PI * 2.0) / coneSides;
            const am = (a0 + a1) * 0.5;
            const r0 = { x: cx + Math.cos(a0) * rad, y: coneY0, z: cz + Math.sin(a0) * rad };
            const r1 = { x: cx + Math.cos(a1) * rad, y: coneY0, z: cz + Math.sin(a1) * rad };
            treeColMb.tri(r0, r1, apex, col, col, col, { x: Math.cos(am), y: rad / Math.max(0.1, span * scaleY), z: Math.sin(am) }, 1.0);
            treeColMb.tri(r1, r0, baseC, col, col, col, { x: 0, y: -1, z: 0 }, 1.0);
        }
    }

    // ---- 8.1 木の生成 (`BuildTrees`: groveNoise と microGap で森の中に濃い木立と薄い疎林を作る) ----
    const minTreeNy = Math.max(0.74, islCfg.rockSlope + 0.02);
    const treeMinDist = islCfg.treeMinDist !== undefined ? islCfg.treeMinDist : 3.4;
    const treeSpacing = Math.max(1.5, treeMinDist * 0.68);
    // 小島のサイズに合わせて林の塊(grove)と小さな隙間(microGap)の空間波長をスケーリング
    const groveFreq = 3.2 / Math.max(18.0, half);
    const microGapFreq = 9.5 / Math.max(18.0, half);

    if (forestSpread > 0.01) {
        const treeCandidates = poissonSample2D(treeSpacing);
        for (const p of treeCandidates) {
            const bw = BiomeWeights(p.x, p.z);
            if (bw.forest <= 0.02) continue;

            const surf = sampleContinuousSurface(p.x, p.z, 2.2);
            if (!surf || surf.wet || surf.trailW > 0.22 || surf.ny < minTreeNy) continue;
            if ((surf.y + oy) > sharedWorldGreeneryLine - 1.5) continue;

            // 密生する濃い木立と、開けた薄い疎林が混ざるよう中・高周波ノイズで局所密度を変化させる (`FloatingTerrainBuilder.cs` 準拠)
            const groveNoise = perlin.fbm(p.x * groveFreq + 2.7, p.z * groveFreq - 5.1, 10, 1.0, 3);
            const microGap = perlin.fbm(p.x * microGapFreq - 4.3, p.z * microGapFreq + 1.9, 12, 1.0, 2);
            const combinedGrove = groveNoise * 0.68 + microGap * 0.32;
            const localDensity = 0.08 + 0.92 * smoothstep(0.26, 0.70, combinedGrove);
            if (vr.next() > bw.forest * localDensity) continue;

            const baseScale = 0.80 + vr.next() * 0.42;
            const hBias = 0.90 + vr.next() * 0.22;
            const wBias = 0.88 + vr.next() * 0.34;
            const sY = islCfg.treeScale * baseScale * hBias;
            const sXZ = islCfg.treeScale * baseScale * wBias;
            const crownStart = 1.25 + vr.next() * 0.85;
            const span = 3.95 + vr.next() * 0.75;
            const lowerRadScale = 0.95 + vr.next() * 0.16;
            const g = vr.range(-0.05, 0.05);

            const wx = p.x + ox, wz = p.z + oz, wy = surf.y + oy - 0.18 * sY;
            const trunkTop = Math.max(2.1, crownStart + 0.55);
            addTreeCollider(wx, wy, wz, crownStart, span, 1.32 * lowerRadScale, sXZ, sY);
            addPrism(wx, wy, wz, -0.2, trunkTop, 0.22, 0.12, 6, palette.trunk, sXZ, sY);

            const r1 = 1.32 * lowerRadScale;
            const r2 = 1.02 * (0.94 + vr.next() * 0.16);
            const r3 = 0.70 * (0.94 + vr.next() * 0.16);
            addConeWithCap(wx, wy, wz, crownStart, span * 0.54, r1, 7, shadeColor(palette.leaf, g), sXZ, sY, vr.next() * 6.28);
            addConeWithCap(wx, wy, wz, crownStart + span * 0.28, span * 0.49, r2, 7, shadeColor(palette.leaf, g + 0.03), sXZ, sY, vr.next() * 6.28);
            addConeWithCap(wx, wy, wz, crownStart + span * 0.55, span * 0.45, r3, 7, shadeColor(palette.leaf, g + 0.06), sXZ, sY, vr.next() * 6.28);
            treeCount++;
        }
    }

    // 木と草を別メッシュとして書き出せるよう、木の終端位置を記録（以降は草のみ）
    const treeVertEnd = vegMb.v.length;

    // ---- 8.2 草の生成 (`BuildGrassMesh`: 草原エリアに高密度で配置し、bare領域は何も生えない緑の地面として残す) ----
    function addGrassBlade(r0Pt, r1Pt, rootMid, dir, side, widthBlade, heightBlade, lean, rootCol, midCol, tipCol) {
        const midCenter = {
            x: rootMid.x + dir.x * (lean * 0.32),
            y: rootMid.y + heightBlade * 0.55,
            z: rootMid.z + dir.z * (lean * 0.32)
        };
        const halfMidW = widthBlade * 0.42;
        const m0 = { x: midCenter.x - side.x * halfMidW, y: midCenter.y, z: midCenter.z - side.z * halfMidW };
        const m1 = { x: midCenter.x + side.x * halfMidW, y: midCenter.y, z: midCenter.z + side.z * halfMidW };
        const tip = {
            x: rootMid.x + dir.x * lean,
            y: rootMid.y + heightBlade,
            z: rootMid.z + dir.z * lean
        };
        const out = { x: -dir.x, y: 0.45, z: -dir.z };
        vegMb.tri(r0Pt, r1Pt, m1, rootCol, rootCol, midCol, out, 1.0);
        vegMb.tri(r0Pt, m1, m0, rootCol, midCol, midCol, out, 1.0);
        vegMb.tri(m0, m1, tip, midCol, midCol, tipCol, out, 1.0);
        // 裏面も描画してどの角度から見ても草の密度が高く見えるようにする
        const backOut = { x: dir.x, y: 0.45, z: dir.z };
        vegMb.tri(r1Pt, r0Pt, m0, rootCol, rootCol, midCol, backOut, 1.0);
        vegMb.tri(r1Pt, m0, m1, rootCol, midCol, midCol, backOut, 1.0);
        vegMb.tri(m1, m0, tip, midCol, midCol, tipCol, backOut, 1.0);
    }

    const grassMinDist = islCfg.grassMinDist !== undefined ? islCfg.grassMinDist : 1.0;
    const grassDensity = islCfg.grassDensity !== undefined ? islCfg.grassDensity : 2.8;
    if (grassDensity > 0.05 && meadowSpread > 0.01) {
        const grassSpacing = clamp(grassMinDist / Math.max(0.55, grassDensity * 0.92), 0.42, 2.2);
        const minGrassNy = Math.max(0.84, islCfg.rockSlope + 0.10);
        const patchFreq = 5.5 / Math.max(18.0, half);
        const fineFreq = 14.0 / Math.max(18.0, half);

        const grassCandidates = poissonSample2D(grassSpacing);
        for (const p of grassCandidates) {
            const bw = BiomeWeights(p.x, p.z);
            // 草原バイオーム (bw.meadow) のみに草を生やし、bare領域は「何も生えていない緑の地面」として残す
            if (bw.meadow <= 0.015) continue;

            const surf = sampleContinuousSurface(p.x, p.z, 1.6);
            if (!surf || surf.wet || surf.trailW > 0.18 || surf.ny < minGrassNy || surf.steepD < grassSlopeMargin) continue;

            const worldY = surf.y + oy;
            const barrenW = smoothstep(sharedWorldGreeneryLine - 3.5, sharedWorldGreeneryLine + 2.5, worldY);
            if (barrenW > 0.68) continue;

            const slopeMarginW = smoothstep(grassSlopeMargin, grassSlopeMargin + 2.4, surf.steepD);
            const flatnessW = smoothstep(minGrassNy, minGrassNy + 0.06, surf.ny);
            const altFade = 1.0 - smoothstep(0.05, 0.72, barrenW);
            const rawCover = bw.meadow * altFade * Math.min(slopeMarginW, flatnessW);

            // 草原の境界帯を大小の草株・飛び地へ砕き、中心部は高密度に茂らせる (`FloatingTerrainBuilder.cs` 準拠)
            const patchNoise = perlin.fbm(p.x * patchFreq + 5.1, p.z * patchFreq - 3.7, 6, 1.0, 2);
            const fineNoise = perlin.fbm(p.x * fineFreq - 2.3, p.z * fineFreq + 6.4, 4, 1.0, 1);
            const breakup = patchNoise * 0.68 + fineNoise * 0.32;
            const edgeMask = smoothstep(0.16, 0.82, rawCover + (breakup - 0.5) * 0.68);
            const cover = edgeMask + (rawCover - edgeMask) * (rawCover * rawCover);
            if (cover <= 0.02) continue;

            if (vr.next() > Math.pow(cover, 1.65) * 0.98) continue;

            const clumpScale = 0.76 + vr.next() * 0.68;
            const clumpVar = vr.range(-0.08, 0.08);
            const minBlades = cover < 0.28 ? 2 : (cover < 0.58 ? 3 : 4);
            const maxBlades = cover < 0.28 ? 3 : (cover < 0.58 ? 4 : 5);
            const bladeCount = minBlades + Math.floor(vr.next() * (maxBlades - minBlades + 1));
            const tintMix = 0.45 + 0.55 * smoothstep(0.02, 0.42, cover);

            const invNy = surf.normal.y > 0.15 ? 1.0 / surf.normal.y : 1.0;
            const slopeX = -surf.normal.x * invNy;
            const slopeZ = -surf.normal.z * invNy;

            for (let k = 0; k < bladeCount; k++) {
                const angle = (k + vr.next() * 0.75) * (Math.PI * 2.0 / bladeCount);
                const dir = { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
                const side = { x: -dir.z, y: 0, z: dir.x };
                const rootOffset = (0.04 + vr.next() * 0.20) * clumpScale;

                const tallBlade = k < 2;
                const bladeH = (tallBlade ? 0.78 + vr.next() * 0.42 : 0.42 + vr.next() * 0.38) * clumpScale;
                const widthBlade = (0.082 + vr.next() * 0.042) * clumpScale;
                const lean = bladeH * (tallBlade ? 0.28 + vr.next() * 0.34 : 0.34 + vr.next() * 0.40);
                const bladeVar = vr.range(-0.05, 0.05);

                const rx = p.x + dir.x * rootOffset;
                const rz = p.z + dir.z * rootOffset;
                const halfW = widthBlade * 0.55;
                const rootY = surf.y + (rx - p.x) * slopeX + (rz - p.z) * slopeZ;
                const sxOff = side.x * halfW * slopeX;
                const szOff = side.z * halfW * slopeZ;
                const y0 = rootY - sxOff - szOff;
                const y1 = rootY + sxOff - szOff;

                const embedDepth = 0.10;
                const r0Pt = { x: rx - side.x * halfW + ox, y: y0 - embedDepth + oy, z: rz - side.z * halfW + oz };
                const r1Pt = { x: rx + side.x * halfW + ox, y: y1 - embedDepth + oy, z: rz + side.z * halfW + oz };
                const baseY = Math.min(rootY, Math.min(y0, y1)) - embedDepth;
                const rootMid = { x: rx + ox, y: baseY + oy, z: rz + oz };

                const rootCol = shadeColor(palette.grass, -0.28 * tintMix + clumpVar);
                const midCol = shadeColor(palette.grass, -0.06 * tintMix + clumpVar + bladeVar);
                const tipBase = shadeColor(palette.grass, 0.08 * tintMix + clumpVar + bladeVar);
                const tipCol = lerpColor(tipBase, palette.sand, (tallBlade ? 0.28 : 0.15) * tintMix);

                addGrassBlade(r0Pt, r1Pt, rootMid, dir, side, widthBlade, bladeH, lean, rootCol, midCol, tipCol);
            }
            grassClumpCount++;
        }
    }

    const segmentVisuals = routeSegments.map(s => {
        const pFrom = s.fromResolved.worldPos;
        const pTo = s.toResolved.worldPos;
        const tunPts = s.mode === 'tunnel' ? tunnelCurveBySegKey.get(s.segKey) : null;
        const midNode = s.nodes.length > 0 ? s.nodes[Math.floor(s.nodes.length / 2)] : -1;
        const pMid = (s.mode === 'trail' && midNode >= 0)
            ? Pos(midNode, H[midNode])
            : (tunPts && tunPts.length >= 2
                ? tunPts[Math.floor(tunPts.length / 2)]
                : { x: (pFrom.x + pTo.x) * 0.5, y: (pFrom.y + pTo.y) * 0.5 + (s.mode === 'tunnel' ? 1.8 : 0.6), z: (pFrom.z + pTo.z) * 0.5 });
        return {
            segKey: s.segKey,
            mode: s.mode,
            enabled: s.mode !== 'none',
            isBranch: Boolean(s.isBranch),
            midPos: pMid,
            pathPts: s.mode === 'tunnel' && tunPts ? tunPts : s.nodes.map(nd => Pos(nd, H[nd])),
            fromPos: pFrom,
            toPos: pTo
        };
    });

    // vegMb（木+草）を、木・草の別メッシュに分割（Unityの Trees / Grass オブジェクト用）
    const sliceMb = (from, to) => {
        const mb = new ColoredMeshBuilder();
        mb.v = vegMb.v.slice(from, to);
        mb.c = vegMb.c.slice(from, to);
        mb.a = vegMb.a.slice(from / 3, to / 3);
        return mb;
    };
    const treesMb = sliceMb(0, treeVertEnd);
    const grassMb = sliceMb(treeVertEnd, vegMb.v.length);

    // 崖・岩盤・氷の三角形の向きを揃える（Unityの裏面カリングで穴に見えるのを防ぐ）
    unifyWinding(terrainMb);

    // 川の点の表示高さ: 川床ではなく周囲の地表(岸)の高さに合わせる
    const surfaceYAt = (lx, lz) => {
        let m = -Infinity;
        const r2 = (cellSize * 3.2) ** 2;
        for (let i = 0; i < n; i++) {
            if (!inside[i]) continue;
            if ((xz[i].x - lx) ** 2 + (xz[i].z - lz) ** 2 <= r2 && H[i] > m) m = H[i];
        }
        return Number.isFinite(m) ? m : 0;
    };
    // 自動生成された川の経路点 (3Dハンドル表示用。ドラッグすると手動の川に変換される)
    const autoRiverWorlds = (islCfg.autoRivers === false ? [] : (riverPaths || [])).map(path => {
        const idxs = [];
        for (let k = 0; k < path.length; k += 5) idxs.push(k);
        if (idxs[idxs.length - 1] !== path.length - 1) {
            if (path.length - 1 - idxs[idxs.length - 1] < 3 && idxs.length > 1) idxs[idxs.length - 1] = path.length - 1;
            else idxs.push(path.length - 1);
        }
        return idxs.map(k => {
            const c = path[k];
            const sy = surfaceYAt(xz[c].x, xz[c].z) + oy;
            return { x: xz[c].x + ox, y: sy, z: xz[c].z + oz, groundY: sy, nx: xz[c].x / half, nz: xz[c].z / half };
        });
    });

    // 手動の川の経路点 (3Dハンドル表示用)
    const riverPointWorlds = (Array.isArray(islCfg.manualRivers) ? islCfg.manualRivers : []).map(r =>
        (Array.isArray(r.points) ? r.points : []).map(p => {
            const tx = p.x * half, tz = p.z * half;
            let best = -1, bd = Infinity;
            for (let i = 0; i < n; i++) {
                if (!inside[i]) continue;
                const d = (xz[i].x - tx) ** 2 + (xz[i].z - tz) ** 2;
                if (d < bd) { bd = d; best = i; }
            }
            const gy = best >= 0 ? surfaceYAt(tx, tz) : 0;
            return { x: tx + ox, y: gy + oy, z: tz + oz, groundY: gy + oy };
        }));

    return {
        name: islCfg.name,
        seed: islCfg.seed,
        resolution,
        cellSize,
        half,
        xz,
        H,
        inside,
        mountain,
        ox, oy, oz,
        terrainMb,
        waterMb,
        vegMb,
        treesMb,
        grassMb,
        treeColMb,
        entryShorePos: entryResolved.worldPos,
        entryGroundY: entryResolved.groundWorldY,
        exitShorePos: exitResolved.worldPos,
        exitGroundY: exitResolved.groundWorldY,
        waypointWorldPositions: waypointResolved.map(r => r.worldPos),
        riverPointWorlds,
        autoRiverWorlds,
        waypointGroundYs: waypointResolved.map(r => r.groundWorldY),
        waypointRoles,
        branchPointRoles,
        resolvedBranches,
        segmentVisuals,
        internalBridges,
        allTunnels,
        lakeCount: keptLakes,
        waterVertCount,
        treeCount,
        grassClumpCount
    };
}
