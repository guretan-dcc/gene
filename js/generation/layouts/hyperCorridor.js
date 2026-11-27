// 立体回廊・多段テラス型
import { state } from '../../state.js';

export function hyperCorridor({ W, D, cx }, { setFloorRect, setOctaRoom, addWideZRamp, addWideXRamp }) {
  // スタート高台ドック → 下り幅広スロープ → 進入橋 → 八角中央広場＋左右高台回廊 → 二段登りスロープ → 最奥要塞テラス
  const dockZ0 = D - 4;
  const midZ = Math.floor(D * 0.54);
  const farZ1 = Math.max(4, Math.floor(D * 0.22));
  const bridgeHalf = 1;

  // スタートドック（高さ1の張り出しドック）
  setFloorRect(cx - 2, dockZ0, cx + 2, D - 1, 1);
  // ドックから進入橋への下りスロープ (1 -> 0)
  addWideZRamp(cx - 1, cx + 1, dockZ0 - 1, -1, 1, 0);
  // 進入ブリッジ通路（幅3〜5マス）
  setFloorRect(cx - bridgeHalf, midZ + 4, cx + bridgeHalf, dockZ0 - 2, 0);

  // 中央八角バトル広場（高さ0）
  const midRx = Math.max(3, Math.floor(W * 0.36));
  const midRz = Math.max(4, Math.floor(D * 0.17));
  setOctaRoom(cx, midZ, midRx, midRz, 0);

  // 左右に張り出す高台キャットウォーク（高さ1）＋幅広スロープ接続
  if (W >= 11) {
    const sideW = Math.max(2, Math.floor(W * 0.2));
    const catZ0 = Math.max(farZ1 + 3, midZ - midRz - 2);
    const catZ1 = Math.min(dockZ0 - 4, midZ + midRz - 1);
    // 左キャットウォーク
    setFloorRect(0, catZ0, sideW - 1, catZ1, 1);
    addWideXRamp(midZ - 1, midZ + 1, sideW, -1, 0, 1);
    // 右キャットウォーク（非対称時は片側だけ奥へ延長）
    const rightZ0 = state.symmetry === 'none' ? Math.max(farZ1 + 1, catZ0 - 3) : catZ0;
    setFloorRect(W - sideW, rightZ0, W - 1, catZ1, 1);
    addWideXRamp(midZ - 1, midZ + 1, W - 1 - sideW, 1, 0, 1);
    // 左右キャットウォークから最奥側へ合流するブリッジ
    setFloorRect(1, farZ1 + 2, 2, catZ0, 1);
    setFloorRect(W - 3, farZ1 + 2, W - 2, rightZ0, 1);
    setFloorRect(1, farZ1 + 2, cx - 2, farZ1 + 3, 1);
    setFloorRect(cx + 2, farZ1 + 2, W - 2, farZ1 + 3, 1);
  }

  // 中央から最奥テラスへ続く連絡橋＋2段登りスロープ (0 -> 1 -> 2)
  setFloorRect(cx - 1, farZ1 + 3, cx + 1, midZ - midRz + 1, 0);
  addWideZRamp(cx - 1, cx + 1, farZ1 + 2, -1, 0, 2);

  // 最奥要塞テラス（高さ2、八角カット）
  setOctaRoom(cx, Math.floor(farZ1 / 2), Math.max(3, Math.floor(W * 0.42)), Math.max(2, Math.floor(farZ1 / 2) + 1), 2);
  // 最奥奥中央に高さ3の狙撃壇
  if (farZ1 >= 5) {
    setFloorRect(cx - 2, 0, cx + 2, 1, 3);
    addWideZRamp(cx - 1, cx + 1, 2, -1, 2, 3);
  }
}
