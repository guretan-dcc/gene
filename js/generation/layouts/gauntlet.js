// 連続ウェーブ多部屋回廊
export function gauntlet({ W, D, cx }, { setFloorRect, setOctaRoom, addWideZRamp }) {
  // 広い部屋と細い橋回廊が交互に連なり、奥へ進むほど標高が上がる
  const numRooms = Math.max(3, Math.min(5, Math.floor(D / 10)));
  const segLen = Math.floor(D / numRooms);

  for (let r = 0; r < numRooms; r++) {
    const rz1 = D - 1 - r * segLen;
    const rz0 = r === numRooms - 1 ? 0 : Math.max(0, rz1 - segLen + 1);
    const roomMidZ = Math.floor((rz0 + rz1) / 2);
    const h = Math.min(3, Math.floor((r * 3) / numRooms));
    const roomRx = Math.max(3, Math.floor(W * (r === 0 ? 0.34 : 0.45)));
    const roomRz = Math.max(2, Math.floor((rz1 - rz0) * 0.34));

    setOctaRoom(cx, roomMidZ, roomRx, roomRz, h);

    // 次の部屋へ繋ぐ幅3の連絡回廊＋スロープ
    if (r < numRooms - 1) {
      const nextRz1 = rz0 - 1;
      const nextRz0 = (r + 1) === numRooms - 1 ? 0 : Math.max(0, nextRz1 - segLen + 1);
      const nextMidZ = Math.floor((nextRz0 + nextRz1) / 2);
      const nextH = Math.min(3, Math.floor(((r + 1) * 3) / numRooms));

      setFloorRect(cx - 1, nextMidZ, cx + 1, roomMidZ, h);
      if (nextH !== h) {
        const rampZ = Math.min(roomMidZ - roomRz, Math.max(nextMidZ + 2, rz0));
        addWideZRamp(cx - 1, cx + 1, rampZ, -1, h, nextH);
        if (rampZ - Math.abs(nextH - h) >= nextMidZ) {
          setFloorRect(cx - 1, nextMidZ, cx + 1, rampZ - Math.abs(nextH - h), nextH);
        }
      }
    }
  }
}
