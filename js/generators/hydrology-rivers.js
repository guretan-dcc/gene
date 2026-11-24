// =========================================================================
// 河川ネットワークの生成と河道の彫り込み
//   Unity版 `FloatingTerrainBuilder.BuildHydrology` の川まわり（流量計算 → 中心線の抽出 → 並走川の合流 →
//   位相の整理 → 川幅・水面・土手の決定 → 彫り込み）を忠実に移植したもの。
//   湖の抽出・湖盆の整形は island-generator.js 側で済ませてから呼ぶ。
// =========================================================================
import { clamp, smoothstep as Smooth } from '../utils/math.js';

const DEFAULT_RIVER_THRESHOLD = 75;
const MIN_RIVER_THRESHOLD = 35;
const MAX_RIVER_THRESHOLD = 15000;
const DISABLED_RIVER_THRESHOLD = 1000000;
const RIVER_SUB_UNIT_EXP = 4.9;
const MAX_RIVER_AMOUNT = 2.0;
// 河口(島の縁)での水深と土手の高さ。縁へ向かって、通常の水深・土手高からここまで浅く均す。
const MOUTH_WATER_DEPTH = 0.45;
const MOUTH_BANK_HEIGHT = 0.12;

// Unity版 `ComputeRiverThreshold(riverAmount)`
export function computeRiverThreshold(riverAmount) {
    if (!(riverAmount > 0.005)) return DISABLED_RIVER_THRESHOLD;
    const c = clamp(riverAmount, 0.006, MAX_RIVER_AMOUNT);
    if (c >= 1) {
        return clamp(Math.round(DEFAULT_RIVER_THRESHOLD / c), MIN_RIVER_THRESHOLD, DEFAULT_RIVER_THRESHOLD);
    }
    return clamp(Math.round(DEFAULT_RIVER_THRESHOLD * Math.exp(RIVER_SUB_UNIT_EXP * (1 - c))),
        DEFAULT_RIVER_THRESHOLD, MAX_RIVER_THRESHOLD);
}

class MinHeap {
    constructor() { this.k = []; this.v = []; }
    get size() { return this.k.length; }
    clear() { this.k.length = 0; this.v.length = 0; }
    push(key, val) {
        const k = this.k, v = this.v;
        let c = k.length;
        k.push(key); v.push(val);
        while (c > 0) {
            const p = (c - 1) >> 1;
            if (k[p] <= k[c]) break;
            [k[p], k[c]] = [k[c], k[p]];
            [v[p], v[c]] = [v[c], v[p]];
            c = p;
        }
    }
    pop() {
        const k = this.k, v = this.v;
        const top = { key: k[0], val: v[0] };
        const lk = k.pop(), lv = v.pop();
        if (k.length > 0) {
            k[0] = lk; v[0] = lv;
            let c = 0;
            for (;;) {
                const l = c * 2 + 1, r = l + 1;
                let s = c;
                if (l < k.length && k[l] < k[s]) s = l;
                if (r < k.length && k[r] < k[s]) s = r;
                if (s === c) break;
                [k[s], k[c]] = [k[c], k[s]];
                [v[s], v[c]] = [v[c], v[s]];
                c = s;
            }
        }
        return top;
    }
}

/**
 * @param {object} c コンテキスト
 *   n, resolution, cellSize, half, cliffWidth, jitter, perlin, islCfg, Nb(i,k), SafeBedFloor(i)
 *   inside, H, mask, mountain, xz(可変), baseXz, lakeId, lakeLevels, lakeFrozen
 *   centerRiver, river, riverW, bankSlopeFlag, snowZone, snowBuffer  (呼び出し側で確保した配列。結果をここへ書き込む)
 * @returns {{ riverCenterOrdered:number[] }}
 */
