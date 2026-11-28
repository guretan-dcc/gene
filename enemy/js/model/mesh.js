// 面ごとに色と法線を持つローポリメッシュ(Three.js に依存しない)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

export class Mesh {
  positions = [];
  normals = [];
  colors = [];
  indices = [];

  // 表から見て反時計回りの平らな多角形
  addFace(points, color) {
    const n = cross(sub(points[1], points[0]), sub(points[2], points[0]));
    const length = Math.hypot(...n) || 1;
    const base = this.positions.length / 3;
    const rgb = hexToRgb(color);
    for (const p of points) {
      this.positions.push(...p);
      this.normals.push(n[0] / length, n[1] / length, n[2] / length);
      this.colors.push(...rgb);
    }
    for (let i = 2; i < points.length; i++) this.indices.push(base, base + i - 1, base + i);
  }

  // 下の輪郭と上の輪郭(同じ点数・上から見て同じ向き)をつないだ立体
  addLoft(bottom, top, color, { capBottom = true, capTop = true } = {}) {
    bottom.forEach((p, i) => {
      const j = (i + 1) % bottom.length;
      this.addFace([p, bottom[j], top[j], top[i]], color);
    });
    if (capTop) this.addFace(top, color);
    if (capBottom) this.addFace([...bottom].reverse(), color);
  }

  // 上下で幅と奥行きを変えられる箱。y0/y1 は下端と上端、x/z は中心
  addBox({ x = 0, z = 0, y0, y1, w, d, topW = w, topD = d, topZ = z }, color) {
    const ring = (y, width, depth, cz) => [
      [x - width / 2, y, cz + depth / 2], [x + width / 2, y, cz + depth / 2],
      [x + width / 2, y, cz - depth / 2], [x - width / 2, y, cz - depth / 2]
    ];
    this.addLoft(ring(y0, w, d, z), ring(y1, topW, topD, topZ), color);
  }

  // y 軸まわりの多角柱
  addPrism({ y0, y1, radius, topRadius = radius, sides = 8 }, color) {
    const ring = (y, r) => Array.from({ length: sides }, (_, i) => {
      const a = (i + 0.5) / sides * Math.PI * 2;
      return [Math.sin(a) * r, y, Math.cos(a) * r];
    });
    this.addLoft(ring(y0, radius), ring(y1, topRadius), color);
  }

  // x 方向に厚みを持つ板。outline は [z, y] の反時計回り(+x から見て)
  addPlate(outline, thickness, color, x = 0) {
    const side = dx => outline.map(([z, y]) => [x + dx, y, z]);
    const right = side(thickness / 2);
    const left = side(-thickness / 2);
    // +x から見ると z は左向きなので、+x の面は逆順にする
    this.addFace([...right].reverse(), color);
    this.addFace(left, color);
    right.forEach((p, i) => {
      const j = (i + 1) % right.length;
      this.addFace([p, right[j], left[j], left[i]], color);
    });
  }

  get triangleCount() {
    return this.indices.length / 3;
  }
}
