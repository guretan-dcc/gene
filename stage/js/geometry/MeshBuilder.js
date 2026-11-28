// 頂点カラー付き BufferGeometry を組み立てる共通ビルダー
export class MeshBuilder {
  positions = [];
  normals = [];
  colors = [];
  indices = [];

  // 1クワッド（2三角形）を追加
  addQuad(p0, p1, p2, p3, normal, color) {
    const base = this.addVertices([p0, p1, p2, p3], normal, color);
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // 1三角形を追加（法線は頂点から計算）
  addTriangle(a, b, c, color) {
    const vA = new THREE.Vector3(...a);
    const vB = new THREE.Vector3(...b);
    const vC = new THREE.Vector3(...c);
    const n = new THREE.Vector3().subVectors(vB, vA).cross(new THREE.Vector3().subVectors(vC, vA)).normalize();
    const base = this.addVertices([a, b, c], [n.x, n.y, n.z], color);
    this.indices.push(base, base + 1, base + 2);
  }

  // ボックスを追加する。skip に指定した向き（'+x' '-y' など）の面は作らない
  addBox(x0, x1, y0, y1, z0, z1, color, skip = []) {
    const faces = {
      '+y': [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]],
      '+x': [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]],
      '-x': [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
      '+z': [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
      '-z': [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
      '-y': [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]]
    };
    for (const [key, [p0, p1, p2, p3, normal]] of Object.entries(faces)) {
      if (!skip.includes(key)) this.addQuad(p0, p1, p2, p3, normal, color);
    }
  }

  // 底面なし（天面＋4側面＝10三角形）のボックスを追加
  addNoBottomBox(x0, x1, y0, y1, z0, z1, color) {
    this.addBox(x0, x1, y0, y1, z0, z1, color, ['-y']);
  }

  // 頂点を追加し、先頭の頂点番号を返す
  addVertices(points, normal, color) {
    const base = this.positions.length / 3;
    for (const p of points) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      this.colors.push(color.r, color.g, color.b);
    }
    return base;
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geo.setIndex(this.indices);
    geo.computeBoundingSphere();
    return geo;
  }
}
