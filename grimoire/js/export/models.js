// OBJ / GLB 書き出し
import { state } from '../state.js';
import { createPageTexture } from '../textures/pages.js';
import { applyTurningShapeKeys } from '../animation/pose.js';
import { showToast } from '../ui/toast.js';
import { downloadDataUrl, downloadText } from './download.js';
import { rig } from '../rig.js';

export function exportOBJ() {
  rig.bookRoot.updateMatrixWorld(true);
  let output = '# Grimoire Forge Low-Poly Book (.OBJ)\n';
  let vertexOffset = 1;
  let uvOffset = 1;
  let meshIndex = 0;

  const v = new THREE.Vector3();
  const mv = new THREE.Vector3();

  rig.bookRoot.traverse(child => {
    if (!child.isMesh || !child.visible) return;
    let p = child.parent;
    while (p) {
      if (!p.visible) return;
      p = p.parent;
    }

    const geo = child.geometry;
    if (!geo || !geo.attributes || !geo.attributes.position) return;

    output += `o ${child.name || 'mesh_' + meshIndex++}\n`;
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const morphPos = geo.morphAttributes && geo.morphAttributes.position;
    const influences = child.morphTargetInfluences;

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (morphPos && influences) {
        const bx = v.x, by = v.y, bz = v.z;
        for (let m = 0; m < morphPos.length; m++) {
          const w = influences[m];
          if (w && Math.abs(w) > 1e-5) {
            mv.fromBufferAttribute(morphPos[m], i);
            v.x += (mv.x - bx) * w;
            v.y += (mv.y - by) * w;
            v.z += (mv.z - bz) * w;
          }
        }
      }
      v.applyMatrix4(child.matrixWorld);
      output += `v ${v.x.toFixed(5)} ${v.y.toFixed(5)} ${v.z.toFixed(5)}\n`;
    }

    const hasUV = Boolean(uv);
    if (hasUV) {
      for (let i = 0; i < uv.count; i++) {
        output += `vt ${uv.getX(i).toFixed(5)} ${uv.getY(i).toFixed(5)}\n`;
      }
    }

    const index = geo.index;
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i);
        const b = index.getX(i + 1);
        const c = index.getX(i + 2);
        if (hasUV) {
          output += `f ${a + vertexOffset}/${a + uvOffset} ${b + vertexOffset}/${b + uvOffset} ${c + vertexOffset}/${c + uvOffset}\n`;
        } else {
          output += `f ${a + vertexOffset} ${b + vertexOffset} ${c + vertexOffset}\n`;
        }
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        if (hasUV) {
          output += `f ${i + vertexOffset}/${i + uvOffset} ${i + 1 + vertexOffset}/${i + 1 + uvOffset} ${i + 2 + vertexOffset}/${i + 2 + uvOffset}\n`;
        } else {
          output += `f ${i + vertexOffset} ${i + 1 + vertexOffset} ${i + 2 + vertexOffset}\n`;
        }
      }
    }

    vertexOffset += pos.count;
    if (hasUV) uvOffset += uv.count;
  });

  downloadText(output, 'grimoire-lowpoly.obj', 'text/plain');
  showToast('静止3Dモデル (.OBJ) を書き出しました');
}

export function exportGLB() {
  if (typeof THREE.GLTFExporter === 'undefined') {
    showToast('GLBエクスポーターを読み込めませんでした');
    return;
  }

  // Ensure TurningPage has textures & neutral weights so Blender/Unity imports all Shape Keys intact
  const prevTurnVisible = rig.turningPageGroup.visible;
  if (!prevTurnVisible) {
    const cur = state.spreads[state.currentSpread];
    const nextIdx = Math.min(state.spreads.length - 1, state.currentSpread + 1);
    const nxt = state.spreads[nextIdx];
    if (!rig.turningFrontMat.map) {
      rig.turningFrontMat.map = createPageTexture(cur.right, false, state.currentSpread * 2 + 2);
      rig.turningFrontMat.needsUpdate = true;
    }
    if (!rig.turningBackMat.map) {
      rig.turningBackMat.map = createPageTexture(nxt.left, true, nextIdx * 2 + 1);
      rig.turningBackMat.needsUpdate = true;
    }
    rig.turningPageGroup.visible = true;
    applyTurningShapeKeys(0);
  }

  // 表示していない側の見出しタブは含めない
  const hiddenTabs = rig.tabMeshes.flatMap(pair => [pair.left, pair.right])
    .filter(tab => !tab.visible)
    .map(tab => ({ tab, parent: tab.parent }));
  hiddenTabs.forEach(({ tab, parent }) => parent.remove(tab));

  const exporter = new THREE.GLTFExporter();
  exporter.parse(
    rig.bookRoot,
    result => {
      rig.turningPageGroup.visible = prevTurnVisible;
      hiddenTabs.forEach(({ tab, parent }) => parent.add(tab));
      if (result instanceof ArrayBuffer) {
        const blob = new Blob([result], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        downloadDataUrl(url, 'grimoire-shapekeys.glb');
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        showToast('シェイプキー付き .GLB を書き出しました');
      } else {
        downloadText(JSON.stringify(result, null, 2), 'grimoire-shapekeys.gltf', 'application/json');
        showToast('.GLTF を書き出しました');
      }
    },
    { binary: true, onlyVisible: false }
  );
}
