// 浮遊通路・分岐ブリッジ型
import { state } from '../../state.js';

export function skyWalkways({ W, D, cx, rng }, { setFloorRect, setOctaRoom, addWideZRamp, addWideXRamp }) {
  // うねり・分岐しながら高さの違う浮遊島を繋ぐ非矩形スカイウォーク
  const numIslands = Math.max(3, Math.min(6, Math.floor(D / 9)));
  const zStep = Math.floor((D - 8) / (numIslands - 1));

  // スタート島
  setFloorRect(cx - 2, D - 4, cx + 2, D - 1, 0);

  let prevX = cx;
  let prevZ = D - 3;
  let prevH = 0;

  for (let i = 1; i < numIslands; i++) {
    const isLast = (i === numIslands - 1);
    const nz = isLast ? 2 : Math.max(4, (D - 4) - i * zStep);
    let nx = cx;
    if (!isLast && state.symmetry === 'none') {
      const shift = (i % 2 === 1 ? -1 : 1) * Math.max(2, Math.floor(W * 0.25));
      nx = Math.max(3, Math.min(W - 4, cx + shift));
    }
    const nh = isLast ? 2 : (i % 2 === 1 ? 1 : (rng() < 0.5 ? 2 : 0));

    // 浮遊島を彫刻
    const rx = isLast ? Math.max(3, Math.floor(W * 0.36)) : Math.max(2, Math.floor(W * 0.26));
    const rz = 3;
    setOctaRoom(nx, nz, rx, rz, nh);

    // 左右対称モードなら脇に浮遊ウィング島＋接続橋を追加
    if (state.symmetry === '2way' && !isLast && W >= 11 && i % 2 === 1) {
      const wingX = Math.max(1, Math.floor(W * 0.14));
      setFloorRect(0, nz - 2, wingX + 1, nz + 2, Math.min(3, nh + 1));
      setFloorRect(W - 2 - wingX, nz - 2, W - 1, nz + 2, Math.min(3, nh + 1));
      // 中央島からウィング島への横ブリッジ＋スロープ
      const gapL = nx - rx;
      if (gapL > wingX + 1) {
        setFloorRect(wingX + 2, nz - 1, gapL, nz + 1, nh);
        setFloorRect(W - 1 - gapL, nz - 1, W - 3 - wingX, nz + 1, nh);
      }
      addWideXRamp(nz - 1, nz + 1, wingX + 2, -1, nh, Math.min(3, nh + 1));
      addWideXRamp(nz - 1, nz + 1, W - 3 - wingX, 1, nh, Math.min(3, nh + 1));
    }

    // 前の島と現在の島を幅3のL字/直線ブリッジ＋スロープで連結
    const midBridgeZ = Math.floor((prevZ + nz) / 2);
    // 縦区間1（prevZ -> midBridgeZ）
    setFloorRect(prevX - 1, midBridgeZ, prevX + 1, prevZ - 1, prevH);
    // 横区間（prevX -> nx）
    setFloorRect(Math.min(prevX, nx) - 1, midBridgeZ - 1, Math.max(prevX, nx) + 1, midBridgeZ + 1, prevH);
    // 縦区間2（midBridgeZ -> nz）＋段差スロープ
    setFloorRect(nx - 1, nz + rz, nx + 1, midBridgeZ, prevH);
    if (nh !== prevH) {
      const rampStartZ = Math.min(midBridgeZ, nz + rz + Math.abs(nh - prevH));
      addWideZRamp(nx - 1, nx + 1, rampStartZ, -1, prevH, nh);
      if (rampStartZ - Math.abs(nh - prevH) > nz) {
        setFloorRect(nx - 1, nz, nx + 1, rampStartZ - Math.abs(nh - prevH), nh);
      }
    }

    prevX = nx;
    prevZ = nz;
    prevH = nh;
  }
}
