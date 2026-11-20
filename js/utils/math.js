export function smoothstep(a, b, x) {
    if (Math.abs(a - b) < 1e-6) return x >= b ? 1.0 : 0.0;
    const t = Math.max(0.0, Math.min(1.0, (x - a) / (b - a)));
    return t * t * (3.0 - 2.0 * t);
}

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return { r: ((num >> 16) & 255) / 255, g: ((num >> 8) & 255) / 255, b: (num & 255) / 255 };
}
export function lerpColor(c1, c2, t) {
    const u = clamp(t, 0, 1);
    return { r: c1.r + (c2.r - c1.r) * u, g: c1.g + (c2.g - c1.g) * u, b: c1.b + (c2.b - c1.b) * u };
}
export function shadeColor(c, v) {
    return {
        r: clamp(c.r * (1.0 + v), 0, 1),
        g: clamp(c.g * (1.0 + v), 0, 1),
        b: clamp(c.b * (1.0 + v), 0, 1)
    };
}
