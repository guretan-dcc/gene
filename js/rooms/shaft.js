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
    const { style, halfW, length, top, lava, S } = kit;

    // 壁の枠パネル（左右と奥、上下2段以上）
    const columns = Math.max(3, Math.round(length / 6));
    const width = length / columns;
    for (let y = lava + 1; y + 3 < top; y += 5.5) {
      const y1 = Math.min(y + 4.6, top - 0.8);
      for (let i = 0; i < columns; i++) {
        for (const side of [-1, 1]) {
          kit.sideFrame(side, i * width + 0.7, (i + 1) * width - 0.7, y, y1, style.accent);
        }
      }
    }
    kit.pilasters(width, 0.35, style.trim);
    for (let y = kit.exitY + 4.8; y + 2 < top; y += 4) {
      for (const x of [-0.65, 0, 0.65]) {
        kit.farFrame(x * halfW - 1.8, x * halfW + 1.8, y, Math.min(y + 3, top - 0.6), style.accent);
      }
    }

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
    for (let i = 0; i <= 3; i++) {
      const x = -sx + (2 * sx * i) / 3;
      kit.box(x - 0.12, x + 0.12, top - 0.35, top, f0, f1, style.side);
      const f = f0 + ((f1 - f0) * i) / 3;
      kit.box(-sx, sx, top - 0.35, top, f - 0.12, f + 0.12, style.side);
    }

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
