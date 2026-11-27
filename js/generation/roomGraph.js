// 部屋の配置と接続関係（入口 → 戦闘部屋 → … → ボス部屋。中間の段は左右に分岐できる）
import { state } from '../state.js';
import { shuffle } from '../core/random.js';

export const CORRIDOR_HALF = 1; // 通路の半幅（幅3マス）
const MAX_HEIGHT = 3;
const REWARD_TYPES = ['shop', 'life', 'weapon'];

// グリッド寸法と各レーンの位置
export function getStageDimensions() {
  const { roomLayers: layers, roomSize, corridorLength } = state;
  const half = Math.floor(roomSize / 2);
  const width = 4 * half + 7;
  return {
    half,
    width,
    depth: layers * roomSize + (layers - 1) * corridorLength,
    centerX: Math.floor(width / 2),
    laneOffset: half + 2,  // 分岐部屋の中心（中央からの距離）
    doorOffset: half - 1   // 分岐へ向かう通路の中心（中央からの距離）
  };
}

export function createRoomGraph(rng) {
  const dim = getStageDimensions();
  const { roomLayers: count, roomSize, corridorLength } = state;

  // 分岐する段を中間の段から選ぶ
  const middle = Array.from({ length: Math.max(0, count - 2) }, (_, i) => i + 1);
  const branchLayers = new Set(shuffle(middle, rng).slice(0, state.branchCount));

  const rooms = [];
  const layers = [];
  let baseH = 0;

  for (let layer = 0; layer < count; layer++) {
    if (layer > 0 && state.heightVariation) {
      baseH = clampHeight(baseH + Math.floor(rng() * 3) - 1);
    }
    const z1 = dim.depth - 1 - layer * (roomSize + corridorLength);
    const isBranch = branchLayers.has(layer);
    const lanes = isBranch ? ['left', 'right'] : ['center'];
    // 分岐の片側は戦闘、もう片側は報酬部屋
    const rewardLane = isBranch ? (rng() < 0.5 ? 'left' : 'right') : null;

    layers.push(lanes.map(lane => {
      const side = lane === 'left' ? -1 : (lane === 'right' ? 1 : 0);
      const centerX = dim.centerX + side * dim.laneOffset;
      let type = 'combat';
      if (layer === 0) type = 'start';
      else if (layer === count - 1) type = 'boss';
      else if (lane === rewardLane) type = REWARD_TYPES[Math.floor(rng() * REWARD_TYPES.length)];

      const room = {
        id: rooms.length,
        layer,
        lane,
        type,
        x0: centerX - dim.half,
        x1: centerX + dim.half,
        z0: z1 - roomSize + 1,
        z1,
        height: baseH
      };
      rooms.push(room);
      return room;
    }));
  }

  return { rooms, links: linkLayers(layers, dim) };
}

function clampHeight(h) {
  return Math.max(0, Math.min(MAX_HEIGHT, h));
}

// 隣り合う段を直線通路で結ぶ。分岐同士は同じ側をつなぐ
function linkLayers(layers, dim) {
  const links = [];
  for (let i = 0; i + 1 < layers.length; i++) {
    for (const from of layers[i]) {
      for (const to of layers[i + 1]) {
        const bothBranch = from.lane !== 'center' && to.lane !== 'center';
        if (bothBranch && from.lane !== to.lane) continue;

        const lane = from.lane !== 'center' ? from.lane : to.lane;
        let x = dim.centerX;
        if (bothBranch) x += (lane === 'left' ? -1 : 1) * dim.laneOffset;
        else if (lane !== 'center') x += (lane === 'left' ? -1 : 1) * dim.doorOffset;

        links.push({ id: links.length, from: from.id, to: to.id, x });
      }
    }
  }
  return links;
}
