// =========================================================================
// 4. フラットシェーディング頂点カラーメッシュビルダー (`FloatingTerrainBuilder.Mb` 移植)
// =========================================================================
export class ColoredMeshBuilder {
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

// 隣り合う三角形の巻き方向を揃え、閉じた面なら外向きになるよう統一する。
// Three.js は両面描画で気づきにくいが、Unity は裏面カリングで逆向き三角形が「穴」に見えるため。
export function unifyWinding(mb) {
    const n = mb.v.length / 9;
    const Q = 1000;
    const key = i => `${Math.round(mb.v[i * 3] * Q)},${Math.round(mb.v[i * 3 + 1] * Q)},${Math.round(mb.v[i * 3 + 2] * Q)}`;
    const ids = new Array(n * 3);
    const edgeMap = new Map(); // 無向辺 -> [三角形...]
    for (let t = 0; t < n; t++) {
        for (let k = 0; k < 3; k++) ids[t * 3 + k] = key(t * 3 + k);
        for (let k = 0; k < 3; k++) {
            const a = ids[t * 3 + k], b = ids[t * 3 + (k + 1) % 3];
            if (a === b) continue;
            const ek = a < b ? a + '|' + b : b + '|' + a;
            let l = edgeMap.get(ek);
            if (!l) edgeMap.set(ek, l = []);
            l.push(t);
        }
    }
    const flip = new Uint8Array(n);   // 反転する三角形
    const seen = new Uint8Array(n);
    // 三角形 t の（反転後の）有向辺 a->b の向きを返す: 1 = 順方向で含む, -1 = 逆方向, 0 = 含まない
    const dirOf = (t, a, b) => {
        for (let k = 0; k < 3; k++) {
            let x = ids[t * 3 + k], y = ids[t * 3 + (k + 1) % 3];
            if (flip[t]) { const tmp = x; x = y; y = tmp; }
            if (x === a && y === b) return 1;
            if (x === b && y === a) return -1;
        }
        return 0;
    };
    const normalY = t => {
        const o = t * 9, v = mb.v;
        const ux = v[o + 3] - v[o], uz = v[o + 5] - v[o + 2];
        const wx = v[o + 6] - v[o], wz = v[o + 8] - v[o + 2];
        const nx = (v[o + 4] - v[o + 1]) * wz - uz * (v[o + 7] - v[o + 1]);
        const ny = uz * wx - ux * wz;
        const nz = ux * (v[o + 7] - v[o + 1]) - (v[o + 4] - v[o + 1]) * wx;
        const len = Math.hypot(nx, ny, nz) || 1;
        return ny / len;
    };
    for (let s = 0; s < n; s++) {
        if (seen[s]) continue;
        const comp = [s];
        seen[s] = 1;
        for (let qi = 0; qi < comp.length; qi++) {
            const t = comp[qi];
            for (let k = 0; k < 3; k++) {
                const a = ids[t * 3 + k], b = ids[t * 3 + (k + 1) % 3];
                if (a === b) continue;
                const l = edgeMap.get(a < b ? a + '|' + b : b + '|' + a);
                if (l.length !== 2) continue;           // 非多様体・開いた辺は伝播させない
                const u = l[0] === t ? l[1] : l[0];
                if (seen[u]) continue;
                // 隣は逆向きに辺を通るのが正しい
                if (dirOf(t, a, b) === dirOf(u, a, b)) flip[u] = 1;
                seen[u] = 1;
                comp.push(u);
            }
        }
        // 成分全体: 上向きの面が多数派になる向きにする
        let up = 0;
        for (const t of comp) {
            const ny = normalY(t) * (flip[t] ? -1 : 1);
            if (Math.abs(ny) > 0.7) up += ny > 0 ? 1 : -1;
        }
        if (up < 0) for (const t of comp) flip[t] ^= 1;
    }
    let flipped = 0;
    for (let t = 0; t < n; t++) {
        if (!flip[t]) continue;
        flipped++;
        const o = t * 9;
        for (let k = 0; k < 3; k++) {
            const tmpV = mb.v[o + 3 + k]; mb.v[o + 3 + k] = mb.v[o + 6 + k]; mb.v[o + 6 + k] = tmpV;
            const tmpC = mb.c[o + 3 + k]; mb.c[o + 3 + k] = mb.c[o + 6 + k]; mb.c[o + 6 + k] = tmpC;
        }
    }
    return flipped;
}

