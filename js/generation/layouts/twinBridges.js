// 双子橋・高台溶岩島型
export function twinBridges({ W, D, cx, cz }, { setFloorRect, setOctaRoom, addWideZRamp, addWideXRamp }) {
  // 深いマグマ谷の上に左右2本の長い橋と中央高台島を架ける
  const bLeft = Math.max(1, Math.floor(W * 0.18));
  const bRight = W - 1 - bLeft;

  // スタートデッキ (H0) & 最奥高台デッキ (H2)
  setFloorRect(0, D - 4, W - 1, D - 1, 0);
  setFloorRect(0, 0, W - 1, 4, 2);

  // 左右の長い双子ブリッジ（幅3マス、中央付近で高さ1へ上がる）
  setFloorRect(bLeft - 1, 7, bLeft + 1, D - 4, 0);
  setFloorRect(bRight - 1, 7, bRight + 1, D - 4, 0);
  // 奥デッキへの2段登りスロープ (0 -> 1 -> 2)
  addWideZRamp(bLeft - 1, bLeft + 1, 6, -1, 0, 2);
  addWideZRamp(bRight - 1, bRight + 1, 6, -1, 0, 2);

  // 中央の浮遊高台島 (H1)＋左右橋からの横断スロープ接続
  const islandRx = Math.max(2, Math.floor(W * 0.24));
  const islandRz = Math.max(3, Math.floor(D * 0.15));
  setOctaRoom(cx, cz, islandRx, islandRz, 1);
  // 左右ブリッジと中央島を繋ぐ横断橋＋スロープ
  setFloorRect(bLeft + 2, cz - 1, cx - islandRx, cz + 1, 0);
  setFloorRect(cx + islandRx, cz - 1, bRight - 2, cz + 1, 0);
  addWideXRamp(cz - 1, cz + 1, cx - islandRx, 1, 0, 1);
  addWideXRamp(cz - 1, cz + 1, cx + islandRx, -1, 0, 1);
}
