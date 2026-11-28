// ステージの Prefab の文字列を作る
import { HEADER, MESH_FILE_ID, gameObject, transform, meshFilter, meshRenderer, meshCollider } from '../../../shared/unity-yaml.js';

export { createMeshAsset, MESH_FILE_ID } from '../../../shared/unity-yaml.js';

// objects: [{ name, meshGuid, colliderGuid? }] と、開始位置 spawn を子に持つ Prefab
export function createPrefab(rootName, objects, materialGuid, spawn) {
  const ROOT = 1000;
  const ROOT_TRANSFORM = 1001;
  // 区画数が変わってもシーンからの参照が切れないよう、固定の fileID にする
  const SPAWN = 1010;
  const SPAWN_TRANSFORM = 1011;
  const baseId = i => 1100 + i * 10;
  const meshRef = guid => `{fileID: ${MESH_FILE_ID}, guid: ${guid}, type: 2}`;

  const docs = [
    gameObject(ROOT, rootName, [ROOT_TRANSFORM]),
    transform(ROOT_TRANSFORM, ROOT, 0, [SPAWN_TRANSFORM, ...objects.map((_, i) => baseId(i) + 1)]),
    gameObject(SPAWN, 'PlayerSpawn', [SPAWN_TRANSFORM]),
    transform(SPAWN_TRANSFORM, SPAWN, ROOT_TRANSFORM, [], spawn, true)
  ];

  objects.forEach(({ name, meshGuid, colliderGuid }, i) => {
    const [owner, tr, filter, renderer, collider] = [0, 1, 2, 3, 4].map(k => baseId(i) + k);
    const components = [tr, filter, renderer];
    if (colliderGuid) components.push(collider);

    docs.push(
      gameObject(owner, name, components),
      transform(tr, owner, ROOT_TRANSFORM, []),
      meshFilter(filter, owner, meshRef(meshGuid)),
      meshRenderer(renderer, owner, materialGuid)
    );
    if (colliderGuid) docs.push(meshCollider(collider, owner, meshRef(colliderGuid)));
  });

  return `${HEADER}${docs.join('\n')}\n`;
}
