using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace GrimoireForge.Editor
{
    /// <summary>
    /// Automatically builds native Unity Mesh assets (with full BlendShapes),
    /// Materials, and a wired GrimoireBook.prefab from Grimoire Forge data.
    /// Menu: Tools > Grimoire Forge > Build Book Prefab
    /// </summary>
    public class GrimoireBookBuilder : AssetPostprocessor
    {
        private const string RootDir = "Assets/GrimoireForge";
        private const string DataPath = RootDir + "/Data/grimoire_data.json";
        private const string TexDir = RootDir + "/Textures";
        private const string GenDir = RootDir + "/Generated";
        private const string MeshDir = GenDir + "/Meshes";
        private const string MatDir = GenDir + "/Materials";
        private const string PrefabPath = RootDir + "/GrimoireBook.prefab";

        [Serializable]
        private class SubMeshDto
        {
            public int materialIndex;
            public int[] triangles;
        }

        [Serializable]
        private class BlendShapeDto
        {
            public string name;
            public float[] deltaVertices;
            public float[] deltaNormals;
        }

        [Serializable]
        private class MeshDto
        {
            public string name;
            public float[] vertices;
            public float[] normals;
            public float[] uvs;
            public SubMeshDto[] subMeshes;
            public BlendShapeDto[] blendShapes;
        }

        [Serializable]
        private class MaterialDto
        {
            public string name;
            public float r, g, b, a;
            public bool transparent;
            public string textureFile;
            public float tilingY;
        }

        [Serializable]
        private class NodeDto
        {
            public string name;
            public int parentIndex;
            public float[] pos;
            public float[] rot;
            public float[] scale;
            public int meshIndex;
            public bool startHidden;
        }

        [Serializable]
        private class BookDataDto
        {
            public string bookTitle;
            public float bookWidth;
            public float bookHeight;
            public float thickness;
            public float halfT;
            public float minT;
            public float maxT;
            public float seamY;
            public float pageW;
            public int spreadCount;
            public int turnStageCount;
            public string[] pageTextureFiles;
            public MaterialDto[] materials;
            public MeshDto[] meshes;
            public NodeDto[] nodes;
        }

        private static void OnPostprocessAllAssets(
            string[] importedAssets,
            string[] deletedAssets,
            string[] movedAssets,
            string[] movedFromAssetPaths)
        {
            for (int i = 0; i < importedAssets.Length; i++)
            {
                if (importedAssets[i] == DataPath)
                {
                    EditorApplication.delayCall += () =>
                    {
                        if (File.Exists(DataPath))
                        {
                            BuildBookPrefab();
                        }
                    };
                    break;
                }
            }
        }

        [MenuItem("Tools/Grimoire Forge/Build Book Prefab")]
        public static void BuildBookPrefab()
        {
            TextAsset jsonAsset = AssetDatabase.LoadAssetAtPath<TextAsset>(DataPath);
            if (jsonAsset == null)
            {
                Debug.LogError("[GrimoireForge] Data file not found at: " + DataPath);
                return;
            }

            BookDataDto data = JsonUtility.FromJson<BookDataDto>(jsonAsset.text);
            if (data == null || data.nodes == null || data.nodes.Length == 0)
            {
                Debug.LogError("[GrimoireForge] Failed to parse grimoire_data.json");
                return;
            }

            EnsureFolder(GenDir);
            EnsureFolder(MeshDir);
            EnsureFolder(MatDir);

            // 1. Create Material Assets (auto-detects URP or Built-in Standard / VRChat)
            Shader shader = Shader.Find("Universal Render Pipeline/Lit");
            bool isUrp = shader != null;
            if (shader == null) shader = Shader.Find("Standard");
            if (shader == null) shader = Shader.Find("Diffuse");

            Material[] unityMats = new Material[data.materials.Length];
            for (int i = 0; i < data.materials.Length; i++)
            {
                MaterialDto md = data.materials[i];
                string matPath = MatDir + "/" + SanitizeName(md.name) + "_" + i + ".mat";
                Material mat = AssetDatabase.LoadAssetAtPath<Material>(matPath);
                if (mat == null)
                {
                    mat = new Material(shader);
                    AssetDatabase.CreateAsset(mat, matPath);
                }
                else
                {
                    mat.shader = shader;
                }

                Color col = new Color(md.r, md.g, md.b, md.a);
                Texture2D tex = string.IsNullOrEmpty(md.textureFile)
                    ? null
                    : AssetDatabase.LoadAssetAtPath<Texture2D>(TexDir + "/" + md.textureFile);

                if (isUrp)
                {
                    mat.SetColor("_BaseColor", col);
                    if (tex != null) mat.SetTexture("_BaseMap", tex);
                    mat.SetFloat("_Smoothness", 0.12f);
                    if (md.transparent)
                    {
                        mat.SetFloat("_Surface", 1f);
                        mat.SetFloat("_AlphaClip", 1f);
                        mat.SetFloat("_Cutoff", 0.35f);
                        mat.EnableKeyword("_ALPHATEST_ON");
                        mat.renderQueue = (int)UnityEngine.Rendering.RenderQueue.AlphaTest;
                    }
                }
                else
                {
                    mat.color = col;
                    mat.mainTexture = tex;
                    mat.SetFloat("_Glossiness", 0.12f);
                    mat.SetFloat("_Metallic", 0f);
                    if (md.transparent)
                    {
                        mat.SetFloat("_Mode", 1f); // Cutout for clean crisp foil without sorting artifacts
                        mat.SetFloat("_Cutoff", 0.35f);
                        mat.EnableKeyword("_ALPHATEST_ON");
                        mat.DisableKeyword("_ALPHABLEND_ON");
                        mat.DisableKeyword("_ALPHAPREMULTIPLY_ON");
                        mat.renderQueue = 2450;
                    }
                }

                if (tex != null && md.tilingY > 0.01f)
                {
                    mat.mainTextureScale = new Vector2(1f, md.tilingY);
                }

                EditorUtility.SetDirty(mat);
                unityMats[i] = mat;
            }

            // 2. Create Native Unity Mesh Assets with full BlendShapes
            Mesh[] unityMeshes = new Mesh[data.meshes.Length];
            for (int i = 0; i < data.meshes.Length; i++)
            {
                MeshDto mDto = data.meshes[i];
                Mesh mesh = new Mesh();
                mesh.name = SanitizeName(mDto.name);

                int vCount = mDto.vertices.Length / 3;
                Vector3[] verts = new Vector3[vCount];
                Vector3[] norms = new Vector3[vCount];
                Vector2[] uvs = new Vector2[vCount];

                for (int v = 0; v < vCount; v++)
                {
                    verts[v] = new Vector3(mDto.vertices[v * 3], mDto.vertices[v * 3 + 1], mDto.vertices[v * 3 + 2]);
                    norms[v] = new Vector3(mDto.normals[v * 3], mDto.normals[v * 3 + 1], mDto.normals[v * 3 + 2]);
                    uvs[v] = new Vector2(mDto.uvs[v * 2], mDto.uvs[v * 2 + 1]);
                }

                mesh.vertices = verts;
                mesh.normals = norms;
                mesh.uv = uvs;

                mesh.subMeshCount = mDto.subMeshes.Length;
                for (int s = 0; s < mDto.subMeshes.Length; s++)
                {
                    mesh.SetTriangles(mDto.subMeshes[s].triangles, s);
                }

                if (mDto.blendShapes != null)
                {
                    for (int b = 0; b < mDto.blendShapes.Length; b++)
                    {
                        BlendShapeDto bs = mDto.blendShapes[b];
                        Vector3[] dVerts = new Vector3[vCount];
                        Vector3[] dNorms = new Vector3[vCount];
                        for (int v = 0; v < vCount; v++)
                        {
                            dVerts[v] = new Vector3(bs.deltaVertices[v * 3], bs.deltaVertices[v * 3 + 1], bs.deltaVertices[v * 3 + 2]);
                            dNorms[v] = new Vector3(bs.deltaNormals[v * 3], bs.deltaNormals[v * 3 + 1], bs.deltaNormals[v * 3 + 2]);
                        }
                        mesh.AddBlendShapeFrame(bs.name, 100f, dVerts, dNorms, null);
                    }
                }

                mesh.RecalculateBounds();

                string meshPath = MeshDir + "/" + SanitizeName(mDto.name) + "_" + i + ".asset";
                Mesh existing = AssetDatabase.LoadAssetAtPath<Mesh>(meshPath);
                if (existing != null) AssetDatabase.DeleteAsset(meshPath);
                AssetDatabase.CreateAsset(mesh, meshPath);
                unityMeshes[i] = mesh;
            }

            // 3. Assemble Hierarchy & Wire Controller Component
            GameObject[] objs = new GameObject[data.nodes.Length];
            List<Transform> tabsList = new List<Transform>();

            for (int i = 0; i < data.nodes.Length; i++)
            {
                NodeDto nd = data.nodes[i];
                GameObject go = new GameObject(nd.name);
                objs[i] = go;

                if (nd.parentIndex >= 0 && nd.parentIndex < i)
                {
                    go.transform.SetParent(objs[nd.parentIndex].transform, false);
                }

                go.transform.localPosition = new Vector3(nd.pos[0], nd.pos[1], nd.pos[2]);
                go.transform.localRotation = new Quaternion(nd.rot[0], nd.rot[1], nd.rot[2], nd.rot[3]);
                go.transform.localScale = new Vector3(nd.scale[0], nd.scale[1], nd.scale[2]);

                if (nd.meshIndex >= 0)
                {
                    MeshDto mDto = data.meshes[nd.meshIndex];
                    Mesh mesh = unityMeshes[nd.meshIndex];
                    Material[] mats = new Material[mDto.subMeshes.Length];
                    for (int s = 0; s < mDto.subMeshes.Length; s++)
                    {
                        mats[s] = unityMats[mDto.subMeshes[s].materialIndex];
                    }

                    bool hasBlendShapes = mDto.blendShapes != null && mDto.blendShapes.Length > 0;
                    if (hasBlendShapes)
                    {
                        SkinnedMeshRenderer smr = go.AddComponent<SkinnedMeshRenderer>();
                        smr.sharedMesh = mesh;
                        smr.sharedMaterials = mats;
                        smr.updateWhenOffscreen = true;
                    }
                    else
                    {
                        MeshFilter mf = go.AddComponent<MeshFilter>();
                        mf.sharedMesh = mesh;
                        MeshRenderer mr = go.AddComponent<MeshRenderer>();
                        mr.sharedMaterials = mats;
                    }
                }

                if (nd.name.StartsWith("IndexTab_"))
                {
                    tabsList.Add(go.transform);
                }
                if (nd.startHidden)
                {
                    go.SetActive(false);
                }
            }

            GameObject root = objs[0];
            GrimoireBookController ctrl = root.AddComponent<GrimoireBookController>();
            ctrl.bookWidth = data.bookWidth;
            ctrl.thickness = data.thickness;
            ctrl.minT = data.minT;
            ctrl.maxT = data.maxT;
            ctrl.seamY = data.seamY;
            ctrl.pageW = data.pageW;
            ctrl.indexTabs = tabsList.ToArray();

            for (int i = 0; i < objs.Length; i++)
            {
                GameObject g = objs[i];
                if (g.name == "SpineRig") ctrl.spineRig = g.transform;
                else if (g.name == "SpineMesh") ctrl.spineBoxMesh = g.transform;
                else if (g.name == "LeftCoverPivot") ctrl.leftCoverPivot = g.transform;
                else if (g.name == "RightCoverPivot") ctrl.rightCoverPivot = g.transform;
                else if (g.name == "TurningPageGroup") ctrl.turningPageGroup = g.transform;
                else if (g.name == "LeftPageStack") ctrl.leftPageStack = g.GetComponent<SkinnedMeshRenderer>();
                else if (g.name == "LeftPageUI") ctrl.leftPageUI = g.GetComponent<SkinnedMeshRenderer>();
                else if (g.name == "RightPageStack") ctrl.rightPageStack = g.GetComponent<SkinnedMeshRenderer>();
                else if (g.name == "RightPageUI") ctrl.rightPageUI = g.GetComponent<SkinnedMeshRenderer>();
                else if (g.name == "TurningPageFront") ctrl.turningPageFront = g.GetComponent<SkinnedMeshRenderer>();
                else if (g.name == "TurningPageBack") ctrl.turningPageBack = g.GetComponent<SkinnedMeshRenderer>();
            }

            if (data.pageTextureFiles != null)
            {
                ctrl.pageTextures = new Texture2D[data.pageTextureFiles.Length];
                for (int i = 0; i < data.pageTextureFiles.Length; i++)
                {
                    ctrl.pageTextures[i] = AssetDatabase.LoadAssetAtPath<Texture2D>(TexDir + "/" + data.pageTextureFiles[i]);
                }
            }

            GameObject prefab = PrefabUtility.SaveAsPrefabAsset(root, PrefabPath);
            UnityEngine.Object.DestroyImmediate(root);

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            EditorGUIUtility.PingObject(prefab);
            Debug.Log("[GrimoireForge] GrimoireBook.prefab built with BlendShapes at: " + PrefabPath);
        }

        private static void EnsureFolder(string path)
        {
            string[] parts = path.Split('/');
            string current = parts[0];
            for (int i = 1; i < parts.Length; i++)
            {
                string next = current + "/" + parts[i];
                if (!AssetDatabase.IsValidFolder(next))
                {
                    AssetDatabase.CreateFolder(current, parts[i]);
                }
                current = next;
            }
        }

        private static string SanitizeName(string raw)
        {
            if (string.IsNullOrEmpty(raw)) return "Asset";
            char[] invalid = Path.GetInvalidFileNameChars();
            string clean = raw;
            for (int i = 0; i < invalid.Length; i++)
            {
                clean = clean.Replace(invalid[i], '_');
            }
            return clean.Replace(' ', '_');
        }
    }
}
