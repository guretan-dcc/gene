// 本全体の組み立て
import { state, flipAnim } from '../state.js';
import { getBookDims } from './dimensions.js';
import { buildPageBlockGeometryWithMorphs, buildPageSurfaceGeometryWithMorphs, buildTurningPageGeometryWithMorphs } from './geometry.js';
import { makeToonMat } from './materials.js';
import { disposeObject3D, addCartoonCorners, addSimpleMetalEmblem } from './details.js';
import { shadeHex } from '../textures/canvas-utils.js';
import { createPageEdgeTexture, createFrontCoverTexture, createBackCoverTexture, createSpineCoverTexture } from '../textures/covers.js';
import { refreshPageTextures, updateBookPose } from '../animation/pose.js';
import { rig } from '../rig.js';

export function buildBook() {
  flipAnim.active = false;
  flipAnim.progress = 0;
  flipAnim.manualScrub = false;
  flipAnim.scrubProgress = 0;
  const scrubEl = document.getElementById('ctrl-flip-scrub');
  const scrubVal = document.getElementById('val-flip-scrub');
  if (scrubEl) scrubEl.value = '0';
  if (scrubVal) scrubVal.textContent = 'OFF';
  state.spreadVisual = state.currentSpread;

  if (rig.turningFrontMat && rig.turningFrontMat.map && rig.turningFrontMat.map !== rig.leftPageTex && rig.turningFrontMat.map !== rig.rightPageTex) {
    rig.turningFrontMat.map.dispose();
    rig.turningFrontMat.map = null;
  }
  if (rig.turningBackMat && rig.turningBackMat.map && rig.turningBackMat.map !== rig.leftPageTex && rig.turningBackMat.map !== rig.rightPageTex) {
    rig.turningBackMat.map.dispose();
    rig.turningBackMat.map = null;
  }
  if (rig.bookRoot) {
    rig.scene.remove(rig.bookRoot);
    disposeObject3D(rig.bookRoot);
  }
  if (rig.frontCoverTex) { rig.frontCoverTex.dispose(); rig.frontCoverTex = null; }
  if (rig.backCoverTex) { rig.backCoverTex.dispose(); rig.backCoverTex = null; }
  if (rig.spineCoverTex) { rig.spineCoverTex.dispose(); rig.spineCoverTex = null; }
  if (rig.leftEdgeTex) { rig.leftEdgeTex.dispose(); rig.leftEdgeTex = null; }
  if (rig.rightEdgeTex) { rig.rightEdgeTex.dispose(); rig.rightEdgeTex = null; }

  rig.tabMeshes = [];

  const dims = getBookDims();
  const segX = 10;

  rig.bookRoot = new THREE.Group();
  rig.bookRoot.name = 'BookRoot';
  rig.scene.add(rig.bookRoot);

  rig.spineRig = new THREE.Group();
  rig.spineRig.name = 'SpineRig';
  rig.bookRoot.add(rig.spineRig);

  // Shared low-poly toon materials (front cover, back cover, spine match 100%)
  const coverMat = makeToonMat(state.coverColor);
  const metalMat = makeToonMat(state.metalColor);

  rig.leftEdgeTex = createPageEdgeTexture();
  rig.rightEdgeTex = createPageEdgeTexture();

  // Multi-material for page blocks: stripes ONLY on side edges, clean solid paper on top/bottom
  const makeBlockMaterials = edgeTex => {
    const sideMat = new THREE.MeshToonMaterial({
      color: new THREE.Color('#e3ded4'),
      map: edgeTex,
      gradientMap: rig.toonGradientTex,
      flatShading: state.flatShading,
      morphTargets: true,
      morphNormals: true
    });
    const capMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(shadeHex(state.paperColor, -10)),
      gradientMap: rig.toonGradientTex,
      flatShading: state.flatShading,
      morphTargets: true,
      morphNormals: true
    });
    // BoxGeometry group order: +X, -X, +Y (top), -Y (bottom), +Z, -Z
    return [sideMat, sideMat, capMat, capMat, sideMat, sideMat];
  };

  const leftBlockMats = makeBlockMaterials(rig.leftEdgeTex);
  const rightBlockMats = makeBlockMaterials(rig.rightEdgeTex);

  rig.frontCoverTex = createFrontCoverTexture();
  const frontPlateMat = new THREE.MeshToonMaterial({
    map: rig.frontCoverTex,
    gradientMap: rig.toonGradientTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  rig.backCoverTex = createBackCoverTexture();
  const backPlateMat = new THREE.MeshToonMaterial({
    map: rig.backCoverTex,
    gradientMap: rig.toonGradientTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  rig.spineCoverTex = createSpineCoverTexture();
  const spinePlateMat = new THREE.MeshToonMaterial({
    map: rig.spineCoverTex,
    gradientMap: rig.toonGradientTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  // -----------------------------------------------------------------------
  // A. FLAT SPINE (WITH FLUSH FOIL BANDS, NO PROTRUSION)
  // -----------------------------------------------------------------------
  rig.spineBoxMesh = new THREE.Mesh(
    new THREE.BoxGeometry(dims.spineFullW, dims.coverThick, dims.h),
    coverMat
  );
  rig.spineBoxMesh.name = 'SpineMesh';
  rig.spineBoxMesh.position.set(0, -dims.coverThick * 0.5, 0);
  rig.spineRig.add(rig.spineBoxMesh);

  const spinePlateGeo = new THREE.PlaneGeometry(dims.spineFullW, dims.h);
  spinePlateGeo.rotateX(Math.PI / 2);
  const spinePlateMesh = new THREE.Mesh(spinePlateGeo, spinePlateMat);
  spinePlateMesh.name = 'SpineFoilOverlay';
  spinePlateMesh.position.set(0, -dims.coverThick * 0.5 - 0.002, 0);
  rig.spineBoxMesh.add(spinePlateMesh);

  // -----------------------------------------------------------------------
  // B. LEFT COVER PIVOT (Front Cover when closed + Shape-Key Left Page Stack)
  // -----------------------------------------------------------------------
  rig.leftCoverPivot = new THREE.Group();
  rig.leftCoverPivot.name = 'LeftCoverPivot';
  rig.spineRig.add(rig.leftCoverPivot);

  const leftCoverMesh = new THREE.Mesh(
    new THREE.BoxGeometry(dims.w, dims.coverThick, dims.h),
    coverMat
  );
  leftCoverMesh.name = 'FrontCoverMesh';
  leftCoverMesh.position.set(-dims.w * 0.5, -dims.coverThick * 0.5, 0);
  rig.leftCoverPivot.add(leftCoverMesh);

  const frontExteriorGroup = new THREE.Group();
  frontExteriorGroup.name = 'FrontCoverDetails';
  frontExteriorGroup.position.set(-dims.w * 0.5, -dims.coverThick, 0);
  frontExteriorGroup.rotation.z = Math.PI;
  rig.leftCoverPivot.add(frontExteriorGroup);

  const frontPlateGeo = new THREE.PlaneGeometry(dims.w, dims.h);
  frontPlateGeo.rotateX(-Math.PI / 2);
  const frontPlateMesh = new THREE.Mesh(frontPlateGeo, frontPlateMat);
  frontPlateMesh.name = 'FrontCoverFoilOverlay';
  frontPlateMesh.position.set(0, 0.002, 0);
  frontExteriorGroup.add(frontPlateMesh);

  if (state.corners !== 'none') {
    addCartoonCorners(frontExteriorGroup, dims.w, dims.h, metalMat, state.corners);
  }
  if (state.emblem !== 'none') {
    addSimpleMetalEmblem(frontExteriorGroup, metalMat, coverMat, state.emblem, dims.h);
  }

  // Left page block (MorphTarget driven: Closed_Thick, Open_Thin, Open_Thick)
  const leftBlockGeo = buildPageBlockGeometryWithMorphs(dims, true, segX);
  rig.leftBlockMesh = new THREE.Mesh(leftBlockGeo, leftBlockMats);
  rig.leftBlockMesh.name = 'LeftPageStack';
  rig.leftCoverPivot.add(rig.leftBlockMesh);

  // Left UI page surface (MorphTarget driven: Closed_Thick, Open_Thin, Open_Thick)
  const leftPageGeo = buildPageSurfaceGeometryWithMorphs(dims, true, segX);
  const leftPageMat = new THREE.MeshToonMaterial({
    color: new THREE.Color('#e8e3da'),
    gradientMap: rig.toonGradientTex,
    morphTargets: true,
    morphNormals: true
  });
  rig.leftPageMesh = new THREE.Mesh(leftPageGeo, leftPageMat);
  rig.leftPageMesh.name = 'LeftPageUI';
  rig.leftCoverPivot.add(rig.leftPageMesh);

  // -----------------------------------------------------------------------
  // C. RIGHT COVER PIVOT (Back Cover when closed + Shape-Key Right Page Stack)
  // -----------------------------------------------------------------------
  rig.rightCoverPivot = new THREE.Group();
  rig.rightCoverPivot.name = 'RightCoverPivot';
  rig.spineRig.add(rig.rightCoverPivot);

  const rightCoverMesh = new THREE.Mesh(
    new THREE.BoxGeometry(dims.w, dims.coverThick, dims.h),
    coverMat
  );
  rightCoverMesh.name = 'BackCoverMesh';
  rightCoverMesh.position.set(dims.w * 0.5, -dims.coverThick * 0.5, 0);
  rig.rightCoverPivot.add(rightCoverMesh);

  const backExteriorGroup = new THREE.Group();
  backExteriorGroup.name = 'BackCoverDetails';
  backExteriorGroup.position.set(dims.w * 0.5, -dims.coverThick, 0);
  backExteriorGroup.rotation.z = Math.PI;
  rig.rightCoverPivot.add(backExteriorGroup);

  const backPlateGeo = new THREE.PlaneGeometry(dims.w, dims.h);
  backPlateGeo.rotateX(-Math.PI / 2);
  const backPlateMesh = new THREE.Mesh(backPlateGeo, backPlateMat);
  backPlateMesh.name = 'BackCoverFoilOverlay';
  backPlateMesh.position.set(0, 0.002, 0);
  backExteriorGroup.add(backPlateMesh);

  if (state.corners !== 'none') {
    addCartoonCorners(backExteriorGroup, dims.w, dims.h, metalMat, state.corners);
  }

  // Right page block (MorphTarget driven: Closed_Thick, Open_Thin, Open_Thick)
  const rightBlockGeo = buildPageBlockGeometryWithMorphs(dims, false, segX);
  rig.rightBlockMesh = new THREE.Mesh(rightBlockGeo, rightBlockMats);
  rig.rightBlockMesh.name = 'RightPageStack';
  rig.rightCoverPivot.add(rig.rightBlockMesh);

  // Right UI page surface (MorphTarget driven: Closed_Thick, Open_Thin, Open_Thick)
  const rightPageGeo = buildPageSurfaceGeometryWithMorphs(dims, false, segX);
  const rightPageMat = new THREE.MeshToonMaterial({
    color: new THREE.Color('#e8e3da'),
    gradientMap: rig.toonGradientTex,
    morphTargets: true,
    morphNormals: true
  });
  rig.rightPageMesh = new THREE.Mesh(rightPageGeo, rightPageMat);
  rig.rightPageMesh.name = 'RightPageUI';
  rig.rightCoverPivot.add(rig.rightPageMesh);

  // -----------------------------------------------------------------------
  // D. INDEX TABS (Heights adapt automatically to right-stack thickness)
  // -----------------------------------------------------------------------
  if (state.tabs) {
    const tabColors = ['#c9974c', '#b85a52', '#52879e', '#5a8f6f'];
    const tabZOffsets = [-0.34, -0.13, 0.13, 0.34];
    tabColors.forEach((col, i) => {
      const tab = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, 0.020, 0.24),
        makeToonMat(col)
      );
      tab.name = `IndexTab_${i + 1}`;
      tab.position.set(
        dims.pageW + 0.045,
        0.05,
        dims.pageH * tabZOffsets[i]
      );
      rig.rightCoverPivot.add(tab);
      rig.tabMeshes.push(tab);
    });
  }

  // -----------------------------------------------------------------------
  // E. SHAPE-KEY TURNING PAGE SHEET (6 Progressive MorphTargets: Turn_17..100)
  // -----------------------------------------------------------------------
  rig.turningPageGroup = new THREE.Group();
  rig.turningPageGroup.name = 'TurningPageGroup';
  rig.turningPageGroup.position.set(0, dims.seamY + 0.009, 0);
  rig.turningPageGroup.visible = false;
  rig.spineRig.add(rig.turningPageGroup);

  const turningFrontGeo = buildTurningPageGeometryWithMorphs(dims, false, 14);
  const turningBackGeo = buildTurningPageGeometryWithMorphs(dims, true, 14);

  rig.turningFrontMat = new THREE.MeshToonMaterial({
    color: new THREE.Color('#e8e3da'),
    gradientMap: rig.toonGradientTex,
    side: THREE.FrontSide,
    morphTargets: true,
    morphNormals: true
  });
  rig.turningBackMat = new THREE.MeshToonMaterial({
    color: new THREE.Color('#e8e3da'),
    gradientMap: rig.toonGradientTex,
    side: THREE.FrontSide,
    morphTargets: true,
    morphNormals: true
  });

  rig.turningFrontMesh = new THREE.Mesh(turningFrontGeo, rig.turningFrontMat);
  rig.turningFrontMesh.name = 'TurningPageFront';
  rig.turningBackMesh = new THREE.Mesh(turningBackGeo, rig.turningBackMat);
  rig.turningBackMesh.name = 'TurningPageBack';
  rig.turningPageGroup.add(rig.turningFrontMesh);
  rig.turningPageGroup.add(rig.turningBackMesh);

  refreshPageTextures();
  updateBookPose();
}
