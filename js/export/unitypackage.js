// .unitypackage (= tar.gz) の作成。
// 構造は Unity が書き出すものと同じ: <guid>/asset, <guid>/asset.meta, <guid>/pathname
const BLOCK = 512;

function tarHeader(name, size, isDir) {
  const header = new Uint8Array(BLOCK);
  const encoder = new TextEncoder();
  const put = (text, offset, length) => header.set(encoder.encode(text).subarray(0, length), offset);
  const octal = (value, length) => value.toString(8).padStart(length - 1, '0') + '\0';

  put(name, 0, 100);
  put(octal(isDir ? 0o755 : 0o644, 8), 100, 8);
  put(octal(0, 8), 108, 8);
  put(octal(0, 8), 116, 8);
  put(octal(size, 12), 124, 12);
  put(octal(Math.floor(Date.now() / 1000), 12), 136, 12);
  put('        ', 148, 8); // チェックサム計算中は空白8文字
  header[156] = isDir ? 0x35 : 0x30; // '5' = ディレクトリ, '0' = ファイル
  put('ustar\0', 257, 6);
  put('00', 263, 2);

  const sum = header.reduce((total, byte) => total + byte, 0);
  put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return header;
}

// assets: [{ guid, pathname, text, meta }] → gzip圧縮した Blob
export function createUnityPackage(assets) {
  const encoder = new TextEncoder();
  const parts = [];

  for (const asset of assets) {
    parts.push(tarHeader(`${asset.guid}/`, 0, true));
    for (const [file, text] of [['asset', asset.text], ['asset.meta', asset.meta], ['pathname', asset.pathname]]) {
      const data = encoder.encode(text);
      parts.push(tarHeader(`${asset.guid}/${file}`, data.length, false), data);
      parts.push(new Uint8Array((BLOCK - (data.length % BLOCK)) % BLOCK));
    }
  }
  parts.push(new Uint8Array(BLOCK * 2)); // 終端

  const stream = new Blob(parts).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}
