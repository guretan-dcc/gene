// --- アプリケーション状態 ---
export const state = {
  preset: 'hyper_corridor',
  chamberShape: 'octagonal', // 'octagonal' | 'rectangular'
  tier: 'gold',
  symmetry: '2way',
  gridWidth: 13,
  gridDepth: 29,
  cellSize: 2.0,
  seed: 2048,
  magmaDepth: 14,       // マグマ面までの垂直距離(m)
  chasmGap: 5,          // 足場から外周巨大壁までのマグマ谷幅(マス)
  coverBlockSize: 2,    // 遮蔽物Cubeサイズ (2 = 2x2大型Cube, 1 = 1x1)
  coverDensity: 0.10,
  wallHeight: 2,
  magmaMargin: 90,
  outerWallEnabled: true,
  outerWallHeight: 12,
  previewCutFrontWall: true,
  showArenaDecor: true,
  autoSlopes: true,
  autoTraps: false,
  jumpPadCount: 6,
  sawCount: 4,
  floorTrapCount: 8,
  conveyorCount: 6,
  enemyCount: 8,
  safeRadius: 5,
  pedestalHeight: 1.0,
  clickMode: 'enemy', // 'enemy' | 'trap'
  animateTraps: true,
  noCarveMerge: true, // 柱や高台の下の床・壁をくり抜かずに貫通マージしてポリゴン削減
  wireframe: false,
  showGridOverlay: true
};

// 生成データ（generateArena() が書き換える）
export const arena = {
  grid: [],       // grid[z][x] のセル
  slopes: [],     // { x, z, dirX, dirZ, lowH, highH }
  sawTracks: []   // 往復回転ノコギリの軌道
};
