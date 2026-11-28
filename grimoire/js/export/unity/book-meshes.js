// 本の形。開いた本(Body + 見開きごとの紙面)と閉じた本(Closed)を作る
import { state } from '../../state.js';
import { getBookDims } from '../../book/dimensions.js';
import { sampleOpenPageCurve } from '../../book/curves.js';
import { getTabSpreads, getTabPlacement, TAB_SIZE, TAB_COLORS } from '../../book/edge.js';
import { UvMesh } from './mesh.js';

const SEGMENTS = 10;
const PAGE_LIFT = 0.004;

const flat = (atlas, name) => () => atlas.uv(name);
// 単色の箱
const solidBox = (mesh, atlas, min, max, color) => mesh.box(min, max, {
  top: flat(atlas, `${color}:top`), bottom: flat(atlas, `${color}:end`),
  left: flat(atlas, `${color}:end`), right: flat(atlas, `${color}:end`),
  front: flat(atlas, `${color}:side`), back: flat(atlas, `${color}:side`)
});

// y: 表紙の下面を 0 にするための持ち上げ量
function openBody(atlas, dims) {
  const mesh = new UvMesh();
  const { w, h, coverThick: ct, pageH, halfT } = dims;
  // 側面の上端は紙面と同じ高さにする(隙間から表紙が見えないように)
  const curve = sampleOpenPageCurve(SEGMENTS, halfT, dims).map(p => ({ x: p.x, y: p.y + PAGE_LIFT }));
  const end = curve[SEGMENTS];

  for (const dir of [-1, 1]) {
    const cx = dir * w / 2;
    const art = dir < 0 ? 'front' : 'back';
    const x0 = Math.min(0, dir * w);
    const side = flat(atlas, 'cover:side');
    mesh.box([x0, 0, -h / 2], [x0 + w, ct, h / 2], {
      top: flat(atlas, 'cover:top'),
      bottom: p => atlas.uv(art, (cx + w / 2 - p[0]) / w, (h / 2 - p[2]) / h),
      [dir < 0 ? 'left' : 'right']: flat(atlas, 'cover:end'),
      front: side,
      back: side
    });

    // ページの束の側面。v は一番厚いときを1とする(積み重なりの縞の間隔をそろえる)
    const edge = (u, y) => atlas.uv('edge', u, Math.min(1, y / dims.maxT));
    for (const z of [-pageH / 2, pageH / 2]) {
      for (let i = 0; i < SEGMENTS; i++) {
        const u0 = i / SEGMENTS;
        const u1 = (i + 1) / SEGMENTS;
        mesh.quad(
          [
            [dir * u0 * end.x, ct, z], [dir * u1 * end.x, ct, z],
            [dir * curve[i + 1].x, ct + curve[i + 1].y, z], [dir * curve[i].x, ct + curve[i].y, z]
          ],
          [0, 0, Math.sign(z)],
          [edge(u0, 0), edge(u1, 0), edge(u1, curve[i + 1].y), edge(u0, curve[i].y)]
        );
      }
    }
    const x = dir * end.x;
    mesh.quad(
      [[x, ct, -pageH / 2], [x, ct, pageH / 2], [x, ct + end.y, pageH / 2], [x, ct + end.y, -pageH / 2]],
      [dir, 0, 0],
      [edge(0, 0), edge(1, 0), edge(1, end.y), edge(0, end.y)]
    );
  }
  return mesh;
}

