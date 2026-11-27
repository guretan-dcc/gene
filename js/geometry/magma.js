// 広大・深底マグマ海ジオメトリ（たった2ポリゴン）
import { state } from '../state.js';
import { PALETTE } from '../config/constants.js';
import { getGridMetrics } from '../core/grid.js';
import { MeshBuilder } from './MeshBuilder.js';

export function buildMagmaGeometry() {
  const { W, D, S } = getGridMetrics();

  const extra = state.chasmGap * S + state.magmaMargin;
  const hx = (W * S) / 2 + extra;
  const hz = (D * S) / 2 + extra;
  const y = -state.magmaDepth;

  const mesh = new MeshBuilder();
  mesh.addQuad(
    [-hx, y, -hz], [-hx, y, hz], [hx, y, hz], [hx, y, -hz],
    [0, 1, 0], new THREE.Color(PALETTE.magma)
  );
  return mesh.build();
}
