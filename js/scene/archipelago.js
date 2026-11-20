import { buildBridgePlanks } from '../generators/bridge-generator.js';
import { buildSingleIsland } from '../generators/island-generator.js';
import { ColoredMeshBuilder } from '../mesh/colored-mesh-builder.js';
import { routeEditState } from './scene.js';
import { state } from '../state.js';
import { hexToRgb } from '../utils/math.js';

// =========================================================================
// 7. 群島全体の統合ビルド & シーン構築
// =========================================================================
export const showFlags = {
    wire: false,
    water: true,
    veg: true
};

export function buildArchipelagoStage() {
    const palette = {
        grass: hexToRgb(state.grassColor),
        forest: hexToRgb(state.forestGroundColor),
        sand: hexToRgb(state.sandColor),
        rock: hexToRgb(state.rockColor),
        snow: hexToRgb(state.snowColor),
        under: hexToRgb(state.underColor),
        water: hexToRgb(state.waterColor),
        trunk: hexToRgb(state.trunkColor),
        leaf: hexToRgb(state.leafColor),
        wood: hexToRgb(state.woodColor)
    };

    const builtIslands = [];
    for (let i = 0; i < state.islands.length; i++) {
        const prevCfg = i > 0 ? state.islands[i - 1] : null;
        const nextCfg = i + 1 < state.islands.length ? state.islands[i + 1] : null;
        builtIslands.push(buildSingleIsland(state.islands[i], prevCfg, nextCfg, palette));
    }

    const allBridgeMb = new ColoredMeshBuilder();
    const builtBridges = [];

    for (let i = 0; i < builtIslands.length; i++) {
        const isl = builtIslands[i];
        // 島内の渡河小橋
        if (!routeEditState.soloIsland || i === state.selectedIslandIdx) {
            for (let bIdx = 0; bIdx < isl.internalBridges.length; bIdx++) {
                const ib = isl.internalBridges[bIdx];
                const brSag = ib.sag !== undefined ? ib.sag : 0.22;
                const br = buildBridgePlanks(
                    ib.start, ib.end,
                    Math.max(1.18, state.bridgeWidth * 0.85), brSag,
                    state.bridgeIrregularity * 0.55, palette.wood,
                    isl.seed + 50 + bIdx,
                    ib.startGroundY, ib.endGroundY
                );
                for (let k = 0; k < br.mb.v.length; k++) {
                    allBridgeMb.v.push(br.mb.v[k]);
                    allBridgeMb.c.push(br.mb.c[k]);
                    allBridgeMb.a.push(br.mb.a[k]);
                }
                builtBridges.push({ start: ib.start, end: ib.end, mid: br.midPos, islandIdx: i });
            }
        }

        // 次の島への連結吊り橋
        const islCfg = state.islands[i];
        if (!routeEditState.soloIsland && i + 1 < builtIslands.length && islCfg.hasBridgeToNext !== false) {
            const nextIsl = builtIslands[i + 1];
            const shoreA = isl.exitShorePos;
            const shoreB = nextIsl.entryShorePos;
            const br = buildBridgePlanks(
                shoreA, shoreB,
                state.bridgeWidth, state.bridgeSag, state.bridgeIrregularity,
                palette.wood, 12345 + i * 77,
                isl.exitGroundY, nextIsl.entryGroundY
            );
            for (let k = 0; k < br.mb.v.length; k++) {
                allBridgeMb.v.push(br.mb.v[k]);
                allBridgeMb.c.push(br.mb.c[k]);
                allBridgeMb.a.push(br.mb.a[k]);
            }
            builtBridges.push({ start: shoreA, end: shoreB, mid: br.midPos, isInterIsland: true, islandIdx: i });
        }
    }

    const firstIsl = builtIslands[0];
    const lastIsl = builtIslands[builtIslands.length - 1];

    return {
        builtIslands,
        builtBridges,
        allBridgeMb,
        spawnPos: firstIsl ? firstIsl.entryShorePos : { x: 0, y: 10, z: 0 },
        goalPos: lastIsl ? lastIsl.exitShorePos : { x: 0, y: 20, z: -40 }
    };
}
