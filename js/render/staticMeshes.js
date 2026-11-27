// 区画ごとの地形・壁・台座・スロープと、全体のマグマ
import { state, arena } from '../state.js';
import { buildTerrainGeometry } from '../geometry/terrain.js';
import { buildWallGeometry } from '../geometry/walls.js';
import { buildPedestalGeometry } from '../geometry/pedestals.js';
import { buildSlopeGeometry } from '../geometry/slopes.js';
import { buildMagmaGeometry } from '../geometry/magma.js';
import { view } from './context.js';

function addMesh(group, geometry, Material = THREE.MeshLambertMaterial) {
  if (geometry.index.count === 0) return null;
  const material = new Material({ vertexColors: true, wireframe: state.wireframe });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  return mesh;
}

// 区画ごとのポリゴン数などを返す
export function addStaticMeshes() {
  addMesh(view.stage, buildMagmaGeometry(), THREE.MeshBasicMaterial);

  return arena.chunks.map(chunk => {
    const group = view.chunkGroups[chunk.id];
    const terrain = buildTerrainGeometry(chunk.id);
    const wall = buildWallGeometry(chunk.id);
    const pedestal = buildPedestalGeometry(chunk.id);
    const slope = buildSlopeGeometry(chunk.id);
    const geometries = [terrain.geometry, wall, pedestal, slope];

    const terrainMesh = addMesh(group, terrain.geometry);
    addMesh(group, wall);
    const pedestalMesh = addMesh(group, pedestal);
    addMesh(group, slope);
    view.pickableMeshes.push(...[terrainMesh, pedestalMesh].filter(Boolean));

    return {
      terrainTriangles: terrain.optimizedTriangles,
      naiveTriangles: terrain.naiveTriangles,
      slopeTriangles: slope.index.count / 3,
      triangles: geometries.reduce((sum, g) => sum + g.index.count / 3, 0),
      vertices: geometries.reduce((sum, g) => sum + g.attributes.position.count, 0)
    };
  });
}
