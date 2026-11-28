// 無圧縮ZIPの作成（区画ごとのPLYをまとめて1回でダウンロードする）
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// [値, バイト数] の並びをリトルエンディアンで書く
function record(fields) {
  const out = new Uint8Array(fields.reduce((sum, [, size]) => sum + size, 0));
  let offset = 0;
  for (const [value, size] of fields) {
    for (let i = 0; i < size; i++) out[offset++] = (value >>> (8 * i)) & 0xff;
  }
  return out;
}

// files: [{ name, text }]（name は ASCII）
export function createZip(files) {
  const encoder = new TextEncoder();
  const DOS_DATE = 0x21; // 1980-01-01
  const body = [];
  const directory = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    // バージョン, フラグ, 圧縮方式, 時刻, 日付, CRC, 圧縮後, 圧縮前, 名前長, 拡張長
    const common = [[20, 2], [0, 2], [0, 2], [0, 2], [DOS_DATE, 2], [crc32(data), 4],
      [data.length, 4], [data.length, 4], [name.length, 2], [0, 2]];
    const local = record([[0x04034b50, 4], ...common]);
    body.push(local, name, data);
    directory.push(record([[0x02014b50, 4], [20, 2], ...common, [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]]), name);
    offset += local.length + name.length + data.length;
  }

  const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
  const end = record([[0x06054b50, 4], [0, 2], [0, 2], [files.length, 2], [files.length, 2],
    [directorySize, 4], [offset, 4], [0, 2]]);
  return new Blob([...body, ...directory, end], { type: 'application/zip' });
}
