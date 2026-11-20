import { ColoredMeshBuilder } from '../mesh/colored-mesh-builder.js';
import { shadeColor } from '../utils/math.js';
import { SeededRandom } from '../utils/random.js';

// =========================================================================
// 6. `BridgeGeneratorWindow.cs` (`BridgeMeshGenerator`) 忠実移植 (3D高さ支柱対応)
// =========================================================================
export function buildBridgePlanks(startPt, endPt, width, sag, irregularity, woodColor, bridgeSeed, startGroundY, endGroundY) {
    const mb = new ColoredMeshBuilder();
    const dx = endPt.x - startPt.x;
    const dz = endPt.z - startPt.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.5) return { mb, midPos: startPt };

    const rise = endPt.y - startPt.y;
    const panels = Math.max(3, Math.ceil(Math.hypot(length, rise) / 0.42));
    const half = width * 0.5;
    const random = new SeededRandom(bridgeSeed || 12345);
    const colorRandom = new SeededRandom((bridgeSeed || 12345) + 2);
    const gap = 0.08;
    const colorVariation = 0.22;

    const dirX = dx / length, dirZ = dz / length;
    const rightX = dirZ, rightZ = -dirX;

    function getPointLocal(t) {
        return {
            x: 0,
            y: rise * t - 4.0 * t * (1.0 - t) * sag,
            z: length * t
        };
    }
    function toWorld(lx, ly, lz) {
        return {
            x: startPt.x + rightX * lx + dirX * lz,
            y: startPt.y + ly,
            z: startPt.z + rightZ * lx + dirZ * lz
        };
    }

    // 橋の端点が3次元指定で地表より高い位置に持ち上げられている場合、地面まで木製の支柱（橋脚）を生成する
    function addSupportTrestle(endWorldPt, groundY) {
        if (!Number.isFinite(groundY)) return;
        const hDiff = endWorldPt.y - groundY;
        if (hDiff <= 0.45) return;
        const postCol = shadeColor(woodColor, -0.18);
        const postR = 0.11;
        const postOffsets = [-half * 0.78, half * 0.78];
        for (const lat of postOffsets) {
            const px = endWorldPt.x + rightX * lat;
            const pz = endWorldPt.z + rightZ * lat;
            const yBot = groundY - 0.35;
            const yTop = endWorldPt.y + 0.25;
            for (let s = 0; s < 4; s++) {
                const a0 = (s + 0.5) * Math.PI * 0.5;
                const a1 = (s + 1.5) * Math.PI * 0.5;
                const c0 = Math.cos(a0) * postR, s0 = Math.sin(a0) * postR;
                const c1 = Math.cos(a1) * postR, s1 = Math.sin(a1) * postR;
                mb.quad(
                    { x: px + c0, y: yBot, z: pz + s0 },
                    { x: px + c1, y: yBot, z: pz + s1 },
                    { x: px + c1, y: yTop, z: pz + s1 },
                    { x: px + c0, y: yTop, z: pz + s0 },
                    postCol, postCol, postCol, postCol,
                    { x: c0 + c1, y: 0, z: s0 + s1 }, 1.0
                );
            }
        }
    }
    addSupportTrestle(startPt, startGroundY);
    addSupportTrestle(endPt, endGroundY);

    for (let i = 0; i < panels; i++) {
        const a = i / panels, b = (i + 1) / panels;
        const p = getPointLocal(a), q = getPointLocal(b);
        const segDy = q.y - p.y, segDz = q.z - p.z;
        const segLen = Math.hypot(segDy, segDz) || 0.4;
        const fwdY = segDy / segLen, fwdZ = segDz / segLen;
        const upY = fwdZ, upZ = -fwdY;

        const brightness = 1.0 + colorRandom.signed() * colorVariation;
        const plankCol = shadeColor(woodColor, brightness - 1.0);
        const sideCol = shadeColor(plankCol, -0.12);

        const variation = irregularity;
        const offset = random.signed() * half * 0.16 * variation;
        const plankHalfWidth = half * (1.0 + random.signed() * 0.10 * variation);
        const plankHalfLength = Math.max(0.05, segLen - gap) * 0.5 * (1.0 + random.signed() * 0.10 * variation);
        const angle = random.signed() * 4.0 * variation * (Math.PI / 180.0);
        const cosA = Math.cos(angle), sinA = Math.sin(angle);

        const xAxis = { x: cosA, y: fwdY * sinA, z: fwdZ * sinA };
        const zAxis = { x: -sinA, y: fwdY * cosA, z: fwdZ * cosA };
        const center = { x: offset, y: (p.y + q.y) * 0.5, z: (p.z + q.z) * 0.5 };
        const thick = { x: 0, y: upY * 0.12, z: upZ * 0.12 };

        const top = [], bot = [];
        for (let c = 0; c < 4; c++) {
            const sx = c < 2 ? -1.0 : 1.0;
            const sz = (c === 0 || c === 3) ? -1.0 : 1.0;
            const u = sx * plankHalfWidth + random.signed() * half * 0.035 * variation;
            const v = sz * plankHalfLength + random.signed() * plankHalfLength * 0.07 * variation;
            const lx = center.x + xAxis.x * u + zAxis.x * v;
            const ly = center.y + xAxis.y * u + zAxis.y * v;
            const lz = center.z + xAxis.z * u + zAxis.z * v;
            top.push(toWorld(lx, ly, lz));
            bot.push(toWorld(lx - thick.x, ly - thick.y, lz - thick.z));
        }
        mb.quad(top[0], top[1], top[2], top[3], plankCol, plankCol, plankCol, plankCol, { x: 0, y: 1, z: 0 }, 1.0);
        mb.quad(bot[3], bot[2], bot[1], bot[0], sideCol, sideCol, sideCol, sideCol, { x: 0, y: -1, z: 0 }, 1.0);
        for (let s = 0; s < 4; s++) {
            const nxt = (s + 1) % 4;
            mb.quad(top[s], bot[s], bot[nxt], top[nxt], sideCol, sideCol, sideCol, sideCol, null, 1.0);
        }
    }

    const midLocal = getPointLocal(0.5);
    return { mb, midPos: toWorld(0, midLocal.y, midLocal.z) };
}
