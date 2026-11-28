// シェイプキー(MorphTarget)付きのメッシュ
import { TURN_STAGE_COUNT } from '../config.js';
import { sampleOpenPageCurve, sampleTurnPageCurve, evalCurveAt } from './curves.js';

/**
 * Computes exact smooth vertex normals for a morph target position array.
 */
export function computeMorphNormals(baseGeo, targetPosArray) {
  const scratch = new THREE.BufferGeometry();
  scratch.setAttribute('position', new THREE.BufferAttribute(new Float32Array(targetPosArray), 3));
  if (baseGeo.index) scratch.setIndex(baseGeo.index);
  scratch.computeVertexNormals();
  const normArr = new Float32Array(scratch.attributes.normal.array);
  scratch.dispose();
  return normArr;
}

/**
 * Builds a left or right page block with 3 real Shape Keys (MorphTargets):
 *   Basis:        Closed_Thin
 *   morph[0]:     Closed_Thick
 *   morph[1]:     Open_Thin
 *   morph[2]:     Open_Thick
 */
export function buildPageBlockGeometryWithMorphs(dims, isLeft, segX) {
  const geo = new THREE.BoxGeometry(dims.pageW, 1, dims.pageH, segX, 4, 1);
  const baseSrc = Float32Array.from(geo.attributes.position.array);
  const count = geo.attributes.position.count;
  const dirSign = isLeft ? -1 : 1;

  const curveThin = sampleOpenPageCurve(segX, dims.minT, dims);
  const curveThick = sampleOpenPageCurve(segX, dims.maxT, dims);

  const makePositions = (isOpen, stackT, curvePts) => {
    const arr = new Float32Array(count * 3);
    const endX = curvePts ? curvePts[curvePts.length - 1].x : dims.pageW;
    for (let i = 0; i < count; i++) {
      const bx = baseSrc[i * 3];
      const by = baseSrc[i * 3 + 1];
      const bz = baseSrc[i * 3 + 2];
      const u = isLeft
        ? (dims.pageW * 0.5 - bx) / dims.pageW
        : (bx + dims.pageW * 0.5) / dims.pageW;
      const vFrac = Math.max(0, Math.min(1, by + 0.5));

      if (!isOpen) {
        arr[i * 3] = dirSign * u * dims.pageW;
        arr[i * 3 + 1] = vFrac * stackT;
        arr[i * 3 + 2] = bz;
      } else {
        const pt = evalCurveAt(curvePts, u);
        arr[i * 3] = dirSign * (u * endX * (1 - vFrac) + pt.x * vFrac);
        arr[i * 3 + 1] = vFrac * pt.y;
        arr[i * 3 + 2] = bz;
      }
    }
    return arr;
  };

  const posBasis = makePositions(false, dims.minT, null);
  const posClosedThick = makePositions(false, dims.maxT, null);
  const posOpenThin = makePositions(true, dims.minT, curveThin);
  const posOpenThick = makePositions(true, dims.maxT, curveThick);

  geo.setAttribute('position', new THREE.BufferAttribute(posBasis, 3));
  geo.computeVertexNormals();

  const mClosedThick = new THREE.BufferAttribute(posClosedThick, 3);
  mClosedThick.name = 'Closed_Thick';
  const mOpenThin = new THREE.BufferAttribute(posOpenThin, 3);
  mOpenThin.name = 'Open_Thin';
  const mOpenThick = new THREE.BufferAttribute(posOpenThick, 3);
  mOpenThick.name = 'Open_Thick';

  geo.morphAttributes.position = [mClosedThick, mOpenThin, mOpenThick];
  geo.morphAttributes.normal = [
    new THREE.BufferAttribute(computeMorphNormals(geo, posClosedThick), 3),
    new THREE.BufferAttribute(computeMorphNormals(geo, posOpenThin), 3),
    new THREE.BufferAttribute(computeMorphNormals(geo, posOpenThick), 3)
  ];
  geo.morphTargetsRelative = false;
  return geo;
}

/**
 * Builds a left or right UI page surface with matching 3 Shape Keys (MorphTargets).
 */
