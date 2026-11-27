// 八角Hyperdome＋進入橋
export function octaDome({ W, D, cx }, { setFloorRect, setOctaRoom, addWideZRamp, addWideXRamp }) {
  // スタートゲートからマグマ橋を渡り、段差リングのある巨大八角決闘場へ入る
  const arenaRz = Math.max(6, Math.floor(D * 0.34));
  const arenaRx = Math.max(4, Math.floor(W * 0.48));
  const arenaCz = Math.min(D - 8, Math.max(arenaRz + 1, Math.floor(D * 0.42)));

  // スタートゲート足場＋進入ロングブリッジ
  setFloorRect(cx - 2, D - 3, cx + 2, D - 1, 1);
  addWideZRamp(cx - 1, cx + 1, D - 4, -1, 1, 0);
  setFloorRect(cx - 1, arenaCz + arenaRz - 1, cx + 1, D - 5, 0);

  // 外周の高台リング (H1)
  setOctaRoom(cx, arenaCz, arenaRx, arenaRz, 1);
  // 中央の決闘ピット (H0)
  setOctaRoom(cx, arenaCz, Math.max(2, arenaRx - 2), Math.max(3, arenaRz - 3), 0);

  // 4方向から中央ピットと外周リングを繋ぐ幅広スロープ
  const innerZFront = arenaCz + Math.max(3, arenaRz - 3);
  const innerZBack = arenaCz - Math.max(3, arenaRz - 3);
  const innerXSide = Math.max(2, arenaRx - 2);
  // 手前からの進入口は平らに抜く
  setFloorRect(cx - 1, innerZFront, cx + 1, arenaCz + arenaRz + 1, 0);
  // 奥側へ登るスロープ (0 -> 1)
  addWideZRamp(cx - 1, cx + 1, innerZBack + 1, -1, 0, 1);
  // 左右へ登るスロープ (0 -> 1)
  addWideXRamp(arenaCz - 1, arenaCz + 1, cx - innerXSide, -1, 0, 1);
  addWideXRamp(arenaCz - 1, arenaCz + 1, cx + innerXSide, 1, 0, 1);

  // 最奥にVIP観戦／狙撃バルコニー (H2)
  setFloorRect(cx - 3, 0, cx + 3, Math.max(2, arenaCz - arenaRz + 1), 2);
  addWideZRamp(cx - 1, cx + 1, Math.max(3, arenaCz - arenaRz + 2), -1, 1, 2);
}
