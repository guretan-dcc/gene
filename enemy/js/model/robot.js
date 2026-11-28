// 敵ロボットを関節ごとの部品に分けて組み立てる。
// 座標はメートル、+z が正面、+x がロボットの左。各部品の原点は関節の位置。
import { Mesh } from './mesh.js';
import { buildWeapon, buildShield, weaponSide } from './weapons.js';

export const HEADS = { box: '箱', dome: '丸', wedge: 'くさび' };

// シードから体の比率に小さな違いを作る(同じシードなら同じ形)
function createVariation(seed) {
  let a = seed >>> 0;
  return amount => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return 1 + (((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1) * amount;
  };
}

// 戻り値: [{ name, parent, position, mesh }] 親が先に並ぶ
export function buildRobot(settings) {
  const { height, bulk, head, weapon, shield, bodyColor, jointColor, trimColor, eyeColor } = settings;
  const vary = createVariation(settings.seed);
  const u = height / 1.7;           // 身長の倍率
  const b = u * bulk;               // 太さの倍率

  const legs = vary(0.06);
  const thigh = 0.4 * u * legs;
  const shin = 0.42 * u * legs;
  const hipH = 0.14 * u;
  const headH = 0.27 * u * vary(0.08);
  const neck = 0.04 * u;
  const torso = height - thigh - shin - hipH - headH - neck; // 頭頂が身長になる
  const chestW = 0.46 * b * vary(0.1);
  const chestD = 0.28 * b * vary(0.1);
  const waistW = chestW * 0.62;
  const upperArm = 0.31 * u * vary(0.07);
  const foreArm = 0.3 * u * vary(0.07);
  const limb = 0.11 * b * vary(0.1);
  const pad = vary(0.2);

  const parts = [];
  const part = (name, parent, position, build) => {
    const mesh = new Mesh();
    build(mesh);
    parts.push({ name, parent, position, mesh });
  };
  // 関節から下に伸びる手足の節
  const segment = (mesh, length, top, bottom, color) =>
    mesh.addBox({ y0: -length + 0.025 * u, y1: -0.025 * u, w: bottom, d: bottom, topW: top, topD: top }, color);
  const joint = (mesh, size) => mesh.addBox({ y0: -size / 2, y1: size / 2, w: size, d: size }, jointColor);

  part('Hips', null, [0, thigh + shin, 0], m => {
    m.addBox({ y0: -0.03 * u, y1: hipH, w: chestW * 0.7, d: chestD * 0.8, topW: waistW, topD: chestD * 0.7 }, jointColor);
  });

  part('Torso', 'Hips', [0, hipH, 0], m => {
    m.addBox({ y0: 0, y1: torso * 0.3, w: waistW * 0.75, d: chestD * 0.55 }, jointColor);
    m.addBox({ y0: torso * 0.27, y1: torso, w: waistW, d: chestD * 0.75, topW: chestW, topD: chestD }, bodyColor);
    // 胸の光る部分(弱点の目印にも使える)
    m.addBox({ z: chestD * 0.47, y0: torso * 0.58, y1: torso * 0.74, w: chestW * 0.2, d: 0.04 * b }, eyeColor);
  });

  part('Head', 'Torso', [0, torso, 0], m => {
    m.addBox({ y0: -0.02 * u, y1: neck, w: 0.09 * b, d: 0.09 * b }, jointColor);
    const w = 0.25 * u * (0.6 + 0.4 * bulk);
    let front = w * 0.5;
    if (head === 'dome') {
      m.addPrism({ y0: neck, y1: neck + headH * 0.65, radius: w * 0.56 }, bodyColor);
      m.addPrism({ y0: neck + headH * 0.65, y1: neck + headH, radius: w * 0.56, topRadius: w * 0.28 }, trimColor);
      front = w * 0.52;
    } else if (head === 'wedge') {
      m.addBox({ y0: neck, y1: neck + headH, w: w * 0.8, d: w * 1.1, topW: w * 0.6, topD: w * 0.5, topZ: -w * 0.3 }, bodyColor);
      front = w * 0.4;
    } else {
      m.addBox({ y0: neck, y1: neck + headH, w, d: w }, bodyColor);
    }
    const eyeY = neck + headH * 0.4;
    m.addBox({ z: front, y0: eyeY - headH * 0.09, y1: eyeY + headH * 0.09, w: w * 0.62, d: 0.045 * u }, eyeColor);
  });

  for (const [side, dir] of [['L', 1], ['R', -1]]) {
    const shoulderX = dir * (chestW / 2 + limb * 0.65);
    part(`UpperArm${side}`, 'Torso', [shoulderX, torso * 0.86, 0], m => {
      m.addBox({ y0: -limb * 0.45, y1: limb * 0.75 * pad, w: limb * 1.55 * pad, d: limb * 1.6, topW: limb * 1.1 * pad, topD: limb * 1.2 }, trimColor);
      segment(m, upperArm, limb * 0.85, limb * 0.7, jointColor);
    });
    part(`ForeArm${side}`, `UpperArm${side}`, [0, -upperArm, 0], m => {
      joint(m, limb * 0.75);
      segment(m, foreArm, limb * 0.8, limb * 1.15, bodyColor);
      m.addBox({ y0: -foreArm - limb * 0.45, y1: -foreArm + limb * 0.4, w: limb * 0.85, d: limb * 0.95 }, jointColor); // 手
    });
  }

  for (const [side, dir] of [['L', 1], ['R', -1]]) {
    part(`Thigh${side}`, 'Hips', [dir * chestW * 0.24, 0, 0], m => {
      joint(m, limb * 0.9);
      segment(m, thigh, limb * 1.25, limb * 0.9, bodyColor);
    });
    part(`Shin${side}`, `Thigh${side}`, [0, -thigh, 0], m => {
      joint(m, limb * 0.8);
      segment(m, shin - 0.04 * u, limb * 0.95, limb * 1.2, bodyColor);
      m.addBox({ z: limb * 0.35, y0: -shin, y1: -shin + 0.09 * u, w: limb * 1.35, d: limb * 2.2, topD: limb * 1.6, topZ: limb * 0.15 }, jointColor); // 足
    });
  }

  const hand = [0, -foreArm, 0];
  if (weapon !== 'none') {
    const side = weaponSide(weapon);
    part('Weapon', `ForeArm${side}`, hand, m => buildWeapon(m, weapon, u * Math.sqrt(bulk), settings));
  }
  if (shield) {
    const side = weapon === 'bow' ? 'R' : 'L';
    const dir = side === 'L' ? 1 : -1;
    part('Shield', `ForeArm${side}`, [dir * limb * 0.6, -foreArm * 0.6, 0], m => {
      buildShield(m, u * Math.sqrt(bulk), settings);
      // 右腕に付けるときは左右を反転する
      if (dir < 0) mirrorX(m);
    });
  }
  return parts;
}

// 左右反転(面の向きが保たれるように三角形の順序も入れ替える)
export function mirrorX(mesh) {
  for (let i = 0; i < mesh.positions.length; i += 3) {
    mesh.positions[i] = -mesh.positions[i];
    mesh.normals[i] = -mesh.normals[i];
  }
  for (let i = 0; i < mesh.indices.length; i += 3) {
    [mesh.indices[i + 1], mesh.indices[i + 2]] = [mesh.indices[i + 2], mesh.indices[i + 1]];
  }
}

// 立ち姿勢での全体の大きさ(当たり判定とカメラに使う)
export function measureRobot(parts) {
  const world = new Map();
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    const base = world.get(p.parent) || [0, 0, 0];
    const at = p.position.map((v, k) => v + base[k]);
    world.set(p.name, at);
    p.mesh.positions.forEach((v, i) => {
      const k = i % 3;
      min[k] = Math.min(min[k], v + at[k]);
      max[k] = Math.max(max[k], v + at[k]);
    });
  }
  return { min, max, world };
}