export function buildPageSurfaceGeometryWithMorphs(dims, isLeft, segX) {
  const geo = new THREE.PlaneGeometry(dims.pageW, dims.pageH, segX, 1);
  geo.rotateX(-Math.PI / 2);
  const baseSrc = Float32Array.from(geo.attributes.position.array);
  const count = geo.attributes.position.count;
  const dirSign = isLeft ? -1 : 1;
  const lift = 0.004;

  const curveThin = sampleOpenPageCurve(segX, dims.minT, dims);
  const curveThick = sampleOpenPageCurve(segX, dims.maxT, dims);

  const makePositions = (isOpen, stackT, curvePts) => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const bx = baseSrc[i * 3];
      const bz = baseSrc[i * 3 + 2];
      const u = isLeft
        ? (dims.pageW * 0.5 - bx) / dims.pageW
        : (bx + dims.pageW * 0.5) / dims.pageW;

      if (!isOpen) {
        arr[i * 3] = dirSign * u * dims.pageW;
        arr[i * 3 + 1] = stackT + lift;
        arr[i * 3 + 2] = bz;
      } else {
        const pt = evalCurveAt(curvePts, u);
        arr[i * 3] = dirSign * pt.x;
        arr[i * 3 + 1] = pt.y + lift;
        arr[i * 3 + 2] = bz;
      }
    }
    return arr;
  };

  const posBasis = makePositions(false, dims.minT, null);
  const posClosedThick = makePositions(false, dims.maxT, null);
  const posOpenThin = makePositions(true, dims.minT, curveThin);
  const posOpenThick = makePositions(true, dims.maxT, curveThick);

  geo.setAttribute('position', new THREE.BufferAttribute(posBasis, 3));
  geo.computeVertexNormals();

  const mClosedThick = new THREE.BufferAttribute(posClosedThick, 3);
  mClosedThick.name = 'Closed_Thick';
  const mOpenThin = new THREE.BufferAttribute(posOpenThin, 3);
  mOpenThin.name = 'Open_Thin';
  const mOpenThick = new THREE.BufferAttribute(posOpenThick, 3);
  mOpenThick.name = 'Open_Thick';

  geo.morphAttributes.position = [mClosedThick, mOpenThin, mOpenThick];
  geo.morphAttributes.normal = [
    new THREE.BufferAttribute(computeMorphNormals(geo, posClosedThick), 3),
    new THREE.BufferAttribute(computeMorphNormals(geo, posOpenThin), 3),
    new THREE.BufferAttribute(computeMorphNormals(geo, posOpenThick), 3)
  ];
  geo.morphTargetsRelative = false;
  return geo;
}

/**
 * Builds the turning page front or back surface with 6 progressive Shape Keys:
 *   Basis:    Turn_00 (resting on right page)
 *   morph[0]: Turn_17
 *   morph[1]: Turn_33
 *   morph[2]: Turn_50 (upright curved mid-turn)
 *   morph[3]: Turn_67
 *   morph[4]: Turn_83
 *   morph[5]: Turn_100 (resting on left page)
 * Back face reverses winding and bakes u = 1 - u directly into UV for clean GLB/Unity export.
 */
export function buildTurningPageGeometryWithMorphs(dims, isBack, segX) {
  const geo = new THREE.PlaneGeometry(dims.pageW, dims.pageH, segX, 1);
  geo.rotateX(-Math.PI / 2);

  if (isBack) {
    // Flip U directly in geometry UV (no repeat.x = -1 shader/GLB issues)
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setX(i, 1 - uv.getX(i));
    }
    uv.needsUpdate = true;

    // Reverse triangle winding so Back face uses standard FrontSide culling & outward normals
    const idx = geo.index;
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      idx.setX(i + 1, c);
      idx.setX(i + 2, b);
    }
    idx.needsUpdate = true;
  }

  const baseSrc = Float32Array.from(geo.attributes.position.array);
  const count = geo.attributes.position.count;
  const normalOffset = isBack ? -0.0014 : 0.0014;

  const makeStagePositions = p => {
    const curvePts = sampleTurnPageCurve(segX, p, dims);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const bx = baseSrc[i * 3];
      const bz = baseSrc[i * 3 + 2];
      const u = (bx + dims.pageW * 0.5) / dims.pageW;
      const pt = evalCurveAt(curvePts, u);
      const nx = -Math.sin(pt.theta);
      const ny = Math.cos(pt.theta);
      arr[i * 3] = pt.x + nx * normalOffset;
      arr[i * 3 + 1] = pt.y + ny * normalOffset;
      arr[i * 3 + 2] = bz;
    }
    return arr;
  };

  const posBasis = makeStagePositions(0);
  geo.setAttribute('position', new THREE.BufferAttribute(posBasis, 3));
  geo.computeVertexNormals();

  const stageNames = ['Turn_17', 'Turn_33', 'Turn_50', 'Turn_67', 'Turn_83', 'Turn_100'];
  const morphPos = [];
  const morphNorm = [];

  for (let s = 1; s <= TURN_STAGE_COUNT; s++) {
    const p = s / TURN_STAGE_COUNT;
    const targetPos = makeStagePositions(p);
    const posAttr = new THREE.BufferAttribute(targetPos, 3);
    posAttr.name = stageNames[s - 1];
    morphPos.push(posAttr);
    morphNorm.push(new THREE.BufferAttribute(computeMorphNormals(geo, targetPos), 3));
  }

  geo.morphAttributes.position = morphPos;
  geo.morphAttributes.normal = morphNorm;
  geo.morphTargetsRelative = false;
  return geo;
}
