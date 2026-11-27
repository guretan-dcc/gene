// 溶岩の橋: 溶岩にまっすぐ架かる長い橋
export const bridgeRoom = {
  id: 'bridge',
  style: { floor: 0x6f7076, side: 0x35282a, wall: 0x3b2427, trim: 0x2a1c1f, cover: 0x2a1c1f },
  size: size => ({ half: Math.floor(size / 2), depth: size + 6 }),
  rise: () => 0,
  lavaDepth: 2.2, // 入口の床から溶岩面まで(m)

  carve({ hw, d }, room) {
    room.pit(-hw, hw, 0, d - 1);
    room.floor(-1, 1, 0, d - 1);
  },

  // 装飾は橋の縁石だけ
  decorate(kit) {
    const { style, length, S } = kit;
    const edge = 1.5 * S; // 橋の端
    for (const side of [-1, 1]) {
      kit.mirrorBox(side, edge - 0.2, edge + 0.15, -0.5, 0.2, 0, length, style.trim);
    }
  }
};
