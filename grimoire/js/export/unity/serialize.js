// 本をUnity用データに変換
import { TURN_STAGE_COUNT } from '../../config.js';
import { state } from '../../state.js';
import { getBookDims } from '../../book/dimensions.js';
import { updateBookPose } from '../../animation/pose.js';
import { rig } from '../../rig.js';

/**
 * Serializes the live Three.js BookRoot hierarchy, geometries, submeshes, materials,
 * and all MorphTargets (BlendShapes) into Unity Left-Handed coordinates (Z-flipped)
 * in a JsonUtility-compatible schema.
 */
export function serializeBookForUnity() {
  const dims = getBookDims();
  const round4 = n => Math.round(n * 10000) / 10000;

  // Snapshot current live pose, then temporarily reset rig pivots to neutral Unity rest pose
  const savedSpineRotZ = rig.spineRig.rotation.z;
  const savedSpinePosX = rig.spineRig.position.x;
  const savedSpinePosY = rig.spineRig.position.y;
  const savedSpineScaleX = rig.spineBoxMesh.scale.x;
  const savedSpineVis = rig.spineBoxMesh.visible;
  const savedLeftPosX = rig.leftCoverPivot.position.x;
  const savedLeftRotZ = rig.leftCoverPivot.rotation.z;
  const savedRightPosX = rig.rightCoverPivot.position.x;
  const savedRightRotZ = rig.rightCoverPivot.rotation.z;
  const savedTurnRotZ = rig.turningPageGroup.rotation.z;

  rig.spineRig.rotation.z = 0;
  rig.spineRig.position.set(0, 0, 0);
  rig.spineBoxMesh.scale.set(1, 1, 1);
  rig.spineBoxMesh.visible = true;
  rig.leftCoverPivot.position.set(0, 0, 0);
  rig.leftCoverPivot.rotation.z = 0;
  rig.rightCoverPivot.position.set(0, 0, 0);
  rig.rightCoverPivot.rotation.z = 0;
  rig.turningPageGroup.rotation.z = 0;

  const materials = [];
  const matMap = new Map();
  const meshes = [];
  const nodes = [];

  const registerMaterial = (mat, fallbackName) => {
    if (matMap.has(mat)) return matMap.get(mat);
    const idx = materials.length;
    matMap.set(mat, idx);

    let texFile = '';
    if (mat.map === rig.frontCoverTex) texFile = 'Cover_Front.png';
    else if (mat.map === rig.backCoverTex) texFile = 'Cover_Back.png';
    else if (mat.map === rig.spineCoverTex) texFile = 'Cover_Spine.png';
    else if (mat.map === rig.leftEdgeTex || mat.map === rig.rightEdgeTex) texFile = 'Page_Edge.png';
    else if (mat.map === rig.leftPageTex) texFile = 'Page_01.png';
    else if (mat.map === rig.rightPageTex) texFile = 'Page_02.png';

    const c = mat.color ? mat.color : new THREE.Color('#ffffff');
    materials.push({
      name: fallbackName || ('Mat_' + idx),
      r: round4(c.r),
      g: round4(c.g),
      b: round4(c.b),
      a: mat.transparent ? 1.0 : 1.0,
      transparent: Boolean(mat.transparent),
      textureFile: texFile,
      tilingY: texFile === 'Page_Edge.png' ? 1.6 : 1.0
    });
    return idx;
  };

  const extractMesh = (meshObj) => {
    const geo = meshObj.geometry;
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const uv = geo.attributes.uv;

    const vertices = new Array(pos.count * 3);
    const normals = new Array(pos.count * 3);
    const uvs = new Array(pos.count * 2);

    // Three.js Right-Handed -> Unity Left-Handed via Z-flip (x, y, -z)
    for (let i = 0; i < pos.count; i++) {
      vertices[i * 3] = round4(pos.getX(i));
      vertices[i * 3 + 1] = round4(pos.getY(i));
      vertices[i * 3 + 2] = round4(-pos.getZ(i));

      if (norm) {
        normals[i * 3] = round4(norm.getX(i));
        normals[i * 3 + 1] = round4(norm.getY(i));
        normals[i * 3 + 2] = round4(-norm.getZ(i));
      } else {
        normals[i * 3] = 0; normals[i * 3 + 1] = 1; normals[i * 3 + 2] = 0;
      }

      if (uv) {
        uvs[i * 2] = round4(uv.getX(i));
        uvs[i * 2 + 1] = round4(uv.getY(i));
      } else {
        uvs[i * 2] = 0; uvs[i * 2 + 1] = 0;
      }
    }

    // Reverse triangle winding (a, b, c) -> (a, c, b) to match Z-flip mirror
    const idxAttr = geo.index;
    const readTri = (start, count) => {
      const tris = [];
      for (let i = start; i < start + count; i += 3) {
        const a = idxAttr ? idxAttr.getX(i) : i;
        const b = idxAttr ? idxAttr.getX(i + 1) : i + 1;
        const c = idxAttr ? idxAttr.getX(i + 2) : i + 2;
        tris.push(a, c, b);
      }
      return tris;
    };

    const rawMats = Array.isArray(meshObj.material) ? meshObj.material : [meshObj.material];
    const matIndices = rawMats.map((m, mi) => registerMaterial(m, `${meshObj.name}_Mat${mi}`));
    const subMeshes = [];

    if (geo.groups && geo.groups.length > 0 && rawMats.length > 1) {
      for (const g of geo.groups) {
        subMeshes.push({
          materialIndex: matIndices[g.materialIndex] !== undefined ? matIndices[g.materialIndex] : matIndices[0],
          triangles: readTri(g.start, g.count)
        });
      }
    } else {
      const totalIdx = idxAttr ? idxAttr.count : pos.count;
      subMeshes.push({
        materialIndex: matIndices[0],
        triangles: readTri(0, totalIdx)
      });
    }

    // Extract all MorphTargets as Unity BlendShape delta frames (target - basis)
    const blendShapes = [];
    const morphPosList = geo.morphAttributes && geo.morphAttributes.position;
    const morphNormList = geo.morphAttributes && geo.morphAttributes.normal;
    if (morphPosList && morphPosList.length > 0) {
      for (let m = 0; m < morphPosList.length; m++) {
        const mp = morphPosList[m];
        const mn = morphNormList && morphNormList[m] ? morphNormList[m] : null;
        const dVerts = new Array(pos.count * 3);
        const dNorms = new Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
          dVerts[i * 3] = round4(mp.getX(i) - pos.getX(i));
          dVerts[i * 3 + 1] = round4(mp.getY(i) - pos.getY(i));
          dVerts[i * 3 + 2] = round4(-(mp.getZ(i) - pos.getZ(i)));
          if (mn && norm) {
            dNorms[i * 3] = round4(mn.getX(i) - norm.getX(i));
            dNorms[i * 3 + 1] = round4(mn.getY(i) - norm.getY(i));
            dNorms[i * 3 + 2] = round4(-(mn.getZ(i) - norm.getZ(i)));
          } else {
            dNorms[i * 3] = 0; dNorms[i * 3 + 1] = 0; dNorms[i * 3 + 2] = 0;
          }
        }
        blendShapes.push({
          name: mp.name || ('Shape_' + m),
          deltaVertices: dVerts,
          deltaNormals: dNorms
        });
      }
    }

    const meshIdx = meshes.length;
    meshes.push({
      name: meshObj.name || ('Mesh_' + meshIdx),
      vertices,
      normals,
      uvs,
      subMeshes,
      blendShapes
    });
    return meshIdx;
  };

  const visitNode = (obj, parentIdx) => {
    const myIdx = nodes.length;
    const q = obj.quaternion;
    const meshIdx = obj.isMesh ? extractMesh(obj) : -1;

    nodes.push({
      name: obj.name || ('Node_' + myIdx),
      parentIndex: parentIdx,
      pos: [round4(obj.position.x), round4(obj.position.y), round4(-obj.position.z)],
      rot: [round4(-q.x), round4(-q.y), round4(q.z), round4(q.w)],
      scale: [round4(obj.scale.x), round4(obj.scale.y), round4(obj.scale.z)],
      meshIndex: meshIdx,
      startHidden: obj.name === 'TurningPageGroup'
    });

    for (const child of obj.children) {
      visitNode(child, myIdx);
    }
  };

  visitNode(rig.bookRoot, -1);

  // Restore live Three.js pose
  rig.spineRig.rotation.z = savedSpineRotZ;
  rig.spineRig.position.set(savedSpinePosX, savedSpinePosY, 0);
  rig.spineBoxMesh.scale.x = savedSpineScaleX;
  rig.spineBoxMesh.visible = savedSpineVis;
  rig.leftCoverPivot.position.x = savedLeftPosX;
  rig.leftCoverPivot.rotation.z = savedLeftRotZ;
  rig.rightCoverPivot.position.x = savedRightPosX;
  rig.rightCoverPivot.rotation.z = savedRightRotZ;
  rig.turningPageGroup.rotation.z = savedTurnRotZ;
  updateBookPose();

  return {
    bookTitle: state.bookTitle,
    bookWidth: round4(dims.w),
    bookHeight: round4(dims.h),
    thickness: round4(dims.t),
    halfT: round4(dims.halfT),
    minT: round4(dims.minT),
    maxT: round4(dims.maxT),
    seamY: round4(dims.seamY),
    pageW: round4(dims.pageW),
    spreadCount: state.spreads.length,
    turnStageCount: TURN_STAGE_COUNT,
    pageTextureFiles: state.spreads.flatMap((_, idx) => [
      `Page_${String(idx * 2 + 1).padStart(2, '0')}.png`,
      `Page_${String(idx * 2 + 2).padStart(2, '0')}.png`
    ]),
    materials,
    meshes,
    nodes
  };
}
