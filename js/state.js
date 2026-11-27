export const state = {
  tier: 'gold',
  roomCount: 6,         // 部屋数（入口・ボス部屋を含む）
  roomSize: 13,         // 部屋の幅の目安(マス)
  heightVariation: true,
  gridWidth: 0,         // 生成時に決まる
  gridDepth: 0,         // 生成時に決まる
  cellSize: 2.0,
  seed: 2048,
  magmaDepth: 14,       // マグマ面までの垂直距離(m)
  coverBlockSize: 2,    // 遮蔽物Cubeサイズ (2 = 2x2大型Cube, 1 = 1x1)
  coverDensity: 0.08,
  wallHeight: 2,
  magmaMargin: 90,
  showDoors: true,
  roomWallHeight: 5,    // 部屋の壁の高さ(m)
  autoTraps: false,
  jumpPadCount: 6,
  sawCount: 4,
  floorTrapCount: 8,
  conveyorCount: 6,
  enemiesPerRoom: 4,
  pedestalHeight: 1.0,
  clickMode: 'enemy', // 'enemy' | 'trap'
  animateTraps: true,
  noCarveMerge: true, // 柱や高台の下の床・壁をくり抜かずに貫通マージしてポリゴン削減
  wireframe: false,
  showGridOverlay: false
};

// 生成データ（generateArena() が書き換える）
export const arena = {
  grid: [],       // grid[z][x] のセル
  rooms: [],      // { id, type, layout, centerX, x0, x1, z0, z1, height, exitHeight, ... }
  doors: [],      // { id, from, to, x, z, width, height }
  chunks: [],     // 描画区画 { id, kind, roomId, doorId, visible }
  slopes: [],     // { x, z, dirX, dirZ, lowH, highH }
  sawTracks: []   // 往復回転ノコギリの軌道
};
