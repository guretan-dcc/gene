// =========================================================================
// 1. 決定論的乱数 & FBM パーリンノイズ (`FloatingTerrainBuilder.cs` 準拠)
// =========================================================================
export class SeededRandom {
    constructor(seed) {
        this.state = (seed | 0) || 123456789;
    }
    next() {
        let x = this.state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.state = x;
        return ((x >>> 0) / 4294967296);
    }
    range(min, max) {
        return min + (max - min) * this.next();
    }
    signed() {
        return this.next() * 2.0 - 1.0;
    }
}

export class PerlinNoise2D {
    constructor(seed) {
        const r0 = new SeededRandom(seed);
        this.p = new Uint8Array(512);
        const perm = new Uint8Array(256);
        for (let i = 0; i < 256; i++) perm[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(r0.next() * (i + 1));
            const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
        }
        for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
        this.offs = [];
        for (let i = 0; i < 16; i++) {
            this.offs.push({ x: r0.next() * 1000, y: r0.next() * 1000 });
        }
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x, y) {
        const h = hash & 7;
        const u = h < 4 ? x : y;
        const v = h < 4 ? y : x;
        return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
    }
    noise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = this.fade(x), v = this.fade(y);
        const A = this.p[X] + Y, B = this.p[X + 1] + Y;
        const res = this.lerp(v,
            this.lerp(u, this.grad(this.p[A], x, y), this.grad(this.p[B], x - 1, y)),
            this.lerp(u, this.grad(this.p[A + 1], x, y - 1), this.grad(this.p[B + 1], x - 1, y - 1))
        );
        return Math.max(0, Math.min(1, res * 0.35 + 0.5));
    }
    fbm(x, z, salt, freq, oct) {
        const o = this.offs[salt & 15];
        let a = 1.0, sum = 0.0, norm = 0.0, f = freq;
        for (let i = 0; i < oct; i++) {
            sum += a * this.noise(x * f + o.x, z * f + o.y);
            norm += a;
            a *= 0.5;
            f *= 2.0;
        }
        return sum / norm;
    }
}
