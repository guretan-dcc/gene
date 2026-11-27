// 渓谷スロープ・大高低差型
export function steppedCanyon({ W, D, cx }, { setFloorRect, setOctaRoom, addWideZRamp, addWideXRamp }) {
  // 高さ2から渓谷底(0)へ降り、再び高さ3の要塞へ登り詰めるダイナミックな縦長渓谷
  const zStart = D - 4;
  const zMid1 = Math.floor(D * 0.62);
  const zMid2 = Math.floor(D * 0.34);
  const zFar = Math.max(4, Math.floor(D * 0.18));

  // 高台スタートデッキ (H2)
  setFloorRect(cx - 2, zStart, cx + 2, D - 1, 2);
  // 2段連続の下り幅広スロープ (2 -> 1 -> 0)
  addWideZRamp(cx - 1, cx + 1, zStart - 1, -1, 2, 0);
  // 中央渓谷ボトム広場 (H0)
  setFloorRect(cx - 2, zMid2 + 2, cx + 2, zStart - 3, 0);
  setOctaRoom(cx, Math.floor((zMid1 + zMid2) / 2), Math.max(3, Math.floor(W * 0.38)), Math.max(3, Math.floor((zMid1 - zMid2) / 2) + 1), 0);

  // 両サイドの段々テラス (H1 -> H2) が渓谷を見下ろす
  if (W >= 11) {
    setFloorRect(0, zMid2, 2, zMid1 + 1, 1);
    setFloorRect(W - 3, zMid2, W - 1, zMid1 + 1, 1);
    addWideXRamp(zMid1 - 2, zMid1, 3, -1, 0, 1);
    addWideXRamp(zMid1 - 2, zMid1, W - 4, 1, 0, 1);

    // サイドから奥の高台へ登るスロープ (1 -> 2)
    setFloorRect(0, zFar + 2, 2, zMid2, 2);
    setFloorRect(W - 3, zFar + 2, W - 1, zMid2, 2);
    addWideZRamp(0, 2, zMid2, -1, 1, 2);
    addWideZRamp(W - 3, W - 1, zMid2, -1, 1, 2);
    // 最奥テラスと連結
    setFloorRect(0, zFar + 1, W - 1, zFar + 2, 2);
  }

  // 中央正面からの2段登りスロープ (0 -> 1 -> 2)
  addWideZRamp(cx - 1, cx + 1, zMid2 + 2, -1, 0, 2);
  // 最奥テラス (H2) + 頂上狙撃台 (H3)
  setFloorRect(cx - Math.floor(W * 0.38), 0, cx + Math.floor(W * 0.38), zFar + 1, 2);
  setFloorRect(cx - 2, 0, cx + 2, Math.max(2, zFar - 2), 3);
  addWideZRamp(cx - 1, cx + 1, Math.max(3, zFar - 1), -1, 2, 3);
}
