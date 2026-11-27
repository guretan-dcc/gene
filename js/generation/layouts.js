// 部屋内の地形。座標は部屋ローカル（u: 中央が0の左右、v: 入口が0の奥行き）
// 共通の約束: 手前3行と奥5行は、入口の高さで通り抜けられる状態にする

// 左右の高台テラス（両端のスロープで上る）と、中央の溶岩溝
function terraces({ hw, d, mid }, room) {
  room.floor(-hw, hw, 0, d - 1);
  for (const side of [-1, 1]) {
    const [u0, u1] = side < 0 ? [-hw, -hw + 2] : [hw - 2, hw];
    room.floor(u0, u1, 4, d - 7, 1);
    room.ramp(u0, u1, 3, 'far');
    room.ramp(u0, u1, d - 6, 'near');
  }
  room.pit(-1, 1, mid - 2, mid + 1);
}

// 中央の高台と、四隅の溶岩池
function dais({ hw, d }, room) {
  room.floor(-hw, hw, 0, d - 1);
  room.floor(-(hw - 3), hw - 3, 5, d - 7, 1);
  room.ramp(-1, 1, 4, 'far');
  room.ramp(-1, 1, d - 6, 'near');
  for (const side of [-1, 1]) {
    const [u0, u1] = side < 0 ? [-hw, -hw + 1] : [hw - 1, hw];
    room.pit(u0, u1, 3, 5);
    room.pit(u0, u1, d - 8, d - 6);
  }
}

// 溶岩にかかる中央の橋と、途中の広い足場
function bridge({ hw, d, mid }, room) {
  room.floor(-hw, hw, 0, d - 1);
  room.pit(-hw, hw, 3, d - 6);
  room.floor(-1, 1, 3, d - 6);
  room.floor(-hw, hw, mid - 1, mid + 1);
  for (const side of [-1, 1]) {
    // 左右の端に高い見張り台
    const [u0, u1] = side < 0 ? [-hw, -hw + 1] : [hw - 1, hw];
    room.floor(u0, u1, mid + 3, d - 6, 1);
    room.ramp(u0, u1, mid + 2, 'far');
  }
}

// 左右2本の橋と、中央の高い島
function islands({ hw, d, mid }, room) {
  room.floor(-hw, hw, 0, d - 1);
  room.pit(-hw, hw, 3, d - 6);
  room.floor(-hw, -hw + 2, 3, d - 6);
  room.floor(hw - 2, hw, 3, d - 6);
  const r = hw - 4; // 島の半幅
  room.floor(-r, r, mid - 2, mid + 2, 1);
  for (const side of [-1, 1]) {
    // 橋から島へ上るスロープ（横向き）
    room.floor(side * (r + 2), side * (hw - 2), mid - 1, mid + 1);
    room.sideRamp(side * (r + 1), mid - 1, mid + 1, -side);
  }
}

// 部屋を横切る丘。溶岩の切れ目があり、3本のスロープから越える
function ridge({ hw, d, mid }, room) {
  room.floor(-hw, hw, 0, d - 1);
  room.floor(-hw, hw, mid - 2, mid + 2, 1);
  for (const v of [mid - 3, mid + 3]) {
    room.pit(-hw, hw, v, v);
    for (const [u0, u1] of [[-hw, -hw + 1], [-1, 1], [hw - 1, hw]]) {
      room.ramp(u0, u1, v, v < mid ? 'far' : 'near');
    }
  }
}

// 交互に張り出す溶岩溝を避けて蛇行する
function zigzag({ hw, d }, room) {
  room.floor(-hw, hw, 0, d - 1);
  let side = 1;
  for (let v = 4; v + 1 <= d - 7; v += 5) {
    room.pit(side > 0 ? -hw + 3 : -hw, side > 0 ? hw : hw - 3, v, v + 1);
    side = -side;
  }
}

export const COMBAT_LAYOUTS = { terraces, dais, bridge, islands, ridge, zigzag };

export const LAYOUTS = {
  ...COMBAT_LAYOUTS,
  start: ({ hw, d }, room) => room.floor(-hw, hw, 0, d - 1),
  boss: dais
};
