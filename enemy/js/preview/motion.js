// 関節の動きの確認用(プレビューのみ。書き出す Prefab は立ち姿勢)
export const MOTIONS = { none: '静止', idle: '待機', walk: '歩き', attack: '攻撃' };

export function applyMotion(joints, motion, time, weapon) {
  for (const joint of joints.values()) {
    joint.rotation.set(0, 0, 0);
    joint.position.set(...joint.userData.rest);
  }
  const turn = (name, x, y = 0, z = 0) => joints.get(name)?.rotation.set(x, y, z);
  if (motion === 'none') return;

  // 腕は少し開き、肘を曲げて武器を前に構える
  const arms = { L: { upper: 0, fore: -0.35 }, R: { upper: 0, fore: -0.35 } };
  let torsoX = 0;
  let torsoY = 0;

  if (motion === 'idle') {
    const breath = Math.sin(time * 2.2);
    const hips = joints.get('Hips');
    if (hips) hips.position.y += breath * 0.006;
    arms.L.upper = arms.R.upper = breath * 0.03;
  } else if (motion === 'walk') {
    const phase = time * 5;
    const swing = Math.sin(phase);
    turn('ThighL', -swing * 0.55);
    turn('ThighR', swing * 0.55);
    turn('ShinL', Math.max(0, Math.cos(phase)) * 0.8);
    turn('ShinR', Math.max(0, -Math.cos(phase)) * 0.8);
    arms.L.upper = swing * 0.4;
    arms.R.upper = -swing * 0.4;
    const hips = joints.get('Hips');
    if (hips) hips.position.y -= Math.abs(swing) * 0.03;
  } else if (motion === 'attack') {
    const t = (time % 1.6) / 1.6;
    const ease = x => x * x * (3 - 2 * x);
    // 0〜0.5: 構える / 0.5〜0.68: 振る / 残り: 戻る
    const wind = t < 0.5 ? ease(t / 0.5) : t < 0.68 ? 1 : 1 - ease((t - 0.68) / 0.32);
    const hit = t < 0.5 ? 0 : t < 0.68 ? ease((t - 0.5) / 0.18) : 1 - ease((t - 0.68) / 0.32);
    if (weapon === 'bow') {
      arms.L = { upper: -1.45 * wind, fore: -0.1 };
      arms.R = { upper: -1.3 * wind, fore: -0.35 - 1.6 * wind * (1 - hit) };
    } else if (weapon === 'blaster') {
      arms.R = { upper: -1.4 * wind + hit * 0.15, fore: -0.15 };
    } else {
      arms.R = { upper: -2.4 * wind + 1.8 * hit, fore: -0.35 - 0.9 * wind + 0.9 * hit };
      torsoY = -0.45 * wind + 0.8 * hit;
      torsoX = 0.25 * hit;
    }
  }

  turn('Torso', torsoX, torsoY);
  turn('UpperArmL', arms.L.upper, 0, 0.08);
  turn('UpperArmR', arms.R.upper, 0, -0.08);
  turn('ForeArmL', arms.L.fore);
  turn('ForeArmR', arms.R.fore);
  // 弓は腕を上げても縦のままにする
  if (weapon === 'bow') turn('Weapon', -(arms.L.upper + arms.L.fore));
}
