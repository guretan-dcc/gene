// 溶岩の橋: 中央の長い金網の橋、左右の溶岩に立つ柱と梁
export const bridgeRoom = {
  id: 'bridge',
  style: { floor: 0x6f7076, side: 0x35282a, wall: 0x3b2427, accent: 0xb8382c, trim: 0x2a1c1f, cover: 0x2a1c1f },
  size: size => ({ half: Math.floor(size / 2), depth: size + 6 }),
  rise: () => 0,
  lavaDepth: 2.2, // 入口の床から溶岩面まで(m)

  carve({ hw, d }, room) {
    room.pit(-hw, hw, 0, d - 1);
    room.floor(-1, 1, 0, d - 1);
  },

  decorate(kit) {
    const { style, halfW, length, top, lava, S } = kit;
    const edge = 1.5 * S; // 橋の端

    // 橋の縁石と金網の溝
    for (const side of [-1, 1]) {
      kit.mirrorBox(side, edge - 0.35, edge + 0.15, -0.6, 0.3, 0, length, style.floor);
      kit.mirrorBox(side, edge - 0.15, edge + 0.3, -1.0, -0.6, 0, length, style.trim);
    }
    for (let f = 0.3; f + 0.2 < length; f += 0.55) {
      kit.box(-edge + 0.5, edge - 0.5, 0, 0.02, f, f + 0.22, style.trim);
    }

    // 柱・梁・壁際の段々
    const spacing = length / Math.max(2, Math.round(length / 11));
    const column = halfW - 2.4;
    for (let f = spacing / 2; f < length; f += spacing) {
      for (const side of [-1, 1]) {
        const stack = (w, y0, y1, color) =>
          kit.mirrorBox(side, column - w, column + w, y0, y1, f - w, f + w, color);
        stack(1.3, lava, 0.4, style.side);
        stack(1.0, 0.4, 1.3, style.trim);
        stack(0.55, 1.3, top - 2.0, style.wall);
        stack(0.8, top - 2.0, top - 1.5, style.trim);
        stack(1.0, top - 1.5, top - 1.0, style.side);
      }
      // 橋をまたぐ梁（赤）
      kit.box(-column - 1, column + 1, top - 1.0, top - 0.55, f - 0.3, f + 0.3, style.accent);
      kit.box(-column - 1, column + 1, top - 0.55, top - 0.35, f - 0.4, f + 0.4, style.trim);
    }
    for (const side of [-1, 1]) {
      // 柱列の上を走る横梁
      kit.mirrorBox(side, column - 0.5, halfW, top - 1.0, top - 0.6, 0, length, style.accent);
      kit.mirrorBox(side, column - 0.7, halfW, top - 0.6, top - 0.1, 0, length, style.trim);
      kit.mirrorBox(side, column - 0.5, halfW, top - 0.1, top + 0.2, 0, length, style.accent);
      // 壁際の段状の足場
      for (let f = spacing; f < length - 1; f += spacing) {
        for (let step = 0; step < 3; step++) {
          kit.mirrorBox(side, halfW - 3.0 + step * 0.9, halfW, lava, -1.2 + step * 0.8,
            f - 2.6 + step * 0.4, f + 2.6 - step * 0.4, step % 2 ? style.side : style.trim);
        }
      }
    }
  }
};
