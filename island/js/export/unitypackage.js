// .unitypackage (= tar.gz) を依存ライブラリなしで作る。
// 構造は Unity が書き出すものと同じ:  <guid>/asset , <guid>/asset.meta , <guid>/pathname
// Unity の Assets > Import Package > Custom Package で、または .unitypackage をダブルクリックして取り込める。
const enc = new TextEncoder();

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function tarHeader(name, size, isDir) {
    const h = new Uint8Array(512);
    const put = (str, off, len) => { const b = enc.encode(str); h.set(b.subarray(0, len), off); };
    const oct = (v, len) => v.toString(8).padStart(len - 1, '0') + '\0';
    put(name, 0, 100);
    put(oct(isDir ? 0o755 : 0o644, 8), 100, 8);
    put(oct(0, 8), 108, 8);
    put(oct(0, 8), 116, 8);
    put(oct(size, 12), 124, 12);
    put(oct(Math.floor(Date.now() / 1000), 12), 136, 12);
    put('        ', 148, 8);                       // チェックサム計算中は空白8文字
    h[156] = isDir ? 0x35 : 0x30;                  // '5' = ディレクトリ, '0' = ファイル
    put('ustar\0', 257, 6);
    put('00', 263, 2);
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += h[i];
    put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
    return h;
}

// entries: [{ name, bytes? , text? , dir? }]
function makeTar(entries) {
    const parts = [];
    for (const e of entries) {
        if (e.dir) { parts.push(tarHeader(e.name, 0, true)); continue; }
        const data = e.bytes || enc.encode(e.text);
        parts.push(tarHeader(e.name, data.length, false), data);
        const pad = (512 - (data.length % 512)) % 512;
        if (pad) parts.push(new Uint8Array(pad));
    }
    parts.push(new Uint8Array(1024));              // 終端
    let total = 0;
    for (const p of parts) total += p.length;
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
}

// 圧縮なしの gzip（CompressionStream が無い古いブラウザ用）
function gzipStored(bytes) {
    const blocks = [];
    for (let i = 0; i < bytes.length || i === 0; i += 65535) {
        const chunk = bytes.subarray(i, Math.min(i + 65535, bytes.length));
        const last = i + 65535 >= bytes.length;
        blocks.push(new Uint8Array([last ? 1 : 0, chunk.length & 255, chunk.length >>> 8, ~chunk.length & 255, (~chunk.length >>> 8) & 255]), chunk);
    }
    const crc = crc32(bytes), n = bytes.length;
    const head = new Uint8Array([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 0xff]);
    const tail = new Uint8Array([crc & 255, (crc >>> 8) & 255, (crc >>> 16) & 255, crc >>> 24, n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24]);
    const all = [head, ...blocks, tail];
    let total = 0;
    for (const a of all) total += a.length;
    const out = new Uint8Array(total);
    let o = 0;
    for (const a of all) { out.set(a, o); o += a.length; }
    return out;
}

async function gzip(bytes) {
    if (typeof CompressionStream === 'function') {
        const cs = new CompressionStream('gzip');
        const w = cs.writable.getWriter();
        w.write(bytes);
        w.close();
        return new Uint8Array(await new Response(cs.readable).arrayBuffer());
    }
    return gzipStored(bytes);
}

// assets: [{ guid, pathname, text, meta }] → Uint8Array (.unitypackage)
export async function makeUnityPackage(assets) {
    const entries = [];
    for (const a of assets) {
        entries.push({ name: `${a.guid}/`, dir: true });
        entries.push({ name: `${a.guid}/asset`, text: a.text });
        entries.push({ name: `${a.guid}/asset.meta`, text: a.meta });
        entries.push({ name: `${a.guid}/pathname`, text: a.pathname });
    }
    return gzip(makeTar(entries));
}