export function carveRivers(c) {
    const { n, resolution, cellSize, half, cliffWidth, perlin, islCfg, Nb, SafeBedFloor,
        inside, H, mask, mountain, xz, baseXz, lakeId, lakeLevels,
        centerRiver, river, riverW, bankSlopeFlag, snowZone, snowBuffer } = c;
    const fbm = (x, z, salt, freq, oct) => perlin.fbm(x, z, salt, freq, oct);
    const isLakeFrozen = (lid) => lid > 0 && lid < c.lakeFrozen.length && c.lakeFrozen[lid];
    const setXz = (i, x, z) => { xz[i] = { x, y: z, z }; };
    const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

    const manualList = (Array.isArray(islCfg.manualRivers) ? islCfg.manualRivers : [])
        .filter(r => r && Array.isArray(r.points) && r.points.length >= 2);
    const riverAmountCfg = islCfg.riverAmount !== undefined ? islCfg.riverAmount : 1.0;
    // 自動河川: 川の多さ>0 かつ autoRivers !== false
    const autoRivers = riverAmountCfg > 0.005 && islCfg.autoRivers !== false;
    // 湖の流出口から川を流すか (既定OFF)
    const lakeOutletEnabled = islCfg.lakeOutletRiver === true;
    const riverThreshold = computeRiverThreshold(riverAmountCfg > 0.005 ? riverAmountCfg : 1.0);
    const riverWidth = islCfg.riverWidth;
    const riverBankDepth = islCfg.riverBankDepth;
    const riverDepth = islCfg.riverDepth;
    const plainsRiverDepth = islCfg.plainsRiverDepth !== undefined ? islCfg.plainsRiverDepth : riverDepth * 0.7;
    const riverAreaScale = Math.max(0.25, (resolution / 160) * (resolution / 160));

    if (riverThreshold >= DISABLED_RIVER_THRESHOLD / 2 && manualList.length === 0) return { riverCenterOrdered: [] };

    // ---------------- 流路探索用の高さ flowH / Priority-Flood flowF ----------------
    const flowH = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        flowH[i] = H[i];
        if (!inside[i] || lakeId[i] > 0) continue;
        const plainsW = clamp(1 - mountain[i] / 0.52, 0, 1);
        const rimFade = Smooth(0, cliffWidth * 1.35, mask[i]);
        const meanderW = plainsW * rimFade;
        if (meanderW <= 0.001) continue;
        const px = baseXz[i].x / half, pz = baseXz[i].z / half;
        const wx = px + (fbm(px, pz, 12, 2.2, 2) - 0.5) * 0.28;
        const wz = pz + (fbm(px + 4.7, pz - 2.9, 13, 2.2, 2) - 0.5) * 0.28;
        const macroValley = Math.abs(fbm(wx, wz, 14, 3.4, 3) - 0.5) * 2;
        const medWave = fbm(baseXz[i].x * 0.013, baseXz[i].z * 0.013, 15, 1.0, 2);
        const bias = (macroValley * 0.60 + medWave * 0.40 - 0.5) * 4.8 * meanderW;
        flowH[i] = Math.max(0.1, H[i] + bias);
    }
    const flowF = new Float32Array(n);
    {
        const closed = new Uint8Array(n);
        const pq = new MinHeap();
        for (let i = 0; i < n; i++) {
            if (inside[i]) continue;
            closed[i] = 1;
            flowF[i] = flowH[i];
            for (let k = 0; k < 6; k++) {
                const nb = Nb(i, k);
                if (nb >= 0 && inside[nb]) { pq.push(flowF[i], i); break; }
            }
        }
        while (pq.size > 0) {
            const cur = pq.pop().val;
            for (let k = 0; k < 6; k++) {
                const nb = Nb(cur, k);
                if (nb < 0 || closed[nb]) continue;
                closed[nb] = 1;
                const stepEps = 0.00015 + 0.00045 * fbm(baseXz[nb].x / half, baseXz[nb].z / half, 9, 4.5, 2);
                flowF[nb] = Math.max(flowH[nb], flowF[cur] + stepEps);
                pq.push(flowF[nb], nb);
            }
        }
    }

    // ---------------- 流れる向き・流量 ----------------
    const down = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
        if (!inside[i]) continue;
        let bestS = 0;
        for (let k = 0; k < 6; k++) {
            const nb = Nb(i, k);
            if (nb < 0 || flowF[nb] >= flowF[i]) continue;
            const s = (flowF[i] - flowF[nb]) / Math.max(0.1, dist2(xz[i], xz[nb]));
            if (s > bestS) { bestS = s; down[i] = nb; }
        }
    }
    const acc = new Int32Array(n);
    const mtAcc = new Int32Array(n);
    let order = [];

    function buildTopologicalOrder() {
        order = [];
        const inDeg = new Int32Array(n);
        for (let i = 0; i < n; i++) {
            if (!inside[i]) continue;
            const d = down[i];
            if (d >= 0 && inside[d]) inDeg[d]++;
        }
        const q = [];
        for (let i = 0; i < n; i++) if (inside[i] && inDeg[i] === 0) q.push(i);
        for (let h = 0; h < q.length; h++) {
            const cur = q[h];
            order.push(cur);
            const d = down[cur];
            if (d >= 0 && inside[d]) {
                inDeg[d]--;
                if (inDeg[d] === 0) q.push(d);
            }
        }
    }
    function computeAccumulation() {
        // acc は非積雪域、mtAcc は雪域および明確な山地(mountain >= 0.22)からの集水
        for (let i = 0; i < n; i++) {
            acc[i] = (inside[i] && !snowZone[i]) ? 1 : 0;
            mtAcc[i] = (inside[i] && (snowZone[i] || mountain[i] >= 0.22)) ? 1 : 0;
        }
        for (const i of order) {
            const d = down[i];
            if (d < 0 || !inside[d]) continue;
            mtAcc[d] += mtAcc[i];
            if (!snowZone[d]) acc[d] += acc[i];
        }
    }
    buildTopologicalOrder();
    computeAccumulation();

    // ---------------- 手動で設計した川 (manualRivers) ----------------
    const manual = new Uint8Array(n);
    const manualPaths = [];
    {
        const nearestCell = (nx, nz) => {
            const tx = nx * half, tz = nz * half;
            let best = -1, bd = Infinity;
            for (let i = 0; i < n; i++) {
                if (!inside[i]) continue;
                const d = (baseXz[i].x - tx) ** 2 + (baseXz[i].z - tz) ** 2;
                if (d < bd) { bd = d; best = i; }
            }
            return best;
        };
        const walk = (a, b, path, seen) => {
            let cur = a;
            for (let guard = 0; guard < n && cur !== b; guard++) {
                let bestN = -1, bestD = Infinity;
                for (let k = 0; k < 6; k++) {
                    const nb = Nb(cur, k);
                    if (nb < 0 || !inside[nb] || seen.has(nb)) continue;
                    const d = Math.hypot(baseXz[nb].x - baseXz[b].x, baseXz[nb].z - baseXz[b].z);
                    if (d < bestD) { bestD = d; bestN = nb; }
                }
                if (bestN < 0) break;
                path.push(bestN); seen.add(bestN); cur = bestN;
            }
        };
        for (const mr of manualList) {
            const cells = [];
            for (const p of mr.points) {
                const c0 = nearestCell(p.x, p.z);
                if (c0 >= 0 && cells[cells.length - 1] !== c0) cells.push(c0);
            }
            if (cells.length < 2) continue;
            const path = [cells[0]];
            const seen = new Set(path);
            for (let k = 1; k < cells.length; k++) walk(path[path.length - 1], cells[k], path, seen);
            // 終点から既存の流下方向をたどって島の端か湖まで流す
            let cur = path[path.length - 1];
            for (let guard = 0; guard < n; guard++) {
                const d = down[cur];
                if (d < 0 || !inside[d]) break;
                if (seen.has(d)) { down[cur] = -1; break; }
                path.push(d); seen.add(d); cur = d;
                if (lakeId[d] > 0) break;
            }
            if (path.length >= 2) manualPaths.push(path);
        }
        for (const path of manualPaths) for (const c of path) if (lakeId[c] <= 0) manual[c] = 1;
    }
    function applyManual() {
        for (const path of manualPaths) {
            for (let k = 0; k + 1 < path.length; k++) down[path[k]] = path[k + 1];
            for (const c of path) if (lakeId[c] <= 0 && inside[c]) centerRiver[c] = 1;
        }
    }
    if (manualPaths.length > 0) {
        applyManual();
        buildTopologicalOrder();
        computeAccumulation();
    }

    const areNeighbors = (a, b) => { for (let k = 0; k < 6; k++) if (Nb(a, k) === b) return true; return false; };
    const mountainSpringThreshold = () => (riverThreshold >= 500000 ? Infinity
        : Math.max(8, Math.round(riverThreshold * 0.38 * riverAreaScale)));

    // ---------------- 中心線の抽出 ----------------
    function computeLakeOutlets() {
        const lakeCount = lakeLevels.length;
        const lakeCellCnt = new Int32Array(lakeCount);
        const lakeBestOutlet = new Int32Array(lakeCount).fill(-1);
        const bestScore = new Float64Array(lakeCount).fill(-Infinity);
        for (let i = 0; i < n; i++) {
            if (!inside[i] || lakeId[i] <= 0) continue;
            const id = lakeId[i];
            lakeCellCnt[id]++;
            const d = down[i];
            if (d < 0 || !inside[d] || lakeId[d] > 0 || snowBuffer[d]) continue;
            const score = (acc[i] + mtAcc[i]) * 1000 - flowF[d];
            if (score > bestScore[id]) { bestScore[id] = score; lakeBestOutlet[id] = d; }
        }
        return { lakeCellCnt, lakeBestOutlet };
    }

    function traceRiverDownstream(start, lakeBestOutlet, lakeDrains, lakeQueue) {
        let cur = start;
        const path = [];
        let reachedSink = false;
        for (let step = 0; step < n; step++) {
            if (cur < 0 || !inside[cur]) { reachedSink = path.length > 0; break; }
            if (snowBuffer[cur]) break;
            if (lakeId[cur] > 0) {
                const hit = lakeId[cur];
                if (!isLakeFrozen(hit)) {
                    reachedSink = true;
                    if (lakeBestOutlet[hit] >= 0 && !lakeDrains[hit]) {
                        lakeDrains[hit] = 1;
                        lakeQueue.push(hit);
                    }
                }
                break;
            }
            if (centerRiver[cur]) { reachedSink = true; break; }
            centerRiver[cur] = 1;
            path.push(cur);
            cur = down[cur];
        }
        // 島の端や既存水系・不凍湖へ合流できずに雪線等で途切れる極短な枝線は戻す
        if (!reachedSink && path.length <= 5) for (const p of path) centerRiver[p] = 0;
    }

    function pruneSourcelessRivers(lakeDrains) {
        const hasUp = new Uint8Array(n);
        const lakeFed = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
            const d = down[i];
            if (d < 0 || !centerRiver[d]) continue;
            if (centerRiver[i]) hasUp[d] = 1;
            else if (lakeId[i] > 0 && !isLakeFrozen(lakeId[i]) && (!lakeDrains || lakeDrains[lakeId[i]])) lakeFed[d] = 1;
        }
        const spring = mountainSpringThreshold();
        const valid = new Uint8Array(n);
        const hasLakeAncestor = new Uint8Array(n);
        for (const i of order) {
            if (!centerRiver[i]) continue;
            if (lakeFed[i]) { valid[i] = 1; hasLakeAncestor[i] = 1; }
            else if (!hasUp[i] && !snowBuffer[i] && mountain[i] >= 0.12 && mtAcc[i] >= spring) valid[i] = 1;
            if (!valid[i]) continue;
            const d = down[i];
            if (d >= 0 && centerRiver[d]) {
                valid[d] = 1;
                if (hasLakeAncestor[i]) hasLakeAncestor[d] = 1;
            }
        }
        // 非湖沼の極短孤立断片(合流せず3セル以下で終わるもの)も除去する
        const inValidDeg = new Int32Array(n);
        for (let i = 0; i < n; i++) {
            if (!valid[i]) continue;
            const d = down[i];
            if (d >= 0 && valid[d]) inValidDeg[d]++;
        }
        for (let s = 0; s < n; s++) {
            if (!valid[s] || inValidDeg[s] !== 0 || lakeFed[s]) continue;
            const chain = [];
            let cur = s, joined = false;
            while (cur >= 0 && valid[cur] && chain.length <= 4) {
                if (cur !== s && inValidDeg[cur] > 1) { joined = true; break; }
                chain.push(cur);
                cur = down[cur];
            }
            if (!joined && chain.length <= 3) for (const x of chain) valid[x] = 0;
        }
        for (let i = 0; i < n; i++) if (centerRiver[i] && !valid[i]) centerRiver[i] = 0;
    }

    function refreshCenterRivers() {
        centerRiver.fill(0);
        const { lakeCellCnt, lakeBestOutlet } = computeLakeOutlets();
        if (!lakeOutletEnabled) lakeBestOutlet.fill(-1);
        const lakeCount = lakeLevels.length;
        const lakeDrains = new Uint8Array(lakeCount);
        const lakeQueue = [];
        const spring = mountainSpringThreshold();
        const minLakeRiverCells = Math.max(3, Math.round((1.5 + riverThreshold * 0.085) * riverAreaScale));

        // 1. 山地・雪解け域から湧出する明確な山岳河川だけをトレース
        for (let i = 0; autoRivers && i < n; i++) {
            if (!inside[i] || snowBuffer[i] || lakeId[i] > 0) continue;
            if (mountain[i] >= 0.12 && mtAcc[i] >= spring) traceRiverDownstream(i, lakeBestOutlet, lakeDrains, lakeQueue);
        }
        // 2. 一定規模以上の不凍湖(および川が流入して溢れる湖)の流出口から川を流す
        for (let id = 1; autoRivers && id < lakeCount; id++) {
            if (!isLakeFrozen(id) && lakeBestOutlet[id] >= 0 && lakeCellCnt[id] >= minLakeRiverCells && !lakeDrains[id]) {
                lakeDrains[id] = 1;
                lakeQueue.push(id);
            }
        }
        for (let h = 0; h < lakeQueue.length; h++) {
            const lid = lakeQueue[h];
            const outlet = lakeBestOutlet[lid];
            if (outlet >= 0 && !snowBuffer[outlet]) traceRiverDownstream(outlet, lakeBestOutlet, lakeDrains, lakeQueue);
        }
        pruneSourcelessRivers(lakeDrains);
        applyManual();
        return { lakeDrains, lakeCellCnt };
    }

    // ---------------- 並走川の合流 ----------------
    function canReachOnDown(start, a, b, cc) {
        let cur = start;
        for (let s = 0; cur >= 0 && s < n; s++) {
            if (cur === a || cur === b || cur === cc) return true;
            cur = down[cur];
        }
        return false;
    }
    function sharesDownstreamSoon(a, b, maxSteps) {
        const traceA = [];
        let lakeA = 0;
        let cur = a;
        for (let s = 0; s <= maxSteps && cur >= 0 && traceA.length < 8; s++) {
            traceA.push(cur);
            if (lakeId[cur] > 0) { lakeA = lakeId[cur]; break; }
            cur = down[cur];
        }
        cur = b;
        for (let s = 0; s <= maxSteps && cur >= 0; s++) {
            if (traceA.includes(cur)) return true;
            if (lakeA > 0 && lakeId[cur] === lakeA) return true;
            if (lakeId[cur] > 0) break;
            cur = down[cur];
        }
        return false;
    }
    function mergeParallelRivers(maxHops) {
        const centerInDeg = new Int32Array(n);
        for (let i = 0; i < n; i++) {
            if (!inside[i]) continue;
            const d = down[i];
            if (d >= 0 && centerRiver[d] && (centerRiver[i] || lakeId[i] > 0)) centerInDeg[d]++;
        }
        const visitedStamp = new Int32Array(n);
        const prevNode = new Int32Array(n);
        const hopDist = new Int32Array(n);
        let stamp = 0;
        const maxDistXZ = cellSize * (maxHops + 0.35);
        const maxBridgeClimb = Math.max(riverBankDepth * 1.35, 4.0);
        let mergedAny = false;

        for (const u of order) {
            if (!centerRiver[u] || manual[u]) continue;
            const oldD = down[u];
            if (oldD < 0 || !inside[oldD]) continue;
            stamp++;
            visitedStamp[u] = stamp;
            prevNode[u] = -1;
            hopDist[u] = 0;
            const bfsQ = [u];
            let bestTarget = -1, bestFrom = -1, bestHops = Infinity, bestScore = -Infinity;

            for (let qh = 0; qh < bfsQ.length; qh++) {
                const cur = bfsQ[qh];
                const nextHop = hopDist[cur] + 1;
                if (nextHop > maxHops) continue;
                for (let k = 0; k < 6; k++) {
                    const nb = Nb(cur, k);
                    if (nb < 0 || !inside[nb] || lakeId[nb] > 0 || snowBuffer[nb] || visitedStamp[nb] === stamp) continue;
                    if (centerRiver[nb]) {
                        visitedStamp[nb] = stamp;
                        if (nb === oldD) continue;
                        if (flowF[nb] >= flowF[u] - 0.0005) continue;
                        const dXZ = dist2(xz[u], xz[nb]);
                        if (dXZ > maxDistXZ) continue;
                        if (nextHop >= 2 && acc[nb] < acc[u] * 0.6 && mask[u] > cliffWidth * 3) continue;
                        if (sharesDownstreamSoon(u, nb, 7)) continue;
                        const m1 = cur !== u ? cur : -1;
                        const m2 = m1 >= 0 && prevNode[cur] !== u ? prevNode[cur] : -1;
                        if (H[nb] > H[u] + maxBridgeClimb) continue;
                        if (canReachOnDown(nb, u, m1, m2)) continue;
                        const score = -nextHop * 1000 + acc[nb] - dXZ * 5;
                        if (nextHop < bestHops || (nextHop === bestHops && score > bestScore)) {
                            bestHops = nextHop; bestScore = score; bestTarget = nb; bestFrom = cur;
                        }
                    } else if (nextHop < maxHops) {
                        if (H[nb] > H[u] + maxBridgeClimb) continue;
                        visitedStamp[nb] = stamp;
                        prevNode[nb] = cur;
                        hopDist[nb] = nextHop;
                        bfsQ.push(nb);
                    }
                }
            }
            if (bestTarget < 0) continue;

            const pathNodes = [];
            let curP = bestFrom;
            while (curP >= 0 && curP !== u) { pathNodes.push(curP); curP = prevNode[curP]; }
            let prevChain = u;
            for (let p = pathNodes.length - 1; p >= 0; p--) {
                const mid = pathNodes[p];
                down[prevChain] = mid;
                if (!centerRiver[mid]) { centerRiver[mid] = 1; centerInDeg[mid] = 1; }
                else centerInDeg[mid]++;
                prevChain = mid;
            }
            down[prevChain] = bestTarget;
            centerInDeg[bestTarget]++;
            mergedAny = true;

            let tail = oldD;
            while (tail >= 0 && centerRiver[tail]) {
                centerInDeg[tail]--;
                if (centerInDeg[tail] > 0) break;
                centerRiver[tail] = 0;
                tail = down[tail];
            }
        }
        if (mergedAny) {
            buildTopologicalOrder();
            computeAccumulation();
            refreshCenterRivers();
        }
    }

    // ---------------- 位相の整理 ----------------
    function cleanRiverTopology(lakeDrains) {
        const inDeg = new Int32Array(n);
        const lakeFed = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
            const dn = down[i];
            if (dn < 0 || !centerRiver[dn]) continue;
            if (centerRiver[i]) inDeg[dn]++;
            else if (lakeId[i] > 0 && !isLakeFrozen(lakeId[i]) && (!lakeDrains || lakeDrains[lakeId[i]])) lakeFed[dn] = 1;
        }
        const stubs = [];
        for (let s = 0; s < n; s++) {
            if (!centerRiver[s] || inDeg[s] !== 0 || lakeFed[s]) continue;
            const chain = [s];
            let cur = down[s];
            while (cur >= 0 && centerRiver[cur] && inDeg[cur] === 1 && chain.length < 3) {
                if (lakeFed[cur]) break;
                chain.push(cur);
                cur = down[cur];
            }
            if (cur >= 0 && centerRiver[cur] && inDeg[cur] >= 2 && chain.length <= 2) {
                stubs.push({ tailAcc: acc[chain[chain.length - 1]], merge: cur, chain });
            }
        }
        stubs.sort((x, y) => x.tailAcc - y.tailAcc);
        for (const st of stubs) {
            if (!centerRiver[st.merge] || inDeg[st.merge] < 2) continue;
            if (st.tailAcc >= acc[st.merge] * 0.5) continue;
            for (const x of st.chain) { centerRiver[x] = 0; inDeg[x] = 0; }
            inDeg[st.merge]--;
        }
        for (let pass = 0; pass < 2; pass++) {
            for (const u of order) {
                if (!centerRiver[u]) continue;
                const v = down[u];
                if (v < 0 || !centerRiver[v] || inDeg[v] !== 1 || lakeFed[v]) continue;
                const w = down[v];
                if (w < 0 || !centerRiver[w] || u === w || !areNeighbors(u, w)) continue;
                centerRiver[v] = 0;
                inDeg[v] = 0;
                down[u] = w;
            }
        }
    }

    function relaxRiverAndBankPositions() {
        const inCnt = new Int32Array(n);
        const upNode = new Int32Array(n).fill(-1);
        for (let i = 0; i < n; i++) {
            if (!inside[i] || !centerRiver[i]) continue;
            const dn = down[i];
            if (dn >= 0 && centerRiver[dn]) { inCnt[dn]++; upNode[dn] = i; }
        }
        for (let i = 0; i < n; i++) {
            if (!inside[i]) continue;
            if (centerRiver[i]) {
                setXz(i, xz[i].x + (baseXz[i].x - xz[i].x) * 0.18, xz[i].z + (baseXz[i].z - xz[i].z) * 0.18);
            } else if (lakeId[i] === 0) {
                for (let k = 0; k < 6; k++) {
                    const nb = Nb(i, k);
                    if (nb >= 0 && centerRiver[nb]) {
                        setXz(i, xz[i].x + (baseXz[i].x - xz[i].x) * 0.20, xz[i].z + (baseXz[i].z - xz[i].z) * 0.20);
                        break;
                    }
                }
            }
        }
        // 直線化を抑えつつ中心線の折れ目を滑らかな曲線にする
        const maxShift = Math.min(0.32, Math.max(0.22, c.jitter)) * cellSize;
        const maxShiftSq = maxShift * maxShift;
        for (let pass = 0; pass < 2; pass++) {
            const tmp = xz.slice();
            for (let i = 0; i < n; i++) {
                if (!inside[i] || !centerRiver[i] || inCnt[i] !== 1) continue;
                const up = upNode[i], dn = down[i];
                if (up < 0 || dn < 0 || !centerRiver[dn]) continue;
                const mx = (xz[up].x + xz[dn].x) * 0.5, mz = (xz[up].z + xz[dn].z) * 0.5;
                const sx = xz[i].x + (mx - xz[i].x) * 0.38, sz = xz[i].z + (mz - xz[i].z) * 0.38;
                let ox = sx - baseXz[i].x, oz = sz - baseXz[i].z;
                const sq = ox * ox + oz * oz;
                if (sq > maxShiftSq) { const l = Math.sqrt(sq); ox = ox / l * maxShift; oz = oz / l * maxShift; }
                tmp[i] = { x: baseXz[i].x + ox, y: baseXz[i].z + oz, z: baseXz[i].z + oz };
            }
            for (let i = 0; i < n; i++) xz[i] = tmp[i];
        }
    }

    // ---------------- 流量 ----------------
    function buildRiverDischarge(lakeCellCnt) {
        const discharge = new Int32Array(n);
        const manualFloor = Math.ceil(Math.max(1, riverThreshold * riverAreaScale) * 2.5);
        for (let i = 0; i < n; i++) if (centerRiver[i]) discharge[i] = Math.max(acc[i], mtAcc[i], manual[i] ? manualFloor : 0);
        for (let i = 0; i < n; i++) {
            if (!inside[i] || lakeId[i] <= 0 || isLakeFrozen(lakeId[i])) continue;
            const d = down[i];
            if (d >= 0 && centerRiver[d]) {
                discharge[d] = Math.max(discharge[d], acc[i] + mtAcc[i] + lakeCellCnt[lakeId[i]] * 3);
            }
        }
        for (const r of order) {
            if (!centerRiver[r]) continue;
            const dn = down[r];
            if (dn >= 0 && centerRiver[dn]) discharge[dn] = Math.max(discharge[dn], discharge[r] + 1);
        }
        return discharge;
    }

    // ================= 実行 =================
    let res = refreshCenterRivers();
    mergeParallelRivers(2);
    mergeParallelRivers(3);
    res = refreshCenterRivers();
    cleanRiverTopology(res.lakeDrains);
    pruneSourcelessRivers(res.lakeDrains);
    applyManual();
    relaxRiverAndBankPositions();
    const riverDischarge = buildRiverDischarge(res.lakeCellCnt);
    carveWideRiversAndLevees(riverDischarge);

    // ---------------- 広い川・深い川底・土手・岸の平坦テラス ----------------
    function carveWideRiversAndLevees(accIn) {
        let hasAny = false;
        for (let i = 0; i < n; i++) if (centerRiver[i]) { hasAny = true; break; }
        if (!hasAny) return;

        const origH = Float32Array.from(H);
        const upRiver = new Int32Array(n).fill(-1);
        const bestUpAcc = new Int32Array(n);
        const inRiverCnt = new Int32Array(n);
        const tribCount = new Int32Array(n);
        for (let i = 0; i < n; i++) {
            if (!centerRiver[i]) continue;
            const dn = down[i];
            if (dn >= 0 && centerRiver[dn]) {
                inRiverCnt[dn]++;
                if (accIn[i] > bestUpAcc[dn]) { bestUpAcc[dn] = accIn[i]; upRiver[dn] = i; }
            }
        }
        for (let i = 0; i < n; i++) if (centerRiver[i] && inRiverCnt[i] === 0) tribCount[i] = 1;
        for (const r of order) {
            if (!centerRiver[r]) continue;
            if (tribCount[r] < 1) tribCount[r] = 1;
            const dn = down[r];
            if (dn >= 0 && centerRiver[dn]) tribCount[dn] += tribCount[r];
        }

        // 1. 中心線の基準高を平滑化
        const refH = Float32Array.from(origH);
        const tmp = new Float32Array(n);
        for (let pass = 0; pass < 3; pass++) {
            tmp.set(refH);
            for (let i = 0; i < n; i++) {
                if (!centerRiver[i]) continue;
                let wSum = 1, hSum = tmp[i];
                const up = upRiver[i];
                if (up >= 0 && centerRiver[up]) {
                    const w = 0.5 / (1 + Math.abs(tmp[up] - tmp[i]) * 0.4);
                    hSum += tmp[up] * w; wSum += w;
                }
                const dn = down[i];
                if (dn >= 0 && centerRiver[dn]) {
                    const w = 0.5 / (1 + Math.abs(tmp[dn] - tmp[i]) * 0.4);
                    hSum += tmp[dn] * w; wSum += w;
                }
                refH[i] = hSum / wSum;
            }
        }

        const NEG = -Infinity;
        const lakeOutletLvl = new Float64Array(n).fill(NEG);
        const distFromLakeOutlet = new Int32Array(n).fill(-1);
        const lakeInletLvl = new Float64Array(n).fill(NEG);
        const distToLakeInlet = new Int32Array(n).fill(-1);
        const minBackwaterY = new Float64Array(n).fill(NEG);
        for (let i = 0; i < n; i++) {
            if (!inside[i] || lakeId[i] <= 0 || isLakeFrozen(lakeId[i])) continue;
            const d = down[i];
            if (d >= 0 && centerRiver[d]) {
                lakeOutletLvl[d] = Math.max(lakeOutletLvl[d], lakeLevels[lakeId[i]]);
                distFromLakeOutlet[d] = 0;
            }
        }
        for (let i = 0; i < n; i++) {
            if (!centerRiver[i]) continue;
            const d = down[i];
            if (d >= 0 && lakeId[d] > 0 && !isLakeFrozen(lakeId[d])) {
                lakeInletLvl[i] = Math.max(lakeInletLvl[i], lakeLevels[lakeId[d]]);
                distToLakeInlet[i] = 0;
            }
        }
        for (const r of order) {
            if (!centerRiver[r] || distFromLakeOutlet[r] < 0) continue;
            const dn = down[r];
            if (dn >= 0 && centerRiver[dn] && distFromLakeOutlet[dn] < 0 && upRiver[dn] === r) {
                distFromLakeOutlet[dn] = distFromLakeOutlet[r] + 1;
            }
        }
        // 湖の流入口では上流側の水面が湖面より低くならないよう、湖水位を下流→上流へ伝播する
        for (let oi = order.length - 1; oi >= 0; oi--) {
            const r = order[oi];
            if (!centerRiver[r]) continue;
            if (lakeInletLvl[r] > NEG) minBackwaterY[r] = Math.max(minBackwaterY[r], lakeInletLvl[r] + 0.015);
            const dn = down[r];
            if (dn >= 0 && centerRiver[dn]) {
                if (minBackwaterY[dn] > NEG) minBackwaterY[r] = Math.max(minBackwaterY[r], minBackwaterY[dn] + 0.005);
                if (distToLakeInlet[dn] >= 0) {
                    const candD = distToLakeInlet[dn] + 1;
                    if (distToLakeInlet[r] < 0 || candD < distToLakeInlet[r]) distToLakeInlet[r] = candD;
                }
            }
        }

        // 2. 中心線ごとの水深・土手深さ・川幅
        const centerWaterY = new Float32Array(n);
        const centerWaterDepth = new Float32Array(n);
        const centerBankHeight = new Float32Array(n);
        const centerHalfWidth = new Float32Array(n);
        const scaledRiverThresh = Math.max(1, riverThreshold * riverAreaScale);

        for (let i = 0; i < n; i++) {
            if (!centerRiver[i]) continue;
            const flow01 = clamp(Math.log2(Math.max(1, accIn[i] / scaledRiverThresh)) * 0.34, 0, 1);
            const mergeBonus = clamp((tribCount[i] - 1) * 0.35, 0, 1);
            const preMergeCap = 0.32 + clamp((tribCount[i] - 1) * 0.34, 0, 1);
            const effectiveFlow = Math.min(flow01, preMergeCap);
            const flowScale = 0.86 + (1.45 - 0.86) * Math.max(flow01, mergeBonus * 0.75);
            const edgeFade = 0.90 + 0.10 * Smooth(0, cliffWidth * 0.6, mask[i]);

            const wDepth = (plainsRiverDepth + (riverDepth - plainsRiverDepth) * mountain[i]) * flowScale * edgeFade;
            const mixT = mountain[i] * 0.5 + flow01 * 0.5;
            let bDepth = riverBankDepth * (0.85 + (1.35 - 0.85) * mixT)
                * (0.95 + 0.05 * Smooth(0, cliffWidth * 0.6, mask[i]));
            let bankLakeEase = 1;
            if (distFromLakeOutlet[i] >= 0 && distFromLakeOutlet[i] < 6) bankLakeEase = Math.min(bankLakeEase, Smooth(0, 5, distFromLakeOutlet[i]));
            if (distToLakeInlet[i] >= 0 && distToLakeInlet[i] < 6) bankLakeEase = Math.min(bankLakeEase, Smooth(0, 5, distToLakeInlet[i]));
            bDepth = 0.05 + (bDepth - 0.05) * bankLakeEase;
            const widthWeight = clamp(effectiveFlow * 0.50 + mergeBonus * 0.50, 0, 1);
            let halfW = Math.max(cellSize * 0.80, riverWidth * 0.5 * (0.56 + (1.48 - 0.56) * widthWeight));
            if (tribCount[i] >= 2) halfW += cellSize * 0.32 * Math.min(1.6, 0.75 + (tribCount[i] - 2) * 0.45);

            centerWaterDepth[i] = Math.max(0.8, wDepth);
            centerBankHeight[i] = Math.max(0.05, bDepth);
            centerHalfWidth[i] = halfW;

            // 水面は元の地面より「土手の深さ(bDepth)」だけ低い位置に置く
            centerWaterY[i] = Math.max(1.0, refH[i] - centerBankHeight[i]);
            if (lakeOutletLvl[i] > NEG) centerWaterY[i] = Math.min(centerWaterY[i], lakeOutletLvl[i] - 0.03);
            if (minBackwaterY[i] > NEG) centerWaterY[i] = Math.max(centerWaterY[i], minBackwaterY[i]);
        }

        // 3. 中心線の水面高と川幅を平滑化（水面は単調減少、川幅は合流後の太さを維持）
        for (let pass = 0; pass < 2; pass++) {
            tmp.set(centerHalfWidth);
            for (let i = 0; i < n; i++) {
                if (!centerRiver[i]) continue;
                let wSum = 1, hwSum = tmp[i];
                const up = upRiver[i];
                if (up >= 0 && centerRiver[up]) { hwSum += tmp[up] * 0.45; wSum += 0.45; }
                const dn = down[i];
                if (dn >= 0 && centerRiver[dn]) { hwSum += tmp[dn] * 0.45; wSum += 0.45; }
                centerHalfWidth[i] = hwSum / wSum;
            }
        }
        for (const r of order) {
            if (!centerRiver[r]) continue;
            const dn = down[r];
            if (dn >= 0 && centerRiver[dn]) centerHalfWidth[dn] = Math.max(centerHalfWidth[dn], centerHalfWidth[r] * 0.96);
        }
        for (let pass = 0; pass < 3; pass++) {
            tmp.set(centerWaterY);
            for (let i = 0; i < n; i++) {
                if (!centerRiver[i]) continue;
                let wSum = 1, hSum = tmp[i];
                const up = upRiver[i];
                if (up >= 0 && centerRiver[up]) {
                    const w = 0.5 / (1 + Math.abs(tmp[up] - tmp[i]) * 0.5);
                    hSum += tmp[up] * w; wSum += w;
                }
                const dn = down[i];
                if (dn >= 0 && centerRiver[dn]) {
                    const w = 0.5 / (1 + Math.abs(tmp[dn] - tmp[i]) * 0.5);
                    hSum += tmp[dn] * w; wSum += w;
                }
                centerWaterY[i] = hSum / wSum;
            }
        }
        for (let i = 0; i < n; i++) {
            if (!centerRiver[i]) continue;
            if (minBackwaterY[i] > NEG) centerWaterY[i] = Math.max(centerWaterY[i], minBackwaterY[i]);
            if (lakeOutletLvl[i] > NEG) {
                const minOut = minBackwaterY[i] > NEG
                    ? Math.max(minBackwaterY[i], lakeOutletLvl[i] - 0.45)
                    : lakeOutletLvl[i] - 0.45;
                const maxOut = Math.max(minOut, lakeOutletLvl[i] - 0.02);
                centerWaterY[i] = clamp(centerWaterY[i], minOut, maxOut);
            }
        }
        const minUpW = new Float32Array(n).fill(Infinity);
        for (const r of order) {
            if (!centerRiver[r]) continue;
            if (minUpW[r] < Infinity) centerWaterY[r] = Math.min(centerWaterY[r], minUpW[r] - 0.005);
            if (minBackwaterY[r] > NEG) centerBankHeight[r] = Math.min(centerBankHeight[r], Math.max(0.15, refH[r] - centerWaterY[r]));
            const dn = down[r];
            if (dn >= 0 && centerRiver[dn]) minUpW[dn] = Math.min(minUpW[dn], centerWaterY[r]);
        }

        // 3.5. 河口の浅瀬: 島の縁(河口)に近づくほど川底を水面近くまで上げ、土手も低くする。
        //      川底が水面より何mも低いまま縁に着くと、水面が岩の壁に挟まれた細い先端になり、滝へ自然に繋がらない。
        //      水面の高さ(centerWaterY)は変えず、地形のほうを河口へ向かって浅く均す(滝口の水が縁まで届く)。
        const mouthDist = new Float32Array(n).fill(Infinity);
        const mouthLen = Math.max(cellSize * 4.5, 9);
        {
            const mq = new MinHeap();
            for (let i = 0; i < n; i++) {
                if (!centerRiver[i] || !inside[i]) continue;
                const d = down[i];
                if (d >= 0 && centerRiver[d]) continue;
                let nearOut = false;
                for (let k = 0; k < 6; k++) {
                    const nb = Nb(i, k);
                    if (nb >= 0 && !inside[nb]) { nearOut = true; break; }
                }
                if (!nearOut) continue;
                mouthDist[i] = 0;
                mq.push(0, i);
            }
            while (mq.size > 0) {
                const { key, val: u } = mq.pop();
                if (key > mouthDist[u] + 1e-4) continue;
                for (let k = 0; k < 6; k++) {
                    const nb = Nb(u, k);
                    if (nb < 0 || !centerRiver[nb] || !inside[nb]) continue;
                    const nd = key + dist2(xz[u], xz[nb]);
                    if (nd < mouthDist[nb] && nd < mouthLen) { mouthDist[nb] = nd; mq.push(nd, nb); }
                }
            }
            for (let i = 0; i < n; i++) {
                if (!(mouthDist[i] < mouthLen)) continue;
                const mt = Smooth(0, mouthLen, mouthDist[i]);
                centerWaterDepth[i] = MOUTH_WATER_DEPTH + (centerWaterDepth[i] - MOUTH_WATER_DEPTH) * mt;
                centerBankHeight[i] = MOUTH_BANK_HEIGHT + (centerBankHeight[i] - MOUTH_BANK_HEIGHT) * mt;
            }
        }

        // 4. 川の中心線から周囲へ距離フィールド(Dijkstra)を伝播させる
        const distToCenter = new Float32Array(n).fill(Infinity);
        const nearestCenter = new Int32Array(n).fill(-1);
        let maxHalfW = riverWidth * 0.5;
        for (let i = 0; i < n; i++) if (centerRiver[i]) maxHalfW = Math.max(maxHalfW, centerHalfWidth[i]);
        const dPq = new MinHeap();
        const maxInfluenceRadius = maxHalfW + cellSize * 4.5;
        for (let i = 0; i < n; i++) {
            if (!centerRiver[i]) continue;
            distToCenter[i] = 0;
            nearestCenter[i] = i;
            dPq.push(0, i);
        }
        while (dPq.size > 0) {
            const { key, val: u } = dPq.pop();
            if (key > distToCenter[u] + 1e-4) continue;
            for (let k = 0; k < 6; k++) {
                const nb = Nb(u, k);
                if (nb < 0 || !inside[nb] || lakeId[nb] > 0 || snowBuffer[nb]) continue;
                const nd = key + dist2(xz[u], xz[nb]);
                if (nd < distToCenter[nb] && nd <= maxInfluenceRadius) {
                    distToCenter[nb] = nd;
                    nearestCenter[nb] = nearestCenter[u];
                    dPq.push(nd, nb);
                }
            }
        }

        // 5. 川底・土手の急斜面・土手上の平坦な岸辺テラスを適用
        //    (テラス幅はUnity版の 3.8m/5.0m だと小さな島に対して大き過ぎるため、このツールの島サイズに合わせて縮めている)
        const bankSlopeSpan = Math.max(cellSize * 1.15, 2.6);
        const leveeFlatSpan = Math.max(cellSize * 1.25, 3.0);
        for (let i = 0; i < n; i++) {
            const src = nearestCenter[i];
            if (src < 0 || !inside[i] || lakeId[i] > 0 || snowBuffer[i]) continue;
            const d = distToCenter[i];
            const halfW = centerHalfWidth[src];
            let waterY = centerWaterY[src];
            const wDepth = centerWaterDepth[src];
            const bankH = centerBankHeight[src];

            // 隣接する(凍っていない)湖がある場合は水面高を揃える
            for (let k = 0; k < 6; k++) {
                const nb = Nb(i, k);
                if (nb >= 0 && lakeId[nb] > 0 && !isLakeFrozen(lakeId[nb])) waterY = Math.max(waterY, lakeLevels[lakeId[nb]]);
            }

            if (d <= halfW) {
                river[i] = 1;
                riverW[i] = waterY;
                const normD = halfW > 0.01 ? clamp(d / halfW, 0, 1) : 0;
                const bedProfile = 1.0 + (0.72 - 1.0) * normD * normD;
                H[i] = Math.max(SafeBedFloor(i), waterY - wDepth * bedProfile);
            } else if (d <= halfW + bankSlopeSpan) {
                bankSlopeFlag[i] = 1;
                const t = clamp((d - halfW) / bankSlopeSpan, 0, 1);
                const leveeTopY = waterY + bankH;
                const a0 = waterY - wDepth * 0.55;
                const carvedY = a0 + (leveeTopY - a0) * Smooth(0, 1, t);
                H[i] = Math.max(SafeBedFloor(i), Math.min(origH[i], carvedY));
                if (H[i] < leveeTopY && origH[i] < leveeTopY) H[i] = carvedY + (leveeTopY - carvedY) * t;
            } else if (d <= halfW + bankSlopeSpan + leveeFlatSpan) {
                const t = clamp((d - halfW - bankSlopeSpan) / leveeFlatSpan, 0, 1);
                const leveeTopY = waterY + bankH;
                const flatWeight = (1 - Smooth(0, 1, t)) * (1 - mountain[i] * 0.55);
                const targetY = Math.max(leveeTopY, origH[i] + (leveeTopY - origH[i]) * 0.72);
                H[i] = origH[i] + (targetY - origH[i]) * flatWeight;
            }
        }

        // 5.5. 合流点や近接川に挟まれた1頂点幅の薄い仕切り壁を解消して水面を一体化
        const snapRiver = new Uint8Array(n);
        for (let pass = 0; pass < 2; pass++) {
            snapRiver.set(river);
            for (let b = 0; b < n; b++) {
                if (!inside[b] || snapRiver[b] || lakeId[b] > 0 || snowBuffer[b]) continue;
                let riverNbCnt = 0, arcCount = 0, prevIsRiver = false, nb0River = false, sumW = 0, sumBedDrop = 0;
                for (let k = 0; k < 6; k++) {
                    const nb = Nb(b, k);
                    const isR = nb >= 0 && snapRiver[nb] && !Number.isNaN(riverW[nb]);
                    if (k === 0) nb0River = isR;
                    if (isR) {
                        riverNbCnt++;
                        sumW += riverW[nb];
                        const src = nearestCenter[nb];
                        sumBedDrop += src >= 0 ? centerWaterDepth[src] : plainsRiverDepth;
                        if (k > 0 && !prevIsRiver) arcCount++;
                    }
                    prevIsRiver = isR;
                }
                if (nb0River && !prevIsRiver) arcCount++;
                if (arcCount < 2 && riverNbCnt < 5) continue;
                const avgW = sumW / riverNbCnt;
                if (origH[b] > avgW + riverBankDepth * 2.5 + cellSize * 0.8) continue;
                river[b] = 1;
                bankSlopeFlag[b] = 0;
                riverW[b] = avgW;
                const avgDrop = sumBedDrop / riverNbCnt;
                H[b] = Math.min(H[b], Math.max(SafeBedFloor(b), avgW - avgDrop * 0.85));
            }
        }

        // 6. 水面メッシュが土手の斜面に隙間なく食い込むよう、riverに隣接する1マスにもriverWを設定
        for (let b = 0; b < n; b++) {
            if (!inside[b] || river[b] || lakeId[b] > 0 || snowZone[b]) continue;
            let sumW = 0, cnt = 0;
            for (let k = 0; k < 6; k++) {
                const nb = Nb(b, k);
                if (nb >= 0 && river[nb] && !Number.isNaN(riverW[nb])) { sumW += riverW[nb]; cnt++; }
            }
            if (cnt > 0) {
                riverW[b] = sumW / cnt;
                // 河口に近い岸は、水面のすぐ上までしか持ち上げない(河口の両側に高い壁を作らない)
                let ease = 1;
                for (let k = 0; k < 6; k++) {
                    const nb = Nb(b, k);
                    if (nb < 0 || !river[nb]) continue;
                    const src = nearestCenter[nb];
                    if (src >= 0 && mouthDist[src] < mouthLen) ease = Math.min(ease, Smooth(0, mouthLen, mouthDist[src]));
                }
                const rimLift = MOUTH_BANK_HEIGHT + (Math.min(1.2, riverBankDepth * 0.45) - MOUTH_BANK_HEIGHT) * ease;
                const minRim = riverW[b] + rimLift;
                if (H[b] < minRim) H[b] = minRim;
            }
        }
    }

    const riverCenterOrdered = order.filter(i => centerRiver[i]);
    // 水源→合流/河口までの経路 (3Dギズモ表示用)
    const riverPaths = [];
    {
        const hasUp = new Uint8Array(n), used = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
            const d = down[i];
            if (centerRiver[i] && d >= 0 && centerRiver[d]) hasUp[d] = 1;
        }
        for (let s = 0; s < n; s++) {
            if (!centerRiver[s] || hasUp[s]) continue;
            const path = [];
            let cur = s;
            while (cur >= 0 && centerRiver[cur] && path.length < n) {
                path.push(cur);
                if (used[cur]) break;
                used[cur] = 1;
                cur = down[cur];
            }
            if (path.length >= 2) riverPaths.push(path);
        }
    }
    return { riverCenterOrdered, riverPaths };
}
