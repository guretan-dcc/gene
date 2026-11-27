// 地形・外周壁・台座・スロープ・マグマのメッシュ
import { state } from '../state.js';
import { buildTerrainGeometry } from '../geometry/terrain.js';
import { buildOuterWallGeometry } from '../geometry/outerWall.js';
import { buildPedestalGeometry } from '../geometry/pedestals.js';
import { buildSlopeGeometry } from '../geometry/slopes.js';
import { buildMagmaGeometry } from '../geometry/magma.js';
import { view } from './context.js';

function addMesh(group, geometry, Material = THREE.MeshLambertMaterial) {
  const material = new Material({ vertexColors: true, wireframe: state.wireframe });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  return mesh;
}

export function addStaticMeshes() {
  const { groups } = view;
  const terrain = buildTerrainGeometry();
  const outerWall = buildOuterWallGeometry(state.previewCutFrontWall);
  const pedestal = buildPedestalGeometry();
  const slope = buildSlopeGeometry();

  const terrainMesh = addMesh(groups.terrain, terrain.geometry);
  addMesh(groups.outerWall, outerWall);
  const pedestalMesh = addMesh(groups.pedestal, pedestal);
  addMesh(groups.slope, slope);
  addMesh(groups.magma, buildMagmaGeometry(), THREE.MeshBasicMaterial);

  view.pickableMeshes.push(terrainMesh, pedestalMesh);

  return { terrain, outerWall, pedestal, slope };
}
