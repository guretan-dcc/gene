// 縦穴: 溶岩をまたぐ長いスロープで上下の扉をつなぐ、天窓付きの背の高い部屋
const RISE = 3;       // スロープで上り下りする層数
const LANDING = 4;    // 入口側の足場の奥行き(マス)
const LEDGE = 3;      // 出口側の足場の奥行き(マス)

export const shaftRoom = {
  id: 'shaft',
  style: { floor: 0x78808c, side: 0x3f4652, wall: 0x4a5260, accent: 0x5d6675, trim: 0x2f353f, cover: 0x6e6b4f, ramp: 0xc9c9c2 },
  size: () => ({ half: 4, depth: 17 }),
  rise: height => (height >= RISE ? -RISE : RISE),

  carve({ hw, d, rise }, room) {
    room.pit(-hw, hw, 0, d - 1);
    room.floor(-hw, hw, 0, LANDING - 1);
    room.floor(-hw, hw, d - LEDGE, d - 1, rise);
    room.longRamp(-hw, -hw + 1, LANDING, d - LEDGE - 1, rise);
  },

  decorate(kit) {
    const { style, halfW, length, lava, S } = kit;

    // 壁の付け柱
    kit.pilasters(6, 0.35, style.trim);

    // 出口側の足場の前面
    const front = length - LEDGE * S;
    kit.box(-0.5 * halfW, halfW, kit.exitY - 0.7, kit.exitY - 0.45, front - 0.2, front, style.trim);
    for (const x of [-0.45, 0.05, 0.55, 0.95]) {
      kit.box(x * halfW - 0.2, x * halfW + 0.2, lava, kit.exitY - 0.7, front - 0.2, front, style.accent);
    }

    // 天井と天窓
    const sx = halfW * 0.5;
    const f0 = length * 0.28;
    const f1 = length * 0.72;
    kit.ceiling(-halfW, -sx, 0, length, style.trim);
    kit.ceiling(sx, halfW, 0, length, style.trim);
    kit.ceiling(-sx, sx, 0, f0, style.trim);
    kit.ceiling(-sx, sx, f1, length, style.trim);
    kit.skylight(-sx, sx, f0, f1);

    // 隅に積んだ木箱
    const crate = (x, f, y) => {
      kit.box(x, x + 0.9, y, y + 0.9, f, f + 0.9, style.cover);
      kit.box(x + 0.15, x + 0.75, y + 0.9, y + 0.93, f + 0.15, f + 0.75, style.trim);
    };
    crate(halfW - 1.0, 0.2, 0);
    crate(halfW - 2.0, 0.5, 0);
    crate(halfW - 1.1, 0.3, 0.93);
    crate(-halfW + 0.1, 0.3, 0);
    crate(halfW - 1.1, length - S, kit.exitY);
    crate(-halfW + 0.2, length - 1.1, kit.exitY);
  }
};
