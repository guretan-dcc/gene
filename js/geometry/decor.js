// 部屋ごとの建築ディテール。各部屋の decorate(kit) が、部屋ローカル座標(m)で形を組み立てる
//   x: 部屋の中央が0の左右 / y: 入口の床が0の高さ / f: 入口の辺が0の奥行き
import { state, arena } from '../state.js';
import { DOOR_HEIGHT, PALETTE } from '../config/constants.js';
import { ROOMS } from '../rooms/index.js';
import { getLayerHeight, getGridMetrics, cellCenterX } from '../core/grid.js';
import { MeshBuilder } from './MeshBuilder.js';
import { getChunkTopY } from './bounds.js';

const SKYLIGHT_COLOR = 0xf4fbff;

function createKit(room, solid, glow) {
  const { S, halfD } = getGridMetrics();
  const layerH = getLayerHeight();
  const originX = cellCenterX(room.centerX);
  const originY = room.height * layerH;
  const originZ = (room.z1 + 1) * S - halfD; // 入口の辺

  const kit = {
    S,
    style: ROOMS[room.layout].style,
    cellsHalf: room.half,
    halfW: (room.half + 0.5) * S,
    length: room.depth * S,
    top: getChunkTopY(arena.chunks[room.id]) - originY,
    exitY: (room.exitHeight - room.height) * layerH,
    lava: -state.magmaDepth - originY,

    box(x0, x1, y0, y1, f0, f1, color) {
      solid.addBox(originX + x0, originX + x1, originY + y0, originY + y1,
        originZ - f1, originZ - f0, new THREE.Color(color));
    },
    // side(-1: 左, 1: 右) に合わせて左右反転した位置へ置く（x0, x1 は中央からの距離）
    mirrorBox(side, x0, x1, y0, y1, f0, f1, color) {
      kit.box(Math.min(side * x0, side * x1), Math.max(side * x0, side * x1), y0, y1, f0, f1, color);
    },
    // 左右の壁と、扉を避けた手前・奥の壁に付け柱を並べる
    pilasters(spacing, depth, color) {
      const count = Math.max(1, Math.round(kit.length / spacing));
      for (let i = 0; i <= count; i++) {
        const f = Math.min(kit.length - 0.8, Math.max(0, (kit.length * i) / count - 0.4));
        for (const side of [-1, 1]) {
          kit.mirrorBox(side, kit.halfW - depth, kit.halfW, kit.lava, kit.top, f, f + 0.8, color);
        }
      }
      for (const side of [-1, 1]) {
        const x = kit.halfW * 0.62;
        kit.mirrorBox(side, x - 0.4, x + 0.4, kit.lava, kit.top, 0, depth, color);
        kit.mirrorBox(side, x - 0.4, x + 0.4, kit.lava, kit.top, kit.length - depth, kit.length, color);
      }
    },
    // 左右の壁の枠
    sideFrame(side, f0, f1, y0, y1, color) {
      const bar = (a, b, c, d) => kit.mirrorBox(side, kit.halfW - 0.18, kit.halfW, c, d, a, b, color);
      bar(f0, f1, y0, y0 + 0.25);
      bar(f0, f1, y1 - 0.25, y1);
      bar(f0, f0 + 0.25, y0, y1);
      bar(f1 - 0.25, f1, y0, y1);
    },
    // 奥の壁の枠
    farFrame(x0, x1, y0, y1, color) {
      const bar = (a, b, c, d) => kit.box(a, b, c, d, kit.length - 0.18, kit.length, color);
      bar(x0, x1, y0, y0 + 0.25);
      bar(x0, x1, y1 - 0.25, y1);
      bar(x0, x0 + 0.25, y0, y1);
      bar(x1 - 0.25, x1, y0, y1);
    },
    // 下向きの面だけの天井（上から見ると中が見える）
    ceiling(x0, x1, f0, f1, color, target = solid) {
      const y = originY + kit.top;
      const [a, b] = [originX + x0, originX + x1];
      const [c, d] = [originZ - f1, originZ - f0];
      target.addQuad([a, y, c], [b, y, c], [b, y, d], [a, y, d], [0, -1, 0], new THREE.Color(color));
    },
    // 部屋いっぱいの溶岩面
    lavaSurface(y) {
      const wy = originY + y;
      const [a, b] = [originX - kit.halfW, originX + kit.halfW];
      const [c, d] = [originZ - kit.length, originZ];
      glow.addQuad([a, wy, c], [a, wy, d], [b, wy, d], [b, wy, c], [0, 1, 0], new THREE.Color(PALETTE.magma));
    },
    skylight(x0, x1, f0, f1) {
      kit.ceiling(x0, x1, f0, f1, SKYLIGHT_COLOR, glow);
    }
  };
  return kit;
}

// 扉の周りの枠（各部屋の出口と、2部屋目以降の入口）
function addDoorFrames(kit, room) {
  const half = 1.5 * kit.S;
  const frame = (f0, f1, y) => {
    for (const side of [-1, 1]) kit.mirrorBox(side, half, half + 0.45, y, y + DOOR_HEIGHT, f0, f1, kit.style.trim);
    kit.box(-half - 0.45, half + 0.45, y + DOOR_HEIGHT, y + DOOR_HEIGHT + 0.45, f0, f1, kit.style.trim);
  };
  frame(kit.length - 0.45, kit.length, kit.exitY);
  if (room.id > 0) frame(0, 0.45, 0);
}

// 通路には何も付けない。光る面(glow)は陰影なしで描く
export function buildDecorGeometry(chunkId) {
  const solid = new MeshBuilder();
  const glow = new MeshBuilder();
  const chunk = arena.chunks[chunkId];

  if (chunk.kind === 'room') {
    const room = arena.rooms[chunk.roomId];
    const kit = createKit(room, solid, glow);
    const { lavaDepth, decorate } = ROOMS[room.layout];
    // 浅い溶岩面は地形の一部なので、ディテールの表示設定に関係なく作る
    if (lavaDepth) kit.lavaSurface(-lavaDepth);
    if (state.showDetails) {
      decorate(kit);
      addDoorFrames(kit, room);
    }
  }
  return { solid: solid.build(), glow: glow.build() };
}