// 見開き1つ分の紙面と見出しタブ
function openSpread(atlas, dims, index) {
  const mesh = new UvMesh();
  const { coverThick: ct, pageH, halfT } = dims;
  const curve = sampleOpenPageCurve(SEGMENTS, halfT, dims);
  const y = point => ct + point.y + PAGE_LIFT;

  for (const dir of [-1, 1]) {
    const cell = `page${index * 2 + (dir < 0 ? 0 : 1)}`;
    for (let i = 0; i < SEGMENTS; i++) {
      const a = curve[i];
      const b = curve[i + 1];
      // 絵の左右: 左ページは外側が左端、右ページはとじ目が左端
      const ua = dir < 0 ? 1 - i / SEGMENTS : i / SEGMENTS;
      const ub = dir < 0 ? 1 - (i + 1) / SEGMENTS : (i + 1) / SEGMENTS;
      mesh.quad(
        [
          [dir * a.x, y(a), -pageH / 2], [dir * b.x, y(b), -pageH / 2],
          [dir * b.x, y(b), pageH / 2], [dir * a.x, y(a), pageH / 2]
        ],
        [-dir * (b.y - a.y), b.x - a.x, 0],
        [atlas.uv(cell, ua, 1), atlas.uv(cell, ub, 1), atlas.uv(cell, ub, 0), atlas.uv(cell, ua, 0)]
      );
    }
  }

  if (state.tabs) {
    const tabSpreads = getTabSpreads(state.spreads);
    tabSpreads.forEach((_, i) => {
      const at = getTabPlacement(dims, 1, i, tabSpreads, index, state.spreads.length, 0.5);
      const half = [TAB_SIZE.w / 2, TAB_SIZE.h / 2, TAB_SIZE.d / 2];
      const center = [at.x, ct + at.y, at.z];
      solidBox(mesh, atlas, center.map((v, k) => v - half[k]), center.map((v, k) => v + half[k]),
        `tab${i % TAB_COLORS.length}`);
    });
  }
  return mesh;
}

// 表紙を上にして寝かせた本。中心が原点にくるようにずらす
function closedBook(atlas, dims) {
  const mesh = new UvMesh();
  const { w, h, t, coverThick: ct, pageW, pageH } = dims;
  const left = -w / 2;
  const right = w / 2;
  const coverFaces = side => ({
    left: flat(atlas, 'cover:end'), right: flat(atlas, 'cover:end'),
    front: flat(atlas, side), back: flat(atlas, side)
  });
  mesh.box([left, 0, -h / 2], [right, ct, h / 2], {
    ...coverFaces('cover:side'),
    top: flat(atlas, 'cover:side'),
    bottom: p => atlas.uv('back', (right - p[0]) / w, (h / 2 - p[2]) / h)
  });
  mesh.box([left, ct + t, -h / 2], [right, ct * 2 + t, h / 2], {
    ...coverFaces('cover:side'),
    top: p => atlas.uv('front', (p[0] - left) / w, (h / 2 - p[2]) / h),
    bottom: flat(atlas, 'cover:end')
  });
  const edgeAlong = axis => p => atlas.uv('edge',
    axis === 0 ? (p[0] - left) / pageW : (p[2] + pageH / 2) / pageH, (p[1] - ct) / t);
  mesh.box([left, ct, -pageH / 2], [left + pageW, ct + t, pageH / 2], {
    front: edgeAlong(0), back: edgeAlong(0), right: edgeAlong(2)
  });
  // 背表紙
  const spineSide = flat(atlas, 'cover:side');
  mesh.box([left - ct, 0, -h / 2], [left, ct * 2 + t, h / 2], {
    left: p => atlas.uv('spine', p[1] / (ct * 2 + t), (h / 2 - p[2]) / h),
    top: flat(atlas, 'cover:top'), bottom: flat(atlas, 'cover:end'),
    front: spineSide, back: spineSide
  });
  return mesh;
}

export function buildBookMeshes(atlas) {
  const dims = getBookDims();
  const spreads = state.spreads.map((_, i) => ({
    name: `Spread_${String(i + 1).padStart(2, '0')}`,
    mesh: openSpread(atlas, dims, i)
  }));
  return {
    parts: [
      { name: 'Body', mesh: openBody(atlas, dims), active: true },
      ...spreads.map((s, i) => ({ ...s, active: i === 0 })),
      { name: 'Closed', mesh: closedBook(atlas, dims), active: false }
    ],
    // 開いた本を覆う当たり判定
    collider: {
      size: [dims.w * 2, dims.coverThick + dims.halfT + 0.2, dims.h],
      center: [0, (dims.coverThick + dims.halfT + 0.2) / 2, 0]
    }
  };
}
