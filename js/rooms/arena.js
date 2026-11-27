// 闘技場: 堀に囲まれた中央の広場、左右の渡り廊下、奥の階段と扉前の高台
export const arenaRoom = {
  id: 'arena',
  style: { floor: 0x8b9099, side: 0x4a4d55, wall: 0x454952, accent: 0x8e2328, trim: 0x30333b, cover: 0x25272d },
  size: size => ({ half: Math.max(6, Math.floor(size / 2) + 1), depth: size + 8 }),
  // 高い場所にいるときは階段を下る
  rise: height => (height >= 3 ? -1 : 1),
  hasCover: true,
  lavaDepth: 2.2, // 入口の床から溶岩面まで(m)

  carve({ hw, d, rise }, room) {
    const back = d - 5;               // 奥の高台の手前端
    const mid = Math.floor((4 + back - 2) / 2);
    room.pit(-hw, hw, 0, d - 1);
    room.floor(-hw, hw, 0, 1);        // 入口の足場
    room.floor(-1, 1, 2, 3);          // 入口の橋
    room.floor(-(hw - 2), hw - 2, 4, back - 2);
    room.floor(-hw, hw, mid - 1, mid + 1); // 左右の渡り廊下
    room.floor(-hw, hw, back, d - 1, rise);
    room.stairs(-1, 1, back - 1, rise);
  },

  decorate(kit) {
    const { style, halfW, length, top, S } = kit;
    const back = length - 5 * S;

    kit.pilasters(8, 0.7, style.trim);
    // 壁の赤い帯
    for (const side of [-1, 1]) {
      kit.mirrorBox(side, halfW - 0.2, halfW, 2.2, 4.4, 0, length, style.accent);
      kit.mirrorBox(side, halfW - 0.5, halfW, top - 0.4, top + 0.3, 0, length, style.trim);
      // 扉の両脇の大柱
      const x = 2.6 * S;
      kit.mirrorBox(side, x - 0.9, x + 0.9, kit.exitY, kit.exitY + 0.6, length - 1.8, length, style.trim);
      kit.mirrorBox(side, x - 0.6, x + 0.6, kit.exitY + 0.6, top - 0.5, length - 1.3, length, style.floor);
      kit.mirrorBox(side, x - 0.9, x + 0.9, top - 0.5, top + 0.3, length - 1.8, length, style.trim);
      kit.mirrorBox(side, x + 1.2, halfW, kit.exitY + 2.2, kit.exitY + 4.0, length - 0.2, length, style.accent);
      // 入口の橋の手すり
      const rail = 1.5 * S;
      kit.mirrorBox(side, rail - 0.25, rail + 0.05, 0, 0.7, 2 * S, 4 * S, style.side);
      for (const f of [2 * S, 4 * S]) {
        kit.mirrorBox(side, rail - 0.4, rail + 0.2, -0.4, 1.3, f - 0.3, f + 0.3, style.trim);
      }
      // 広場の縁の赤いライン
      const rim = (kit.cellsHalf - 2 + 0.5) * S;
      kit.mirrorBox(side, rim, rim + 0.08, -0.35, -0.12, 4 * S, back - S, style.accent);
    }
    // 床の石板模様
    for (const [x, f] of [[0, 0.45], [-0.55, 0.3], [0.55, 0.3], [-0.5, 0.65], [0.5, 0.65]]) {
      for (let i = 0; i < 6; i++) {
        const cx = x * halfW + (i % 3 - 1) * 1.15;
        const cf = f * back + Math.floor(i / 3) * 0.75;
        kit.box(cx - 0.5, cx + 0.5, 0, 0.015, cf, cf + 0.62, style.side);
      }
    }
  }
};
