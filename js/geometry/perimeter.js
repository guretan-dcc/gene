// 外周ホールの輪郭
import { state } from '../state.js';

export function getChamberPerimeterPoints() {
  const S = state.cellSize;
  const outHx = (state.gridWidth * S) / 2 + state.chasmGap * S;
  const outHz = (state.gridDepth * S) / 2 + state.chasmGap * S;

  if (state.chamberShape === 'octagonal') {
    const cut = Math.min(outHx, outHz) * 0.42;
    // 上空(+Y)から見て時計回り：0=奥, 1=奥右, 2=右, 3=手前右, 4=手前, 5=手前左, 6=左, 7=奥左
    return [
      { x: -outHx + cut, z: -outHz },
      { x:  outHx - cut, z: -outHz },
      { x:  outHx,       z: -outHz + cut },
      { x:  outHx,       z:  outHz - cut },
      { x:  outHx - cut, z:  outHz },
      { x: -outHx + cut, z:  outHz },
      { x: -outHx,       z:  outHz - cut },
      { x: -outHx,       z: -outHz + cut }
    ];
  }

  // 長方形：0=奥(-Z), 1=右(+X), 2=手前(+Z), 3=左(-X)
  return [
    { x: -outHx, z: -outHz },
    { x:  outHx, z: -outHz },
    { x:  outHx, z:  outHz },
    { x: -outHx, z:  outHz }
  ];
}

// プレビュー時に下げる手前側(+Z)の辺かどうか
export function isFrontSegment(index) {
  return state.chamberShape === 'octagonal'
    ? (index === 3 || index === 4 || index === 5)
    : (index === 2);
}
