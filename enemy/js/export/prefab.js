// 敵の Prefab。部品を関節の親子関係のまま子オブジェクトにする(動かすので Static にしない)
import {
  HEADER, COMMON, MESH_FILE_ID, gameObject, transform, meshFilter, meshRenderer
} from '../../../shared/unity-yaml.js';

const ROOT = 1000;
const ROOT_TRANSFORM = 1001;
const CAPSULE = 1002;
// 部品が増減してもシーンやアニメーションからの参照が切れないよう、部品名ごとに固定の fileID にする
export const PART_ORDER = [
  'Hips', 'Torso', 'Head', 'UpperArmL', 'ForeArmL', 'UpperArmR', 'ForeArmR',
  'ThighL', 'ShinL', 'ThighR', 'ShinR', 'Weapon', 'Shield'
];

const vector = v => `{x: ${v[0].toFixed(4)}, y: ${v[1].toFixed(4)}, z: ${v[2].toFixed(4)}}`;
const point = v => ({ x: Number(v[0].toFixed(4)), y: Number(v[1].toFixed(4)), z: Number(v[2].toFixed(4)) });

const capsuleCollider = (id, owner, { radius, height }) => `--- !u!136 &${id}
CapsuleCollider:
${COMMON}
  m_GameObject: {fileID: ${owner}}
  m_Material: {fileID: 0}
  m_IsTrigger: 0
  m_Enabled: 1
  m_Radius: ${radius.toFixed(4)}
  m_Height: ${height.toFixed(4)}
  m_Direction: 1
  m_Center: ${vector([0, height / 2, 0])}`;

const triggerBox = (id, owner, { center, size }) => `--- !u!65 &${id}
BoxCollider:
${COMMON}
  m_GameObject: {fileID: ${owner}}
  m_Material: {fileID: 0}
  m_IsTrigger: 1
  m_Enabled: 1
  serializedVersion: 2
  m_Size: ${vector(size)}
  m_Center: ${vector(center)}`;

// parts: [{ name, parent, position, meshGuid, trigger? }] / body: 本体の当たり判定
export function createEnemyPrefab(name, parts, materialGuid, body) {
  const baseId = partName => 1100 + PART_ORDER.indexOf(partName) * 10;
  const childIds = parent => parts.filter(p => p.parent === parent).map(p => baseId(p.name) + 1);

  const docs = [
    gameObject(ROOT, name, [ROOT_TRANSFORM, CAPSULE], 0),
    transform(ROOT_TRANSFORM, ROOT, 0, childIds(null)),
    capsuleCollider(CAPSULE, ROOT, body)
  ];

  for (const p of parts) {
    const [owner, tr, filter, renderer, collider] = [0, 1, 2, 3, 4].map(k => baseId(p.name) + k);
    const components = p.trigger ? [tr, filter, renderer, collider] : [tr, filter, renderer];
    docs.push(
      gameObject(owner, p.name, components, 0),
      transform(tr, owner, p.parent ? baseId(p.parent) + 1 : ROOT_TRANSFORM, childIds(p.name), point(p.position)),
      meshFilter(filter, owner, `{fileID: ${MESH_FILE_ID}, guid: ${p.meshGuid}, type: 2}`),
      meshRenderer(renderer, owner, materialGuid)
    );
    if (p.trigger) docs.push(triggerBox(collider, owner, p.trigger));
  }
  return `${HEADER}${docs.join('\n')}\n`;
}
