// 武器と盾。原点は握る位置で、+z が前、+y が上
export const WEAPONS = { sword: '剣', axe: '斧', spear: '槍', bow: '弓', blaster: 'ブラスター', none: 'なし' };

// 弓だけは左手に持つ
export const weaponSide = type => (type === 'bow' ? 'L' : 'R');

export function buildWeapon(mesh, type, s, colors) {
  const { jointColor, trimColor, bodyColor, eyeColor } = colors;
  // 前後に伸びる棒・刃
  const bar = (z0, z1, w, h, color, y = 0) =>
    mesh.addBox({ z: (z0 + z1) / 2 * s, y0: y - h / 2 * s, y1: y + h / 2 * s, w: w * s, d: (z1 - z0) * s }, color);

  if (type === 'sword') {
    bar(-0.12, 0.09, 0.035, 0.035, jointColor);                       // 柄
    bar(0.09, 0.13, 0.05, 0.2, bodyColor);                            // 鍔
    mesh.addPlate([[0.13, -0.05], [0.8, -0.05], [0.92, 0], [0.8, 0.05], [0.13, 0.05]]
      .map(p => p.map(v => v * s)), 0.022 * s, trimColor);            // 刃
  } else if (type === 'axe') {
    bar(-0.22, 0.78, 0.045, 0.045, jointColor);
    mesh.addPlate([[0.52, -0.02], [0.46, -0.28], [0.8, -0.28], [0.72, -0.02]]
      .map(p => p.map(v => v * s)), 0.04 * s, trimColor);
    bar(0.54, 0.7, 0.075, 0.09, bodyColor);
  } else if (type === 'spear') {
    bar(-0.5, 0.95, 0.035, 0.035, jointColor);
    mesh.addPlate([[0.95, -0.06], [1.2, 0], [0.95, 0.06], [0.9, 0]]
      .map(p => p.map(v => v * s)), 0.025 * s, trimColor);
  } else if (type === 'bow') {
    // 縦の弓: 握りと、後ろへ反った上下の腕、弦
    mesh.addBox({ y0: -0.09 * s, y1: 0.09 * s, w: 0.05 * s, d: 0.06 * s }, jointColor);
    for (const dir of [1, -1]) {
      const limb = [[0.025, 0.09], [-0.19, 0.6], [-0.23, 0.58], [-0.025, 0.09]]
        .map(([z, y]) => [z * s, y * s * dir]);
      mesh.addPlate(dir > 0 ? limb : limb.reverse(), 0.035 * s, bodyColor);
    }
    mesh.addBox({ z: -0.215 * s, y0: -0.59 * s, y1: 0.59 * s, w: 0.008 * s, d: 0.008 * s }, trimColor);
  } else if (type === 'blaster') {
    bar(-0.1, 0.26, 0.13, 0.13, bodyColor);
    bar(0.26, 0.5, 0.07, 0.07, jointColor);
    bar(0.5, 0.54, 0.05, 0.05, eyeColor);
  }
}

export function buildShield(mesh, s, colors) {
  // 前腕の外側(+x)に付く縦長の板
  const outline = [[-0.2, 0.3], [-0.22, -0.2], [0, -0.4], [0.22, -0.2], [0.2, 0.3]]
    .map(p => p.map(v => v * s));
  mesh.addPlate(outline, 0.045 * s, colors.trimColor, 0.04 * s);
  mesh.addPlate(outline.map(([z, y]) => [z * 0.62, y * 0.62]), 0.03 * s, colors.bodyColor, 0.075 * s);
}
