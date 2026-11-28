// PLY書き出し（区画ごとに分割したZIP、または1ファイル）
import { arena } from '../state.js';
import { isChecked, collectChunkGeometries, collectMagma } from './chunkGeometry.js';
import { showToast } from '../ui/toast.js';
import { downloadFile } from './download.js';
import { getExportFilename, getChunkMeshName } from './filename.js';
import { createZip } from './zip.js';

function exportSplit() {
  const files = arena.chunks.map(chunk => ({
    name: getChunkMeshName(chunk),
    text: toPLY(collectChunkGeometries(chunk.id)).text
  }));
  const magma = collectMagma();
  if (magma.length > 0) files.push({ name: 'magma.ply', text: toPLY(magma).text });

  downloadFile(getExportFilename('zip'), createZip(files));
  showToast(`PLY書き出し完了（${files.length}ファイルのZIP）`);
}

function exportMerged() {
  const geos = [...arena.chunks.flatMap(c => collectChunkGeometries(c.id)), ...collectMagma()];
  const { text, faceCount } = toPLY(geos);
  downloadFile(getExportFilename('ply'), text);
  showToast(`PLY書き出し完了（1ファイル / ${faceCount.toLocaleString()} tris）`);
}

// 複数ジオメトリを1つの ASCII PLY 文字列にまとめる（渡したジオメトリは破棄する）
function toPLY(geos) {
  const verts = [];
  const faces = [];
  let offset = 0;

  for (const g of geos) {
    const pos = g.attributes.position;
    const col = g.attributes.color;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i).toFixed(4);
      const y = pos.getY(i).toFixed(4);
      const z = pos.getZ(i).toFixed(4);
      const r = col ? Math.round(col.getX(i) * 255) : 180;
      const gC = col ? Math.round(col.getY(i) * 255) : 180;
      const b = col ? Math.round(col.getZ(i) * 255) : 180;
      verts.push(`${x} ${y} ${z} ${r} ${gC} ${b}`);
    }

    const idx = g.index;
    for (let i = 0; i < idx.count; i += 3) {
      faces.push(`3 ${idx.getX(i) + offset} ${idx.getX(i + 1) + offset} ${idx.getX(i + 2) + offset}`);
    }
    offset += pos.count;
    g.dispose();
  }

  const header = [
    'ply',
    'format ascii 1.0',
    `element vertex ${verts.length}`,
    'property float x',
    'property float y',
    'property float z',
    'property uchar red',
    'property uchar green',
    'property uchar blue',
    `element face ${faces.length}`,
    'property list uchar int vertex_indices',
    'end_header'
  ].join('\n');

  return {
    text: `${header}\n${verts.join('\n')}\n${faces.join('\n')}\n`,
    faceCount: faces.length
  };
}

export function exportPLY() {
  try {
    if (isChecked('splitPLY')) exportSplit();
    else exportMerged();
  } catch (err) {
    console.error(err);
    showToast('PLY書き出し中にエラーが発生しました');
  }
}
