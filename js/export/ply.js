// PLY書き出し（常に全周フル高さの壁で出力）
import { state } from '../state.js';
import { buildTerrainGeometry } from '../geometry/terrain.js';
import { buildOuterWallGeometry } from '../geometry/outerWall.js';
import { buildPedestalGeometry } from '../geometry/pedestals.js';
import { buildSlopeGeometry } from '../geometry/slopes.js';
import { buildMagmaGeometry } from '../geometry/magma.js';
import { showToast } from '../ui/toast.js';
import { downloadFile } from './download.js';
import { getExportFilename } from './filename.js';

function isChecked(id) {
  return document.getElementById(id).checked;
}

function collectGeometries() {
  // 足場本体（マグマ底まで一体の巨大ソリッドCube）
  const geos = [buildTerrainGeometry().geometry];

  // 外周巨大壁（PLY書き出し時は手前壁も含めた全周フル高さ）
  if (state.outerWallEnabled) geos.push(buildOuterWallGeometry(false));
  if (isChecked('includePedestalsInPLY')) geos.push(buildPedestalGeometry());
  if (isChecked('includeSlopesInPLY')) geos.push(buildSlopeGeometry());
  if (isChecked('includeMagmaInPLY')) geos.push(buildMagmaGeometry());
  return geos;
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
    const { text, faceCount } = toPLY(collectGeometries());
    downloadFile(getExportFilename('ply'), text);
    showToast(`PLY書き出し完了（全周高壁 / ${faceCount.toLocaleString()} tris）`);
  } catch (err) {
    console.error(err);
    showToast('PLY書き出し中にエラーが発生しました');
  }
}
