// =========================================================================
// 4. フラットシェーディング頂点カラーメッシュビルダー (`FloatingTerrainBuilder.Mb` 移植)
// =========================================================================
class ColoredMeshBuilder {
    constructor() {
        this.v = [];
        this.c = [];
        this.a = [];
    }
    tri(p0, p1, p2, c0, c1, c2, outDir, alpha = 1.0) {
        const ux = p1.x - p0.x, uy = p1.y - p0.y, uz = p1.z - p0.z;
        const vx = p2.x - p0.x, vy = p2.y - p0.y, vz = p2.z - p0.z;
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        if (outDir && (nx * outDir.x + ny * outDir.y + nz * outDir.z < 0)) {
            const tp = p1; p1 = p2; p2 = tp;
            const tc = c1; c1 = c2; c2 = tc;
        }
        this.emit(p0, p1, p2, c0, c1, c2, alpha);
    }
    emit(p0, p1, p2, c0, c1, c2, alpha = 1.0) {
        this.v.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        this.c.push(c0.r, c0.g, c0.b, c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
        this.a.push(alpha, alpha, alpha);
    }
    quad(p0, p1, p2, p3, c0, c1, c2, c3, outDir, alpha = 1.0) {
        this.tri(p0, p1, p2, c0, c1, c2, outDir, alpha);
        this.tri(p0, p2, p3, c0, c2, c3, outDir, alpha);
    }
    toThreeGeometry() {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.v, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
        geo.computeVertexNormals();
        return geo;
    }
}
