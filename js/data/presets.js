// =========================================================================
// 2. 群島プリセット定義（自然で無理のない橋位置＆迂回ウェイポイント初期値付き）
// =========================================================================
function createPresetIslands(presetKey) {
    if (presetKey === 'spiral_peaks_4') {
        return [
            {
                name: "SpawnMeadowIsland", label: "第1島: スタート見晴らし小島 (44m)",
                width: 44, cellSize: 2.0, posX: -54, posY: -4, posZ: 56, seed: 2101,
                bottomDepthRatio: 0.16, baseHeight: 5.5, plainsAmp: 1.8, mountainAmp: 10, mountainAngle: -135,
                canyonDepth: 0, canyonWidth: 0.12, trailWidth: 1.0, trailGradeSmooth: 0.65,
                maxLakes: 0, riverAmount: 0.0, riverWidth: 4.5, riverBankDepth: 1.8, riverDepth: 2.5,
                hasCave: false, caveHeight: 2.8, caveCurve: 0.2,
                treeScale: 0.95, forestSpread: 0.46, meadowSpread: 0.45, treeMinDist: 3.2, grassMinDist: 1.1, grassDensity: 2.8, grassSlopeMargin: 1.2, rockSlope: 0.72,
                entryNorm: { x: -0.35, z: 0.38 }, exitNorm: { x: 0.55, z: -0.48 },
                waypointsNorm: [], branches: []
            },
            {
                name: "RiverGorgeIsland", label: "第2島: 渓谷湖と渡河の本島 (82m)",
                width: 82, cellSize: 2.1, posX: -2, posY: 0, posZ: 12, seed: 2202,
                bottomDepthRatio: 0.16, baseHeight: 6.5, plainsAmp: 2.4, mountainAmp: 34, mountainAngle: 25,
                canyonDepth: 14, canyonWidth: 0.12, trailWidth: 1.0, trailGradeSmooth: 0.65,
                maxLakes: 1, riverAmount: 1.0, riverWidth: 5.0, riverBankDepth: 1.8, riverDepth: 3.0,
                hasCave: false, caveHeight: 2.8, caveCurve: 0.22,
                treeScale: 1.0, forestSpread: 0.48, meadowSpread: 0.46, treeMinDist: 3.4, grassMinDist: 1.1, grassDensity: 2.8, grassSlopeMargin: 1.4, rockSlope: 0.72,
                entryNorm: { x: -0.56, z: 0.44 }, exitNorm: { x: 0.46, z: -0.52 },
                waypointsNorm: [], branches: []
            },
            {
                name: "RidgePassIsland", label: "第3島: 尾根越えの中継岩島 (52m)",
                width: 52, cellSize: 2.0, posX: 52, posY: 12, posZ: -28, seed: 2303,
                bottomDepthRatio: 0.18, baseHeight: 6.0, plainsAmp: 2.0, mountainAmp: 26, mountainAngle: 45,
                canyonDepth: 8, canyonWidth: 0.11, trailWidth: 0.95, trailGradeSmooth: 0.65,
                maxLakes: 0, riverAmount: 0.0, riverWidth: 4.0, riverBankDepth: 1.6, riverDepth: 2.4,
                hasCave: false, caveHeight: 2.7, caveCurve: -0.2,
                treeScale: 0.95, forestSpread: 0.42, meadowSpread: 0.44, treeMinDist: 3.2, grassMinDist: 1.1, grassDensity: 2.6, grassSlopeMargin: 1.2, rockSlope: 0.72,
                entryNorm: { x: -0.52, z: 0.40 }, exitNorm: { x: -0.36, z: -0.54 },
                waypointsNorm: [], branches: []
            },
            {
                name: "SummitGoalIsland", label: "第4島: 天空の祠ゴール高台島 (54m)",
                width: 54, cellSize: 2.0, posX: 8, posY: 26, posZ: -78, seed: 2404,
                bottomDepthRatio: 0.18, baseHeight: 6.5, plainsAmp: 1.8, mountainAmp: 22, mountainAngle: -85,
                canyonDepth: 7, canyonWidth: 0.11, trailWidth: 1.0, trailGradeSmooth: 0.65,
                maxLakes: 1, riverAmount: 0.8, riverWidth: 4.0, riverBankDepth: 1.5, riverDepth: 2.2,
                hasCave: false, caveHeight: 2.7, caveCurve: 0.15,
                treeScale: 0.95, forestSpread: 0.44, meadowSpread: 0.45, treeMinDist: 3.2, grassMinDist: 1.1, grassDensity: 2.6, grassSlopeMargin: 1.2, rockSlope: 0.72,
                entryNorm: { x: 0.48, z: 0.46 }, exitNorm: { x: -0.18, z: -0.25 },
                waypointsNorm: [], branches: []
            }
        ];
    } else if (presetKey === 'twin_falls_3') {
        return [
            {
                name: "SpawnTerraceIsland", label: "第1島: スタート段丘小島 (46m)",
                width: 46, cellSize: 2.0, posX: -52, posY: -2, posZ: 52, seed: 3101,
                bottomDepthRatio: 0.16, baseHeight: 5.5, plainsAmp: 1.8, mountainAmp: 12, mountainAngle: -120,
                canyonDepth: 0, canyonWidth: 0.12, trailWidth: 1.0, trailGradeSmooth: 0.65,
                maxLakes: 0, riverAmount: 0.0, riverWidth: 4.5, riverBankDepth: 1.8, riverDepth: 2.5,
                hasCave: false, caveHeight: 2.8, caveCurve: 0.2,
                treeScale: 0.95, forestSpread: 0.46, meadowSpread: 0.46, treeMinDist: 3.2, grassMinDist: 1.1, grassDensity: 2.8, grassSlopeMargin: 1.2, rockSlope: 0.72,
                entryNorm: { x: -0.30, z: 0.32 }, exitNorm: { x: 0.54, z: -0.50 },
                waypointsNorm: [], branches: []
            },
            {
                name: "TwinFallsMainIsland", label: "第2島: 大渓谷湖・滝の本島 (94m)",
                width: 94, cellSize: 2.1, posX: 0, posY: 2, posZ: 0, seed: 3206,
                bottomDepthRatio: 0.16, baseHeight: 6.5, plainsAmp: 2.5, mountainAmp: 38, mountainAngle: 35,
                canyonDepth: 16, canyonWidth: 0.13, trailWidth: 0.95, trailGradeSmooth: 0.65,
                maxLakes: 1, riverAmount: 1.0, riverWidth: 5.5, riverBankDepth: 2.0, riverDepth: 3.2,
                hasCave: false, caveHeight: 2.9, caveCurve: 0.25,
                treeScale: 1.0, forestSpread: 0.48, meadowSpread: 0.46, treeMinDist: 3.4, grassMinDist: 1.1, grassDensity: 2.8, grassSlopeMargin: 1.4, rockSlope: 0.72,
                entryNorm: { x: -0.56, z: 0.44 }, exitNorm: { x: 0.44, z: -0.54 },
                waypointsNorm: [], branches: []
            },
            {
                name: "SanctuaryGoalIsland", label: "第3島: 水源の祠・ゴール高台島 (58m)",
                width: 58, cellSize: 2.0, posX: 46, posY: 22, posZ: -62, seed: 3308,
                bottomDepthRatio: 0.18, baseHeight: 6.5, plainsAmp: 2.0, mountainAmp: 25, mountainAngle: 45,
                canyonDepth: 9, canyonWidth: 0.12, trailWidth: 1.0, trailGradeSmooth: 0.65,
                maxLakes: 1, riverAmount: 1.0, riverWidth: 4.2, riverBankDepth: 1.6, riverDepth: 2.4,
                hasCave: false, caveHeight: 2.8, caveCurve: 0.2,
                treeScale: 0.95, forestSpread: 0.44, meadowSpread: 0.45, treeMinDist: 3.2, grassMinDist: 1.1, grassDensity: 2.6, grassSlopeMargin: 1.2, rockSlope: 0.72,
                entryNorm: { x: -0.50, z: 0.48 }, exitNorm: { x: 0.12, z: -0.24 },
                waypointsNorm: [], branches: []
            }
        ];
    }
    // Default: 'canyon_pass_3' (余計なサンプル分岐道・強制洞窟・過剰な経由点をすべて排除したクリーンな初期構成)
    return [
        {
            name: "StartMeadowIsland", label: "第1島: スタート見晴らし小島 (48m)",
            width: 48, cellSize: 2.0, posX: -52, posY: -2, posZ: 50, seed: 1105,
            bottomDepthRatio: 0.16, baseHeight: 5.5, plainsAmp: 1.8, mountainAmp: 11, mountainAngle: -135,
            canyonDepth: 0, canyonWidth: 0.12, trailWidth: 1.0, trailGradeSmooth: 0.65,
            maxLakes: 0, riverAmount: 0.0, riverWidth: 4.5, riverBankDepth: 1.8, riverDepth: 2.5,
            hasCave: false, caveHeight: 2.8, caveCurve: 0.2,
            treeScale: 0.95, forestSpread: 0.46, meadowSpread: 0.45, treeMinDist: 3.2, grassMinDist: 1.0, grassDensity: 2.9, grassSlopeMargin: 1.2, rockSlope: 0.72,
            entryNorm: { x: -0.28, z: 0.30 }, exitNorm: { x: 0.54, z: -0.48 },
            waypointsNorm: [], branches: []
        },
        {
            name: "CanyonLakeMainIsland", label: "第2島: 渓谷湖・蛇行川の本島 (92m)",
            width: 92, cellSize: 2.1, posX: 0, posY: 0, posZ: 0, seed: 1242,
            bottomDepthRatio: 0.16, baseHeight: 6.5, plainsAmp: 2.4, mountainAmp: 34, mountainAngle: 30,
            canyonDepth: 15, canyonWidth: 0.12, trailWidth: 1.0, trailGradeSmooth: 0.65,
            maxLakes: 1, riverAmount: 1.0, riverWidth: 5.2, riverBankDepth: 1.8, riverDepth: 3.0,
            hasCave: false, caveHeight: 2.8, caveCurve: 0.22,
            treeScale: 1.0, forestSpread: 0.48, meadowSpread: 0.45, treeMinDist: 3.4, grassMinDist: 1.0, grassDensity: 3.0, grassSlopeMargin: 1.4, rockSlope: 0.72,
            entryNorm: { x: -0.54, z: 0.42 }, exitNorm: { x: 0.44, z: -0.52 },
            waypointsNorm: [], branches: []
        },
        {
            name: "SummitShrineIsland", label: "第3島: 山頂の祠・ゴール高台島 (56m)",
            width: 56, cellSize: 2.0, posX: 46, posY: 19, posZ: -60, seed: 1319,
            bottomDepthRatio: 0.18, baseHeight: 6.5, plainsAmp: 2.0, mountainAmp: 24, mountainAngle: 40,
            canyonDepth: 8, canyonWidth: 0.11, trailWidth: 1.0, trailGradeSmooth: 0.65,
            maxLakes: 1, riverAmount: 0.0, riverWidth: 4.2, riverBankDepth: 1.6, riverDepth: 2.4,
            hasCave: false, caveHeight: 2.8, caveCurve: 0.2,
            treeScale: 0.95, forestSpread: 0.44, meadowSpread: 0.45, treeMinDist: 3.2, grassMinDist: 1.0, grassDensity: 2.8, grassSlopeMargin: 1.2, rockSlope: 0.72,
            entryNorm: { x: -0.50, z: 0.46 }, exitNorm: { x: 0.10, z: -0.25 },
            waypointsNorm: [], branches: []
        }
    ];
}
