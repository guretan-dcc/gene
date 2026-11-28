// Prefab・マテリアル・.meta の YAML
import { HEADER, COMMON, MESH_FILE_ID, gameObject, transform, meshFilter, meshRenderer } from '../../../../shared/unity-yaml.js';

export const BOOK_SCALE = 0.12; // 開いた幅が約0.5mになる大きさ
// UdonSharp の UdonSharpProgramAsset スクリプト
const UDONSHARP_PROGRAM_SCRIPT = 'c333ccfdd0cbdbc4ca30cef2dd6e6b9b';

const vector = v => `{x: ${v[0].toFixed(4)}, y: ${v[1].toFixed(4)}, z: ${v[2].toFixed(4)}}`;

export function createPrefab(name, parts, materialGuid, collider) {
  const ids = i => [0, 1, 2, 3].map(k => 1100 + i * 10 + k);
  const docs = [
    gameObject(1000, name, [1001, 1002], 0),
    transform(1001, 1000, 0, parts.map((_, i) => ids(i)[1]), undefined, false, BOOK_SCALE),
    // Interact を受け取るための当たり判定(Trigger なので体はぶつからない)
    `--- !u!65 &1002
BoxCollider:
${COMMON}
  m_GameObject: {fileID: 1000}
  m_Material: {fileID: 0}
  m_IsTrigger: 1
  m_Enabled: 1
  serializedVersion: 2
  m_Size: ${vector(collider.size)}
  m_Center: ${vector(collider.center)}`
  ];
  parts.forEach((part, i) => {
    const [owner, tr, filter, renderer] = ids(i);
    docs.push(
      gameObject(owner, part.name, [tr, filter, renderer], 0, part.active),
      transform(tr, owner, 1001, []),
      meshFilter(filter, owner, `{fileID: ${MESH_FILE_ID}, guid: ${part.meshGuid}, type: 2}`),
      meshRenderer(renderer, owner, materialGuid)
    );
  });
  return `${HEADER}${docs.join('\n')}\n`;
}

// Unity 標準の Unlit/Texture
export const createMaterial = (name, textureGuid) => `${HEADER}--- !u!21 &2100000
Material:
  serializedVersion: 8
${COMMON}
  m_Name: ${name}
  m_Shader: {fileID: 10752, guid: 0000000000000000f000000000000000, type: 0}
  m_ValidKeywords: []
  m_InvalidKeywords: []
  m_LightmapFlags: 4
  m_EnableInstancingVariants: 1
  m_DoubleSidedGI: 0
  m_CustomRenderQueue: -1
  stringTagMap: {}
  disabledShaderPasses: []
  m_SavedProperties:
    serializedVersion: 3
    m_TexEnvs:
    - _MainTex:
        m_Texture: {fileID: 2800000, guid: ${textureGuid}, type: 3}
        m_Scale: {x: 1, y: 1}
        m_Offset: {x: 0, y: 0}
    m_Ints: []
    m_Floats: []
    m_Colors: []
`;

export const createProgramAsset = (name, scriptGuid) => `${HEADER}--- !u!114 &11400000
MonoBehaviour:
${COMMON}
  m_GameObject: {fileID: 0}
  m_Enabled: 1
  m_EditorHideFlags: 0
  m_Script: {fileID: 11500000, guid: ${UDONSHARP_PROGRAM_SCRIPT}, type: 3}
  m_Name: ${name}
  m_EditorClassIdentifier: 
  serializedUdonProgramAsset: {fileID: 0}
  udonAssembly: 
  assemblyError: 
  sourceCsScript: {fileID: 11500000, guid: ${scriptGuid}, type: 3}
`;

const meta = (guid, body) => `fileFormatVersion: 2
guid: ${guid}
${body}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;

export const nativeMeta = (guid, mainId) => meta(guid, `NativeFormatImporter:
  externalObjects: {}
  mainObjectFileID: ${mainId}`);

export const prefabMeta = guid => meta(guid, `PrefabImporter:
  externalObjects: {}`);

export const scriptMeta = guid => meta(guid, `MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}`);

// 不透明・ミップマップあり・端は繰り返さない
export const textureMeta = guid => meta(guid, `TextureImporter:
  serializedVersion: 12
  mipmaps:
    enableMipMap: 1
    sRGBTexture: 1
  textureSettings:
    serializedVersion: 2
    filterMode: 1
    aniso: 4
    wrapU: 1
    wrapV: 1
    wrapW: 1
  nPOTScale: 0
  alphaUsage: 0
  textureType: 0
  textureShape: 1
  maxTextureSize: 2048
  textureCompression: 2`);
