# ディレクトリ構造

- 共通/
  - LowPolyVertexColorUtility.cs
  - VrcSpawnGizmo.cs
  - LowPolyVertexColorUtility.cs.meta
  - VrcSpawnGizmo.cs.meta
- 橋ジェネレーター/
  - Materials/
    - Bridge_Default.mat
    - Bridge_Default.mat.meta
  - BridgeGeneratorWindow.cs
  - BridgeGeneratorWindow.cs.meta
  - Materials.meta
- 地形ジェネレーター/
  - FloatingTerrainBuilder.cs
  - FloatingTerrainGeneratorWindow.cs
  - FloatingTerrainBuilder.cs.meta
  - FloatingTerrainGeneratorWindow.cs.meta
  - IslandVertexColorLit.shader
  - IslandVertexColorWind.shader
  - IslandVertexColorLit.shader.meta
  - IslandVertexColorWind.shader.meta
- 頂点カラー変換/
  - LowPolyGeneratedMigration.cs
  - LowPolyModelConverter.cs
  - LowPolyGeneratedMigration.cs.meta
  - LowPolyModelConverter.cs.meta
- 頂点カラー補正/
  - VertexColorCorrectionWindow.cs
  - VertexColorCorrectionWindow.cs.meta
- 認識テストケース収集/
  - Data/
    - 認識テストケース.asset
    - 認識テストケース.asset.meta
  - RecognitionCaptureTools.cs
  - RecognitionTestCaseDatabase.cs
  - RecognitionTestCaseDatabaseEditor.cs
  - RecognitionCaptureTools.cs.meta
  - RecognitionTestCaseDatabase.cs.meta
  - RecognitionTestCaseDatabaseEditor.cs.meta
  - Data.meta
- 浮島ジェネレーター/
  - FloatingIslandGeneratorWindow.cs
  - FloatingIslandSurfaceTriangulator.cs
  - FloatingIslandGeneratorWindow.cs.meta
  - FloatingIslandSurfaceTriangulator.cs.meta
- 共通.meta
- 橋ジェネレーター.meta
- 地形ジェネレーター.meta
- 頂点カラー変換.meta
- 頂点カラー補正.meta
- 認識テストケース収集.meta
- 浮島ジェネレーター.meta

---

# ファイル詳細情報

## File: 共通/LowPolyVertexColorUtility.cs

```cs
using System;
using UnityEditor;
using UnityEngine;

public static class LowPolyVertexColorUtility {
    public const string MaterialPath = "Assets/MyAssets/Generated/SharedMaterials/LowPolyVertexColor.mat";
    public const string ShaderPath = "Assets/MyAssets/Generated/SharedMaterials/LowPolyVertexColor.shader";

    public static Material GetMaterial() {
        var shader = AssetDatabase.LoadAssetAtPath<Shader>(ShaderPath);
        if (shader == null) throw new InvalidOperationException("頂点カラー用Shaderがありません。");
        var material = AssetDatabase.LoadAssetAtPath<Material>(MaterialPath);
        if (material != null) {
            if (material.shader != shader) throw new InvalidOperationException("共有MaterialのShaderが異なります。");
            return material;
        }
        EnsureFolder(System.IO.Path.GetDirectoryName(MaterialPath).Replace('\\', '/'));
        material = new Material(shader) { name = "LowPolyVertexColor", enableInstancing = true };
        AssetDatabase.CreateAsset(material, MaterialPath);
        return material;
    }

    public static void EnsureFolder(string path) {
        if (AssetDatabase.IsValidFolder(path)) return;
        string parent = System.IO.Path.GetDirectoryName(path).Replace('\\', '/');
        EnsureFolder(parent);
        AssetDatabase.CreateFolder(parent, System.IO.Path.GetFileName(path));
    }

    // アルファは不透明描画には使わず、島の草地判定に使用。
    public static void BakeIslandMask(Mesh mesh, Color grass, Color rock) {
        var masks = mesh.colors32;
        var colors = new Color32[masks.Length];
        for (int i = 0; i < colors.Length; i++) {
            Color color = Color.Lerp(rock.linear, grass.linear, masks[i].r / 255f);
            color *= 1f + masks[i].g / 255f - masks[i].b / 255f;
            color = color.gamma;
            color.a = masks[i].r / 255f;
            colors[i] = color;
        }
        mesh.colors32 = colors;
        StripUnused(mesh);
    }

    public static void StripUnused(Mesh mesh) {
        mesh.uv = Array.Empty<Vector2>();
        mesh.tangents = Array.Empty<Vector4>();
    }
}

```

## File: 共通/VrcSpawnGizmo.cs

```cs
using UnityEditor;
using UnityEngine;
using VRC.SDK3.Components;

public static class VrcSpawnGizmo {
    const float PlayerRadius = 0.35f;
    const float PlayerHeight = 1.7f;
    const float ForwardArrowLength = 1.2f;
    const float MaxLabelDistance = 120f;

    [DrawGizmo(GizmoType.NonSelected | GizmoType.Selected | GizmoType.Pickable)]
    static void DrawSceneDescriptorGizmo(VRCSceneDescriptor descriptor, GizmoType gizmoType) {
        if (descriptor == null) return;

        bool selected = (gizmoType & GizmoType.Selected) != 0;
        Color mainColor = selected
            ? new Color(1f, 0.85f, 0.15f, 0.95f)
            : new Color(0.15f, 0.9f, 1f, 0.85f);

        Transform[] spawns = descriptor.spawns;
        if (spawns == null || spawns.Length == 0) {
            DrawSpawnMarker(descriptor.transform, mainColor, selected, descriptor.gameObject.name);
            return;
        }

        for (int i = 0; i < spawns.Length; i++) {
            Transform spawn = spawns[i];
            if (spawn == null) continue;
            string label = spawns.Length == 1
                ? spawn.name
                : $"{spawn.name} [{i}]";
            DrawSpawnMarker(spawn, mainColor, selected, label);
        }
    }

    static void DrawSpawnMarker(Transform spawn, Color mainColor, bool selected, string label) {
        Vector3 pos = spawn.position;
        Vector3 forward = spawn.forward;
        forward.y = 0f;
        if (forward.sqrMagnitude < 1e-4f) forward = Vector3.forward;
        forward.Normalize();

        // クリック選択しやすい中心マーカーとプレイヤー身長目安のリング・柱
        Gizmos.color = new Color(mainColor.r, mainColor.g, mainColor.b, selected ? 0.35f : 0.22f);
        Gizmos.DrawSphere(pos + Vector3.up * 0.15f, 0.15f);

        Handles.color = mainColor;
        Handles.DrawWireDisc(pos, Vector3.up, PlayerRadius);
        Handles.DrawWireDisc(pos + Vector3.up * PlayerHeight, Vector3.up, PlayerRadius);

        Vector3 right = Vector3.Cross(Vector3.up, forward).normalized;
        DrawVerticalLine(pos + forward * PlayerRadius, PlayerHeight);
        DrawVerticalLine(pos - forward * PlayerRadius, PlayerHeight);
        DrawVerticalLine(pos + right * PlayerRadius, PlayerHeight);
        DrawVerticalLine(pos - right * PlayerRadius, PlayerHeight);

        // 向きの矢印
        Vector3 arrowStart = pos + Vector3.up * 0.85f;
        Vector3 arrowEnd = arrowStart + forward * ForwardArrowLength;
        Handles.DrawLine(arrowStart, arrowEnd);
        Handles.DrawLine(arrowEnd, arrowEnd - forward * 0.25f + right * 0.16f);
        Handles.DrawLine(arrowEnd, arrowEnd - forward * 0.25f - right * 0.16f);

        // 地面から浮いている場合は直下の接地位置へ補助線を表示
        float floatHeight = 0f;
        if (Physics.Raycast(pos + Vector3.up * 0.1f, Vector3.down, out RaycastHit hit, 200f)) {
            floatHeight = pos.y - hit.point.y;
            if (floatHeight > 0.05f) {
                Handles.color = new Color(mainColor.r, mainColor.g, mainColor.b, 0.55f);
                Handles.DrawDottedLine(pos, hit.point, 4f);
                Handles.DrawWireDisc(hit.point + Vector3.up * 0.02f, hit.normal, PlayerRadius * 0.85f);
            }
        }

        Camera cam = SceneView.currentDrawingSceneView != null
            ? SceneView.currentDrawingSceneView.camera
            : null;
        if (cam != null && Vector3.Distance(cam.transform.position, pos) <= MaxLabelDistance) {
            string text = floatHeight > 0.2f
                ? $"Spawn ({label}) +{floatHeight:0.0}m"
                : $"Spawn ({label})";
            Handles.Label(pos + Vector3.up * (PlayerHeight + 0.25f), text);
        }
    }

    static void DrawVerticalLine(Vector3 bottom, float height) {
        Handles.DrawLine(bottom, bottom + Vector3.up * height);
    }
}

```

## File: 共通/LowPolyVertexColorUtility.cs.meta

```meta
fileFormatVersion: 2
guid: 0e85f5f68f616314688fac45cd8b35c3
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 共通/VrcSpawnGizmo.cs.meta

```meta
fileFormatVersion: 2
guid: 4506f06907d37164588a378170ecc908
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 橋ジェネレーター/Materials/Bridge_Default.mat

```mat
%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!21 &2100000
Material:
  serializedVersion: 8
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}
  m_Name: Bridge_Default
  m_Shader: {fileID: 4800000, guid: bdd48043fb5c7754085db76ad8c13eff, type: 3}
  m_Parent: {fileID: 0}
  m_ModifiedSerializedProperties: 0
  m_ValidKeywords: []
  m_InvalidKeywords: []
  m_LightmapFlags: 4
  m_EnableInstancingVariants: 1
  m_DoubleSidedGI: 0
  m_CustomRenderQueue: -1
  stringTagMap: {}
  disabledShaderPasses: []
  m_LockedProperties: 
  m_SavedProperties:
    serializedVersion: 3
    m_TexEnvs: []
    m_Ints: []
    m_Floats: []
    m_Colors:
    - _GrassColor: {r: 0.48, g: 0.29, b: 0.12, a: 1}
    - _RockColor: {r: 0.48, g: 0.29, b: 0.12, a: 1}
  m_BuildTextureStacks: []

```

## File: 橋ジェネレーター/Materials/Bridge_Default.mat.meta

```meta
fileFormatVersion: 2
guid: 4bf8a08eba88caa4e92a6dc15e2d2119
NativeFormatImporter:
  externalObjects: {}
  mainObjectFileID: 2100000
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 橋ジェネレーター/BridgeGeneratorWindow.cs

```cs
using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;

public class BridgeGeneratorWindow : EditorWindow {
    [SerializeField] BridgeSettings settings = new BridgeSettings();
    [SerializeField] Transform start;
    [SerializeField] Transform end;
    [SerializeField] GameObject lastPrefab;
    Editor preview;
    Vector2 scroll;

    [MenuItem("Tools/MyWorld/橋ジェネレーター")]
    public static void Open() {
        GetWindow<BridgeGeneratorWindow>("橋ジェネレーター").minSize = new Vector2(380f, 540f);
    }

    void OnGUI() {
        scroll = EditorGUILayout.BeginScrollView(scroll);
        EditorGUILayout.HelpBox("始点・終点を浮島の子にすると、島の地表へ接続位置を自動補正します。子でない端点は指定位置を使います。生成だけでは配置しません。単位はm。", MessageType.Info);
        if (GUILayout.Button("生成設定をリセット")) {
            Undo.RecordObject(this, "橋の設定をリセット");
            settings = new BridgeSettings();
        }
        settings.bridgeName = EditorGUILayout.TextField("橋の名前", settings.bridgeName);
        start = (Transform)EditorGUILayout.ObjectField("始点", start, typeof(Transform), true);
        end = (Transform)EditorGUILayout.ObjectField("終点", end, typeof(Transform), true);
        settings.width = EditorGUILayout.Slider("幅", settings.width, 0.5f, 5f);
        settings.sag = EditorGUILayout.Slider("たるみ", settings.sag, 0f, 5f);
        settings.irregularity = EditorGUILayout.Slider(new GUIContent("板の不揃いさ",
            "左右のずれ・幅・長さ・回転・四隅の形をまとめて調整します。0なら均一。同じ設定なら同じ並びになります。"),
            settings.irregularity, 0f, 1f);
        settings.gap = EditorGUILayout.Slider("板の隙間", settings.gap, 0f, 0.2f);
        settings.colorVariation = EditorGUILayout.Slider("色のムラ", settings.colorVariation, 0f, 0.5f);
        EditorGUILayout.LabelField("共有マテリアル", "LowPolyVertexColor");
        settings.woodColor = EditorGUILayout.ColorField("板の色", settings.woodColor);
        bool valid = true;
        try {
            if (start == null || end == null) throw new ArgumentException("始点と終点を指定してください。");
            if (EditorUtility.IsPersistent(start) || EditorUtility.IsPersistent(end)) throw new ArgumentException("始点・終点にはシーン内のTransformを指定してください。");
            settings.start = BridgeMeshGenerator.ResolveShorePoint(start);
            settings.end = BridgeMeshGenerator.ResolveShorePoint(end);
            BridgeMeshGenerator.Validate(settings);
            float length = Vector2.Distance(new Vector2(settings.start.x, settings.start.z), new Vector2(settings.end.x, settings.end.z));
            float slope = Mathf.Atan((Mathf.Abs(settings.end.y - settings.start.y) + 4f * settings.sag) / length) * Mathf.Rad2Deg;
            EditorGUILayout.LabelField("水平距離", length.ToString("F2") + " m");
            EditorGUILayout.LabelField("接続する岸の高さ", settings.start.y.ToString("F2") + " → " + settings.end.y.ToString("F2") + " m");
            if (slope > 35f) EditorGUILayout.HelpBox("端付近の傾斜が急です。高低差かたるみを減らすと歩きやすくなります。", MessageType.Warning);
            EditorGUILayout.LabelField("保存先", BridgeMeshGenerator.GetFolder(settings.bridgeName));
        } catch (Exception exception) {
            valid = false;
            EditorGUILayout.HelpBox(exception.Message, MessageType.Warning);
        }
        using (new EditorGUI.DisabledScope(!valid || EditorApplication.isCompiling || EditorApplication.isPlayingOrWillChangePlaymode)) {
            if (GUILayout.Button("生成／同名の橋を更新", GUILayout.Height(30f))) {
                try {
                    lastPrefab = BridgeMeshGenerator.CreatePrefab(settings);
                    ResetPreview();
                    EditorGUIUtility.PingObject(lastPrefab);
                } catch (Exception exception) {
                    Debug.LogException(exception);
                    EditorUtility.DisplayDialog("橋の生成に失敗", exception.Message, "閉じる");
                }
            }
        }
        if (lastPrefab != null) {
            EditorGUILayout.ObjectField("最後に生成した橋", lastPrefab, typeof(GameObject), false);
            if (GUILayout.Button("生成した橋をシーンに配置")) {
                var instance = (GameObject)PrefabUtility.InstantiatePrefab(lastPrefab);
                Undo.RegisterCreatedObjectUndo(instance, "橋を配置");
                Selection.activeGameObject = instance;
            }
            if (preview == null) preview = Editor.CreateEditor(lastPrefab);
            Rect rect = GUILayoutUtility.GetRect(250f, 230f, GUILayout.ExpandWidth(true));
            if (preview.HasPreviewGUI()) preview.OnInteractivePreviewGUI(rect, GUIStyle.none);
            EditorGUILayout.HelpBox("設定や端点を動かした後は再生成してください。配置ボタンは生成時の始点・向きに配置します。同名更新は配置済みの橋にも反映されますが、手動で変更した位置・回転・スケールは個別設定が優先されます。", MessageType.Info);
        }
        EditorGUILayout.EndScrollView();
    }

    void OnDisable() { ResetPreview(); }
    void ResetPreview() {
        if (preview != null) DestroyImmediate(preview);
        preview = null;
    }
}

[Serializable]
public class BridgeSettings {
    public string bridgeName = "Bridge";
    public Vector3 start;
    public Vector3 end = new Vector3(0f, 0f, 10f);
    public float width = 1.6f;
    public float sag = 0.6f;
    public float irregularity = 0.6f;
    public float gap = 0.08f;
    public float colorVariation = 0.25f;
    public string materialName = "Bridge_Default";
    public Color woodColor = new Color(0.48f, 0.29f, 0.12f);
}

public static class BridgeMeshGenerator {
    public const string OutputFolder = "Assets/MyAssets/Generated/Bridges";

    // Prefabは始点に置き、ローカルの+Z方向を終点へ向ける。
    public static Vector3 GetPoint(float length, float rise, float t, float sag) {
        return new Vector3(0f, rise * t - 4f * t * (1f - t) * sag, length * t);
    }

    public static string GetFolder(string name) {
        string validName = System.IO.Path.GetFileName(FloatingIslandMeshGenerator.GetIslandFolder(name));
        return OutputFolder + "/" + validName;
    }

    public static Vector3 ResolveShorePoint(Transform endpoint) {
        if (endpoint == null) throw new ArgumentException("始点と終点を指定してください。");
        var filter = endpoint.parent != null ? endpoint.parent.GetComponentInParent<MeshFilter>() : null;
        if (filter == null || filter.sharedMesh == null || !AssetDatabase.GetAssetPath(filter.sharedMesh)
                .StartsWith(FloatingIslandMeshGenerator.OutputFolder + "/", StringComparison.Ordinal)) return endpoint.position;
        Mesh mesh = filter.sharedMesh;
        var vertices = mesh.vertices;
        var triangles = mesh.triangles;
        var colors = mesh.colors;
        var renderer = filter.GetComponent<MeshRenderer>();
        bool vertexColor = renderer != null && renderer.sharedMaterial != null
            && renderer.sharedMaterial.shader.name == "MyWorld/Low Poly Vertex Color";
        Vector3 point = endpoint.position, best = point;
        float bestDistance = float.PositiveInfinity;
        for (int i = 0; i < triangles.Length; i += 3) {
            int ia = triangles[i], ib = triangles[i + 1], ic = triangles[i + 2];
            if (colors.Length != vertices.Length || (vertexColor ? colors[ia].a : colors[ia].r) < 0.99f
                    || (vertexColor ? colors[ib].a : colors[ib].r) < 0.99f || (vertexColor ? colors[ic].a : colors[ic].r) < 0.99f) continue;
            Vector3 a = filter.transform.TransformPoint(vertices[ia]);
            Vector3 b = filter.transform.TransformPoint(vertices[ib]);
            Vector3 c = filter.transform.TransformPoint(vertices[ic]);
            if (Vector3.Cross(b - a, c - a).normalized.y < 0.5f) continue;
            Vector2 ab = XZ(b - a), ac = XZ(c - a), ap = XZ(point - a);
            float denominator = Cross(ab, ac);
            if (Mathf.Abs(denominator) < 1e-10f) continue;
            float u = Cross(ap, ac) / denominator, v = Cross(ab, ap) / denominator;
            if (u >= 0f && v >= 0f && u + v <= 1f) {
                ConsiderShorePoint(a + (b - a) * u + (c - a) * v, point, ref best, ref bestDistance);
            } else {
                ConsiderShorePoint(ClosestOnEdge(point, a, b), point, ref best, ref bestDistance);
                ConsiderShorePoint(ClosestOnEdge(point, b, c), point, ref best, ref bestDistance);
                ConsiderShorePoint(ClosestOnEdge(point, c, a), point, ref best, ref bestDistance);
            }
        }
        if (bestDistance > 1f) throw new ArgumentException(endpoint.name + "が島の地表から離れています。岸の内側か、岸から水平距離1m以内へ移動してください。");
        return best;
    }

    static Vector2 XZ(Vector3 value) { return new Vector2(value.x, value.z); }
    static float Cross(Vector2 a, Vector2 b) { return a.x * b.y - a.y * b.x; }
    static Vector3 ClosestOnEdge(Vector3 point, Vector3 a, Vector3 b) {
        Vector2 edge = XZ(b - a);
        float t = edge.sqrMagnitude > 0f ? Mathf.Clamp01(Vector2.Dot(XZ(point - a), edge) / edge.sqrMagnitude) : 0f;
        return Vector3.Lerp(a, b, t);
    }
    static void ConsiderShorePoint(Vector3 candidate, Vector3 point, ref Vector3 best, ref float distance) {
        float candidateDistance = XZ(candidate - point).sqrMagnitude;
        if (candidateDistance > distance || (Mathf.Approximately(candidateDistance, distance) && candidate.y <= best.y)) return;
        distance = candidateDistance;
        best = candidate;
    }

    public static void Validate(BridgeSettings s) {
        GetFolder(s.bridgeName);

        if (!Finite(s.start) || !Finite(s.end) || !Finite(s.width) || !Finite(s.sag) || !Finite(s.irregularity)) throw new ArgumentException("端点・幅・たるみ・不揃いさには有限の数値を指定してください。");
        if (s.irregularity < 0f || s.irregularity > 1f) throw new ArgumentException("板の不揃いさは0〜1にしてください。");
        if (!Finite(s.gap) || s.gap < 0f || s.gap > 0.2f) throw new ArgumentException("板の隙間は0〜0.2mにしてください。");
        if (!Finite(s.colorVariation) || s.colorVariation < 0f || s.colorVariation > 0.5f) throw new ArgumentException("色のムラは0〜0.5にしてください。");
        float length = Vector2.Distance(new Vector2(s.start.x, s.start.z), new Vector2(s.end.x, s.end.z));
        if (length < 0.5f || length > 100f) throw new ArgumentException("端点の水平距離は0.5〜100mにしてください。");
        if (Mathf.Abs(s.end.y - s.start.y) > 100f) throw new ArgumentException("端点の高低差は100m以内にしてください。");
        if (s.width < 0.5f || s.width > 5f || s.sag < 0f || s.sag > Mathf.Min(5f, length * 0.25f)) throw new ArgumentException("幅は0.5〜5m、たるみは0〜5mか水平距離の25%以下にしてください。");
    }

    static bool Finite(float value) { return !float.IsNaN(value) && !float.IsInfinity(value); }
    static bool Finite(Vector3 value) { return Finite(value.x) && Finite(value.y) && Finite(value.z); }

    public static void BuildMeshes(BridgeSettings s, out Mesh visual, out Mesh collision) {
        Validate(s);
        float length = Vector2.Distance(new Vector2(s.start.x, s.start.z), new Vector2(s.end.x, s.end.z));
        float rise = s.end.y - s.start.y;
        int panels = Mathf.CeilToInt(new Vector2(length, rise).magnitude / 0.4f);
        var body = new MeshBuilder { baseColor = s.woodColor };
        var floor = new MeshBuilder();
        float half = s.width * 0.5f;
        var random = new System.Random(12345);
        var colorRandom = new System.Random(12347);
        for (int i = 0; i < panels; i++) {
            float a = (float)i / panels, b = (float)(i + 1) / panels;
            Vector3 p = GetPoint(length, rise, a, s.sag), q = GetPoint(length, rise, b, s.sag);
            Vector3 forward = (q - p).normalized;
            Vector3 up = Vector3.Cross(forward, Vector3.right).normalized;
            // 色は形とは別の乱数系列にする。
            body.brightness = 1f + SignedRandom(colorRandom) * s.colorVariation;
            float variation = s.irregularity;
            float offset = SignedRandom(random) * half * 0.18f * variation;
            float plankHalfWidth = half * (1f + SignedRandom(random) * 0.12f * variation);
            float plankHalfLength = Mathf.Max(0.05f, (q - p).magnitude - s.gap) * 0.5f
                * (1f + SignedRandom(random) * 0.12f * variation);
            float angle = SignedRandom(random) * 4f * variation * Mathf.Deg2Rad;
            Vector3 x = Vector3.right * Mathf.Cos(angle) + forward * Mathf.Sin(angle);
            Vector3 z = forward * Mathf.Cos(angle) - Vector3.right * Mathf.Sin(angle);
            Vector3 center = (p + q) * 0.5f + Vector3.right * offset;
            var corners = new Vector3[4];
            for (int corner = 0; corner < 4; corner++) {
                float sx = corner < 2 ? -1f : 1f;
                float sz = corner == 0 || corner == 3 ? -1f : 1f;
                corners[corner] = center
                    + x * (sx * plankHalfWidth + SignedRandom(random) * half * 0.04f * variation)
                    + z * (sz * plankHalfLength + SignedRandom(random) * plankHalfLength * 0.08f * variation);
            }
            body.Plank(corners, up * 0.12f);
            floor.Walkway(p, q, half);
        }
        visual = body.Create("BridgeMesh");
        collision = floor.Create("BridgeCollider");
    }

    static float SignedRandom(System.Random random) { return (float)random.NextDouble() * 2f - 1f; }

    class MeshBuilder {
        public float brightness = 1f;
        public Color baseColor = Color.white;
        readonly List<Vector3> vertices = new List<Vector3>();
        readonly List<int> triangles = new List<int>();
        readonly List<Color32> colors = new List<Color32>();

        public void Quad(Vector3 a, Vector3 b, Vector3 c, Vector3 d, float mask) {
            Triangle(a, b, c, mask); Triangle(a, c, d, mask);
        }
        void Triangle(Vector3 a, Vector3 b, Vector3 c, float mask) {
            int index = vertices.Count;
            vertices.Add(a); vertices.Add(b); vertices.Add(c);
            for (int i = 0; i < 3; i++) {
                triangles.Add(index + i);
                Color color = (baseColor.linear * brightness).gamma;
                color.a = 1f;
                colors.Add(color);
            }
        }
        public void Plank(Vector3[] top, Vector3 thickness) {
            Quad(top[0], top[1], top[2], top[3], 1f);
            Quad(top[3]-thickness, top[2]-thickness, top[1]-thickness, top[0]-thickness, 1f);
            for (int i = 0; i < 4; i++) {
                int next = (i + 1) % 4;
                Quad(top[i], top[i]-thickness, top[next]-thickness, top[next], 1f);
            }
        }
        public void Walkway(Vector3 a, Vector3 b, float half) {
            Quad(a + Vector3.left * half, b + Vector3.left * half,
                b + Vector3.right * half, a + Vector3.right * half, 1f);
        }
        public Mesh Create(string name) {
            var mesh = new Mesh { name = name, indexFormat = vertices.Count > 65535 ? IndexFormat.UInt32 : IndexFormat.UInt16 };
            mesh.SetVertices(vertices); mesh.SetColors(colors);
            mesh.SetTriangles(triangles, 0); mesh.RecalculateNormals(); mesh.RecalculateBounds();
            return mesh;
        }
    }

    public static GameObject CreatePrefab(BridgeSettings s) {
        Validate(s);
        // 名前やShaderの衝突をMesh更新前に検出する。
        Material material = FloatingIslandMeshGenerator.GetSharedMaterial(s.materialName, s.woodColor, s.woodColor);
        string folder = GetFolder(s.bridgeName), path = folder + "/Bridge.prefab";
        GameObject existing = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        CheckType(path, existing);
        var alignedInstances = new List<Transform>();
        if (existing != null) {
            // 生成位置のまま配置されている橋は、更新した岸の位置にも追従させる。
            // 手動で移動・回転・拡縮された橋は、その配置を維持する。
            foreach (var instance in Resources.FindObjectsOfTypeAll<Transform>()) {
                if (EditorUtility.IsPersistent(instance) || !instance.gameObject.scene.IsValid()
                        || !PrefabUtility.IsAnyPrefabInstanceRoot(instance.gameObject)
                        || PrefabUtility.GetPrefabAssetPathOfNearestInstanceRoot(instance.gameObject) != path) continue;
                if (Vector3.Distance(instance.position, existing.transform.position) < 0.001f
                        && Quaternion.Angle(instance.rotation, existing.transform.rotation) < 0.01f
                        && Vector3.Distance(instance.localScale, existing.transform.localScale) < 0.001f) alignedInstances.Add(instance);
            }
        }
        Mesh visual = null, collision = null;
        GameObject root = null;
        Scene scene = default(Scene);
        var saved = new List<Mesh>();
        var backups = new List<Mesh>();
        var created = new List<string>();
        bool complete = false;
        try {
            BuildMeshes(s, out visual, out collision);
            if (existing != null) root = PrefabUtility.LoadPrefabContents(path);
            else {
                scene = EditorSceneManager.NewPreviewScene();
                root = new GameObject(s.bridgeName.Trim());
                SceneManager.MoveGameObjectToScene(root, scene);
            }
            root.name = s.bridgeName.Trim();
            Vector3 direction = s.end - s.start; direction.y = 0f;
            root.transform.SetPositionAndRotation(s.start, Quaternion.LookRotation(direction));
            root.transform.localScale = Vector3.one;
            root.isStatic = true;
            EnsureFolder(folder);
            Mesh body = SaveMesh(visual, folder + "/BridgeMesh.asset", saved, backups, created);
            Mesh floor = SaveMesh(collision, folder + "/BridgeCollider.asset", saved, backups, created);
            var filter = root.GetComponent<MeshFilter>(); if (filter == null) filter = root.AddComponent<MeshFilter>();
            var renderer = root.GetComponent<MeshRenderer>(); if (renderer == null) renderer = root.AddComponent<MeshRenderer>();
            var collider = root.GetComponent<MeshCollider>(); if (collider == null) collider = root.AddComponent<MeshCollider>();
            filter.sharedMesh = body; renderer.sharedMaterials = new[] { material };
            collider.sharedMesh = null; collider.sharedMesh = floor;
            var prefab = PrefabUtility.SaveAsPrefabAsset(root, path);
            if (prefab == null) throw new InvalidOperationException("橋のPrefabを保存できませんでした。");
            complete = true;
            RefreshColliders(floor);
            foreach (Transform instance in alignedInstances) {
                Undo.RecordObject(instance, "橋の接続位置を更新");
                instance.SetPositionAndRotation(s.start, Quaternion.LookRotation(direction));
                PrefabUtility.RecordPrefabInstancePropertyModifications(instance);
            }
            return prefab;
        } finally {
            if (existing != null && root != null) PrefabUtility.UnloadPrefabContents(root);
            else if (scene.IsValid()) EditorSceneManager.ClosePreviewScene(scene);
            if (!complete) {
                for (int i = 0; i < saved.Count; i++) {
                    CopyMesh(backups[i], saved[i]); EditorUtility.SetDirty(saved[i]); AssetDatabase.SaveAssetIfDirty(saved[i]); RefreshColliders(saved[i]);
                }
                foreach (string asset in created) AssetDatabase.DeleteAsset(asset);
            }
            foreach (Mesh backup in backups) UnityEngine.Object.DestroyImmediate(backup);
            if (visual != null && !AssetDatabase.Contains(visual)) UnityEngine.Object.DestroyImmediate(visual);
            if (collision != null && !AssetDatabase.Contains(collision)) UnityEngine.Object.DestroyImmediate(collision);
        }
    }

    static Mesh SaveMesh(Mesh source, string path, List<Mesh> saved, List<Mesh> backups, List<string> created) {
        Mesh mesh = AssetDatabase.LoadAssetAtPath<Mesh>(path);
        CheckType(path, mesh);
        if (mesh == null) {
            mesh = UnityEngine.Object.Instantiate(source);
            AssetDatabase.CreateAsset(mesh, path); created.Add(path);
        } else {
            saved.Add(mesh); backups.Add(UnityEngine.Object.Instantiate(mesh));
            CopyMesh(source, mesh); EditorUtility.SetDirty(mesh); AssetDatabase.SaveAssetIfDirty(mesh);
        }
        return mesh;
    }
    static void CopyMesh(Mesh source, Mesh destination) {
        destination.Clear(false); destination.indexFormat = source.indexFormat; destination.name = source.name;
        destination.vertices = source.vertices; destination.normals = source.normals;
        destination.colors32 = source.colors32;
        destination.triangles = source.triangles; destination.RecalculateBounds(); destination.UploadMeshData(false);
    }
    static void RefreshColliders(Mesh mesh) {
        foreach (var collider in Resources.FindObjectsOfTypeAll<MeshCollider>()) {
            if (EditorUtility.IsPersistent(collider) || !collider.gameObject.scene.IsValid() || collider.sharedMesh != mesh) continue;
            collider.sharedMesh = null; collider.sharedMesh = mesh;
        }
    }
    static void CheckType(string path, UnityEngine.Object expected) {
        if (expected == null && (System.IO.File.Exists(path) || System.IO.Directory.Exists(path))) throw new InvalidOperationException("保存先に別種類のファイル等があります: " + path);
    }
    static void EnsureFolder(string path) {
        if (AssetDatabase.IsValidFolder(path)) return;
        CheckType(path, null);
        string parent = System.IO.Path.GetDirectoryName(path).Replace('\\', '/');
        EnsureFolder(parent);
        AssetDatabase.CreateFolder(parent, System.IO.Path.GetFileName(path));
    }
}

```

## File: 橋ジェネレーター/BridgeGeneratorWindow.cs.meta

```meta
fileFormatVersion: 2
guid: ca08eb13d5e1f3843b9257cd8816d865
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 橋ジェネレーター/Materials.meta

```meta
fileFormatVersion: 2
guid: 3c80758408944657b8ec73838b5eaf46
folderAsset: yes
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 地形ジェネレーター/FloatingTerrainBuilder.cs

```cs
using System.Collections.Generic;
using UnityEngine;

// 設定(FloatingTerrainSettings)から地形・水・木・草のMeshと配置データを作る。
[System.Serializable]
public class FloatingTerrainBuilder : FloatingTerrainSettings {
    const float ZStep = 0.8660254f;

    // 6近傍オフセット(偶数列・奇数列の千鳥格子)
    static readonly int[] EvenDX = { 1, 0, -1, -1, -1, 0 };
    static readonly int[] EvenDZ = { 0, 1, 1, 0, -1, -1 };
    static readonly int[] OddDX = { 1, 1, 0, -1, 0, 1 };
    static readonly int[] OddDZ = { 0, 1, 1, 0, -1, -1 };

    public class BuildResult {
        public Mesh terrainMesh;
        public Mesh waterMesh;
        public Mesh combinedTreesMesh;
        public Mesh combinedTreesColliderMesh;
        public Mesh combinedGrassMesh;
    }

    // ---- 内部データ ----
    int nx, nz, nzCells;
    float half, cellZ;
    float[] H, F, mask, bottomY, mountain, shore, slopeNy, riverW, steepDist, rimDist, ridgeCurv, snowSlopeNy, snowMap;
    bool[] inside, centerRiver, river, bankSlopeFlag, snowZone, snowBuffer;
    int[] lakeId;
    List<float> lakeLevels;
    List<bool> lakeFrozen;
    Vector2[] baseXz, xz, offs;
    System.Random rng;
    Vector3[] finalTopPos;
    int[] finalTriA, finalTriB, finalTriC;
    float[] finalTriNy;
    int bucketRes;
    float bucketMinX, bucketMinZ, bucketInvCell;
    int[] bucketHead, bucketTri, bucketNext;

    // 互換用: 4つのMesh(地形・水・木・草)を返す
    public Mesh[] Build(FloatingTerrainSettings source) {
        BuildResult res = BuildDetailed(source);
        return new[] { res.terrainMesh, res.waterMesh, res.combinedTreesMesh, res.combinedGrassMesh };
    }

    // 静的結合メッシュ(地形・水・木・チャンク分割草)を含むビルド
    public BuildResult BuildDetailed(FloatingTerrainSettings source) {
        JsonUtility.FromJsonOverwrite(JsonUtility.ToJson(source), this);
        FloatingTerrainSettings.GetEffectiveGreeneryLine(this);
        FloatingTerrainSettings.GetEffectiveLakeDepth(this);
        FloatingTerrainSettings.GetEffectiveBottomDepth(this);

        var r0 = new System.Random(seed);
        offs = new Vector2[16];
        for (int i = 0; i < offs.Length; i++) {
            offs[i] = new Vector2((float)r0.NextDouble() * 1000f, (float)r0.NextDouble() * 1000f);
        }

        nx = resolution + 1;
        nzCells = (Mathf.RoundToInt(resolution / ZStep) + 1) & ~1;
        nz = nzCells + 1;
        half = resolution * cellSize * 0.5f;
        cellZ = cellSize * ZStep;

        float maxJitter = Mathf.Clamp(jitter, 0f, 0.4f);
        baseXz = new Vector2[nx * nz];
        xz = new Vector2[nx * nz];
        for (int iz = 0; iz < nz; iz++) {
            float rowOff = (iz & 1) == 1 ? 0.5f : 0f;
            float bz = (iz - nzCells * 0.5f) * cellZ;
            for (int ix = 0; ix < nx; ix++) {
                int i = iz * nx + ix;
                float bx = (ix + rowOff - resolution * 0.5f - 0.25f) * cellSize;
                baseXz[i] = new Vector2(bx, bz);
                if (maxJitter > 0f && ix > 0 && iz > 0 && ix < nx - 1 && iz < nz - 1) {
                    float ang = (float)r0.NextDouble() * Mathf.PI * 2f;
                    float rad = Mathf.Sqrt((float)r0.NextDouble()) * maxJitter * cellSize;
                    xz[i] = new Vector2(bx + Mathf.Cos(ang) * rad, bz + Mathf.Sin(ang) * rad);
                } else {
                    xz[i] = baseXz[i];
                }
            }
        }

        BuildHeights();
        ComputeRidgeCurvature();
        BuildHydrology();
        ApplyHeightJitter();
        ComputeSlopes();
        ComputeRidgeCurvature();
        ComputeSnowSlopeField();
        ComputeSteepDistanceField();
        rng = new System.Random(seed + 1);

        var result = new BuildResult();
        result.terrainMesh = BuildTerrainMesh();
        result.waterMesh = BuildWaterMesh();
        BuildTrees(out result.combinedTreesMesh, out result.combinedTreesColliderMesh);
        result.combinedGrassMesh = BuildGrassMesh();
        return result;
    }

    // ================= ノイズ・座標 =================
    float Fbm(float x, float z, int salt, float freq, int oct) {
        Vector2 o = offs[salt];
        float a = 1f, sum = 0f, norm = 0f;
        for (int i = 0; i < oct; i++) {
            sum += a * Mathf.PerlinNoise(x * freq + o.x, z * freq + o.y);
            norm += a;
            a *= 0.5f;
            freq *= 2f;
        }
        return sum / norm;
    }

    static float Smooth(float a, float b, float x) {
        if (Mathf.Approximately(a, b)) return x >= b ? 1f : 0f;
        float t = Mathf.Clamp01((x - a) / (b - a));
        return t * t * (3f - 2f * t);
    }

    Vector3 Pos(int i, float y) {
        return new Vector3(xz[i].x, y, xz[i].y);
    }

    int Nb(int i, int k) {
        int ix = i % nx;
        int iz = i / nx;
        bool odd = (iz & 1) == 1;
        int x = ix + (odd ? OddDX[k] : EvenDX[k]);
        int z = iz + (odd ? OddDZ[k] : EvenDZ[k]);
        if (x < 0 || z < 0 || x >= nx || z >= nz) return -1;
        return z * nx + x;
    }

    // ================= 高さ =================
    void BuildHeights() {
        int n = nx * nz;
        H = new float[n];
        mask = new float[n];
        bottomY = new float[n];
        inside = new bool[n];
        mountain = new float[n];
        var rawM = new float[n];

        for (int iz = 0; iz < nz; iz++) {
            for (int ix = 0; ix < nx; ix++) {
                int i = iz * nx + ix;
                float px = xz[i].x / half;
                float pz = xz[i].y / half;
                float r = Mathf.Sqrt(px * px + pz * pz);
                float raw = 1f - (r * 1.05f + (Fbm(px, pz, 0, 1.3f, 3) - 0.5f) * 2f * outlineNoise);
                if (ix == 0 || iz == 0 || ix == nx - 1 || iz == nz - 1) raw = -1f;
                rawM[i] = raw;
                inside[i] = raw > 0f;
                mask[i] = Mathf.Clamp01(raw);
            }
        }

        // 外周の境界頂点を輪郭のゼロ交差付近へ引き寄せ、水平な張り出し(バリ)をなくす
        for (int i = 0; i < n; i++) {
            if (inside[i]) continue;
            Vector2 sum = Vector2.zero;
            int cnt = 0;
            for (int k = 0; k < 6; k++) {
                int nb = Nb(i, k);
                if (nb < 0 || !inside[nb]) continue;
                float t = Mathf.Clamp(rawM[nb] / (rawM[nb] - rawM[i]), 0.08f, 0.35f);
                sum += Vector2.Lerp(xz[nb], xz[i], t);
                cnt++;
            }
            if (cnt > 0) xz[i] = sum / cnt;
        }

        float meterCycle = Mathf.Clamp(half * 0.28f, 110f, 220f);

        for (int i = 0; i < n; i++) {
            if (!inside[i]) {
                H[i] = 0f;
                bottomY[i] = 0f;
                mountain[i] = 0f;
                continue;
            }

            float px = xz[i].x / half;
            float pz = xz[i].y / half;

            // ドメインワープ
            float wx = px + (Fbm(px, pz, 5, 1.4f, 3) - 0.5f) * warpAmount;
            float wz = pz + (Fbm(px + 7.3f, pz - 3.1f, 5, 1.4f, 3) - 0.5f) * warpAmount;
            float wxM = xz[i].x / meterCycle + (Fbm(px, pz, 5, 1.4f, 2) - 0.5f) * warpAmount * 0.7f;
            float wzM = xz[i].y / meterCycle + (Fbm(px + 7.3f, pz - 3.1f, 5, 1.4f, 2) - 0.5f) * warpAmount * 0.7f;

            // 平原には規模感のある穏やかな起伏を付け、山あいは険しく起伏のある山岳・渓谷を合成
            float detail = Fbm(wx, wz, 2, 2.8f, 5);
            float broadPlains = Fbm(wx, wz, 2, 2.2f, 2) - 0.5f;
            float rollingHills = Fbm(wxM + 3.1f, wzM - 2.3f, 9, 1.0f, 2) - 0.5f;
            float rawPlains = (broadPlains * 0.50f + rollingHills * 0.50f) * 7.8f;
            float gentlePlains = rawPlains / (1f + Mathf.Abs(rawPlains) * 0.35f);
            float ridge = 1f - Mathf.Abs(2f * Fbm(wx, wz, 3, 1.85f, 4) - 1f);
            float mtRaw = Fbm(px * 0.9f + 0.15f, pz * 0.9f - 0.10f, 1, 0.95f, 2);
            float mtMask = Smooth(0.48f, 0.73f, mtRaw);
            mountain[i] = mtMask;

            // 平原エリアは大きなうねりを素直に反映し、山際から裾野・険しい山岳へ立ち上げる
            float mountainBlend = Smooth(0.42f, 0.70f, mtRaw);
            float plainsWave = Mathf.Lerp(gentlePlains, (detail - 0.5f) * 2.8f, mountainBlend) * plainsAmp;
            float foothills = Smooth(0.43f, 0.58f, mtRaw) * (mountainAmp * 0.20f);
            float peak = mtMask * (detail * mountainAmp * 0.32f + Mathf.Pow(ridge, 1.60f) * mountainAmp * 0.82f);
            float h = baseHeight + plainsWave + foothills + peak;

            // 渓谷: 山あい・高台を中心に深く険しく分断し、平坦な平原は削らない
            float band = Mathf.Abs(Fbm(wx, wz, 4, 1.45f, 3) - 0.5f);
            float cm = 1f - Smooth(canyonWidth * 0.35f, canyonWidth, band);
            h -= cm * canyonDepth * Smooth(0.12f, 0.42f, mtMask);
            h = Mathf.Max(h, 2.0f);

            // 縁は崖の厚みを保ったまま急に落とす
            float m = mask[i];
            float cliff = Mathf.Lerp(0.38f, 1f, Mathf.Pow(Mathf.Clamp01(m / Mathf.Max(0.01f, cliffWidth)), 0.52f));
            H[i] = h * cliff;

            // 島の下側(端の垂直崖から滑らかに移行して深い逆円錐へつながる起伏)
            float rock = Fbm(px, pz, 6, 3f, 3);
            float inwardMeters = Mathf.Max(0f, m * half);
            float taperScale = Mathf.Clamp(bottomDepth * 0.24f, 12f, Mathf.Max(55f, half * 0.22f));
            float rimCurve = 1f - Mathf.Exp(-inwardMeters / taperScale);
            float coreCone = Mathf.Pow(m, 0.72f);
            float underProfile = rimCurve * 0.44f + coreCone * 0.56f;
            bottomY[i] = -bottomDepth * underProfile * (0.48f + 0.85f * rock);
        }
    }

    float SafeBedFloor(int i) {
        if (mask[i] < cliffWidth * 0.65f) return 0.5f;
        float deepCap = -Mathf.Clamp(bottomDepth * 0.40f, 4f, Mathf.Max(60f, bottomDepth * 0.36f));
        return Mathf.Max(bottomY[i] + 6.0f, deepCap);
    }

    // ================= 広い川・深い土手・湖 =================
    void BuildHydrology() {
        int n = nx * nz;
        F = new float[n];
        riverW = new float[n];
        centerRiver = new bool[n];
        river = new bool[n];
        bankSlopeFlag = new bool[n];
        snowZone = new bool[n];
        snowBuffer = new bool[n];
        for (int i = 0; i < n; i++) {
            if (!inside[i]) continue;
            float snowThresh = ComputeSnowThresholdAt(xz[i].x, xz[i].y, Mathf.Min(0f, ridgeCurv[i]));
            if (H[i] >= snowThresh - 6.0f) {
                snowZone[i] = true;
            }
        }
        for (int i = 0; i < n; i++) {
            if (!inside[i]) continue;
            if (snowZone[i]) {
                snowBuffer[i] = true;
                continue;
            }
            for (int k = 0; k < 6; k++) {
                int nb = Nb(i, k);
                if (nb >= 0 && snowZone[nb]) {
                    snowBuffer[i] = true;
                    break;
                }
            }
        }

        lakeId = new int[n];
        lakeLevels = new List<float> { 0f };
        lakeFrozen = new List<bool> { false };
        shore = new float[n];
        for (int i = 0; i < n; i++) riverW[i] = float.NaN;

        // Priority-Flood: 微小勾配のみで窪地を埋めた面 F を作る
        var closed = new bool[n];
        var pq = new SortedSet<(float, int)>();
        for (int i = 0; i < n; i++) {
            if (inside[i]) continue;
            closed[i] = true;
            F[i] = H[i];
            for (int k = 0; k < 6; k++) {
                int nb = Nb(i, k);
                if (nb >= 0 && inside[nb]) {
                    pq.Add((F[i], i));
                    break;
                }
            }
        }
        while (pq.Count > 0) {
            var t = pq.Min;
            pq.Remove(t);
            int c = t.Item2;
            for (int k = 0; k < 6; k++) {
                int nb = Nb(c, k);
                if (nb < 0 || closed[nb]) continue;
                closed[nb] = true;
                F[nb] = Mathf.Max(H[nb], F[c] + 0.0001f);
                pq.Add((F[nb], nb));
            }
        }

        // 湖の抽出と平坦化(実標高 H を基準にして窪地の位置を保つ)
        var dep = new bool[n];
        for (int i = 0; i < n; i++) dep[i] = inside[i] && (F[i] - H[i] > 0.02f);

        var visited = new bool[n];
        var stack = new Stack<int>();
        var comp = new List<int>();
        for (int i = 0; i < n; i++) {
            if (!dep[i] || visited[i]) continue;
            comp.Clear();
            visited[i] = true;
            stack.Push(i);
            float maxDepth = 0f;
            float minRimH = float.MaxValue;
            float sumMt = 0f;
            while (stack.Count > 0) {
                int c = stack.Pop();
                comp.Add(c);
                sumMt += mountain[c];
                maxDepth = Mathf.Max(maxDepth, F[c] - H[c]);
                for (int k = 0; k < 6; k++) {
                    int nb = Nb(c, k);
                    if (nb < 0) continue;
                    if (dep[nb]) {
                        if (!visited[nb]) {
                            visited[nb] = true;
                            stack.Push(nb);
                        }
                    } else {
                        minRimH = Mathf.Min(minRimH, H[nb]);
                    }
                }
            }
            float avgMt = comp.Count > 0 ? sumMt / comp.Count : 0f;
            float plainsExtraDepth = Mathf.Lerp(plainsAmp * 0.34f, 0f, Smooth(0f, 0.25f, avgMt));
            if (lakeMinDepth >= 500f || maxDepth <= lakeMinDepth + plainsExtraDepth || comp.Count < 3) continue;

            int id = lakeLevels.Count;
            float level = minRimH;
            lakeLevels.Add(level);
            float sumDepth = 0f;
            float sumSnowThresh = 0f;
            int snowCellCnt = 0;
            foreach (int c in comp) {
                lakeId[c] = id;
                sumDepth += Mathf.Max(0.25f, level - H[c]);
                sumSnowThresh += ComputeSnowThresholdAt(xz[c].x, xz[c].y, ridgeCurv[c]);
                if (snowZone[c]) snowCellCnt++;
            }
            float avgLakeSnowThresh = sumSnowThresh / comp.Count;
            // 積雪帯より下の小さな水たまり・岩凹みが単独で氷化して白い斑点にならないよう、小規模湖は雪線・積雪割合を厳密に見る
            bool isFrozen = comp.Count < 24
                ? (snowCellCnt * 3 >= comp.Count * 2 && level >= avgLakeSnowThresh && level >= snowLine - 6f)
                : (snowCellCnt * 3 >= comp.Count || level >= Mathf.Max(avgLakeSnowThresh, snowLine) + 22f);
            lakeFrozen.Add(isFrozen);
            float avgDepth = sumDepth / comp.Count;
            float sizeScale = Mathf.Lerp(0.72f, 1.38f, Smooth(4f, 140f, comp.Count));
            float targetMaxDepth = Mathf.Clamp(
                Mathf.Max(lakeDepth * sizeScale, avgDepth * 1.10f + lakeDepth * 0.40f),
                2.0f, 34f);

            // 岸からの距離ステップ(0:岸沿い, 1:沖側, 2+:最深部)を計測し、すり鉢〜深い湖盆を形成する
            var ringDist = new Dictionary<int, int>(comp.Count);
            var ringQueue = new Queue<int>();
            foreach (int c in comp) {
                bool onEdge = false;
                for (int k = 0; k < 6; k++) {
                    int nb = Nb(c, k);
                    if (nb < 0 || lakeId[nb] != id) {
                        onEdge = true;
                        break;
                    }
                }
                if (onEdge) {
                    ringDist[c] = 0;
                    ringQueue.Enqueue(c);
                }
            }
            while (ringQueue.Count > 0) {
                int cur = ringQueue.Dequeue();
                int nextD = ringDist[cur] + 1;
                if (nextD > 3) continue;
                for (int k = 0; k < 6; k++) {
                    int nb = Nb(cur, k);
                    if (nb >= 0 && lakeId[nb] == id && !ringDist.ContainsKey(nb)) {
                        ringDist[nb] = nextD;
                        ringQueue.Enqueue(nb);
                    }
                }
            }

            float bedScale = Mathf.Clamp(half, 220f, 850f);
            foreach (int c in comp) {
                int ring = ringDist.TryGetValue(c, out int rd) ? rd : 3;
                float bx = xz[c].x / bedScale;
                float bz = xz[c].y / bedScale;
                float wx = bx + (Fbm(bx + 2.3f, bz - 1.7f, 4, 2.8f, 2) - 0.5f) * 0.16f;
                float wz = bz + (Fbm(bx - 3.9f, bz + 4.1f, 5, 2.8f, 2) - 0.5f) * 0.16f;
                float bedWave = (Fbm(wx, wz, 13, 5.8f, 3) - 0.5f) * 2f;
                float siltBar = Smooth(0.55f, 0.78f, Fbm(wx + 5.1f, wz - 2.8f, 14, 4.6f, 2));
                float trenchNoise = Fbm(wx * 1.35f - 1.9f, wz * 1.35f + 3.4f, 15, 7.0f, 3);
                float ridgeSharp = 1f - Mathf.Abs(trenchNoise * 2f - 1f);
                float steepPit = Mathf.Pow(Smooth(0.45f, 0.92f, ridgeSharp), 1.4f);

                // 堆積土の浅瀬(siltBar)、草原様の緩やかな起伏(bedWave)、急峻な深部(steepPit)を組み合わせる
                float interiorFrac = Mathf.Clamp(0.76f + bedWave * 0.28f - siltBar * 0.44f + steepPit * 0.60f, 0.24f, 1.55f);
                float shoreFrac = 0.34f + Mathf.Max(0f, bedWave) * 0.10f;
                float ringWeight = ring == 0 ? 0f : (ring == 1 ? 0.52f : (ring == 2 ? 0.86f : 1.0f));
                float depthFrac = Mathf.Lerp(shoreFrac, interiorFrac, ringWeight);

                float minSubmerge = ring == 0
                    ? Mathf.Clamp(targetMaxDepth * 0.22f, 0.85f, 1.8f)
                    : Mathf.Clamp(targetMaxDepth * 0.24f, 1.35f, 3.2f);
                float bedFloor = SafeBedFloor(c);
                float desiredY = level - targetMaxDepth * depthFrac;
                float target = ring == 0
                    ? Mathf.Min(H[c], Mathf.Lerp(H[c], desiredY, 0.78f))
                    : Mathf.Lerp(H[c], desiredY, 0.94f);
                H[c] = Mathf.Clamp(target, bedFloor, Mathf.Max(bedFloor, level - minSubmerge));
            }
        }

        // 流路探索用の高さ配列 flowH(平坦域のみ蛇行用の緩い谷バイアスを乗せ、直線化を防ぐ)
        var flowH = new float[n];
        for (int i = 0; i < n; i++) {
            flowH[i] = H[i];
            if (!inside[i] || lakeId[i] > 0) continue;
            float plainsW = Mathf.Clamp01(1f - mountain[i] / 0.52f);
            float rimFade = Smooth(0f, cliffWidth * 1.35f, mask[i]);
            float meanderW = plainsW * rimFade;
            if (meanderW <= 0.001f) continue;

            float px = baseXz[i].x / half;
            float pz = baseXz[i].y / half;
            float wx = px + (Fbm(px, pz, 12, 2.2f, 2) - 0.5f) * 0.28f;
            float wz = pz + (Fbm(px + 4.7f, pz - 2.9f, 13, 2.2f, 2) - 0.5f) * 0.28f;
            float macroValley = Mathf.Abs(Fbm(wx, wz, 14, 3.4f, 3) - 0.5f) * 2f;
            float medWave = Fbm(baseXz[i].x * 0.013f, baseXz[i].y * 0.013f, 15, 1.0f, 2);
            float bias = (macroValley * 0.60f + medWave * 0.40f - 0.5f) * 4.8f * meanderW;
            flowH[i] = Mathf.Max(0.1f, H[i] + bias);
        }

        // 空間ゆらぎ付きの微小勾配で Priority-Flood し、平坦域での格子軸ロックを解く
        var flowF = new float[n];
        System.Array.Clear(closed, 0, n);
        pq.Clear();
        for (int i = 0; i < n; i++) {
            if (inside[i]) continue;
            closed[i] = true;
            flowF[i] = flowH[i];
            for (int k = 0; k < 6; k++) {
                int nb = Nb(i, k);
                if (nb >= 0 && inside[nb]) {
                    pq.Add((flowF[i], i));
                    break;
                }
            }
        }
        while (pq.Count > 0) {
            var t = pq.Min;
            pq.Remove(t);
            int c = t.Item2;
            for (int k = 0; k < 6; k++) {
                int nb = Nb(c, k);
                if (nb < 0 || closed[nb]) continue;
                closed[nb] = true;
                float stepEps = 0.00015f + 0.00045f * Fbm(baseXz[nb].x / half, baseXz[nb].y / half, 9, 4.5f, 2);
                flowF[nb] = Mathf.Max(flowH[nb], flowF[c] + stepEps);
                pq.Add((flowF[nb], nb));
            }
        }

        // 流れる向き(実距離あたり最大勾配)と流量を構築
        var down = new int[n];
        var acc = new int[n];
        var mtAcc = new int[n];
        var order = new List<int>(n);
        for (int i = 0; i < n; i++) {
            down[i] = -1;
            if (!inside[i]) continue;
            float bestS = 0f;
            for (int k = 0; k < 6; k++) {
                int nb = Nb(i, k);
                if (nb < 0 || flowF[nb] >= flowF[i]) continue;
                float stepDist = Vector2.Distance(xz[i], xz[nb]);
                float s = (flowF[i] - flowF[nb]) / Mathf.Max(0.1f, stepDist);
                if (s > bestS) {
                    bestS = s;
                    down[i] = nb;
                }
            }
        }
        BuildTopologicalOrder(down, order);
        ComputeAccumulation(down, acc, mtAcc, order);

        // 根拠ある水源(湖の流出・山地/雪解け水源)からのみ川を通し、並走川を合流・整形
        bool[] lakeDrains;
        int[] lakeCellCnt;
        RefreshCenterRivers(down, acc, mtAcc, flowF, order, out lakeDrains, out lakeCellCnt);
        MergeParallelRivers(down, acc, mtAcc, order, flowF, 2);
        MergeParallelRivers(down, acc, mtAcc, order, flowF, 3);
        RefreshCenterRivers(down, acc, mtAcc, flowF, order, out lakeDrains, out lakeCellCnt);
        CleanRiverTopology(down, acc, lakeDrains, order);
        PruneSourcelessRivers(down, mtAcc, lakeDrains, order);
        RelaxRiverAndBankPositions(down);

        // 中心線の水面高と深さを決定し、そこから「広い川幅・深い川底・深い土手」へ拡張して彫り込む
        int[] riverDischarge = BuildRiverDischarge(down, acc, mtAcc, lakeCellCnt, order);
        CarveWideRiversAndLevees(down, riverDischarge, order);

        // 水辺からの距離(砂のグラデーションと高さばらつき抑制用)
        var dist = new int[n];
        var bfs = new Queue<int>();
        for (int i = 0; i < n; i++) {
            if (lakeId[i] > 0 || river[i]) {
                dist[i] = 0;
                bfs.Enqueue(i);
            } else {
                dist[i] = -1;
            }
        }
        while (bfs.Count > 0) {
            int c = bfs.Dequeue();
            if (dist[c] >= 4) continue;
            for (int k = 0; k < 6; k++) {
                int nb = Nb(c, k);
                if (nb < 0 || !inside[nb] || dist[nb] >= 0) continue;
                dist[nb] = dist[c] + 1;
                bfs.Enqueue(nb);
            }
        }
        for (int i = 0; i < n; i++) {
            if (dist[i] >= 0) shore[i] = Smooth(3.5f, 0f, dist[i]);
        }
    }

    bool AreNeighbors(int a, int b) {
        for (int k = 0; k < 6; k++) {
            if (Nb(a, k) == b) return true;
        }
        return false;
    }

    bool HasAdjacentFrozenLake(int i) {
        for (int k = 0; k < 6; k++) {
            int nb = Nb(i, k);
            if (nb >= 0 && IsLakeFrozen(lakeId[nb])) return true;
        }
        return false;
    }

    bool TryGetMaxAdjacentLakeLevel(int i, out float maxLevel) {
        return TryGetMaxAdjacentLakeLevelFiltered(i, false, out maxLevel);
    }

    bool TryGetMaxAdjacentUnfrozenLakeLevel(int i, out float maxLevel) {
        return TryGetMaxAdjacentLakeLevelFiltered(i, true, out maxLevel);
    }

    bool TryGetMaxAdjacentLakeLevelFiltered(int i, bool unfrozenOnly, out float maxLevel) {
        maxLevel = float.MinValue;
        bool found = false;
        for (int k = 0; k < 6; k++) {
            int nb = Nb(i, k);
            if (nb < 0) continue;
            int lid = lakeId[nb];
            if (lid <= 0 || (unfrozenOnly && IsLakeFrozen(lid))) continue;
            maxLevel = Mathf.Max(maxLevel, lakeLevels[lid]);
            found = true;
        }
        return found;
    }

    void BuildTopologicalOrder(int[] down, List<int> order) {
        int n = nx * nz;
        order.Clear();
        var inDeg = new int[n];
        for (int i = 0; i < n; i++) {
            if (!inside[i]) continue;
            int d = down[i];
            if (d >= 0 && inside[d]) inDeg[d]++;
        }
        var q = new Queue<int>(Mathf.Max(64, n / 8));
        for (int i = 0; i < n; i++) {
            if (inside[i] && inDeg[i] == 0) q.Enqueue(i);
        }
        while (q.Count > 0) {
            int c = q.Dequeue();
            order.Add(c);
            int d = down[c];
            if (d >= 0 && inside[d]) {
                inDeg[d]--;
                if (inDeg[d] == 0) q.Enqueue(d);
            }
        }
    }

    void ComputeAccumulation(int[] down, int[] acc, int[] mtAcc, List<int> order) {
        int n = nx * nz;
        // accは非積雪域、mtAccは雪域および明確な山地(mountain >= 0.22)からの集水を表す
        for (int i = 0; i < n; i++) {
            acc[i] = (inside[i] && !snowZone[i]) ? 1 : 0;
            mtAcc[i] = (inside[i] && (snowZone[i] || mountain[i] >= 0.22f)) ? 1 : 0;
        }
        foreach (int i in order) {
            int d = down[i];
            if (d < 0 || !inside[d]) continue;
            mtAcc[d] += mtAcc[i];
            if (!snowZone[d]) acc[d] += acc[i];
        }
    }

    float RiverAreaScale() {
        float r = resolution / 160f;
        return Mathf.Max(0.25f, r * r);
    }

    int GetMountainSpringThreshold() {
        if (riverThreshold >= 500000) return int.MaxValue;
        return Mathf.Max(8, Mathf.RoundToInt(riverThreshold * 0.38f * RiverAreaScale()));
    }

    void ComputeLakeOutlets(int[] down, int[] acc, int[] mtAcc, float[] flowF,
            out int[] lakeCellCnt, out int[] lakeBestOutlet) {
        int n = nx * nz;
        int lakeCount = lakeLevels.Count;
        lakeCellCnt = new int[lakeCount];
        lakeBestOutlet = new int[lakeCount];
        var bestScore = new float[lakeCount];
        for (int id = 0; id < lakeCount; id++) {
            lakeBestOutlet[id] = -1;
            bestScore[id] = float.MinValue;
        }

        for (int i = 0; i < n; i++) {
            if (!inside[i] || lakeId[i] <= 0) continue;
            int id = lakeId[i];
            lakeCellCnt[id]++;
            int d = down[i];
            if (d < 0 || !inside[d] || lakeId[d] > 0 || snowBuffer[d]) continue;
            float score = (acc[i] + mtAcc[i]) * 1000f - flowF[d];
            if (score > bestScore[id]) {
                bestScore[id] = score;
                lakeBestOutlet[id] = d;
            }
        }
    }

    void TraceRiverDownstream(int start, int[] down, int[] lakeBestOutlet, bool[] lakeDrains, Queue<int> lakeQueue) {
        int n = nx * nz;
        int cur = start;
        var path = new List<int>(32);
        bool reachedSink = false;
        for (int step = 0; step < n; step++) {
            if (cur < 0 || !inside[cur]) {
                reachedSink = path.Count > 0;
                break;
            }
            if (snowBuffer[cur]) break;
            if (lakeId[cur] > 0) {
                int hitLake = lakeId[cur];
                if (!IsLakeFrozen(hitLake)) {
                    reachedSink = true;
                    if (lakeBestOutlet[hitLake] >= 0 && !lakeDrains[hitLake]) {
                        lakeDrains[hitLake] = true;
                        lakeQueue.Enqueue(hitLake);
                    }
                }
                break;
            }
            if (centerRiver[cur]) {
                reachedSink = true;
                break;
            }
            centerRiver[cur] = true;
            path.Add(cur);
            cur = down[cur];
        }
        // 島の端や既存水系・不凍湖へ合流できずに雪線等で途切れる極短な枝線は戻す
        if (!reachedSink && path.Count <= 5) {
            for (int i = 0; i < path.Count; i++) {
                centerRiver[path[i]] = false;
            }
        }
    }

    void RefreshCenterRivers(int[] down, int[] acc, int[] mtAcc, float[] flowF, List<int> order,
            out bool[] lakeDrains, out int[] lakeCellCnt) {
        int n = nx * nz;
        System.Array.Clear(centerRiver, 0, n);
        ComputeLakeOutlets(down, acc, mtAcc, flowF, out lakeCellCnt, out int[] lakeBestOutlet);

        int lakeCount = lakeLevels.Count;
        lakeDrains = new bool[lakeCount];
        if (riverThreshold >= 500000) return;

        var lakeQueue = new Queue<int>();
        int mtSpringThresh = GetMountainSpringThreshold();
        int minLakeRiverCells = Mathf.Max(3, Mathf.RoundToInt((1.5f + riverThreshold * 0.085f) * RiverAreaScale()));

        // 1. 山地・雪解け域から湧出する明確な山岳河川だけをトレース
        for (int i = 0; i < n; i++) {
            if (!inside[i] || snowBuffer[i] || lakeId[i] > 0) continue;
            if (mountain[i] >= 0.12f && mtAcc[i] >= mtSpringThresh) {
                TraceRiverDownstream(i, down, lakeBestOutlet, lakeDrains, lakeQueue);
            }
        }

        // 2. 一定規模以上の不凍湖(および川が流入して溢れる湖)の流出口から川を流す
        for (int id = 1; id < lakeCount; id++) {
            if (!IsLakeFrozen(id) && lakeBestOutlet[id] >= 0 && lakeCellCnt[id] >= minLakeRiverCells && !lakeDrains[id]) {
                lakeDrains[id] = true;
                lakeQueue.Enqueue(id);
            }
        }
        while (lakeQueue.Count > 0) {
            int lid = lakeQueue.Dequeue();
            int outlet = lakeBestOutlet[lid];
            if (outlet >= 0 && !snowBuffer[outlet]) {
                TraceRiverDownstream(outlet, down, lakeBestOutlet, lakeDrains, lakeQueue);
            }
        }

        PruneSourcelessRivers(down, mtAcc, lakeDrains, order);
    }

    int[] BuildRiverDischarge(int[] down, int[] acc, int[] mtAcc, int[] lakeCellCnt, List<int> order) {
        int n = nx * nz;
        var discharge = new int[n];
        for (int i = 0; i < n; i++) {
            if (centerRiver[i]) discharge[i] = Mathf.Max(acc[i], mtAcc[i]);
        }
        for (int i = 0; i < n; i++) {
            if (!inside[i] || lakeId[i] <= 0 || IsLakeFrozen(lakeId[i])) continue;
            int d = down[i];
            if (d >= 0 && centerRiver[d]) {
                discharge[d] = Mathf.Max(discharge[d], acc[i] + mtAcc[i] + lakeCellCnt[lakeId[i]] * 3);
            }
        }
        foreach (int r in order) {
            if (!centerRiver[r]) continue;
            int dn = down[r];
            if (dn >= 0 && centerRiver[dn]) {
                discharge[dn] = Mathf.Max(discharge[dn], discharge[r] + 1);
            }
        }
        return discharge;
    }

    bool CanReachOnDown(int start, int a, int b, int c, int[] down) {
        int cur = start;
        int limit = nx * nz;
        for (int s = 0; cur >= 0 && s < limit; s++) {
            if (cur == a || cur == b || cur == c) return true;
            cur = down[cur];
        }
        return false;
    }

    bool SharesDownstreamSoon(int a, int b, int[] down, int maxSteps) {
        int[] traceA = new int[8];
        int lenA = 0;
        int lakeA = 0;
        int cur = a;
        for (int s = 0; s <= maxSteps && cur >= 0 && lenA < traceA.Length; s++) {
            traceA[lenA++] = cur;
            if (lakeId[cur] > 0) {
                lakeA = lakeId[cur];
                break;
            }
            cur = down[cur];
        }
        cur = b;
        for (int s = 0; s <= maxSteps && cur >= 0; s++) {
            for (int j = 0; j < lenA; j++) {
                if (traceA[j] == cur) return true;
            }
            if (lakeA > 0 && lakeId[cur] == lakeA) return true;
            if (lakeId[cur] > 0) break;
            cur = down[cur];
        }
        return false;
    }

    void MergeParallelRivers(int[] down, int[] acc, int[] mtAcc, List<int> order, float[] flowF, int maxHops) {
        int n = nx * nz;
        var centerInDeg = new int[n];
        for (int i = 0; i < n; i++) {
            if (!inside[i]) continue;
            int d = down[i];
            if (d >= 0 && centerRiver[d] && (centerRiver[i] || lakeId[i] > 0)) centerInDeg[d]++;
        }

        var visitedStamp = new int[n];
        var prevNode = new int[n];
        var hopDist = new int[n];
        var bfsQ = new Queue<int>(64);
        var pathNodes = new List<int>(4);
        int stamp = 0;
        float maxDistXZ = cellSize * (maxHops + 0.35f);
        float maxBridgeClimb = Mathf.Max(riverBankDepth * 1.35f, 4.0f);
        bool mergedAny = false;

        foreach (int u in order) {
            if (!centerRiver[u]) continue;
            int oldD = down[u];
            if (oldD < 0 || !inside[oldD]) continue;

            stamp++;
            bfsQ.Clear();
            visitedStamp[u] = stamp;
            prevNode[u] = -1;
            hopDist[u] = 0;
            bfsQ.Enqueue(u);

            int bestTarget = -1;
            int bestFrom = -1;
            int bestHops = int.MaxValue;
            float bestScore = float.MinValue;

            while (bfsQ.Count > 0) {
                int c = bfsQ.Dequeue();
                int nextHop = hopDist[c] + 1;
                if (nextHop > maxHops) continue;

                for (int k = 0; k < 6; k++) {
                    int nb = Nb(c, k);
                    if (nb < 0 || !inside[nb] || lakeId[nb] > 0 || snowBuffer[nb] || visitedStamp[nb] == stamp) continue;

                    if (centerRiver[nb]) {
                        visitedStamp[nb] = stamp;
                        if (nb == oldD) continue;
                        if (flowF[nb] >= flowF[u] - 0.0005f) continue;

                        float distXZ = Vector2.Distance(xz[u], xz[nb]);
                        if (distXZ > maxDistXZ) continue;
                        if (nextHop >= 2 && acc[nb] < acc[u] * 0.6f && mask[u] > cliffWidth * 3f) continue;
                        if (SharesDownstreamSoon(u, nb, down, 7)) continue;

                        int m1 = c != u ? c : -1;
                        int m2 = m1 >= 0 && prevNode[c] != u ? prevNode[c] : -1;
                        if (H[nb] > H[u] + maxBridgeClimb) continue;
                        if (CanReachOnDown(nb, u, m1, m2, down)) continue;

                        float score = -nextHop * 1000f + acc[nb] - distXZ * 5f;
                        if (nextHop < bestHops || (nextHop == bestHops && score > bestScore)) {
                            bestHops = nextHop;
                            bestScore = score;
                            bestTarget = nb;
                            bestFrom = c;
                        }
                    } else if (nextHop < maxHops) {
                        if (H[nb] > H[u] + maxBridgeClimb) continue;
                        visitedStamp[nb] = stamp;
                        prevNode[nb] = c;
                        hopDist[nb] = nextHop;
                        bfsQ.Enqueue(nb);
                    }
                }
            }

            if (bestTarget < 0) continue;

            pathNodes.Clear();
            int curP = bestFrom;
            while (curP >= 0 && curP != u) {
                pathNodes.Add(curP);
                curP = prevNode[curP];
            }
            int prevChain = u;
            for (int pIdx = pathNodes.Count - 1; pIdx >= 0; pIdx--) {
                int mid = pathNodes[pIdx];
                down[prevChain] = mid;
                if (!centerRiver[mid]) {
                    centerRiver[mid] = true;
                    centerInDeg[mid] = 1;
                } else {
                    centerInDeg[mid]++;
                }
                prevChain = mid;
            }
            down[prevChain] = bestTarget;
            centerInDeg[bestTarget]++;
            mergedAny = true;

            int tail = oldD;
            while (tail >= 0 && centerRiver[tail]) {
                centerInDeg[tail]--;
                if (centerInDeg[tail] > 0) break;
                centerRiver[tail] = false;
                tail = down[tail];
            }
        }

        if (mergedAny) {
            BuildTopologicalOrder(down, order);
            ComputeAccumulation(down, acc, mtAcc, order);
            RefreshCenterRivers(down, acc, mtAcc, flowF, order, out _, out _);
        }
    }

    void PruneSourcelessRivers(int[] down, int[] mtAcc, bool[] lakeDrains, List<int> order) {
        int n = nx * nz;
        var hasUp = new bool[n];
        var lakeFed = new bool[n];
        for (int i = 0; i < n; i++) {
            int d = down[i];
            if (d < 0 || !centerRiver[d]) continue;
            if (centerRiver[i]) {
                hasUp[d] = true;
            } else if (lakeId[i] > 0 && !IsLakeFrozen(lakeId[i])
                    && (lakeDrains == null || lakeDrains[lakeId[i]])) {
                lakeFed[d] = true;
            }
        }

        int mtSpringThresh = GetMountainSpringThreshold();
        var valid = new bool[n];
        var hasLakeAncestor = new bool[n];
        foreach (int i in order) {
            if (!centerRiver[i]) continue;
            if (lakeFed[i]) {
                valid[i] = true;
                hasLakeAncestor[i] = true;
            } else if (!hasUp[i] && !snowBuffer[i] && mountain[i] >= 0.12f && mtAcc[i] >= mtSpringThresh) {
                valid[i] = true;
            }
            if (!valid[i]) continue;
            int d = down[i];
            if (d >= 0 && centerRiver[d]) {
                valid[d] = true;
                if (hasLakeAncestor[i]) hasLakeAncestor[d] = true;
            }
        }

        // 非湖沼の極短孤立断片(合流せず3セル以下で終わるもの)も除去する
        var inValidDeg = new int[n];
        for (int i = 0; i < n; i++) {
            if (!valid[i]) continue;
            int d = down[i];
            if (d >= 0 && valid[d]) inValidDeg[d]++;
        }
        var chainBuf = new List<int>(8);
        for (int s = 0; s < n; s++) {
            if (!valid[s] || inValidDeg[s] != 0 || lakeFed[s]) continue;
            chainBuf.Clear();
            int cur = s;
            bool joined = false;
            while (cur >= 0 && valid[cur] && chainBuf.Count <= 4) {
                if (cur != s && inValidDeg[cur] > 1) {
                    joined = true;
                    break;
                }
                chainBuf.Add(cur);
                cur = down[cur];
            }
            if (!joined && chainBuf.Count <= 3) {
                foreach (int c in chainBuf) valid[c] = false;
            }
        }

        for (int i = 0; i < n; i++) {
            if (centerRiver[i] && !valid[i]) centerRiver[i] = false;
        }
    }

    void CleanRiverTopology(int[] down, int[] acc, bool[] lakeDrains, List<int> order) {
        int n = nx * nz;
        var inDeg = new int[n];
        var lakeFed = new bool[n];
        for (int i = 0; i < n; i++) {
            int dn = down[i];
            if (dn < 0 || !centerRiver[dn]) continue;
            if (centerRiver[i]) {
                inDeg[dn]++;
            } else if (lakeId[i] > 0 && !IsLakeFrozen(lakeId[i])
                    && (lakeDrains == null || lakeDrains[lakeId[i]])) {
                lakeFed[dn] = true;
            }
        }

        var stubs = new List<(int tailAcc, int merge, List<int> chain)>();
        for (int s = 0; s < n; s++) {
            if (!centerRiver[s] || inDeg[s] != 0 || lakeFed[s]) continue;
            var chain = new List<int> { s };
            int cur = down[s];
            while (cur >= 0 && centerRiver[cur] && inDeg[cur] == 1 && chain.Count < 3) {
                if (lakeFed[cur]) break;
                chain.Add(cur);
                cur = down[cur];
            }
            if (cur >= 0 && centerRiver[cur] && inDeg[cur] >= 2 && chain.Count <= 2) {
                stubs.Add((acc[chain[chain.Count - 1]], cur, chain));
            }
        }
        stubs.Sort((x, y) => x.tailAcc.CompareTo(y.tailAcc));
        foreach (var st in stubs) {
            if (!centerRiver[st.merge] || inDeg[st.merge] < 2) continue;
            if (st.tailAcc >= acc[st.merge] * 0.5f) continue;
            foreach (int c in st.chain) {
                centerRiver[c] = false;
                inDeg[c] = 0;
            }
            inDeg[st.merge]--;
        }

        for (int pass = 0; pass < 2; pass++) {
            foreach (int u in order) {
                if (!centerRiver[u]) continue;
                int v = down[u];
                if (v < 0 || !centerRiver[v] || inDeg[v] != 1 || lakeFed[v]) continue;
                int w = down[v];
                if (w < 0 || !centerRiver[w] || u == w || !AreNeighbors(u, w)) continue;
                centerRiver[v] = false;
                inDeg[v] = 0;
                down[u] = w;
            }
        }
    }

    void RelaxRiverAndBankPositions(int[] down) {
        int n = nx * nz;
        var inCnt = new int[n];
        var upNode = new int[n];
        for (int i = 0; i < n; i++) upNode[i] = -1;
        for (int i = 0; i < n; i++) {
            if (!inside[i] || !centerRiver[i]) continue;
            int dn = down[i];
            if (dn >= 0 && centerRiver[dn]) {
                inCnt[dn]++;
                upNode[dn] = i;
            }
        }

        for (int i = 0; i < n; i++) {
            if (!inside[i]) continue;
            if (centerRiver[i]) {
                xz[i] = Vector2.Lerp(xz[i], baseXz[i], 0.18f);
            } else if (lakeId[i] == 0) {
                for (int k = 0; k < 6; k++) {
                    int nb = Nb(i, k);
                    if (nb >= 0 && centerRiver[nb]) {
                        xz[i] = Vector2.Lerp(xz[i], baseXz[i], 0.20f);
                        break;
                    }
                }
            }
        }

        // 直線化を抑えつつ中心線の折れ目を滑らかな曲線にする
        var tmpXz = new Vector2[n];
        float maxShift = Mathf.Min(0.32f, Mathf.Max(0.22f, jitter)) * cellSize;
        float maxShiftSq = maxShift * maxShift;
        for (int pass = 0; pass < 2; pass++) {
            System.Array.Copy(xz, tmpXz, n);
            for (int i = 0; i < n; i++) {
                if (!inside[i] || !centerRiver[i] || inCnt[i] != 1) continue;
                int up = upNode[i];
                int dn = down[i];
                if (up < 0 || dn < 0 || !centerRiver[dn]) continue;
                Vector2 mid = (xz[up] + xz[dn]) * 0.5f;
                Vector2 smoothed = Vector2.Lerp(xz[i], mid, 0.38f);
                Vector2 offset = smoothed - baseXz[i];
                if (offset.sqrMagnitude > maxShiftSq) {
                    offset = offset.normalized * maxShift;
                }
                tmpXz[i] = baseXz[i] + offset;
            }
            System.Array.Copy(tmpXz, xz, n);
        }
    }

    // 広い川・深い川底・はっきりした土手(河岸段丘)を構築する
    void CarveWideRiversAndLevees(int[] down, int[] acc, List<int> order) {
        int n = nx * nz;
        bool hasAnyRiver = false;
        for (int i = 0; i < n; i++) {
            if (centerRiver[i]) {
                hasAnyRiver = true;
                break;
            }
        }
        if (!hasAnyRiver) return;

        var origH = (float[])H.Clone();
        var upRiver = new int[n];
        var bestUpAcc = new int[n];
        var inRiverCnt = new int[n];
        var tribCount = new int[n];
        for (int i = 0; i < n; i++) upRiver[i] = -1;
        for (int i = 0; i < n; i++) {
            if (!centerRiver[i]) continue;
            int dn = down[i];
            if (dn >= 0 && centerRiver[dn]) {
                inRiverCnt[dn]++;
                if (acc[i] > bestUpAcc[dn]) {
                    bestUpAcc[dn] = acc[i];
                    upRiver[dn] = i;
                }
            }
        }
        for (int i = 0; i < n; i++) {
            if (centerRiver[i] && inRiverCnt[i] == 0) tribCount[i] = 1;
        }
        foreach (int r in order) {
            if (!centerRiver[r]) continue;
            if (tribCount[r] < 1) tribCount[r] = 1;
            int dn = down[r];
            if (dn >= 0 && centerRiver[dn]) tribCount[dn] += tribCount[r];
        }

        // 1. 中心線の基準高を平滑化
        var refH = (float[])origH.Clone();
        var tmp = new float[n];
        for (int pass = 0; pass < 3; pass++) {
            System.Array.Copy(refH, tmp, n);
            for (int i = 0; i < n; i++) {
                if (!centerRiver[i]) continue;
                float wSum = 1f;
                float hSum = tmp[i];
                int up = upRiver[i];
                if (up >= 0 && centerRiver[up]) {
                    float w = 0.5f / (1f + Mathf.Abs(tmp[up] - tmp[i]) * 0.4f);
                    hSum += tmp[up] * w;
                    wSum += w;
                }
                int dn = down[i];
                if (dn >= 0 && centerRiver[dn]) {
                    float w = 0.5f / (1f + Mathf.Abs(tmp[dn] - tmp[i]) * 0.4f);
                    hSum += tmp[dn] * w;
                    wSum += w;
                }
                refH[i] = hSum / wSum;
            }
        }

        var lakeOutletLvl = new float[n];
        var distFromLakeOutlet = new int[n];
        var lakeInletLvl = new float[n];
        var distToLakeInlet = new int[n];
        var minBackwaterY = new float[n];
        for (int i = 0; i < n; i++) {
            lakeOutletLvl[i] = float.MinValue;
            distFromLakeOutlet[i] = -1;
            lakeInletLvl[i] = float.MinValue;
            distToLakeInlet[i] = -1;
            minBackwaterY[i] = float.MinValue;
        }
        for (int i = 0; i < n; i++) {
            if (!inside[i] || lakeId[i] <= 0 || IsLakeFrozen(lakeId[i])) continue;
            int d = down[i];
            if (d >= 0 && centerRiver[d]) {
                lakeOutletLvl[d] = Mathf.Max(lakeOutletLvl[d], lakeLevels[lakeId[i]]);
                distFromLakeOutlet[d] = 0;
            }
        }
        for (int i = 0; i < n; i++) {
            if (!centerRiver[i]) continue;
            int d = down[i];
            if (d >= 0 && lakeId[d] > 0 && !IsLakeFrozen(lakeId[d])) {
                lakeInletLvl[i] = Mathf.Max(lakeInletLvl[i], lakeLevels[lakeId[d]]);
                distToLakeInlet[i] = 0;
            }
        }
        foreach (int r in order) {
            if (!centerRiver[r] || distFromLakeOutlet[r] < 0) continue;
            int dn = down[r];
            if (dn >= 0 && centerRiver[dn] && distFromLakeOutlet[dn] < 0 && upRiver[dn] == r) {
                distFromLakeOutlet[dn] = distFromLakeOutlet[r] + 1;
            }
        }
        // 湖の流入口では上流側の水面が湖面より低くならないよう、湖水位を下流→上流へ伝播する
        for (int oi = order.Count - 1; oi >= 0; oi--) {
            int r = order[oi];
            if (!centerRiver[r]) continue;
            if (lakeInletLvl[r] > float.MinValue) {
                minBackwaterY[r] = Mathf.Max(minBackwaterY[r], lakeInletLvl[r] + 0.015f);
            }
            int dn = down[r];
            if (dn >= 0 && centerRiver[dn]) {
                if (minBackwaterY[dn] > float.MinValue) {
                    minBackwaterY[r] = Mathf.Max(minBackwaterY[r], minBackwaterY[dn] + 0.005f);
                }
                if (distToLakeInlet[dn] >= 0) {
                    int candD = distToLakeInlet[dn] + 1;
                    if (distToLakeInlet[r] < 0 || candD < distToLakeInlet[r]) distToLakeInlet[r] = candD;
                }
            }
        }

        // 2. 中心線ごとの水深・土手深さ・川幅を計算
        var centerWaterY = new float[n];
        var centerWaterDepth = new float[n];
        var centerBankHeight = new float[n];
        var centerHalfWidth = new float[n];
        float scaledRiverThresh = Mathf.Max(1f, riverThreshold * RiverAreaScale());

        for (int i = 0; i < n; i++) {
            if (!centerRiver[i]) continue;
            float flow01 = Mathf.Clamp01(Mathf.Log(Mathf.Max(1f, acc[i] / scaledRiverThresh), 2f) * 0.34f);
            float mergeBonus = Mathf.Clamp01((tribCount[i] - 1) * 0.35f);
            float preMergeCap = 0.32f + Mathf.Clamp01((tribCount[i] - 1) * 0.34f);
            float effectiveFlow = Mathf.Min(flow01, preMergeCap);
            float flowScale = Mathf.Lerp(0.86f, 1.45f, Mathf.Max(flow01, mergeBonus * 0.75f));
            float edgeFade = Mathf.Lerp(0.90f, 1f, Smooth(0f, cliffWidth * 0.6f, mask[i]));

            // 水面から川底までの水深
            float wDepth = Mathf.Lerp(plainsRiverDepth, riverDepth, mountain[i]) * flowScale * edgeFade;
            // 水面から土手の上(岸)までの段差(湖の流出口・流入口では段差0から滑らかに深くする)
            float bDepth = riverBankDepth * Mathf.Lerp(0.85f, 1.35f, mountain[i] * 0.5f + flow01 * 0.5f)
                * Mathf.Lerp(0.95f, 1f, Smooth(0f, cliffWidth * 0.6f, mask[i]));
            float bankLakeEase = 1f;
            if (distFromLakeOutlet[i] >= 0 && distFromLakeOutlet[i] < 6) {
                bankLakeEase = Mathf.Min(bankLakeEase, Smooth(0f, 5f, distFromLakeOutlet[i]));
            }
            if (distToLakeInlet[i] >= 0 && distToLakeInlet[i] < 6) {
                bankLakeEase = Mathf.Min(bankLakeEase, Smooth(0f, 5f, distToLakeInlet[i]));
            }
            bDepth = Mathf.Lerp(0.05f, bDepth, bankLakeEase);
            // 川の片幅(合流前の上流は控えめに抑え、合流後に少しずつ広げる)
            float widthWeight = Mathf.Clamp01(effectiveFlow * 0.50f + mergeBonus * 0.50f);
            float halfW = Mathf.Max(cellSize * 0.80f, riverWidth * 0.5f * Mathf.Lerp(0.56f, 1.48f, widthWeight));
            if (tribCount[i] >= 2) {
                halfW += cellSize * 0.32f * Mathf.Min(1.6f, 0.75f + (tribCount[i] - 2) * 0.45f);
            }

            centerWaterDepth[i] = Mathf.Max(0.8f, wDepth);
            centerBankHeight[i] = Mathf.Max(0.05f, bDepth);
            centerHalfWidth[i] = halfW;

            // 水面は元の地面より「土手の深さ(bDepth)」だけ低い位置に置く
            centerWaterY[i] = Mathf.Max(1.0f, refH[i] - centerBankHeight[i]);
            if (lakeOutletLvl[i] > float.MinValue) {
                centerWaterY[i] = Mathf.Min(centerWaterY[i], lakeOutletLvl[i] - 0.03f);
            }
            if (minBackwaterY[i] > float.MinValue) {
                centerWaterY[i] = Mathf.Max(centerWaterY[i], minBackwaterY[i]);
            }
        }

        // 3. 中心線の水面高と川幅を平滑化し、水面は単調減少、川幅は合流後の太さを維持
        for (int pass = 0; pass < 2; pass++) {
            System.Array.Copy(centerHalfWidth, tmp, n);
            for (int i = 0; i < n; i++) {
                if (!centerRiver[i]) continue;
                float wSum = 1f;
                float hwSum = tmp[i];
                int up = upRiver[i];
                if (up >= 0 && centerRiver[up]) {
                    hwSum += tmp[up] * 0.45f;
                    wSum += 0.45f;
                }
                int dn = down[i];
                if (dn >= 0 && centerRiver[dn]) {
                    hwSum += tmp[dn] * 0.45f;
                    wSum += 0.45f;
                }
                centerHalfWidth[i] = hwSum / wSum;
            }
        }
        foreach (int r in order) {
            if (!centerRiver[r]) continue;
            int dn = down[r];
            if (dn >= 0 && centerRiver[dn]) {
                centerHalfWidth[dn] = Mathf.Max(centerHalfWidth[dn], centerHalfWidth[r] * 0.96f);
            }
        }

        for (int pass = 0; pass < 3; pass++) {
            System.Array.Copy(centerWaterY, tmp, n);
            for (int i = 0; i < n; i++) {
                if (!centerRiver[i]) continue;
                float wSum = 1f;
                float hSum = tmp[i];
                int up = upRiver[i];
                if (up >= 0 && centerRiver[up]) {
                    float w = 0.5f / (1f + Mathf.Abs(tmp[up] - tmp[i]) * 0.5f);
                    hSum += tmp[up] * w;
                    wSum += w;
                }
                int dn = down[i];
                if (dn >= 0 && centerRiver[dn]) {
                    float w = 0.5f / (1f + Mathf.Abs(tmp[dn] - tmp[i]) * 0.5f);
                    hSum += tmp[dn] * w;
                    wSum += w;
                }
                centerWaterY[i] = hSum / wSum;
            }
        }

        for (int i = 0; i < n; i++) {
            if (!centerRiver[i]) continue;
            if (minBackwaterY[i] > float.MinValue) {
                centerWaterY[i] = Mathf.Max(centerWaterY[i], minBackwaterY[i]);
            }
            if (lakeOutletLvl[i] > float.MinValue) {
                float minOut = minBackwaterY[i] > float.MinValue
                    ? Mathf.Max(minBackwaterY[i], lakeOutletLvl[i] - 0.45f)
                    : lakeOutletLvl[i] - 0.45f;
                float maxOut = Mathf.Max(minOut, lakeOutletLvl[i] - 0.02f);
                centerWaterY[i] = Mathf.Clamp(centerWaterY[i], minOut, maxOut);
            }
        }

        var minUpW = new float[n];
        for (int i = 0; i < n; i++) minUpW[i] = float.MaxValue;
        foreach (int r in order) {
            if (!centerRiver[r]) continue;
            if (minUpW[r] < float.MaxValue) {
                centerWaterY[r] = Mathf.Min(centerWaterY[r], minUpW[r] - 0.005f);
            }
            if (minBackwaterY[r] > float.MinValue) {
                centerBankHeight[r] = Mathf.Min(centerBankHeight[r], Mathf.Max(0.15f, refH[r] - centerWaterY[r]));
            }
            int dn = down[r];
            if (dn >= 0 && centerRiver[dn]) minUpW[dn] = Mathf.Min(minUpW[dn], centerWaterY[r]);
        }

        // 4. 川の中心線から周囲へ距離フィールド(Dijkstra)を伝播させ、広い河道・急な土手・平坦な岸を作る
        var distToCenter = new float[n];
        var nearestCenter = new int[n];
        float maxHalfW = riverWidth * 0.5f;
        for (int i = 0; i < n; i++) {
            distToCenter[i] = float.MaxValue;
            nearestCenter[i] = -1;
            if (centerRiver[i]) maxHalfW = Mathf.Max(maxHalfW, centerHalfWidth[i]);
        }

        var dPq = new SortedSet<(float dist, int idx)>();
        float maxInfluenceRadius = maxHalfW + cellSize * 4.5f;

        for (int i = 0; i < n; i++) {
            if (!centerRiver[i]) continue;
            distToCenter[i] = 0f;
            nearestCenter[i] = i;
            dPq.Add((0f, i));
        }

        while (dPq.Count > 0) {
            var cur = dPq.Min;
            dPq.Remove(cur);
            int u = cur.idx;
            if (cur.dist > distToCenter[u] + 1e-4f) continue;

            for (int k = 0; k < 6; k++) {
                int nb = Nb(u, k);
                if (nb < 0 || !inside[nb] || lakeId[nb] > 0 || snowBuffer[nb]) continue;
                float step = Vector2.Distance(xz[u], xz[nb]);
                float nd = cur.dist + step;
                if (nd < distToCenter[nb] && nd <= maxInfluenceRadius) {
                    distToCenter[nb] = nd;
                    nearestCenter[nb] = nearestCenter[u];
                    dPq.Add((nd, nb));
                }
            }
        }

        // 5. 各頂点に「川底」「土手の急斜面」「土手上の平坦テラス（橋の接続面）」を適用
        float bankSlopeSpan = Mathf.Max(cellSize * 1.15f, 3.8f);
        float leveeFlatSpan = Mathf.Max(cellSize * 1.45f, 5.0f);

        for (int i = 0; i < n; i++) {
            int src = nearestCenter[i];
            if (src < 0 || !inside[i] || lakeId[i] > 0 || snowBuffer[i]) continue;

            float d = distToCenter[i];
            float halfW = centerHalfWidth[src];
            float waterY = centerWaterY[src];
            float wDepth = centerWaterDepth[src];
            float bankH = centerBankHeight[src];

            if (TryGetMaxAdjacentUnfrozenLakeLevel(i, out float adjLakeLvl)) {
                waterY = Mathf.Max(waterY, adjLakeLvl);
            }

            if (d <= halfW) {
                // 【河道内部】広い水面と深いU字/箱型の川底
                river[i] = true;
                riverW[i] = waterY;
                float normD = halfW > 0.01f ? Mathf.Clamp01(d / halfW) : 0f;
                // 川の中央から岸際までしっかり深さを保つ深い箱型U字断面
                float bedProfile = Mathf.Lerp(1.0f, 0.72f, normD * normD);
                H[i] = Mathf.Max(SafeBedFloor(i), waterY - wDepth * bedProfile);
            } else if (d <= halfW + bankSlopeSpan) {
                // 【土手の斜面】水面から土手の上へ一気に立ち上がる段差
                bankSlopeFlag[i] = true;
                float t = Mathf.Clamp01((d - halfW) / bankSlopeSpan);
                float leveeTopY = waterY + bankH;
                float carvedY = Mathf.Lerp(waterY - wDepth * 0.55f, leveeTopY, Smooth(0f, 1f, t));
                H[i] = Mathf.Max(SafeBedFloor(i), Mathf.Min(origH[i], carvedY));
                if (H[i] < leveeTopY && origH[i] < leveeTopY) {
                    H[i] = Mathf.Lerp(carvedY, leveeTopY, t);
                }
            } else if (d <= halfW + bankSlopeSpan + leveeFlatSpan) {
                // 【土手の上(天端)】橋ジェネレーターで橋を架けやすい平坦な岸辺テラス
                float t = Mathf.Clamp01((d - halfW - bankSlopeSpan) / leveeFlatSpan);
                float leveeTopY = waterY + bankH;
                float flatWeight = (1f - Smooth(0f, 1f, t)) * (1f - mountain[i] * 0.55f);
                float targetY = Mathf.Max(leveeTopY, Mathf.Lerp(origH[i], leveeTopY, 0.72f));
                H[i] = Mathf.Lerp(origH[i], targetY, flatWeight);
            }
        }

        // 5.5. 合流点や近接川に挟まれた1頂点幅の薄い仕切り壁を解消して水面を一体化
        var snapRiver = new bool[n];
        for (int pass = 0; pass < 2; pass++) {
            System.Array.Copy(river, snapRiver, n);
            for (int b = 0; b < n; b++) {
                if (!inside[b] || snapRiver[b] || lakeId[b] > 0 || snowBuffer[b]) continue;
                int riverNbCnt = 0;
                int arcCount = 0;
                bool prevIsRiver = false;
                bool nb0River = false;
                float sumW = 0f;
                float sumBedDrop = 0f;
                for (int k = 0; k < 6; k++) {
                    int nb = Nb(b, k);
                    bool isR = nb >= 0 && snapRiver[nb] && !float.IsNaN(riverW[nb]);
                    if (k == 0) nb0River = isR;
                    if (isR) {
                        riverNbCnt++;
                        sumW += riverW[nb];
                        int src = nearestCenter[nb];
                        sumBedDrop += src >= 0 ? centerWaterDepth[src] : plainsRiverDepth;
                        if (k > 0 && !prevIsRiver) arcCount++;
                    }
                    prevIsRiver = isR;
                }
                if (nb0River && !prevIsRiver) arcCount++;
                if (arcCount < 2 && riverNbCnt < 5) continue;

                float avgW = sumW / riverNbCnt;
                if (origH[b] > avgW + riverBankDepth * 2.5f + cellSize * 0.8f) continue;

                river[b] = true;
                bankSlopeFlag[b] = false;
                riverW[b] = avgW;
                float avgDrop = sumBedDrop / riverNbCnt;
                H[b] = Mathf.Min(H[b], Mathf.Max(SafeBedFloor(b), avgW - avgDrop * 0.85f));
            }
        }

        // 6. 水面メッシュが土手の斜面に隙間なく食い込むよう、riverに隣接する1マスにもriverWを設定
        for (int b = 0; b < n; b++) {
            if (!inside[b] || river[b] || lakeId[b] > 0 || snowZone[b]) continue;
            float sumW = 0f;
            int cnt = 0;
            for (int k = 0; k < 6; k++) {
                int nb = Nb(b, k);
                if (nb >= 0 && river[nb] && !float.IsNaN(riverW[nb])) {
                    sumW += riverW[nb];
                    cnt++;
                }
            }
            if (cnt > 0) {
                riverW[b] = sumW / cnt;
                // 土手の壁が水面より低くならないよう保証
                float minRim = riverW[b] + Mathf.Min(1.2f, riverBankDepth * 0.45f);
                if (H[b] < minRim) H[b] = minRim;
            }
        }
    }

    // ================= 頂点の高さばらつき・法線・急斜面距離 =================
    void ApplyHeightJitter() {
        if (heightJitter <= 0f) return;
        int n = nx * nz;
        var hjRng = new System.Random(seed + 11);
        for (int i = 0; i < n; i++) {
            if (!inside[i] || lakeId[i] > 0 || river[i] || bankSlopeFlag[i]) continue;
            if (!float.IsNaN(riverW[i]) || shore[i] > 0.65f) continue;
            float waterFade = 1f - shore[i];
            float edgeFade = Smooth(0f, cliffWidth * 1.5f, mask[i]);
            float mtJitterScale = Mathf.Lerp(0.12f, 1f, Smooth(0.05f, 0.35f, mountain[i]));
            float fade = waterFade * edgeFade * mtJitterScale;
            if (fade <= 0.01f) continue;
            float delta = ((float)hjRng.NextDouble() * 2f - 1f) * heightJitter * fade;
            H[i] = Mathf.Max(0f, H[i] + delta);
        }
    }

    void ComputeSlopes() {
        int n = nx * nz;
        var accNorm = new Vector3[n];
        for (int iz = 0; iz < nz - 1; iz++) {
            for (int ix = 0; ix < nx - 1; ix++) {
                int a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
                for (int t = 0; t < 2; t++) {
                    CellTri(a, b, c, d, iz, t, out int i0, out int i1, out int i2);
                    Vector3 p0 = Pos(i0, H[i0]);
                    Vector3 p1 = Pos(i1, H[i1]);
                    Vector3 p2 = Pos(i2, H[i2]);
                    Vector3 nrm = Vector3.Cross(p1 - p0, p2 - p0);
                    if (nrm.y < 0f) nrm = -nrm;
                    accNorm[i0] += nrm;
                    accNorm[i1] += nrm;
                    accNorm[i2] += nrm;
                }
            }
        }
        slopeNy = new float[n];
        for (int i = 0; i < n; i++) {
            Vector3 nrm = accNorm[i];
            slopeNy[i] = nrm.sqrMagnitude > 1e-10f ? Mathf.Clamp01(nrm.normalized.y) : 1f;
        }
    }

    float[] SmoothInsideField(float[] src, int passes) {
        int n = nx * nz;
        var bufA = new float[n];
        var bufB = new float[n];
        System.Array.Copy(src, bufA, n);
        for (int pass = 0; pass < passes; pass++) {
            for (int i = 0; i < n; i++) {
                if (!inside[i]) {
                    bufB[i] = bufA[i];
                    continue;
                }
                float sum = bufA[i] * 2f;
                float w = 2f;
                for (int k = 0; k < 6; k++) {
                    int nb = Nb(i, k);
                    if (nb >= 0 && inside[nb]) {
                        sum += bufA[nb];
                        w += 1f;
                    }
                }
                bufB[i] = sum / w;
            }
            var tmp = bufA;
            bufA = bufB;
            bufB = tmp;
        }
        return bufA;
    }

    // 周囲数セルの平均高度との差から尾根(正:凸)と谷(負:凹)の曲率を算出
    void ComputeRidgeCurvature() {
        int n = nx * nz;
        if (ridgeCurv == null || ridgeCurv.Length != n) ridgeCurv = new float[n];
        float[] smoothH = SmoothInsideField(H, 4);
        float normScale = Mathf.Max(1.6f, cellSize * 0.48f);
        for (int i = 0; i < n; i++) {
            if (!inside[i] || mask[i] < cliffWidth * 0.65f) {
                ridgeCurv[i] = 0f;
                continue;
            }
            float raw = (H[i] - smoothH[i]) / normScale;
            ridgeCurv[i] = Mathf.Clamp(raw / (1f + Mathf.Abs(raw) * 0.42f), -1f, 1f);
        }
    }

    // 積雪判定用に微細凹凸のノイズを抑えた広域傾斜(法線Y)を算出
    void ComputeSnowSlopeField() {
        int n = nx * nz;
        if (snowSlopeNy == null || snowSlopeNy.Length != n) snowSlopeNy = new float[n];
        float[] smoothNy = SmoothInsideField(slopeNy, 5);
        for (int i = 0; i < n; i++) {
            snowSlopeNy[i] = Mathf.Lerp(smoothNy[i], slopeNy[i], 0.06f);
        }
    }

    // 急斜面・崖・土手斜面・外周縁からの実距離フィールドを計算する
    void ComputeSteepDistanceField() {
        int n = nx * nz;
        steepDist = new float[n];
        rimDist = new float[n];
        float steepCutoffNy = Mathf.Max(rockSlope + 0.05f, 0.80f);

        for (int i = 0; i < n; i++) {
            rimDist[i] = inside[i] ? float.MaxValue : 0f;
            bool isSteepOrCliff = !inside[i]
                || slopeNy[i] < steepCutoffNy
                || bankSlopeFlag[i]
                || river[i]
                || lakeId[i] > 0;
            steepDist[i] = isSteepOrCliff ? 0f : float.MaxValue;
        }

        float maxMargin = Mathf.Max(grassSlopeMargin + cellSize * 2f, grassSlopeMargin + 12f);
        PropagateDistanceField(steepDist, maxMargin);
        PropagateDistanceField(rimDist, Mathf.Max(16f, cellSize * 3f));
    }

    void PropagateDistanceField(float[] dist, float maxRange) {
        var pq = new SortedSet<(float d, int idx)>();
        for (int i = 0; i < dist.Length; i++) {
            if (dist[i] <= 0f) pq.Add((0f, i));
        }

        while (pq.Count > 0) {
            var cur = pq.Min;
            pq.Remove(cur);
            int u = cur.idx;
            if (cur.d > dist[u] + 1e-4f) continue;
            for (int k = 0; k < 6; k++) {
                int nb = Nb(u, k);
                if (nb < 0) continue;
                float step = Vector2.Distance(xz[u], xz[nb]);
                float nd = cur.d + step;
                if (nd < dist[nb] && nd <= maxRange) {
                    dist[nb] = nd;
                    pq.Add((nd, nb));
                }
            }
        }
    }

    // ================= 地形メッシュ =================
    static void CellTri(int a, int b, int c, int d, int iz, int t, out int i0, out int i1, out int i2) {
        if ((iz & 1) == 0) {
            if (t == 0) { i0 = a; i1 = b; i2 = c; } else { i0 = b; i1 = d; i2 = c; }
        } else {
            if (t == 0) { i0 = a; i1 = b; i2 = d; } else { i0 = a; i1 = d; i2 = c; }
        }
    }

    // 凸四角形セルでは高低差・3D距離コストが小さい（等高線に沿う）対角線を選ぶ
    void CellTriContour(int a, int b, int c, int d, int iz, int t, out int i0, out int i1, out int i2) {
        int inCnt = (inside[a] ? 1 : 0) + (inside[b] ? 1 : 0) + (inside[c] ? 1 : 0) + (inside[d] ? 1 : 0);
        bool useBC;
        if (inCnt == 1) {
            // 1頂点のみ内側の縁セルは非マニフォールドなy=0平面重複を防ぐため外側3頂点側を確実に切り離す
            useBC = inside[a] || inside[d];
        } else {
            Vector2 qa = xz[a], qb = xz[b], qc = xz[c], qd = xz[d];
            float cross1 = (qb.x - qa.x) * (qc.y - qa.y) - (qb.y - qa.y) * (qc.x - qa.x);
            float cross2 = (qd.x - qb.x) * (qa.y - qb.y) - (qd.y - qb.y) * (qa.x - qb.x);
            float cross3 = (qc.x - qd.x) * (qb.y - qd.y) - (qc.y - qd.y) * (qb.x - qd.x);
            float cross4 = (qa.x - qc.x) * (qd.y - qc.y) - (qa.y - qc.y) * (qd.x - qc.x);
            bool convex = (cross1 * cross2 > 0f) && (cross2 * cross3 > 0f) && (cross3 * cross4 > 0f);

            useBC = (iz & 1) == 0;
            if (convex) {
                float dyBC = Mathf.Abs(H[b] - H[c]);
                float dyAD = Mathf.Abs(H[a] - H[d]);
                float costBC = (qb - qc).sqrMagnitude + dyBC * dyBC * 2.0f;
                float costAD = (qa - qd).sqrMagnitude + dyAD * dyAD * 2.0f;
                useBC = costBC <= costAD;
            }
        }

        if (useBC) {
            if (t == 0) { i0 = a; i1 = b; i2 = c; } else { i0 = b; i1 = d; i2 = c; }
        } else {
            if (t == 0) { i0 = a; i1 = b; i2 = d; } else { i0 = a; i1 = d; i2 = c; }
        }
    }

    struct TriIdx {
        public int a, b, c;
        public TriIdx(int a, int b, int c) { this.a = a; this.b = b; this.c = c; }
    }

    Mesh BuildTerrainMesh() {
        int n = nx * nz;
        var topCols = new Color[n];
        var underCols = new Color[n];
        var rockFlag = new bool[n];
        ComputeVertexColors(topCols, underCols, rockFlag);

        var isOuterRim = new bool[n];
        var inWater = new bool[n];
        for (int i = 0; i < n; i++) {
            isOuterRim[i] = !inside[i];
            bool nearLake = lakeId[i] > 0 || (TryGetMaxAdjacentLakeLevel(i, out float adjLvl) && H[i] <= adjLvl + 2.5f);
            bool nearRiver = river[i] || (!float.IsNaN(riverW[i]) && H[i] <= riverW[i] + 2.5f);
            inWater[i] = inside[i] && (nearLake || nearRiver);
        }

        var topPos = new List<Vector3>(n);
        var topColList = new List<Color>(topCols);
        var topRockList = new List<bool>(rockFlag);
        var topSnowList = new List<float>(snowMap);
        var topTris = new List<TriIdx>(n);

        var botPos = new List<Vector3>(n);
        var botTris = new List<TriIdx>(n / 4);

        for (int i = 0; i < n; i++) {
            topPos.Add(Pos(i, H[i]));
            botPos.Add(Pos(i, bottomY[i]));
        }

        BuildSurfaceMeshQuads(topTris, topPos, topColList, topRockList, topSnowList, isOuterRim, inWater,
            true, cellSize * 1.05f, 0.90f, 8);
        var topLocked = new bool[topPos.Count];
        for (int i = 0; i < topPos.Count; i++) {
            if (i >= n || !inside[i] || isOuterRim[i] || inWater[i] || bankSlopeFlag[i]
                || shore[i] > 0.02f || mountain[i] >= 0.04f || snowMap[i] > 0.005f || rockFlag[i]
                || mask[i] < cliffWidth * 1.4f || slopeNy[i] < 0.968f) {
                topLocked[i] = true;
            }
        }
        CollapseFlatInteriorVertices(topPos, topColList, topTris, topLocked, 0.14f, 0.992f, 0.055f, 4);
        BuildCoarseBottomSurface(botTris, botPos);
        BuildFinalSurfaceIndex(topPos, topTris);

        var mb = new MeshBuilder(true);
        var cr = new System.Random(seed + 2);

        foreach (TriIdx tr in topTris) {
            Vector3 p0 = topPos[tr.a], p1 = topPos[tr.b], p2 = topPos[tr.c];
            Vector3 cross = Vector3.Cross(p1 - p0, p2 - p0);
            if (cross.sqrMagnitude < 1e-10f) continue;

            bool rockTri = Mathf.Abs(cross.normalized.y) < rockSlope
                || (topRockList[tr.a] && topRockList[tr.b] && topRockList[tr.c]);
            // 橋ジェネレーター(ResolveShorePoint)が川底や土手の急斜面ではなく
            // 「土手の上の平坦な岸(alpha=1)」へスナップするようマスクを設定
            float alpha = rockTri ? 0f : 1f;
            float sA = tr.a < topSnowList.Count ? topSnowList[tr.a] : 0f;
            float sB = tr.b < topSnowList.Count ? topSnowList[tr.b] : 0f;
            float sC = tr.c < topSnowList.Count ? topSnowList[tr.c] : 0f;
            float triSnow = Mathf.Max(sA, Mathf.Max(sB, sC));
            // 雪面の三角形ごとに岩並みの±5%明度ジッターを掛けると斑点状に汚れるため抑える
            float snowJitterScale = Mathf.Lerp(1f, 0.10f, triSnow);
            float tv = (rockTri
                ? (float)cr.NextDouble() * 0.10f - 0.05f
                : (float)cr.NextDouble() * 0.06f - 0.03f) * snowJitterScale;

            mb.TriRaw(p0, p1, p2,
                WithAlpha(Shade(topColList[tr.a], tv), alpha),
                WithAlpha(Shade(topColList[tr.b], tv), alpha),
                WithAlpha(Shade(topColList[tr.c], tv), alpha));
        }

        foreach (TriIdx tr in botTris) {
            Vector3 q0 = botPos[tr.a], q1 = botPos[tr.b], q2 = botPos[tr.c];
            float uv = (float)cr.NextDouble() * 0.12f - 0.06f;
            mb.TriRaw(q0, q1, q2,
                Shade(underCols[tr.a], uv),
                Shade(underCols[tr.b], uv),
                Shade(underCols[tr.c], uv));
        }

        // 雪が積もる標高の湖は表面を氷結させ、地形と同じ共有マテリアルで描画・歩行可能にする
        Color iceBase = Color.Lerp(waterColor, snowColor, 0.72f);
        Color iceShore = Color.Lerp(iceBase, snowColor, 0.55f);
        int iceCellsX = nx - 1;
        int iceCellsZ = nz - 1;
        int[] frozenSizes = BuildAlignedQuadtreeSizes(iceCellsX, iceCellsZ, new[] { 8, 4, 2 }, (bx, bz, step) => {
            int firstLid = lakeId[bz * nx + bx];
            if (firstLid <= 0 || !IsLakeFrozen(firstLid)) return false;
            for (int dz = 0; dz <= step; dz++) {
                int row = (bz + dz) * nx + bx;
                for (int dx = 0; dx <= step; dx++) {
                    int idx = row + dx;
                    if (!inside[idx] || lakeId[idx] != firstLid) return false;
                }
            }
            return true;
        });

        var iceLoop = new List<int>(40);
        for (int iz = 0; iz < iceCellsZ; iz++) {
            for (int ix = 0; ix < iceCellsX; ix++) {
                int leafS = frozenSizes[iz * iceCellsX + ix];
                if (leafS >= 2) {
                    if (ix % leafS == 0 && iz % leafS == 0) {
                        int lid = lakeId[iz * nx + ix];
                        float lvl = lakeLevels[lid];
                        float iv = (float)cr.NextDouble() * 0.05f - 0.025f;
                        Color cIce = WithAlpha(Shade(iceBase, iv), 0f);
                        EmitMergedQuadBlock(ix, iz, leafS, iceCellsX, iceCellsZ, frozenSizes, iceLoop, (i0, i1, i2) => {
                            if (BaseGridCrossY(i0, i1, i2) < 0f) {
                                int tmp = i1; i1 = i2; i2 = tmp;
                            }
                            mb.Tri(Pos(i0, lvl), Pos(i1, lvl), Pos(i2, lvl), cIce, cIce, cIce, Vector3.up);
                        });
                    }
                    continue;
                }

                int a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
                for (int t = 0; t < 2; t++) {
                    CellTri(a, b, c, d, iz, t, out int i0, out int i1, out int i2);
                    int lid = FirstLakeId(i0, i1, i2);
                    if (!IsLakeFrozen(lid)) continue;

                    float lvl = lakeLevels[lid];
                    float y0 = WaterHeightInLakeTri(i0, lid, lvl);
                    float y1 = WaterHeightInLakeTri(i1, lid, lvl);
                    float y2 = WaterHeightInLakeTri(i2, lid, lvl);

                    float iv = (float)cr.NextDouble() * 0.05f - 0.025f;
                    Color c0 = WithAlpha(Shade(lakeId[i0] == lid ? iceBase : iceShore, iv), 0f);
                    Color c1 = WithAlpha(Shade(lakeId[i1] == lid ? iceBase : iceShore, iv), 0f);
                    Color c2 = WithAlpha(Shade(lakeId[i2] == lid ? iceBase : iceShore, iv), 0f);
                    mb.Tri(Pos(i0, y0), Pos(i1, y1), Pos(i2, y2), c0, c1, c2, Vector3.up);
                }
            }
        }

        return mb.ToMesh("IslandTerrain");
    }

    float BaseGridCrossY(int i0, int i1, int i2) {
        Vector2 p0 = baseXz[i0], p1 = baseXz[i1], p2 = baseXz[i2];
        return (p1.y - p0.y) * (p2.x - p0.x) - (p1.x - p0.x) * (p2.y - p0.y);
    }

    void AddCanonicalTri(List<TriIdx> list, List<Vector3> pos, int i0, int i1, int i2, bool upward) {
        Vector3 nrm = Vector3.Cross(pos[i1] - pos[i0], pos[i2] - pos[i0]);
        if (nrm.sqrMagnitude < 1e-10f) return;
        // 境界引き寄せやジッターで崖面が90度を超えても表裏が反転しないよう、元の格子座標で向きを判定する
        float orientY = (i0 < baseXz.Length && i1 < baseXz.Length && i2 < baseXz.Length)
            ? BaseGridCrossY(i0, i1, i2)
            : nrm.y;
        if (upward ? orientY < 0f : orientY > 0f) {
            int tmp = i1; i1 = i2; i2 = tmp;
        }
        list.Add(new TriIdx(i0, i1, i2));
    }

    // Mono の UInt64.GetHashCode は (lo ^ hi) となり隣接グリッド辺で衝突するためアバランシェ比較器を使う
    sealed class EdgeKeyComparer : IEqualityComparer<ulong> {
        public static readonly EdgeKeyComparer Instance = new EdgeKeyComparer();
        public bool Equals(ulong x, ulong y) => x == y;
        public int GetHashCode(ulong key) {
            ulong h = key * 0x9E3779B97F4A7C15UL;
            h ^= h >> 30;
            h *= 0xBF58476D1CE4E5B9UL;
            h ^= h >> 27;
            return (int)(h ^ (h >> 32));
        }
    }

    static ulong EdgeKey(int u, int v) {
        return u < v ? ((ulong)(uint)u << 32) | (uint)v : ((ulong)(uint)v << 32) | (uint)u;
    }

    static void EdgeHashOffsets(int u, int v, int pass, int seedVal, out float rx, out float ry, out float rz) {
        uint a = (uint)Mathf.Min(u, v);
        uint b = (uint)Mathf.Max(u, v);
        uint h = a * 73856093u ^ b * 19349663u ^ (uint)(pass + 1) * 83492791u ^ (uint)seedVal * 2654435761u;
        h ^= h >> 16; h *= 0x7feb352du; h ^= h >> 15; h *= 0x846ca68bu; h ^= h >> 16;
        rx = ((h & 0x3ffu) / 1023f) * 2f - 1f;
        ry = (((h >> 10) & 0x3ffu) / 1023f) * 2f - 1f;
        rz = (((h >> 20) & 0x3ffu) / 1023f) * 2f - 1f;
    }

    static void EmitOrientedTri(List<TriIdx> tris, int a, int b, int c, bool isTop) {
        if (a == b || b == c || c == a) return;
        tris.Add(isTop ? new TriIdx(a, b, c) : new TriIdx(a, c, b));
    }

    Color ComputeSubdividedTopColor(Color baseCol, float t, Vector3 pt, int idxA, int idxB,
            float edgeSlope, bool anyRim, float minRockBlend, float ry, IList<float> snowList, out float outSnowT) {
        float snowT;
        if (anyRim) {
            snowT = 0f;
        } else if (snowList != null && idxA < snowList.Count && idxB < snowList.Count) {
            float aSnow = snowList[idxA];
            float bSnow = snowList[idxB];
            snowT = Mathf.Lerp(aSnow, bSnow, t);
            if (snowT > 0.001f && Mathf.Min(aSnow, bSnow) < 0.45f) {
                float edgeNy = 1f / Mathf.Sqrt(1f + edgeSlope * edgeSlope);
                float snowSlopeMin = Mathf.Clamp(rockSlope - 0.14f, 0.48f, 0.78f);
                float snowSlopeMax = Mathf.Clamp(snowSlopeMin + 0.18f, 0.68f, 0.94f);
                float steepMask = Smooth(snowSlopeMin, snowSlopeMax, edgeNy);
                snowT *= Mathf.Lerp(1f, steepMask, Smooth(0.05f, 0.35f, t));
            }
        } else {
            float edgeNy = 1f / Mathf.Sqrt(1f + edgeSlope * edgeSlope);
            float endNy = (idxA < snowSlopeNy.Length && idxB < snowSlopeNy.Length)
                ? Mathf.Lerp(snowSlopeNy[idxA], snowSlopeNy[idxB], t)
                : edgeNy;
            float curv = (idxA < ridgeCurv.Length && idxB < ridgeCurv.Length)
                ? Mathf.Lerp(ridgeCurv[idxA], ridgeCurv[idxB], t)
                : 0f;
            snowT = ComputeSnowWeight(pt.x, pt.y, pt.z, Mathf.Min(edgeNy, endNy), false, curv);
        }
        outSnowT = snowT;
        float barrenT = anyRim ? 0f : ComputeBarrenRockWeight(pt.x, pt.y, pt.z);
        float rockBand = Mathf.Clamp01(pt.y / Mathf.Max(10f, baseHeight + mountainAmp));
        Color rockTone = anyRim
            ? Color.Lerp(rockColor, underColor, 0.38f)
            : Color.Lerp(rockColor * 0.80f, rockColor * 1.12f, rockBand);
        rockTone = Color.Lerp(rockTone, snowColor, snowT);
        float rockBlend = anyRim
            ? minRockBlend
            : Mathf.Max(Mathf.Max(minRockBlend, barrenT), snowT);
        float snowJitterScale = Mathf.Lerp(1f, 0.10f, snowT);
        return Shade(Color.Lerp(baseCol, rockTone, rockBlend), ry * 0.03f * snowJitterScale);
    }

    static int[] ReverseChain(int[] src) {
        var dst = new int[src.Length];
        for (int k = 0; k < src.Length; k++) dst[k] = src[src.Length - 1 - k];
        return dst;
    }

    int AddLinearBridgeVertex(int pStart, int pEnd, float t, int saltA, int saltB, int step,
            List<Vector3> pos, List<Color> cols, List<bool> rockFlags, List<float> snowList, bool[] baseOuterRim, bool[] baseWater,
            bool isTop, float segLen3) {
        Vector3 pa = pos[pStart], pb = pos[pEnd];
        Vector3 pt = Vector3.Lerp(pa, pb, t);
        bool anyRim = (pStart < baseOuterRim.Length && baseOuterRim[pStart]) || (pEnd < baseOuterRim.Length && baseOuterRim[pEnd]);
        bool anyWat = (pStart < baseWater.Length && baseWater[pStart]) || (pEnd < baseWater.Length && baseWater[pEnd]);
        float waterDamp = anyWat ? 0.25f : 1f;
        float dxz = Mathf.Sqrt((pa.x - pb.x) * (pa.x - pb.x) + (pa.z - pb.z) * (pa.z - pb.z));
        float dy = Mathf.Abs(pa.y - pb.y);
        float totalDist = Vector3.Distance(pa, pb);
        float segFrac = totalDist > 1e-4f ? Mathf.Clamp01(segLen3 / totalDist) : 1f;
        float segDxz = dxz * segFrac;
        float segDy = dy * segFrac;
        EdgeHashOffsets(saltA, saltB, step, seed, out float rx, out float ry, out float rz);
        float hAmp = Mathf.Min(cellSize * 0.10f, segDxz * 0.22f) * waterDamp;
        float vAmp = Mathf.Min(segDy * 0.15f, cellSize * 0.16f) * waterDamp;
        pt.x += rx * hAmp;
        pt.z += rz * hAmp;
        float minY = Mathf.Min(pa.y, pb.y);
        float maxY = Mathf.Max(pa.y, pb.y);
        pt.y = Mathf.Clamp(pt.y + ry * vAmp, minY, maxY);
        if (anyWat && pt.y < minY) pt.y = minY;

        float edgeSlope = dxz > 1e-4f ? dy / dxz : (dy > 0.01f ? 999f : 0f);
        Color col = Color.Lerp(cols[pStart], cols[pEnd], t);
        if (isTop) {
            col = ComputeSubdividedTopColor(col, t, pt, pStart, pEnd, edgeSlope, anyRim, anyRim ? 0.82f : 0.65f, ry, snowList, out float vSnow);
            rockFlags.Add(edgeSlope > 0.75f || (rockFlags[pStart] && rockFlags[pEnd]));
            if (snowList != null) snowList.Add(vSnow);
        } else {
            float depth01 = Mathf.Clamp01(-pt.y / Mathf.Max(1f, bottomDepth));
            Color uc = Color.Lerp(Color.Lerp(rockColor, underColor, 0.6f), underColor * 0.45f, depth01);
            col = Shade(Color.Lerp(col, uc, 0.75f), ry * 0.03f);
            col.a = 0f;
            rockFlags.Add(true);
            if (snowList != null) snowList.Add(0f);
        }
        int idx = pos.Count;
        pos.Add(pt);
        cols.Add(col);
        return idx;
    }

    // 2つの分割エッジ列を進行比率と最短対角線でジップし、針状にならない均等三角形帯を生成する
    static void ZipPairStrips(List<TriIdx> tris, List<Vector3> pos, int[] leftChain, int lStart, int lEnd,
            int[] rightChain, int rStart, int rEnd, bool isTop) {
        int lLen = lEnd - lStart;
        int rLen = rEnd - rStart;
        int i = 0, j = 0;
        while (i < lLen || j < rLen) {
            bool advLeft;
            if (i == lLen) advLeft = false;
            else if (j == rLen) advLeft = true;
            else {
                float pL = (float)i / lLen;
                float pR = (float)j / rLen;
                float diff = pL - pR;
                if (diff < -0.18f) advLeft = true;
                else if (diff > 0.18f) advLeft = false;
                else {
                    float dL = (pos[leftChain[lStart + i + 1]] - pos[rightChain[rStart + j]]).sqrMagnitude;
                    float dR = (pos[leftChain[lStart + i]] - pos[rightChain[rStart + j + 1]]).sqrMagnitude;
                    advLeft = dL <= dR;
                }
            }
            int li = leftChain[lStart + i];
            int rj = rightChain[rStart + j];
            if (advLeft) {
                EmitOrientedTri(tris, li, leftChain[lStart + i + 1], rj, isTop);
                i++;
            } else {
                EmitOrientedTri(tris, li, rightChain[rStart + j + 1], rj, isTop);
                j++;
            }
        }
    }

    // 端点または境界部分列を共有する2列から共有区間を除き、退化や隙間を防ぎつつ接続する
    static void ZipBridgeRows(List<TriIdx> tris, List<Vector3> pos, int[] leftChain, int[] rightChain, bool isTop) {
        int aLen = leftChain.Length - 1;
        int bLen = rightChain.Length - 1;
        if (aLen <= 0 || bLen <= 0) return;

        int s = 0;
        while (s < aLen && s < bLen && leftChain[s] == rightChain[s] && leftChain[s + 1] == rightChain[s + 1]) {
            s++;
        }
        int e = 0;
        while (e < (aLen - s) && e < (bLen - s)
            && leftChain[aLen - e] == rightChain[bLen - e]
            && leftChain[aLen - e - 1] == rightChain[bLen - e - 1]) {
            e++;
        }

        int a0 = s, a1 = aLen - e;
        int b0 = s, b1 = bLen - e;
        int subA = a1 - a0;
        int subB = b1 - b0;
        if (subA <= 0 || subB <= 0) return;

        bool shareStart = leftChain[a0] == rightChain[b0];
        bool shareEnd = leftChain[a1] == rightChain[b1];
        if (shareStart && shareEnd) {
            if (subA == 1 && subB == 1) return;
            if (subA == 1) {
                for (int k = b0 + 1; k < b1; k++) {
                    EmitOrientedTri(tris, leftChain[a0], rightChain[k + 1], rightChain[k], isTop);
                }
            } else if (subB == 1) {
                for (int k = a0; k < a1 - 1; k++) {
                    EmitOrientedTri(tris, leftChain[k], leftChain[k + 1], rightChain[b1], isTop);
                }
            } else {
                EmitOrientedTri(tris, leftChain[a0], leftChain[a0 + 1], rightChain[b0 + 1], isTop);
                ZipPairStrips(tris, pos, leftChain, a0 + 1, a1 - 1, rightChain, b0 + 1, b1 - 1, isTop);
                EmitOrientedTri(tris, leftChain[a1 - 1], leftChain[a1], rightChain[b1 - 1], isTop);
            }
            return;
        }

        if (shareStart) {
            if (subA == 1) {
                EmitOrientedTri(tris, leftChain[a0], leftChain[a1], rightChain[b0 + 1], isTop);
                for (int k = b0 + 1; k < b1; k++) {
                    EmitOrientedTri(tris, leftChain[a1], rightChain[k + 1], rightChain[k], isTop);
                }
            } else if (subB == 1) {
                for (int k = a0; k < a1; k++) {
                    EmitOrientedTri(tris, leftChain[k], leftChain[k + 1], rightChain[b1], isTop);
                }
            } else {
                EmitOrientedTri(tris, leftChain[a0], leftChain[a0 + 1], rightChain[b0 + 1], isTop);
                ZipPairStrips(tris, pos, leftChain, a0 + 1, a1, rightChain, b0 + 1, b1, isTop);
            }
            return;
        }

        if (shareEnd) {
            if (subA == 1) {
                for (int k = b0; k < b1; k++) {
                    EmitOrientedTri(tris, leftChain[a0], rightChain[k + 1], rightChain[k], isTop);
                }
            } else if (subB == 1) {
                for (int k = a0; k < a1; k++) {
                    EmitOrientedTri(tris, leftChain[k], leftChain[k + 1], rightChain[b0], isTop);
                }
            } else {
                ZipPairStrips(tris, pos, leftChain, a0, a1 - 1, rightChain, b0, b1 - 1, isTop);
                EmitOrientedTri(tris, leftChain[a1 - 1], leftChain[a1], rightChain[b1 - 1], isTop);
            }
            return;
        }

        ZipPairStrips(tris, pos, leftChain, a0, a1, rightChain, b0, b1, isTop);
    }

    int[] GetOrCreateEdgeChain(int u, int v, List<Vector3> pos, List<Color> cols, List<bool> rockFlags,
            List<float> snowList, bool[] baseOuterRim, bool[] baseWater, bool isTop, float dyThreshold, float slopeThreshold, int maxSegs,
            Dictionary<ulong, int[]> edgeChains, out int[] forwardView) {
        ulong key = EdgeKey(u, v);
        bool reversed = u > v;
        if (!edgeChains.TryGetValue(key, out int[] stored)) {
            int a = reversed ? v : u;
            int b = reversed ? u : v;
            bool aRim = baseOuterRim[a], bRim = baseOuterRim[b];
            bool aWat = baseWater[a], bWat = baseWater[b];
            int segs = 1;
            if (!(aRim && bRim)) {
                Vector3 pa = pos[a], pb = pos[b];
                float dy = Mathf.Abs(pa.y - pb.y);
                float dx = pa.x - pb.x, dz = pa.z - pb.z;
                float dxz = Mathf.Sqrt(dx * dx + dz * dz);
                float len3 = Vector3.Distance(pa, pb);
                float edgeSlope = dxz > 1e-4f ? dy / dxz : (dy > 0.01f ? 999f : 0f);
                float minSubdivLen = cellSize * 1.35f;
                float targetSegLen = cellSize * 1.18f;
                bool bothWater = aWat && bWat;
                bool steep = bothWater
                    ? (dy > dyThreshold * 1.15f && edgeSlope > slopeThreshold)
                    : (dy > dyThreshold || (edgeSlope > slopeThreshold && len3 > minSubdivLen));
                if (steep && len3 > minSubdivLen) {
                    int candidate = Mathf.RoundToInt(len3 / targetSegLen);
                    if (candidate >= 2) {
                        segs = Mathf.Min(candidate, maxSegs);
                    }
                }
            }

            stored = new int[segs + 1];
            stored[0] = a;
            stored[segs] = b;
            if (segs > 1) {
                Vector3 pa = pos[a], pb = pos[b];
                float dy = Mathf.Abs(pa.y - pb.y);
                float dxz = Mathf.Sqrt((pa.x - pb.x) * (pa.x - pb.x) + (pa.z - pb.z) * (pa.z - pb.z));
                float edgeSlope = dxz > 1e-4f ? dy / dxz : (dy > 0.01f ? 999f : 0f);
                float waterDamp = (aWat || bWat) ? 0.25f : 1f;
                float hAmp = Mathf.Min(cellSize * 0.10f, (dxz / segs) * 0.22f) * waterDamp;
                float vAmp = Mathf.Min((dy / segs) * 0.15f, cellSize * 0.16f) * waterDamp;
                float loY = Mathf.Min(pa.y, pb.y);
                float hiY = Mathf.Max(pa.y, pb.y);

                for (int s = 1; s < segs; s++) {
                    float t = (float)s / segs;
                    Vector3 pt = Vector3.Lerp(pa, pb, t);
                    EdgeHashOffsets(a, b, s, seed, out float rx, out float ry, out float rz);
                    pt.x += rx * hAmp;
                    pt.z += rz * hAmp;
                    if (dy > 0.02f) {
                        float minStepY = Mathf.Lerp(pa.y, pb.y, t) - vAmp;
                        float maxStepY = Mathf.Lerp(pa.y, pb.y, t) + vAmp;
                        float clampLo = loY + dy * 0.03f;
                        float clampHi = hiY - dy * 0.03f;
                        pt.y = Mathf.Clamp(pt.y + ry * vAmp, Mathf.Max(clampLo, minStepY), Mathf.Min(clampHi, maxStepY));
                        if ((aWat || bWat) && pt.y < loY) pt.y = loY;
                    }

                    Color midCol = Color.Lerp(cols[a], cols[b], t);
                    if (isTop) {
                        bool anyRim = aRim || bRim;
                        float minRockBlend = anyRim ? 0.85f : Smooth(0.45f, 1.05f, edgeSlope) * 0.78f;
                        midCol = ComputeSubdividedTopColor(midCol, t, pt, a, b, edgeSlope, anyRim, minRockBlend, ry, snowList, out float vSnow);
                        rockFlags.Add(edgeSlope > 0.75f || (rockFlags[a] && rockFlags[b]));
                        if (snowList != null) snowList.Add(vSnow);
                    } else {
                        float depth01 = Mathf.Clamp01(-pt.y / Mathf.Max(1f, bottomDepth));
                        Color uc = Color.Lerp(Color.Lerp(rockColor, underColor, 0.6f), underColor * 0.45f, depth01);
                        midCol = Shade(Color.Lerp(midCol, uc, 0.75f), ry * 0.03f);
                        midCol.a = 0f;
                        rockFlags.Add(true);
                        if (snowList != null) snowList.Add(0f);
                    }

                    int idx = pos.Count;
                    pos.Add(pt);
                    cols.Add(midCol);
                    stored[s] = idx;
                }
            }
            edgeChains.Add(key, stored);
        }

        if (!reversed) {
            forwardView = stored;
        } else {
            forwardView = new int[stored.Length];
            for (int k = 0; k < stored.Length; k++) forwardView[k] = stored[stored.Length - 1 - k];
        }
        return forwardView;
    }

    static bool IsEdgeSubdivided(Vector3 pa, Vector3 pb, float dyThreshold, float slopeThreshold, float minLen) {
        float dy = Mathf.Abs(pa.y - pb.y);
        float dx = pa.x - pb.x, dz = pa.z - pb.z;
        float dxz = Mathf.Sqrt(dx * dx + dz * dz);
        float len3 = Vector3.Distance(pa, pb);
        float edgeSlope = dxz > 1e-4f ? dy / dxz : (dy > 0.01f ? 999f : 0f);
        return dy > dyThreshold || (edgeSlope > slopeThreshold && len3 > minLen);
    }

    int[] BuildAlignedQuadtreeSizes(int cellsX, int cellsZ, int[] steps, System.Func<int, int, int, bool> canMergeBlock) {
        var sizes = new int[cellsX * cellsZ];
        for (int i = 0; i < sizes.Length; i++) sizes[i] = 1;
        var claimed = new bool[cellsX * cellsZ];

        foreach (int step in steps) {
            for (int iz = 0; iz + step <= cellsZ; iz += step) {
                for (int ix = 0; ix + step <= cellsX; ix += step) {
                    bool free = true;
                    for (int dz = 0; dz < step && free; dz++) {
                        int row = (iz + dz) * cellsX + ix;
                        for (int dx = 0; dx < step; dx++) {
                            if (claimed[row + dx]) {
                                free = false;
                                break;
                            }
                        }
                    }
                    if (!free || !canMergeBlock(ix, iz, step)) continue;
                    for (int dz = 0; dz < step; dz++) {
                        int row = (iz + dz) * cellsX + ix;
                        for (int dx = 0; dx < step; dx++) {
                            claimed[row + dx] = true;
                            sizes[row + dx] = step;
                        }
                    }
                }
            }
        }
        return sizes;
    }

    void EmitMergedQuadBlock(int x0, int z0, int step, int cellsX, int cellsZ, int[] sizes,
            List<int> loopBuf, System.Action<int, int, int> emitTri) {
        loopBuf.Clear();
        int dx = 0;
        while (dx < step) {
            loopBuf.Add(z0 * nx + (x0 + dx));
            int nbS = z0 > 0 ? sizes[(z0 - 1) * cellsX + (x0 + dx)] : 1;
            dx += Mathf.Min(step - dx, Mathf.Min(step, nbS));
        }
        int dz = 0;
        while (dz < step) {
            loopBuf.Add((z0 + dz) * nx + (x0 + step));
            int nbS = (x0 + step < cellsX) ? sizes[(z0 + dz) * cellsX + (x0 + step)] : 1;
            dz += Mathf.Min(step - dz, Mathf.Min(step, nbS));
        }
        dx = step;
        while (dx > 0) {
            loopBuf.Add((z0 + step) * nx + (x0 + dx));
            int curX = x0 + dx - 1;
            int nbS = (z0 + step < cellsZ) ? sizes[(z0 + step) * cellsX + curX] : 1;
            dx -= Mathf.Min(dx, Mathf.Min(step, nbS));
        }
        dz = step;
        while (dz > 0) {
            loopBuf.Add((z0 + dz) * nx + x0);
            int curZ = z0 + dz - 1;
            int nbS = x0 > 0 ? sizes[curZ * cellsX + (x0 - 1)] : 1;
            dz -= Mathf.Min(dz, Mathf.Min(step, nbS));
        }

        if (loopBuf.Count == 4) {
            emitTri(loopBuf[0], loopBuf[2], loopBuf[1]);
            emitTri(loopBuf[0], loopBuf[3], loopBuf[2]);
            return;
        }
        int center = (z0 + step / 2) * nx + (x0 + step / 2);
        int cnt = loopBuf.Count;
        for (int m = 0; m < cnt; m++) {
            emitTri(center, loopBuf[(m + 1) % cnt], loopBuf[m]);
        }
    }

    // 境界・水面・急崖・色境界をロックしたまま、同一平面上の内部頂点のみをHalf-Edge Collapseで間引く
    void CollapseFlatInteriorVertices(
            List<Vector3> pos,
            List<Color> cols,
            List<TriIdx> tris,
            bool[] initialLocks,
            float maxPlaneErr,
            float minDot,
            float maxColDiff,
            int maxPasses) {
        int nv = pos.Count;
        int nt = tris.Count;
        if (nv == 0 || nt == 0) return;

        var locked = new bool[nv];
        if (initialLocks != null) {
            int copyCount = Mathf.Min(nv, initialLocks.Length);
            for (int i = 0; i < copyCount; i++) {
                if (initialLocks[i]) locked[i] = true;
            }
        }

        var edgeCount = new Dictionary<ulong, int>(nt * 2, EdgeKeyComparer.Instance);
        var vertTris = new List<int>[nv];
        for (int ti = 0; ti < nt; ti++) {
            TriIdx tr = tris[ti];
            if (tr.a == tr.b || tr.b == tr.c || tr.c == tr.a) continue;
            AddEdgeRef(edgeCount, EdgeKey(tr.a, tr.b));
            AddEdgeRef(edgeCount, EdgeKey(tr.b, tr.c));
            AddEdgeRef(edgeCount, EdgeKey(tr.c, tr.a));
            (vertTris[tr.a] ??= new List<int>(6)).Add(ti);
            (vertTris[tr.b] ??= new List<int>(6)).Add(ti);
            (vertTris[tr.c] ??= new List<int>(6)).Add(ti);
        }

        // 開境界(count==1)や非多様体辺(count>=3)の端点はすべてロックし、外周や水際を絶対に崩さない
        foreach (KeyValuePair<ulong, int> kv in edgeCount) {
            if (kv.Value != 2) {
                locked[(int)(kv.Key >> 32)] = true;
                locked[(int)(kv.Key & 0xFFFFFFFFUL)] = true;
            }
        }

        var removedVert = new bool[nv];
        var removedTri = new bool[nt];
        var nbrU = new HashSet<int>();
        var nbrV = new HashSet<int>();

        for (int pass = 0; pass < maxPasses; pass++) {
            int collapsed = 0;
            for (int u = 0; u < nv; u++) {
                if (removedVert[u] || locked[u]) continue;
                List<int> uTris = vertTris[u];
                if (uTris == null || uTris.Count < 3) continue;

                // 削除済み三角形を都度除去してリスト肥大化を防ぐ
                int uw = 0;
                for (int i = 0; i < uTris.Count; i++) {
                    int ti = uTris[i];
                    if (!removedTri[ti]) uTris[uw++] = ti;
                }
                if (uw < uTris.Count) uTris.RemoveRange(uw, uTris.Count - uw);

                int liveUTris = uTris.Count;
                if (liveUTris < 3) {
                    locked[u] = true;
                    continue;
                }

                nbrU.Clear();
                int firstTi = uTris[0];
                for (int i = 0; i < liveUTris; i++) {
                    TriIdx tr = tris[uTris[i]];
                    if (tr.a != u) nbrU.Add(tr.a);
                    if (tr.b != u) nbrU.Add(tr.b);
                    if (tr.c != u) nbrU.Add(tr.c);
                }
                if (nbrU.Count != liveUTris || !IsSingleCycleFan(u, uTris, tris, removedTri, firstTi, liveUTris)) {
                    locked[u] = true;
                    continue;
                }

                int bestV = -1;
                int bestT1 = -1;
                int bestT2 = -1;
                float bestDistSq = float.MaxValue;

                foreach (int v in nbrU) {
                    if (v == u || removedVert[v]) continue;
                    if (ColorDiffMax(cols[u], cols[v]) > maxColDiff) continue;

                    List<int> vTris = vertTris[v];
                    if (vTris == null) continue;
                    int vw = 0;
                    for (int i = 0; i < vTris.Count; i++) {
                        int ti = vTris[i];
                        if (!removedTri[ti]) vTris[vw++] = ti;
                    }
                    if (vw < vTris.Count) vTris.RemoveRange(vw, vTris.Count - vw);
                    // 極端なハブ頂点化（針状ファンとO(k^2)走査）を防ぐ
                    if (vTris.Count + liveUTris - 4 > 14) continue;

                    int sharedCount = 0;
                    int t1 = -1, t2 = -1, opp1 = -1, opp2 = -1;
                    bool badShared = false;
                    for (int i = 0; i < liveUTris; i++) {
                        int ti = uTris[i];
                        TriIdx tr = tris[ti];
                        if (tr.a != v && tr.b != v && tr.c != v) continue;
                        int opp = tr.a != u && tr.a != v ? tr.a : (tr.b != u && tr.b != v ? tr.b : tr.c);
                        if (sharedCount == 0) {
                            t1 = ti;
                            opp1 = opp;
                        } else if (sharedCount == 1) {
                            t2 = ti;
                            opp2 = opp;
                        } else {
                            badShared = true;
                            break;
                        }
                        sharedCount++;
                    }
                    if (badShared || sharedCount != 2 || opp1 == opp2 || opp1 < 0 || opp2 < 0) continue;

                    nbrV.Clear();
                    bool dupTri = false;
                    for (int i = 0; i < vTris.Count; i++) {
                        TriIdx tr = tris[vTris[i]];
                        if (tr.a != v) nbrV.Add(tr.a);
                        if (tr.b != v) nbrV.Add(tr.b);
                        if (tr.c != v) nbrV.Add(tr.c);
                        if ((tr.a == v || tr.b == v || tr.c == v)
                            && (tr.a == opp1 || tr.b == opp1 || tr.c == opp1)
                            && (tr.a == opp2 || tr.b == opp2 || tr.c == opp2)) {
                            dupTri = true;
                            break;
                        }
                    }
                    if (dupTri) continue;

                    // Hoppe Link Condition: 共通近傍は対向2頂点のみ
                    bool linkOk = true;
                    foreach (int w in nbrU) {
                        if (w == v || w == opp1 || w == opp2) continue;
                        if (nbrV.Contains(w)) {
                            linkOk = false;
                            break;
                        }
                    }
                    if (!linkOk) continue;

                    bool geomOk = true;
                    Vector3 pu = pos[u];
                    for (int i = 0; i < uTris.Count; i++) {
                        int ti = uTris[i];
                        if (removedTri[ti] || ti == t1 || ti == t2) continue;
                        TriIdx tr = tris[ti];
                        Vector3 n0 = Vector3.Cross(pos[tr.b] - pos[tr.a], pos[tr.c] - pos[tr.a]);
                        float sq0 = n0.sqrMagnitude;
                        if (sq0 < 1e-6f) {
                            geomOk = false;
                            break;
                        }
                        int na = tr.a == u ? v : tr.a;
                        int nb = tr.b == u ? v : tr.b;
                        int nc = tr.c == u ? v : tr.c;
                        Vector3 npa = pos[na], npb = pos[nb], npc = pos[nc];
                        Vector3 n1 = Vector3.Cross(npb - npa, npc - npa);
                        float sq1 = n1.sqrMagnitude;
                        if (sq1 < 1e-6f) {
                            geomOk = false;
                            break;
                        }
                        float e0 = (npb - npa).sqrMagnitude;
                        float e1 = (npc - npb).sqrMagnitude;
                        float e2 = (npa - npc).sqrMagnitude;
                        float maxSq = Mathf.Max(e0, Mathf.Max(e1, e2));
                        if (sq1 < maxSq * maxSq * 0.0025f) {
                            geomOk = false;
                            break;
                        }
                        Vector3 u0 = n0 / Mathf.Sqrt(sq0);
                        Vector3 u1 = n1 / Mathf.Sqrt(sq1);
                        if (u1.y < 0.25f || Vector3.Dot(u0, u1) < minDot) {
                            geomOk = false;
                            break;
                        }
                        if (Mathf.Abs(Vector3.Dot(pu - npa, u1)) > maxPlaneErr) {
                            geomOk = false;
                            break;
                        }
                    }
                    if (!geomOk) continue;

                    float distSq = (pos[v] - pu).sqrMagnitude;
                    if (distSq < bestDistSq) {
                        bestDistSq = distSq;
                        bestV = v;
                        bestT1 = t1;
                        bestT2 = t2;
                    }
                }

                if (bestV < 0) continue;

                removedVert[u] = true;
                removedTri[bestT1] = true;
                removedTri[bestT2] = true;
                List<int> dstTris = vertTris[bestV];
                for (int i = 0; i < uTris.Count; i++) {
                    int ti = uTris[i];
                    if (removedTri[ti] || ti == bestT1 || ti == bestT2) continue;
                    TriIdx tr = tris[ti];
                    tris[ti] = new TriIdx(
                        tr.a == u ? bestV : tr.a,
                        tr.b == u ? bestV : tr.b,
                        tr.c == u ? bestV : tr.c);
                    dstTris.Add(ti);
                }
                uTris.Clear();
                collapsed++;
            }
            if (collapsed == 0) break;
        }

        int write = 0;
        for (int ti = 0; ti < nt; ti++) {
            if (!removedTri[ti]) tris[write++] = tris[ti];
        }
        tris.RemoveRange(write, nt - write);
    }

    static void AddEdgeRef(Dictionary<ulong, int> edgeCount, ulong key) {
        edgeCount.TryGetValue(key, out int c);
        edgeCount[key] = c + 1;
    }

    static float ColorDiffMax(Color a, Color b) {
        return Mathf.Max(Mathf.Abs(a.r - b.r), Mathf.Max(Mathf.Abs(a.g - b.g), Mathf.Abs(a.b - b.b)));
    }

    static bool IsSingleCycleFan(int center, List<int> uTris, List<TriIdx> tris, bool[] removedTri, int firstTi, int liveCount) {
        if (firstTi < 0) return false;
        TriIdx f = tris[firstTi];
        int startW = f.a != center ? f.a : f.b;
        int curW = f.c != center && f.c != startW ? f.c : (f.b != center && f.b != startW ? f.b : f.a);
        int prevTi = firstTi;
        int steps = 1;
        while (curW != startW && steps <= liveCount) {
            int nextTi = -1;
            int nextW = -1;
            for (int i = 0; i < uTris.Count; i++) {
                int ti = uTris[i];
                if (removedTri[ti] || ti == prevTi) continue;
                TriIdx tr = tris[ti];
                if (tr.a != curW && tr.b != curW && tr.c != curW) continue;
                nextTi = ti;
                nextW = tr.a != center && tr.a != curW ? tr.a : (tr.b != center && tr.b != curW ? tr.b : tr.c);
                break;
            }
            if (nextTi < 0 || nextW < 0) return false;
            prevTi = nextTi;
            curW = nextW;
            steps++;
        }
        return curW == startW && steps == liveCount;
    }

    static float ChainLength3D(List<Vector3> pos, int[] chain) {
        float sum = 0f;
        for (int i = 0; i < chain.Length - 1; i++) {
            sum += Vector3.Distance(pos[chain[i]], pos[chain[i + 1]]);
        }
        return sum;
    }

    static bool IsCornerPlunge(List<Vector3> pos, int cornerV, int end1, int end2, int oppMid,
            int n1, int n2, int o1, int o2) {
        if (n1 < 2 || n2 < 2 || Mathf.Abs(n1 - n2) > 2) return false;
        if (Mathf.Min(n1, n2) < Mathf.Max(o1, o2) + 1) return false;
        float dy1 = Mathf.Abs(pos[cornerV].y - pos[end1].y);
        float dy2 = Mathf.Abs(pos[cornerV].y - pos[end2].y);
        float oppDy1 = Mathf.Abs(pos[oppMid].y - pos[end1].y);
        float oppDy2 = Mathf.Abs(pos[oppMid].y - pos[end2].y);
        return dy1 > oppDy1 * 1.45f && dy2 > oppDy2 * 1.45f;
    }

    static void EmitCornerPlunge(List<TriIdx> tris, List<Vector3> pos, int[] c1, int[] c2, int[] opp1, int[] opp2Rev, bool isTop) {
        int n1 = c1.Length - 1, n2 = c2.Length - 1;
        ZipBridgeRows(tris, pos, opp1, opp2Rev, isTop);
        EmitOrientedTri(tris, c1[0], c1[1], c2[1], isTop);
        if (n1 > 1 || n2 > 1) ZipPairStrips(tris, pos, c1, 1, n1, c2, 1, n2, isTop);
    }

    // 分割数が異なる対向辺でも同一端点への扇状集中を避けつつ、両軸の3D距離比に合わせて中間列を補間する
    void SweepQuadBridge(List<TriIdx> tris, List<Vector3> pos, List<Color> cols, List<bool> rockFlags,
            List<float> snowList, bool[] baseOuterRim, bool[] baseWater, bool isTop, int maxSegs, float targetSegLen,
            int[] startSpan, int[] endSpan, int[] sideA, int[] sideB, int saltA, int saltB, bool zipCurFirst) {
        int nA = sideA.Length - 1;
        int nB_ = sideB.Length - 1;
        int steps = Mathf.Max(nA, nB_);
        if (steps <= 1) {
            if (zipCurFirst) ZipBridgeRows(tris, pos, endSpan, startSpan, isTop);
            else ZipBridgeRows(tris, pos, startSpan, endSpan, isTop);
            return;
        }

        int[] prevChain = startSpan;
        int prevPrefixStart = 0;
        int prevPrefixEnd = prevChain.Length - 1;
        int prevIdxA = 0;
        int prevIdxB = 0;

        for (int step = 1; step <= steps; step++) {
            int[] curChain;
            int curPrefixStart = 0;
            int curPrefixEnd;
            int idxA = step == steps ? nA : Mathf.RoundToInt((float)step * nA / steps);
            int idxB = step == steps ? nB_ : Mathf.RoundToInt((float)step * nB_ / steps);

            if (step == steps) {
                curChain = endSpan;
                curPrefixEnd = curChain.Length - 1;
            } else {
                int activeSegs = prevPrefixEnd - prevPrefixStart;
                bool carryPrefix = idxA == prevIdxA && activeSegs >= 2;
                bool carrySuffix = idxB == prevIdxB && (activeSegs - (carryPrefix ? 1 : 0)) >= 2;

                int prefixLen = carryPrefix ? prevPrefixStart + 1 : 0;
                int suffixLen = carrySuffix ? (prevChain.Length - prevPrefixEnd) : 0;
                int anchorA = carryPrefix ? prevChain[prevPrefixStart + 1] : sideA[idxA];
                int anchorB = carrySuffix ? prevChain[prevPrefixEnd - 1] : sideB[idxB];

                float spanLen = Vector3.Distance(pos[anchorA], pos[anchorB]);
                int endSegs = endSpan.Length - 1;
                float tRemain = 1f / (steps - step + 1);
                int interpSegs = Mathf.RoundToInt(Mathf.Lerp(activeSegs, endSegs, tRemain));
                int distSegs = Mathf.Clamp(Mathf.RoundToInt(spanLen / targetSegLen), 1, maxSegs);
                int spanSegs = spanLen < targetSegLen * 1.45f
                    ? distSegs
                    : Mathf.Clamp(Mathf.RoundToInt(Mathf.Lerp(distSegs, interpSegs, 0.35f)), 1, maxSegs);

                curChain = new int[prefixLen + spanSegs + 1 + suffixLen];
                for (int k = 0; k < prefixLen; k++) curChain[k] = prevChain[k];
                curChain[prefixLen] = anchorA;
                curChain[prefixLen + spanSegs] = anchorB;
                for (int k = 0; k < suffixLen; k++) {
                    curChain[prefixLen + spanSegs + 1 + k] = prevChain[prevPrefixEnd + k];
                }

                float segLen = spanLen / spanSegs;
                for (int s = 1; s < spanSegs; s++) {
                    curChain[prefixLen + s] = AddLinearBridgeVertex(anchorA, anchorB, (float)s / spanSegs,
                        saltA + step, saltB, s, pos, cols, rockFlags, snowList,
                        baseOuterRim, baseWater, isTop, segLen);
                }
                curPrefixStart = prefixLen;
                curPrefixEnd = prefixLen + spanSegs;
            }

            if (zipCurFirst) ZipBridgeRows(tris, pos, curChain, prevChain, isTop);
            else ZipBridgeRows(tris, pos, prevChain, curChain, isTop);

            prevChain = curChain;
            prevPrefixStart = curPrefixStart;
            prevPrefixEnd = curPrefixEnd;
            prevIdxA = idxA;
            prevIdxB = idxB;
        }
    }

    // ベースグリッドの4辺・クワッド構造を保ったまま急崖だけを多段分割し、Tジャンクションや針状三角形を根本から防ぐ
    void BuildSurfaceMeshQuads(List<TriIdx> tris, List<Vector3> pos, List<Color> cols, List<bool> rockFlags,
            List<float> snowList, bool[] baseOuterRim, bool[] baseWater, bool isTop, float dyThreshold, float slopeThreshold, int maxSegs) {
        int cellsX = nx - 1;
        int cellsZ = nz - 1;
        int[] flatSizes = null;
        if (isTop) {
            float minLen = cellSize * 1.35f;
            var cellFlat = new bool[cellsX * cellsZ];
            for (int iz = 0; iz < cellsZ; iz++) {
                for (int ix = 0; ix < cellsX; ix++) {
                    int a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
                    if (!inside[a] || !inside[b] || !inside[c] || !inside[d]) continue;
                    if (baseOuterRim[a] || baseOuterRim[b] || baseOuterRim[c] || baseOuterRim[d]) continue;
                    if (baseWater[a] || baseWater[b] || baseWater[c] || baseWater[d]) continue;
                    if (bankSlopeFlag[a] || bankSlopeFlag[b] || bankSlopeFlag[c] || bankSlopeFlag[d]) continue;
                    if (shore[a] > 0.02f || shore[b] > 0.02f || shore[c] > 0.02f || shore[d] > 0.02f) continue;
                    if (mountain[a] >= 0.05f || mountain[b] >= 0.05f || mountain[c] >= 0.05f || mountain[d] >= 0.05f) continue;
                    if (rockFlags[a] || rockFlags[b] || rockFlags[c] || rockFlags[d]) continue;
                    if (snowMap[a] > 0.01f || snowMap[b] > 0.01f || snowMap[c] > 0.01f || snowMap[d] > 0.01f) continue;
                    if (mask[a] < cliffWidth * 1.4f || mask[b] < cliffWidth * 1.4f
                        || mask[c] < cliffWidth * 1.4f || mask[d] < cliffWidth * 1.4f) continue;
                    if (slopeNy[a] < 0.968f || slopeNy[b] < 0.968f || slopeNy[c] < 0.968f || slopeNy[d] < 0.968f) continue;
                    if (IsEdgeSubdivided(pos[a], pos[b], dyThreshold, slopeThreshold, minLen)
                        || IsEdgeSubdivided(pos[b], pos[d], dyThreshold, slopeThreshold, minLen)
                        || IsEdgeSubdivided(pos[c], pos[d], dyThreshold, slopeThreshold, minLen)
                        || IsEdgeSubdivided(pos[a], pos[c], dyThreshold, slopeThreshold, minLen)) {
                        continue;
                    }
                    cellFlat[iz * cellsX + ix] = true;
                }
            }

            flatSizes = BuildAlignedQuadtreeSizes(cellsX, cellsZ, new[] { 8, 4, 2 }, (bx, bz, step) => {
                for (int dz = 0; dz < step; dz++) {
                    int row = (bz + dz) * cellsX + bx;
                    for (int dx = 0; dx < step; dx++) {
                        if (!cellFlat[row + dx]) return false;
                    }
                }
                int c00 = bz * nx + bx;
                int c10 = bz * nx + (bx + step);
                int c01 = (bz + step) * nx + bx;
                int c11 = (bz + step) * nx + (bx + step);
                float h00 = pos[c00].y, h10 = pos[c10].y, h01 = pos[c01].y, h11 = pos[c11].y;
                Color k00 = cols[c00], k10 = cols[c10], k01 = cols[c01], k11 = cols[c11];
                float invStep = 1f / step;
                for (int dz = 0; dz <= step; dz++) {
                    float tz = dz * invStep;
                    float hL = Mathf.Lerp(h00, h01, tz);
                    float hR = Mathf.Lerp(h10, h11, tz);
                    Color colL = Color.Lerp(k00, k01, tz);
                    Color colR = Color.Lerp(k10, k11, tz);
                    int row = (bz + dz) * nx + bx;
                    for (int dx = 0; dx <= step; dx++) {
                        int v = row + dx;
                        float tx = dx * invStep;
                        if (Mathf.Abs(pos[v].y - Mathf.Lerp(hL, hR, tx)) > 0.36f) return false;
                        Color cRef = Color.Lerp(colL, colR, tx);
                        Color cv = cols[v];
                        if (Mathf.Abs(cv.r - cRef.r) > 0.065f
                            || Mathf.Abs(cv.g - cRef.g) > 0.065f
                            || Mathf.Abs(cv.b - cRef.b) > 0.065f) {
                            return false;
                        }
                    }
                }
                return true;
            });
        }

        var quadLoop = new List<int>(32);
        var edgeChains = new Dictionary<ulong, int[]>((nx * nz) / 2, EdgeKeyComparer.Instance);

        for (int iz = 0; iz < nz - 1; iz++) {
            for (int ix = 0; ix < nx - 1; ix++) {
                if (flatSizes != null) {
                    int leafS = flatSizes[iz * cellsX + ix];
                    if (leafS >= 2) {
                        if (ix % leafS == 0 && iz % leafS == 0) {
                            EmitMergedQuadBlock(ix, iz, leafS, cellsX, cellsZ, flatSizes, quadLoop, (p0, p1, p2) => {
                                AddCanonicalTri(tris, pos, p0, p1, p2, true);
                            });
                        }
                        continue;
                    }
                }

                int a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
                if (!(inside[a] || inside[b] || inside[c] || inside[d])) continue;

                CellTriContour(a, b, c, d, iz, 0, out int i0, out int i1, out int i2);
                CellTriContour(a, b, c, d, iz, 1, out int j0, out int j1, out int j2);
                bool t0Keep = inside[i0] || inside[i1] || inside[i2];
                bool t1Keep = inside[j0] || inside[j1] || inside[j2];

                if (t0Keep && t1Keep) {
                    GetOrCreateEdgeChain(a, b, pos, cols, rockFlags, snowList, baseOuterRim, baseWater, isTop, dyThreshold, slopeThreshold, maxSegs, edgeChains, out int[] bot);
                    GetOrCreateEdgeChain(b, d, pos, cols, rockFlags, snowList, baseOuterRim, baseWater, isTop, dyThreshold, slopeThreshold, maxSegs, edgeChains, out int[] right);
                    GetOrCreateEdgeChain(c, d, pos, cols, rockFlags, snowList, baseOuterRim, baseWater, isTop, dyThreshold, slopeThreshold, maxSegs, edgeChains, out int[] top);
                    GetOrCreateEdgeChain(a, c, pos, cols, rockFlags, snowList, baseOuterRim, baseWater, isTop, dyThreshold, slopeThreshold, maxSegs, edgeChains, out int[] left);

                    int nB = bot.Length - 1;
                    int nR = right.Length - 1;
                    int nT = top.Length - 1;
                    int nL = left.Length - 1;

                    float targetSegLen = cellSize * 1.18f;
                    float lenB = ChainLength3D(pos, bot);
                    float lenT = ChainLength3D(pos, top);
                    float lenL = ChainLength3D(pos, left);
                    float lenR = ChainLength3D(pos, right);
                    float cornerMaxSpan = targetSegLen * 1.65f;

                    if (nB == 1 && nR == 1 && nT == 1 && nL == 1) {
                        AddCanonicalTri(tris, pos, i0, i1, i2, isTop);
                        AddCanonicalTri(tris, pos, j0, j1, j2, isTop);
                    } else if (nB == 1 && nT == 1 && Mathf.Abs(nL - nR) <= 1 && Mathf.Max(lenB, lenT) <= cornerMaxSpan) {
                        ZipPairStrips(tris, pos, left, 0, nL, right, 0, nR, isTop);
                    } else if (nL == 1 && nR == 1 && Mathf.Abs(nB - nT) <= 1 && Mathf.Max(lenL, lenR) <= cornerMaxSpan) {
                        ZipPairStrips(tris, pos, top, 0, nT, bot, 0, nB, isTop);
                    } else if (IsCornerPlunge(pos, a, c, b, d, nL, nB, nT, nR)) {
                        EmitCornerPlunge(tris, pos, left, bot, top, right, isTop);
                    } else if (IsCornerPlunge(pos, b, a, d, c, nB, nR, nL, nT)) {
                        EmitCornerPlunge(tris, pos, ReverseChain(bot), right, left, ReverseChain(top), isTop);
                    } else if (IsCornerPlunge(pos, d, b, c, a, nR, nT, nB, nL)) {
                        EmitCornerPlunge(tris, pos, ReverseChain(right), ReverseChain(top), ReverseChain(bot), ReverseChain(left), isTop);
                    } else if (IsCornerPlunge(pos, c, d, a, b, nT, nL, nR, nB)) {
                        EmitCornerPlunge(tris, pos, top, ReverseChain(left), ReverseChain(right), bot, isTop);
                    } else {
                        int maxLR = Mathf.Max(nL, nR);
                        int maxBT = Mathf.Max(nB, nT);
                        bool sweepRows = maxLR != maxBT
                            ? maxLR > maxBT
                            : (nL + nR != nB + nT ? nL + nR > nB + nT : (lenL + lenR) >= (lenB + lenT));
                        if (sweepRows) {
                            SweepQuadBridge(tris, pos, cols, rockFlags, snowList, baseOuterRim, baseWater,
                                isTop, maxSegs, targetSegLen, bot, top, left, right,
                                a * 31 + ix, d * 17 + iz, true);
                        } else {
                            SweepQuadBridge(tris, pos, cols, rockFlags, snowList, baseOuterRim, baseWater,
                                isTop, maxSegs, targetSegLen, left, right, bot, top,
                                a * 19 + ix, d * 43 + iz, false);
                        }
                    }
                } else {
                    int k0 = t0Keep ? i0 : j0;
                    int k1 = t0Keep ? i1 : j1;
                    int k2 = t0Keep ? i2 : j2;
                    // 島の最外周で3頂点のうち1頂点のみ内側にある境界三角形を隣接クワッドの辺分割と一致させる
                    int p, q, apex;
                    if (inside[k2]) { p = k0; q = k1; apex = k2; }
                    else if (inside[k0]) { p = k1; q = k2; apex = k0; }
                    else { p = k2; q = k0; apex = k1; }

                    GetOrCreateEdgeChain(p, apex, pos, cols, rockFlags, snowList, baseOuterRim, baseWater, isTop, dyThreshold, slopeThreshold, maxSegs, edgeChains, out int[] chL);
                    GetOrCreateEdgeChain(q, apex, pos, cols, rockFlags, snowList, baseOuterRim, baseWater, isTop, dyThreshold, slopeThreshold, maxSegs, edgeChains, out int[] chR);
                    if (chL.Length == 2 && chR.Length == 2) {
                        AddCanonicalTri(tris, pos, k0, k1, k2, isTop);
                    } else {
                        bool normalUp = BaseGridCrossY(p, q, apex) >= 0f;
                        int lastL = chL.Length - 2;
                        int lastR = chR.Length - 2;
                        if (lastL > 0 || lastR > 0) {
                            if (normalUp) ZipPairStrips(tris, pos, chR, 0, lastR, chL, 0, lastL, isTop);
                            else ZipPairStrips(tris, pos, chL, 0, lastL, chR, 0, lastR, isTop);
                        }
                        if (normalUp) EmitOrientedTri(tris, chL[lastL], chR[lastR], apex, isTop);
                        else EmitOrientedTri(tris, chR[lastR], chL[lastL], apex, isTop);
                    }
                }
            }
        }
    }

    void BuildCoarseBottomSurface(List<TriIdx> tris, List<Vector3> pos) {
        // 下部は偶数ストライド(4x4〜8x8)で大きく荒くし、外周スカート帯だけを1x1で閉じてTジャンクションを防ぐ
        int step = resolution >= 320 ? 8 : (resolution >= 140 ? 6 : 4);
        while (step > 2 && (nx - 1 < step * 2 || nz - 1 < step * 2)) step -= 2;

        int cellsX = nx - 1;
        int cellsZ = nz - 1;
        int nbX = (cellsX + step - 1) / step;
        int nbZ = (cellsZ + step - 1) / step;
        var coarseFull = new bool[nbX * nbZ];

        for (int bz = 0; bz < nbZ; bz++) {
            int z0 = bz * step;
            int z1 = Mathf.Min(z0 + step, cellsZ);
            if (z1 - z0 != step) continue;
            for (int bx = 0; bx < nbX; bx++) {
                int x0 = bx * step;
                int x1 = Mathf.Min(x0 + step, cellsX);
                if (x1 - x0 != step) continue;

                bool allInside = true;
                for (int iz = z0; iz <= z1 && allInside; iz++) {
                    int row = iz * nx;
                    for (int ix = x0; ix <= x1; ix++) {
                        if (!inside[row + ix]) {
                            allInside = false;
                            break;
                        }
                    }
                }
                coarseFull[bz * nbX + bx] = allInside;
            }
        }

        int halfStep = step / 2;
        for (int bz = 0; bz < nbZ; bz++) {
            int z0 = bz * step;
            int z1 = Mathf.Min(z0 + step, cellsZ);
            for (int bx = 0; bx < nbX; bx++) {
                int x0 = bx * step;
                int x1 = Mathf.Min(x0 + step, cellsX);
                int bIdx = bz * nbX + bx;

                if (coarseFull[bIdx]) {
                    bool botCoarse = bz > 0 && coarseFull[(bz - 1) * nbX + bx];
                    bool rightCoarse = bx + 1 < nbX && coarseFull[bz * nbX + (bx + 1)];
                    bool topCoarse = bz + 1 < nbZ && coarseFull[(bz + 1) * nbX + bx];
                    bool leftCoarse = bx > 0 && coarseFull[bz * nbX + (bx - 1)];

                    int c00 = z0 * nx + x0;
                    int c10 = z0 * nx + x1;
                    int c01 = z1 * nx + x0;
                    int c11 = z1 * nx + x1;

                    if (botCoarse && rightCoarse && topCoarse && leftCoarse) {
                        AddCanonicalTri(tris, pos, c00, c10, c11, false);
                        AddCanonicalTri(tris, pos, c00, c11, c01, false);
                    } else {
                        int center = (z0 + halfStep) * nx + (x0 + halfStep);
                        if (botCoarse) {
                            AddCanonicalTri(tris, pos, c00, c10, center, false);
                        } else {
                            for (int ix = x0; ix < x1; ix++) {
                                AddCanonicalTri(tris, pos, z0 * nx + ix, z0 * nx + (ix + 1), center, false);
                            }
                        }
                        if (rightCoarse) {
                            AddCanonicalTri(tris, pos, c10, c11, center, false);
                        } else {
                            for (int iz = z0; iz < z1; iz++) {
                                AddCanonicalTri(tris, pos, iz * nx + x1, (iz + 1) * nx + x1, center, false);
                            }
                        }
                        if (topCoarse) {
                            AddCanonicalTri(tris, pos, c11, c01, center, false);
                        } else {
                            for (int ix = x1; ix > x0; ix--) {
                                AddCanonicalTri(tris, pos, z1 * nx + ix, z1 * nx + (ix - 1), center, false);
                            }
                        }
                        if (leftCoarse) {
                            AddCanonicalTri(tris, pos, c01, c00, center, false);
                        } else {
                            for (int iz = z1; iz > z0; iz--) {
                                AddCanonicalTri(tris, pos, iz * nx + x0, (iz - 1) * nx + x0, center, false);
                            }
                        }
                    }
                    continue;
                }

                for (int iz = z0; iz < z1; iz++) {
                    for (int ix = x0; ix < x1; ix++) {
                        int a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
                        if (!(inside[a] || inside[b] || inside[c] || inside[d])) continue;
                        CellTriContour(a, b, c, d, iz, 0, out int i0, out int i1, out int i2);
                        CellTriContour(a, b, c, d, iz, 1, out int j0, out int j1, out int j2);
                        if (inside[i0] || inside[i1] || inside[i2]) AddCanonicalTri(tris, pos, i0, i1, i2, false);
                        if (inside[j0] || inside[j1] || inside[j2]) AddCanonicalTri(tris, pos, j0, j1, j2, false);
                    }
                }
            }
        }
    }

    float ForestValue(float lx, float lz) {
        return Fbm(lx / half, lz / half, 7, 2.5f, 3);
    }

    float MeadowValue(float lx, float lz) {
        float px = lx / half;
        float pz = lz / half;
        float wx = px + (Fbm(px + 3.1f, pz - 2.4f, 12, 4.2f, 2) - 0.5f) * 0.24f;
        float wz = pz + (Fbm(px - 4.7f, pz + 1.9f, 13, 4.2f, 2) - 0.5f) * 0.24f;
        float baseVal = Fbm(wx, wz, 11, 2.5f, 3);
        // ワールドスケール(約22〜45m)の湾入を足し、大きな草原の等高線カーブを崩す
        float lobe = (Fbm(lx * 0.022f + 1.3f, lz * 0.022f - 2.7f, 14, 1f, 2) - 0.5f) * 0.24f;
        return baseVal + lobe;
    }

    void BiomeWeights(float lx, float lz, out float forest, out float bare, out float meadow) {
        float fVal = ForestValue(lx, lz);
        float mVal = MeadowValue(lx, lz);
        forest = Smooth(forestThreshold - 0.06f, forestThreshold + 0.04f, fVal);
        // 木の配置領域(forest)は維持しつつ、草原側は林縁の木立の中へ波打ちながら薄く滲ませて切る
        float forestLobe = (Fbm(lx * 0.024f - 3.4f, lz * 0.024f + 4.1f, 15, 1f, 2) - 0.5f) * 0.24f;
        float forestKeepout = forestThreshold >= 0.999f
            ? 0f
            : (forestThreshold <= 0.001f ? 1f : Smooth(forestThreshold - 0.11f, forestThreshold + 0.08f, fVal + forestLobe));
        float rawMeadow = meadowThreshold >= 0.999f
            ? 0f
            : (meadowThreshold <= 0.001f ? 1f : Smooth(meadowThreshold - 0.15f, meadowThreshold + 0.08f, mVal));
        meadow = rawMeadow * (1f - forestKeepout);
        bare = Mathf.Clamp01(1f - forest - meadow);
    }

    bool IsLakeFrozen(int lid) {
        if (lid <= 0 || lid >= lakeLevels.Count) return false;
        if (lakeFrozen != null && lid < lakeFrozen.Count) return lakeFrozen[lid];
        return lakeLevels[lid] >= snowLine - 5f;
    }

    float ComputeSnowThresholdAt(float lx, float lz, float curv = 0f) {
        float px = lx / half;
        float pz = lz / half;
        // 滑らかなドメインワープ付きノイズで山肌ごとに有機的な雪舌・岩尾根を作り、高周波の小斑点は抑える
        float wx = px + (Fbm(px + 1.9f, pz - 4.1f, 11, 3.0f, 2) - 0.5f) * 0.22f;
        float wz = pz + (Fbm(px - 6.2f, pz + 2.7f, 13, 3.0f, 2) - 0.5f) * 0.22f;
        float b = Mathf.Clamp((Fbm(wx, wz, 10, 2.2f, 2) - 0.5f) * 3.0f, -1f, 1f);
        float m = Mathf.Clamp((Fbm(wx + 3.7f, wz - 2.1f, 12, 3.8f, 2) - 0.5f) * 2.8f, -1f, 1f);
        float wave = Mathf.Clamp(b * 0.65f + m * 0.35f, -1f, 1f);

        float upSpan = Mathf.Max(28f, mountainAmp * 0.32f);
        float clearanceAbovePlains = Mathf.Max(0f, snowLine - (baseHeight + plainsAmp * 0.85f));
        float downSpan = Mathf.Min(Mathf.Max(14f, mountainAmp * 0.16f), clearanceAbovePlains * 0.65f);
        float shift = wave >= 0f ? wave * downSpan : wave * upSpan;

        // 尾根(凸)は風衝で雪が積もりにくく、谷(凹)は吹き溜まりで少し低い標高まで雪が残る
        if (curv > 0f) {
            float ridgeLift = Smooth(0.08f, 1.0f, curv) * Mathf.Clamp(mountainAmp * 0.14f, 8f, 34f);
            shift -= ridgeLift;
        } else if (curv < 0f) {
            float gullyDrop = Smooth(0.08f, 1.0f, -curv) * Mathf.Min(Mathf.Clamp(mountainAmp * 0.13f, 7f, 30f), clearanceAbovePlains * 0.55f);
            shift += gullyDrop;
        }
        if (shift > 0f && clearanceAbovePlains > 0f) {
            shift = Mathf.Min(shift, clearanceAbovePlains * 0.82f);
        }
        return snowLine - shift;
    }

    float ComputeSnowWeight(float lx, float y, float lz, float surfaceNy, bool isOuterRim, float curv = 0f) {
        if (isOuterRim) return 0f;
        float localSnowLine = ComputeSnowThresholdAt(lx, lz, curv);
        float elevW = Smooth(localSnowLine - 8.5f, localSnowLine + 8.5f, y);
        // 急傾斜には雪を積もらせず岩肌を露出させる(rockSlope基準)
        float snowSlopeMin = Mathf.Clamp(rockSlope - 0.14f, 0.48f, 0.78f);
        float snowSlopeMax = Mathf.Clamp(snowSlopeMin + 0.20f, 0.68f, 0.94f);
        float slopeW = Smooth(snowSlopeMin, snowSlopeMax, surfaceNy);
        float w = elevW * slopeW;
        // 傾斜のある尾根筋のみ連続的に雪を薄くし、高周波斑点は作らない
        if (curv > 0.20f && w > 0.001f) {
            float sloped = 1f - Smooth(0.76f, 0.95f, surfaceNy);
            float ridgeScour = Smooth(0.20f, 0.95f, curv) * sloped * 0.26f;
            w *= 1f - ridgeScour;
        }
        return Mathf.Clamp01(w);
    }

    // 岩肌に孤立した単頂点〜小塊の白い斑点・雪面の小穴を除去し、まとまりのある積雪面にする
    void ComputeSnowMap() {
        int n = nx * nz;
        if (snowMap == null || snowMap.Length != n) snowMap = new float[n];
        for (int i = 0; i < n; i++) {
            if (!inside[i] || mask[i] < cliffWidth * 0.5f) {
                snowMap[i] = 0f;
                continue;
            }
            snowMap[i] = ComputeSnowWeight(xz[i].x, H[i], xz[i].y, snowSlopeNy[i], false, ridgeCurv[i]);
        }

        var tmpSnow = new float[n];
        for (int pass = 0; pass < 4; pass++) {
            System.Array.Copy(snowMap, tmpSnow, n);
            for (int i = 0; i < n; i++) {
                if (!inside[i] || mask[i] < cliffWidth * 0.5f) {
                    snowMap[i] = 0f;
                    continue;
                }
                float sum = 0f;
                int strongNb = 0;
                int cnt = 0;
                for (int k = 0; k < 6; k++) {
                    int nb = Nb(i, k);
                    if (nb >= 0 && inside[nb]) {
                        float w = tmpSnow[nb];
                        sum += w;
                        if (w > 0.30f) strongNb++;
                        cnt++;
                    }
                }
                if (cnt == 0) continue;
                float avg = sum / cnt;
                float self = tmpSnow[i];
                if (strongNb <= 2 && avg < 0.28f && self > avg) {
                    self = Mathf.Min(self, avg * 0.22f);
                } else if (strongNb >= cnt - 1 && self < avg) {
                    self = Mathf.Max(self, avg * 0.90f);
                }
                float smoothed = Mathf.Lerp(self, avg, 0.44f);
                if (pass >= 2 && strongNb <= 1) smoothed = 0f;
                snowMap[i] = smoothed < 0.16f ? 0f : smoothed;
            }
        }

        // 雪面内の非急峻な小ピンホールを先に埋めて連続面として扱う
        var visited = new bool[n];
        var q = new Queue<int>();
        float holeSlopeFloor = Mathf.Clamp(rockSlope - 0.08f, 0.50f, 0.80f);
        for (int i = 0; i < n; i++) {
            if (visited[i] || !inside[i] || snowMap[i] >= 0.22f) continue;
            var hole = new List<int>();
            bool touchesNonSnowEdge = false;
            float sumNy = 0f;
            float nbSnowSum = 0f;
            int nbSnowCnt = 0;
            visited[i] = true;
            q.Enqueue(i);
            while (q.Count > 0) {
                int c = q.Dequeue();
                hole.Add(c);
                sumNy += snowSlopeNy[c];
                for (int k = 0; k < 6; k++) {
                    int nb = Nb(c, k);
                    if (nb < 0 || !inside[nb] || mask[nb] < cliffWidth * 0.5f) {
                        touchesNonSnowEdge = true;
                        continue;
                    }
                    if (snowMap[nb] >= 0.22f) {
                        nbSnowSum += snowMap[nb];
                        nbSnowCnt++;
                    } else if (!visited[nb]) {
                        visited[nb] = true;
                        q.Enqueue(nb);
                    }
                }
            }
            if (!touchesNonSnowEdge && hole.Count <= 28 && nbSnowCnt > 0 && (sumNy / hole.Count) >= holeSlopeFloor) {
                float fillVal = Mathf.Clamp01(nbSnowSum / nbSnowCnt);
                foreach (int c in hole) snowMap[c] = fillVal;
            }
        }

        // 半透明ハロー(0.01..0.24)を先に引き締めてから、急崖へ突き出た先端と孤立小塊を整理する
        for (int i = 0; i < n; i++) {
            snowMap[i] = snowMap[i] <= 0.24f ? 0f : Smooth(0.24f, 0.78f, snowMap[i]);
        }

        for (int peel = 0; peel < 2; peel++) {
            System.Array.Copy(snowMap, tmpSnow, n);
            for (int i = 0; i < n; i++) {
                if (tmpSnow[i] <= 0f) continue;
                int nbOn20 = 0;
                int strongNb35 = 0;
                for (int k = 0; k < 6; k++) {
                    int nb = Nb(i, k);
                    if (nb >= 0) {
                        if (tmpSnow[nb] > 0.20f) nbOn20++;
                        if (tmpSnow[nb] > 0.35f) strongNb35++;
                    }
                }
                if (nbOn20 <= 1 || (strongNb35 <= 2 && (snowSlopeNy[i] < 0.78f || tmpSnow[i] < 0.85f))) {
                    snowMap[i] = 0f;
                }
            }
        }

        // 可視成分のみで孤立した雪パッチ・残り端を切り離して除去する
        PruneSmallSnowComponents(visited, q, 0.15f);
        for (int i = 0; i < n; i++) {
            if (snowMap[i] <= 0f || snowMap[i] > 0.15f) continue;
            bool hasKeptCoreNb = false;
            for (int k = 0; k < 6; k++) {
                int nb = Nb(i, k);
                if (nb >= 0 && snowMap[nb] > 0.15f) {
                    hasKeptCoreNb = true;
                    break;
                }
            }
            if (!hasKeptCoreNb) snowMap[i] = 0f;
        }
    }

    void PruneSmallSnowComponents(bool[] visited, Queue<int> q, float threshold) {
        int n = nx * nz;
        System.Array.Clear(visited, 0, n);
        q.Clear();
        var comps = new List<List<int>>();
        int maxCompSize = 0;
        for (int i = 0; i < n; i++) {
            if (visited[i] || snowMap[i] <= threshold) continue;
            var comp = new List<int>();
            visited[i] = true;
            q.Enqueue(i);
            while (q.Count > 0) {
                int c = q.Dequeue();
                comp.Add(c);
                for (int k = 0; k < 6; k++) {
                    int nb = Nb(c, k);
                    if (nb >= 0 && !visited[nb] && snowMap[nb] > threshold) {
                        visited[nb] = true;
                        q.Enqueue(nb);
                    }
                }
            }
            if (comp.Count > maxCompSize) maxCompSize = comp.Count;
            comps.Add(comp);
        }
        int minCompVerts = Mathf.Clamp(Mathf.RoundToInt(nx * nz * 0.0007f), 20, 75);
        foreach (var comp in comps) {
            if (comp.Count < minCompVerts && (comps.Count > 1 || comp.Count < 12) && comp.Count < maxCompSize * 0.25f) {
                foreach (int c in comp) snowMap[c] = 0f;
            }
        }
    }

    float ComputeGreeneryThresholdAt(float lx, float lz) {
        float px = lx / half;
        float pz = lz / half;
        // 緑地の限界高度にも有機的なうねりを持たせる
        float wx = px + (Fbm(px - 3.4f, pz + 5.2f, 9, 3.2f, 2) - 0.5f) * 0.20f;
        float wz = pz + (Fbm(px + 4.8f, pz - 1.9f, 15, 3.2f, 2) - 0.5f) * 0.20f;
        float b = Mathf.Clamp((Fbm(wx + 2.1f, wz - 4.7f, 11, 2.8f, 2) - 0.5f) * 3.0f, -1f, 1f);
        float m = Mathf.Clamp((Fbm(wx - 6.3f, wz + 3.1f, 14, 7.5f, 2) - 0.5f) * 2.8f, -1f, 1f);
        float wave = Mathf.Clamp(b * 0.55f + m * 0.45f, -1f, 1f);
        float span = Mathf.Clamp(mountainAmp * 0.11f, 6f, 22f);
        return greeneryLine + wave * span;
    }

    float ComputeBarrenRockWeight(float lx, float y, float lz) {
        float localGreeneryLine = ComputeGreeneryThresholdAt(lx, lz);
        return Smooth(localGreeneryLine - 6.5f, localGreeneryLine + 5.5f, y);
    }

    void ComputeVertexColors(Color[] topCols, Color[] underCols, bool[] isRockOrSnow) {
        int n = nx * nz;
        float elevSpan = Mathf.Max(10f, mountainAmp);
        ComputeSnowMap();
        for (int i = 0; i < n; i++) {
            if (!inside[i] || mask[i] < 0.001f) {
                Color rimCol = Color.Lerp(rockColor, underColor, 0.5f);
                rimCol.a = 0f;
                topCols[i] = rimCol;
                underCols[i] = rimCol;
                isRockOrSnow[i] = true;
                continue;
            }

            float y = H[i];
            float ny = slopeNy[i];
            float px = xz[i].x;
            float pz = xz[i].y;
            float curv = ridgeCurv[i];

            BiomeWeights(px, pz, out float forestW, out _, out _);
            Color ground = Color.Lerp(grassColor, forestGroundColor, forestW);

            float elevT = Mathf.Clamp01((y - baseHeight) / elevSpan);
            ground = Color.Lerp(ground, Color.Lerp(ground, rockColor, 0.22f), elevT * 0.45f);

            // 川底・湖底・土手斜面の土砂と岩の表現(凍る標高の湖周辺は砂ではなく雪・岩色にする)
            float sandNoise = Fbm(px / half, pz / half, 8, 5f, 2);
            float sandT = shore[i] * Mathf.Lerp(0.65f, 1.15f, sandNoise);
            if (lakeId[i] > 0 || river[i]) sandT = Mathf.Max(sandT, 0.90f);
            sandT = Mathf.Clamp01(sandT) * Smooth(0.40f, 0.78f, ny);
            bool frozenShore = IsLakeFrozen(lakeId[i]) || HasAdjacentFrozenLake(i);
            Color shoreCol = frozenShore ? Color.Lerp(rockColor, snowColor, 0.65f) : sandColor;
            ground = Color.Lerp(ground, shoreCol, sandT);

            // 土手の斜面は土・岩色に引き締める
            if (bankSlopeFlag[i]) {
                Color bankEarth = Color.Lerp(sandColor * 0.72f, rockColor, 0.62f);
                ground = Color.Lerp(ground, bankEarth, 0.75f);
            }

            float barrenT = ComputeBarrenRockWeight(px, y, pz);
            if (frozenShore) barrenT *= 1f - sandT;
            float rockSlopeT = Smooth(rockSlope + 0.10f, rockSlope - 0.10f, ny);
            float rockT = Mathf.Max(rockSlopeT, barrenT);
            float rockBand = Mathf.Clamp01(y / Mathf.Max(10f, baseHeight + mountainAmp));
            Color rock = Color.Lerp(rockColor * 0.82f, rockColor * 1.10f, rockBand);
            Color col = Color.Lerp(ground, rock, rockT);

            float edgeT = 1f - Smooth(0f, cliffWidth * 0.55f, mask[i]);
            col = Color.Lerp(col, Color.Lerp(rockColor, underColor, 0.35f), edgeT);

            float snowT = snowMap[i];
            col = Color.Lerp(col, snowColor, snowT);

            topCols[i] = col;
            // 水中・土手の急斜面も isRockOrSnow = true にすることで、橋の接続判定(alpha=1)が必ず土手の上の岸にスナップする
            isRockOrSnow[i] = rockT > 0.5f || snowT > 0.5f || edgeT > 0.5f || river[i] || lakeId[i] > 0 || bankSlopeFlag[i];

            float depth01 = Mathf.Clamp01(-bottomY[i] / Mathf.Max(1f, bottomDepth));
            Color rimStart = Color.Lerp(rockColor, underColor, 0.48f);
            Color uc = Color.Lerp(rimStart, underColor * 0.45f, Smooth(0.02f, 0.85f, depth01));
            uc.a = 0f;
            underCols[i] = uc;
        }
    }

    Color ComputeWaterDepthColor(float depth, float jitterVal) {
        Color shallow = Shade(waterColor, 0.05f + jitterVal);
        Color deep = Shade(new Color(
            waterColor.r * 0.56f,
            waterColor.g * 0.72f,
            Mathf.Min(1f, waterColor.b * 0.92f),
            waterColor.a), jitterVal * 0.5f);
        return Color.Lerp(shallow, deep, Smooth(1.0f, 14.0f, depth));
    }

    // ================= 水メッシュ =================
    void WaterGridOrigin(out float x0, out float z0) {
        x0 = -(resolution * 0.5f + 0.25f) * cellSize;
        z0 = -(nzCells * 0.5f) * cellZ;
    }

    void WorldToGridBbox(float minX, float maxX, float minZ, float maxZ,
            out int ix0, out int ix1, out int iz0, out int iz1) {
        WaterGridOrigin(out float x0, out float z0);
        float invX = 1f / cellSize, invZ = 1f / cellZ;
        ix0 = Mathf.Clamp(Mathf.FloorToInt((minX - x0) * invX) - 1, 0, nx - 1);
        ix1 = Mathf.Clamp(Mathf.CeilToInt((maxX - x0) * invX) + 1, 0, nx - 1);
        iz0 = Mathf.Clamp(Mathf.FloorToInt((minZ - z0) * invZ) - 1, 0, nz - 1);
        iz1 = Mathf.Clamp(Mathf.CeilToInt((maxZ - z0) * invZ) + 1, 0, nz - 1);
    }

    static float AreaXZ(Vector2 a, Vector2 b, Vector2 c) {
        return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) * 0.5f;
    }

    static float Cross2D(Vector2 o, Vector2 a, Vector2 b) {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }

    static bool PtInTri2D(Vector2 p, Vector2 a, Vector2 b, Vector2 c, float eps) {
        float d0 = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        float d1 = (c.x - b.x) * (p.y - b.y) - (c.y - b.y) * (p.x - b.x);
        float d2 = (a.x - c.x) * (p.y - c.y) - (a.y - c.y) * (p.x - c.x);
        return (d0 >= -eps && d1 >= -eps && d2 >= -eps) || (d0 <= eps && d1 <= eps && d2 <= eps);
    }

    static bool PtInTriXZ(float px, float pz, Vector3 a, Vector3 b, Vector3 c, float eps) {
        return PtInTri2D(new Vector2(px, pz), new Vector2(a.x, a.z), new Vector2(b.x, b.z), new Vector2(c.x, c.z), eps);
    }

    static bool SegsIntersect(Vector2 a1, Vector2 a2, Vector2 b1, Vector2 b2) {
        float d1 = Cross2D(b1, b2, a1), d2 = Cross2D(b1, b2, a2);
        float d3 = Cross2D(a1, a2, b1), d4 = Cross2D(a1, a2, b2);
        return ((d1 > 1e-4f && d2 < -1e-4f) || (d1 < -1e-4f && d2 > 1e-4f))
            && ((d3 > 1e-4f && d4 < -1e-4f) || (d3 < -1e-4f && d4 > 1e-4f));
    }

    static bool TryBarycentricY(float px, float pz, Vector3 a, Vector3 b, Vector3 c, out float y) {
        float det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
        if (Mathf.Abs(det) < 1e-6f) {
            y = 0f;
            return false;
        }
        float w0 = ((b.z - c.z) * (px - c.x) + (c.x - b.x) * (pz - c.z)) / det;
        float w1 = ((c.z - a.z) * (px - c.x) + (a.x - c.x) * (pz - c.z)) / det;
        float w2 = 1f - w0 - w1;
        y = w0 * a.y + w1 * b.y + w2 * c.y;
        return w0 >= -0.02f && w1 >= -0.02f && w2 >= -0.02f;
    }

    // 地中へ貫通させる水ポリゴンが乾いた地面や崖の外側へ飛び出さないかを判定する
    bool IsWaterTriSafe(Vector3 pa, Vector3 pb, Vector3 pc, int allowLakeId, float lvl, float margin) {
        float minX = Mathf.Min(pa.x, Mathf.Min(pb.x, pc.x)) - cellSize;
        float maxX = Mathf.Max(pa.x, Mathf.Max(pb.x, pc.x)) + cellSize;
        float minZ = Mathf.Min(pa.z, Mathf.Min(pb.z, pc.z)) - cellZ;
        float maxZ = Mathf.Max(pa.z, Mathf.Max(pb.z, pc.z)) + cellZ;
        WorldToGridBbox(minX, maxX, minZ, maxZ, out int ix0, out int ix1, out int iz0, out int iz1);

        for (int gz = iz0; gz <= iz1; gz++) {
            int row = gz * nx;
            for (int gx = ix0; gx <= ix1; gx++) {
                int gi = row + gx;
                Vector2 gp = xz[gi];
                if (!TryBarycentricY(gp.x, gp.y, pa, pb, pc, out float wy)) continue;

                if (allowLakeId > 0) {
                    if (lakeId[gi] == allowLakeId) continue;
                    if (!inside[gi] || mask[gi] <= cliffWidth * 1.2f) return false;
                    if (river[gi]) {
                        if (float.IsNaN(riverW[gi]) || riverW[gi] < lvl - 0.1f || H[gi] < lvl + 0.05f) return false;
                        continue;
                    }
                    if (lakeId[gi] > 0 && !lakeFrozen[lakeId[gi]]) {
                        if (wy > lakeLevels[lakeId[gi]] + 0.05f) return false;
                        continue;
                    }
                    if (H[gi] < wy + margin) return false;
                } else {
                    if (river[gi]) continue;
                    if (!inside[gi]) return false;
                    if (lakeId[gi] > 0 && !lakeFrozen[lakeId[gi]]) {
                        if (wy > lakeLevels[lakeId[gi]] + 0.05f) return false;
                        continue;
                    }
                    if (H[gi] < wy + margin) return false;
                }
            }
        }
        return true;
    }

    Mesh BuildWaterMesh() {
        var mb = new MeshBuilder(false);
        var cr = new System.Random(seed + 3);
        var lakeGridCovered = new bool[(nx - 1) * (nz - 1) * 2];
        var riverMouth = new bool[nx * nz];
        EmitLakeWaterPolygons(mb, lakeGridCovered, riverMouth);
        EmitRiverGridWater(mb, lakeGridCovered, riverMouth);
        AddWaterfalls(mb, cr);
        return mb.ToMesh("IslandWater");
    }

    void EmitLakeWaterPolygons(MeshBuilder mb, bool[] lakeGridCovered, bool[] riverMouth) {
        int n = nx * nz;
        int lCount = lakeLevels.Count;
        var lMinX = new int[lCount];
        var lMaxX = new int[lCount];
        var lMinZ = new int[lCount];
        var lMaxZ = new int[lCount];
        for (int lid = 1; lid < lCount; lid++) {
            lMinX[lid] = nx;
            lMaxX[lid] = -1;
            lMinZ[lid] = nz;
            lMaxZ[lid] = -1;
        }
        for (int iz = 0; iz < nz; iz++) {
            int row = iz * nx;
            for (int ix = 0; ix < nx; ix++) {
                int lid = lakeId[row + ix];
                if (lid <= 0) continue;
                if (ix < lMinX[lid]) lMinX[lid] = ix;
                if (ix > lMaxX[lid]) lMaxX[lid] = ix;
                if (iz < lMinZ[lid]) lMinZ[lid] = iz;
                if (iz > lMaxZ[lid]) lMaxZ[lid] = iz;
            }
        }

        var extSet = new bool[n];
        var extVis = new bool[n];
        var holeVis = new bool[n];
        var rimPin = new bool[n];
        var inRegTris = new List<int>(256);
        var polyTris = new List<int>(256);
        var interiorAnchors = new HashSet<int>();
        Color shallowShore = ComputeWaterDepthColor(0f, 0f);

        for (int lid = 1; lid < lCount; lid++) {
            if (IsLakeFrozen(lid) || lMaxX[lid] < 0) continue;
            float lvl = lakeLevels[lid];
            int bx0 = Mathf.Max(0, lMinX[lid] - 4), bx1 = Mathf.Min(nx - 1, lMaxX[lid] + 4);
            int bz0 = Mathf.Max(0, lMinZ[lid] - 4), bz1 = Mathf.Min(nz - 1, lMaxZ[lid] + 4);

            System.Array.Clear(rimPin, 0, rimPin.Length);
            inRegTris.Clear();
            BuildLakeRegionAndLoops(lid, lvl, bx0, bx1, bz0, bz1, extSet, extVis, holeVis,
                rimPin, riverMouth, inRegTris, out List<List<int>> loops, out List<bool> isOuters);
            if (loops.Count == 0) {
                EmitLakeGridFallback(lid, bx0, bx1, bz0, bz1, mb, lakeGridCovered);
                continue;
            }

            SimplifyLakeLoops(lid, lvl, loops, isOuters, rimPin);
            if (!BridgeAndTriangulateLake(loops, isOuters, polyTris)) {
                EmitLakeGridFallback(lid, bx0, bx1, bz0, bz1, mb, lakeGridCovered);
                continue;
            }

            for (int ti = 0; ti < inRegTris.Count; ti++) {
                lakeGridCovered[inRegTris[ti]] = true;
            }

            HashSet<long> constrained = CollectLakeConstrainedEdges(loops);
            FlipLakeDelaunayEdges(constrained, polyTris);
            interiorAnchors.Clear();
            InsertLakeDepthAnchors(lid, lvl, bx0, bx1, bz0, bz1, loops, constrained, polyTris, interiorAnchors);
            FlipLakeDelaunayEdges(constrained, polyTris);
            for (int ti = 0; ti < polyTris.Count; ti += 3) {
                int ia = polyTris[ti], ib = polyTris[ti + 1], ic = polyTris[ti + 2];
                // 外周の頂点色が岸の出入りで交互に濃淡しないよう、内部アンカー（および川との接続口）にのみ深度色を持たせる
                Color ca = (interiorAnchors.Contains(ia) || riverMouth[ia]) ? ComputeWaterDepthColor(lvl - H[ia], 0f) : shallowShore;
                Color cb = (interiorAnchors.Contains(ib) || riverMouth[ib]) ? ComputeWaterDepthColor(lvl - H[ib], 0f) : shallowShore;
                Color cc = (interiorAnchors.Contains(ic) || riverMouth[ic]) ? ComputeWaterDepthColor(lvl - H[ic], 0f) : shallowShore;
                mb.Tri(Pos(ia, lvl), Pos(ib, lvl), Pos(ic, lvl), ca, cb, cc, Vector3.up);
            }
        }
    }

    void BuildLakeRegionAndLoops(int lid, float lvl, int bx0, int bx1, int bz0, int bz1,
            bool[] extSet, bool[] extVis, bool[] holeVis, bool[] rimPin, bool[] riverMouth, List<int> inRegTris,
            out List<List<int>> loops, out List<bool> isOuters) {
        for (int gz = bz0; gz <= bz1; gz++) {
            int row = gz * nx;
            for (int gx = bx0; gx <= bx1; gx++) {
                int gi = row + gx;
                extSet[gi] = lakeId[gi] == lid;
                extVis[gi] = false;
                holeVis[gi] = false;
            }
        }

        // 湖の1リング外周が十分高ければ地中へ拡張し、ギザギザな岸境界を滑らかに簡略化できるようにする
        var toAdd = new List<int>(64);
        for (int gz = bz0; gz <= bz1; gz++) {
            int row = gz * nx;
            for (int gx = bx0; gx <= bx1; gx++) {
                int i = row + gx;
                if (extSet[i] || river[i] || !inside[i] || mask[i] <= cliffWidth * 1.35f) continue;
                if (lakeId[i] > 0 && lakeId[i] != lid) continue;
                if (H[i] < lvl + 0.38f) continue;

                bool adj = false, safe = true;
                for (int k = 0; k < 6; k++) {
                    int nb = Nb(i, k);
                    if (nb < 0 || !inside[nb] || mask[nb] <= cliffWidth * 1.25f) {
                        safe = false;
                        break;
                    }
                    if (extSet[nb]) adj = true;
                    if (lakeId[nb] == 0 && !river[nb] && H[nb] < lvl + 0.25f) {
                        safe = false;
                        break;
                    }
                }
                if (adj && safe) toAdd.Add(i);
            }
        }
        for (int k = 0; k < toAdd.Count; k++) extSet[toAdd[k]] = true;

        // 外枠からBFSし、水没せず地中に隠れる小さな穴ループを塗りつぶす
        var q = new Queue<int>(128);
        for (int gx = bx0; gx <= bx1; gx++) {
            int i0 = bz0 * nx + gx, i1 = bz1 * nx + gx;
            if (!extSet[i0] && !extVis[i0]) { extVis[i0] = true; q.Enqueue(i0); }
            if (!extSet[i1] && !extVis[i1]) { extVis[i1] = true; q.Enqueue(i1); }
        }
        for (int gz = bz0 + 1; gz < bz1; gz++) {
            int i0 = gz * nx + bx0, i1 = gz * nx + bx1;
            if (!extSet[i0] && !extVis[i0]) { extVis[i0] = true; q.Enqueue(i0); }
            if (!extSet[i1] && !extVis[i1]) { extVis[i1] = true; q.Enqueue(i1); }
        }
        while (q.Count > 0) {
            int c = q.Dequeue();
            for (int k = 0; k < 6; k++) {
                int nb = Nb(c, k);
                if (nb < 0) continue;
                int gx = nb % nx, gz = nb / nx;
                if (gx < bx0 || gx > bx1 || gz < bz0 || gz > bz1) continue;
                if (!extSet[nb] && !extVis[nb]) {
                    extVis[nb] = true;
                    q.Enqueue(nb);
                }
            }
        }
        var comp = new List<int>(64);
        for (int gz = bz0; gz <= bz1; gz++) {
            int row = gz * nx;
            for (int gx = bx0; gx <= bx1; gx++) {
                int i = row + gx;
                if (extSet[i] || extVis[i] || holeVis[i]) continue;
                comp.Clear();
                holeVis[i] = true;
                q.Enqueue(i);
                bool coverOk = true;
                while (q.Count > 0) {
                    int c = q.Dequeue();
                    comp.Add(c);
                    if (!inside[c] || mask[c] <= cliffWidth * 1.25f || river[c]
                            || H[c] < lvl + 0.35f || (lakeId[c] > 0 && lakeId[c] != lid)) {
                        coverOk = false;
                    }
                    for (int k = 0; k < 6; k++) {
                        int nb = Nb(c, k);
                        if (nb < 0) continue;
                        int nbx = nb % nx, nbz = nb / nx;
                        if (nbx < bx0 || nbx > bx1 || nbz < bz0 || nbz > bz1) continue;
                        if (!extSet[nb] && !extVis[nb] && !holeVis[nb]) {
                            holeVis[nb] = true;
                            q.Enqueue(nb);
                        }
                    }
                }
                if (coverOk) {
                    for (int ci = 0; ci < comp.Count; ci++) extSet[comp[ci]] = true;
                }
            }
        }

        // riverW を持つ河岸頂点は水面高さが川と連続する必要があるため、平らな湖ポリゴン(lvl)には含めない
        for (int gz = bz0; gz <= bz1; gz++) {
            int row = gz * nx;
            for (int gx = bx0; gx <= bx1; gx++) {
                int gi = row + gx;
                if (extSet[gi] && lakeId[gi] != lid && !float.IsNaN(riverW[gi])) extSet[gi] = false;
            }
        }

        var edgeCount = new Dictionary<long, int>(256);
        var edgeList = new List<long>(256);
        int cz0 = Mathf.Max(0, bz0), cz1 = Mathf.Min(nz - 2, bz1);
        int cx0 = Mathf.Max(0, bx0), cx1 = Mathf.Min(nx - 2, bx1);
        for (int gz = cz0; gz <= cz1; gz++) {
            for (int gx = cx0; gx <= cx1; gx++) {
                int a = gz * nx + gx, b = a + 1, c = a + nx, d = c + 1;
                for (int t = 0; t < 2; t++) {
                    CellTri(a, b, c, d, gz, t, out int i0, out int i1, out int i2);
                    bool allExt = extSet[i0] && extSet[i1] && extSet[i2];
                    int triIdx = (gz * (nx - 1) + gx) * 2 + t;
                    if (!allExt) {
                        if (FirstLakeId(i0, i1, i2) == lid) {
                            rimPin[i0] = true;
                            rimPin[i1] = true;
                            rimPin[i2] = true;
                            if (river[i0] || river[i1] || river[i2]
                                    || !float.IsNaN(riverW[i0]) || !float.IsNaN(riverW[i1]) || !float.IsNaN(riverW[i2])) {
                                if (lakeId[i0] == lid) riverMouth[i0] = true;
                                if (lakeId[i1] == lid) riverMouth[i1] = true;
                                if (lakeId[i2] == lid) riverMouth[i2] = true;
                            }
                        }
                        continue;
                    }
                    inRegTris.Add(triIdx);
                    if (AreaXZ(xz[i0], xz[i1], xz[i2]) < 0f) {
                        int tmp = i1; i1 = i2; i2 = tmp;
                    }
                    int e0 = i0, e1 = i1, e2 = i2;
                    for (int e = 0; e < 3; e++) {
                        int u = e == 0 ? e0 : (e == 1 ? e1 : e2);
                        int v = e == 0 ? e1 : (e == 1 ? e2 : e0);
                        int lo = u < v ? u : v, hi = u < v ? v : u;
                        long key = ((long)lo << 24) | (uint)hi;
                        edgeCount.TryGetValue(key, out int cnt);
                        edgeCount[key] = cnt + 1;
                        edgeList.Add(((long)u << 24) | (uint)v);
                    }
                }
            }
        }

        var outNext = new Dictionary<int, List<int>>(128);
        for (int i = 0; i < edgeList.Count; i++) {
            int u = (int)(edgeList[i] >> 24), v = (int)(edgeList[i] & 0xFFFFFFL);
            int lo = u < v ? u : v, hi = u < v ? v : u;
            if (edgeCount[((long)lo << 24) | (uint)hi] != 1) continue;
            if (!outNext.TryGetValue(u, out List<int> lst)) {
                lst = new List<int>(2);
                outNext[u] = lst;
            }
            lst.Add(v);
        }

        var used = new HashSet<long>();
        loops = new List<List<int>>(8);
        isOuters = new List<bool>(8);
        foreach (KeyValuePair<int, List<int>> kv in outNext) {
            for (int li = 0; li < kv.Value.Count; li++) {
                int start = kv.Key, nxt = kv.Value[li];
                if (used.Contains(((long)start << 24) | (uint)nxt)) continue;

                var lp = new List<int>(32);
                int cur = start, prevV = -1;
                while (true) {
                    long ek = ((long)cur << 24) | (uint)nxt;
                    if (!used.Add(ek)) break;
                    lp.Add(cur);
                    prevV = cur;
                    cur = nxt;
                    if (cur == start) break;
                    if (!outNext.TryGetValue(cur, out List<int> cands)) break;

                    int pick = -1;
                    if (cands.Count == 1) {
                        if (!used.Contains(((long)cur << 24) | (uint)cands[0])) pick = cands[0];
                    } else {
                        // 分岐点では常に最も左回り(CCW)へ曲がり、8の字交差を防ぐ
                        Vector2 dIn = (xz[cur] - xz[prevV]).normalized;
                        float bestAng = float.MaxValue;
                        for (int ci = 0; ci < cands.Count; ci++) {
                            if (used.Contains(((long)cur << 24) | (uint)cands[ci])) continue;
                            Vector2 dOut = (xz[cands[ci]] - xz[cur]).normalized;
                            float ang = Mathf.Atan2(dIn.x * dOut.y - dIn.y * dOut.x, Vector2.Dot(dIn, dOut));
                            if (ang < bestAng) {
                                bestAng = ang;
                                pick = cands[ci];
                            }
                        }
                    }
                    if (pick < 0) break;
                    nxt = pick;
                }
                if (lp.Count >= 3 && cur == start) {
                    double sa = 0;
                    for (int i = 0; i < lp.Count; i++) {
                        Vector2 va = xz[lp[i]], vc = xz[lp[(i + 1) % lp.Count]];
                        sa += (double)va.x * vc.y - (double)va.y * vc.x;
                    }
                    loops.Add(lp);
                    isOuters.Add(sa > 0);
                }
            }
        }
    }

    void SimplifyLakeLoops(int lid, float lvl, List<List<int>> loops, List<bool> isOuters, bool[] rimPin) {
        for (int lpi = 0; lpi < loops.Count; lpi++) {
            List<int> lp = loops[lpi];
            bool isOuter = isOuters[lpi];
            var dirty = new bool[lp.Count];
            for (int i = 0; i < lp.Count; i++) dirty[i] = true;

            bool prog = true;
            while (prog && lp.Count > 3) {
                prog = false;
                for (int i = 0; i < lp.Count && lp.Count > 3; i++) {
                    if (!dirty[i]) continue;
                    int m = lp.Count, ip = (i - 1 + m) % m, inx = (i + 1) % m;
                    int vp = lp[ip], vc = lp[i], vn = lp[inx];
                    Vector2 pp = xz[vp], pc = xz[vc], pn = xz[vn];
                    float area = AreaXZ(pp, pc, pn);

                    bool ok = false;
                    if (!rimPin[vc]) {
                        if (Mathf.Abs(area) < 0.01f) {
                            ok = true;
                        } else {
                            bool shrinks = isOuter ? (area > 0f) : (area < 0f);
                            if (!(shrinks && lakeId[vc] == lid)) {
                                ok = true;
                                for (int e = 0; e < m && ok; e++) {
                                    int e2 = (e + 1) % m;
                                    if (e == ip || e == i || e2 == ip || e2 == i || e == inx || e2 == inx) continue;
                                    if (SegsIntersect(pp, pn, xz[lp[e]], xz[lp[e2]])) ok = false;
                                }
                                for (int e = 0; e < m && ok; e++) {
                                    if (e == ip || e == i || e == inx) continue;
                                    if (PtInTri2D(xz[lp[e]], pp, pc, pn, 0.05f)) ok = false;
                                }
                                for (int o = 0; o < loops.Count && ok; o++) {
                                    List<int> ol = loops[o];
                                    if (ol == lp) continue;
                                    for (int e = 0; e < ol.Count && ok; e++) {
                                        Vector2 o0 = xz[ol[e]], o1 = xz[ol[(e + 1) % ol.Count]];
                                        if (PtInTri2D(o0, pp, pc, pn, 0.05f) || SegsIntersect(pp, pn, o0, o1)) ok = false;
                                    }
                                }
                                if (ok && shrinks) {
                                    float minX = Mathf.Min(pp.x, Mathf.Min(pc.x, pn.x)) - cellSize;
                                    float maxX = Mathf.Max(pp.x, Mathf.Max(pc.x, pn.x)) + cellSize;
                                    float minZ = Mathf.Min(pp.y, Mathf.Min(pc.y, pn.y)) - cellZ;
                                    float maxZ = Mathf.Max(pp.y, Mathf.Max(pc.y, pn.y)) + cellZ;
                                    WorldToGridBbox(minX, maxX, minZ, maxZ, out int ix0, out int ix1, out int iz0, out int iz1);
                                    for (int gz = iz0; gz <= iz1 && ok; gz++) {
                                        int row = gz * nx;
                                        for (int gx = ix0; gx <= ix1; gx++) {
                                            int gi = row + gx;
                                            if (lakeId[gi] == lid && PtInTri2D(xz[gi], pp, pc, pn, 0.35f)) {
                                                ok = false;
                                                break;
                                            }
                                        }
                                    }
                                } else if (ok) {
                                    ok = IsWaterTriSafe(Pos(vp, lvl), Pos(vc, lvl), Pos(vn, lvl), lid, lvl, 0.35f);
                                }
                            }
                        }
                    }

                    if (ok) {
                        lp.RemoveAt(i);
                        var nd = new bool[lp.Count];
                        for (int k = 0; k < lp.Count; k++) nd[k] = dirty[k < i ? k : k + 1];
                        dirty = nd;
                        dirty[(i - 1 + lp.Count) % lp.Count] = true;
                        dirty[i % lp.Count] = true;
                        i = Mathf.Max(-1, i - 2);
                        prog = true;
                    } else {
                        dirty[i] = false;
                    }
                }
            }
        }
    }

    bool BridgeAndTriangulateLake(List<List<int>> loops, List<bool> isOuters, List<int> allPolyTris) {
        allPolyTris.Clear();
        var outerLoops = new List<List<int>>(loops.Count);
        var holeLoops = new List<List<int>>(loops.Count);
        for (int i = 0; i < loops.Count; i++) {
            if (isOuters[i]) outerLoops.Add(loops[i]);
            else holeLoops.Add(loops[i]);
        }

        for (int oi = 0; oi < outerLoops.Count; oi++) {
            List<int> poly = outerLoops[oi];
            for (int hi = holeLoops.Count - 1; hi >= 0; hi--) {
                List<int> hl = holeLoops[hi];
                int hMax = 0;
                for (int k = 1; k < hl.Count; k++) {
                    if (xz[hl[k]].x > xz[hl[hMax]].x) hMax = k;
                }
                Vector2 hp = xz[hl[hMax]];
                bool inOut = false;
                for (int pi = 0, pj = poly.Count - 1; pi < poly.Count; pj = pi++) {
                    Vector2 pa = xz[poly[pi]], pb = xz[poly[pj]];
                    if (((pa.y > hp.y) != (pb.y > hp.y))
                            && (hp.x < (pb.x - pa.x) * (hp.y - pa.y) / (pb.y - pa.y) + pa.x)) {
                        inOut = !inOut;
                    }
                }
                if (!inOut) continue;

                int bestP = -1;
                float bestD2 = float.MaxValue;
                for (int pi = 0; pi < poly.Count; pi++) {
                    int pv = poly[pi];
                    if (pv == hl[hMax]) continue;
                    Vector2 pp = xz[pv];
                    float d2 = (pp - hp).sqrMagnitude;
                    if (d2 >= bestD2) continue;

                    bool ok = true;
                    for (int e = 0; e < poly.Count && ok; e++) {
                        int e2 = (e + 1) % poly.Count;
                        if (poly[e] == pv || poly[e2] == pv) continue;
                        if (SegsIntersect(hp, pp, xz[poly[e]], xz[poly[e2]])) ok = false;
                    }
                    for (int h2 = 0; h2 < holeLoops.Count && ok; h2++) {
                        List<int> hl2 = holeLoops[h2];
                        for (int e = 0; e < hl2.Count && ok; e++) {
                            int e2 = (e + 1) % hl2.Count;
                            if (hl2[e] == hl[hMax] || hl2[e2] == hl[hMax]) continue;
                            if (SegsIntersect(hp, pp, xz[hl2[e]], xz[hl2[e2]])) ok = false;
                        }
                    }
                    if (ok) {
                        bestD2 = d2;
                        bestP = pi;
                    }
                }
                if (bestP < 0) return false;

                var merged = new List<int>(poly.Count + hl.Count + 2);
                for (int k = 0; k <= bestP; k++) merged.Add(poly[k]);
                for (int k = 0; k < hl.Count; k++) merged.Add(hl[(hMax + k) % hl.Count]);
                merged.Add(hl[hMax]);
                merged.Add(poly[bestP]);
                for (int k = bestP + 1; k < poly.Count; k++) merged.Add(poly[k]);
                poly = merged;
                holeLoops.RemoveAt(hi);
            }

            var idx = new List<int>(poly);
            int safety = idx.Count * idx.Count + 32;
            int cur = 0;
            while (idx.Count > 3 && safety-- > 0) {
                int m = idx.Count;
                bool cut = false;
                for (int step = 0; step < m; step++) {
                    int i = (cur + step) % m, ip = (i - 1 + m) % m, inx = (i + 1) % m;
                    int a = idx[ip], b1 = idx[i], c = idx[inx];
                    if (a == b1 || b1 == c || c == a) {
                        idx.RemoveAt(i);
                        cut = true;
                        cur = i % idx.Count;
                        break;
                    }
                    Vector2 va = xz[a], vb = xz[b1], vc = xz[c];
                    if (AreaXZ(va, vb, vc) <= 1e-4f) continue;

                    bool empty = true;
                    for (int k = 0; k < m; k++) {
                        if (k == ip || k == i || k == inx) continue;
                        int vk = idx[k];
                        if (vk == a || vk == b1 || vk == c) continue;
                        if (PtInTri2D(xz[vk], va, vb, vc, 1e-4f)) {
                            empty = false;
                            break;
                        }
                    }
                    if (empty) {
                        allPolyTris.Add(a);
                        allPolyTris.Add(b1);
                        allPolyTris.Add(c);
                        idx.RemoveAt(i);
                        cur = i % idx.Count;
                        cut = true;
                        break;
                    }
                }
                if (!cut) break;
            }
            if (idx.Count == 3 && AreaXZ(xz[idx[0]], xz[idx[1]], xz[idx[2]]) > 1e-4f) {
                allPolyTris.Add(idx[0]);
                allPolyTris.Add(idx[1]);
                allPolyTris.Add(idx[2]);
                idx.Clear();
            }
            if (idx.Count > 0) return false;
        }
        return true;
    }

    static long UndirEdgeKey(int a, int b) {
        int lo = a < b ? a : b;
        int hi = a < b ? b : a;
        return ((long)lo << 32) | (uint)hi;
    }

    static long DirEdgeKey(int a, int b) {
        return ((long)a << 32) | (uint)b;
    }

    static float PointSegDistSqXZ(Vector2 p, Vector2 a, Vector2 b) {
        Vector2 ab = b - a;
        float len2 = ab.sqrMagnitude;
        if (len2 < 1e-8f) return (p - a).sqrMagnitude;
        float t = Mathf.Clamp01(Vector2.Dot(p - a, ab) / len2);
        Vector2 proj = a + ab * t;
        return (p - proj).sqrMagnitude;
    }

    static HashSet<long> CollectLakeConstrainedEdges(List<List<int>> loops) {
        var constrained = new HashSet<long>();
        for (int li = 0; li < loops.Count; li++) {
            List<int> lp = loops[li];
            for (int k = 0; k < lp.Count; k++) {
                int a = lp[k];
                int b = lp[(k + 1) % lp.Count];
                if (a != b) constrained.Add(UndirEdgeKey(a, b));
            }
        }
        return constrained;
    }

    void FlipLakeDelaunayEdges(HashSet<long> constrained, List<int> polyTris) {
        int triCount = polyTris.Count / 3;
        if (triCount < 2) return;

        var dirToHalfEdge = new Dictionary<long, int>(polyTris.Count);
        var touchedTri = new bool[triCount];
        for (int pass = 0; pass < 64; pass++) {
            dirToHalfEdge.Clear();
            System.Array.Clear(touchedTri, 0, triCount);
            for (int t = 0; t < triCount; t++) {
                int ti = t * 3;
                int v0 = polyTris[ti], v1 = polyTris[ti + 1], v2 = polyTris[ti + 2];
                dirToHalfEdge[DirEdgeKey(v0, v1)] = ti;
                dirToHalfEdge[DirEdgeKey(v1, v2)] = ti + 1;
                dirToHalfEdge[DirEdgeKey(v2, v0)] = ti + 2;
            }

            bool anyFlipped = false;
            for (int t0 = 0; t0 < triCount; t0++) {
                if (touchedTri[t0]) continue;
                int ti0 = t0 * 3;
                for (int e = 0; e < 3; e++) {
                    int u = polyTris[ti0 + e];
                    int v = polyTris[ti0 + ((e + 1) % 3)];
                    int a = polyTris[ti0 + ((e + 2) % 3)];
                    if (u >= v || constrained.Contains(UndirEdgeKey(u, v))) continue;
                    if (!dirToHalfEdge.TryGetValue(DirEdgeKey(v, u), out int h1)) continue;

                    int t1 = h1 / 3;
                    if (t1 == t0 || touchedTri[t1]) continue;
                    int ti1 = t1 * 3;
                    int b = polyTris[ti1 + ((h1 - ti1 + 2) % 3)];
                    if (b == a) continue;

                    Vector2 pu = xz[u], pv = xz[v], pa = xz[a], pb = xz[b];
                    if (AreaXZ(pb, pa, pu) <= 1e-3f || AreaXZ(pa, pb, pv) <= 1e-3f) continue;

                    // 対角の和 > 180度 (外接円内) のとき内側の対角線を反転して細長い楔形三角形を解消
                    Vector2 ua = pu - pa, va = pv - pa, vb = pv - pb, ub = pu - pb;
                    float sA = Mathf.Abs(ua.x * va.y - ua.y * va.x);
                    float sB = Mathf.Abs(vb.x * ub.y - vb.y * ub.x);
                    float dA = Vector2.Dot(ua, va);
                    float dB = Vector2.Dot(vb, ub);
                    float scale = (ua.sqrMagnitude + va.sqrMagnitude) * (vb.sqrMagnitude + ub.sqrMagnitude);
                    if (sA * dB + sB * dA >= -1e-5f * scale) continue;

                    polyTris[ti0] = b; polyTris[ti0 + 1] = a; polyTris[ti0 + 2] = u;
                    polyTris[ti1] = a; polyTris[ti1 + 1] = b; polyTris[ti1 + 2] = v;
                    touchedTri[t0] = true;
                    touchedTri[t1] = true;
                    anyFlipped = true;
                    break;
                }
            }
            if (!anyFlipped) break;
        }
    }

    void InsertLakeDepthAnchors(int lid, float lvl, int bx0, int bx1, int bz0, int bz1,
            List<List<int>> loops, HashSet<long> constrained,
            List<int> polyTris, HashSet<int> interiorAnchors) {
        var boundaryVerts = new HashSet<int>();
        for (int li = 0; li < loops.Count; li++) {
            List<int> lp = loops[li];
            for (int k = 0; k < lp.Count; k++) boundaryVerts.Add(lp[k]);
        }

        int deepestGi = -1;
        float deepestDepth = 0f;
        for (int gz = bz0; gz <= bz1; gz++) {
            int row = gz * nx;
            for (int gx = bx0; gx <= bx1; gx++) {
                int gi = row + gx;
                if (lakeId[gi] != lid || boundaryVerts.Contains(gi)) continue;
                float d = lvl - H[gi];
                if (d > deepestDepth) {
                    deepestDepth = d;
                    deepestGi = gi;
                }
            }
        }

        if (deepestGi >= 0 && deepestDepth >= 2.0f && TrySplitTriAtAnchor(deepestGi, constrained, polyTris)) {
            interiorAnchors.Add(deepestGi);
        }

        float stepM = Mathf.Clamp(38f, cellSize * 3.5f, 44f);
        int anchorStep = Mathf.Max(4, Mathf.RoundToInt(stepM / cellSize));
        float minShoreDistSq = cellSize * 0.85f * (cellSize * 0.85f);
        for (int gz = bz0 + 2; gz <= bz1 - 2; gz += anchorStep) {
            int row = gz * nx;
            for (int gx = bx0 + 2; gx <= bx1 - 2; gx += anchorStep) {
                int gi = row + gx;
                if (gi == deepestGi || lakeId[gi] != lid || boundaryVerts.Contains(gi) || lvl - H[gi] < 1.2f) continue;

                Vector2 gp = xz[gi];
                bool nearBoundary = false;
                for (int li = 0; li < loops.Count && !nearBoundary; li++) {
                    List<int> lp = loops[li];
                    for (int k = 0; k < lp.Count; k++) {
                        if (PointSegDistSqXZ(gp, xz[lp[k]], xz[lp[(k + 1) % lp.Count]]) < minShoreDistSq) {
                            nearBoundary = true;
                            break;
                        }
                    }
                }
                if (nearBoundary) continue;

                if (TrySplitTriAtAnchor(gi, constrained, polyTris)) interiorAnchors.Add(gi);
            }
        }
    }

    bool TrySplitTriAtAnchor(int gi, HashSet<long> constrained, List<int> polyTris) {
        Vector2 gp = xz[gi];
        for (int ti = 0; ti < polyTris.Count; ti += 3) {
            int ia = polyTris[ti], ib = polyTris[ti + 1], ic = polyTris[ti + 2];
            if (ia == gi || ib == gi || ic == gi) return false;
            Vector2 pa = xz[ia], pb = xz[ib], pc = xz[ic];
            if (!PtInTri2D(gp, pa, pb, pc, 0.05f)) continue;

            float fullA = AreaXZ(pa, pb, pc);
            float a0 = AreaXZ(pa, pb, gp);
            float a1 = AreaXZ(pb, pc, gp);
            float a2 = AreaXZ(pc, pa, gp);
            float minSub = Mathf.Min(a0, Mathf.Min(a1, a2));
            if (minSub > fullA * 0.02f && minSub > 1e-3f) {
                polyTris[ti + 2] = gi;
                polyTris.Add(ib); polyTris.Add(ic); polyTris.Add(gi);
                polyTris.Add(ic); polyTris.Add(ia); polyTris.Add(gi);
                return true;
            }

            int eU = -1, eV = -1, opp = -1;
            if (a0 <= fullA * 0.02f && a1 > fullA * 0.02f && a2 > fullA * 0.02f) {
                eU = ia; eV = ib; opp = ic;
            } else if (a1 <= fullA * 0.02f && a0 > fullA * 0.02f && a2 > fullA * 0.02f) {
                eU = ib; eV = ic; opp = ia;
            } else if (a2 <= fullA * 0.02f && a0 > fullA * 0.02f && a1 > fullA * 0.02f) {
                eU = ic; eV = ia; opp = ib;
            }
            if (eU < 0 || constrained.Contains(UndirEdgeKey(eU, eV))) return false;

            for (int tj = 0; tj < polyTris.Count; tj += 3) {
                if (tj == ti) continue;
                int j0 = polyTris[tj], j1 = polyTris[tj + 1], j2 = polyTris[tj + 2];
                int opp2 = -1;
                if (j0 == eV && j1 == eU) opp2 = j2;
                else if (j1 == eV && j2 == eU) opp2 = j0;
                else if (j2 == eV && j0 == eU) opp2 = j1;
                if (opp2 < 0) continue;

                if (AreaXZ(xz[eU], xz[opp2], gp) > 1e-3f
                        && AreaXZ(xz[opp2], xz[eV], gp) > 1e-3f
                        && AreaXZ(xz[eV], xz[opp], gp) > 1e-3f
                        && AreaXZ(xz[opp], xz[eU], gp) > 1e-3f) {
                    polyTris[ti] = opp; polyTris[ti + 1] = eU; polyTris[ti + 2] = gi;
                    polyTris[tj] = eV;  polyTris[tj + 1] = opp; polyTris[tj + 2] = gi;
                    polyTris.Add(eU);   polyTris.Add(opp2); polyTris.Add(gi);
                    polyTris.Add(opp2); polyTris.Add(eV);   polyTris.Add(gi);
                    return true;
                }
                return false;
            }
            return false;
        }
        return false;
    }

    void EmitLakeGridFallback(int lid, int bx0, int bx1, int bz0, int bz1,
            MeshBuilder mb, bool[] lakeGridCovered) {
        float lvl = lakeLevels[lid];
        int cx0 = Mathf.Max(0, bx0), cx1 = Mathf.Min(nx - 2, bx1);
        int cz0 = Mathf.Max(0, bz0), cz1 = Mathf.Min(nz - 2, bz1);
        int cellsX = nx - 1;
        for (int iz = cz0; iz <= cz1; iz++) {
            int row = iz * nx;
            for (int ix = cx0; ix <= cx1; ix++) {
                int a = row + ix, b = a + 1, c = a + nx, d = c + 1;
                for (int t = 0; t < 2; t++) {
                    CellTri(a, b, c, d, iz, t, out int i0, out int i1, out int i2);
                    if (FirstLakeId(i0, i1, i2) != lid) continue;
                    lakeGridCovered[(iz * cellsX + ix) * 2 + t] = true;
                    float y0 = WaterHeightInLakeTri(i0, lid, lvl);
                    float y1 = WaterHeightInLakeTri(i1, lid, lvl);
                    float y2 = WaterHeightInLakeTri(i2, lid, lvl);
                    mb.Tri(Pos(i0, y0), Pos(i1, y1), Pos(i2, y2),
                        ComputeWaterDepthColor(y0 - H[i0], 0f),
                        ComputeWaterDepthColor(y1 - H[i1], 0f),
                        ComputeWaterDepthColor(y2 - H[i2], 0f), Vector3.up);
                }
            }
        }
    }

    void EmitRiverGridWater(MeshBuilder mb, bool[] lakeGridCovered, bool[] riverMouth) {
        int cellsX = nx - 1, cellsZ = nz - 1;
        Color shallowShore = ComputeWaterDepthColor(0f, 0f);
        for (int iz = 0; iz < cellsZ; iz++) {
            int row = iz * nx;
            for (int ix = 0; ix < cellsX; ix++) {
                int a = row + ix, b = a + 1, c = a + nx, d = c + 1;
                for (int t = 0; t < 2; t++) {
                    if (lakeGridCovered[(iz * cellsX + ix) * 2 + t]) continue;
                    CellTri(a, b, c, d, iz, t, out int i0, out int i1, out int i2);
                    int lid = FirstLakeId(i0, i1, i2);
                    if (lid > 0) {
                        if (IsLakeFrozen(lid)) continue;
                        float lvl = lakeLevels[lid];
                        float y0 = WaterHeightInLakeTri(i0, lid, lvl);
                        float y1 = WaterHeightInLakeTri(i1, lid, lvl);
                        float y2 = WaterHeightInLakeTri(i2, lid, lvl);
                        Color c0 = LakeStraddleColor(i0, lid, y0, riverMouth, shallowShore);
                        Color c1 = LakeStraddleColor(i1, lid, y1, riverMouth, shallowShore);
                        Color c2 = LakeStraddleColor(i2, lid, y2, riverMouth, shallowShore);
                        mb.Tri(Pos(i0, y0), Pos(i1, y1), Pos(i2, y2), c0, c1, c2, Vector3.up);
                        continue;
                    }

                    if (!river[i0] && !river[i1] && !river[i2]) continue;
                    if (float.IsNaN(riverW[i0]) || float.IsNaN(riverW[i1]) || float.IsNaN(riverW[i2])) continue;
                    mb.Tri(Pos(i0, riverW[i0]), Pos(i1, riverW[i1]), Pos(i2, riverW[i2]),
                        ComputeWaterDepthColor(riverW[i0] - H[i0], 0f),
                        ComputeWaterDepthColor(riverW[i1] - H[i1], 0f),
                        ComputeWaterDepthColor(riverW[i2] - H[i2], 0f), Vector3.up);
                }
            }
        }
    }

    Color LakeStraddleColor(int i, int lid, float wy, bool[] riverMouth, Color shallowShore) {
        if (lakeId[i] == lid) return riverMouth[i] ? ComputeWaterDepthColor(wy - H[i], 0f) : shallowShore;
        return ComputeWaterDepthColor(wy - H[i], 0f);
    }

    int GetNbIdx(int ix, int iz, bool odd, int k) {
        int x = ix + (odd ? OddDX[k] : EvenDX[k]);
        int z = iz + (odd ? OddDZ[k] : EvenDZ[k]);
        if (x < 0 || z < 0 || x >= nx || z >= nz) return -1;
        return z * nx + x;
    }

    bool IsNbInside(int ix, int iz, bool odd, int k) {
        int nb = GetNbIdx(ix, iz, odd, k);
        return nb >= 0 && inside[nb];
    }

    bool TryGetWaterSurfaceY(int idx, out float surfaceY) {
        if (idx >= 0 && idx < inside.Length) {
            if (lakeId[idx] > 0) {
                surfaceY = lakeLevels[lakeId[idx]];
                return true;
            }
            if (!float.IsNaN(riverW[idx])) {
                surfaceY = riverW[idx];
                return true;
            }
        }
        surfaceY = 0f;
        return false;
    }

    static float EffectiveBankRatio(float wRiver, float hRiver, float wBank, float hBank) {
        if (hBank <= wBank + 0.02f) return 0.98f;
        float wGap = Mathf.Max(0.05f, wRiver - hRiver);
        float bankRise = Mathf.Max(0.05f, hBank - wBank);
        return Mathf.Clamp(wGap / (wGap + bankRise) + 0.04f, 0.12f, 0.96f);
    }

    static void AddQuadWithCenter(MeshBuilder mb, Vector3 a0, Vector3 a1, Vector3 b0, Vector3 b1,
            Color ca, Color cb, Vector3 outward) {
        mb.Tri(a0, a1, b1, ca, ca, cb, outward);
        mb.Tri(a0, b1, b0, ca, cb, cb, outward);
    }

    Vector2 SamplePolyline2(List<Vector3> pts, float[] cumLen, float totalLen, float dist, out float outY) {
        if (pts.Count == 1 || totalLen <= 1e-5f) {
            outY = pts[0].y;
            return new Vector2(pts[0].x, pts[0].z);
        }
        float d = Mathf.Clamp(dist, 0f, totalLen);
        for (int i = 0; i < pts.Count - 1; i++) {
            float a = cumLen[i], b = cumLen[i + 1];
            if (d <= b || i == pts.Count - 2) {
                float u = (b > a + 1e-5f) ? Mathf.Clamp01((d - a) / (b - a)) : 0f;
                Vector3 p = Vector3.Lerp(pts[i], pts[i + 1], u);
                outY = p.y;
                return new Vector2(p.x, p.z);
            }
        }
        Vector3 last = pts[pts.Count - 1];
        outY = last.y;
        return new Vector2(last.x, last.z);
    }

    int StepRiverMouthRim(int curr, Vector2 targetDir, out bool stepped) {
        int cx = curr % nx;
        int cz = curr / nx;
        bool odd = (cz & 1) == 1;
        int bestNb = -1;
        float bestScore = float.NegativeInfinity;
        for (int k = 0; k < 6; k++) {
            int nb = GetNbIdx(cx, cz, odd, k);
            if (nb < 0 || !inside[nb]) continue;
            bool adjOut = !IsNbInside(cx, cz, odd, (k + 1) % 6) || !IsNbInside(cx, cz, odd, (k + 5) % 6);
            if (!adjOut) continue;
            Vector2 d = xz[nb] - xz[curr];
            if (d.sqrMagnitude < 1e-6f) continue;
            float score = Vector2.Dot(d.normalized, targetDir);
            if (score > bestScore) {
                bestScore = score;
                bestNb = nb;
            }
        }
        stepped = bestNb >= 0 && bestScore > -0.25f;
        return stepped ? bestNb : -1;
    }

    void AddWaterfalls(MeshBuilder mb, System.Random cr) {
        int n = nx * nz;
        const int curveSteps = 9;
        float curveEndY = -Mathf.Max(bottomDepth * 1.35f, 60f);
        float deepBottomY = Mathf.Min(curveEndY - 60f, -920f);
        float[] extCandidates = { -320f, -630f, -750f, deepBottomY };
        var extYs = new List<float>(4);
        foreach (float ey in extCandidates) {
            if (ey < curveEndY - 10f && (extYs.Count == 0 || ey < extYs[extYs.Count - 1] - 1f)) {
                extYs.Add(ey);
            }
        }
        int steps = curveSteps + extYs.Count;
        var mouthUsed = new bool[n];

        for (int m = 0; m < n; m++) {
            // 中心線の河口セルを基準に、川幅いっぱいの滝口を辿って自然な縮小滝を作る
            if (!centerRiver[m] || mouthUsed[m] || float.IsNaN(riverW[m])) continue;

            int ix = m % nx;
            int iz = m / nx;
            bool odd = (iz & 1) == 1;
            int outCnt = 0;
            bool hasLowerRiver = false;
            Vector2 mPos = xz[m];
            Vector2 outDirSum = Vector2.zero;

            for (int k = 0; k < 6; k++) {
                int nb = GetNbIdx(ix, iz, odd, k);
                if (nb < 0 || !inside[nb]) {
                    outCnt++;
                    if (nb >= 0) {
                        Vector2 d = xz[nb] - mPos;
                        if (d.sqrMagnitude > 1e-6f) outDirSum += d.normalized;
                    }
                } else if (centerRiver[nb] && (riverW[nb] < riverW[m] || (riverW[nb] == riverW[m] && nb < m))) {
                    hasLowerRiver = true;
                }
            }
            if (outCnt == 0 || hasLowerRiver) continue;

            int startOutK = -1;
            for (int k = 0; k < 6; k++) {
                if (!IsNbInside(ix, iz, odd, k) && IsNbInside(ix, iz, odd, (k + 5) % 6)) {
                    startOutK = k;
                    break;
                }
            }
            if (startOutK < 0) continue;

            int endOutK = startOutK;
            for (int step = 0; step < 5; step++) {
                int nextK = (endOutK + 1) % 6;
                if (IsNbInside(ix, iz, odd, nextK)) break;
                endOutK = nextK;
            }

            int rightFallback = GetNbIdx(ix, iz, odd, (startOutK + 5) % 6);
            int leftFallback = GetNbIdx(ix, iz, odd, (endOutK + 1) % 6);
            if (rightFallback < 0 || leftFallback < 0 || rightFallback == leftFallback) continue;

            float wCenter = riverW[m];
            Vector2 flowSum = Vector2.zero;
            for (int k = 0; k < 6; k++) {
                int nb = GetNbIdx(ix, iz, odd, k);
                if (nb >= 0 && inside[nb] && centerRiver[nb] && riverW[nb] > wCenter) {
                    Vector2 d = mPos - xz[nb];
                    if (d.sqrMagnitude > 1e-6f) flowSum += d.normalized;
                }
            }
            Vector2 geoOut = outDirSum.sqrMagnitude > 1e-6f
                ? outDirSum.normalized
                : (mPos.sqrMagnitude > 1e-6f ? mPos.normalized : Vector2.right);
            Vector2 outDir = flowSum.sqrMagnitude > 1e-6f
                ? (geoOut * 0.72f + flowSum.normalized * 0.28f).normalized
                : geoOut;
            Vector2 sideAxis = new Vector2(-outDir.y, outDir.x);

            // 外周リングに沿って実際の河川幅(両岸の岸辺)まで辿る
            var visitedRim = new HashSet<int> { m };
            var leftChain = new List<int>();
            var rightChain = new List<int>();
            int bankL = -1, bankR = -1;
            float maxWalkSpan = Mathf.Max(cellSize * 2.5f, riverWidth * 1.4f);

            int curL = m;
            for (int h = 0; h < 14; h++) {
                int nextV = StepRiverMouthRim(curL, sideAxis, out bool ok);
                if (!ok || visitedRim.Contains(nextV)) break;
                if (Vector2.Distance(xz[nextV], mPos) > maxWalkSpan || lakeId[nextV] > 0 || mouthUsed[nextV]) break;
                if (!river[nextV]) {
                    bankL = nextV;
                    break;
                }
                visitedRim.Add(nextV);
                leftChain.Add(nextV);
                curL = nextV;
            }
            if (bankL < 0 && leftFallback >= 0 && !river[leftFallback] && inside[leftFallback]) bankL = leftFallback;

            int curR = m;
            for (int h = 0; h < 14; h++) {
                int nextV = StepRiverMouthRim(curR, -sideAxis, out bool ok);
                if (!ok || visitedRim.Contains(nextV)) break;
                if (Vector2.Distance(xz[nextV], mPos) > maxWalkSpan || lakeId[nextV] > 0 || mouthUsed[nextV]) break;
                if (!river[nextV]) {
                    bankR = nextV;
                    break;
                }
                visitedRim.Add(nextV);
                rightChain.Add(nextV);
                curR = nextV;
            }
            if (bankR < 0 && rightFallback >= 0 && !river[rightFallback] && inside[rightFallback]) bankR = rightFallback;

            var rimVerts = new List<int>(leftChain.Count + rightChain.Count + 1);
            for (int k = leftChain.Count - 1; k >= 0; k--) rimVerts.Add(leftChain[k]);
            rimVerts.Add(m);
            for (int k = 0; k < rightChain.Count; k++) rimVerts.Add(rightChain[k]);

            foreach (int rv in rimVerts) mouthUsed[rv] = true;

            int lastL = rimVerts[0];
            int lastR = rimVerts[rimVerts.Count - 1];
            float wLastL = TryGetWaterSurfaceY(lastL, out float wll) ? wll : wCenter;
            float wLastR = TryGetWaterSurfaceY(lastR, out float wrr) ? wrr : wCenter;

            Vector3 startL = Pos(lastL, wLastL);
            if (bankL >= 0 && TryGetWaterSurfaceY(bankL, out float wBankL)) {
                float tL = EffectiveBankRatio(wLastL, H[lastL], wBankL, H[bankL]);
                startL = Vector3.Lerp(Pos(lastL, wLastL), Pos(bankL, wBankL), tL);
            }
            Vector3 startR = Pos(lastR, wLastR);
            if (bankR >= 0 && TryGetWaterSurfaceY(bankR, out float wBankR)) {
                float tR = EffectiveBankRatio(wLastR, H[lastR], wBankR, H[bankR]);
                startR = Vector3.Lerp(Pos(lastR, wLastR), Pos(bankR, wBankR), tR);
            }

            // 河口全体の法線で外向き方向と左右軸を整える
            Vector2 rimOutSum = Vector2.zero;
            foreach (int rv in rimVerts) {
                int rx = rv % nx, rz = rv / nx;
                bool rOdd = (rz & 1) == 1;
                for (int k = 0; k < 6; k++) {
                    int nb = GetNbIdx(rx, rz, rOdd, k);
                    if (nb >= 0 && !inside[nb]) {
                        Vector2 d = xz[nb] - xz[rv];
                        if (d.sqrMagnitude > 1e-6f) rimOutSum += d.normalized;
                    }
                }
            }
            Vector2 wideGeoOut = rimOutSum.sqrMagnitude > 1e-6f ? rimOutSum.normalized : geoOut;
            outDir = flowSum.sqrMagnitude > 1e-6f
                ? (wideGeoOut * 0.72f + flowSum.normalized * 0.28f).normalized
                : wideGeoOut;
            sideAxis = new Vector2(-outDir.y, outDir.x);
            Vector2 chord = new Vector2(startL.x - startR.x, startL.z - startR.z);
            if (Vector2.Dot(chord, sideAxis) < 0f) sideAxis = -sideAxis;

            var lipPts = new List<Vector3>(rimVerts.Count + 2);
            lipPts.Add(startL);
            foreach (int rv in rimVerts) {
                float wy = TryGetWaterSurfaceY(rv, out float wv) ? wv : wCenter;
                Vector3 rp = Pos(rv, wy);
                if (Vector3.Distance(lipPts[lipPts.Count - 1], rp) > 0.05f) lipPts.Add(rp);
            }
            if (Vector3.Distance(lipPts[lipPts.Count - 1], startR) > 0.05f) lipPts.Add(startR);
            if (lipPts.Count < 2) continue;

            var cumLen = new float[lipPts.Count];
            for (int k = 1; k < lipPts.Count; k++) {
                cumLen[k] = cumLen[k - 1] + Vector2.Distance(
                    new Vector2(lipPts[k - 1].x, lipPts[k - 1].z),
                    new Vector2(lipPts[k].x, lipPts[k].z));
            }
            float totalPolyLen = cumLen[lipPts.Count - 1];
            float mouthWidth = Mathf.Max(cellSize * 0.65f, chord.magnitude);
            int cols = Mathf.Clamp(Mathf.CeilToInt(mouthWidth / Mathf.Max(2f, cellSize * 0.9f)), 3, 9);

            Vector2 midXZ = 0.5f * (new Vector2(startL.x, startL.z) + new Vector2(startR.x, startR.z));
            var lat0 = new float[cols + 1];
            var fwd0 = new float[cols + 1];
            var y0 = new float[cols + 1];
            float maxFwd0 = float.MinValue;
            float sumY0 = 0f;

            for (int j = 0; j <= cols; j++) {
                float d = totalPolyLen * (j / (float)cols);
                Vector2 pt2 = SamplePolyline2(lipPts, cumLen, totalPolyLen, d, out float py);
                Vector2 rel = pt2 - midXZ;
                lat0[j] = Vector2.Dot(rel, sideAxis);
                fwd0[j] = Vector2.Dot(rel, outDir);
                y0[j] = py;
                sumY0 += py;
                if (fwd0[j] > maxFwd0) maxFwd0 = fwd0[j];
            }
            float avgLipY = sumY0 / (cols + 1);

            float maxRimFwd = 0f;
            foreach (int rv in rimVerts) {
                int rx = rv % nx, rz = rv / nx;
                bool rOdd = (rz & 1) == 1;
                for (int k = 0; k < 6; k++) {
                    int nb = GetNbIdx(rx, rz, rOdd, k);
                    if (nb >= 0 && !inside[nb]) {
                        float proj = Vector2.Dot(xz[nb] - midXZ, outDir);
                        if (proj > maxRimFwd) maxRimFwd = proj;
                    }
                }
            }
            float jetReach = Mathf.Max(cellSize * 1.15f, Mathf.Max(maxRimFwd, maxFwd0) + cellSize * 0.50f);

            // 川幅に合わせて滝口を始め、落下するにつれて削られた筋のように自然に細く絞る
            float endWidthRatio = Mathf.Lerp(0.36f, 0.54f, Mathf.Clamp01(mouthWidth / Mathf.Max(1f, riverWidth * 1.4f)));

            var front = new Vector3[steps + 1, cols + 1];
            var back = new Vector3[steps + 1, cols + 1];
            var fwdCurve = new float[steps + 1];
            var yCurve = new float[steps + 1];
            var ringCol = new Color[steps + 1];

            Vector3 out3 = new Vector3(outDir.x, 0f, outDir.y);
            Vector3 side3 = new Vector3(sideAxis.x, 0f, sideAxis.y);
            Vector3 mid3 = new Vector3(midXZ.x, 0f, midXZ.y);
            Color foamTint = Color.Lerp(waterColor, Color.white, 0.45f);

            float lipInset = cellSize * 0.14f;
            for (int j = 0; j <= cols; j++) {
                front[0, j] = mid3 + out3 * (fwd0[j] - lipInset) + side3 * lat0[j] + Vector3.up * (y0[j] - 0.02f);
            }
            fwdCurve[0] = 0.5f * (fwd0[0] + fwd0[cols]) - lipInset;
            yCurve[0] = avgLipY - 0.02f;
            ringCol[0] = waterColor;

            for (int s = 1; s <= steps; s++) {
                if (s <= curveSteps) {
                    float tau = s / (float)curveSteps;
                    float reachFrac = 1f - Mathf.Pow(1f - tau, 4.2f);
                    float dropFrac = Mathf.Pow(tau, 3.2f);
                    float wScale = Mathf.Lerp(1.0f, endWidthRatio, Smooth(0.06f, 0.72f, tau));
                    float archWeight = Smooth(0f, 0.30f, tau);
                    float fwdCenter = 0f;

                    for (int j = 0; j <= cols; j++) {
                        float uNorm = 2f * (j / (float)cols) - 1f;
                        float archProfile = 1f - uNorm * uNorm;
                        float fwdJ = Mathf.Lerp(fwd0[j], jetReach, reachFrac) + cellSize * 0.14f * archProfile * archWeight;
                        float latJ = lat0[j] * wScale;
                        float baseYJ = Mathf.Lerp(y0[j], avgLipY, Smooth(0f, 0.15f, tau));
                        float yJ = Mathf.Lerp(baseYJ, curveEndY, dropFrac);
                        front[s, j] = mid3 + out3 * fwdJ + side3 * latJ + Vector3.up * yJ;
                        if (j == cols / 2) fwdCenter = fwdJ;
                    }
                    fwdCurve[s] = fwdCenter;
                    yCurve[s] = Mathf.Lerp(avgLipY, curveEndY, dropFrac);

                    Color foam = Color.Lerp(waterColor, foamTint, Mathf.Clamp01(tau * 0.65f));
                    ringCol[s] = Shade(foam, (float)cr.NextDouble() * 0.06f - 0.03f);
                } else {
                    float yExt = extYs[s - curveSteps - 1];
                    for (int j = 0; j <= cols; j++) {
                        front[s, j] = new Vector3(front[curveSteps, j].x, yExt, front[curveSteps, j].z);
                    }
                    fwdCurve[s] = fwdCurve[curveSteps];
                    yCurve[s] = yExt;

                    float foamPhase = Mathf.Clamp01((-yExt - 100f) / 650f);
                    Color extCol = Color.Lerp(waterColor, foamTint, Mathf.Lerp(0.65f, 0.78f, foamPhase));
                    ringCol[s] = Shade(extCol, (float)cr.NextDouble() * 0.06f - 0.03f);
                }
            }

            for (int s = 0; s <= steps; s++) {
                float tauCurve = Mathf.Min(1f, s / (float)curveSteps);
                int sPrev = Mathf.Max(0, s - 1);
                int sNext = Mathf.Min(steps, s + 1);
                float dfwd = fwdCurve[sNext] - fwdCurve[sPrev];
                float dy = yCurve[sNext] - yCurve[sPrev];
                Vector2 in2 = new Vector2(dy, -dfwd);
                Vector3 backDir = in2.sqrMagnitude > 1e-6f
                    ? (out3 * in2.x + Vector3.up * in2.y).normalized
                    : Vector3.down;
                float wScale = Mathf.Lerp(1.0f, endWidthRatio, Smooth(0.06f, 0.72f, tauCurve));
                float thickBase = Mathf.Lerp(0.36f, 0.74f, Smooth(0f, 0.35f, tauCurve)) * Mathf.Lerp(0.65f, 1.0f, wScale);

                for (int j = 0; j <= cols; j++) {
                    float uNorm = 2f * (j / (float)cols) - 1f;
                    float archProfile = 1f - uNorm * uNorm;
                    float colThick = thickBase * (0.65f + 0.35f * archProfile);
                    back[s, j] = front[s, j] + backDir * colThick;
                }
            }

            for (int s = 0; s < steps; s++) {
                Color c0 = ringCol[s];
                Color c1 = ringCol[s + 1];
                float dfwd = fwdCurve[s + 1] - fwdCurve[s];
                float dy = yCurve[s + 1] - yCurve[s];
                Vector2 n2 = new Vector2(-dy, dfwd);
                Vector3 fwdOut = n2.sqrMagnitude > 1e-6f
                    ? (out3 * n2.x + Vector3.up * n2.y).normalized
                    : (out3 + Vector3.up).normalized;

                for (int j = 0; j < cols; j++) {
                    AddQuadWithCenter(mb, front[s, j], front[s, j + 1], front[s + 1, j], front[s + 1, j + 1], c0, c1, fwdOut);
                    AddQuadWithCenter(mb, back[s, j + 1], back[s, j], back[s + 1, j + 1], back[s + 1, j], c0, c1, -fwdOut);
                }
                AddQuadWithCenter(mb, back[s, 0], front[s, 0], back[s + 1, 0], front[s + 1, 0], c0, c1, side3);
                AddQuadWithCenter(mb, front[s, cols], back[s, cols], front[s + 1, cols], back[s + 1, cols], c0, c1, -side3);
            }

            Color cBot = ringCol[steps];
            for (int j = 0; j < cols; j++) {
                mb.Tri(front[steps, j], front[steps, j + 1], back[steps, j + 1], cBot, cBot, cBot, Vector3.down);
                mb.Tri(front[steps, j], back[steps, j + 1], back[steps, j], cBot, cBot, cBot, Vector3.down);
            }
        }
    }

    int FirstLakeId(int i0, int i1, int i2) {
        if (lakeId[i0] > 0) return lakeId[i0];
        if (lakeId[i1] > 0) return lakeId[i1];
        if (lakeId[i2] > 0) return lakeId[i2];
        return 0;
    }

    float WaterHeightInLakeTri(int i, int lid, float lvl) {
        if (lakeId[i] == lid) return lvl;
        if (!float.IsNaN(riverW[i])) return riverW[i];
        return lvl;
    }

    // ================= 木・草サンプリング（急斜面・外周崖の除外対応） =================
    bool Sample(float lx, float lz, out float y, out float ny, out bool wet, out float minSteepDistance) {
        return SampleSurface(lx, lz, out y, out ny, out _, out wet, out minSteepDistance);
    }

    bool SampleSurface(float lx, float lz, out float y, out float ny, out Vector3 normal, out bool wet, out float minSteepDistance, float minRimDist = 5.5f) {
        y = 0f;
        ny = 0f;
        normal = Vector3.up;
        wet = false;
        minSteepDistance = 0f;

        float fz = lz / cellZ + nzCells * 0.5f;
        int cz = Mathf.Clamp(Mathf.FloorToInt(fz), 0, nz - 2);
        float rowOff = (cz & 1) == 1 ? 0.5f : 0f;
        float fx = lx / cellSize + resolution * 0.5f + 0.25f - rowOff;
        int cx = Mathf.Clamp(Mathf.FloorToInt(fx), 0, nx - 2);

        var p = new Vector2(lx, lz);
        for (int dz = -1; dz <= 1; dz++) {
            int iz = cz + dz;
            if (iz < 0 || iz >= nz - 1) continue;
            for (int dx = -1; dx <= 1; dx++) {
                int ix = cx + dx;
                if (ix < 0 || ix >= nx - 1) continue;
                int a = iz * nx + ix, b = a + 1, c = a + nx, d = c + 1;
                if (!(inside[a] || inside[b] || inside[c] || inside[d])) continue;

                for (int t = 0; t < 2; t++) {
                    CellTri(a, b, c, d, iz, t, out int i0, out int i1, out int i2);
                    if (!Barycentric(p, xz[i0], xz[i1], xz[i2], out float u, out float v, out float w)) continue;

                    float rDist = u * Mathf.Min(rimDist[i0], 100f) + v * Mathf.Min(rimDist[i1], 100f) + w * Mathf.Min(rimDist[i2], 100f);
                    if (rDist < minRimDist) return false;

                    y = u * H[i0] + v * H[i1] + w * H[i2];
                    Vector3 p0 = Pos(i0, H[i0]);
                    Vector3 p1 = Pos(i1, H[i1]);
                    Vector3 p2 = Pos(i2, H[i2]);
                    Vector3 nrm = Vector3.Cross(p1 - p0, p2 - p0).normalized;
                    if (nrm.y < 0f) nrm = -nrm;
                    normal = nrm;
                    ny = nrm.y;

                    minSteepDistance = u * steepDist[i0] + v * steepDist[i1] + w * steepDist[i2];

                    if (TrySampleFinalSurface(lx, lz, out float fy, out float fny, out Vector3 fNrm)) {
                        y = fy;
                        ny = fny;
                        normal = fNrm;
                    }
                    wet = IsWaterTriangleAt(i0, i1, i2, y) || bankSlopeFlag[i0] || bankSlopeFlag[i1] || bankSlopeFlag[i2];
                    return true;
                }
            }
        }
        return false;
    }

    // 周囲8方向の最終メッシュ傾斜も確認し、細分化された急斜面の周辺から草を確実に離す
    bool CheckSurroundingSurfaceFlat(float lx, float lz, float radius, float minNy) {
        if (radius <= 0.05f) return true;
        const int dirs = 8;
        for (int i = 0; i < dirs; i++) {
            float ang = i * Mathf.PI * 2f / dirs;
            float sx = lx + Mathf.Cos(ang) * radius;
            float sz = lz + Mathf.Sin(ang) * radius;
            if (!TrySampleFinalSurface(sx, sz, out _, out float sNy) || sNy < minNy) return false;
        }
        return true;
    }

    void BuildFinalSurfaceIndex(List<Vector3> topPos, List<TriIdx> topTris) {
        finalTopPos = topPos.ToArray();
        int tc = topTris.Count;
        finalTriA = new int[tc];
        finalTriB = new int[tc];
        finalTriC = new int[tc];
        finalTriNy = new float[tc];

        float minX = float.MaxValue, maxX = float.MinValue;
        float minZ = float.MaxValue, maxZ = float.MinValue;
        for (int i = 0; i < tc; i++) {
            TriIdx tr = topTris[i];
            finalTriA[i] = tr.a;
            finalTriB[i] = tr.b;
            finalTriC[i] = tr.c;
            Vector3 p0 = finalTopPos[tr.a], p1 = finalTopPos[tr.b], p2 = finalTopPos[tr.c];
            Vector3 cross = Vector3.Cross(p1 - p0, p2 - p0);
            finalTriNy[i] = cross.sqrMagnitude > 1e-10f ? Mathf.Abs(cross.normalized.y) : 0f;

            float triMinX = Mathf.Min(p0.x, Mathf.Min(p1.x, p2.x));
            float triMaxX = Mathf.Max(p0.x, Mathf.Max(p1.x, p2.x));
            float triMinZ = Mathf.Min(p0.z, Mathf.Min(p1.z, p2.z));
            float triMaxZ = Mathf.Max(p0.z, Mathf.Max(p1.z, p2.z));
            if (triMinX < minX) minX = triMinX;
            if (triMaxX > maxX) maxX = triMaxX;
            if (triMinZ < minZ) minZ = triMinZ;
            if (triMaxZ > maxZ) maxZ = triMaxZ;
        }

        bucketRes = Mathf.Max(32, resolution);
        float span = Mathf.Max(1f, Mathf.Max(maxX - minX, maxZ - minZ));
        bucketMinX = minX;
        bucketMinZ = minZ;
        bucketInvCell = bucketRes / span;

        int cellCount = bucketRes * bucketRes;
        bucketHead = new int[cellCount];
        for (int i = 0; i < cellCount; i++) bucketHead[i] = -1;

        var triList = new List<int>(tc * 2);
        var nextList = new List<int>(tc * 2);
        for (int i = 0; i < tc; i++) {
            if (finalTriNy[i] < 0.25f) continue;
            Vector3 p0 = finalTopPos[finalTriA[i]], p1 = finalTopPos[finalTriB[i]], p2 = finalTopPos[finalTriC[i]];
            int x0 = Mathf.Clamp(Mathf.FloorToInt((Mathf.Min(p0.x, Mathf.Min(p1.x, p2.x)) - bucketMinX) * bucketInvCell), 0, bucketRes - 1);
            int x1 = Mathf.Clamp(Mathf.FloorToInt((Mathf.Max(p0.x, Mathf.Max(p1.x, p2.x)) - bucketMinX) * bucketInvCell), 0, bucketRes - 1);
            int z0 = Mathf.Clamp(Mathf.FloorToInt((Mathf.Min(p0.z, Mathf.Min(p1.z, p2.z)) - bucketMinZ) * bucketInvCell), 0, bucketRes - 1);
            int z1 = Mathf.Clamp(Mathf.FloorToInt((Mathf.Max(p0.z, Mathf.Max(p1.z, p2.z)) - bucketMinZ) * bucketInvCell), 0, bucketRes - 1);
            for (int bz = z0; bz <= z1; bz++) {
                int row = bz * bucketRes;
                for (int bx = x0; bx <= x1; bx++) {
                    int c = row + bx;
                    int node = triList.Count;
                    triList.Add(i);
                    nextList.Add(bucketHead[c]);
                    bucketHead[c] = node;
                }
            }
        }
        bucketTri = triList.ToArray();
        bucketNext = nextList.ToArray();
    }

    bool TrySampleFinalSurface(float lx, float lz, out float y, out float ny) {
        return TrySampleFinalSurface(lx, lz, out y, out ny, out _);
    }

    bool TrySampleFinalSurface(float lx, float lz, out float y, out float ny, out Vector3 normal) {
        y = 0f;
        ny = 0f;
        normal = Vector3.up;
        if (bucketHead == null) return false;

        int bx = Mathf.FloorToInt((lx - bucketMinX) * bucketInvCell);
        int bz = Mathf.FloorToInt((lz - bucketMinZ) * bucketInvCell);
        if (bx < 0 || bz < 0 || bx >= bucketRes || bz >= bucketRes) return false;

        var p = new Vector2(lx, lz);
        bool hit = false;
        float bestY = float.MinValue;
        float bestNy = 0f;
        int bestTri = -1;
        for (int node = bucketHead[bz * bucketRes + bx]; node >= 0; node = bucketNext[node]) {
            int ti = bucketTri[node];
            Vector3 p0 = finalTopPos[finalTriA[ti]];
            Vector3 p1 = finalTopPos[finalTriB[ti]];
            Vector3 p2 = finalTopPos[finalTriC[ti]];
            if (!Barycentric(p, new Vector2(p0.x, p0.z), new Vector2(p1.x, p1.z), new Vector2(p2.x, p2.z),
                    out float u, out float v, out float w)) continue;
            float ty = u * p0.y + v * p1.y + w * p2.y;
            if (!hit || ty > bestY) {
                hit = true;
                bestY = ty;
                bestNy = finalTriNy[ti];
                bestTri = ti;
            }
        }
        if (!hit) return false;
        Vector3 hp0 = finalTopPos[finalTriA[bestTri]];
        Vector3 hp1 = finalTopPos[finalTriB[bestTri]];
        Vector3 hp2 = finalTopPos[finalTriC[bestTri]];
        Vector3 hn = Vector3.Cross(hp1 - hp0, hp2 - hp0).normalized;
        if (hn.y < 0f) hn = -hn;
        y = bestY;
        ny = bestNy;
        normal = hn;
        return true;
    }

    bool IsWaterTriangleAt(int i0, int i1, int i2, float y) {
        int lid = FirstLakeId(i0, i1, i2);
        if (lid > 0) return y <= lakeLevels[lid] + 0.15f;
        if (river[i0] || river[i1] || river[i2]) {
            float maxW = float.MinValue;
            if (!float.IsNaN(riverW[i0])) maxW = Mathf.Max(maxW, riverW[i0]);
            if (!float.IsNaN(riverW[i1])) maxW = Mathf.Max(maxW, riverW[i1]);
            if (!float.IsNaN(riverW[i2])) maxW = Mathf.Max(maxW, riverW[i2]);
            return y <= maxW + 0.25f;
        }
        return false;
    }

    static bool Barycentric(Vector2 p, Vector2 a, Vector2 b, Vector2 c, out float u, out float v, out float w) {
        Vector2 v0 = b - a, v1 = c - a, v2 = p - a;
        float den = v0.x * v1.y - v1.x * v0.y;
        if (Mathf.Abs(den) < 1e-8f) {
            u = v = w = 0f;
            return false;
        }
        v = (v2.x * v1.y - v1.x * v2.y) / den;
        w = (v0.x * v2.y - v2.x * v0.y) / den;
        u = 1f - v - w;
        return u >= -1e-4f && v >= -1e-4f && w >= -1e-4f;
    }

    List<Vector2> Poisson(float r) {
        float cell = r / 1.4142f;
        int gw = Mathf.CeilToInt(2f * half / cell);
        var grid = new int[gw * gw];
        for (int i = 0; i < grid.Length; i++) grid[i] = -1;
        var pts = new List<Vector2>();
        var active = new List<int>();

        var first = new Vector2((float)(rng.NextDouble() * 2 - 1) * half, (float)(rng.NextDouble() * 2 - 1) * half);
        pts.Add(first);
        active.Add(0);
        grid[Mathf.Min((int)((first.y + half) / cell), gw - 1) * gw + Mathf.Min((int)((first.x + half) / cell), gw - 1)] = 0;

        while (active.Count > 0) {
            int ai = rng.Next(active.Count);
            Vector2 p = pts[active[ai]];
            bool found = false;
            for (int t = 0; t < 20 && !found; t++) {
                float ang = (float)rng.NextDouble() * Mathf.PI * 2f;
                float rad = r * (1f + (float)rng.NextDouble());
                Vector2 q = p + new Vector2(Mathf.Cos(ang), Mathf.Sin(ang)) * rad;
                if (q.x < -half || q.x >= half || q.y < -half || q.y >= half) continue;
                int gx = Mathf.Min((int)((q.x + half) / cell), gw - 1);
                int gy = Mathf.Min((int)((q.y + half) / cell), gw - 1);
                bool ok = true;
                for (int dx = -2; dx <= 2 && ok; dx++) {
                    for (int dy = -2; dy <= 2 && ok; dy++) {
                        int xx = gx + dx, yy = gy + dy;
                        if (xx < 0 || yy < 0 || xx >= gw || yy >= gw) continue;
                        int id = grid[yy * gw + xx];
                        if (id >= 0 && (pts[id] - q).sqrMagnitude < r * r) ok = false;
                    }
                }
                if (!ok) continue;
                pts.Add(q);
                grid[gy * gw + gx] = pts.Count - 1;
                active.Add(pts.Count - 1);
                found = true;
            }
            if (!found) {
                active[ai] = active[active.Count - 1];
                active.RemoveAt(active.Count - 1);
            }
        }
        return pts;
    }

    // 木の生成: 描画用メッシュと、単一六角錐+カプセル幹の軽量当たり判定メッシュを同位置から生成
    void BuildTrees(out Mesh visualMesh, out Mesh colliderMesh) {
        var mb = new MeshBuilder(true);
        var colMb = new MeshBuilder(true);
        float minTreeNy = Mathf.Max(0.74f, rockSlope + 0.02f);
        float spacing = Mathf.Max(2.2f, treeMinDist * 0.72f);

        foreach (Vector2 p in Poisson(spacing)) {
            if (!Sample(p.x, p.y, out float y, out float ny, out bool wet, out _)) continue;
            if (wet || ny < minTreeNy || y > treeLine || ComputeBarrenRockWeight(p.x, y, p.y) > 0.45f) continue;
            if (!CheckSurroundingSurfaceFlat(p.x, p.y, 1.5f, minTreeNy - 0.06f)) continue;
            BiomeWeights(p.x, p.y, out float forestW, out _, out _);

            // 密生する木立と開けた疎林が混ざるよう中・低周波ノイズで局所密度を変化させる
            float groveNoise = Fbm(p.x * 0.018f + 2.7f, p.y * 0.018f - 5.1f, 10, 1f, 3);
            float microGap = Fbm(p.x * 0.055f - 4.3f, p.y * 0.055f + 1.9f, 12, 1f, 2);
            float localDensity = Mathf.Lerp(0.18f, 0.96f, Smooth(0.26f, 0.78f, groveNoise * 0.68f + microGap * 0.32f));
            if (rng.NextDouble() > forestW * localDensity) continue;

            float yaw = (float)rng.NextDouble() * 360f;
            float baseScale = 0.82f + (float)rng.NextDouble() * 0.42f;
            float hBias = 0.90f + (float)rng.NextDouble() * 0.22f;
            float wBias = 0.88f + (float)rng.NextDouble() * 0.34f;
            float sY = treeScale * baseScale * hBias;
            float sXZ = treeScale * baseScale * wBias;
            float trunkRadScale = (baseScale * (0.92f + (float)rng.NextDouble() * 0.34f)) / (baseScale * wBias);
            float crownStart = 1.25f + (float)rng.NextDouble() * 1.10f;
            float span = 4.10f + (float)rng.NextDouble() * 0.85f;
            float lowerRadScale = 0.96f + (float)rng.NextDouble() * 0.16f;
            float g = (float)rng.NextDouble() * 0.1f - 0.05f;

            Vector3 pos = new Vector3(p.x, y - 0.25f * sY, p.y);
            var m = Matrix4x4.TRS(pos, Quaternion.Euler(0f, yaw, 0f), new Vector3(sXZ, sY, sXZ));
            float trunkTop = Mathf.Max(2.35f, crownStart + 0.65f);
            mb.AddPrism(m, -0.25f, trunkTop, 0.24f * trunkRadScale, 0.12f * trunkRadScale, 6, trunkColor);

            float r1 = 1.35f * lowerRadScale;
            float r2 = 1.05f * (0.94f + (float)rng.NextDouble() * 0.16f);
            float r3 = 0.72f * (0.94f + (float)rng.NextDouble() * 0.16f);
            var m1 = m * Matrix4x4.Rotate(Quaternion.Euler(0f, (float)rng.NextDouble() * 360f, 0f));
            var m2 = m * Matrix4x4.Rotate(Quaternion.Euler(0f, (float)rng.NextDouble() * 360f, 0f));
            var m3 = m * Matrix4x4.Rotate(Quaternion.Euler(0f, (float)rng.NextDouble() * 360f, 0f));
            mb.AddCone(m1, crownStart, span * 0.54f, r1, 7, Shade(leafColor, g));
            mb.AddCone(m2, crownStart + span * 0.28f, span * 0.49f, r2, 7, Shade(leafColor, g + 0.03f));
            mb.AddCone(m3, crownStart + span * 0.55f, span * 0.45f, r3, 7, Shade(leafColor, g + 0.06f));

            // 幹(上下キャップなしの6角柱) + 葉冠(最下段と頂点位置を合わせた単一7角錐)も高さ・太さ・枝下高さに合わせて生成
            float trunkColTop = Mathf.Max(2.05f, crownStart + 0.35f);
            colMb.AddOpenCylinder(m, -0.25f, trunkColTop, 0.18f * trunkRadScale, 6, trunkColor);
            colMb.AddSimpleCone(m1, crownStart, span, r1, 7, leafColor);
        }
        visualMesh = mb.ToMesh("IslandTrees");
        colliderMesh = colMb.ToMesh("IslandTreesCollider");
    }

    bool[] BuildGrassEligibleCells(float minGrassNy) {
        int n = nx * nz;
        var cornerOk = new bool[n];
        for (int i = 0; i < n; i++) {
            if (!inside[i] || rimDist[i] < 1.5f || river[i] || lakeId[i] > 0 || bankSlopeFlag[i]) continue;
            if (H[i] > ComputeGreeneryThresholdAt(xz[i].x, xz[i].y) + 6f || slopeNy[i] < minGrassNy - 0.18f || steepDist[i] < grassSlopeMargin - cellSize * 1.6f) continue;
            BiomeWeights(xz[i].x, xz[i].y, out _, out _, out float mw);
            if (mw > 0.005f) cornerOk[i] = true;
        }

        int cw = nx - 1;
        int ch = nz - 1;
        var baseOk = new bool[cw * ch];
        for (int iz = 0; iz < ch; iz++) {
            int row = iz * nx;
            for (int ix = 0; ix < cw; ix++) {
                int a = row + ix;
                if (cornerOk[a] || cornerOk[a + 1] || cornerOk[a + nx] || cornerOk[a + nx + 1]) {
                    baseOk[iz * cw + ix] = true;
                }
            }
        }

        // ジッターによるセル跨ぎを漏れなく拾うため1セル分膨張させる
        var dilated = new bool[cw * ch];
        for (int iz = 0; iz < ch; iz++) {
            for (int ix = 0; ix < cw; ix++) {
                if (!baseOk[iz * cw + ix]) continue;
                for (int dz = -1; dz <= 1; dz++) {
                    int zz = iz + dz;
                    if (zz < 0 || zz >= ch) continue;
                    for (int dx = -1; dx <= 1; dx++) {
                        int xx = ix + dx;
                        if (xx >= 0 && xx < cw) dilated[zz * cw + xx] = true;
                    }
                }
            }
        }
        return dilated;
    }

    bool IsGrassCellEligible(float lx, float lz, bool[] cellEligible) {
        int cz = Mathf.FloorToInt(lz / cellZ + nzCells * 0.5f);
        if (cz < 0 || cz >= nz - 1) return false;
        float rowOff = (cz & 1) == 1 ? 0.5f : 0f;
        int cx = Mathf.FloorToInt(lx / cellSize + resolution * 0.5f + 0.25f - rowOff);
        if (cx < 0 || cx >= nx - 1) return false;
        return cellEligible[cz * (nx - 1) + cx];
    }

    static bool TryAddPoissonSample(Vector2 q, float rSq, float halfBound, float invCell, int gw,
            int[] grid, List<Vector2> pts, List<int> active) {
        if (q.x < -halfBound || q.x >= halfBound || q.y < -halfBound || q.y >= halfBound) return false;
        int gx = Mathf.Min((int)((q.x + halfBound) * invCell), gw - 1);
        int gy = Mathf.Min((int)((q.y + halfBound) * invCell), gw - 1);
        int x0 = gx > 2 ? gx - 2 : 0;
        int x1 = gx + 2 < gw ? gx + 2 : gw - 1;
        int y0 = gy > 2 ? gy - 2 : 0;
        int y1 = gy + 2 < gw ? gy + 2 : gw - 1;
        for (int yy = y0; yy <= y1; yy++) {
            int row = yy * gw;
            for (int xx = x0; xx <= x1; xx++) {
                int id = grid[row + xx];
                if (id < 0) continue;
                float dx = pts[id].x - q.x;
                float dy = pts[id].y - q.y;
                if (dx * dx + dy * dy < rSq) return false;
            }
        }
        int idx = pts.Count;
        pts.Add(q);
        grid[gy * gw + gx] = idx;
        active.Add(idx);
        return true;
    }

    // 草が生えうる平地・草原セルだけを対象にマルチシードPoissonサンプリングし高速化
    List<Vector2> PoissonGrass(float r, float minGrassNy) {
        bool[] cellEligible = BuildGrassEligibleCells(minGrassNy);
        float cell = r / 1.4142f;
        float invCell = 1f / cell;
        int gw = Mathf.CeilToInt(2f * half * invCell);
        var grid = new int[gw * gw];
        for (int i = 0; i < grid.Length; i++) grid[i] = -1;

        var pts = new List<Vector2>(Mathf.Max(256, grid.Length / 6));
        var active = new List<int>(1024);
        float rSq = r * r;
        int cw = nx - 1;
        int ch = nz - 1;

        for (int iz = 0; iz < ch; iz++) {
            float rowOff = (iz & 1) == 1 ? 0.5f : 0f;
            float bz = (iz - nzCells * 0.5f) * cellZ;
            for (int ix = 0; ix < cw; ix++) {
                if (!cellEligible[iz * cw + ix]) continue;
                float bx = (ix + rowOff - resolution * 0.5f - 0.25f) * cellSize;
                for (int seedTry = 0; seedTry < 2 && active.Count == 0; seedTry++) {
                    var sPt = new Vector2(bx + (float)rng.NextDouble() * cellSize, bz + (float)rng.NextDouble() * cellZ);
                    if (IsGrassCellEligible(sPt.x, sPt.y, cellEligible)) {
                        TryAddPoissonSample(sPt, rSq, half, invCell, gw, grid, pts, active);
                    }
                }

                while (active.Count > 0) {
                    int ai = rng.Next(active.Count);
                    Vector2 p = pts[active[ai]];
                    bool found = false;
                    for (int t = 0; t < 12; t++) {
                        float ang = (float)rng.NextDouble() * Mathf.PI * 2f;
                        float rad = r * (1f + (float)rng.NextDouble());
                        var q = new Vector2(p.x + Mathf.Cos(ang) * rad, p.y + Mathf.Sin(ang) * rad);
                        if (!IsGrassCellEligible(q.x, q.y, cellEligible)) continue;
                        if (TryAddPoissonSample(q, rSq, half, invCell, gw, grid, pts, active)) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        active[ai] = active[active.Count - 1];
                        active.RemoveAt(active.Count - 1);
                    }
                }
            }
        }
        return pts;
    }

    // 草の生成: 急斜面周辺を除外し、1枚7頂点の軽量インデックス構造で1つのStatic結合メッシュに生成
    Mesh BuildGrassMesh() {
        var mb = new MeshBuilder(true);

        float spacing = Mathf.Max(0.52f, grassMinDist / Mathf.Max(0.5f, grassDensity * 1.15f));
        float minGrassNy = Mathf.Max(0.86f, rockSlope + 0.12f);
        float flatCheckRadius = Mathf.Min(grassSlopeMargin * 0.42f, 1.45f);
        float steepCheckCutoff = grassSlopeMargin + cellSize * 0.8f + flatCheckRadius;

        foreach (Vector2 p in PoissonGrass(spacing, minGrassNy)) {
            BiomeWeights(p.x, p.y, out _, out _, out float meadowW);
            if (meadowW <= 0.01f) continue;

            if (!SampleSurface(p.x, p.y, out float y, out float ny, out Vector3 surfNrm, out bool wet, out float steepD, 3.2f)) continue;
            float barrenW = ComputeBarrenRockWeight(p.x, y, p.y);
            // 急斜面およびその周辺(grassSlopeMargin以内)と緑地の限界高度以上には草を生やさない
            if (wet || ny < minGrassNy || barrenW > 0.68f || steepD < grassSlopeMargin) continue;

            float slopeMarginW = Smooth(grassSlopeMargin, grassSlopeMargin + 5.5f, steepD);
            float flatnessW = Smooth(minGrassNy, minGrassNy + 0.06f, ny);
            float altFade = 1f - Smooth(0.05f, 0.72f, barrenW);
            float rawCover = meadowW * altFade * Mathf.Min(slopeMarginW, flatnessW);

            // 境界帯の連続カーブを大小の草株・飛び地へ砕き、草の大きさは保ったまま密度だけをまばらに落とす
            float patchNoise = Fbm(p.x * 0.085f + 5.1f, p.y * 0.085f - 3.7f, 6, 1f, 2);
            float fineNoise = Fbm(p.x * 0.24f - 2.3f, p.y * 0.24f + 6.4f, 4, 1f, 1);
            float breakup = patchNoise * 0.68f + fineNoise * 0.32f;
            float edgeMask = Smooth(0.18f, 0.88f, rawCover + (breakup - 0.5f) * 0.72f);
            float cover = Mathf.Lerp(edgeMask, rawCover, rawCover * rawCover);
            if (cover <= 0.01f) continue;

            if (rng.NextDouble() > Mathf.Pow(cover, 2.35f) * 0.97) continue;
            if (steepD <= steepCheckCutoff && !CheckSurroundingSurfaceFlat(p.x, p.y, flatCheckRadius, minGrassNy - 0.04f)) continue;

            float clumpScale = 0.78f + (float)rng.NextDouble() * 0.72f;
            float clumpVar = (float)rng.NextDouble() * 0.16f - 0.08f;
            int minBlades = cover < 0.25f ? 2 : (cover < 0.55f ? 3 : 4);
            int maxBlades = cover < 0.25f ? 3 : (cover < 0.55f ? 4 : 5);
            int bladeCount = minBlades + rng.Next(maxBlades - minBlades + 1);
            float tintMix = Mathf.Lerp(0.45f, 1.0f, Smooth(0.02f, 0.42f, cover));

            float invNy = surfNrm.y > 0.1f ? 1f / surfNrm.y : 1f;
            float slopeX = -surfNrm.x * invNy;
            float slopeZ = -surfNrm.z * invNy;

            for (int k = 0; k < bladeCount; k++) {
                float angle = (k + (float)rng.NextDouble() * 0.75f) * Mathf.PI * 2f / bladeCount;
                var dir = new Vector3(Mathf.Cos(angle), 0f, Mathf.Sin(angle));
                var side = new Vector3(-dir.z, 0f, dir.x);
                float rootOffset = (0.04f + (float)rng.NextDouble() * 0.22f) * clumpScale;

                bool tallBlade = k < 2;
                float bladeH = (tallBlade
                    ? 0.85f + (float)rng.NextDouble() * 0.45f
                    : 0.45f + (float)rng.NextDouble() * 0.42f) * clumpScale;
                float width = (0.084f + (float)rng.NextDouble() * 0.044f) * clumpScale;
                float lean = bladeH * (tallBlade
                    ? 0.28f + (float)rng.NextDouble() * 0.35f
                    : 0.34f + (float)rng.NextDouble() * 0.42f);
                float bladeVar = (float)rng.NextDouble() * 0.10f - 0.05f;

                float rx = p.x + dir.x * rootOffset;
                float rz = p.y + dir.z * rootOffset;
                float halfW = width * 0.55f;
                float rootY = y + (rx - p.x) * slopeX + (rz - p.y) * slopeZ;
                float sxOff = side.x * halfW * slopeX;
                float szOff = side.z * halfW * slopeZ;
                float y0 = rootY - sxOff - szOff;
                float y1 = rootY + sxOff + szOff;

                const float embedDepth = 0.16f;
                var r0 = new Vector3(rx - side.x * halfW, y0 - embedDepth, rz - side.z * halfW);
                var r1 = new Vector3(rx + side.x * halfW, y1 - embedDepth, rz + side.z * halfW);
                float baseY = Mathf.Min(rootY, Mathf.Min(y0, y1)) - embedDepth;
                var rootMid = new Vector3(rx, baseY, rz);

                Color rootCol = GrassSharedColor(Shade(grassColor * Mathf.Lerp(0.76f, 0.46f, tintMix), clumpVar));
                Color midCol = GrassSharedColor(Shade(grassColor * Mathf.Lerp(0.98f, 0.90f, tintMix), clumpVar + bladeVar));
                Color tipCol = GrassSharedColor(Color.Lerp(Shade(grassColor * Mathf.Lerp(1.03f, 1.12f, tintMix), clumpVar + bladeVar),
                    sandColor, (tallBlade ? 0.30f : 0.16f) * Mathf.Lerp(0.45f, 1.0f, tintMix)));

                AddGrassBladeIndexed(mb, r0, r1, rootMid, dir, side, width, bladeH, lean, rootCol, midCol, tipCol);
            }
        }

        Mesh grassMesh = mb.ToMesh("IslandGrass");
        var normals = new Vector3[grassMesh.vertexCount];
        for (int n = 0; n < normals.Length; n++) normals[n] = Vector3.up;
        grassMesh.normals = normals;
        return grassMesh;
    }

    static Color GrassSharedColor(Color srgbColor) {
        if (QualitySettings.activeColorSpace != ColorSpace.Linear) return srgbColor * 0.62f;
        Color lin = srgbColor.linear;
        return new Color(lin.r * 0.62f, lin.g * 0.62f, lin.b * 0.62f, srgbColor.a).gamma;
    }

    // 1枚の草につき従来の18頂点から7頂点へインデックス共有して61%の頂点・メモリを削減
    static void AddGrassBladeIndexed(MeshBuilder mb, Vector3 r0, Vector3 r1, Vector3 rootMid, Vector3 dir, Vector3 side,
            float width, float height, float lean, Color rootCol, Color midCol, Color tipCol) {
        Vector3 midCenter = rootMid + dir * (lean * 0.32f) + Vector3.up * (height * 0.55f);
        Vector3 m0 = midCenter - side * (width * 0.42f);
        Vector3 m1 = midCenter + side * (width * 0.42f);
        Vector3 tip = rootMid + dir * lean + Vector3.up * height;

        Vector3 lowerOut = Vector3.Cross(r1 - r0, m0 - r0);
        if (lowerOut.sqrMagnitude < 1e-10f) lowerOut = -dir;

        const float halfThick = 0.004f;
        Vector3 thickVec = lowerOut.normalized * halfThick;
        Vector3 mf0 = m0 + thickVec, mf1 = m1 + thickVec;
        Vector3 mb0 = m0 - thickVec, mb1 = m1 - thickVec;

        int iR0 = mb.AddVertex(r0, rootCol);
        int iR1 = mb.AddVertex(r1, rootCol);
        int iMf0 = mb.AddVertex(mf0, midCol);
        int iMf1 = mb.AddVertex(mf1, midCol);
        int iMb0 = mb.AddVertex(mb0, midCol);
        int iMb1 = mb.AddVertex(mb1, midCol);
        int iTip = mb.AddVertex(tip, tipCol);

        // 表側3枚 + 裏側3枚(巻き方向を向きに合わせて追加)
        mb.AddIndexedTriOriented(iR0, iR1, iMf1, lowerOut);
        mb.AddIndexedTriOriented(iR0, iMf1, iMf0, lowerOut);
        mb.AddIndexedTriOriented(iMf0, iMf1, iTip, lowerOut);

        mb.AddIndexedTriOriented(iR1, iR0, iMb0, -lowerOut);
        mb.AddIndexedTriOriented(iR1, iMb0, iMb1, -lowerOut);
        mb.AddIndexedTriOriented(iMb1, iMb0, iTip, -lowerOut);
    }

    // ================= 共通 =================
    static Color Shade(Color c, float v) {
        return new Color(Mathf.Clamp01(c.r * (1f + v)), Mathf.Clamp01(c.g * (1f + v)), Mathf.Clamp01(c.b * (1f + v)), c.a);
    }

    static Color WithAlpha(Color c, float a) {
        c.a = a;
        return c;
    }

    class MeshBuilder {
        readonly List<Vector3> v = new List<Vector3>();
        readonly List<Color> cols = new List<Color>();
        readonly List<Color32> cols32 = new List<Color32>();
        readonly List<int> idx = new List<int>();
        readonly bool shared;

        public MeshBuilder(bool shared) {
            this.shared = shared;
        }

        public int AddVertex(Vector3 pos, Color col) {
            int index = v.Count;
            v.Add(pos);
            if (shared) {
                cols32.Add(col);
            } else {
                bool linear = QualitySettings.activeColorSpace == ColorSpace.Linear;
                cols.Add(linear ? col.linear : col);
            }
            return index;
        }

        public void AddIndexedTriOriented(int ia, int ib, int ic, Vector3 outward) {
            Vector3 n = Vector3.Cross(v[ib] - v[ia], v[ic] - v[ia]);
            if (n.sqrMagnitude < 1e-12f) return;
            if (Vector3.Dot(n, outward) < 0f) {
                int tmp = ib; ib = ic; ic = tmp;
            }
            idx.Add(ia); idx.Add(ib); idx.Add(ic);
        }

        public void Tri(Vector3 a, Vector3 b, Vector3 c, Color ca, Color cb, Color cc, Vector3 outward) {
            Vector3 n = Vector3.Cross(b - a, c - a);
            if (n.sqrMagnitude < 1e-10f) return;
            if (Vector3.Dot(n, outward) < 0f) {
                Vector3 t = b; b = c; c = t;
                Color tc = cb; cb = cc; cc = tc;
            }
            EmitTri(a, b, c, ca, cb, cc);
        }

        public void TriRaw(Vector3 a, Vector3 b, Vector3 c, Color ca, Color cb, Color cc) {
            if (Vector3.Cross(b - a, c - a).sqrMagnitude < 1e-10f) return;
            EmitTri(a, b, c, ca, cb, cc);
        }

        void EmitTri(Vector3 a, Vector3 b, Vector3 c, Color ca, Color cb, Color cc) {
            int s = v.Count;
            v.Add(a); v.Add(b); v.Add(c);
            if (shared) {
                cols32.Add(ca); cols32.Add(cb); cols32.Add(cc);
            } else {
                bool linear = QualitySettings.activeColorSpace == ColorSpace.Linear;
                cols.Add(linear ? ca.linear : ca);
                cols.Add(linear ? cb.linear : cb);
                cols.Add(linear ? cc.linear : cc);
            }
            idx.Add(s); idx.Add(s + 1); idx.Add(s + 2);
        }

        void Local(Matrix4x4 m, Vector3 a, Vector3 b, Vector3 c, Color col) {
            Vector3 cen = (a + b + c) / 3f;
            Vector3 outward = cen - new Vector3(0f, cen.y, 0f);
            Tri(m.MultiplyPoint3x4(a), m.MultiplyPoint3x4(b), m.MultiplyPoint3x4(c), col, col, col, m.MultiplyVector(outward));
        }

        public void AddCone(Matrix4x4 m, float y0, float h, float rad, int sides, Color col, bool includeCap = true) {
            var apex = new Vector3(0f, y0 + h, 0f);
            float capInset = Mathf.Min(h * 0.20f, rad * 0.24f);
            var capCenter = new Vector3(0f, y0 + capInset, 0f);
            Color edgeUnderCol = Shade(col, -0.04f);
            Color innerUnderCol = Shade(col, -0.20f);
            for (int i = 0; i < sides; i++) {
                float a0 = i * Mathf.PI * 2f / sides, a1 = (i + 1) * Mathf.PI * 2f / sides;
                var p0 = new Vector3(Mathf.Cos(a0) * rad, y0, Mathf.Sin(a0) * rad);
                var p1 = new Vector3(Mathf.Cos(a1) * rad, y0, Mathf.Sin(a1) * rad);
                Local(m, p0, p1, apex, col);

                if (includeCap) {
                    Vector3 edgeMid = (p0 + p1) * 0.5f;
                    var capOutward = new Vector3(edgeMid.x * 0.12f, -1f, edgeMid.z * 0.12f);
                    Tri(m.MultiplyPoint3x4(p1), m.MultiplyPoint3x4(p0), m.MultiplyPoint3x4(capCenter),
                        edgeUnderCol, edgeUnderCol, innerUnderCol, m.MultiplyVector(capOutward));
                }
            }
        }

        public void AddPrism(Matrix4x4 m, float y0, float y1, float radBottom, float radTop, int sides, Color col) {
            for (int i = 0; i < sides; i++) {
                float a0 = i * Mathf.PI * 2f / sides, a1 = (i + 1) * Mathf.PI * 2f / sides;
                float c0 = Mathf.Cos(a0), s0 = Mathf.Sin(a0);
                float c1 = Mathf.Cos(a1), s1 = Mathf.Sin(a1);
                var b0 = new Vector3(c0 * radBottom, y0, s0 * radBottom);
                var b1 = new Vector3(c1 * radBottom, y0, s1 * radBottom);
                var t0 = new Vector3(c0 * radTop, y1, s0 * radTop);
                var t1 = new Vector3(c1 * radTop, y1, s1 * radTop);
                Local(m, b0, b1, t1, col);
                Local(m, b0, t1, t0, col);
            }
        }

        // 上下キャップを省いた頂点共有の角柱形状（コライダー用途）
        public void AddOpenCylinder(Matrix4x4 m, float y0, float y1, float rad, int sides, Color col) {
            var bRing = new int[sides];
            var tRing = new int[sides];
            for (int i = 0; i < sides; i++) {
                float ang = i * Mathf.PI * 2f / sides;
                float cx = Mathf.Cos(ang) * rad;
                float sz = Mathf.Sin(ang) * rad;
                bRing[i] = AddVertex(m.MultiplyPoint3x4(new Vector3(cx, y0, sz)), col);
                tRing[i] = AddVertex(m.MultiplyPoint3x4(new Vector3(cx, y1, sz)), col);
            }
            for (int i = 0; i < sides; i++) {
                int j = (i + 1) % sides;
                float midAng = (i + 0.5f) * Mathf.PI * 2f / sides;
                var sideOut = m.MultiplyVector(new Vector3(Mathf.Cos(midAng), 0f, Mathf.Sin(midAng)));
                AddIndexedTriOriented(bRing[i], bRing[j], tRing[j], sideOut);
                AddIndexedTriOriented(bRing[i], tRing[j], tRing[i], sideOut);
            }
        }

        // 頂点共有された簡易角錐形状（底面閉じ、コライダー用途）
        public void AddSimpleCone(Matrix4x4 m, float y0, float h, float rad, int sides, Color col) {
            int iApex = AddVertex(m.MultiplyPoint3x4(new Vector3(0f, y0 + h, 0f)), col);
            int iBaseCenter = AddVertex(m.MultiplyPoint3x4(new Vector3(0f, y0, 0f)), col);
            var ring = new int[sides];
            for (int i = 0; i < sides; i++) {
                float ang = i * Mathf.PI * 2f / sides;
                ring[i] = AddVertex(m.MultiplyPoint3x4(new Vector3(Mathf.Cos(ang) * rad, y0, Mathf.Sin(ang) * rad)), col);
            }
            Vector3 downOut = m.MultiplyVector(Vector3.down);
            for (int i = 0; i < sides; i++) {
                int j = (i + 1) % sides;
                float midAng = (i + 0.5f) * Mathf.PI * 2f / sides;
                var sideOut = m.MultiplyVector(new Vector3(Mathf.Cos(midAng), rad / Mathf.Max(0.1f, h), Mathf.Sin(midAng)));
                AddIndexedTriOriented(ring[i], ring[j], iApex, sideOut);
                AddIndexedTriOriented(ring[j], ring[i], iBaseCenter, downOut);
            }
        }

        public Mesh ToMesh(string meshName) {
            var mesh = new Mesh {
                name = meshName,
                indexFormat = v.Count > 65535
                    ? UnityEngine.Rendering.IndexFormat.UInt32
                    : UnityEngine.Rendering.IndexFormat.UInt16
            };
            mesh.SetVertices(v);
            if (shared) mesh.SetColors(cols32);
            else mesh.SetColors(cols);
            mesh.SetTriangles(idx, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }
    }
}
```

## File: 地形ジェネレーター/FloatingTerrainGeneratorWindow.cs

```cs
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;

// Editorフォルダー内でのみ動作。生成したPrefabにはスクリプトを付けない。
public class FloatingTerrainGeneratorWindow : EditorWindow {
    const string StateFilePath = "UserSettings/FloatingTerrainGeneratorSettings.json";

    [Serializable]
    class PersistedState {
        public FloatingTerrainSettings settings = new FloatingTerrainSettings();
        public bool showDetails;
        public bool showColors;
        public string lastPrefabPath;
    }

    [SerializeField] FloatingTerrainSettings settings = new FloatingTerrainSettings();
    [SerializeField] GameObject lastPrefab;
    [SerializeField] bool showDetails;
    [SerializeField] bool showColors;
    Vector2 scroll;
    Editor previewEditor;
    [NonSerialized] float uiIslandWidth = -1f;
    [NonSerialized] float uiCellSize = -1f;
    [NonSerialized] float uiRiverAmount = -1f;

    [MenuItem("Tools/MyWorld/地形ジェネレーター")]
    public static void Open() {
        var window = GetWindow<FloatingTerrainGeneratorWindow>("地形ジェネレーター");
        window.minSize = new Vector2(380f, 740f);
    }

    void OnEnable() {
        LoadState();
        ResetUiCache();
        Undo.undoRedoPerformed += OnUndoRedo;
    }

    void OnUndoRedo() {
        ResetUiCache();
        SaveState();
    }

    void ResetUiCache() {
        uiIslandWidth = -1f;
        uiCellSize = -1f;
        uiRiverAmount = -1f;
    }

    void OnGUI() {
        scroll = EditorGUILayout.BeginScrollView(scroll);
        EditorGUILayout.LabelField("川・湖・渓谷・森・草原のある浮島", EditorStyles.boldLabel);
        EditorGUILayout.HelpBox(
            "広大な山岳・橋を架けられる広い川と深い土手を持つローポリ浮島を生成します。単位はm。", MessageType.Info);
        if (GUILayout.Button("生成設定をリセット")) ResetSettings();
        EditorGUI.BeginChangeCheck();
        settings.terrainName = EditorGUILayout.TextField("島の名前", settings.terrainName);
        bool validName = true;
        string folder = null;
        try {
            folder = FloatingTerrainPrefabCreator.GetFolder(settings.terrainName);
        } catch (ArgumentException exception) {
            EditorGUILayout.HelpBox(exception.Message, MessageType.Error);
            validName = false;
        }

        EditorGUILayout.Space();
        EditorGUILayout.LabelField("大きさ・厚み", EditorStyles.boldLabel);
        float actualWidth = FloatingTerrainSettings.GetIslandWidth(settings);
        float clampedActualWidth = Mathf.Clamp(actualWidth,
            FloatingTerrainSettings.MinIslandWidth, FloatingTerrainSettings.MaxIslandWidth);
        if (uiIslandWidth < 0f || uiCellSize < 0f
            || Mathf.Abs(clampedActualWidth - uiIslandWidth) > 0.5f
            || FloatingTerrainSettings.ComputeClampedResolution(uiIslandWidth, uiCellSize) != settings.resolution) {
            uiIslandWidth = clampedActualWidth;
            uiCellSize = FloatingTerrainSettings.GetTargetCellSize(settings);
        }
        EditorGUI.BeginChangeCheck();
        uiIslandWidth = EditorGUILayout.Slider(new GUIContent("島の大きさ (m)",
            "島の幅・奥行きの目安(m)です。大きいほど島全体が広がります。"),
            uiIslandWidth, FloatingTerrainSettings.MinIslandWidth, FloatingTerrainSettings.MaxIslandWidth);
        uiCellSize = EditorGUILayout.Slider(new GUIContent("メッシュの大きさ (m)",
            "1マス(三角形の基準サイズ)の長さ(m)です。大きいほど荒く軽量になり、小さいほど細かくなります。"),
            uiCellSize, FloatingTerrainSettings.MinCellSize, FloatingTerrainSettings.MaxCellSize);
        if (EditorGUI.EndChangeCheck()) {
            FloatingTerrainSettings.ApplySizeAndCellSize(settings, uiIslandWidth, uiCellSize);
        }
        int targetResolution = FloatingTerrainSettings.ComputeTargetResolution(uiIslandWidth, uiCellSize);
        EditorGUILayout.LabelField("メッシュ構成（実測）",
            $"{settings.resolution} 分割 / 1マス {settings.cellSize:0.0} m（幅 {settings.resolution * settings.cellSize:0} m）");
        if (targetResolution > FloatingTerrainSettings.MaxResolution) {
            EditorGUILayout.HelpBox(
                $"分割数が上限({FloatingTerrainSettings.MaxResolution}分割)を超えたため、島の大きさを保つよう実測メッシュ幅を {settings.cellSize:0.0} m に調整しています。",
                MessageType.Warning);
        } else if (targetResolution < FloatingTerrainSettings.MinResolution) {
            EditorGUILayout.HelpBox(
                $"分割数が下限({FloatingTerrainSettings.MinResolution}分割)に達したため、島の大きさを保つよう実測メッシュ幅を {settings.cellSize:0.0} m に調整しています。",
                MessageType.Info);
        } else if (settings.resolution > 320) {
            EditorGUILayout.HelpBox(
                "320分割を超えると処理時間とメモリ使用量が分割数の2乗に比例して増えます。広い島では「メッシュの大きさ(m)」も大きめにすると軽量です。",
                MessageType.Info);
        }
        float depthRatio = FloatingTerrainSettings.GetBottomDepthRatio(settings);
        EditorGUI.BeginChangeCheck();
        depthRatio = EditorGUILayout.Slider(new GUIContent("岩の厚み（島の幅比）",
            "島の大きさに対する岩盤の厚みの比率です。島が大きくなるほど厚みも自動で増えます。"),
            depthRatio, FloatingTerrainSettings.MinBottomDepthRatio, FloatingTerrainSettings.MaxBottomDepthRatio);
        if (EditorGUI.EndChangeCheck()) {
            FloatingTerrainSettings.SetBottomDepthRatio(settings, depthRatio);
        }
        EditorGUILayout.LabelField("岩の厚み（実測）",
            $"{FloatingTerrainSettings.GetEffectiveBottomDepth(settings):0} m（幅の {depthRatio * 100f:0.0}%）");

        EditorGUILayout.Space();
        EditorGUILayout.LabelField("地形（山・渓谷）", EditorStyles.boldLabel);
        settings.baseHeight = EditorGUILayout.Slider("地面の基準の高さ", settings.baseHeight, 4f, 60f);
        settings.plainsAmp = EditorGUILayout.Slider(new GUIContent("草原のうねり",
            "平原エリアの高低差(うねりの強さ)です。0 でほぼ平坦、大きいほど緩やかな丘や谷の起伏が増えます。"),
            settings.plainsAmp, 0f, 30f);
        settings.mountainAmp = EditorGUILayout.Slider("山の高さ", settings.mountainAmp, 20f, 260f);
        settings.canyonDepth = EditorGUILayout.Slider("渓谷の深さ", settings.canyonDepth, 0f, 120f);
        settings.canyonWidth = EditorGUILayout.Slider("渓谷の幅", settings.canyonWidth, 0.01f, 0.20f);

        EditorGUILayout.Space();
        EditorGUILayout.LabelField("広い川・土手・湖（橋対応）", EditorStyles.boldLabel);
        if (uiRiverAmount < 0f
            || FloatingTerrainSettings.ComputeRiverThreshold(uiRiverAmount) != settings.riverThreshold) {
            uiRiverAmount = FloatingTerrainSettings.GetRiverAmount(settings);
        }
        EditorGUI.BeginChangeCheck();
        uiRiverAmount = EditorGUILayout.Slider(new GUIContent("川の多さ",
            "0で川なし、1.0が標準です。大きいほど川や支流が増えます。"),
            uiRiverAmount, FloatingTerrainSettings.MinRiverAmount, FloatingTerrainSettings.MaxRiverAmount);
        if (EditorGUI.EndChangeCheck()) {
            FloatingTerrainSettings.SetRiverAmount(settings, uiRiverAmount);
        }
        settings.riverWidth = EditorGUILayout.Slider(new GUIContent("川の幅",
            "橋を架けられる広い川幅(m)を作ります。"), settings.riverWidth, 4f, 65f);
        FloatingTerrainSettings.GetEffectiveLakeDepth(settings);
        settings.riverBankDepth = EditorGUILayout.Slider(new GUIContent("土手の深さ（岸の段差）",
            "土手の上(岸)から水面までの高低差(m)です。"), settings.riverBankDepth, 0.5f, 18f);
        settings.plainsRiverDepth = EditorGUILayout.Slider("平原の川の深さ（水深）", settings.plainsRiverDepth, 1f, 22f);
        settings.riverDepth = EditorGUILayout.Slider("山岳の川の深さ（水深）", settings.riverDepth, 1.5f, 28f);
        EditorGUI.BeginChangeCheck();
        float lakeAmount = EditorGUILayout.Slider(new GUIContent("湖の多さ",
            "0で湖なし、1.0が標準です。大きいほど浅い窪地も湖になり、湖が増えます。"),
            FloatingTerrainSettings.GetLakeAmount(settings),
            FloatingTerrainSettings.MinLakeAmount, FloatingTerrainSettings.MaxLakeAmount);
        if (EditorGUI.EndChangeCheck()) {
            FloatingTerrainSettings.SetLakeAmount(settings, lakeAmount);
        }
        settings.lakeDepth = EditorGUILayout.Slider(new GUIContent("湖の深さ（水深）",
            "湖の中央付近の基本水深(m)です。大きいほど深い湖底になります。"), settings.lakeDepth, 2f, 32f);

        EditorGUILayout.Space();
        EditorGUILayout.LabelField("森・草原・植生スケール", EditorStyles.boldLabel);
        settings.treeScale = EditorGUILayout.Slider(new GUIContent("木の大きさ（スケール）",
            "山の大きさに対する木のサイズ比率を調整します。"), settings.treeScale, 0.4f, 2.5f);
        EditorGUI.BeginChangeCheck();
        float forestSpread = EditorGUILayout.Slider(new GUIContent("森の広さ",
            "大きいほど森が広がります。"),
            FloatingTerrainSettings.GetForestSpread(settings), 0f, 1f);
        if (EditorGUI.EndChangeCheck()) {
            FloatingTerrainSettings.SetForestSpread(settings, forestSpread);
        }
        EditorGUI.BeginChangeCheck();
        float meadowSpread = EditorGUILayout.Slider(new GUIContent("草原の広さ",
            "大きいほど草原（草地）が広がります。"),
            FloatingTerrainSettings.GetMeadowSpread(settings), 0f, 1f);
        if (EditorGUI.EndChangeCheck()) {
            FloatingTerrainSettings.SetMeadowSpread(settings, meadowSpread);
        }
        settings.treeMinDist = EditorGUILayout.Slider(new GUIContent("木の間隔 (m)",
            "木同士の最小距離(m)です。大きいほど間隔が空きます。"), settings.treeMinDist, 3f, 24f);
        settings.grassMinDist = EditorGUILayout.Slider(new GUIContent("草の間隔 (m)",
            "草のまとまり同士の基準距離(m)です。大きいほど間隔が空きます。"), settings.grassMinDist, 1.5f, 8f);
        settings.grassDensity = EditorGUILayout.Slider(new GUIContent("草の密度",
            "大きいほど草が高密度に生えます。"), settings.grassDensity, 0.5f, 4f);
        settings.grassSlopeMargin = EditorGUILayout.Slider(new GUIContent("急斜面から草を離す距離",
            "崖・急斜面・土手の周辺に草を生やさないマージン距離(m)です。"), settings.grassSlopeMargin, 0f, 12f);



        showDetails = EditorGUILayout.Foldout(showDetails, "詳細設定", true);
        if (showDetails) {
            EditorGUI.indentLevel++;
            settings.jitter = EditorGUILayout.Slider("頂点の横のばらつき", settings.jitter, 0f, 0.4f);
            settings.heightJitter = EditorGUILayout.Slider("頂点の高さのばらつき", settings.heightJitter, 0f, 1.5f);
            settings.cliffWidth = EditorGUILayout.Slider("縁の崖の幅", settings.cliffWidth, 0.02f, 0.3f);
            settings.outlineNoise = EditorGUILayout.Slider("輪郭の凹凸", settings.outlineNoise, 0f, 0.5f);
            settings.warpAmount = EditorGUILayout.Slider("地形のゆがみ", settings.warpAmount, 0f, 1f);
            settings.rockSlope = EditorGUILayout.Slider(new GUIContent("岩になりやすさ（傾斜）",
                "大きいほど緩やかな斜面も岩になり、岩肌が増えます（0.72が標準 ≒ 約44°以上の斜面が岩）。"),
                settings.rockSlope, 0.3f, 0.95f);
            settings.treeLine = EditorGUILayout.FloatField("木が生える上限の高さ", settings.treeLine);
            settings.snowLine = EditorGUILayout.FloatField("雪が積もる高さ", settings.snowLine);
            settings.greeneryLine = EditorGUILayout.FloatField(new GUIContent("緑地の限界高度",
                "この高さより上では緑地（草地・草オブジェクト）が岩肌へ移り変わります。雪の高さより低くすると雪と緑の間に岩帯ができます。"),
                FloatingTerrainSettings.GetEffectiveGreeneryLine(settings));
            if (settings.greeneryLine > settings.snowLine) {
                EditorGUILayout.HelpBox(
                    "緑地の限界高度が雪の高さより高くなっています。雪の下に岩帯を作る場合は雪の高さより低い値を設定してください。",
                    MessageType.Info);
            }
            settings.seed = EditorGUILayout.IntField("乱数シード", settings.seed);
            EditorGUI.indentLevel--;
        }
        if (GUILayout.Button("別のシードにする（未生成）")) {
            settings.seed = Guid.NewGuid().GetHashCode();
            SaveState();
        }

        showColors = EditorGUILayout.Foldout(showColors, "色", true);
        if (showColors) {
            EditorGUI.indentLevel++;
            settings.grassColor = EditorGUILayout.ColorField("草地", settings.grassColor);
            settings.forestGroundColor = EditorGUILayout.ColorField("森の地面", settings.forestGroundColor);
            settings.sandColor = EditorGUILayout.ColorField("水辺の砂", settings.sandColor);
            settings.rockColor = EditorGUILayout.ColorField("岩", settings.rockColor);
            settings.snowColor = EditorGUILayout.ColorField("雪", settings.snowColor);
            settings.underColor = EditorGUILayout.ColorField("島の下側", settings.underColor);
            settings.waterColor = EditorGUILayout.ColorField("水", settings.waterColor);
            settings.trunkColor = EditorGUILayout.ColorField("木の幹", settings.trunkColor);
            settings.leafColor = EditorGUILayout.ColorField("木の葉", settings.leafColor);
            EditorGUI.indentLevel--;
        }
        if (EditorGUI.EndChangeCheck()) {
            SaveState();
        }
        EditorGUILayout.HelpBox(
            "地形・木・草は共通マテリアル LowPolyVertexColor（すべてStatic結合メッシュ）、水は専用マテリアルを使います。",
            MessageType.Info);

        EditorGUILayout.Space();
        EditorGUILayout.LabelField("保存先", folder ?? FloatingTerrainPrefabCreator.OutputFolder);
        if (validName && AssetDatabase.LoadAssetAtPath<GameObject>(folder + "/Terrain.prefab") != null) {
            EditorGUILayout.HelpBox("同名の島を上書きします。配置済みの同じPrefabにも反映されます。", MessageType.Info);
        }
        using (new EditorGUI.DisabledScope(!validName || EditorApplication.isPlayingOrWillChangePlaymode
                || EditorApplication.isCompiling)) {
            if (GUILayout.Button("この設定で生成／同名の島を更新", GUILayout.Height(30f))) {
                try {
                    lastPrefab = FloatingTerrainPrefabCreator.CreatePrefab(settings);
                    SaveState();
                    EnableSceneViewRefresh();
                    ResetPreview();
                    EditorGUIUtility.PingObject(lastPrefab);
                } catch (Exception exception) {
                    Debug.LogException(exception);
                    EditorUtility.DisplayDialog("地形の生成に失敗", exception.Message, "閉じる");
                }
            }
        }

        if (lastPrefab != null) {
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("最後に生成した島（設定変更後は再生成）", EditorStyles.boldLabel);
            EditorGUILayout.ObjectField("Prefab", lastPrefab, typeof(GameObject), false);
            if (previewEditor == null) previewEditor = Editor.CreateEditor(lastPrefab);
            Rect previewRect = GUILayoutUtility.GetRect(240f, 260f, GUILayout.ExpandWidth(true));
            if (previewEditor.HasPreviewGUI()) {
                previewEditor.OnInteractivePreviewGUI(previewRect, GUIStyle.none);
            }
            EditorGUILayout.HelpBox(
                "プレビューをドラッグすると回転できます。橋ジェネレーターの始点・終点をこの島の子にすると、川の土手の上へ自動接続されます。",
                MessageType.Info);
        }
        EditorGUILayout.EndScrollView();
    }

    void OnDisable() {
        Undo.undoRedoPerformed -= OnUndoRedo;
        SaveState();
        ResetPreview();
    }

    void ResetSettings() {
        Undo.RecordObject(this, "地形の生成設定をリセット");
        settings = new FloatingTerrainSettings();
        ResetUiCache();
        SaveState();
        Repaint();
    }

    void LoadState() {
        if (!File.Exists(StateFilePath)) return;
        try {
            string json = File.ReadAllText(StateFilePath);
            if (string.IsNullOrWhiteSpace(json)) return;
            var state = JsonUtility.FromJson<PersistedState>(json);
            if (state == null) return;
            if (state.settings != null) settings = state.settings;
            showDetails = state.showDetails;
            showColors = state.showColors;
            if (!string.IsNullOrEmpty(state.lastPrefabPath)) {
                lastPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(state.lastPrefabPath);
            }
        } catch (Exception exception) {
            Debug.LogWarning("[FloatingTerrainGeneratorWindow] 設定の読み込みに失敗しました: " + exception.Message);
        }
    }

    void SaveState() {
        try {
            string dir = Path.GetDirectoryName(StateFilePath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);
            var state = new PersistedState {
                settings = settings,
                showDetails = showDetails,
                showColors = showColors,
                lastPrefabPath = lastPrefab != null ? AssetDatabase.GetAssetPath(lastPrefab) : null
            };
            File.WriteAllText(StateFilePath, JsonUtility.ToJson(state, true));
        } catch (Exception exception) {
            Debug.LogWarning("[FloatingTerrainGeneratorWindow] 設定の保存に失敗しました: " + exception.Message);
        }
    }

    void ResetPreview() {
        if (previewEditor != null) DestroyImmediate(previewEditor);
        previewEditor = null;
    }

    static void EnableSceneViewRefresh() {
        SceneView view = SceneView.lastActiveSceneView;
        if (view != null) {
            view.sceneViewState.alwaysRefresh = true;
            view.Repaint();
        }
    }
}

[Serializable]
public class FloatingTerrainSettings {
    public const int MinResolution = 32;
    public const int MaxResolution = 512;
    public const float DefaultCellSize = 5.5f;
    public const float MinIslandWidth = 160f;
    public const float MaxIslandWidth = 6000f;
    public const float MinCellSize = 1.5f;
    public const float MaxCellSize = 30.0f;
    public const float MinBottomDepthRatio = 0.04f;
    public const float MaxBottomDepthRatio = 0.60f;

    public const int MinRiverThreshold = 35;
    public const int MaxRiverThreshold = 15000;
    public const int DisabledRiverThreshold = 1000000;
    public const float DefaultRiverThreshold = 75f;
    public const float MinRiverAmount = 0f;
    public const float MaxRiverAmount = 2.0f;

    public const float DefaultLakeMinDepth = 0.8f;
    public const float MaxLakeMinDepth = 110f;
    public const float DisabledLakeMinDepth = 1000f;
    public const float MinLakeAmount = 0f;
    public const float MaxLakeAmount = 4.0f;

    public string terrainName = "Terrain";

    public int seed = 1234;
    public int resolution = 160;          // 1辺のセル数(大規模化)
    public float cellSize = 5.5f;         // 160 x 5.5 = 約880m
    public float jitter = 0.32f;
    public float heightJitter = 0.25f;

    public float bottomDepth = 150f;
    public float bottomDepthRatio = 0.17f;
    [HideInInspector] public bool hasBottomDepthRatio = true;
    public float cliffWidth = 0.08f;
    public float outlineNoise = 0.2f;

    public float baseHeight = 18f;
    public float plainsAmp = 6f;
    public float mountainAmp = 135f;      // 木の約20倍の雄大な山岳高
    public float warpAmount = 0.3f;

    public float canyonDepth = 45f;
    public float canyonWidth = 0.07f;

    public int riverThreshold = 75;
    public float riverWidth = 18f;        // 橋が必要になる広い川幅(m)
    public float riverBankDepth = 4.8f;   // 土手の上から水面までの段差(m)
    public float plainsRiverDepth = 7.0f; // 平原の川の水深(m)
    public float riverDepth = 12.0f;      // 山岳の川の水深(m)
    public float lakeMinDepth = 0.8f;
    public float lakeDepth = 11.0f;       // 湖の基本水深(m)
    [HideInInspector] public bool hasDepthTuningV2 = true;

    public float treeScale = 1.65f;       // 人がくぐれるサイズ感を保った木の倍率
    public float treeMinDist = 7.5f;
    public float forestThreshold = 0.48f;
    [UnityEngine.Serialization.FormerlySerializedAs("bareAmount")]
    public float meadowThreshold = 0.55f;
    public float treeLine = 85f;
    public float grassMinDist = 2.8f;
    public float grassDensity = 2.6f;
    public float grassSlopeMargin = 4.5f; // 急斜面周辺から草を離す距離(m)
    public float snowLine = 105f;
    public float greeneryLine = 92f;      // 緑地の上限高度（この上は岩肌へ移行）
    [HideInInspector] public bool hasGreeneryLine = true;
    public float rockSlope = 0.72f;

    public Color grassColor = new Color(0.45f, 0.72f, 0.27f);
    public Color forestGroundColor = new Color(0.30f, 0.55f, 0.22f);
    public Color sandColor = new Color(0.85f, 0.78f, 0.55f);
    public Color rockColor = new Color(0.52f, 0.50f, 0.48f);
    public Color snowColor = new Color(0.95f, 0.97f, 1f);
    public Color underColor = new Color(0.42f, 0.33f, 0.26f);
    public Color waterColor = new Color(0.25f, 0.55f, 0.85f);
    public Color trunkColor = new Color(0.45f, 0.30f, 0.18f);
    public Color leafColor = new Color(0.20f, 0.50f, 0.25f);

    public static float GetIslandWidth(FloatingTerrainSettings s) {
        return s.resolution * s.cellSize;
    }

    public static float GetTargetCellSize(FloatingTerrainSettings s) {
        return Mathf.Clamp(s.cellSize, MinCellSize, MaxCellSize);
    }

    public static int ComputeTargetResolution(float islandWidth, float targetCellSize) {
        float cell = Mathf.Clamp(targetCellSize, MinCellSize, MaxCellSize);
        return Mathf.RoundToInt(Mathf.Clamp(islandWidth, MinIslandWidth, MaxIslandWidth) / cell);
    }

    public static int ComputeClampedResolution(float islandWidth, float targetCellSize) {
        return Mathf.Clamp(ComputeTargetResolution(islandWidth, targetCellSize), MinResolution, MaxResolution);
    }

    public static float GetEffectiveGreeneryLine(FloatingTerrainSettings s) {
        if (!s.hasGreeneryLine) {
            s.greeneryLine = Mathf.Max(s.baseHeight + 10f, s.snowLine - 22f);
            s.hasGreeneryLine = true;
        }
        return s.greeneryLine;
    }

    public static float GetEffectiveLakeDepth(FloatingTerrainSettings s) {
        if (!s.hasDepthTuningV2) {
            if (s.lakeDepth <= 0.1f) s.lakeDepth = 11.0f;
            if (Mathf.Approximately(s.riverBankDepth, 3.2f)) s.riverBankDepth = 4.8f;
            if (Mathf.Approximately(s.plainsRiverDepth, 3.5f)) s.plainsRiverDepth = 7.0f;
            if (Mathf.Approximately(s.riverDepth, 6.0f)) s.riverDepth = 12.0f;
            s.hasDepthTuningV2 = true;
        }
        return s.lakeDepth;
    }

    public static float GetBottomDepthRatio(FloatingTerrainSettings s) {
        if (!s.hasBottomDepthRatio) {
            float islandWidth = Mathf.Max(1f, GetIslandWidth(s));
            s.bottomDepthRatio = Mathf.Clamp(s.bottomDepth / islandWidth, MinBottomDepthRatio, MaxBottomDepthRatio);
            s.hasBottomDepthRatio = true;
        }
        return Mathf.Clamp(s.bottomDepthRatio, MinBottomDepthRatio, MaxBottomDepthRatio);
    }

    public static void SetBottomDepthRatio(FloatingTerrainSettings s, float ratio) {
        s.bottomDepthRatio = Mathf.Clamp(ratio, MinBottomDepthRatio, MaxBottomDepthRatio);
        s.hasBottomDepthRatio = true;
        s.bottomDepth = Mathf.Max(20f, GetIslandWidth(s) * s.bottomDepthRatio);
    }

    public static float GetEffectiveBottomDepth(FloatingTerrainSettings s) {
        float ratio = GetBottomDepthRatio(s);
        s.bottomDepth = Mathf.Max(20f, GetIslandWidth(s) * ratio);
        return s.bottomDepth;
    }

    public static void ApplySizeAndCellSize(FloatingTerrainSettings s, float islandWidth, float targetCellSize) {
        float w = Mathf.Clamp(islandWidth, MinIslandWidth, MaxIslandWidth);
        int res = ComputeClampedResolution(w, targetCellSize);
        s.resolution = res;
        s.cellSize = Mathf.Clamp(w / res, 0.5f, 200f);
        GetEffectiveBottomDepth(s);
    }

    const float RiverSubUnitExp = 4.9f;
    const float LakeSubUnitExp = 4.85f;

    public static int ComputeRiverThreshold(float riverAmount) {
        if (riverAmount <= 0.005f) return DisabledRiverThreshold;
        float clamped = Mathf.Clamp(riverAmount, 0.006f, MaxRiverAmount);
        if (clamped >= 1f) {
            return Mathf.Clamp(Mathf.RoundToInt(DefaultRiverThreshold / clamped),
                MinRiverThreshold, Mathf.RoundToInt(DefaultRiverThreshold));
        }
        return Mathf.Clamp(Mathf.RoundToInt(DefaultRiverThreshold * Mathf.Exp(RiverSubUnitExp * (1f - clamped))),
            Mathf.RoundToInt(DefaultRiverThreshold), MaxRiverThreshold);
    }

    public static float GetRiverAmount(FloatingTerrainSettings s) {
        if (s.riverThreshold >= DisabledRiverThreshold / 2) return 0f;
        if (s.riverThreshold <= Mathf.RoundToInt(DefaultRiverThreshold)) {
            return Mathf.Clamp(DefaultRiverThreshold / Mathf.Clamp(s.riverThreshold, MinRiverThreshold, DefaultRiverThreshold),
                1f, MaxRiverAmount);
        }
        float thr = Mathf.Clamp(s.riverThreshold, DefaultRiverThreshold, MaxRiverThreshold);
        return Mathf.Clamp(1f - Mathf.Log(thr / DefaultRiverThreshold) / RiverSubUnitExp, 0.006f, 1f);
    }

    public static void SetRiverAmount(FloatingTerrainSettings s, float riverAmount) {
        s.riverThreshold = ComputeRiverThreshold(riverAmount);
    }

    public static float GetLakeAmount(FloatingTerrainSettings s) {
        if (s.lakeMinDepth >= 500f) return 0f;
        if (s.lakeMinDepth <= DefaultLakeMinDepth) {
            return Mathf.Clamp(DefaultLakeMinDepth / Mathf.Max(0.2f, s.lakeMinDepth), 1f, MaxLakeAmount);
        }
        float d = Mathf.Clamp(s.lakeMinDepth, DefaultLakeMinDepth, MaxLakeMinDepth);
        return Mathf.Clamp(1f - Mathf.Log(d / DefaultLakeMinDepth) / LakeSubUnitExp, 0.006f, 1f);
    }

    public static void SetLakeAmount(FloatingTerrainSettings s, float lakeAmount) {
        if (lakeAmount <= 0.005f) {
            s.lakeMinDepth = DisabledLakeMinDepth;
            return;
        }
        float clamped = Mathf.Clamp(lakeAmount, 0.006f, MaxLakeAmount);
        if (clamped >= 1f) {
            s.lakeMinDepth = Mathf.Clamp(DefaultLakeMinDepth / clamped, 0.2f, DefaultLakeMinDepth);
            return;
        }
        s.lakeMinDepth = Mathf.Clamp(DefaultLakeMinDepth * Mathf.Exp(LakeSubUnitExp * (1f - clamped)),
            DefaultLakeMinDepth, MaxLakeMinDepth);
    }

    public static float GetForestSpread(FloatingTerrainSettings s) {
        return Mathf.Clamp01(1f - s.forestThreshold);
    }

    public static void SetForestSpread(FloatingTerrainSettings s, float forestSpread) {
        s.forestThreshold = Mathf.Clamp01(1f - forestSpread);
    }

    public static float GetMeadowSpread(FloatingTerrainSettings s) {
        return Mathf.Clamp01(1f - s.meadowThreshold);
    }

    public static void SetMeadowSpread(FloatingTerrainSettings s, float meadowSpread) {
        s.meadowThreshold = Mathf.Clamp01(1f - meadowSpread);
    }
}

public static class FloatingTerrainPrefabCreator {
    public const string OutputFolder = "Assets/MyAssets/Generated/FloatingTerrains";
    public const string SharedMaterialPath = "Assets/MyAssets/GameObjects/SharedMaterials/LowPolyVertexColor.mat";
    const string WaterMaterialPath = OutputFolder + "/IslandWater.mat";

    public static string GetFolder(string name) {
        string trimmed = (name ?? "").Trim();
        if (trimmed.Length == 0) throw new ArgumentException("島の名前を入力してください。");
        if (trimmed == "." || trimmed == ".." || trimmed.IndexOfAny(System.IO.Path.GetInvalidFileNameChars()) >= 0) {
            throw new ArgumentException("島の名前にファイル名として使えない文字が含まれています。");
        }
        return OutputFolder + "/" + trimmed;
    }

    public static GameObject CreatePrefab(FloatingTerrainSettings settings) {
        string folder = GetFolder(settings.terrainName);
        string prefabPath = folder + "/Terrain.prefab";
        GameObject existingPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath);
        if (existingPrefab == null && (System.IO.File.Exists(prefabPath) || System.IO.Directory.Exists(prefabPath))) {
            throw new InvalidOperationException("保存先にPrefab以外のファイル等があります: " + prefabPath);
        }

        Material shared = AssetDatabase.LoadAssetAtPath<Material>(SharedMaterialPath);
        if (shared == null) shared = LowPolyVertexColorUtility.GetMaterial();
        if (shared != null && !shared.enableInstancing) {
            shared.enableInstancing = true;
            EditorUtility.SetDirty(shared);
        }

        FloatingTerrainBuilder.BuildResult result = new FloatingTerrainBuilder().BuildDetailed(settings);
        Scene previewScene = default;
        GameObject root = null;
        try {
            EnsureFolder(folder);
            Material water = GetWaterMaterial();
            if (existingPrefab != null) {
                root = PrefabUtility.LoadPrefabContents(prefabPath);
            } else {
                previewScene = EditorSceneManager.NewPreviewScene();
                root = new GameObject();
                SceneManager.MoveGameObjectToScene(root, previewScene);
            }
            root.name = System.IO.Path.GetFileName(folder);
            GameObjectUtility.SetStaticEditorFlags(root,
                StaticEditorFlags.BatchingStatic | StaticEditorFlags.OccluderStatic |
                StaticEditorFlags.OccludeeStatic | StaticEditorFlags.ContributeGI);

            // 1. Terrain (OccluderStatic + MeshCollider)
            Mesh savedTerrain = SaveMesh(result.terrainMesh, folder + "/TerrainMesh.asset");
            Transform terrainTr = EnsureChild(root.transform, "Terrain");
            ClearChildren(terrainTr);
            GameObjectUtility.SetStaticEditorFlags(terrainTr.gameObject,
                StaticEditorFlags.BatchingStatic | StaticEditorFlags.OccluderStatic |
                StaticEditorFlags.OccludeeStatic | StaticEditorFlags.ContributeGI);
            SetupMeshRenderer(terrainTr.gameObject, savedTerrain, shared, ShadowCastingMode.On);
            var collider = terrainTr.GetComponent<MeshCollider>();
            if (collider == null) collider = terrainTr.gameObject.AddComponent<MeshCollider>();
            collider.sharedMesh = null;
            collider.sharedMesh = savedTerrain;

            // 2. Water
            Mesh savedWater = SaveMesh(result.waterMesh, folder + "/WaterMesh.asset");
            Transform waterTr = EnsureChild(root.transform, "Water");
            ClearChildren(waterTr);
            GameObjectUtility.SetStaticEditorFlags(waterTr.gameObject,
                StaticEditorFlags.BatchingStatic | StaticEditorFlags.OccludeeStatic);
            SetupMeshRenderer(waterTr.gameObject, savedWater, water, ShadowCastingMode.Off);

            // 3. Trees (静的結合メッシュ + 軽量当たり判定メッシュ)
            Transform treesTr = EnsureChild(root.transform, "Trees");
            ClearChildren(treesTr);
            DeleteAssetIfExists(folder + "/TreeLod0Mesh.asset");
            DeleteAssetIfExists(folder + "/TreeLod1Mesh.asset");
            Mesh savedTrees = SaveMesh(result.combinedTreesMesh, folder + "/TreesMesh.asset");
            Mesh treesColSource = result.combinedTreesColliderMesh ?? new Mesh { name = "TreesColliderMesh" };
            Mesh savedTreesCollider = SaveMesh(treesColSource, folder + "/TreesColliderMesh.asset");
            GameObjectUtility.SetStaticEditorFlags(treesTr.gameObject,
                StaticEditorFlags.BatchingStatic | StaticEditorFlags.OccludeeStatic | StaticEditorFlags.ContributeGI);
            SetupMeshRenderer(treesTr.gameObject, savedTrees, shared, ShadowCastingMode.On);
            var treesCollider = treesTr.GetComponent<MeshCollider>();
            if (savedTreesCollider.vertexCount > 0) {
                if (treesCollider == null) treesCollider = treesTr.gameObject.AddComponent<MeshCollider>();
                treesCollider.sharedMesh = null;
                treesCollider.sharedMesh = savedTreesCollider;
            } else if (treesCollider != null) {
                UnityEngine.Object.DestroyImmediate(treesCollider);
            }

            // 4. Grass (Static結合メッシュ)
            Transform grassTr = EnsureChild(root.transform, "Grass");
            ClearChildren(grassTr);
            for (int i = 0; i < 64; i++) {
                DeleteAssetIfExists(folder + "/GrassChunk_" + i + ".asset");
            }
            Mesh grassSource = result.combinedGrassMesh ?? new Mesh { name = "GrassMesh" };
            Mesh savedGrass = SaveMesh(grassSource, folder + "/GrassMesh.asset");
            GameObjectUtility.SetStaticEditorFlags(grassTr.gameObject,
                StaticEditorFlags.BatchingStatic | StaticEditorFlags.OccludeeStatic);
            SetupMeshRenderer(grassTr.gameObject, savedGrass, shared, ShadowCastingMode.Off);

            GameObject prefab = PrefabUtility.SaveAsPrefabAsset(root, prefabPath);
            if (prefab == null) throw new InvalidOperationException("Prefabの保存に失敗しました。");
            RefreshMeshColliders(AssetDatabase.LoadAssetAtPath<Mesh>(folder + "/TerrainMesh.asset"));
            RefreshMeshColliders(AssetDatabase.LoadAssetAtPath<Mesh>(folder + "/TreesColliderMesh.asset"));
            return prefab;
        } finally {
            if (existingPrefab != null && root != null) PrefabUtility.UnloadPrefabContents(root);
            else if (previewScene.IsValid()) EditorSceneManager.ClosePreviewScene(previewScene);
            DestroyTempMesh(result.terrainMesh);
            DestroyTempMesh(result.waterMesh);
            DestroyTempMesh(result.combinedTreesMesh);
            DestroyTempMesh(result.combinedTreesColliderMesh);
            DestroyTempMesh(result.combinedGrassMesh);
        }
    }

    static Transform EnsureChild(Transform parent, string name) {
        Transform child = parent.Find(name);
        if (child == null) {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            child = go.transform;
        }
        return child;
    }

    static void ClearChildren(Transform parent) {
        for (int i = parent.childCount - 1; i >= 0; i--) {
            UnityEngine.Object.DestroyImmediate(parent.GetChild(i).gameObject);
        }
    }

    static void RemoveMeshComponentsIfPresent(GameObject go) {
        var mr = go.GetComponent<MeshRenderer>();
        if (mr != null) UnityEngine.Object.DestroyImmediate(mr);
        var mf = go.GetComponent<MeshFilter>();
        if (mf != null) UnityEngine.Object.DestroyImmediate(mf);
    }

    static void SetupMeshRenderer(GameObject go, Mesh mesh, Material mat, ShadowCastingMode shadowMode) {
        var filter = go.GetComponent<MeshFilter>();
        if (filter == null) filter = go.AddComponent<MeshFilter>();
        var renderer = go.GetComponent<MeshRenderer>();
        if (renderer == null) renderer = go.AddComponent<MeshRenderer>();
        filter.sharedMesh = mesh;
        renderer.sharedMaterial = mat;
        renderer.shadowCastingMode = shadowMode;
    }

    static void DestroyTempMesh(Mesh mesh) {
        if (mesh != null && !AssetDatabase.Contains(mesh)) UnityEngine.Object.DestroyImmediate(mesh);
    }

    static void DeleteAssetIfExists(string path) {
        if (AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(path) != null || System.IO.File.Exists(path)) {
            AssetDatabase.DeleteAsset(path);
        }
    }

    static Mesh SaveMesh(Mesh mesh, string path) {
        mesh.name = System.IO.Path.GetFileNameWithoutExtension(path);
        Mesh saved = AssetDatabase.LoadAssetAtPath<Mesh>(path);
        if (saved == null && (System.IO.File.Exists(path) || System.IO.Directory.Exists(path))) {
            throw new InvalidOperationException("保存先にMesh以外のファイル等があります: " + path);
        }
        if (saved != null) {
            CopyMeshData(mesh, saved);
            EditorUtility.SetDirty(saved);
            AssetDatabase.SaveAssetIfDirty(saved);
        } else {
            AssetDatabase.CreateAsset(mesh, path);
        }
        AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
        return AssetDatabase.LoadAssetAtPath<Mesh>(path);
    }

    static Material GetWaterMaterial() {
        Material existing = AssetDatabase.LoadAssetAtPath<Material>(WaterMaterialPath);
        if (existing != null) return existing;
        Shader shader = Shader.Find("Island/VertexColorLit");
        if (shader == null) throw new InvalidOperationException("水用シェーダー Island/VertexColorLit が見つかりません。");
        var material = new Material(shader) { name = "IslandWater" };
        AssetDatabase.CreateAsset(material, WaterMaterialPath);
        return material;
    }

    static void CopyMeshData(Mesh source, Mesh destination) {
        destination.Clear(false);
        destination.indexFormat = source.indexFormat;
        destination.name = source.name;
        destination.vertices = source.vertices;
        destination.normals = source.normals;
        destination.colors32 = source.colors32;
        destination.subMeshCount = source.subMeshCount;
        for (int i = 0; i < source.subMeshCount; i++) {
            destination.SetTriangles(source.GetTriangles(i), i, false);
        }
        destination.RecalculateBounds();
        destination.UploadMeshData(false);
    }

    static void RefreshMeshColliders(Mesh mesh) {
        foreach (var collider in Resources.FindObjectsOfTypeAll<MeshCollider>()) {
            if (collider == null || EditorUtility.IsPersistent(collider)
                    || !collider.gameObject.scene.IsValid() || collider.sharedMesh != mesh) continue;
            collider.sharedMesh = null;
            collider.sharedMesh = mesh;
        }
    }

    static void EnsureFolder(string path) {
        if (AssetDatabase.IsValidFolder(path)) return;
        string parent = System.IO.Path.GetDirectoryName(path).Replace('\\', '/');
        EnsureFolder(parent);
        AssetDatabase.CreateFolder(parent, System.IO.Path.GetFileName(path));
    }
}
```

## File: 地形ジェネレーター/FloatingTerrainBuilder.cs.meta

```meta
fileFormatVersion: 2
guid: f6a99e9f67934ce0ab07fbf5f6c0c6e1
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 地形ジェネレーター/FloatingTerrainGeneratorWindow.cs.meta

```meta
fileFormatVersion: 2
guid: e17cc3814d074849a84f1f3feecff08b
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 地形ジェネレーター/IslandVertexColorLit.shader

```shader
Shader "Island/VertexColorLit"
{
    Properties
    {
        _CloudHeight ("Cloud Sea Altitude (m)", Float) = -750
        _MistDepth ("Mist Transition (m)", Float) = 380
        _CloudMistColor ("Cloud Mist Color", Color) = (0.91, 0.92, 0.92, 1)
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        CGPROGRAM
        #pragma surface surf Lambert

        float _CloudHeight;
        float _MistDepth;
        fixed4 _CloudMistColor;

        struct Input
        {
            float4 color : COLOR;
            float3 worldPos;
        };

        void surf (Input IN, inout SurfaceOutput o)
        {
            float aboveCam = step(_CloudHeight, _WorldSpaceCameraPos.y);
            // 雲海より上空の視点からは、雲海より下の部分を雲に遮蔽される扱いで切り抜く
            if (aboveCam > 0.5)
            {
                clip(IN.worldPos.y - _CloudHeight);
            }

            float distToCloud = max(0.0, IN.worldPos.y - _CloudHeight);
            float mistFactor = aboveCam * (1.0 - smoothstep(24.0, max(25.0, _MistDepth), distToCloud));

            o.Albedo = IN.color.rgb * (1.0 - mistFactor);
            o.Emission = _CloudMistColor.rgb * mistFactor;
        }
        ENDCG
    }
    Fallback "Diffuse"
}

```

## File: 地形ジェネレーター/IslandVertexColorWind.shader

```shader
Shader "Island/VertexColorWind" {
    Properties {
        _WindStrength ("Wind Strength", Range(0, 1)) = 0.28
        _WindSpeed ("Wind Speed", Range(0, 5)) = 1.8
        _WindScale ("Wind Wave Scale", Range(0.01, 0.5)) = 0.12
    }
    SubShader {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        LOD 150
        Cull Off
        CGPROGRAM
        #pragma surface surf Lambert vertex:vert fullforwardshadows addshadow noforwardadd exclude_path:deferred
        #pragma target 3.0

        float _WindStrength;
        float _WindSpeed;
        float _WindScale;

        struct Input {
            float4 color : COLOR;
        };

        void vert(inout appdata_full v) {
            // 両面描画のため法線は上向きに固定(草の柔らかい陰影)
            v.normal = float3(0, 1, 0);
            float weight = v.texcoord.x;
            float phase = v.texcoord.y;
            if (weight > 0.0001 && _WindStrength > 0.0001) {
                float3 worldPos = mul(unity_ObjectToWorld, v.vertex).xyz;
                float t = _Time.y * _WindSpeed;
                float wave1 = sin(worldPos.x * _WindScale + worldPos.z * (_WindScale * 0.6) + t + phase);
                float wave2 = sin(worldPos.x * (_WindScale * 2.3) - worldPos.z * (_WindScale * 1.7) + t * 1.9 + phase * 1.7);
                float gust = 0.25 + 0.75 * wave1 + 0.35 * wave2;

                float3 worldOffset = float3(gust, 0.0, gust * 0.55 + wave2 * 0.25) * (_WindStrength * weight);
                float3 localOffset = mul((float3x3)unity_WorldToObject, worldOffset);
                v.vertex.xyz += localOffset;
                v.vertex.y -= length(worldOffset) * 0.25;
            }

            // MeshにはsRGBのColor32を保存。補間前に作業色空間へ変換する。
            #ifndef UNITY_COLORSPACE_GAMMA
            v.color.rgb = GammaToLinearSpace(v.color.rgb);
            #endif
        }

        void surf(Input input, inout SurfaceOutput output) {
            output.Albedo = input.color.rgb * 0.62;
            output.Alpha = 1;
        }
        ENDCG
    }
    FallBack "Diffuse"
}

```

## File: 地形ジェネレーター/IslandVertexColorLit.shader.meta

```meta
fileFormatVersion: 2
guid: 4abf37f2ee3749438f9c0ad29602ebed
ShaderImporter:
  externalObjects: {}
  defaultTextures: []
  nonModifiableTextures: []
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 地形ジェネレーター/IslandVertexColorWind.shader.meta

```meta
fileFormatVersion: 2
guid: 91b70bf7670847949b9d945b6570c87a
ShaderImporter:
  externalObjects: {}
  defaultTextures: []
  nonModifiableTextures: []
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 頂点カラー変換/LowPolyGeneratedMigration.cs

```cs
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class LowPolyGeneratedMigration {
    // 元MeshとMaterialは残し、頂点カラー版Meshへ参照を切り替える。
    [MenuItem("Tools/MyWorld/頂点カラー/既存の島と橋を移行")]
    public static void Migrate() {
        foreach (string guid in AssetDatabase.FindAssets("t:Prefab", new[] {
                FloatingIslandMeshGenerator.OutputFolder, BridgeMeshGenerator.OutputFolder })) {
            string path = AssetDatabase.GUIDToAssetPath(guid);
            var root = PrefabUtility.LoadPrefabContents(path);
            try {
                bool changed = false;
                foreach (var renderer in root.GetComponentsInChildren<MeshRenderer>(true)) changed |= Convert(renderer);
                if (changed) PrefabUtility.SaveAsPrefabAsset(root, path);
            } finally { PrefabUtility.UnloadPrefabContents(root); }
        }
        // シーンに残る旧MaterialのOverrideも実際の配色で移行。シーンは保存しない。
        foreach (var renderer in Resources.FindObjectsOfTypeAll<MeshRenderer>()) {
            if (EditorUtility.IsPersistent(renderer) || !renderer.gameObject.scene.IsValid()
                || EditorSceneManager.IsPreviewScene(renderer.gameObject.scene)) continue;
            if (Convert(renderer)) {
                PrefabUtility.RecordPrefabInstancePropertyModifications(renderer);
                PrefabUtility.RecordPrefabInstancePropertyModifications(renderer.GetComponent<MeshFilter>());
                EditorSceneManager.MarkSceneDirty(renderer.gameObject.scene);
            }
        }
    }

    static bool Convert(MeshRenderer renderer) {
        Material material = renderer.sharedMaterial;
        var filter = renderer.GetComponent<MeshFilter>();
        if (material == null || material.shader == null || material.shader.name != "MyWorld/Floating Island Two Color") return false;
        if (filter == null || filter.sharedMesh == null || renderer.sharedMaterials.Length != 1)
            throw new InvalidOperationException("旧2色Meshの構成が不正: " + renderer.name);
        Mesh source = filter.sharedMesh;
        string sourcePath = AssetDatabase.GetAssetPath(source);
        Color grass = material.GetColor("_GrassColor"), rock = material.GetColor("_RockColor");
        string key = sourcePath + JsonUtility.ToJson(grass) + JsonUtility.ToJson(rock);
        string folder = Path.GetDirectoryName(sourcePath).Replace('\\', '/');
        string path = folder + "/VertexColor_" + Hash128.Compute(key) + ".asset";
        Mesh mesh = AssetDatabase.LoadAssetAtPath<Mesh>(path);
        if (mesh == null) {
            mesh = UnityEngine.Object.Instantiate(source);
            if (Path.GetFileName(sourcePath).StartsWith("VertexColor_", StringComparison.Ordinal)) {
                // Prefab移行後、旧Materialだけ上書きされていた島はアルファから区分を復元。
                var colors = mesh.colors32;
                for (int i = 0; i < colors.Length; i++) colors[i] = new Color32(colors[i].a, 0, 0, 255);
                mesh.colors32 = colors;
            }
            LowPolyVertexColorUtility.BakeIslandMask(mesh, grass, rock);
            mesh.name = source.name.Replace("_VertexColor", "") + "_VertexColor";
            AssetDatabase.CreateAsset(mesh, path);
        }
        Undo.RecordObjects(new UnityEngine.Object[] { filter, renderer }, "頂点カラーへ移行");
        filter.sharedMesh = mesh;
        renderer.sharedMaterial = LowPolyVertexColorUtility.GetMaterial();
        var collider = renderer.GetComponent<MeshCollider>();
        if (collider != null && collider.sharedMesh == source) {
            Undo.RecordObject(collider, "頂点カラーMeshへ更新");
            collider.sharedMesh = mesh;
            if (PrefabUtility.IsPartOfPrefabInstance(collider)) PrefabUtility.RecordPrefabInstancePropertyModifications(collider);
        }
        return true;
    }
}

```

## File: 頂点カラー変換/LowPolyModelConverter.cs

```cs
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using Object = UnityEngine.Object;

// 原本のImporterは変更しない。変換できないPrefabは丸ごと除外し、理由を記録する。
public static class LowPolyModelConverter {
    public const string SourceRoot = "Assets/ThirdParty/polyperfect/Low Poly Ultimate Pack";
    public const string OutputRoot = "Assets/ThirdParty/Mesh&Prefab(Generated)/LowPolyVertexColor";
    public const string ReportPath = "ドキュメント/エディターツール/頂点カラー変換結果.json";
    static readonly Dictionary<Texture2D, Texture2D> textures = new Dictionary<Texture2D, Texture2D>();
    static readonly Dictionary<Texture2D, bool> srgbTextures = new Dictionary<Texture2D, bool>();
    static readonly Dictionary<string, Mesh> meshes = new Dictionary<string, Mesh>();
    static readonly Dictionary<string, string> failures = new Dictionary<string, string>();
    static string[] pending;
    static int cursor;
    static Report report;

    [Serializable]
    public class Entry {
        public string source, output, reason;
        public bool converted;
    }
    [Serializable]
    public class Report {
        public string date = "2026-11-04";
        public int total, converted, skipped;
        public long sourceVertexBytes, outputVertexBytes;
        public List<Entry> entries = new List<Entry>();
    }
    public static object Status() {
        return new { running = pending != null, processed = cursor, total = report == null ? 0 : report.total,
            converted = report == null ? 0 : report.converted, skipped = report == null ? 0 : report.skipped,
            meshes = meshes.Count };
    }

    [MenuItem("Tools/MyWorld/頂点カラー/Low Poly Ultimate Packを一括変換")]
    public static void StartPack() {
        Start(AssetDatabase.FindAssets("t:Prefab", new[] { SourceRoot }).Select(AssetDatabase.GUIDToAssetPath).OrderBy(x => x).ToArray());
    }

    [MenuItem("Tools/MyWorld/頂点カラー/中断したパック変換を再開")]
    public static void ResumePack() {
        if (pending != null) throw new InvalidOperationException("変換処理が実行中です。");
        var previous = JsonUtility.FromJson<Report>(File.ReadAllText(ReportPath));
        var paths = AssetDatabase.FindAssets("t:Prefab", new[] { SourceRoot }).Select(AssetDatabase.GUIDToAssetPath).OrderBy(x => x).ToArray();
        if (paths.Length != previous.total || previous.entries.Where((e, i) => e.source != paths[i]).Any())
            throw new InvalidOperationException("パックの内容が変化しています。一括変換を最初から実行してください。");
        ClearCache();
        report = previous; pending = paths; cursor = previous.entries.Count;
        EditorApplication.update += Tick;
    }

    [MenuItem("Tools/MyWorld/頂点カラー/選択したPrefabを変換")]
    public static void StartSelection() {
        Start(Selection.objects.Select(AssetDatabase.GetAssetPath).Where(p => p.StartsWith(SourceRoot + "/", StringComparison.Ordinal)
            && p.EndsWith(".prefab", StringComparison.OrdinalIgnoreCase)).ToArray());
    }

    static void Start(string[] paths) {
        if (pending != null) throw new InvalidOperationException("変換処理が実行中です。");
        if (EditorApplication.isPlayingOrWillChangePlaymode) throw new InvalidOperationException("Playモードを停止してください。");
        if (paths.Length == 0) throw new InvalidOperationException("対象Prefabがありません。");
        ClearCache();
        LowPolyVertexColorUtility.GetMaterial();
        pending = paths; cursor = 0; report = new Report { total = paths.Length };
        EditorApplication.update += Tick;
    }

    static void Tick() {
        if (EditorApplication.isCompiling || EditorApplication.isUpdating) return;
        double until = EditorApplication.timeSinceStartup + 0.5;
        while (pending != null && cursor < pending.Length && EditorApplication.timeSinceStartup < until) {
            string path = pending[cursor++];
            try {
                string output = ConvertPrefab(path);
                report.entries.Add(new Entry { source = path, output = output, converted = true });
                report.converted++;
            } catch (Exception exception) {
                report.entries.Add(new Entry { source = path, reason = exception.Message });
                report.skipped++;
            }
        }
        if (cursor % 50 == 0 || cursor == pending.Length) WriteReport();
        if (cursor == pending.Length) {
            EditorApplication.update -= Tick;
            pending = null;
            WriteReport();
            ClearCache();
            Debug.Log("頂点カラー変換完了: 成功 " + report.converted + " / 除外 " + report.skipped + "。" + ReportPath);
        }
    }

    static void WriteReport() {
        File.WriteAllText(ReportPath, JsonUtility.ToJson(report, true));
    }

    static void ClearCache() {
        foreach (var texture in textures.Values) Object.DestroyImmediate(texture);
        textures.Clear(); srgbTextures.Clear(); meshes.Clear(); failures.Clear();
    }

    public static string ConvertPrefab(string path) {
        if (!path.StartsWith(SourceRoot + "/", StringComparison.Ordinal)) throw new ArgumentException("対象パックのPrefabを指定してください。");
        string output = OutputRoot + "/Prefabs/" + path.Substring(SourceRoot.Length + 1);
        GameObject root = PrefabUtility.LoadPrefabContents(path);
        try {
            var renderers = root.GetComponentsInChildren<Renderer>(true);
            if (renderers.Length == 0) throw new InvalidOperationException("Rendererなし");
            // 先に全Rendererを検査・変換し、部分的に変換されたPrefabを保存しない。
            var replacements = new Dictionary<Renderer, Mesh>();
            var collisionMeshes = new Dictionary<Mesh, Mesh>();
            foreach (var renderer in renderers) {
                Mesh source;
                if (renderer is SkinnedMeshRenderer skin) source = skin.sharedMesh;
                else if (renderer is MeshRenderer) {
                    var filter = renderer.GetComponent<MeshFilter>();
                    source = filter == null ? null : filter.sharedMesh;
                } else throw new InvalidOperationException("非対応Renderer: " + renderer.GetType().Name);
                if (source == null) throw new InvalidOperationException("Meshなし: " + renderer.name);
                Mesh replacement = GetMesh(source, renderer.sharedMaterials);
                replacements.Add(renderer, replacement);
                collisionMeshes[source] = replacement;
            }
            foreach (var pair in replacements) {
                if (pair.Key is SkinnedMeshRenderer skin) skin.sharedMesh = pair.Value;
                else pair.Key.GetComponent<MeshFilter>().sharedMesh = pair.Value;
                pair.Key.sharedMaterials = new[] { LowPolyVertexColorUtility.GetMaterial() };
            }
            foreach (var collider in root.GetComponentsInChildren<MeshCollider>(true)) {
                if (collider.sharedMesh != null && collisionMeshes.TryGetValue(collider.sharedMesh, out var collision))
                    collider.sharedMesh = collision;
            }
            LowPolyVertexColorUtility.EnsureFolder(Path.GetDirectoryName(output).Replace('\\', '/'));
            if (PrefabUtility.SaveAsPrefabAsset(root, output) == null) throw new InvalidOperationException("Prefab保存失敗");
            return output;
        } finally { PrefabUtility.UnloadPrefabContents(root); }
    }

    static string AssetKey(Object asset) {
        string guid; long id;
        if (!AssetDatabase.TryGetGUIDAndLocalFileIdentifier(asset, out guid, out id)) throw new InvalidOperationException("保存されていないアセット");
        return guid + "_" + id;
    }

    static Mesh GetMesh(Mesh source, Material[] materials) {
        string key = AssetKey(source) + ":" + string.Join(":", materials.Select(m => m == null ? "null" : AssetKey(m)));
        if (meshes.TryGetValue(key, out var saved)) return saved;
        if (failures.TryGetValue(key, out var failure)) throw new InvalidOperationException(failure);
        Mesh converted = null;
        try {
            converted = BuildMesh(source, materials);
            string folder = OutputRoot + "/Meshes";
            LowPolyVertexColorUtility.EnsureFolder(folder);
            string meshName = VertexColorCorrection.SafeAssetName(source.name) + "_VertexColor";
            string path = folder + "/" + meshName + "_" + Hash128.Compute(key).ToString() + ".asset";
            converted.name = meshName;
            saved = AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if (saved == null) {
                AssetDatabase.CreateAsset(converted, path);
                saved = converted;
            } else {
                EditorUtility.CopySerialized(converted, saved);
                EditorUtility.SetDirty(saved);
                AssetDatabase.SaveAssetIfDirty(saved);
                AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
            }
            meshes.Add(key, saved);
            if (report != null) {
                report.sourceVertexBytes += VertexBytes(source);
                report.outputVertexBytes += VertexBytes(saved);
            }
            return saved;
        } catch (Exception exception) {
            failures[key] = exception.Message;
            throw;
        } finally {
            if (converted != null && !AssetDatabase.Contains(converted)) Object.DestroyImmediate(converted);
        }
    }

    public static long VertexBytes(Mesh mesh) {
        long stride = 0;
        for (int i = 0; i < mesh.vertexBufferCount; i++) stride += mesh.GetVertexBufferStride(i);
        return stride * mesh.vertexCount;
    }

    public static Mesh BuildMesh(Mesh source, Material[] materials) {
        if (materials.Length != source.subMeshCount) throw new InvalidOperationException("Material数とSubMesh数が不一致");
        var uv = source.uv;
        var colors = new List<Color32>();
        var remap = new List<int>();
        var lookup = new Dictionary<string, int>();
        var triangles = new List<int>();
        for (int sub = 0; sub < source.subMeshCount; sub++) {
            if (source.GetTopology(sub) != MeshTopology.Triangles) throw new InvalidOperationException("三角形以外のMesh");
            Material material = materials[sub];
            ValidateMaterial(material);
            Texture2D texture = material.mainTexture as Texture2D;
            if (material.mainTexture != null && texture == null) throw new InvalidOperationException("Texture2D以外の基本色");
            if (texture != null && uv.Length != source.vertexCount) throw new InvalidOperationException("UV0なし");
            Texture2D readable = texture == null ? null : ReadTexture(texture);
            int[] indices = source.GetTriangles(sub);
            var mapped = new int[indices.Length];
            for (int n = 0; n < indices.Length; n++) {
                int index = indices[n];
                Color color = Sample(material, readable, texture, texture == null ? Vector2.zero : uv[index]);
                Color32 encoded = color.gamma; encoded.a = 255;
                string key = index + ":" + encoded.r + ":" + encoded.g + ":" + encoded.b;
                int destination;
                if (!lookup.TryGetValue(key, out destination)) {
                    destination = remap.Count;
                    lookup.Add(key, destination);
                    remap.Add(index); colors.Add(encoded);
                }
                mapped[n] = destination;
            }
            if (texture != null) {
                for (int i = 0; i < indices.Length; i += 3) {
                    int a = indices[i], b = indices[i + 1], c = indices[i + 2];
                    int ca = mapped[i], cb = mapped[i + 1], cc = mapped[i + 2];
                    CheckSample(material, readable, texture, (uv[a] + uv[b] + uv[c]) / 3f,
                        (((Color)colors[ca]).linear + ((Color)colors[cb]).linear + ((Color)colors[cc]).linear) / 3f);
                    CheckSample(material, readable, texture, (uv[a] + uv[b]) * 0.5f, (((Color)colors[ca]).linear + ((Color)colors[cb]).linear) * 0.5f);
                    CheckSample(material, readable, texture, (uv[b] + uv[c]) * 0.5f, (((Color)colors[cb]).linear + ((Color)colors[cc]).linear) * 0.5f);
                    CheckSample(material, readable, texture, (uv[c] + uv[a]) * 0.5f, (((Color)colors[cc]).linear + ((Color)colors[ca]).linear) * 0.5f);
                }
            }
            triangles.AddRange(mapped);
        }
        var result = RemapMesh(source, remap);
        result.SetColors(colors);
        result.SetTriangles(triangles, 0, false);
        if (result.uv2.Length == 0 && result.bindposes.Length == 0 && result.blendShapeCount == 0)
            Unwrapping.GenerateSecondaryUVSet(result);
        LowPolyVertexColorUtility.StripUnused(result);
        return result;
    }

    static Mesh RemapMesh(Mesh source, List<int> map) {
        var result = new Mesh { name = source.name + "_VertexColor",
            indexFormat = map.Count > 65535 ? IndexFormat.UInt32 : IndexFormat.UInt16 };
        var positions = source.vertices;
        var normals = source.normals;
        result.vertices = map.Select(i => positions[i]).ToArray();
        if (normals.Length == positions.Length) result.normals = map.Select(i => normals[i]).ToArray();
        // UV0と接線以外のチャンネルは次元も維持する。
        for (int channel = 1; channel < 8; channel++) {
            var attribute = (VertexAttribute)((int)VertexAttribute.TexCoord0 + channel);
            if (!source.HasVertexAttribute(attribute)) continue;
            var values = new List<Vector4>(); source.GetUVs(channel, values);
            int dimension = source.GetVertexAttributeDimension(attribute);
            if (dimension == 2) result.SetUVs(channel, map.Select(i => (Vector2)values[i]).ToList());
            else if (dimension == 3) result.SetUVs(channel, map.Select(i => (Vector3)values[i]).ToList());
            else result.SetUVs(channel, map.Select(i => values[i]).ToList());
        }
        if (source.bindposes.Length != 0) {
            using (var counts = source.GetBonesPerVertex()) {
                for (int i = 0; i < counts.Length; i++) {
                    if (counts[i] > 4) {
                        Object.DestroyImmediate(result);
                        throw new InvalidOperationException("1頂点5本以上のボーンは未対応");
                    }
                }
            }
            var weights = source.boneWeights;
            if (weights.Length != positions.Length) {
                Object.DestroyImmediate(result);
                throw new InvalidOperationException("ボーンウェイト数が不一致");
            }
            result.bindposes = source.bindposes;
            result.boneWeights = map.Select(i => weights[i]).ToArray();
        }
        var dv = new Vector3[positions.Length];
        var dn = new Vector3[positions.Length];
        var dt = new Vector3[positions.Length];
        for (int shape = 0; shape < source.blendShapeCount; shape++) {
            for (int frame = 0; frame < source.GetBlendShapeFrameCount(shape); frame++) {
                source.GetBlendShapeFrameVertices(shape, frame, dv, dn, dt);
                result.AddBlendShapeFrame(source.GetBlendShapeName(shape), source.GetBlendShapeFrameWeight(shape, frame),
                    map.Select(i => dv[i]).ToArray(), map.Select(i => dn[i]).ToArray(), new Vector3[map.Count]);
            }
        }
        result.bounds = source.bounds;
        return result;
    }

    static void ValidateMaterial(Material material) {
        if (material == null) throw new InvalidOperationException("Materialなし");
        if (material.shader == null || (material.shader.name != "Standard" && material.shader.name != "Standard (Specular setup)"))
            throw new InvalidOperationException("非対応Shader: " + (material.shader == null ? "null" : material.shader.name));
        // StandardのOpaqueでは_Color.aは表示の透明度に影響しない。
        if (material.GetFloat("_Mode") != 0f)
            throw new InvalidOperationException("透明・カットアウトMaterial: " + material.name);
        if (material.IsKeywordEnabled("_DETAIL_MULX2") || material.IsKeywordEnabled("_PARALLAXMAP"))
            throw new InvalidOperationException("詳細色または視差テクスチャ: " + material.name);
    }

    static Texture2D ReadTexture(Texture2D source) {
        if (textures.TryGetValue(source, out var texture)) return texture;
        string path = AssetDatabase.GetAssetPath(source);
        string extension = Path.GetExtension(path).ToLowerInvariant();
        if (extension != ".png" && extension != ".jpg" && extension != ".jpeg") throw new InvalidOperationException("非対応画像形式: " + extension);
        texture = new Texture2D(2, 2, TextureFormat.RGBA32, false, true);
        if (!ImageConversion.LoadImage(texture, File.ReadAllBytes(path))) {
            Object.DestroyImmediate(texture);
            throw new InvalidOperationException("画像を読み込めません: " + path);
        }
        texture.wrapModeU = source.wrapModeU; texture.wrapModeV = source.wrapModeV;
        texture.filterMode = source.filterMode;
        textures.Add(source, texture);
        var importer = AssetImporter.GetAtPath(path) as TextureImporter;
        srgbTextures.Add(source, importer == null || importer.sRGBTexture);
        return texture;
    }

    static Color Sample(Material material, Texture2D readable, Texture2D original, Vector2 uv) {
        Color color = Color.white;
        if (readable != null) {
            uv = Vector2.Scale(uv, material.mainTextureScale) + material.mainTextureOffset;
            color = readable.GetPixelBilinear(uv.x, uv.y);
            if (srgbTextures[original]) color = color.linear;
        }
        color *= material.color.linear;
        color.a = 1f;
        return color;
    }

    static void CheckSample(Material material, Texture2D readable, Texture2D original, Vector2 uv, Color interpolated) {
        Color expected = Sample(material, readable, original, uv);
        float error = Mathf.Max(Mathf.Abs(expected.r - interpolated.r), Mathf.Abs(expected.g - interpolated.g), Mathf.Abs(expected.b - interpolated.b));
        if (error > 0.06f) throw new InvalidOperationException("面内テクスチャの色変化を頂点で再現できません: " + material.name);
    }
}

```

## File: 頂点カラー変換/LowPolyGeneratedMigration.cs.meta

```meta
fileFormatVersion: 2
guid: 2193e0d8675ce424b8854ad2dc0eff6a
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 頂点カラー変換/LowPolyModelConverter.cs.meta

```meta
fileFormatVersion: 2
guid: aabc94b432d7128408a4bff590aa90ea
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 頂点カラー補正/VertexColorCorrectionWindow.cs

```cs
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using Object = UnityEngine.Object;

public class VertexColorCorrectionWindow : EditorWindow {
    [SerializeField] GameObject source;
    [SerializeField] Color selected = Color.white, target = Color.white;
    [SerializeField] float tolerance = 0.05f;
    [SerializeField] bool preserveVariation = true;
    [SerializeField] string outputName = "ColoredModel";
    PreviewRenderUtility preview;
    GameObject root;
    readonly Dictionary<Mesh, Mesh> copies = new Dictionary<Mesh, Mesh>();
    readonly Dictionary<Mesh, Color32[]> sourceColors = new Dictionary<Mesh, Color32[]>();
    readonly Dictionary<Mesh, long> sourceVertexBytes = new Dictionary<Mesh, long>();
    readonly Dictionary<Mesh, string> meshReviewKeys = new Dictionary<Mesh, string>();
    List<KeyValuePair<Color32, int>> palette = new List<KeyValuePair<Color32, int>>();
    List<KeyValuePair<Color32, int>> sourcePalette = new List<KeyValuePair<Color32, int>>();
    Vector2 scroll, angle = new Vector2(25f, -25f);
    string error;
    int page;
    bool automaticCandidate, candidateMetricsPassed, candidateGptApproved;
    int beforeVertices, afterVertices, removedVertices, beforeColors, afterColors;
    long beforeVertexBytes, afterVertexBytes;

    [MenuItem("Tools/MyWorld/頂点カラー/色の補正")]
    public static void Open() {
        var window = GetWindow<VertexColorCorrectionWindow>("頂点色の補正");
        window.minSize = new Vector2(400, 650);
        var selectedObject = Selection.activeObject as GameObject;
        if (selectedObject != null && AssetDatabase.GetAssetPath(selectedObject).EndsWith(".prefab", StringComparison.OrdinalIgnoreCase))
            window.Load(selectedObject);
    }

    void OnGUI() {
        EditorGUILayout.HelpBox("色一覧とプレビューから、焼き込み陰影などの統合候補を作ります。GPT確認後にMeshとPrefabを別名保存します。", MessageType.Info);
        var next = (GameObject)EditorGUILayout.ObjectField("対象Prefab", source, typeof(GameObject), false);
        if (next != source) Load(next);
        if (!string.IsNullOrEmpty(error)) EditorGUILayout.HelpBox(error, MessageType.Error);
        if (root == null) return;
        DrawPreview(GUILayoutUtility.GetRect(200, 230, GUILayout.ExpandWidth(true)));
        EditorGUILayout.LabelField("使用色（RGB・頂点数）", palette.Count + "色");
        int pages = Mathf.Max(1, Mathf.CeilToInt(palette.Count / 80f));
        page = EditorGUILayout.IntSlider("色一覧のページ", page, 0, pages - 1);
        scroll = EditorGUILayout.BeginScrollView(scroll, GUILayout.Height(150));
        for (int i = page * 80; i < Mathf.Min(palette.Count, (page + 1) * 80); i++) {
            var entry = palette[i];
            EditorGUILayout.BeginHorizontal();
            Rect swatch = GUILayoutUtility.GetRect(30, 20, GUILayout.Width(30));
            EditorGUI.DrawRect(swatch, entry.Key);
            if (GUILayout.Button("#" + ColorUtility.ToHtmlStringRGB(entry.Key) + "  (" + entry.Value + ")")) {
                selected = entry.Key; target = selected;
            }
            EditorGUILayout.EndHorizontal();
        }
        EditorGUILayout.EndScrollView();
        selected = EditorGUILayout.ColorField("置換元の色", selected);
        target = EditorGUILayout.ColorField("変更後の色", target);
        tolerance = EditorGUILayout.Slider(new GUIContent("近い色も選択", "sRGBのRGB距離。0なら同じRGBだけ。アルファは判定に含めません。"), tolerance, 0f, 1.7321f);
        preserveVariation = EditorGUILayout.Toggle("明暗・色の差を残す", preserveVariation);
        if (GUILayout.Button("GPT確認用の自動統合候補を作成")) CreateAutomaticCandidate();
        if (automaticCandidate) {
            EditorGUILayout.LabelField("色数", beforeColors + " → " + afterColors);
            EditorGUILayout.LabelField("頂点数", beforeVertices + " → " + afterVertices + "（" + removedVertices + "削減）");
            EditorGUILayout.LabelField("頂点データ量", FormatBytes(beforeVertexBytes) + " → " + FormatBytes(afterVertexBytes));
            if (!candidateMetricsPassed)
                EditorGUILayout.HelpBox("頂点数または頂点データ量が元より増えたため、この候補は保存できません。", MessageType.Error);
            else if (!candidateGptApproved)
                EditorGUILayout.HelpBox("候補の見た目と色分布をGPTが確認してから保存します。", MessageType.Info);
            else EditorGUILayout.HelpBox("GPT確認済みです。", MessageType.Info);
        }
        int count = copies.Values.Sum(m => m.colors32.Count(c => VertexColorCorrection.Matches(c, selected, tolerance)));
        EditorGUILayout.LabelField("対象頂点", count.ToString());
        using (new EditorGUI.DisabledScope(count == 0)) {
            if (GUILayout.Button("プレビューへ補正を適用")) {
                foreach (var mesh in copies.Values) VertexColorCorrection.Apply(mesh, selected, target, tolerance, preserveVariation);
                automaticCandidate = false;
                RebuildPalette();
            }
        }
        if (GUILayout.Button("元の配色へ戻す")) Load(source);
        outputName = EditorGUILayout.TextField("保存名", outputName);
        using (new EditorGUI.DisabledScope(automaticCandidate && (!candidateMetricsPassed || !candidateGptApproved))) {
        if (GUILayout.Button("調色版を別名保存")) {
            try {
                string path = VertexColorCorrection.Save(root, copies.Values, outputName, AssetDatabase.GetAssetPath(source));
                EditorGUIUtility.PingObject(AssetDatabase.LoadAssetAtPath<GameObject>(path));
                ShowNotification(new GUIContent("保存しました"));
            } catch (Exception exception) { error = exception.Message; }
        }
        }
    }

    void Load(GameObject prefab) {
        Release(); source = prefab; error = null; page = 0; sourcePalette.Clear();
        automaticCandidate = false; candidateMetricsPassed = false; candidateGptApproved = false;
        if (prefab == null) return;
        try {
            string path = AssetDatabase.GetAssetPath(prefab);
            if (!path.EndsWith(".prefab", StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Project内のPrefabを指定してください。");
            preview = new PreviewRenderUtility();
            root = Object.Instantiate(prefab);
            root.name = prefab.name;
            preview.AddSingleGO(root);
            foreach (var renderer in root.GetComponentsInChildren<Renderer>(true)) {
                if (!(renderer is MeshRenderer) && !(renderer is SkinnedMeshRenderer)) throw new ArgumentException("Mesh以外のRendererを含むPrefabです。");
                if (renderer.sharedMaterials.Any(m => m == null || m.shader == null || m.shader.name != "MyWorld/Low Poly Vertex Color"))
                    throw new ArgumentException("共通の頂点カラーMaterialを使うPrefabを指定してください。");
                Mesh mesh = renderer is SkinnedMeshRenderer skin ? skin.sharedMesh : renderer.GetComponent<MeshFilter>()?.sharedMesh;
                if (mesh == null || mesh.colors32.Length != mesh.vertexCount) throw new ArgumentException("頂点カラーがないMeshです。");
                if (!copies.TryGetValue(mesh, out var copy)) { copy = Object.Instantiate(mesh); copies.Add(mesh, copy); }
                if (!meshReviewKeys.ContainsKey(copy)) meshReviewKeys.Add(copy, renderer.name + " #" + meshReviewKeys.Count);
                if (renderer is SkinnedMeshRenderer skinned) skinned.sharedMesh = copy;
                else renderer.GetComponent<MeshFilter>().sharedMesh = copy;
            }
            if (copies.Count == 0) throw new ArgumentException("描画用Meshがありません。");
            foreach (var collider in root.GetComponentsInChildren<MeshCollider>(true))
                if (collider.sharedMesh != null && copies.TryGetValue(collider.sharedMesh, out var copy)) collider.sharedMesh = copy;
            outputName = prefab.name + "_Color";
            RebuildPalette();
            sourcePalette = new List<KeyValuePair<Color32, int>>(palette);
            foreach (var mesh in copies.Values) {
                sourceColors[mesh] = (Color32[])mesh.colors32.Clone();
                sourceVertexBytes[mesh] = VertexColorCorrection.VertexBytes(mesh);
            }
        } catch (Exception exception) { Release(); error = exception.Message; }
    }

    void RebuildPalette() {
        var counts = new Dictionary<Color32, int>();
        foreach (var mesh in copies.Values) foreach (var value in mesh.colors32) {
            var rgb = new Color32(value.r, value.g, value.b, 255);
            counts[rgb] = counts.TryGetValue(rgb, out int count) ? count + 1 : 1;
        }
        palette = counts.OrderByDescending(x => x.Value).ThenBy(x => x.Key.r).ThenBy(x => x.Key.g).ThenBy(x => x.Key.b).ToList();
        page = 0; Repaint();
    }

    void CreateAutomaticCandidate() {
        GameObject prefab = source;
        float colorTolerance = tolerance;
        Load(prefab);
        if (root == null) return;
        tolerance = colorTolerance;
        beforeVertices = copies.Values.Sum(mesh => mesh.vertexCount);
        beforeVertexBytes = copies.Values.Sum(VertexColorCorrection.VertexBytes);
        beforeColors = VertexColorCorrection.CountColors(copies.Values);
        VertexColorCorrection.MergeSimilarColors(copies.Values, colorTolerance);
        removedVertices = 0;
        foreach (var mesh in copies.Values) removedVertices += VertexColorCorrection.WeldDuplicateVertices(mesh);
        afterVertices = copies.Values.Sum(mesh => mesh.vertexCount);
        afterVertexBytes = copies.Values.Sum(VertexColorCorrection.VertexBytes);
        afterColors = VertexColorCorrection.CountColors(copies.Values);
        candidateMetricsPassed = afterVertices <= beforeVertices && afterVertexBytes <= beforeVertexBytes;
        candidateGptApproved = false;
        automaticCandidate = true;
        RebuildPalette();
    }

    static string FormatBytes(long bytes) {
        return (bytes / 1024f).ToString("0.0") + " KB";
    }

    public static void ApproveAutomaticCandidateAfterGptReview() {
        var window = FindLoadedWindow();
        if (window == null || !window.automaticCandidate || !window.candidateMetricsPassed)
            throw new InvalidOperationException("頂点数と容量の条件を満たす自動候補がありません。");
        window.candidateGptApproved = true;
        window.Repaint();
    }

    public static void ApplyGptColorMap(Dictionary<Color32, Color32> mapping) {
        var window = FindLoadedWindow();
        if (window == null) throw new InvalidOperationException("対象Prefabを読み込んでください。");
        GameObject prefab = window.source;
        window.Load(prefab);
        if (window.root == null) throw new InvalidOperationException("候補Meshを作成できませんでした。");
        window.beforeVertices = window.copies.Values.Sum(mesh => mesh.vertexCount);
        window.beforeVertexBytes = window.copies.Values.Sum(VertexColorCorrection.VertexBytes);
        window.beforeColors = VertexColorCorrection.CountColors(window.copies.Values);
        VertexColorCorrection.ApplyColorMap(window.copies.Values, mapping);
        window.removedVertices = 0;
        foreach (var mesh in window.copies.Values) window.removedVertices += VertexColorCorrection.WeldDuplicateVertices(mesh);
        window.afterVertices = window.copies.Values.Sum(mesh => mesh.vertexCount);
        window.afterVertexBytes = window.copies.Values.Sum(VertexColorCorrection.VertexBytes);
        window.afterColors = VertexColorCorrection.CountColors(window.copies.Values);
        window.candidateMetricsPassed = window.afterVertices <= window.beforeVertices && window.afterVertexBytes <= window.beforeVertexBytes;
        window.candidateGptApproved = false;
        window.automaticCandidate = true;
        window.RebuildPalette();
    }

    public static void ApplyGptColorMaps(Dictionary<string, Dictionary<Color32, Color32>> mappings) {
        var window = FindLoadedWindow();
        if (window == null) throw new InvalidOperationException("対象Prefabを読み込んでください。");
        GameObject prefab = window.source;
        window.Load(prefab);
        if (window.root == null) throw new InvalidOperationException("候補Meshを作成できませんでした。");
        window.beforeVertices = window.copies.Values.Sum(mesh => mesh.vertexCount);
        window.beforeVertexBytes = window.copies.Values.Sum(VertexColorCorrection.VertexBytes);
        window.beforeColors = VertexColorCorrection.CountColors(window.copies.Values);
        foreach (var mesh in window.copies.Values) {
            if (!window.meshReviewKeys.TryGetValue(mesh, out var reviewKey)) continue;
            if (mappings.TryGetValue(reviewKey, out var mapping)) VertexColorCorrection.ApplyColorMap(new[] { mesh }, mapping);
        }
        window.removedVertices = 0;
        foreach (var mesh in window.copies.Values) window.removedVertices += VertexColorCorrection.WeldDuplicateVertices(mesh);
        window.afterVertices = window.copies.Values.Sum(mesh => mesh.vertexCount);
        window.afterVertexBytes = window.copies.Values.Sum(VertexColorCorrection.VertexBytes);
        window.afterColors = VertexColorCorrection.CountColors(window.copies.Values);
        window.candidateMetricsPassed = window.afterVertices <= window.beforeVertices && window.afterVertexBytes <= window.beforeVertexBytes;
        window.candidateGptApproved = false;
        window.automaticCandidate = true;
        window.RebuildPalette();
    }

    public static object GetAutomaticCandidateReport() {
        var window = FindLoadedWindow();
        if (window == null || !window.automaticCandidate) throw new InvalidOperationException("自動統合候補がありません。");
        return new {
            source = window.source == null ? null : window.source.name,
            beforeColors = window.beforeColors, afterColors = window.afterColors,
            beforeVertices = window.beforeVertices, afterVertices = window.afterVertices,
            removedVertices = window.removedVertices,
            beforeVertexBytes = window.beforeVertexBytes, afterVertexBytes = window.afterVertexBytes,
            metricsPassed = window.candidateMetricsPassed, gptApproved = window.candidateGptApproved,
            sourcePalette = window.sourcePalette.Select(x => new {
                color = ColorUtility.ToHtmlStringRGB(x.Key), count = x.Value
            }).ToArray(),
            meshes = window.copies.Values.Select(mesh => new {
                reviewKey = window.meshReviewKeys.TryGetValue(mesh, out var reviewKey) ? reviewKey : mesh.name,
                meshName = mesh.name,
                rendererNames = window.RendererNames(mesh),
                beforeVertices = window.sourceColors[mesh].Length,
                afterVertices = mesh.vertexCount,
                beforeColors = VertexColorCorrection.CountColors(window.sourceColors[mesh]),
                afterColors = VertexColorCorrection.CountColors(mesh.colors32),
                beforeVertexBytes = window.sourceVertexBytes[mesh],
                afterVertexBytes = VertexColorCorrection.VertexBytes(mesh),
                sourcePalette = window.ColorPalette(window.sourceColors[mesh]),
                palette = window.ColorPalette(mesh.colors32)
            }).ToArray(),
            palette = window.palette.Select(x => new {
                color = ColorUtility.ToHtmlStringRGB(x.Key), count = x.Value
            }).ToArray()
        };
    }

    static VertexColorCorrectionWindow FindLoadedWindow() {
        return Resources.FindObjectsOfTypeAll<VertexColorCorrectionWindow>()
            .FirstOrDefault(window => window != null && window.root != null && window.source != null && window.copies.Count > 0
                && window.copies.Keys.All(mesh => mesh != null && window.sourceColors.ContainsKey(mesh)));
    }

    string[] RendererNames(Mesh mesh) {
        return root.GetComponentsInChildren<Renderer>(true)
            .Where(renderer => (renderer is SkinnedMeshRenderer skin ? skin.sharedMesh : renderer.GetComponent<MeshFilter>()?.sharedMesh) == mesh)
            .Select(renderer => renderer.name).Distinct().ToArray();
    }

    object[] ColorPalette(Color32[] colors) {
        return colors.GroupBy(color => new Color32(color.r, color.g, color.b, 255))
            .OrderByDescending(group => group.Count())
            .Select(group => (object)new { color = ColorUtility.ToHtmlStringRGB(group.Key), count = group.Count() }).ToArray();
    }

    void DrawPreview(Rect rect) {
        if (Event.current.type == EventType.MouseDrag && rect.Contains(Event.current.mousePosition)) {
            angle += Event.current.delta * 0.5f; Event.current.Use(); Repaint();
        }
        if (Event.current.type != EventType.Repaint) return;
        var renderers = root.GetComponentsInChildren<Renderer>();
        if (renderers.Length == 0) return;
        Bounds bounds = renderers[0].bounds;
        foreach (var renderer in renderers) bounds.Encapsulate(renderer.bounds);
        float size = Mathf.Max(0.1f, bounds.extents.magnitude);
        preview.BeginPreview(rect, GUIStyle.none);
        var camera = preview.camera;
        camera.fieldOfView = 30; camera.nearClipPlane = size * 0.01f; camera.farClipPlane = size * 20f;
        camera.transform.rotation = Quaternion.Euler(angle.y, angle.x, 0);
        camera.transform.position = bounds.center - camera.transform.forward * size * 4f;
        preview.lights[0].intensity = 1f; preview.lights[0].transform.rotation = Quaternion.Euler(40, 30, 0);
        preview.lights[1].intensity = 0.4f; preview.ambientColor = new Color(0.3f, 0.3f, 0.3f);
        preview.Render();
        GUI.DrawTexture(rect, preview.EndPreview(), ScaleMode.StretchToFill, false);
    }

    void OnDisable() { Release(); }
    void Release() {
        if (preview != null) preview.Cleanup();
        preview = null; root = null;
        foreach (var mesh in copies.Values) if (mesh != null) Object.DestroyImmediate(mesh);
        copies.Clear(); sourceColors.Clear(); sourceVertexBytes.Clear(); meshReviewKeys.Clear(); palette.Clear(); sourcePalette.Clear();
    }
}

public static class VertexColorCorrection {
    public const string OutputRoot = "Assets/MyAssets/Generated/ColoredModels";
    public const string ThirdPartyOutputRoot = "Assets/ThirdParty/Mesh&Prefab(Generated)/ColoredModels";

    public static bool Matches(Color32 color, Color selected, float tolerance) {
        Color32 key = selected;
        float r = (color.r - key.r) / 255f, g = (color.g - key.g) / 255f, b = (color.b - key.b) / 255f;
        return r * r + g * g + b * b <= tolerance * tolerance;
    }

    public static void Apply(Mesh mesh, Color selected, Color target, float tolerance, bool preserveVariation) {
        var colors = mesh.colors32;
        for (int i = 0; i < colors.Length; i++) {
            if (!Matches(colors[i], selected, tolerance)) continue;
            byte alpha = colors[i].a;
            Color corrected = preserveVariation ? (target.linear + (((Color)colors[i]).linear - selected.linear)).gamma : target;
            Color32 encoded = corrected;
            encoded.a = alpha; colors[i] = encoded;
        }
        mesh.colors32 = colors;
    }

    public static int CountColors(IEnumerable<Mesh> meshes) {
        var colors = new HashSet<Color32>();
        foreach (var mesh in meshes) foreach (var color in mesh.colors32)
            colors.Add(new Color32(color.r, color.g, color.b, 255));
        return colors.Count;
    }

    public static int CountColors(Color32[] values) {
        var colors = new HashSet<Color32>();
        foreach (var color in values) colors.Add(new Color32(color.r, color.g, color.b, 255));
        return colors.Count;
    }

    public static int MergeSimilarColors(IEnumerable<Mesh> meshes, float tolerance) {
        var counts = new Dictionary<Color32, int>();
        foreach (var mesh in meshes) foreach (var color in mesh.colors32) {
            var key = new Color32(color.r, color.g, color.b, 255);
            counts[key] = counts.TryGetValue(key, out int count) ? count + 1 : 1;
        }

        var representatives = new List<Color32>();
        var mapping = new Dictionary<Color32, Color32>();
        foreach (var pair in counts.OrderByDescending(x => x.Value).ThenBy(x => x.Key.r).ThenBy(x => x.Key.g).ThenBy(x => x.Key.b)) {
            Color32 representative = pair.Key;
            bool found = false;
            foreach (var candidate in representatives) {
                if (!Matches(pair.Key, candidate, tolerance)) continue;
                representative = candidate;
                found = true;
                break;
            }
            if (!found) representatives.Add(pair.Key);
            mapping[pair.Key] = representative;
        }

        foreach (var mesh in meshes) {
            var colors = mesh.colors32;
            for (int i = 0; i < colors.Length; i++) {
                var key = new Color32(colors[i].r, colors[i].g, colors[i].b, 255);
                var replacement = mapping[key];
                colors[i] = new Color32(replacement.r, replacement.g, replacement.b, colors[i].a);
            }
            mesh.colors32 = colors;
        }
        return counts.Count - representatives.Count;
    }

    public static void ApplyColorMap(IEnumerable<Mesh> meshes, Dictionary<Color32, Color32> mapping) {
        foreach (var mesh in meshes) {
            var colors = mesh.colors32;
            for (int i = 0; i < colors.Length; i++) {
                var key = new Color32(colors[i].r, colors[i].g, colors[i].b, 255);
                if (!mapping.TryGetValue(key, out var replacement)) continue;
                colors[i] = new Color32(replacement.r, replacement.g, replacement.b, colors[i].a);
            }
            mesh.colors32 = colors;
        }
    }

    public static long VertexBytes(Mesh mesh) {
        long stride = 0;
        for (int i = 0; i < mesh.vertexBufferCount; i++) stride += mesh.GetVertexBufferStride(i);
        return stride * mesh.vertexCount;
    }

    sealed class UvChannelData {
        public int channel, dimension;
        public Vector4[] values;
    }

    sealed class BlendShapeFrameData {
        public string shapeName;
        public float weight;
        public Vector3[] deltaVertices, deltaNormals, deltaTangents;
    }

    public static int WeldDuplicateVertices(Mesh mesh) {
        int count = mesh.vertexCount;
        if (count == 0) return 0;
        var knownAttributes = new HashSet<VertexAttribute> {
            VertexAttribute.Position, VertexAttribute.Normal, VertexAttribute.Tangent, VertexAttribute.Color,
            VertexAttribute.BlendWeight, VertexAttribute.BlendIndices
        };
        for (int channel = 0; channel < 8; channel++)
            knownAttributes.Add((VertexAttribute)((int)VertexAttribute.TexCoord0 + channel));
        foreach (var attribute in mesh.GetVertexAttributes())
            if (!knownAttributes.Contains(attribute.attribute)) return 0;

        var positions = mesh.vertices;
        var normals = mesh.normals;
        var tangents = mesh.tangents;
        var colors = mesh.colors32;
        if (mesh.HasVertexAttribute(VertexAttribute.Color) && colors.Length != count) return 0;
        var uvChannels = new List<UvChannelData>();
        for (int channel = 0; channel < 8; channel++) {
            var attribute = (VertexAttribute)((int)VertexAttribute.TexCoord0 + channel);
            if (!mesh.HasVertexAttribute(attribute)) continue;
            int dimension = mesh.GetVertexAttributeDimension(attribute);
            if (dimension < 2 || dimension > 4) return 0;
            var values = new List<Vector4>();
            mesh.GetUVs(channel, values);
            if (values.Count != count) return 0;
            uvChannels.Add(new UvChannelData { channel = channel, dimension = dimension, values = values.ToArray() });
        }
        var weights = mesh.boneWeights;
        bool hasSkinAttributes = mesh.HasVertexAttribute(VertexAttribute.BlendWeight) || mesh.HasVertexAttribute(VertexAttribute.BlendIndices);
        if ((mesh.bindposes.Length != 0 || hasSkinAttributes) && weights.Length != count) return 0;

        var blendShapes = new List<BlendShapeFrameData>();
        var deltaVertices = new Vector3[count];
        var deltaNormals = new Vector3[count];
        var deltaTangents = new Vector3[count];
        for (int shape = 0; shape < mesh.blendShapeCount; shape++) {
            for (int frame = 0; frame < mesh.GetBlendShapeFrameCount(shape); frame++) {
                mesh.GetBlendShapeFrameVertices(shape, frame, deltaVertices, deltaNormals, deltaTangents);
                blendShapes.Add(new BlendShapeFrameData {
                    shapeName = mesh.GetBlendShapeName(shape), weight = mesh.GetBlendShapeFrameWeight(shape, frame),
                    deltaVertices = (Vector3[])deltaVertices.Clone(), deltaNormals = (Vector3[])deltaNormals.Clone(),
                    deltaTangents = (Vector3[])deltaTangents.Clone()
                });
            }
        }

        var indices = new int[mesh.subMeshCount][];
        var topologies = new MeshTopology[mesh.subMeshCount];
        for (int submesh = 0; submesh < mesh.subMeshCount; submesh++) {
            indices[submesh] = mesh.GetIndices(submesh, true);
            topologies[submesh] = mesh.GetTopology(submesh);
        }
        Bounds bounds = mesh.bounds;
        var bindposes = mesh.bindposes;
        var remap = new int[count];
        var keep = new List<int>();
        var lookup = new Dictionary<string, int>();
        for (int i = 0; i < count; i++) {
            string key = BuildVertexKey(i, positions, normals, tangents, colors, uvChannels, weights, blendShapes);
            if (!lookup.TryGetValue(key, out int destination)) {
                destination = keep.Count;
                lookup.Add(key, destination);
                keep.Add(i);
            }
            remap[i] = destination;
        }
        if (keep.Count == count) return 0;

        for (int submesh = 0; submesh < indices.Length; submesh++)
            for (int i = 0; i < indices[submesh].Length; i++) indices[submesh][i] = remap[indices[submesh][i]];

        mesh.Clear(false);
        mesh.indexFormat = keep.Count > 65535 ? IndexFormat.UInt32 : IndexFormat.UInt16;
        mesh.vertices = keep.Select(i => positions[i]).ToArray();
        if (normals.Length == count) mesh.normals = keep.Select(i => normals[i]).ToArray();
        if (tangents.Length == count) mesh.tangents = keep.Select(i => tangents[i]).ToArray();
        if (colors.Length == count) mesh.colors32 = keep.Select(i => colors[i]).ToArray();
        foreach (var channel in uvChannels) {
            if (channel.dimension == 2) mesh.SetUVs(channel.channel, keep.Select(i => (Vector2)channel.values[i]).ToList());
            else if (channel.dimension == 3) mesh.SetUVs(channel.channel, keep.Select(i => (Vector3)channel.values[i]).ToList());
            else mesh.SetUVs(channel.channel, keep.Select(i => channel.values[i]).ToList());
        }
        if (weights.Length == count) {
            mesh.bindposes = bindposes;
            mesh.boneWeights = keep.Select(i => weights[i]).ToArray();
        }
        mesh.subMeshCount = indices.Length;
        for (int submesh = 0; submesh < indices.Length; submesh++) mesh.SetIndices(indices[submesh], topologies[submesh], submesh, false);
        for (int shape = 0, frameIndex = 0; shape < blendShapes.Select(x => x.shapeName).Distinct().Count(); shape++) {
            string shapeName = blendShapes[frameIndex].shapeName;
            while (frameIndex < blendShapes.Count && blendShapes[frameIndex].shapeName == shapeName) {
                var frame = blendShapes[frameIndex++];
                mesh.AddBlendShapeFrame(shapeName, frame.weight,
                    keep.Select(i => frame.deltaVertices[i]).ToArray(),
                    keep.Select(i => frame.deltaNormals[i]).ToArray(),
                    keep.Select(i => frame.deltaTangents[i]).ToArray());
            }
        }
        mesh.bounds = bounds;
        return count - keep.Count;
    }

    static string BuildVertexKey(int index, Vector3[] positions, Vector3[] normals, Vector4[] tangents,
        Color32[] colors, List<UvChannelData> uvChannels, BoneWeight[] weights, List<BlendShapeFrameData> blendShapes) {
        var key = new StringBuilder(128);
        AppendVector(key, positions[index]);
        if (normals.Length == positions.Length) AppendVector(key, normals[index]);
        if (tangents.Length == positions.Length) AppendVector(key, tangents[index]);
        if (colors.Length == positions.Length) {
            key.Append(colors[index].r).Append(',').Append(colors[index].g).Append(',')
                .Append(colors[index].b).Append(',').Append(colors[index].a).Append(';');
        }
        foreach (var channel in uvChannels) AppendVector(key, channel.values[index]);
        if (weights.Length == positions.Length) {
            var weight = weights[index];
            key.Append(weight.boneIndex0).Append(':'); AppendFloat(key, weight.weight0);
            key.Append(weight.boneIndex1).Append(':'); AppendFloat(key, weight.weight1);
            key.Append(weight.boneIndex2).Append(':'); AppendFloat(key, weight.weight2);
            key.Append(weight.boneIndex3).Append(':'); AppendFloat(key, weight.weight3);
        }
        foreach (var frame in blendShapes) {
            AppendVector(key, frame.deltaVertices[index]);
            AppendVector(key, frame.deltaNormals[index]);
            AppendVector(key, frame.deltaTangents[index]);
        }
        return key.ToString();
    }

    static void AppendVector(StringBuilder builder, Vector2 value) {
        AppendFloat(builder, value.x); AppendFloat(builder, value.y);
    }

    static void AppendVector(StringBuilder builder, Vector3 value) {
        AppendFloat(builder, value.x); AppendFloat(builder, value.y); AppendFloat(builder, value.z);
    }

    static void AppendVector(StringBuilder builder, Vector4 value) {
        AppendFloat(builder, value.x); AppendFloat(builder, value.y); AppendFloat(builder, value.z); AppendFloat(builder, value.w);
    }

    static void AppendFloat(StringBuilder builder, float value) {
        builder.Append(BitConverter.SingleToInt32Bits(value)).Append(',');
    }

    public static string Save(GameObject root, IEnumerable<Mesh> meshes, string name, string sourceAssetPath) {
        if (string.IsNullOrWhiteSpace(name) || name != name.Trim() || name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0
            || name.EndsWith(".") || name.Length > 80) throw new ArgumentException("保存名は80文字以内のファイル名にしてください。");
        // 島の名前と同じ予約名・パス検証を利用する。
        FloatingIslandMeshGenerator.GetIslandFolder(name);
        string outputRoot = sourceAssetPath.StartsWith("Assets/ThirdParty/", StringComparison.Ordinal)
            ? ThirdPartyOutputRoot : OutputRoot;
        LowPolyVertexColorUtility.EnsureFolder(outputRoot);
        string folder = AssetDatabase.GenerateUniqueAssetPath(outputRoot + "/" + name);
        LowPolyVertexColorUtility.EnsureFolder(folder);
        var saved = new Dictionary<Mesh, Mesh>();
        var preferredNames = new Dictionary<Mesh, string>();
        string sourcePrefabName = SafeAssetName(Path.GetFileNameWithoutExtension(sourceAssetPath));
        foreach (var renderer in root.GetComponentsInChildren<Renderer>(true)) {
            Mesh mesh = renderer is SkinnedMeshRenderer skin ? skin.sharedMesh : renderer.GetComponent<MeshFilter>()?.sharedMesh;
            if (mesh == null || preferredNames.ContainsKey(mesh)) continue;
            string meshName = NormalizeMeshName(mesh.name);
            preferredNames.Add(mesh, IsHashName(meshName) ? renderer.name : meshName);
        }
        GameObject copy = null;
        try {
            int index = 0;
            foreach (var mesh in meshes.Distinct()) {
                string partName = SafeAssetName(preferredNames.TryGetValue(mesh, out var preferred) ? preferred : mesh.name);
                string assetName = sourcePrefabName + "_" + partName + "_ColorCorrected";
                var asset = Object.Instantiate(mesh); asset.name = assetName;
                AssetDatabase.CreateAsset(asset, folder + "/" + assetName + "_" + index++ + ".asset"); saved.Add(mesh, asset);
            }
            copy = Object.Instantiate(root); copy.name = name;
            foreach (var filter in copy.GetComponentsInChildren<MeshFilter>(true))
                if (filter.sharedMesh != null && saved.TryGetValue(filter.sharedMesh, out var mesh)) filter.sharedMesh = mesh;
            foreach (var skin in copy.GetComponentsInChildren<SkinnedMeshRenderer>(true))
                if (skin.sharedMesh != null && saved.TryGetValue(skin.sharedMesh, out var mesh)) skin.sharedMesh = mesh;
            foreach (var collider in copy.GetComponentsInChildren<MeshCollider>(true))
                if (collider.sharedMesh != null && saved.TryGetValue(collider.sharedMesh, out var mesh)) collider.sharedMesh = mesh;
            string path = folder + "/" + name + ".prefab";
            if (PrefabUtility.SaveAsPrefabAsset(copy, path) == null) throw new InvalidOperationException("Prefabの保存に失敗しました。");
            return path;
        } catch { AssetDatabase.DeleteAsset(folder); throw; }
        finally { if (copy != null) Object.DestroyImmediate(copy); }
    }

    public static bool IsHashName(string value) {
        string meshName = NormalizeMeshName(value);
        return meshName.Length == 32 && meshName.All(Uri.IsHexDigit);
    }

    static string NormalizeMeshName(string value) {
        const string cloneSuffix = "(Clone)";
        if (value == null) return string.Empty;
        return value.EndsWith(cloneSuffix, StringComparison.Ordinal)
            ? value.Substring(0, value.Length - cloneSuffix.Length).TrimEnd()
            : value;
    }

    public static string SafeAssetName(string value) {
        if (string.IsNullOrWhiteSpace(value)) return "Mesh";
        char[] invalid = Path.GetInvalidFileNameChars();
        return new string(value.Select(c => invalid.Contains(c) || c == '/' || c == '\\' ? '_' : c).ToArray()).Trim();
    }
}

```

## File: 頂点カラー補正/VertexColorCorrectionWindow.cs.meta

```meta
fileFormatVersion: 2
guid: 0bfe61c425ba6c3489b06f493a058209
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 認識テストケース収集/Data/認識テストケース.asset

```asset
%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!114 &11400000
MonoBehaviour:
  m_ObjectHideFlags: 0
  m_CorrespondingSourceObject: {fileID: 0}
  m_PrefabInstance: {fileID: 0}
  m_PrefabAsset: {fileID: 0}
  m_GameObject: {fileID: 0}
  m_Enabled: 1
  m_EditorHideFlags: 0
  m_Script: {fileID: 11500000, guid: 682d4e9b508507e4d8460aec1784b434, type: 3}
  m_Name: "\u8A8D\u8B58\u30C6\u30B9\u30C8\u30B1\u30FC\u30B9"
  m_EditorClassIdentifier: 
  cases:
  - captureId: 435
    capturedShapeId: 4
    expectedShapeId: 4
    replayedShapeId: 4
    projectionRight: {x: 0.9862, y: 0.083, z: 0.1433}
    projectionUp: {x: -0.0719, y: 0.9941, z: -0.0808}
    projectionForward: {x: -0.1492, y: 0.0694, z: 0.9864}
    rawPositions:
    - {x: 0.0616, y: 0.3623, z: -0.1847}
    - {x: 0.062, y: 0.3538, z: -0.1838}
    - {x: 0.0616, y: 0.3488, z: -0.1832}
    - {x: 0.0613, y: 0.3428, z: -0.1829}
    - {x: 0.0607, y: 0.3346, z: -0.1817}
    - {x: 0.0607, y: 0.3273, z: -0.181}
    - {x: 0.0612, y: 0.3184, z: -0.1797}
    - {x: 0.0627, y: 0.3093, z: -0.178}
    - {x: 0.0642, y: 0.3008, z: -0.1766}
    - {x: 0.066, y: 0.2925, z: -0.1754}
    - {x: 0.0679, y: 0.2841, z: -0.1742}
    - {x: 0.0693, y: 0.2761, z: -0.1732}
    - {x: 0.0707, y: 0.2678, z: -0.1725}
    - {x: 0.0741, y: 0.2531, z: -0.1713}
    - {x: 0.0757, y: 0.2468, z: -0.1704}
    - {x: 0.078, y: 0.2411, z: -0.1693}
    - {x: 0.0803, y: 0.2364, z: -0.1683}
    - {x: 0.0842, y: 0.2292, z: -0.1669}
    - {x: 0.0884, y: 0.2251, z: -0.1654}
    - {x: 0.0943, y: 0.2267, z: -0.1622}
    - {x: 0.0983, y: 0.2337, z: -0.1599}
    - {x: 0.1008, y: 0.2398, z: -0.1587}
    - {x: 0.1036, y: 0.2474, z: -0.1572}
    - {x: 0.1075, y: 0.2558, z: -0.1553}
    - {x: 0.1106, y: 0.2638, z: -0.1538}
    - {x: 0.114, y: 0.2727, z: -0.1523}
    - {x: 0.118, y: 0.2815, z: -0.1506}
    - {x: 0.1236, y: 0.2923, z: -0.1484}
    - {x: 0.1299, y: 0.3033, z: -0.1463}
    - {x: 0.1364, y: 0.3139, z: -0.1445}
    - {x: 0.142, y: 0.3233, z: -0.1432}
    - {x: 0.1461, y: 0.3308, z: -0.1426}
    - {x: 0.1488, y: 0.3366, z: -0.1424}
    - {x: 0.1495, y: 0.3415, z: -0.1434}
    - {x: 0.1502, y: 0.348, z: -0.1449}
  - captureId: 436
    capturedShapeId: 5
    expectedShapeId: 5
    replayedShapeId: 5
    projectionRight: {x: 0.9897, y: 0.0834, z: 0.116}
    projectionUp: {x: -0.0765, y: 0.9951, z: -0.0627}
    projectionForward: {x: -0.1207, y: 0.0532, z: 0.9913}
    rawPositions:
    - {x: 0.0688, y: 0.2381, z: -0.1929}
    - {x: 0.0693, y: 0.2443, z: -0.1911}
    - {x: 0.0714, y: 0.2537, z: -0.1888}
    - {x: 0.0729, y: 0.2616, z: -0.1877}
    - {x: 0.0746, y: 0.2713, z: -0.187}
    - {x: 0.0765, y: 0.2816, z: -0.1862}
    - {x: 0.0795, y: 0.2915, z: -0.1851}
    - {x: 0.0821, y: 0.3009, z: -0.1845}
    - {x: 0.0845, y: 0.3102, z: -0.1846}
    - {x: 0.0868, y: 0.3192, z: -0.1846}
    - {x: 0.0936, y: 0.3387, z: -0.1839}
    - {x: 0.0996, y: 0.3476, z: -0.1831}
    - {x: 0.1033, y: 0.355, z: -0.1824}
    - {x: 0.1074, y: 0.3612, z: -0.1814}
    - {x: 0.1117, y: 0.3659, z: -0.1801}
    - {x: 0.1157, y: 0.37, z: -0.179}
    - {x: 0.1231, y: 0.3734, z: -0.1767}
    - {x: 0.1276, y: 0.3702, z: -0.174}
    - {x: 0.1326, y: 0.3619, z: -0.1703}
    - {x: 0.1361, y: 0.3566, z: -0.1679}
    - {x: 0.1389, y: 0.3509, z: -0.1656}
    - {x: 0.1411, y: 0.3426, z: -0.1632}
    - {x: 0.143, y: 0.3338, z: -0.1612}
    - {x: 0.1453, y: 0.3241, z: -0.1591}
    - {x: 0.148, y: 0.3136, z: -0.1568}
    - {x: 0.1513, y: 0.3032, z: -0.1544}
    - {x: 0.1553, y: 0.2909, z: -0.1517}
    - {x: 0.1595, y: 0.2789, z: -0.1491}
    - {x: 0.1632, y: 0.2675, z: -0.1472}
    - {x: 0.1665, y: 0.2577, z: -0.1459}
    - {x: 0.1698, y: 0.2482, z: -0.1448}
    - {x: 0.1729, y: 0.2387, z: -0.1438}
    - {x: 0.1757, y: 0.2299, z: -0.1429}
    - {x: 0.1787, y: 0.2225, z: -0.1422}
    - {x: 0.1835, y: 0.2169, z: -0.1423}
  - captureId: 437
    capturedShapeId: 9
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 0.9958, y: 0.0532, z: 0.0751}
    projectionUp: {x: -0.0503, y: 0.9979, z: -0.0398}
    projectionForward: {x: -0.0771, y: 0.0358, z: 0.9964}
    rawPositions:
    - {x: 0.1123, y: 0.3822, z: -0.1766}
    - {x: 0.1131, y: 0.3736, z: -0.1739}
    - {x: 0.1132, y: 0.3671, z: -0.1726}
    - {x: 0.1124, y: 0.3598, z: -0.1717}
    - {x: 0.1116, y: 0.3519, z: -0.1708}
    - {x: 0.1116, y: 0.3422, z: -0.1696}
    - {x: 0.1113, y: 0.3328, z: -0.169}
    - {x: 0.1106, y: 0.3233, z: -0.1684}
    - {x: 0.1092, y: 0.3118, z: -0.1683}
    - {x: 0.1079, y: 0.3013, z: -0.1684}
    - {x: 0.1074, y: 0.2909, z: -0.1681}
    - {x: 0.1074, y: 0.2809, z: -0.1678}
    - {x: 0.1072, y: 0.2715, z: -0.1678}
    - {x: 0.1068, y: 0.2628, z: -0.1678}
    - {x: 0.1071, y: 0.255, z: -0.1675}
    - {x: 0.107, y: 0.2489, z: -0.1676}
    - {x: 0.1087, y: 0.2402, z: -0.1672}
    - {x: 0.1117, y: 0.2355, z: -0.1659}
    - {x: 0.1183, y: 0.2348, z: -0.1645}
    - {x: 0.124, y: 0.2379, z: -0.1628}
    - {x: 0.1308, y: 0.2403, z: -0.1604}
    - {x: 0.1387, y: 0.2417, z: -0.1579}
    - {x: 0.1437, y: 0.242, z: -0.1564}
    - {x: 0.149, y: 0.2423, z: -0.1548}
    - {x: 0.1542, y: 0.2426, z: -0.1533}
    - {x: 0.1602, y: 0.2423, z: -0.1513}
    - {x: 0.1667, y: 0.2419, z: -0.1492}
    - {x: 0.1734, y: 0.2412, z: -0.1471}
    - {x: 0.1802, y: 0.2397, z: -0.145}
    - {x: 0.1867, y: 0.2378, z: -0.1431}
    - {x: 0.1929, y: 0.2355, z: -0.1413}
    - {x: 0.1991, y: 0.2336, z: -0.1396}
    - {x: 0.2057, y: 0.2315, z: -0.1379}
    - {x: 0.2119, y: 0.2301, z: -0.1365}
    - {x: 0.219, y: 0.2289, z: -0.135}
    - {x: 0.2292, y: 0.2284, z: -0.1327}
    - {x: 0.2348, y: 0.2282, z: -0.1313}
    - {x: 0.24, y: 0.2281, z: -0.1301}
    - {x: 0.2454, y: 0.2283, z: -0.1291}
    - {x: 0.2544, y: 0.2303, z: -0.1276}
    - {x: 0.2597, y: 0.2332, z: -0.1271}
    - {x: 0.2653, y: 0.2368, z: -0.1267}
    - {x: 0.2692, y: 0.241, z: -0.126}
    - {x: 0.2709, y: 0.2487, z: -0.1257}
    - {x: 0.2702, y: 0.2552, z: -0.1253}
    - {x: 0.2698, y: 0.2608, z: -0.1247}
    - {x: 0.269, y: 0.2672, z: -0.1241}
    - {x: 0.267, y: 0.2759, z: -0.123}
    - {x: 0.266, y: 0.2814, z: -0.1228}
    - {x: 0.2658, y: 0.2877, z: -0.1224}
    - {x: 0.266, y: 0.2949, z: -0.1217}
    - {x: 0.2674, y: 0.3034, z: -0.1212}
    - {x: 0.269, y: 0.3124, z: -0.1207}
    - {x: 0.2707, y: 0.3207, z: -0.1203}
    - {x: 0.2716, y: 0.3289, z: -0.1202}
    - {x: 0.2723, y: 0.3372, z: -0.1203}
    - {x: 0.2731, y: 0.3451, z: -0.1204}
    - {x: 0.274, y: 0.3527, z: -0.1208}
    - {x: 0.2747, y: 0.3595, z: -0.1213}
    - {x: 0.2751, y: 0.3659, z: -0.1221}
    - {x: 0.2746, y: 0.3713, z: -0.1228}
    - {x: 0.2735, y: 0.3789, z: -0.1234}
    - {x: 0.2735, y: 0.3855, z: -0.1237}
    - {x: 0.2707, y: 0.3898, z: -0.1243}
    - {x: 0.2642, y: 0.3894, z: -0.1253}
    - {x: 0.2547, y: 0.387, z: -0.1263}
    - {x: 0.2448, y: 0.386, z: -0.1277}
    - {x: 0.2337, y: 0.386, z: -0.1295}
    - {x: 0.2278, y: 0.3863, z: -0.131}
    - {x: 0.2194, y: 0.3866, z: -0.1332}
    - {x: 0.2113, y: 0.3865, z: -0.1353}
    - {x: 0.2011, y: 0.3865, z: -0.1382}
    - {x: 0.19, y: 0.3866, z: -0.1418}
    - {x: 0.1775, y: 0.3872, z: -0.1469}
    - {x: 0.1649, y: 0.3876, z: -0.1524}
    - {x: 0.1529, y: 0.3868, z: -0.1576}
    - {x: 0.1434, y: 0.3858, z: -0.1616}
    - {x: 0.1348, y: 0.3856, z: -0.1659}
    - {x: 0.1284, y: 0.3868, z: -0.1698}
    - {x: 0.1222, y: 0.3888, z: -0.1741}
    - {x: 0.1166, y: 0.3905, z: -0.1783}
  - captureId: 438
    capturedShapeId: 9
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 0.998, y: 0.0549, z: 0.0321}
    projectionUp: {x: -0.0541, y: 0.9982, z: -0.0265}
    projectionForward: {x: -0.0335, y: 0.0247, z: 0.9991}
    rawPositions:
    - {x: 0.1399, y: 0.3739, z: -0.1731}
    - {x: 0.1376, y: 0.3687, z: -0.1729}
    - {x: 0.1369, y: 0.3621, z: -0.1721}
    - {x: 0.1362, y: 0.3549, z: -0.1712}
    - {x: 0.1351, y: 0.3475, z: -0.1706}
    - {x: 0.1342, y: 0.3394, z: -0.1702}
    - {x: 0.1334, y: 0.3307, z: -0.1697}
    - {x: 0.1326, y: 0.3218, z: -0.1697}
    - {x: 0.1326, y: 0.3128, z: -0.1696}
    - {x: 0.1334, y: 0.3043, z: -0.1689}
    - {x: 0.1344, y: 0.296, z: -0.1682}
    - {x: 0.1346, y: 0.2879, z: -0.1678}
    - {x: 0.1342, y: 0.279, z: -0.168}
    - {x: 0.1337, y: 0.2707, z: -0.1685}
    - {x: 0.1332, y: 0.263, z: -0.1691}
    - {x: 0.1329, y: 0.2568, z: -0.1698}
    - {x: 0.1342, y: 0.2461, z: -0.1704}
    - {x: 0.1383, y: 0.2392, z: -0.1698}
    - {x: 0.1443, y: 0.235, z: -0.1683}
    - {x: 0.1514, y: 0.2324, z: -0.1667}
    - {x: 0.1588, y: 0.2316, z: -0.1653}
    - {x: 0.1694, y: 0.2317, z: -0.1631}
    - {x: 0.1753, y: 0.2313, z: -0.1616}
    - {x: 0.1811, y: 0.2309, z: -0.1599}
    - {x: 0.1876, y: 0.2302, z: -0.158}
    - {x: 0.194, y: 0.2295, z: -0.1564}
    - {x: 0.2017, y: 0.2286, z: -0.1546}
    - {x: 0.2094, y: 0.2278, z: -0.153}
    - {x: 0.2167, y: 0.2271, z: -0.1514}
    - {x: 0.2235, y: 0.2263, z: -0.15}
    - {x: 0.2301, y: 0.2256, z: -0.1489}
    - {x: 0.2373, y: 0.225, z: -0.1479}
    - {x: 0.2444, y: 0.2248, z: -0.1471}
    - {x: 0.2512, y: 0.2247, z: -0.1467}
    - {x: 0.2568, y: 0.2243, z: -0.1463}
    - {x: 0.2663, y: 0.2238, z: -0.1459}
    - {x: 0.2714, y: 0.2243, z: -0.1457}
    - {x: 0.2801, y: 0.2274, z: -0.1449}
    - {x: 0.2859, y: 0.2309, z: -0.1438}
    - {x: 0.2882, y: 0.2355, z: -0.1425}
    - {x: 0.2909, y: 0.2433, z: -0.141}
    - {x: 0.2923, y: 0.2528, z: -0.1399}
    - {x: 0.2923, y: 0.2579, z: -0.1394}
    - {x: 0.2921, y: 0.2642, z: -0.1388}
    - {x: 0.2923, y: 0.2776, z: -0.1375}
    - {x: 0.2927, y: 0.2847, z: -0.1375}
    - {x: 0.2915, y: 0.2919, z: -0.1373}
    - {x: 0.2914, y: 0.2992, z: -0.137}
    - {x: 0.292, y: 0.3066, z: -0.1366}
    - {x: 0.2935, y: 0.3144, z: -0.1362}
    - {x: 0.2955, y: 0.3222, z: -0.1357}
    - {x: 0.298, y: 0.3289, z: -0.1351}
    - {x: 0.3004, y: 0.335, z: -0.1344}
    - {x: 0.3019, y: 0.341, z: -0.1338}
    - {x: 0.3035, y: 0.3466, z: -0.1334}
    - {x: 0.3047, y: 0.3516, z: -0.133}
    - {x: 0.3062, y: 0.3565, z: -0.1329}
    - {x: 0.3055, y: 0.3654, z: -0.1335}
    - {x: 0.3003, y: 0.3713, z: -0.1346}
    - {x: 0.2884, y: 0.3751, z: -0.1364}
    - {x: 0.2829, y: 0.3758, z: -0.1372}
    - {x: 0.2778, y: 0.377, z: -0.1379}
    - {x: 0.2726, y: 0.3783, z: -0.139}
    - {x: 0.2668, y: 0.3795, z: -0.14}
    - {x: 0.2463, y: 0.3814, z: -0.1435}
    - {x: 0.239, y: 0.3817, z: -0.1448}
    - {x: 0.2307, y: 0.3824, z: -0.1466}
    - {x: 0.2218, y: 0.3824, z: -0.1485}
    - {x: 0.2119, y: 0.3815, z: -0.1505}
    - {x: 0.203, y: 0.3794, z: -0.1522}
    - {x: 0.1891, y: 0.377, z: -0.1555}
    - {x: 0.1791, y: 0.3748, z: -0.1583}
    - {x: 0.1698, y: 0.3735, z: -0.1614}
    - {x: 0.1621, y: 0.3738, z: -0.1647}
    - {x: 0.1551, y: 0.3747, z: -0.168}
    - {x: 0.1498, y: 0.3768, z: -0.1711}
  - captureId: 439
    capturedShapeId: 8
    expectedShapeId: 8
    replayedShapeId: 8
    projectionRight: {x: 0.9972, y: 0.0627, z: 0.0413}
    projectionUp: {x: -0.062, y: 0.9979, z: -0.0177}
    projectionForward: {x: -0.0423, y: 0.0151, z: 0.999}
    rawPositions:
    - {x: 0.2251, y: 0.2349, z: -0.1455}
    - {x: 0.2203, y: 0.2323, z: -0.1462}
    - {x: 0.2143, y: 0.2299, z: -0.1474}
    - {x: 0.2073, y: 0.2286, z: -0.1488}
    - {x: 0.2, y: 0.2291, z: -0.1504}
    - {x: 0.1932, y: 0.2315, z: -0.1518}
    - {x: 0.177, y: 0.2395, z: -0.1558}
    - {x: 0.1727, y: 0.2434, z: -0.1579}
    - {x: 0.1636, y: 0.2473, z: -0.1606}
    - {x: 0.1563, y: 0.2542, z: -0.1634}
    - {x: 0.15, y: 0.2608, z: -0.1659}
    - {x: 0.1448, y: 0.2674, z: -0.1682}
    - {x: 0.1404, y: 0.2748, z: -0.1704}
    - {x: 0.1371, y: 0.2825, z: -0.172}
    - {x: 0.1384, y: 0.2937, z: -0.1717}
    - {x: 0.1416, y: 0.3045, z: -0.1706}
    - {x: 0.1464, y: 0.3151, z: -0.1692}
    - {x: 0.1516, y: 0.3242, z: -0.1679}
    - {x: 0.1633, y: 0.3394, z: -0.1651}
    - {x: 0.1703, y: 0.3461, z: -0.1634}
    - {x: 0.178, y: 0.3525, z: -0.1616}
    - {x: 0.1877, y: 0.358, z: -0.1593}
    - {x: 0.1971, y: 0.3621, z: -0.1568}
    - {x: 0.2074, y: 0.3642, z: -0.1544}
    - {x: 0.2163, y: 0.3656, z: -0.1525}
    - {x: 0.2251, y: 0.3654, z: -0.1506}
    - {x: 0.2334, y: 0.3633, z: -0.1484}
    - {x: 0.2409, y: 0.3604, z: -0.1465}
    - {x: 0.2481, y: 0.3543, z: -0.1446}
    - {x: 0.2538, y: 0.3485, z: -0.143}
    - {x: 0.2577, y: 0.339, z: -0.1416}
    - {x: 0.2611, y: 0.3306, z: -0.1403}
    - {x: 0.2643, y: 0.3218, z: -0.1392}
    - {x: 0.2677, y: 0.3136, z: -0.1383}
    - {x: 0.2701, y: 0.3054, z: -0.138}
    - {x: 0.2719, y: 0.2978, z: -0.1381}
    - {x: 0.2722, y: 0.2897, z: -0.1384}
    - {x: 0.2717, y: 0.2814, z: -0.1389}
    - {x: 0.2671, y: 0.2722, z: -0.1403}
    - {x: 0.2631, y: 0.2637, z: -0.1416}
    - {x: 0.2565, y: 0.2557, z: -0.1433}
    - {x: 0.2497, y: 0.249, z: -0.1456}
    - {x: 0.2428, y: 0.244, z: -0.1477}
    - {x: 0.2381, y: 0.2399, z: -0.1495}
    - {x: 0.2341, y: 0.2367, z: -0.1509}
    - {x: 0.225, y: 0.2351, z: -0.1542}
  - captureId: 440
    capturedShapeId: 8
    expectedShapeId: 8
    replayedShapeId: 8
    projectionRight: {x: 0.9971, y: 0.06, z: 0.0466}
    projectionUp: {x: -0.0584, y: 0.9977, z: -0.0349}
    projectionForward: {x: -0.0486, y: 0.0321, z: 0.9983}
    rawPositions:
    - {x: 0.2124, y: 0.2287, z: -0.1487}
    - {x: 0.1984, y: 0.2233, z: -0.1512}
    - {x: 0.1865, y: 0.2232, z: -0.1532}
    - {x: 0.1756, y: 0.2276, z: -0.1557}
    - {x: 0.1685, y: 0.2313, z: -0.1577}
    - {x: 0.1605, y: 0.2358, z: -0.1603}
    - {x: 0.1518, y: 0.2418, z: -0.1637}
    - {x: 0.1431, y: 0.2484, z: -0.1673}
    - {x: 0.1363, y: 0.2574, z: -0.1703}
    - {x: 0.133, y: 0.2647, z: -0.1717}
    - {x: 0.1281, y: 0.2818, z: -0.1736}
    - {x: 0.1264, y: 0.3004, z: -0.1758}
    - {x: 0.1266, y: 0.3106, z: -0.1762}
    - {x: 0.1298, y: 0.3207, z: -0.1754}
    - {x: 0.14, y: 0.3397, z: -0.1722}
    - {x: 0.1473, y: 0.3474, z: -0.17}
    - {x: 0.1612, y: 0.3582, z: -0.1648}
    - {x: 0.1805, y: 0.3662, z: -0.159}
    - {x: 0.1991, y: 0.3689, z: -0.1531}
    - {x: 0.2169, y: 0.3663, z: -0.1483}
    - {x: 0.2396, y: 0.3572, z: -0.1443}
    - {x: 0.2447, y: 0.3516, z: -0.1428}
    - {x: 0.2513, y: 0.3447, z: -0.1412}
    - {x: 0.2564, y: 0.3364, z: -0.1399}
    - {x: 0.2652, y: 0.32, z: -0.1383}
    - {x: 0.2635, y: 0.3015, z: -0.1388}
    - {x: 0.2614, y: 0.2907, z: -0.1394}
    - {x: 0.258, y: 0.2802, z: -0.1404}
    - {x: 0.2496, y: 0.2594, z: -0.1437}
    - {x: 0.2402, y: 0.2436, z: -0.1469}
    - {x: 0.2344, y: 0.2368, z: -0.1485}
    - {x: 0.2289, y: 0.2304, z: -0.1505}
    - {x: 0.2242, y: 0.2266, z: -0.1521}
    - {x: 0.2158, y: 0.2297, z: -0.1547}
    - {x: 0.2074, y: 0.2363, z: -0.1579}
  - captureId: 441
    capturedShapeId: 5
    expectedShapeId: 5
    replayedShapeId: 5
    projectionRight: {x: 0.999, y: 0.0369, z: 0.0241}
    projectionUp: {x: -0.0359, y: 0.9985, z: -0.0417}
    projectionForward: {x: -0.0256, y: 0.0408, z: 0.9988}
    rawPositions:
    - {x: 0.1187, y: 0.2288, z: -0.1882}
    - {x: 0.1179, y: 0.2366, z: -0.1872}
    - {x: 0.1183, y: 0.2458, z: -0.1858}
    - {x: 0.1195, y: 0.255, z: -0.1841}
    - {x: 0.1212, y: 0.2625, z: -0.1825}
    - {x: 0.1257, y: 0.2744, z: -0.1795}
    - {x: 0.129, y: 0.2853, z: -0.1775}
    - {x: 0.1335, y: 0.2991, z: -0.1756}
    - {x: 0.1385, y: 0.3115, z: -0.1736}
    - {x: 0.1442, y: 0.3241, z: -0.1719}
    - {x: 0.1498, y: 0.3362, z: -0.1708}
    - {x: 0.1555, y: 0.3478, z: -0.1699}
    - {x: 0.1608, y: 0.3577, z: -0.1695}
    - {x: 0.166, y: 0.3666, z: -0.1693}
    - {x: 0.1702, y: 0.3739, z: -0.1695}
    - {x: 0.174, y: 0.3797, z: -0.1699}
    - {x: 0.178, y: 0.3835, z: -0.1698}
    - {x: 0.1857, y: 0.383, z: -0.168}
    - {x: 0.1922, y: 0.3755, z: -0.1648}
    - {x: 0.1964, y: 0.3696, z: -0.1627}
    - {x: 0.2006, y: 0.3635, z: -0.1608}
    - {x: 0.2057, y: 0.3559, z: -0.1587}
    - {x: 0.2106, y: 0.3463, z: -0.1564}
    - {x: 0.2158, y: 0.334, z: -0.1537}
    - {x: 0.2198, y: 0.3224, z: -0.1518}
    - {x: 0.2231, y: 0.3088, z: -0.1505}
    - {x: 0.2258, y: 0.2961, z: -0.1495}
    - {x: 0.2285, y: 0.2786, z: -0.1494}
    - {x: 0.2302, y: 0.263, z: -0.1495}
    - {x: 0.2317, y: 0.2478, z: -0.1502}
    - {x: 0.2326, y: 0.2345, z: -0.1514}
    - {x: 0.2348, y: 0.2214, z: -0.1524}
    - {x: 0.2375, y: 0.2104, z: -0.1533}
    - {x: 0.2407, y: 0.2004, z: -0.1539}
    - {x: 0.2441, y: 0.193, z: -0.154}
    - {x: 0.2483, y: 0.1866, z: -0.154}
    - {x: 0.2562, y: 0.1821, z: -0.1536}
  - captureId: 442
    capturedShapeId: 6
    expectedShapeId: 6
    replayedShapeId: 6
    projectionRight: {x: 0.9999, y: 0.0101, z: -0.0075}
    projectionUp: {x: -0.0103, y: 0.9996, z: -0.0249}
    projectionForward: {x: 0.0072, y: 0.0249, z: 0.9997}
    rawPositions:
    - {x: 0.1266, y: 0.3718, z: -0.1874}
    - {x: 0.1315, y: 0.3716, z: -0.1848}
    - {x: 0.1405, y: 0.3707, z: -0.1803}
    - {x: 0.1498, y: 0.3698, z: -0.176}
    - {x: 0.1609, y: 0.3678, z: -0.1711}
    - {x: 0.1713, y: 0.3656, z: -0.1664}
    - {x: 0.1838, y: 0.3624, z: -0.161}
    - {x: 0.1953, y: 0.3593, z: -0.1561}
    - {x: 0.2059, y: 0.3561, z: -0.1516}
    - {x: 0.2151, y: 0.3523, z: -0.1482}
    - {x: 0.2237, y: 0.3477, z: -0.1451}
    - {x: 0.2306, y: 0.3436, z: -0.1424}
    - {x: 0.2383, y: 0.3398, z: -0.14}
    - {x: 0.2447, y: 0.3366, z: -0.1377}
    - {x: 0.2517, y: 0.3335, z: -0.1358}
    - {x: 0.2569, y: 0.3307, z: -0.1345}
    - {x: 0.2616, y: 0.3277, z: -0.1335}
    - {x: 0.2663, y: 0.3198, z: -0.132}
    - {x: 0.2673, y: 0.3146, z: -0.131}
    - {x: 0.267, y: 0.3085, z: -0.1302}
    - {x: 0.2639, y: 0.3025, z: -0.1301}
    - {x: 0.2588, y: 0.2958, z: -0.1306}
    - {x: 0.2516, y: 0.2893, z: -0.1317}
    - {x: 0.2419, y: 0.2823, z: -0.1333}
    - {x: 0.2341, y: 0.2756, z: -0.135}
    - {x: 0.2243, y: 0.2684, z: -0.137}
    - {x: 0.2141, y: 0.2615, z: -0.1396}
    - {x: 0.2016, y: 0.2546, z: -0.1433}
    - {x: 0.1882, y: 0.2477, z: -0.148}
    - {x: 0.1733, y: 0.2402, z: -0.1538}
    - {x: 0.1593, y: 0.2325, z: -0.16}
    - {x: 0.1476, y: 0.2253, z: -0.1654}
    - {x: 0.1388, y: 0.2206, z: -0.17}
    - {x: 0.1314, y: 0.2184, z: -0.174}
    - {x: 0.127, y: 0.2186, z: -0.1765}
    - {x: 0.1318, y: 0.2266, z: -0.1741}
    - {x: 0.1358, y: 0.2327, z: -0.1725}
  - captureId: 443
    capturedShapeId: 7
    expectedShapeId: 7
    replayedShapeId: 7
    projectionRight: {x: 0.9997, y: 0.0246, z: -0.0034}
    projectionUp: {x: -0.0247, y: 0.999, z: -0.0381}
    projectionForward: {x: 0.0024, y: 0.0382, z: 0.9993}
    rawPositions:
    - {x: 0.307, y: 0.3665, z: -0.1417}
    - {x: 0.3019, y: 0.3647, z: -0.1401}
    - {x: 0.2967, y: 0.3632, z: -0.139}
    - {x: 0.2805, y: 0.3622, z: -0.1393}
    - {x: 0.2708, y: 0.3618, z: -0.1399}
    - {x: 0.2589, y: 0.3606, z: -0.1411}
    - {x: 0.2468, y: 0.3593, z: -0.1431}
    - {x: 0.2339, y: 0.3576, z: -0.1457}
    - {x: 0.221, y: 0.3554, z: -0.1486}
    - {x: 0.2054, y: 0.352, z: -0.1526}
    - {x: 0.1913, y: 0.3485, z: -0.157}
    - {x: 0.1795, y: 0.345, z: -0.1605}
    - {x: 0.1702, y: 0.3419, z: -0.1635}
    - {x: 0.1617, y: 0.3387, z: -0.1662}
    - {x: 0.1547, y: 0.3349, z: -0.1685}
    - {x: 0.149, y: 0.3307, z: -0.1704}
    - {x: 0.145, y: 0.3267, z: -0.1717}
    - {x: 0.1406, y: 0.3197, z: -0.1735}
    - {x: 0.1413, y: 0.3125, z: -0.1731}
    - {x: 0.1502, y: 0.3065, z: -0.1699}
    - {x: 0.1568, y: 0.303, z: -0.1674}
    - {x: 0.1649, y: 0.2978, z: -0.1642}
    - {x: 0.173, y: 0.2915, z: -0.161}
    - {x: 0.1815, y: 0.2851, z: -0.1577}
    - {x: 0.191, y: 0.2798, z: -0.1546}
    - {x: 0.2019, y: 0.2754, z: -0.1517}
    - {x: 0.2134, y: 0.2702, z: -0.1489}
    - {x: 0.2247, y: 0.2644, z: -0.1463}
    - {x: 0.2357, y: 0.2575, z: -0.1438}
    - {x: 0.2458, y: 0.251, z: -0.1418}
    - {x: 0.255, y: 0.2449, z: -0.1405}
    - {x: 0.2722, y: 0.2339, z: -0.1396}
    - {x: 0.2764, y: 0.2254, z: -0.1406}
    - {x: 0.2812, y: 0.2245, z: -0.1419}
  - captureId: 444
    capturedShapeId: 0
    expectedShapeId: 0
    replayedShapeId: 0
    projectionRight: {x: 0.9998, y: 0.0172, z: -0.0103}
    projectionUp: {x: -0.0175, y: 0.9995, z: -0.0254}
    projectionForward: {x: 0.0098, y: 0.0256, z: 0.9996}
    rawPositions:
    - {x: 0.1152, y: 0.3158, z: -0.2023}
    - {x: 0.1219, y: 0.3166, z: -0.1988}
    - {x: 0.1309, y: 0.3166, z: -0.1945}
    - {x: 0.1401, y: 0.3153, z: -0.1903}
    - {x: 0.1498, y: 0.314, z: -0.1864}
    - {x: 0.1613, y: 0.3121, z: -0.1818}
    - {x: 0.1724, y: 0.3106, z: -0.1773}
    - {x: 0.1998, y: 0.3063, z: -0.1678}
    - {x: 0.216, y: 0.3025, z: -0.1622}
    - {x: 0.2313, y: 0.2995, z: -0.1578}
    - {x: 0.2609, y: 0.2951, z: -0.1503}
    - {x: 0.274, y: 0.2933, z: -0.1474}
    - {x: 0.2867, y: 0.2915, z: -0.1452}
    - {x: 0.2973, y: 0.2905, z: -0.1439}
    - {x: 0.3065, y: 0.2898, z: -0.1431}
    - {x: 0.3199, y: 0.2895, z: -0.1435}
  - captureId: 445
    capturedShapeId: 1
    expectedShapeId: 1
    replayedShapeId: 1
    projectionRight: {x: 0.9995, y: 0.0158, z: -0.0258}
    projectionUp: {x: -0.0162, y: 0.9998, z: -0.0153}
    projectionForward: {x: 0.0256, y: 0.0157, z: 0.9995}
    rawPositions:
    - {x: 0.2173, y: 0.4193, z: -0.1805}
    - {x: 0.2181, y: 0.4073, z: -0.177}
    - {x: 0.2176, y: 0.3948, z: -0.174}
    - {x: 0.2166, y: 0.3802, z: -0.171}
    - {x: 0.215, y: 0.3655, z: -0.1683}
    - {x: 0.213, y: 0.3348, z: -0.1648}
    - {x: 0.2094, y: 0.3004, z: -0.1622}
    - {x: 0.2092, y: 0.2623, z: -0.1603}
    - {x: 0.2061, y: 0.2106, z: -0.1613}
    - {x: 0.2051, y: 0.1981, z: -0.1615}
    - {x: 0.2082, y: 0.1838, z: -0.1621}
  - captureId: 446
    capturedShapeId: 2
    expectedShapeId: 2
    replayedShapeId: 2
    projectionRight: {x: 0.9994, y: 0.0208, z: -0.0283}
    projectionUp: {x: -0.0214, y: 0.9996, z: -0.0206}
    projectionForward: {x: 0.0279, y: 0.0212, z: 0.9994}
    rawPositions:
    - {x: 0.1551, y: 0.3916, z: -0.189}
    - {x: 0.1599, y: 0.3831, z: -0.1858}
    - {x: 0.1681, y: 0.3604, z: -0.1785}
    - {x: 0.184, y: 0.3309, z: -0.1692}
    - {x: 0.1951, y: 0.3155, z: -0.1636}
    - {x: 0.2053, y: 0.3015, z: -0.1589}
    - {x: 0.2173, y: 0.2867, z: -0.154}
    - {x: 0.2429, y: 0.2586, z: -0.1469}
    - {x: 0.2524, y: 0.2456, z: -0.1434}
    - {x: 0.2659, y: 0.2327, z: -0.1422}
    - {x: 0.2753, y: 0.2202, z: -0.1423}
    - {x: 0.2899, y: 0.1996, z: -0.1436}
    - {x: 0.2917, y: 0.1913, z: -0.1438}
    - {x: 0.2971, y: 0.1847, z: -0.1452}
    - {x: 0.3015, y: 0.1785, z: -0.1459}
  - captureId: 447
    capturedShapeId: 3
    expectedShapeId: 3
    replayedShapeId: 3
    projectionRight: {x: 0.9984, y: 0.0559, z: -0.008}
    projectionUp: {x: -0.0561, y: 0.998, z: -0.0305}
    projectionForward: {x: 0.0063, y: 0.0309, z: 0.9995}
    rawPositions:
    - {x: 0.2855, y: 0.3921, z: -0.1588}
    - {x: 0.2776, y: 0.3847, z: -0.1567}
    - {x: 0.2682, y: 0.3755, z: -0.1549}
    - {x: 0.2513, y: 0.3543, z: -0.1517}
    - {x: 0.2323, y: 0.3337, z: -0.1511}
    - {x: 0.2216, y: 0.3209, z: -0.1516}
    - {x: 0.2003, y: 0.2927, z: -0.1533}
    - {x: 0.1804, y: 0.268, z: -0.1573}
    - {x: 0.1706, y: 0.2604, z: -0.1605}
    - {x: 0.1628, y: 0.2529, z: -0.1632}
    - {x: 0.1548, y: 0.2451, z: -0.1661}
    - {x: 0.1471, y: 0.2375, z: -0.169}
    - {x: 0.1346, y: 0.2251, z: -0.1751}
  - captureId: 448
    capturedShapeId: 8
    expectedShapeId: 8
    replayedShapeId: 8
    projectionRight: {x: 0.9988, y: 0.0479, z: -0.0027}
    projectionUp: {x: -0.048, y: 0.9973, z: -0.0551}
    projectionForward: {x: 0.0001, y: 0.0552, z: 0.9985}
    rawPositions:
    - {x: 0.1935, y: 0.2543, z: -0.1558}
    - {x: 0.188, y: 0.2538, z: -0.1566}
    - {x: 0.1827, y: 0.2542, z: -0.1579}
    - {x: 0.1764, y: 0.2546, z: -0.1597}
    - {x: 0.1698, y: 0.2559, z: -0.1618}
    - {x: 0.1632, y: 0.2588, z: -0.1642}
    - {x: 0.157, y: 0.262, z: -0.1664}
    - {x: 0.1514, y: 0.2675, z: -0.1688}
    - {x: 0.1459, y: 0.2728, z: -0.1712}
    - {x: 0.141, y: 0.2804, z: -0.1737}
    - {x: 0.1376, y: 0.2871, z: -0.1756}
    - {x: 0.1346, y: 0.2956, z: -0.1776}
    - {x: 0.1323, y: 0.3027, z: -0.1789}
    - {x: 0.1322, y: 0.3105, z: -0.1792}
    - {x: 0.1328, y: 0.3181, z: -0.1795}
    - {x: 0.1346, y: 0.3276, z: -0.1798}
    - {x: 0.1364, y: 0.3362, z: -0.1802}
    - {x: 0.1397, y: 0.3458, z: -0.1803}
    - {x: 0.1442, y: 0.3542, z: -0.18}
    - {x: 0.1494, y: 0.3621, z: -0.1792}
    - {x: 0.1544, y: 0.3688, z: -0.1785}
    - {x: 0.1613, y: 0.375, z: -0.1769}
    - {x: 0.1682, y: 0.3809, z: -0.1756}
    - {x: 0.1769, y: 0.3861, z: -0.1739}
    - {x: 0.1857, y: 0.3895, z: -0.1719}
    - {x: 0.2036, y: 0.3929, z: -0.1678}
    - {x: 0.2118, y: 0.3928, z: -0.1659}
    - {x: 0.2207, y: 0.3918, z: -0.164}
    - {x: 0.2294, y: 0.3893, z: -0.1618}
    - {x: 0.2368, y: 0.3851, z: -0.1596}
    - {x: 0.2434, y: 0.379, z: -0.1574}
    - {x: 0.2525, y: 0.3634, z: -0.1536}
    - {x: 0.2573, y: 0.3442, z: -0.1505}
    - {x: 0.2565, y: 0.3349, z: -0.1493}
    - {x: 0.2572, y: 0.3262, z: -0.149}
    - {x: 0.2559, y: 0.3176, z: -0.1489}
    - {x: 0.253, y: 0.3073, z: -0.1489}
    - {x: 0.2499, y: 0.2973, z: -0.1491}
    - {x: 0.2454, y: 0.2881, z: -0.1497}
    - {x: 0.2395, y: 0.2812, z: -0.1507}
    - {x: 0.2261, y: 0.2739, z: -0.1537}
    - {x: 0.2101, y: 0.2662, z: -0.1578}
    - {x: 0.1971, y: 0.2617, z: -0.1609}
    - {x: 0.1891, y: 0.2594, z: -0.1634}
    - {x: 0.1829, y: 0.2597, z: -0.1649}
    - {x: 0.1786, y: 0.2624, z: -0.1661}
    - {x: 0.1752, y: 0.2663, z: -0.1673}
  - captureId: 449
    capturedShapeId: 9
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 0.9995, y: 0.0189, z: -0.0237}
    projectionUp: {x: -0.0198, y: 0.9991, z: -0.0382}
    projectionForward: {x: 0.023, y: 0.0387, z: 0.999}
    rawPositions:
    - {x: 0.1627, y: 0.3788, z: -0.1778}
    - {x: 0.1649, y: 0.372, z: -0.176}
    - {x: 0.1621, y: 0.3622, z: -0.1741}
    - {x: 0.1614, y: 0.3536, z: -0.1727}
    - {x: 0.1588, y: 0.3353, z: -0.1706}
    - {x: 0.1573, y: 0.3132, z: -0.168}
    - {x: 0.1536, y: 0.3024, z: -0.1678}
    - {x: 0.1521, y: 0.2924, z: -0.1681}
    - {x: 0.1516, y: 0.2833, z: -0.1682}
    - {x: 0.1508, y: 0.2747, z: -0.1683}
    - {x: 0.1501, y: 0.2668, z: -0.1685}
    - {x: 0.1496, y: 0.2592, z: -0.1689}
    - {x: 0.1494, y: 0.2529, z: -0.1691}
    - {x: 0.1491, y: 0.2476, z: -0.1698}
    - {x: 0.149, y: 0.2409, z: -0.171}
    - {x: 0.1538, y: 0.2391, z: -0.1701}
    - {x: 0.1644, y: 0.242, z: -0.1669}
    - {x: 0.1706, y: 0.2445, z: -0.1654}
    - {x: 0.1763, y: 0.2468, z: -0.1643}
    - {x: 0.1818, y: 0.2481, z: -0.1632}
    - {x: 0.1882, y: 0.2496, z: -0.1621}
    - {x: 0.1946, y: 0.2507, z: -0.1609}
    - {x: 0.2077, y: 0.2509, z: -0.1586}
    - {x: 0.2146, y: 0.2497, z: -0.1571}
    - {x: 0.2297, y: 0.2474, z: -0.1542}
    - {x: 0.2348, y: 0.2459, z: -0.1526}
    - {x: 0.2422, y: 0.2439, z: -0.1512}
    - {x: 0.254, y: 0.2403, z: -0.1489}
    - {x: 0.2617, y: 0.2386, z: -0.1469}
    - {x: 0.2697, y: 0.2422, z: -0.1454}
    - {x: 0.273, y: 0.2475, z: -0.1449}
    - {x: 0.277, y: 0.2558, z: -0.1441}
    - {x: 0.2777, y: 0.2617, z: -0.144}
    - {x: 0.2782, y: 0.2679, z: -0.1441}
    - {x: 0.2777, y: 0.2748, z: -0.1443}
    - {x: 0.277, y: 0.2819, z: -0.1445}
    - {x: 0.2765, y: 0.2975, z: -0.1449}
    - {x: 0.2772, y: 0.3063, z: -0.1452}
    - {x: 0.2817, y: 0.3233, z: -0.1452}
    - {x: 0.2869, y: 0.3404, z: -0.1458}
    - {x: 0.2891, y: 0.3476, z: -0.1463}
    - {x: 0.2902, y: 0.3538, z: -0.1466}
    - {x: 0.2914, y: 0.3654, z: -0.1484}
    - {x: 0.2884, y: 0.3697, z: -0.1491}
    - {x: 0.2843, y: 0.373, z: -0.1498}
    - {x: 0.2791, y: 0.375, z: -0.1505}
    - {x: 0.2733, y: 0.3757, z: -0.1506}
    - {x: 0.2574, y: 0.379, z: -0.1519}
    - {x: 0.2505, y: 0.3789, z: -0.1525}
    - {x: 0.2418, y: 0.3787, z: -0.1532}
    - {x: 0.2234, y: 0.3773, z: -0.1551}
    - {x: 0.2141, y: 0.3772, z: -0.1563}
    - {x: 0.1966, y: 0.3767, z: -0.1601}
    - {x: 0.1773, y: 0.3751, z: -0.165}
    - {x: 0.1676, y: 0.3743, z: -0.1683}
    - {x: 0.1586, y: 0.3729, z: -0.1714}
    - {x: 0.1521, y: 0.3711, z: -0.1738}
    - {x: 0.1464, y: 0.3694, z: -0.1771}
  - captureId: 450
    capturedShapeId: 9
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 0.9989, y: 0.027, z: -0.038}
    projectionUp: {x: -0.0281, y: 0.9992, z: -0.0288}
    projectionForward: {x: 0.0372, y: 0.0298, z: 0.9989}
    rawPositions:
    - {x: 0.1639, y: 0.3582, z: -0.1762}
    - {x: 0.1634, y: 0.3513, z: -0.1739}
    - {x: 0.1644, y: 0.335, z: -0.1697}
    - {x: 0.1643, y: 0.3266, z: -0.1677}
    - {x: 0.1678, y: 0.3073, z: -0.1641}
    - {x: 0.167, y: 0.297, z: -0.1633}
    - {x: 0.1672, y: 0.2865, z: -0.1623}
    - {x: 0.1652, y: 0.2747, z: -0.1624}
    - {x: 0.1641, y: 0.2636, z: -0.1625}
    - {x: 0.1631, y: 0.2435, z: -0.1628}
    - {x: 0.1631, y: 0.2342, z: -0.1624}
    - {x: 0.1631, y: 0.2204, z: -0.1618}
    - {x: 0.1662, y: 0.2133, z: -0.1624}
    - {x: 0.1705, y: 0.2093, z: -0.162}
    - {x: 0.1806, y: 0.2101, z: -0.1599}
    - {x: 0.187, y: 0.211, z: -0.1583}
    - {x: 0.1934, y: 0.2118, z: -0.1569}
    - {x: 0.2053, y: 0.2119, z: -0.1547}
    - {x: 0.2148, y: 0.2111, z: -0.1536}
    - {x: 0.2218, y: 0.2103, z: -0.1518}
    - {x: 0.2304, y: 0.2093, z: -0.15}
    - {x: 0.2401, y: 0.2089, z: -0.1485}
    - {x: 0.2499, y: 0.2087, z: -0.1473}
    - {x: 0.26, y: 0.2089, z: -0.1464}
    - {x: 0.2689, y: 0.2094, z: -0.1456}
    - {x: 0.2759, y: 0.2096, z: -0.145}
    - {x: 0.281, y: 0.2102, z: -0.1448}
    - {x: 0.2892, y: 0.2112, z: -0.1452}
    - {x: 0.2945, y: 0.2128, z: -0.1455}
    - {x: 0.2992, y: 0.2166, z: -0.1455}
    - {x: 0.2982, y: 0.2228, z: -0.1454}
    - {x: 0.2978, y: 0.2302, z: -0.145}
    - {x: 0.3021, y: 0.2462, z: -0.1442}
    - {x: 0.303, y: 0.252, z: -0.1439}
    - {x: 0.3033, y: 0.2584, z: -0.1434}
    - {x: 0.3044, y: 0.2653, z: -0.1428}
    - {x: 0.3095, y: 0.2814, z: -0.1422}
    - {x: 0.3143, y: 0.2996, z: -0.1422}
    - {x: 0.3158, y: 0.3262, z: -0.1438}
    - {x: 0.3171, y: 0.3341, z: -0.1447}
    - {x: 0.3149, y: 0.3475, z: -0.146}
    - {x: 0.3112, y: 0.3579, z: -0.1472}
    - {x: 0.3031, y: 0.3641, z: -0.1481}
    - {x: 0.2935, y: 0.3679, z: -0.1488}
    - {x: 0.2884, y: 0.3689, z: -0.1489}
    - {x: 0.2824, y: 0.3695, z: -0.1492}
    - {x: 0.2671, y: 0.3694, z: -0.1499}
    - {x: 0.25, y: 0.368, z: -0.1508}
    - {x: 0.2414, y: 0.3676, z: -0.1515}
    - {x: 0.2229, y: 0.3678, z: -0.1544}
    - {x: 0.1996, y: 0.3652, z: -0.1588}
    - {x: 0.1865, y: 0.3638, z: -0.1624}
    - {x: 0.1639, y: 0.3601, z: -0.1698}
    - {x: 0.1544, y: 0.3605, z: -0.1749}
  - captureId: 453
    capturedShapeId: 9
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 1, y: 0.0029, z: 0.0073}
    projectionUp: {x: -0.0024, y: 0.9977, z: -0.0671}
    projectionForward: {x: -0.0074, y: 0.0671, z: 0.9977}
    rawPositions:
    - {x: -0.0643, y: 0.4726, z: 0.3425}
    - {x: -0.0649, y: 0.4635, z: 0.3453}
    - {x: -0.065, y: 0.4567, z: 0.3476}
    - {x: -0.0654, y: 0.4492, z: 0.3495}
    - {x: -0.0664, y: 0.4416, z: 0.3507}
    - {x: -0.0674, y: 0.4338, z: 0.3514}
    - {x: -0.0684, y: 0.4251, z: 0.352}
    - {x: -0.0695, y: 0.4168, z: 0.3522}
    - {x: -0.07, y: 0.4083, z: 0.3525}
    - {x: -0.0695, y: 0.3995, z: 0.3536}
    - {x: -0.0687, y: 0.3908, z: 0.3546}
    - {x: -0.0683, y: 0.3822, z: 0.355}
    - {x: -0.0676, y: 0.3739, z: 0.3553}
    - {x: -0.0668, y: 0.3676, z: 0.3554}
    - {x: -0.0664, y: 0.3609, z: 0.3554}
    - {x: -0.0662, y: 0.3546, z: 0.355}
    - {x: -0.0656, y: 0.3492, z: 0.3546}
    - {x: -0.0637, y: 0.3402, z: 0.3541}
    - {x: -0.063, y: 0.331, z: 0.3537}
    - {x: -0.0573, y: 0.328, z: 0.3525}
    - {x: -0.0518, y: 0.3285, z: 0.3527}
    - {x: -0.0446, y: 0.3294, z: 0.3536}
    - {x: -0.0392, y: 0.3306, z: 0.3543}
    - {x: -0.0339, y: 0.3313, z: 0.3549}
    - {x: -0.0282, y: 0.3309, z: 0.3559}
    - {x: -0.0225, y: 0.3295, z: 0.3569}
    - {x: -0.0166, y: 0.3277, z: 0.3579}
    - {x: -0.0099, y: 0.3264, z: 0.359}
    - {x: -0.0026, y: 0.3255, z: 0.3604}
    - {x: 0.0055, y: 0.3243, z: 0.3616}
    - {x: 0.0133, y: 0.3221, z: 0.3629}
    - {x: 0.0207, y: 0.3196, z: 0.364}
    - {x: 0.0287, y: 0.3176, z: 0.3651}
    - {x: 0.0374, y: 0.3165, z: 0.3663}
    - {x: 0.0457, y: 0.3162, z: 0.3673}
    - {x: 0.0536, y: 0.3158, z: 0.3681}
    - {x: 0.0597, y: 0.3153, z: 0.3687}
    - {x: 0.0647, y: 0.3148, z: 0.3688}
    - {x: 0.0742, y: 0.315, z: 0.3691}
    - {x: 0.0822, y: 0.3171, z: 0.3693}
    - {x: 0.0885, y: 0.3207, z: 0.3698}
    - {x: 0.0937, y: 0.3273, z: 0.3698}
    - {x: 0.097, y: 0.3349, z: 0.3697}
    - {x: 0.0988, y: 0.3406, z: 0.3697}
    - {x: 0.1007, y: 0.3468, z: 0.3697}
    - {x: 0.1028, y: 0.354, z: 0.3696}
    - {x: 0.1051, y: 0.3618, z: 0.3694}
    - {x: 0.1075, y: 0.3702, z: 0.3692}
    - {x: 0.1096, y: 0.3783, z: 0.3689}
    - {x: 0.1115, y: 0.3863, z: 0.3685}
    - {x: 0.1131, y: 0.3939, z: 0.3682}
    - {x: 0.1148, y: 0.4015, z: 0.3681}
    - {x: 0.1168, y: 0.4099, z: 0.3678}
    - {x: 0.1184, y: 0.4187, z: 0.3671}
    - {x: 0.12, y: 0.4274, z: 0.3662}
    - {x: 0.1204, y: 0.4355, z: 0.3653}
    - {x: 0.1199, y: 0.4426, z: 0.3645}
    - {x: 0.1189, y: 0.4484, z: 0.3642}
    - {x: 0.118, y: 0.4544, z: 0.3635}
    - {x: 0.1157, y: 0.4602, z: 0.3626}
    - {x: 0.1134, y: 0.4661, z: 0.3615}
    - {x: 0.1117, y: 0.4708, z: 0.3607}
    - {x: 0.1042, y: 0.4768, z: 0.3596}
    - {x: 0.0939, y: 0.4788, z: 0.3595}
    - {x: 0.088, y: 0.4792, z: 0.3595}
    - {x: 0.0815, y: 0.4792, z: 0.3594}
    - {x: 0.0742, y: 0.4791, z: 0.3591}
    - {x: 0.0658, y: 0.4789, z: 0.3586}
    - {x: 0.0569, y: 0.479, z: 0.3579}
    - {x: 0.0474, y: 0.4793, z: 0.3569}
    - {x: 0.0385, y: 0.4794, z: 0.3557}
    - {x: 0.0289, y: 0.4795, z: 0.3545}
    - {x: 0.0178, y: 0.4793, z: 0.3528}
    - {x: 0.0064, y: 0.479, z: 0.3508}
    - {x: -0.0055, y: 0.4786, z: 0.3484}
    - {x: -0.0171, y: 0.4782, z: 0.3457}
    - {x: -0.0283, y: 0.4783, z: 0.3425}
    - {x: -0.038, y: 0.479, z: 0.3395}
    - {x: -0.047, y: 0.4797, z: 0.3365}
    - {x: -0.0555, y: 0.4802, z: 0.3331}
    - {x: -0.0632, y: 0.4806, z: 0.3299}
  - captureId: 454
    capturedShapeId: 9
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 0.9973, y: 0.0036, z: -0.0733}
    projectionUp: {x: -0.0075, y: 0.9985, z: -0.0534}
    projectionForward: {x: 0.073, y: 0.0538, z: 0.9959}
    rawPositions:
    - {x: -0.012, y: 0.4684, z: 0.3314}
    - {x: -0.0127, y: 0.4608, z: 0.3339}
    - {x: -0.0132, y: 0.4505, z: 0.336}
    - {x: -0.0137, y: 0.4433, z: 0.3373}
    - {x: -0.0158, y: 0.4334, z: 0.3382}
    - {x: -0.0186, y: 0.4244, z: 0.3387}
    - {x: -0.0204, y: 0.4154, z: 0.3392}
    - {x: -0.0208, y: 0.4062, z: 0.3404}
    - {x: -0.0206, y: 0.399, z: 0.3411}
    - {x: -0.0207, y: 0.392, z: 0.341}
    - {x: -0.0212, y: 0.3841, z: 0.3407}
    - {x: -0.0224, y: 0.374, z: 0.3405}
    - {x: -0.0232, y: 0.3645, z: 0.3405}
    - {x: -0.0233, y: 0.3556, z: 0.3407}
    - {x: -0.0223, y: 0.3492, z: 0.3405}
    - {x: -0.021, y: 0.3416, z: 0.3403}
    - {x: -0.0185, y: 0.3367, z: 0.3402}
    - {x: -0.0121, y: 0.3312, z: 0.3402}
    - {x: -0.0048, y: 0.3269, z: 0.34}
    - {x: 0.0006, y: 0.3248, z: 0.3401}
    - {x: 0.0059, y: 0.3228, z: 0.3403}
    - {x: 0.0141, y: 0.3214, z: 0.3411}
    - {x: 0.0233, y: 0.3209, z: 0.342}
    - {x: 0.032, y: 0.3199, z: 0.3429}
    - {x: 0.0408, y: 0.3181, z: 0.3436}
    - {x: 0.0484, y: 0.3157, z: 0.3442}
    - {x: 0.0559, y: 0.3134, z: 0.3446}
    - {x: 0.0641, y: 0.3115, z: 0.345}
    - {x: 0.0728, y: 0.3103, z: 0.3455}
    - {x: 0.0825, y: 0.3097, z: 0.3461}
    - {x: 0.0918, y: 0.3093, z: 0.3466}
    - {x: 0.1014, y: 0.3098, z: 0.347}
    - {x: 0.1098, y: 0.3109, z: 0.3472}
    - {x: 0.1184, y: 0.3134, z: 0.3472}
    - {x: 0.1259, y: 0.3152, z: 0.3471}
    - {x: 0.1319, y: 0.3172, z: 0.3469}
    - {x: 0.1387, y: 0.3226, z: 0.3461}
    - {x: 0.1412, y: 0.327, z: 0.3455}
    - {x: 0.1429, y: 0.333, z: 0.345}
    - {x: 0.1449, y: 0.3404, z: 0.3444}
    - {x: 0.1465, y: 0.3478, z: 0.3441}
    - {x: 0.1481, y: 0.3572, z: 0.3439}
    - {x: 0.1491, y: 0.3668, z: 0.3435}
    - {x: 0.1503, y: 0.3773, z: 0.3429}
    - {x: 0.1516, y: 0.3879, z: 0.3422}
    - {x: 0.153, y: 0.3982, z: 0.3413}
    - {x: 0.154, y: 0.4078, z: 0.3407}
    - {x: 0.1551, y: 0.4169, z: 0.34}
    - {x: 0.1555, y: 0.4253, z: 0.3393}
    - {x: 0.1547, y: 0.4331, z: 0.3386}
    - {x: 0.153, y: 0.4403, z: 0.3379}
    - {x: 0.1494, y: 0.4462, z: 0.3375}
    - {x: 0.1439, y: 0.4514, z: 0.3372}
    - {x: 0.1369, y: 0.4554, z: 0.3372}
    - {x: 0.1273, y: 0.4585, z: 0.3372}
    - {x: 0.1158, y: 0.4604, z: 0.3375}
    - {x: 0.1031, y: 0.4621, z: 0.3377}
    - {x: 0.0911, y: 0.4643, z: 0.3371}
    - {x: 0.0773, y: 0.4658, z: 0.3365}
    - {x: 0.0652, y: 0.4668, z: 0.336}
    - {x: 0.0515, y: 0.4673, z: 0.3349}
    - {x: 0.037, y: 0.4679, z: 0.3328}
    - {x: 0.0225, y: 0.469, z: 0.3299}
    - {x: 0.0116, y: 0.4698, z: 0.3277}
    - {x: 0.0028, y: 0.4706, z: 0.326}
    - {x: -0.0058, y: 0.4715, z: 0.3241}
    - {x: -0.0146, y: 0.4725, z: 0.3209}
    - {x: -0.0219, y: 0.4732, z: 0.3181}
  - captureId: 455
    capturedShapeId: 9
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 0.992, y: -0.002, z: -0.126}
    projectionUp: {x: -0.0001, y: 0.9999, z: -0.0167}
    projectionForward: {x: 0.126, y: 0.0166, z: 0.9919}
    rawPositions:
    - {x: 0.0038, y: 0.4639, z: 0.3255}
    - {x: 0.004, y: 0.4593, z: 0.3283}
    - {x: 0.0018, y: 0.4525, z: 0.33}
    - {x: 0, y: 0.4457, z: 0.3306}
    - {x: -0.0024, y: 0.4377, z: 0.3313}
    - {x: -0.0044, y: 0.4292, z: 0.332}
    - {x: -0.0061, y: 0.4198, z: 0.3326}
    - {x: -0.0072, y: 0.4108, z: 0.333}
    - {x: -0.0075, y: 0.4011, z: 0.3335}
    - {x: -0.0069, y: 0.3912, z: 0.3343}
    - {x: -0.0077, y: 0.3782, z: 0.3348}
    - {x: -0.0099, y: 0.3654, z: 0.3343}
    - {x: -0.0124, y: 0.3522, z: 0.3335}
    - {x: -0.0143, y: 0.3411, z: 0.3325}
    - {x: -0.0146, y: 0.331, z: 0.3317}
    - {x: -0.0124, y: 0.3242, z: 0.3316}
    - {x: -0.0098, y: 0.3192, z: 0.3314}
    - {x: -0.0007, y: 0.3173, z: 0.3321}
    - {x: 0.0068, y: 0.3145, z: 0.3321}
    - {x: 0.0128, y: 0.3129, z: 0.3308}
    - {x: 0.0223, y: 0.3138, z: 0.3306}
    - {x: 0.0278, y: 0.3142, z: 0.3306}
    - {x: 0.0341, y: 0.3142, z: 0.331}
    - {x: 0.0418, y: 0.3141, z: 0.3311}
    - {x: 0.0499, y: 0.3139, z: 0.3314}
    - {x: 0.0591, y: 0.3136, z: 0.3317}
    - {x: 0.0683, y: 0.3128, z: 0.332}
    - {x: 0.0762, y: 0.3112, z: 0.3322}
    - {x: 0.0835, y: 0.3097, z: 0.332}
    - {x: 0.091, y: 0.3084, z: 0.3317}
    - {x: 0.0997, y: 0.3073, z: 0.3313}
    - {x: 0.1081, y: 0.3061, z: 0.331}
    - {x: 0.1163, y: 0.3047, z: 0.3306}
    - {x: 0.124, y: 0.3039, z: 0.3302}
    - {x: 0.1316, y: 0.3039, z: 0.3295}
    - {x: 0.1385, y: 0.3045, z: 0.3291}
    - {x: 0.1448, y: 0.3058, z: 0.3287}
    - {x: 0.1493, y: 0.3081, z: 0.3284}
    - {x: 0.1547, y: 0.3136, z: 0.3277}
    - {x: 0.1577, y: 0.3219, z: 0.3271}
    - {x: 0.1601, y: 0.3341, z: 0.3275}
    - {x: 0.1619, y: 0.3424, z: 0.3279}
    - {x: 0.1645, y: 0.3514, z: 0.3284}
    - {x: 0.1677, y: 0.3614, z: 0.3285}
    - {x: 0.1696, y: 0.3713, z: 0.3283}
    - {x: 0.1703, y: 0.3809, z: 0.328}
    - {x: 0.1706, y: 0.3887, z: 0.3281}
    - {x: 0.1712, y: 0.3986, z: 0.3279}
    - {x: 0.1718, y: 0.4074, z: 0.3274}
    - {x: 0.1723, y: 0.416, z: 0.3269}
    - {x: 0.1721, y: 0.4241, z: 0.3265}
    - {x: 0.1715, y: 0.431, z: 0.3265}
    - {x: 0.1701, y: 0.4371, z: 0.3266}
    - {x: 0.1668, y: 0.4417, z: 0.3273}
    - {x: 0.1621, y: 0.4455, z: 0.328}
    - {x: 0.1571, y: 0.4485, z: 0.3285}
    - {x: 0.1507, y: 0.4505, z: 0.3296}
    - {x: 0.143, y: 0.4522, z: 0.3306}
    - {x: 0.1338, y: 0.454, z: 0.3314}
    - {x: 0.1234, y: 0.4558, z: 0.3317}
    - {x: 0.1126, y: 0.4571, z: 0.332}
    - {x: 0.0988, y: 0.4571, z: 0.3323}
    - {x: 0.0845, y: 0.4575, z: 0.3319}
    - {x: 0.0694, y: 0.4586, z: 0.3306}
    - {x: 0.0552, y: 0.4597, z: 0.3292}
    - {x: 0.0411, y: 0.4611, z: 0.3275}
    - {x: 0.0279, y: 0.4624, z: 0.3257}
    - {x: 0.0142, y: 0.4628, z: 0.3234}
    - {x: -0.0003, y: 0.4613, z: 0.3205}
    - {x: -0.0138, y: 0.4581, z: 0.3177}
  - captureId: 456
    capturedShapeId: 8
    expectedShapeId: 8
    replayedShapeId: 8
    projectionRight: {x: 0.9903, y: 0.0487, z: -0.1301}
    projectionUp: {x: -0.0484, y: 0.9988, z: 0.0056}
    projectionForward: {x: 0.1302, y: 0.0008, z: 0.9915}
    rawPositions:
    - {x: 0.0981, y: 0.3028, z: 0.334}
    - {x: 0.0942, y: 0.2972, z: 0.3348}
    - {x: 0.0865, y: 0.2926, z: 0.3355}
    - {x: 0.0773, y: 0.2894, z: 0.3353}
    - {x: 0.0683, y: 0.2881, z: 0.3349}
    - {x: 0.057, y: 0.2909, z: 0.3344}
    - {x: 0.0344, y: 0.3007, z: 0.3332}
    - {x: 0.0239, y: 0.3054, z: 0.3315}
    - {x: 0.0115, y: 0.3132, z: 0.3299}
    - {x: 0.0012, y: 0.321, z: 0.3281}
    - {x: -0.0089, y: 0.3344, z: 0.3259}
    - {x: -0.0155, y: 0.3468, z: 0.3239}
    - {x: -0.0194, y: 0.3614, z: 0.3226}
    - {x: -0.0197, y: 0.3741, z: 0.3223}
    - {x: -0.0185, y: 0.3869, z: 0.3225}
    - {x: -0.0159, y: 0.3974, z: 0.3231}
    - {x: -0.0091, y: 0.4099, z: 0.3243}
    - {x: -0.0037, y: 0.4205, z: 0.3245}
    - {x: 0.0043, y: 0.4315, z: 0.3247}
    - {x: 0.0135, y: 0.4395, z: 0.325}
    - {x: 0.0241, y: 0.4466, z: 0.326}
    - {x: 0.034, y: 0.4502, z: 0.3268}
    - {x: 0.0441, y: 0.4538, z: 0.328}
    - {x: 0.0575, y: 0.4522, z: 0.3298}
    - {x: 0.0713, y: 0.45, z: 0.3315}
    - {x: 0.0825, y: 0.4483, z: 0.3322}
    - {x: 0.0947, y: 0.4437, z: 0.333}
    - {x: 0.1048, y: 0.4388, z: 0.3336}
    - {x: 0.1145, y: 0.4293, z: 0.3347}
    - {x: 0.1206, y: 0.4185, z: 0.3359}
    - {x: 0.1261, y: 0.4048, z: 0.3371}
    - {x: 0.1301, y: 0.3902, z: 0.3384}
    - {x: 0.1343, y: 0.3759, z: 0.3391}
    - {x: 0.1342, y: 0.363, z: 0.339}
    - {x: 0.1339, y: 0.3514, z: 0.3384}
    - {x: 0.1333, y: 0.3417, z: 0.3378}
    - {x: 0.1297, y: 0.3311, z: 0.3369}
    - {x: 0.124, y: 0.3208, z: 0.3364}
    - {x: 0.1136, y: 0.3091, z: 0.3346}
    - {x: 0.1024, y: 0.2999, z: 0.3329}
    - {x: 0.0909, y: 0.2936, z: 0.3309}
    - {x: 0.08, y: 0.2927, z: 0.3288}
    - {x: 0.0691, y: 0.2973, z: 0.327}
  - captureId: 457
    capturedShapeId: 8
    expectedShapeId: 8
    replayedShapeId: 8
    projectionRight: {x: 0.9922, y: 0.0224, z: -0.1229}
    projectionUp: {x: -0.0245, y: 0.9996, z: -0.0153}
    projectionForward: {x: 0.1225, y: 0.0182, z: 0.9923}
    rawPositions:
    - {x: 0.0772, y: 0.328, z: 0.3404}
    - {x: 0.0683, y: 0.3184, z: 0.3402}
    - {x: 0.0616, y: 0.311, z: 0.3409}
    - {x: 0.0514, y: 0.3043, z: 0.3407}
    - {x: 0.0418, y: 0.3009, z: 0.3403}
    - {x: 0.0326, y: 0.2981, z: 0.3396}
    - {x: 0.0219, y: 0.3015, z: 0.3387}
    - {x: 0.0103, y: 0.3063, z: 0.3379}
    - {x: 0.0007, y: 0.3151, z: 0.3373}
    - {x: -0.0068, y: 0.323, z: 0.3367}
    - {x: -0.0144, y: 0.3311, z: 0.3357}
    - {x: -0.0214, y: 0.3406, z: 0.3344}
    - {x: -0.0279, y: 0.3513, z: 0.3331}
    - {x: -0.0329, y: 0.3667, z: 0.3311}
    - {x: -0.0346, y: 0.3827, z: 0.3298}
    - {x: -0.0312, y: 0.3981, z: 0.3298}
    - {x: -0.0277, y: 0.4125, z: 0.3293}
    - {x: -0.0232, y: 0.4254, z: 0.3289}
    - {x: -0.017, y: 0.4365, z: 0.329}
    - {x: -0.01, y: 0.4466, z: 0.3292}
    - {x: -0.0011, y: 0.4561, z: 0.3295}
    - {x: 0.0084, y: 0.4641, z: 0.3298}
    - {x: 0.0184, y: 0.4706, z: 0.3306}
    - {x: 0.0292, y: 0.4756, z: 0.3312}
    - {x: 0.0409, y: 0.4781, z: 0.3322}
    - {x: 0.052, y: 0.4798, z: 0.3331}
    - {x: 0.0633, y: 0.4787, z: 0.3343}
    - {x: 0.074, y: 0.4756, z: 0.3359}
    - {x: 0.0843, y: 0.4682, z: 0.3383}
    - {x: 0.0932, y: 0.4602, z: 0.3403}
    - {x: 0.102, y: 0.4497, z: 0.3425}
    - {x: 0.1087, y: 0.4376, z: 0.3448}
    - {x: 0.1145, y: 0.4239, z: 0.3467}
    - {x: 0.1193, y: 0.4077, z: 0.3486}
    - {x: 0.1224, y: 0.3922, z: 0.3498}
    - {x: 0.1225, y: 0.3781, z: 0.3502}
    - {x: 0.1203, y: 0.367, z: 0.3495}
    - {x: 0.1173, y: 0.3577, z: 0.3483}
    - {x: 0.1126, y: 0.348, z: 0.3471}
    - {x: 0.1061, y: 0.3375, z: 0.346}
    - {x: 0.0968, y: 0.3264, z: 0.3442}
    - {x: 0.0846, y: 0.3157, z: 0.342}
    - {x: 0.0708, y: 0.3055, z: 0.339}
    - {x: 0.0581, y: 0.299, z: 0.3354}
    - {x: 0.0445, y: 0.2949, z: 0.3318}
    - {x: 0.0331, y: 0.295, z: 0.3281}
    - {x: 0.0255, y: 0.2992, z: 0.3256}
  - captureId: 458
    capturedShapeId: 8
    expectedShapeId: 8
    replayedShapeId: 8
    projectionRight: {x: 0.9931, y: 0.0136, z: -0.1166}
    projectionUp: {x: -0.0173, y: 0.9994, z: -0.0308}
    projectionForward: {x: 0.1161, y: 0.0326, z: 0.9927}
    rawPositions:
    - {x: 0.1012, y: 0.2904, z: 0.342}
    - {x: 0.0871, y: 0.2833, z: 0.3415}
    - {x: 0.0752, y: 0.2803, z: 0.3415}
    - {x: 0.0652, y: 0.2794, z: 0.3421}
    - {x: 0.0559, y: 0.2795, z: 0.3424}
    - {x: 0.045, y: 0.2821, z: 0.3427}
    - {x: 0.0313, y: 0.2864, z: 0.3417}
    - {x: 0.0171, y: 0.2927, z: 0.34}
    - {x: 0.0022, y: 0.2994, z: 0.3375}
    - {x: -0.0115, y: 0.3055, z: 0.3343}
    - {x: -0.0257, y: 0.3112, z: 0.3299}
    - {x: -0.0381, y: 0.319, z: 0.3255}
    - {x: -0.0471, y: 0.3319, z: 0.3219}
    - {x: -0.0492, y: 0.3492, z: 0.3209}
    - {x: -0.0437, y: 0.3701, z: 0.3226}
    - {x: -0.0341, y: 0.3874, z: 0.3258}
    - {x: -0.0223, y: 0.4027, z: 0.3293}
    - {x: -0.009, y: 0.4158, z: 0.3325}
    - {x: 0.006, y: 0.4289, z: 0.3349}
    - {x: 0.0196, y: 0.4406, z: 0.3364}
    - {x: 0.0359, y: 0.4522, z: 0.3371}
    - {x: 0.0518, y: 0.4611, z: 0.3365}
    - {x: 0.0684, y: 0.4657, z: 0.337}
    - {x: 0.0861, y: 0.4647, z: 0.3377}
    - {x: 0.1021, y: 0.462, z: 0.3381}
    - {x: 0.1183, y: 0.4564, z: 0.3385}
    - {x: 0.1342, y: 0.4473, z: 0.3393}
    - {x: 0.1465, y: 0.4346, z: 0.3405}
    - {x: 0.1544, y: 0.4179, z: 0.3417}
    - {x: 0.16, y: 0.3724, z: 0.3442}
    - {x: 0.159, y: 0.348, z: 0.3445}
    - {x: 0.1573, y: 0.3255, z: 0.3431}
    - {x: 0.1526, y: 0.3076, z: 0.3412}
    - {x: 0.1454, y: 0.2939, z: 0.3396}
    - {x: 0.1333, y: 0.2873, z: 0.3383}
    - {x: 0.1165, y: 0.2843, z: 0.3369}
    - {x: 0.1019, y: 0.2813, z: 0.3348}
    - {x: 0.0803, y: 0.2779, z: 0.3308}
    - {x: 0.0542, y: 0.2741, z: 0.3248}
  - captureId: 459
    capturedShapeId: 8
    expectedShapeId: 8
    replayedShapeId: 8
    projectionRight: {x: 0.9944, y: 0.0153, z: -0.1045}
    projectionUp: {x: -0.0197, y: 0.999, z: -0.0412}
    projectionForward: {x: 0.1038, y: 0.043, z: 0.9937}
    rawPositions:
    - {x: 0.0799, y: 0.2997, z: 0.3429}
    - {x: 0.0699, y: 0.2959, z: 0.3427}
    - {x: 0.058, y: 0.2934, z: 0.3427}
    - {x: 0.0454, y: 0.2899, z: 0.3417}
    - {x: 0.0311, y: 0.2869, z: 0.3402}
    - {x: 0.0141, y: 0.2876, z: 0.3377}
    - {x: -0.0015, y: 0.2932, z: 0.3352}
    - {x: -0.0167, y: 0.3046, z: 0.3332}
    - {x: -0.0289, y: 0.32, z: 0.3311}
    - {x: -0.0373, y: 0.3371, z: 0.3293}
    - {x: -0.0427, y: 0.3539, z: 0.327}
    - {x: -0.0455, y: 0.3662, z: 0.3259}
    - {x: -0.0432, y: 0.3767, z: 0.327}
    - {x: -0.0354, y: 0.3868, z: 0.3307}
    - {x: -0.0232, y: 0.4017, z: 0.3343}
    - {x: -0.0119, y: 0.4216, z: 0.3355}
    - {x: 0.0016, y: 0.4432, z: 0.3343}
    - {x: 0.0319, y: 0.4713, z: 0.3322}
    - {x: 0.0437, y: 0.4757, z: 0.3332}
    - {x: 0.0549, y: 0.4751, z: 0.3345}
    - {x: 0.0657, y: 0.4743, z: 0.336}
    - {x: 0.0791, y: 0.4722, z: 0.3371}
    - {x: 0.0913, y: 0.4699, z: 0.338}
    - {x: 0.1033, y: 0.4638, z: 0.3392}
    - {x: 0.1132, y: 0.4542, z: 0.341}
    - {x: 0.1205, y: 0.4405, z: 0.3433}
    - {x: 0.1257, y: 0.4219, z: 0.3467}
    - {x: 0.1294, y: 0.3989, z: 0.3498}
    - {x: 0.1295, y: 0.3747, z: 0.3513}
    - {x: 0.1292, y: 0.354, z: 0.3509}
    - {x: 0.1267, y: 0.3351, z: 0.3494}
    - {x: 0.1237, y: 0.3198, z: 0.3476}
    - {x: 0.1175, y: 0.3059, z: 0.3456}
    - {x: 0.1083, y: 0.293, z: 0.3437}
    - {x: 0.0903, y: 0.2852, z: 0.3398}
    - {x: 0.0745, y: 0.2795, z: 0.3359}
    - {x: 0.0591, y: 0.2773, z: 0.3323}
    - {x: 0.0423, y: 0.2805, z: 0.3282}
    - {x: 0.0199, y: 0.2999, z: 0.3237}
  - captureId: 460
    capturedShapeId: 8
    expectedShapeId: 8
    replayedShapeId: 8
    projectionRight: {x: 0.9954, y: 0.0221, z: -0.0928}
    projectionUp: {x: -0.0265, y: 0.9986, z: -0.0464}
    projectionForward: {x: 0.0917, y: 0.0487, z: 0.9946}
    rawPositions:
    - {x: 0.0941, y: 0.2839, z: 0.34}
    - {x: 0.0857, y: 0.2806, z: 0.3406}
    - {x: 0.0743, y: 0.2768, z: 0.3407}
    - {x: 0.0628, y: 0.2768, z: 0.3414}
    - {x: 0.0423, y: 0.2822, z: 0.3433}
    - {x: 0.0301, y: 0.2876, z: 0.3429}
    - {x: 0.0163, y: 0.2946, z: 0.3421}
    - {x: 0.0005, y: 0.3046, z: 0.3399}
    - {x: -0.0138, y: 0.3135, z: 0.3374}
    - {x: -0.0276, y: 0.3226, z: 0.3341}
    - {x: -0.0404, y: 0.3329, z: 0.3305}
    - {x: -0.0514, y: 0.3442, z: 0.3268}
    - {x: -0.0598, y: 0.3583, z: 0.3232}
    - {x: -0.0629, y: 0.3726, z: 0.3212}
    - {x: -0.0641, y: 0.3866, z: 0.3197}
    - {x: -0.0557, y: 0.4035, z: 0.3216}
    - {x: -0.0474, y: 0.4185, z: 0.3235}
    - {x: -0.0334, y: 0.4338, z: 0.3261}
    - {x: -0.0202, y: 0.4473, z: 0.3285}
    - {x: -0.0047, y: 0.4602, z: 0.3302}
    - {x: 0.0105, y: 0.4705, z: 0.331}
    - {x: 0.0252, y: 0.4782, z: 0.3315}
    - {x: 0.0387, y: 0.4826, z: 0.3324}
    - {x: 0.0679, y: 0.4828, z: 0.335}
    - {x: 0.0844, y: 0.4791, z: 0.3372}
    - {x: 0.0996, y: 0.47, z: 0.3401}
    - {x: 0.1264, y: 0.441, z: 0.3471}
    - {x: 0.1347, y: 0.4205, z: 0.3503}
    - {x: 0.139, y: 0.399, z: 0.3525}
    - {x: 0.1407, y: 0.3748, z: 0.3534}
    - {x: 0.1406, y: 0.3554, z: 0.3528}
    - {x: 0.1386, y: 0.3381, z: 0.3515}
    - {x: 0.1353, y: 0.326, z: 0.3499}
    - {x: 0.1303, y: 0.3143, z: 0.3483}
    - {x: 0.1226, y: 0.3039, z: 0.3465}
    - {x: 0.1119, y: 0.2909, z: 0.3444}
    - {x: 0.1002, y: 0.278, z: 0.3412}
    - {x: 0.0838, y: 0.2631, z: 0.3366}
    - {x: 0.0637, y: 0.2561, z: 0.3313}
    - {x: 0.0445, y: 0.2603, z: 0.3269}
  - captureId: 461
    capturedShapeId: 8
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 0.9933, y: 0.0007, z: -0.1154}
    projectionUp: {x: -0.0049, y: 0.9993, z: -0.0362}
    projectionForward: {x: 0.1153, y: 0.0365, z: 0.9927}
    rawPositions:
    - {x: -0.0234, y: 0.4914, z: 0.2963}
    - {x: -0.0237, y: 0.4856, z: 0.3011}
    - {x: -0.0251, y: 0.4769, z: 0.3063}
    - {x: -0.0252, y: 0.4647, z: 0.3123}
    - {x: -0.0244, y: 0.4513, z: 0.3177}
    - {x: -0.025, y: 0.4404, z: 0.3208}
    - {x: -0.027, y: 0.4277, z: 0.3226}
    - {x: -0.0298, y: 0.4181, z: 0.3233}
    - {x: -0.0338, y: 0.4067, z: 0.3226}
    - {x: -0.0378, y: 0.3939, z: 0.322}
    - {x: -0.0429, y: 0.3764, z: 0.3211}
    - {x: -0.048, y: 0.3591, z: 0.32}
    - {x: -0.0524, y: 0.3399, z: 0.3175}
    - {x: -0.0545, y: 0.3261, z: 0.3158}
    - {x: -0.0536, y: 0.3147, z: 0.3149}
    - {x: -0.0507, y: 0.3098, z: 0.315}
    - {x: -0.0456, y: 0.3065, z: 0.3158}
    - {x: -0.0399, y: 0.3047, z: 0.3173}
    - {x: -0.0309, y: 0.3044, z: 0.3195}
    - {x: -0.0235, y: 0.3028, z: 0.3207}
    - {x: -0.0136, y: 0.3011, z: 0.3222}
    - {x: -0.0055, y: 0.2987, z: 0.3232}
    - {x: 0.0032, y: 0.2953, z: 0.3239}
    - {x: 0.0127, y: 0.2929, z: 0.3245}
    - {x: 0.023, y: 0.2914, z: 0.3253}
    - {x: 0.033, y: 0.2918, z: 0.3255}
    - {x: 0.0452, y: 0.2928, z: 0.3264}
    - {x: 0.0565, y: 0.2928, z: 0.3275}
    - {x: 0.0679, y: 0.2922, z: 0.3285}
    - {x: 0.0776, y: 0.2915, z: 0.3288}
    - {x: 0.0867, y: 0.2907, z: 0.3288}
    - {x: 0.0937, y: 0.2903, z: 0.3288}
    - {x: 0.0999, y: 0.2907, z: 0.3284}
    - {x: 0.1062, y: 0.294, z: 0.3276}
    - {x: 0.1105, y: 0.3005, z: 0.3267}
    - {x: 0.1133, y: 0.3051, z: 0.3273}
    - {x: 0.1185, y: 0.3127, z: 0.3278}
    - {x: 0.1233, y: 0.3206, z: 0.3283}
    - {x: 0.1258, y: 0.3265, z: 0.3286}
    - {x: 0.131, y: 0.334, z: 0.3291}
    - {x: 0.1356, y: 0.3419, z: 0.3295}
    - {x: 0.1402, y: 0.3509, z: 0.3299}
    - {x: 0.1433, y: 0.3584, z: 0.3299}
    - {x: 0.1459, y: 0.3663, z: 0.33}
    - {x: 0.1472, y: 0.3747, z: 0.3298}
    - {x: 0.1485, y: 0.3849, z: 0.3297}
    - {x: 0.1507, y: 0.3964, z: 0.3293}
    - {x: 0.1533, y: 0.4109, z: 0.3283}
    - {x: 0.1565, y: 0.4249, z: 0.3267}
    - {x: 0.1582, y: 0.4359, z: 0.3253}
    - {x: 0.1581, y: 0.445, z: 0.3239}
    - {x: 0.1544, y: 0.4525, z: 0.3236}
    - {x: 0.1492, y: 0.4583, z: 0.3239}
    - {x: 0.1408, y: 0.4646, z: 0.3242}
    - {x: 0.133, y: 0.471, z: 0.324}
    - {x: 0.1211, y: 0.4768, z: 0.3241}
    - {x: 0.1085, y: 0.4806, z: 0.3245}
    - {x: 0.093, y: 0.4823, z: 0.3253}
    - {x: 0.0772, y: 0.4825, z: 0.3263}
    - {x: 0.0571, y: 0.4816, z: 0.3264}
    - {x: 0.0414, y: 0.4821, z: 0.3256}
    - {x: 0.0216, y: 0.4824, z: 0.3236}
    - {x: 0.0044, y: 0.4826, z: 0.3211}
    - {x: -0.0148, y: 0.4824, z: 0.3175}
    - {x: -0.0308, y: 0.4808, z: 0.3137}
    - {x: -0.0443, y: 0.4786, z: 0.3104}
    - {x: -0.0541, y: 0.4759, z: 0.3073}
    - {x: -0.0594, y: 0.4743, z: 0.3052}
  - captureId: 462
    capturedShapeId: 8
    expectedShapeId: 9
    replayedShapeId: 8
    projectionRight: {x: 0.996, y: 0.0189, z: -0.0877}
    projectionUp: {x: -0.0223, y: 0.999, z: -0.0376}
    projectionForward: {x: 0.087, y: 0.0394, z: 0.9954}
    rawPositions:
    - {x: -0.0434, y: 0.4615, z: 0.312}
    - {x: -0.0464, y: 0.4511, z: 0.3152}
    - {x: -0.0501, y: 0.4381, z: 0.3191}
    - {x: -0.0541, y: 0.4267, z: 0.3209}
    - {x: -0.0592, y: 0.4111, z: 0.3219}
    - {x: -0.0627, y: 0.3928, z: 0.323}
    - {x: -0.0656, y: 0.3755, z: 0.3232}
    - {x: -0.0671, y: 0.3605, z: 0.3226}
    - {x: -0.0655, y: 0.3461, z: 0.3235}
    - {x: -0.0607, y: 0.3341, z: 0.325}
    - {x: -0.056, y: 0.3066, z: 0.3235}
    - {x: -0.0547, y: 0.2916, z: 0.3223}
    - {x: -0.0523, y: 0.2806, z: 0.3199}
    - {x: -0.049, y: 0.2728, z: 0.3184}
    - {x: -0.0435, y: 0.2727, z: 0.3186}
    - {x: -0.0357, y: 0.2736, z: 0.3202}
    - {x: -0.0273, y: 0.2765, z: 0.3219}
    - {x: -0.0201, y: 0.2754, z: 0.3223}
    - {x: -0.0153, y: 0.2733, z: 0.3217}
    - {x: -0.0103, y: 0.2703, z: 0.3209}
    - {x: -0.002, y: 0.2634, z: 0.3184}
    - {x: 0.0029, y: 0.2608, z: 0.3172}
    - {x: 0.0087, y: 0.2596, z: 0.3166}
    - {x: 0.0165, y: 0.2613, z: 0.3172}
    - {x: 0.0249, y: 0.2638, z: 0.318}
    - {x: 0.0367, y: 0.268, z: 0.3196}
    - {x: 0.0494, y: 0.2715, z: 0.3209}
    - {x: 0.0605, y: 0.2736, z: 0.3218}
    - {x: 0.071, y: 0.2737, z: 0.3224}
    - {x: 0.0794, y: 0.2736, z: 0.3222}
    - {x: 0.0871, y: 0.2737, z: 0.3217}
    - {x: 0.0952, y: 0.2745, z: 0.3214}
    - {x: 0.1037, y: 0.2762, z: 0.3213}
    - {x: 0.1112, y: 0.2791, z: 0.321}
    - {x: 0.1184, y: 0.2821, z: 0.3207}
    - {x: 0.1253, y: 0.2856, z: 0.3205}
    - {x: 0.1321, y: 0.2896, z: 0.3203}
    - {x: 0.1389, y: 0.2941, z: 0.3204}
    - {x: 0.1448, y: 0.2981, z: 0.3206}
    - {x: 0.1502, y: 0.3017, z: 0.3207}
    - {x: 0.1542, y: 0.3064, z: 0.3212}
    - {x: 0.1583, y: 0.3121, z: 0.3217}
    - {x: 0.162, y: 0.3193, z: 0.3226}
    - {x: 0.1651, y: 0.3285, z: 0.3234}
    - {x: 0.1672, y: 0.3374, z: 0.3239}
    - {x: 0.1677, y: 0.345, z: 0.3244}
    - {x: 0.1665, y: 0.3521, z: 0.3253}
    - {x: 0.1647, y: 0.3597, z: 0.3263}
    - {x: 0.1637, y: 0.3691, z: 0.3269}
    - {x: 0.1629, y: 0.3803, z: 0.3268}
    - {x: 0.1621, y: 0.3928, z: 0.3266}
    - {x: 0.1603, y: 0.4056, z: 0.326}
    - {x: 0.1558, y: 0.4181, z: 0.3252}
    - {x: 0.1486, y: 0.4269, z: 0.325}
    - {x: 0.1385, y: 0.4332, z: 0.3254}
    - {x: 0.1269, y: 0.439, z: 0.3254}
    - {x: 0.1114, y: 0.4439, z: 0.3256}
    - {x: 0.0946, y: 0.4483, z: 0.3254}
    - {x: 0.0763, y: 0.452, z: 0.325}
    - {x: 0.057, y: 0.4549, z: 0.3238}
    - {x: 0.0372, y: 0.4579, z: 0.3216}
    - {x: 0.0176, y: 0.4606, z: 0.3185}
    - {x: -0.0028, y: 0.4622, z: 0.3147}
    - {x: -0.0243, y: 0.462, z: 0.31}
    - {x: -0.0473, y: 0.4588, z: 0.3042}
    - {x: -0.0646, y: 0.4535, z: 0.2998}
    - {x: -0.0771, y: 0.4477, z: 0.2971}
  - captureId: 463
    capturedShapeId: 9
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 0.9931, y: 0.0101, z: -0.1168}
    projectionUp: {x: -0.0134, y: 0.9995, z: -0.0277}
    projectionForward: {x: 0.1165, y: 0.0291, z: 0.9928}
    rawPositions:
    - {x: -0.0097, y: 0.4895, z: 0.3095}
    - {x: -0.0114, y: 0.4815, z: 0.3126}
    - {x: -0.0147, y: 0.47, z: 0.3155}
    - {x: -0.0174, y: 0.4594, z: 0.3173}
    - {x: -0.0189, y: 0.4485, z: 0.3192}
    - {x: -0.0197, y: 0.4361, z: 0.3214}
    - {x: -0.0222, y: 0.4218, z: 0.3231}
    - {x: -0.0278, y: 0.4053, z: 0.3235}
    - {x: -0.0343, y: 0.3857, z: 0.3231}
    - {x: -0.04, y: 0.365, z: 0.3224}
    - {x: -0.0448, y: 0.342, z: 0.3209}
    - {x: -0.0497, y: 0.3219, z: 0.3179}
    - {x: -0.0523, y: 0.3082, z: 0.3147}
    - {x: -0.0522, y: 0.3017, z: 0.3129}
    - {x: -0.0472, y: 0.3009, z: 0.3139}
    - {x: -0.0401, y: 0.3022, z: 0.316}
    - {x: -0.0334, y: 0.3025, z: 0.3176}
    - {x: -0.0266, y: 0.304, z: 0.3186}
    - {x: -0.0175, y: 0.3041, z: 0.3179}
    - {x: -0.0126, y: 0.3059, z: 0.3173}
    - {x: -0.0066, y: 0.3079, z: 0.3171}
    - {x: 0.0006, y: 0.3093, z: 0.3175}
    - {x: 0.0096, y: 0.3101, z: 0.3183}
    - {x: 0.0188, y: 0.3091, z: 0.3188}
    - {x: 0.0295, y: 0.3065, z: 0.3194}
    - {x: 0.0385, y: 0.3037, z: 0.3195}
    - {x: 0.0486, y: 0.3015, z: 0.3197}
    - {x: 0.0589, y: 0.3008, z: 0.3196}
    - {x: 0.0699, y: 0.3003, z: 0.3195}
    - {x: 0.0814, y: 0.2998, z: 0.3193}
    - {x: 0.0917, y: 0.2993, z: 0.3189}
    - {x: 0.1026, y: 0.2987, z: 0.3181}
    - {x: 0.1129, y: 0.2983, z: 0.3173}
    - {x: 0.1228, y: 0.2979, z: 0.3164}
    - {x: 0.1322, y: 0.298, z: 0.3154}
    - {x: 0.1403, y: 0.2991, z: 0.3145}
    - {x: 0.1477, y: 0.3021, z: 0.3133}
    - {x: 0.154, y: 0.3052, z: 0.3122}
    - {x: 0.1591, y: 0.3078, z: 0.3115}
    - {x: 0.1602, y: 0.3138, z: 0.3109}
    - {x: 0.1613, y: 0.3248, z: 0.3121}
    - {x: 0.1629, y: 0.3319, z: 0.3129}
    - {x: 0.1659, y: 0.3419, z: 0.314}
    - {x: 0.1698, y: 0.3521, z: 0.3146}
    - {x: 0.174, y: 0.363, z: 0.315}
    - {x: 0.1782, y: 0.3742, z: 0.3149}
    - {x: 0.1817, y: 0.3858, z: 0.3145}
    - {x: 0.1845, y: 0.3985, z: 0.3138}
    - {x: 0.1875, y: 0.4108, z: 0.3126}
    - {x: 0.1905, y: 0.4232, z: 0.3108}
    - {x: 0.1928, y: 0.4341, z: 0.3093}
    - {x: 0.194, y: 0.4432, z: 0.3083}
    - {x: 0.1935, y: 0.4509, z: 0.3077}
    - {x: 0.1918, y: 0.4566, z: 0.3078}
    - {x: 0.1884, y: 0.4615, z: 0.3087}
    - {x: 0.1828, y: 0.4631, z: 0.3106}
    - {x: 0.1762, y: 0.4656, z: 0.3125}
    - {x: 0.1666, y: 0.468, z: 0.3144}
    - {x: 0.1582, y: 0.4719, z: 0.3151}
    - {x: 0.1485, y: 0.4756, z: 0.3158}
    - {x: 0.1367, y: 0.4791, z: 0.3164}
    - {x: 0.1217, y: 0.4814, z: 0.3172}
    - {x: 0.1031, y: 0.4825, z: 0.3184}
    - {x: 0.0835, y: 0.4835, z: 0.3186}
    - {x: 0.0596, y: 0.4835, z: 0.3172}
    - {x: 0.0337, y: 0.4819, z: 0.3146}
    - {x: 0.0071, y: 0.4789, z: 0.3111}
    - {x: -0.0162, y: 0.4761, z: 0.3069}
    - {x: -0.0372, y: 0.4729, z: 0.3014}
    - {x: -0.0526, y: 0.4697, z: 0.2968}
  - captureId: 464
    capturedShapeId: 9
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 0.9889, y: -0.0096, z: -0.1482}
    projectionUp: {x: 0.0056, y: 0.9996, z: -0.027}
    projectionForward: {x: 0.1484, y: 0.0259, z: 0.9886}
    rawPositions:
    - {x: -0.0332, y: 0.4597, z: 0.3076}
    - {x: -0.0337, y: 0.4503, z: 0.3118}
    - {x: -0.0376, y: 0.438, z: 0.3151}
    - {x: -0.04, y: 0.4253, z: 0.3182}
    - {x: -0.0433, y: 0.4104, z: 0.3204}
    - {x: -0.0473, y: 0.3937, z: 0.3216}
    - {x: -0.0519, y: 0.3788, z: 0.3212}
    - {x: -0.0562, y: 0.3673, z: 0.3198}
    - {x: -0.0585, y: 0.3588, z: 0.3182}
    - {x: -0.0578, y: 0.3513, z: 0.317}
    - {x: -0.0571, y: 0.3422, z: 0.3161}
    - {x: -0.0564, y: 0.3319, z: 0.3151}
    - {x: -0.0566, y: 0.3223, z: 0.3138}
    - {x: -0.0554, y: 0.314, z: 0.3128}
    - {x: -0.0538, y: 0.3075, z: 0.3113}
    - {x: -0.0515, y: 0.3032, z: 0.3099}
    - {x: -0.0451, y: 0.2997, z: 0.3086}
    - {x: -0.0377, y: 0.2983, z: 0.3084}
    - {x: -0.0291, y: 0.2948, z: 0.3079}
    - {x: -0.0237, y: 0.2957, z: 0.3084}
    - {x: -0.0174, y: 0.2985, z: 0.3093}
    - {x: -0.0103, y: 0.3013, z: 0.3106}
    - {x: -0.0024, y: 0.3021, z: 0.312}
    - {x: 0.0059, y: 0.301, z: 0.3134}
    - {x: 0.0152, y: 0.2991, z: 0.3145}
    - {x: 0.0344, y: 0.2976, z: 0.3156}
    - {x: 0.0449, y: 0.2989, z: 0.3171}
    - {x: 0.0567, y: 0.3005, z: 0.3174}
    - {x: 0.0688, y: 0.3016, z: 0.3179}
    - {x: 0.082, y: 0.3013, z: 0.3188}
    - {x: 0.0948, y: 0.3008, z: 0.3186}
    - {x: 0.1068, y: 0.2997, z: 0.3184}
    - {x: 0.1165, y: 0.2987, z: 0.3179}
    - {x: 0.1254, y: 0.2992, z: 0.3171}
    - {x: 0.1332, y: 0.3008, z: 0.3163}
    - {x: 0.1398, y: 0.3029, z: 0.3153}
    - {x: 0.1446, y: 0.3056, z: 0.3144}
    - {x: 0.1508, y: 0.3096, z: 0.3133}
    - {x: 0.1517, y: 0.315, z: 0.3131}
    - {x: 0.1519, y: 0.3256, z: 0.3136}
    - {x: 0.1529, y: 0.3332, z: 0.3143}
    - {x: 0.1544, y: 0.3419, z: 0.315}
    - {x: 0.1566, y: 0.3512, z: 0.3159}
    - {x: 0.1591, y: 0.3618, z: 0.3164}
    - {x: 0.1613, y: 0.3736, z: 0.3166}
    - {x: 0.1628, y: 0.386, z: 0.3164}
    - {x: 0.1643, y: 0.3989, z: 0.3157}
    - {x: 0.1662, y: 0.4115, z: 0.3147}
    - {x: 0.1691, y: 0.4248, z: 0.3133}
    - {x: 0.1719, y: 0.4388, z: 0.3113}
    - {x: 0.1743, y: 0.4526, z: 0.3085}
    - {x: 0.1752, y: 0.4653, z: 0.3059}
    - {x: 0.174, y: 0.474, z: 0.3046}
    - {x: 0.1712, y: 0.4802, z: 0.3045}
    - {x: 0.1653, y: 0.4831, z: 0.3057}
    - {x: 0.1575, y: 0.4842, z: 0.3077}
    - {x: 0.1479, y: 0.4846, z: 0.3098}
    - {x: 0.1367, y: 0.4857, z: 0.311}
    - {x: 0.1246, y: 0.4873, z: 0.3118}
    - {x: 0.111, y: 0.4885, z: 0.3129}
    - {x: 0.0955, y: 0.4889, z: 0.3136}
    - {x: 0.0788, y: 0.4882, z: 0.3144}
    - {x: 0.0614, y: 0.4873, z: 0.3148}
    - {x: 0.0366, y: 0.4844, z: 0.3137}
    - {x: 0.0117, y: 0.4814, z: 0.3111}
    - {x: -0.011, y: 0.4784, z: 0.3073}
    - {x: -0.0314, y: 0.475, z: 0.3027}
    - {x: -0.0463, y: 0.4728, z: 0.2992}
    - {x: -0.0589, y: 0.4704, z: 0.2955}
  - captureId: 465
    capturedShapeId: 8
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 0.989, y: -0.0049, z: -0.148}
    projectionUp: {x: 0.0064, y: 0.9999, z: 0.0098}
    projectionForward: {x: 0.1479, y: -0.0107, z: 0.9889}
    rawPositions:
    - {x: -0.0319, y: 0.4519, z: 0.3097}
    - {x: -0.036, y: 0.4375, z: 0.3135}
    - {x: -0.0393, y: 0.4229, z: 0.3161}
    - {x: -0.0421, y: 0.412, z: 0.3162}
    - {x: -0.0437, y: 0.4049, z: 0.3149}
    - {x: -0.0431, y: 0.3991, z: 0.3141}
    - {x: -0.0431, y: 0.3912, z: 0.3126}
    - {x: -0.0441, y: 0.3805, z: 0.3119}
    - {x: -0.0454, y: 0.3687, z: 0.3112}
    - {x: -0.0458, y: 0.3567, z: 0.3102}
    - {x: -0.0446, y: 0.3463, z: 0.3097}
    - {x: -0.0427, y: 0.3387, z: 0.3089}
    - {x: -0.0402, y: 0.3335, z: 0.3085}
    - {x: -0.0384, y: 0.3286, z: 0.308}
    - {x: -0.0371, y: 0.3235, z: 0.3074}
    - {x: -0.0365, y: 0.3182, z: 0.3065}
    - {x: -0.0358, y: 0.3131, z: 0.3054}
    - {x: -0.0319, y: 0.306, z: 0.3041}
    - {x: -0.0255, y: 0.306, z: 0.3051}
    - {x: -0.0179, y: 0.3069, z: 0.306}
    - {x: -0.0091, y: 0.3034, z: 0.306}
    - {x: -0.002, y: 0.3012, z: 0.3072}
    - {x: 0.0185, y: 0.3005, z: 0.3109}
    - {x: 0.029, y: 0.3004, z: 0.3133}
    - {x: 0.0419, y: 0.2987, z: 0.3149}
    - {x: 0.0547, y: 0.2948, z: 0.3166}
    - {x: 0.0655, y: 0.2914, z: 0.3177}
    - {x: 0.0772, y: 0.2901, z: 0.3183}
    - {x: 0.089, y: 0.2908, z: 0.3189}
    - {x: 0.1024, y: 0.2937, z: 0.3192}
    - {x: 0.1154, y: 0.2971, z: 0.319}
    - {x: 0.1263, y: 0.2994, z: 0.3191}
    - {x: 0.1343, y: 0.3009, z: 0.3189}
    - {x: 0.1399, y: 0.3035, z: 0.318}
    - {x: 0.1445, y: 0.313, z: 0.317}
    - {x: 0.1471, y: 0.3201, z: 0.3169}
    - {x: 0.1491, y: 0.3298, z: 0.3169}
    - {x: 0.1518, y: 0.3401, z: 0.3171}
    - {x: 0.1541, y: 0.3503, z: 0.3172}
    - {x: 0.1569, y: 0.3605, z: 0.3167}
    - {x: 0.1592, y: 0.3715, z: 0.3162}
    - {x: 0.1612, y: 0.3816, z: 0.3155}
    - {x: 0.1627, y: 0.3912, z: 0.315}
    - {x: 0.164, y: 0.4011, z: 0.3143}
    - {x: 0.1657, y: 0.4106, z: 0.3137}
    - {x: 0.1674, y: 0.42, z: 0.3133}
    - {x: 0.1697, y: 0.429, z: 0.3126}
    - {x: 0.1712, y: 0.4367, z: 0.3122}
    - {x: 0.1715, y: 0.443, z: 0.312}
    - {x: 0.1705, y: 0.4484, z: 0.3124}
    - {x: 0.1684, y: 0.453, z: 0.3128}
    - {x: 0.157, y: 0.4611, z: 0.3139}
    - {x: 0.1477, y: 0.4643, z: 0.3152}
    - {x: 0.1381, y: 0.4665, z: 0.316}
    - {x: 0.1234, y: 0.4672, z: 0.3175}
    - {x: 0.1092, y: 0.4684, z: 0.318}
    - {x: 0.0923, y: 0.4692, z: 0.318}
    - {x: 0.075, y: 0.4699, z: 0.3175}
    - {x: 0.0554, y: 0.4698, z: 0.3168}
    - {x: 0.0361, y: 0.4689, z: 0.3162}
    - {x: 0.0165, y: 0.4678, z: 0.3144}
    - {x: -0.0041, y: 0.466, z: 0.311}
    - {x: -0.0417, y: 0.4611, z: 0.3021}
    - {x: -0.0528, y: 0.4577, z: 0.2996}
    - {x: -0.0617, y: 0.4545, z: 0.2976}
  - captureId: 466
    capturedShapeId: 8
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 0.9869, y: 0.0039, z: -0.1615}
    projectionUp: {x: -0.004, y: 1, z: 0.0001}
    projectionForward: {x: 0.1615, y: 0.0005, z: 0.9869}
    rawPositions:
    - {x: -0.0423, y: 0.4452, z: 0.3043}
    - {x: -0.0452, y: 0.4316, z: 0.307}
    - {x: -0.0492, y: 0.4161, z: 0.3099}
    - {x: -0.0522, y: 0.4023, z: 0.3117}
    - {x: -0.0552, y: 0.3895, z: 0.3125}
    - {x: -0.0585, y: 0.3761, z: 0.3121}
    - {x: -0.0618, y: 0.3616, z: 0.3104}
    - {x: -0.0635, y: 0.3486, z: 0.3095}
    - {x: -0.064, y: 0.338, z: 0.3086}
    - {x: -0.0628, y: 0.3305, z: 0.3077}
    - {x: -0.0607, y: 0.3246, z: 0.307}
    - {x: -0.0577, y: 0.3201, z: 0.3066}
    - {x: -0.0546, y: 0.3153, z: 0.3059}
    - {x: -0.052, y: 0.3111, z: 0.3048}
    - {x: -0.0497, y: 0.3065, z: 0.3037}
    - {x: -0.0478, y: 0.3018, z: 0.3029}
    - {x: -0.0473, y: 0.2962, z: 0.3015}
    - {x: -0.0476, y: 0.2902, z: 0.2994}
    - {x: -0.0473, y: 0.2847, z: 0.2974}
    - {x: -0.0398, y: 0.2791, z: 0.2974}
    - {x: -0.0339, y: 0.2802, z: 0.2987}
    - {x: -0.0268, y: 0.2835, z: 0.3002}
    - {x: -0.0198, y: 0.2847, z: 0.3013}
    - {x: -0.0134, y: 0.2841, z: 0.3019}
    - {x: -0.0056, y: 0.2827, z: 0.3028}
    - {x: 0.0044, y: 0.2821, z: 0.3042}
    - {x: 0.0141, y: 0.2819, z: 0.3057}
    - {x: 0.0268, y: 0.2829, z: 0.3075}
    - {x: 0.0383, y: 0.2833, z: 0.3088}
    - {x: 0.049, y: 0.283, z: 0.3097}
    - {x: 0.0586, y: 0.2816, z: 0.31}
    - {x: 0.0677, y: 0.2791, z: 0.3103}
    - {x: 0.0761, y: 0.2765, z: 0.3103}
    - {x: 0.0835, y: 0.2752, z: 0.3099}
    - {x: 0.0902, y: 0.2765, z: 0.3097}
    - {x: 0.0973, y: 0.279, z: 0.3099}
    - {x: 0.1042, y: 0.2814, z: 0.3102}
    - {x: 0.111, y: 0.2858, z: 0.3101}
    - {x: 0.1113, y: 0.2913, z: 0.3102}
    - {x: 0.113, y: 0.2979, z: 0.3109}
    - {x: 0.1166, y: 0.3072, z: 0.3118}
    - {x: 0.1213, y: 0.3182, z: 0.3128}
    - {x: 0.1257, y: 0.3281, z: 0.3137}
    - {x: 0.1298, y: 0.3392, z: 0.3143}
    - {x: 0.1329, y: 0.351, z: 0.3145}
    - {x: 0.1363, y: 0.3616, z: 0.3147}
    - {x: 0.1405, y: 0.372, z: 0.3148}
    - {x: 0.1447, y: 0.3831, z: 0.3148}
    - {x: 0.149, y: 0.3947, z: 0.3144}
    - {x: 0.1532, y: 0.4056, z: 0.3136}
    - {x: 0.1556, y: 0.4153, z: 0.313}
    - {x: 0.1568, y: 0.4238, z: 0.3121}
    - {x: 0.1555, y: 0.4301, z: 0.312}
    - {x: 0.1521, y: 0.4345, z: 0.3126}
    - {x: 0.1487, y: 0.4383, z: 0.3134}
    - {x: 0.1444, y: 0.4411, z: 0.3146}
    - {x: 0.1405, y: 0.4459, z: 0.3148}
    - {x: 0.1369, y: 0.451, z: 0.3148}
    - {x: 0.1299, y: 0.4545, z: 0.3155}
    - {x: 0.1188, y: 0.4562, z: 0.3166}
    - {x: 0.1051, y: 0.4567, z: 0.318}
    - {x: 0.0857, y: 0.4552, z: 0.3193}
    - {x: 0.0671, y: 0.4547, z: 0.3195}
    - {x: 0.0468, y: 0.4549, z: 0.3187}
    - {x: 0.0259, y: 0.4554, z: 0.316}
    - {x: 0.0015, y: 0.4538, z: 0.3127}
    - {x: -0.0186, y: 0.4509, z: 0.3098}
    - {x: -0.0395, y: 0.4464, z: 0.3059}
    - {x: -0.0577, y: 0.4414, z: 0.3012}
    - {x: -0.0723, y: 0.4384, z: 0.2969}
  - captureId: 467
    capturedShapeId: 8
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 0.989, y: -0.0062, z: -0.1475}
    projectionUp: {x: 0.0044, y: 0.9999, z: -0.0125}
    projectionForward: {x: 0.1476, y: 0.0117, z: 0.989}
    rawPositions:
    - {x: -0.0445, y: 0.4517, z: 0.3018}
    - {x: -0.0501, y: 0.4363, z: 0.3061}
    - {x: -0.0535, y: 0.4206, z: 0.3105}
    - {x: -0.0559, y: 0.4088, z: 0.3121}
    - {x: -0.0571, y: 0.3989, z: 0.3129}
    - {x: -0.0582, y: 0.3894, z: 0.313}
    - {x: -0.0597, y: 0.3776, z: 0.3128}
    - {x: -0.0617, y: 0.3651, z: 0.3124}
    - {x: -0.0639, y: 0.351, z: 0.3106}
    - {x: -0.0645, y: 0.3397, z: 0.309}
    - {x: -0.0643, y: 0.3297, z: 0.3074}
    - {x: -0.0648, y: 0.3219, z: 0.3053}
    - {x: -0.0627, y: 0.3155, z: 0.3044}
    - {x: -0.0601, y: 0.31, z: 0.3041}
    - {x: -0.0572, y: 0.3049, z: 0.3036}
    - {x: -0.0528, y: 0.2972, z: 0.3017}
    - {x: -0.0508, y: 0.292, z: 0.2999}
    - {x: -0.0429, y: 0.2928, z: 0.2991}
    - {x: -0.035, y: 0.2934, z: 0.2998}
    - {x: -0.0291, y: 0.2935, z: 0.3009}
    - {x: -0.0222, y: 0.2938, z: 0.3023}
    - {x: -0.0143, y: 0.2945, z: 0.3038}
    - {x: -0.0037, y: 0.2952, z: 0.3058}
    - {x: 0.0058, y: 0.2951, z: 0.3077}
    - {x: 0.0165, y: 0.2929, z: 0.3092}
    - {x: 0.0244, y: 0.2887, z: 0.3102}
    - {x: 0.0324, y: 0.2846, z: 0.3107}
    - {x: 0.0419, y: 0.2823, z: 0.311}
    - {x: 0.0514, y: 0.2828, z: 0.3113}
    - {x: 0.062, y: 0.2845, z: 0.312}
    - {x: 0.0723, y: 0.2862, z: 0.3127}
    - {x: 0.0811, y: 0.2874, z: 0.3132}
    - {x: 0.0885, y: 0.2894, z: 0.3132}
    - {x: 0.0945, y: 0.2927, z: 0.3128}
    - {x: 0.0993, y: 0.2966, z: 0.3125}
    - {x: 0.1031, y: 0.3012, z: 0.3124}
    - {x: 0.1057, y: 0.3058, z: 0.3126}
    - {x: 0.107, y: 0.311, z: 0.3129}
    - {x: 0.1088, y: 0.3175, z: 0.3134}
    - {x: 0.1117, y: 0.3265, z: 0.314}
    - {x: 0.1161, y: 0.337, z: 0.3147}
    - {x: 0.1204, y: 0.348, z: 0.3152}
    - {x: 0.1231, y: 0.358, z: 0.3159}
    - {x: 0.1252, y: 0.3677, z: 0.3167}
    - {x: 0.1264, y: 0.3786, z: 0.3178}
    - {x: 0.1292, y: 0.3909, z: 0.3179}
    - {x: 0.1324, y: 0.4043, z: 0.3177}
    - {x: 0.1357, y: 0.4177, z: 0.3167}
    - {x: 0.1385, y: 0.4329, z: 0.3151}
    - {x: 0.1395, y: 0.4442, z: 0.3136}
    - {x: 0.138, y: 0.4542, z: 0.3126}
    - {x: 0.1344, y: 0.462, z: 0.3118}
    - {x: 0.1255, y: 0.4678, z: 0.3119}
    - {x: 0.1168, y: 0.4727, z: 0.3121}
    - {x: 0.1061, y: 0.4765, z: 0.3127}
    - {x: 0.0937, y: 0.4782, z: 0.3138}
    - {x: 0.0796, y: 0.4796, z: 0.3147}
    - {x: 0.067, y: 0.4811, z: 0.3152}
    - {x: 0.0532, y: 0.4832, z: 0.3151}
    - {x: 0.0388, y: 0.4857, z: 0.3138}
    - {x: 0.0205, y: 0.4866, z: 0.3119}
    - {x: 0.0024, y: 0.4848, z: 0.3102}
    - {x: -0.0193, y: 0.4797, z: 0.3081}
    - {x: -0.0419, y: 0.4714, z: 0.3049}
    - {x: -0.0606, y: 0.4646, z: 0.3011}
    - {x: -0.0733, y: 0.4606, z: 0.2975}
    - {x: -0.0809, y: 0.4594, z: 0.2949}
  - captureId: 468
    capturedShapeId: 9
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 0.9897, y: -0.0047, z: -0.1428}
    projectionUp: {x: 0.004, y: 1, z: -0.0051}
    projectionForward: {x: 0.1428, y: 0.0045, z: 0.9897}
    rawPositions:
    - {x: -0.0794, y: 0.4371, z: 0.2938}
    - {x: -0.0835, y: 0.4257, z: 0.2946}
    - {x: -0.0847, y: 0.4152, z: 0.2966}
    - {x: -0.0853, y: 0.4045, z: 0.2978}
    - {x: -0.0861, y: 0.3938, z: 0.2989}
    - {x: -0.0888, y: 0.3799, z: 0.2994}
    - {x: -0.0913, y: 0.3663, z: 0.2985}
    - {x: -0.0938, y: 0.3508, z: 0.297}
    - {x: -0.0937, y: 0.3387, z: 0.296}
    - {x: -0.0927, y: 0.3293, z: 0.2952}
    - {x: -0.0915, y: 0.3224, z: 0.2944}
    - {x: -0.091, y: 0.3138, z: 0.2937}
    - {x: -0.0905, y: 0.3038, z: 0.2929}
    - {x: -0.0903, y: 0.2936, z: 0.2912}
    - {x: -0.0897, y: 0.286, z: 0.2898}
    - {x: -0.0877, y: 0.2811, z: 0.2892}
    - {x: -0.0802, y: 0.2835, z: 0.2898}
    - {x: -0.0748, y: 0.2873, z: 0.2908}
    - {x: -0.0689, y: 0.2902, z: 0.2923}
    - {x: -0.0602, y: 0.2934, z: 0.2947}
    - {x: -0.0519, y: 0.2938, z: 0.2968}
    - {x: -0.0437, y: 0.2933, z: 0.2986}
    - {x: -0.0344, y: 0.2925, z: 0.3006}
    - {x: -0.0256, y: 0.2915, z: 0.3022}
    - {x: -0.0148, y: 0.2907, z: 0.3039}
    - {x: -0.0056, y: 0.2904, z: 0.3054}
    - {x: 0.0057, y: 0.2911, z: 0.3066}
    - {x: 0.0294, y: 0.2921, z: 0.3094}
    - {x: 0.0372, y: 0.2928, z: 0.3113}
    - {x: 0.0497, y: 0.2952, z: 0.3122}
    - {x: 0.0577, y: 0.2991, z: 0.3129}
    - {x: 0.0656, y: 0.3045, z: 0.3133}
    - {x: 0.0712, y: 0.3106, z: 0.3139}
    - {x: 0.0787, y: 0.3183, z: 0.3146}
    - {x: 0.0849, y: 0.3269, z: 0.3154}
    - {x: 0.0916, y: 0.3355, z: 0.3158}
    - {x: 0.0952, y: 0.3435, z: 0.3158}
    - {x: 0.0982, y: 0.3514, z: 0.3158}
    - {x: 0.0985, y: 0.3583, z: 0.3158}
    - {x: 0.0979, y: 0.3648, z: 0.3161}
    - {x: 0.0965, y: 0.3717, z: 0.3164}
    - {x: 0.0967, y: 0.3796, z: 0.3171}
    - {x: 0.0977, y: 0.3869, z: 0.3176}
    - {x: 0.0972, y: 0.3942, z: 0.318}
    - {x: 0.0933, y: 0.3998, z: 0.3184}
    - {x: 0.0849, y: 0.4046, z: 0.3188}
    - {x: 0.0762, y: 0.4088, z: 0.319}
    - {x: 0.0625, y: 0.4119, z: 0.3186}
    - {x: 0.0505, y: 0.4159, z: 0.3174}
    - {x: 0.0364, y: 0.4203, z: 0.3155}
    - {x: 0.0239, y: 0.4247, z: 0.3138}
    - {x: 0.0109, y: 0.4288, z: 0.3119}
    - {x: -0.0014, y: 0.4324, z: 0.3098}
    - {x: -0.0133, y: 0.435, z: 0.3077}
    - {x: -0.0238, y: 0.4369, z: 0.3054}
    - {x: -0.0337, y: 0.439, z: 0.3028}
    - {x: -0.041, y: 0.4426, z: 0.2997}
  - captureId: 469
    capturedShapeId: 8
    expectedShapeId: 9
    replayedShapeId: 8
    projectionRight: {x: 0.9923, y: -0.0245, z: -0.1216}
    projectionUp: {x: 0.021, y: 0.9993, z: -0.0301}
    projectionForward: {x: 0.1222, y: 0.0273, z: 0.9921}
    rawPositions:
    - {x: -0.0466, y: 0.5191, z: 0.1401}
    - {x: -0.0463, y: 0.5113, z: 0.1454}
    - {x: -0.0478, y: 0.5014, z: 0.1502}
    - {x: -0.0512, y: 0.4865, z: 0.1563}
    - {x: -0.0573, y: 0.4677, z: 0.1615}
    - {x: -0.063, y: 0.4472, z: 0.1659}
    - {x: -0.069, y: 0.4256, z: 0.1686}
    - {x: -0.0731, y: 0.4082, z: 0.1696}
    - {x: -0.0754, y: 0.3915, z: 0.1705}
    - {x: -0.0753, y: 0.3761, z: 0.1718}
    - {x: -0.0734, y: 0.3605, z: 0.1732}
    - {x: -0.0726, y: 0.3465, z: 0.1734}
    - {x: -0.0724, y: 0.334, z: 0.1726}
    - {x: -0.0721, y: 0.3244, z: 0.1711}
    - {x: -0.0706, y: 0.3164, z: 0.1697}
    - {x: -0.0676, y: 0.3115, z: 0.1686}
    - {x: -0.0641, y: 0.3072, z: 0.1682}
    - {x: -0.0587, y: 0.3069, z: 0.1684}
    - {x: -0.0496, y: 0.3096, z: 0.1695}
    - {x: -0.0418, y: 0.3106, z: 0.1704}
    - {x: -0.0321, y: 0.3122, z: 0.1712}
    - {x: -0.0238, y: 0.3124, z: 0.1718}
    - {x: -0.0145, y: 0.313, z: 0.1721}
    - {x: -0.0057, y: 0.3133, z: 0.1724}
    - {x: 0.0043, y: 0.3135, z: 0.1726}
    - {x: 0.0149, y: 0.3125, z: 0.1737}
    - {x: 0.026, y: 0.3117, z: 0.1742}
    - {x: 0.0361, y: 0.3114, z: 0.1741}
    - {x: 0.0456, y: 0.3103, z: 0.1739}
    - {x: 0.0533, y: 0.308, z: 0.1738}
    - {x: 0.0608, y: 0.305, z: 0.174}
    - {x: 0.0678, y: 0.3033, z: 0.1739}
    - {x: 0.0769, y: 0.3031, z: 0.174}
    - {x: 0.0867, y: 0.3037, z: 0.1743}
    - {x: 0.0979, y: 0.3058, z: 0.1745}
    - {x: 0.1074, y: 0.3075, z: 0.1746}
    - {x: 0.1155, y: 0.31, z: 0.1743}
    - {x: 0.1226, y: 0.3124, z: 0.174}
    - {x: 0.1297, y: 0.3153, z: 0.1734}
    - {x: 0.1359, y: 0.3188, z: 0.1727}
    - {x: 0.1415, y: 0.3232, z: 0.172}
    - {x: 0.1461, y: 0.3284, z: 0.1711}
    - {x: 0.1515, y: 0.3352, z: 0.1703}
    - {x: 0.156, y: 0.3422, z: 0.1698}
    - {x: 0.1598, y: 0.3485, z: 0.1693}
    - {x: 0.1624, y: 0.3537, z: 0.169}
    - {x: 0.164, y: 0.3588, z: 0.1692}
    - {x: 0.1638, y: 0.3645, z: 0.1692}
    - {x: 0.1624, y: 0.372, z: 0.1692}
    - {x: 0.1606, y: 0.3806, z: 0.1692}
    - {x: 0.16, y: 0.391, z: 0.1688}
    - {x: 0.1602, y: 0.4019, z: 0.1678}
    - {x: 0.1603, y: 0.4163, z: 0.1659}
    - {x: 0.1596, y: 0.4294, z: 0.1635}
    - {x: 0.1565, y: 0.4434, z: 0.1604}
    - {x: 0.1515, y: 0.4551, z: 0.1576}
    - {x: 0.1474, y: 0.4669, z: 0.1544}
    - {x: 0.1444, y: 0.4779, z: 0.1511}
    - {x: 0.1416, y: 0.4892, z: 0.1472}
    - {x: 0.1395, y: 0.4975, z: 0.1442}
    - {x: 0.1368, y: 0.5061, z: 0.1412}
    - {x: 0.1327, y: 0.5119, z: 0.1396}
    - {x: 0.1268, y: 0.5157, z: 0.139}
    - {x: 0.1203, y: 0.5183, z: 0.1386}
    - {x: 0.1135, y: 0.5201, z: 0.1387}
    - {x: 0.1078, y: 0.5224, z: 0.1384}
    - {x: 0.1016, y: 0.5249, z: 0.1384}
    - {x: 0.096, y: 0.5276, z: 0.1379}
    - {x: 0.0882, y: 0.5283, z: 0.1385}
    - {x: 0.0811, y: 0.5287, z: 0.1388}
    - {x: 0.0713, y: 0.5281, z: 0.1399}
    - {x: 0.0608, y: 0.5272, z: 0.1408}
    - {x: 0.0497, y: 0.5263, z: 0.1417}
    - {x: 0.0392, y: 0.5261, z: 0.1418}
    - {x: 0.0282, y: 0.5273, z: 0.1406}
    - {x: 0.0163, y: 0.5287, z: 0.1383}
    - {x: -0.0001, y: 0.5282, z: 0.1349}
    - {x: -0.0214, y: 0.523, z: 0.1313}
    - {x: -0.0417, y: 0.5132, z: 0.1289}
    - {x: -0.0541, y: 0.5049, z: 0.1276}
    - {x: -0.0619, y: 0.5018, z: 0.125}
  - captureId: 470
    capturedShapeId: 9
    expectedShapeId: 9
    replayedShapeId: 9
    projectionRight: {x: 0.99, y: -0.006, z: -0.141}
    projectionUp: {x: -0.0013, y: 0.9987, z: -0.0513}
    projectionForward: {x: 0.1411, y: 0.0509, z: 0.9887}
    rawPositions:
    - {x: -0.0477, y: 0.4558, z: 0.1379}
    - {x: -0.0507, y: 0.4438, z: 0.1423}
    - {x: -0.0518, y: 0.428, z: 0.1489}
    - {x: -0.0536, y: 0.4111, z: 0.1536}
    - {x: -0.056, y: 0.395, z: 0.1568}
    - {x: -0.0581, y: 0.3788, z: 0.1588}
    - {x: -0.0587, y: 0.3643, z: 0.1596}
    - {x: -0.0596, y: 0.3529, z: 0.1585}
    - {x: -0.0594, y: 0.3433, z: 0.1574}
    - {x: -0.0603, y: 0.3324, z: 0.1562}
    - {x: -0.0619, y: 0.3209, z: 0.1544}
    - {x: -0.0638, y: 0.3079, z: 0.1512}
    - {x: -0.0658, y: 0.2952, z: 0.1477}
    - {x: -0.0652, y: 0.2831, z: 0.1453}
    - {x: -0.0634, y: 0.2745, z: 0.1436}
    - {x: -0.0597, y: 0.2704, z: 0.1427}
    - {x: -0.0535, y: 0.2696, z: 0.1432}
    - {x: -0.0468, y: 0.2709, z: 0.1441}
    - {x: -0.0409, y: 0.273, z: 0.1445}
    - {x: -0.0358, y: 0.2745, z: 0.1442}
    - {x: -0.0258, y: 0.2751, z: 0.1436}
    - {x: -0.0204, y: 0.2764, z: 0.1436}
    - {x: -0.013, y: 0.2785, z: 0.1442}
    - {x: -0.0038, y: 0.2799, z: 0.1446}
    - {x: 0.0048, y: 0.2793, z: 0.1445}
    - {x: 0.0136, y: 0.2771, z: 0.1443}
    - {x: 0.0227, y: 0.2751, z: 0.1443}
    - {x: 0.0333, y: 0.2727, z: 0.1447}
    - {x: 0.0451, y: 0.27, z: 0.1451}
    - {x: 0.058, y: 0.2666, z: 0.1459}
    - {x: 0.0725, y: 0.2641, z: 0.1466}
    - {x: 0.0858, y: 0.2646, z: 0.1469}
    - {x: 0.0995, y: 0.2664, z: 0.1464}
    - {x: 0.1109, y: 0.2702, z: 0.1459}
    - {x: 0.1195, y: 0.2735, z: 0.1448}
    - {x: 0.1238, y: 0.2776, z: 0.1441}
    - {x: 0.1287, y: 0.2824, z: 0.1432}
    - {x: 0.1334, y: 0.2889, z: 0.1429}
    - {x: 0.139, y: 0.2986, z: 0.1427}
    - {x: 0.1445, y: 0.3113, z: 0.1424}
    - {x: 0.1507, y: 0.3248, z: 0.1419}
    - {x: 0.1551, y: 0.3372, z: 0.1413}
    - {x: 0.1581, y: 0.3502, z: 0.1403}
    - {x: 0.1585, y: 0.3611, z: 0.1397}
    - {x: 0.159, y: 0.3711, z: 0.1392}
    - {x: 0.1597, y: 0.3818, z: 0.1387}
    - {x: 0.1616, y: 0.3947, z: 0.1376}
    - {x: 0.1655, y: 0.4075, z: 0.1358}
    - {x: 0.17, y: 0.4204, z: 0.1339}
    - {x: 0.1739, y: 0.4316, z: 0.1318}
    - {x: 0.1757, y: 0.4398, z: 0.1309}
    - {x: 0.1749, y: 0.4453, z: 0.1312}
    - {x: 0.1698, y: 0.4523, z: 0.1337}
    - {x: 0.1656, y: 0.4558, z: 0.1351}
    - {x: 0.1596, y: 0.4599, z: 0.1358}
    - {x: 0.1519, y: 0.464, z: 0.1369}
    - {x: 0.1387, y: 0.4664, z: 0.1388}
    - {x: 0.1228, y: 0.4674, z: 0.141}
    - {x: 0.1039, y: 0.4673, z: 0.1429}
    - {x: 0.0817, y: 0.4668, z: 0.1442}
    - {x: 0.0631, y: 0.4671, z: 0.1442}
    - {x: 0.0398, y: 0.468, z: 0.1435}
    - {x: 0.0216, y: 0.4675, z: 0.1424}
    - {x: 0.0051, y: 0.4656, z: 0.1415}
    - {x: -0.0098, y: 0.4639, z: 0.1399}
    - {x: -0.0341, y: 0.4637, z: 0.1339}
  - captureId: 471
    capturedShapeId: 8
    expectedShapeId: 8
    replayedShapeId: 8
    projectionRight: {x: 0.9926, y: 0.0036, z: -0.1217}
    projectionUp: {x: -0.0022, y: 0.9999, z: 0.0117}
    projectionForward: {x: 0.1217, y: -0.0113, z: 0.9925}
    rawPositions:
    - {x: 0.1335, y: 0.2447, z: 0.1596}
    - {x: 0.1189, y: 0.2341, z: 0.1592}
    - {x: 0.106, y: 0.2264, z: 0.159}
    - {x: 0.0925, y: 0.22, z: 0.1592}
    - {x: 0.077, y: 0.2157, z: 0.1594}
    - {x: 0.0625, y: 0.212, z: 0.1587}
    - {x: 0.0442, y: 0.2141, z: 0.1578}
    - {x: 0.0257, y: 0.2197, z: 0.1568}
    - {x: 0.008, y: 0.2283, z: 0.1555}
    - {x: -0.0101, y: 0.237, z: 0.1532}
    - {x: -0.0288, y: 0.2484, z: 0.1499}
    - {x: -0.045, y: 0.2616, z: 0.1465}
    - {x: -0.0577, y: 0.2764, z: 0.1439}
    - {x: -0.0663, y: 0.293, z: 0.1421}
    - {x: -0.0723, y: 0.3096, z: 0.1404}
    - {x: -0.076, y: 0.3255, z: 0.1391}
    - {x: -0.0707, y: 0.3462, z: 0.1406}
    - {x: -0.0627, y: 0.3661, z: 0.1423}
    - {x: -0.0516, y: 0.3855, z: 0.1442}
    - {x: -0.038, y: 0.4027, z: 0.1459}
    - {x: -0.0208, y: 0.4178, z: 0.1482}
    - {x: -0.0009, y: 0.4285, z: 0.1509}
    - {x: 0.0206, y: 0.4365, z: 0.1531}
    - {x: 0.0406, y: 0.4397, z: 0.155}
    - {x: 0.0596, y: 0.4411, z: 0.1559}
    - {x: 0.0773, y: 0.437, z: 0.1568}
    - {x: 0.0923, y: 0.428, z: 0.1583}
    - {x: 0.104, y: 0.4126, z: 0.1601}
    - {x: 0.1132, y: 0.3938, z: 0.1618}
    - {x: 0.1204, y: 0.3753, z: 0.1628}
    - {x: 0.1272, y: 0.3593, z: 0.1628}
    - {x: 0.1312, y: 0.339, z: 0.162}
    - {x: 0.1352, y: 0.3216, z: 0.1603}
    - {x: 0.1364, y: 0.3061, z: 0.1582}
    - {x: 0.1316, y: 0.2915, z: 0.1557}
    - {x: 0.1205, y: 0.2775, z: 0.153}
    - {x: 0.1044, y: 0.2642, z: 0.1494}
    - {x: 0.086, y: 0.2541, z: 0.1446}
    - {x: 0.0668, y: 0.2496, z: 0.1395}
    - {x: 0.0504, y: 0.2506, z: 0.1347}
  pendingCases: []

```

## File: 認識テストケース収集/Data/認識テストケース.asset.meta

```meta
fileFormatVersion: 2
guid: 0937d4fddc30865478720b9e6ee722dc
NativeFormatImporter:
  externalObjects: {}
  mainObjectFileID: 11400000
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 認識テストケース収集/RecognitionCaptureTools.cs

```cs
#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using UnityEditor;
using UnityEngine;

public static class RecognitionCaptureTools {
	const string LogPrefix = "DRAW3D|v1|";
	const float CoordinateScale = 10000f;
	const string DataFolder = "Assets/MyAssets/Editor/認識テストケース収集/Data";
	const string DatabasePath = DataFolder + "/認識テストケース.asset";

	[MenuItem("Tools/MyWorld/認識テストケース収集/VRChatログから3Dケースを作成")]
	public static void ImportLog() {
		string logDirectory = Path.Combine(
			Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
			"AppData", "LocalLow", "VRChat", "VRChat");
		string logPath = EditorUtility.OpenFilePanel(
			"VRChatのoutput_logを選択",
			Directory.Exists(logDirectory) ? logDirectory : string.Empty,
			"txt");
		if (string.IsNullOrEmpty(logPath)) return;

		List<ParsedCapture> captures = ParseLog(logPath);
		RecognitionTestCaseDatabase database = LoadOrCreateDatabase();
		Undo.RecordObject(database, "Import recognition test cases");

		int addedCount = 0;
		int duplicateCount = 0;
		foreach (ParsedCapture capture in captures) {
			if (!capture.IsComplete) continue;

			// 同じ3D座標がすでにあれば、取り込み直しとして飛ばす
			if (database.Contains(capture.Positions)) {
				duplicateCount++;
				continue;
			}

			RecognitionTestCase testCase = new RecognitionTestCase(
				capture.SampleId,
				capture.CapturedShapeId,
				capture.ProjectionRight,
				capture.ProjectionUp,
				capture.ProjectionForward,
				capture.Positions);
			// 最初に認識した結果を、確認用の期待値の初期値にする
			testCase.ExpectedShapeId = testCase.CapturedShapeId;
			database.AddPending(testCase);
			addedCount++;
		}

		if (addedCount == 0 && duplicateCount == 0) {
			EditorUtility.DisplayDialog(
				"認識テストケース収集",
				"完全なDRAW3Dケースが見つかりませんでした。Udonデバッグを有効にして取得したログを選んでください。",
				"OK");
			return;
		}

		EditorUtility.SetDirty(database);
		AssetDatabase.SaveAssets();
		Selection.activeObject = database;
		EditorUtility.DisplayDialog(
			"認識テストケース収集",
			"確認待ちに" + addedCount + "件を追加しました（重複" + duplicateCount + "件はスキップ）。"
			+ "InspectorでShape IDを確認してから追加してください。",
			"OK");
	}

	static RecognitionTestCaseDatabase LoadOrCreateDatabase() {
		RecognitionTestCaseDatabase database =
			AssetDatabase.LoadAssetAtPath<RecognitionTestCaseDatabase>(DatabasePath);
		if (database != null) return database;

		EnsureFolder(DataFolder);
		database = ScriptableObject.CreateInstance<RecognitionTestCaseDatabase>();
		AssetDatabase.CreateAsset(database, DatabasePath);
		return database;
	}

	static List<ParsedCapture> ParseLog(string path) {
		Dictionary<string, ParsedCapture> byId = new Dictionary<string, ParsedCapture>();
		foreach (string line in File.ReadLines(path)) {
			int marker = line.IndexOf(LogPrefix, StringComparison.Ordinal);
			if (marker < 0) continue;

			string[] parts = line.Substring(marker).Trim().Split('|');
			if (parts.Length < 4 || parts[0] != "DRAW3D" || parts[1] != "v1") continue;

			if (parts[2] == "H") {
				if (parts.Length != 9) continue;
				int count;
				int shapeId;
				Vector3 right;
				Vector3 up;
				Vector3 forward;
				if (!int.TryParse(parts[5], NumberStyles.Integer, CultureInfo.InvariantCulture, out count)) continue;
				if (!int.TryParse(parts[4], NumberStyles.Integer, CultureInfo.InvariantCulture, out shapeId)) continue;
				if (!TryDecodeVector(parts[6], out right)
					|| !TryDecodeVector(parts[7], out up)
					|| !TryDecodeVector(parts[8], out forward)) continue;
				ParsedCapture capture = new ParsedCapture(
					parts[3], shapeId, count, right, up, forward);
				byId[parts[3]] = capture;
			}
			else if (parts[2] == "P") {
				if (parts.Length != 6) continue;
				ParsedCapture capture;
				int index;
				Vector3 point;
				if (!byId.TryGetValue(parts[3], out capture)) continue;
				if (!int.TryParse(parts[4], NumberStyles.Integer, CultureInfo.InvariantCulture, out index)) continue;
				if (!TryDecodeVector(parts[5], out point)) continue;
				capture.SetPoint(index, point);
			}
		}

		List<ParsedCapture> captures = new List<ParsedCapture>(byId.Values);
		captures.Sort((left, right) => {
			int leftId;
			int rightId;
			if (int.TryParse(left.SampleId, out leftId) && int.TryParse(right.SampleId, out rightId)) {
				return leftId.CompareTo(rightId);
			}
			return string.CompareOrdinal(left.SampleId, right.SampleId);
		});
		return captures;
	}

	static bool TryDecodeVector(string value, out Vector3 result) {
		result = Vector3.zero;
		string[] parts = value.Split(',');
		if (parts.Length != 3) return false;
		int x;
		int y;
		int z;
		if (!int.TryParse(parts[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out x)) return false;
		if (!int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out y)) return false;
		if (!int.TryParse(parts[2], NumberStyles.Integer, CultureInfo.InvariantCulture, out z)) return false;
		result = new Vector3(x / CoordinateScale, y / CoordinateScale, z / CoordinateScale);
		return true;
	}

	static void EnsureFolder(string path) {
		if (AssetDatabase.IsValidFolder(path)) return;
		string parent = Path.GetDirectoryName(path).Replace('\\', '/');
		string folderName = Path.GetFileName(path);
		EnsureFolder(parent);
		AssetDatabase.CreateFolder(parent, folderName);
	}

	class ParsedCapture {
		public string SampleId { get; }
		public int CapturedShapeId { get; }
		public Vector3 ProjectionRight { get; }
		public Vector3 ProjectionUp { get; }
		public Vector3 ProjectionForward { get; }
		public Vector3[] Positions { get; }
		readonly bool[] _received;
		int _receivedCount;
		public bool IsComplete => Positions.Length >= 2 && _receivedCount == Positions.Length;

		public ParsedCapture(
			string sampleId,
			int capturedShapeId,
			int pointCount,
			Vector3 right,
			Vector3 up,
			Vector3 forward) {
			SampleId = sampleId;
			CapturedShapeId = capturedShapeId;
			ProjectionRight = right;
			ProjectionUp = up;
			ProjectionForward = forward;
			Positions = new Vector3[Mathf.Max(0, pointCount)];
			_received = new bool[Positions.Length];
		}

		public void SetPoint(int index, Vector3 point) {
			if (index < 0 || index >= Positions.Length) return;
			if (!_received[index]) _receivedCount++;
			_received[index] = true;
			Positions[index] = point;
		}
	}
}
#endif

```

## File: 認識テストケース収集/RecognitionTestCaseDatabase.cs

```cs
using System;
using UnityEngine;

[Serializable]
public class RecognitionTestCase {
	[SerializeField] string captureId;
	[SerializeField] int capturedShapeId = -1;
	[SerializeField] int expectedShapeId = -1;
	[SerializeField] int replayedShapeId = -1;
	[SerializeField] Vector3 projectionRight;
	[SerializeField] Vector3 projectionUp;
	[SerializeField] Vector3 projectionForward;
	[SerializeField] Vector3[] rawPositions = new Vector3[0];

	public string CaptureId => captureId;
	public int CapturedShapeId => capturedShapeId;
	public int ExpectedShapeId { get => expectedShapeId; set => expectedShapeId = value; }
	public int ReplayedShapeId => replayedShapeId;
	public Vector3 ProjectionRight => projectionRight;
	public Vector3 ProjectionUp => projectionUp;
	public Vector3 ProjectionForward => projectionForward;
	public Vector3[] RawPositions => rawPositions;

	public RecognitionTestCase(
		string id,
		int recognizedShapeId,
		Vector3 right,
		Vector3 up,
		Vector3 forward,
		Vector3[] positions) {
		captureId = id;
		capturedShapeId = recognizedShapeId;
		projectionRight = right;
		projectionUp = up;
		projectionForward = forward;
		rawPositions = positions;
	}

	public void SetReplayResult(int shapeId) {
		replayedShapeId = shapeId;
	}
}

[CreateAssetMenu(
	fileName = "認識テストケース",
	menuName = "MyWorld/認識テストケース収集/ケースデータ")]
public class RecognitionTestCaseDatabase : ScriptableObject {
	[SerializeField] RecognitionTestCase[] cases = new RecognitionTestCase[0];
	[SerializeField] RecognitionTestCase[] pendingCases = new RecognitionTestCase[0];
	public RecognitionTestCase[] Cases => cases;
	public RecognitionTestCase[] PendingCases => pendingCases;

	public void SetCases(RecognitionTestCase[] values) {
		cases = values;
	}

	// 同じ3D座標のケースが、確定済みか確認待ちにすでにあるか
	public bool Contains(Vector3[] positions) {
		return ContainsIn(cases, positions) || ContainsIn(pendingCases, positions);
	}

	public void AddPending(RecognitionTestCase testCase) {
		Array.Resize(ref pendingCases, pendingCases.Length + 1);
		pendingCases[pendingCases.Length - 1] = testCase;
	}

	// 確認待ちのケースを確定済みへ移す
	public void ConfirmPending(int index) {
		Array.Resize(ref cases, cases.Length + 1);
		cases[cases.Length - 1] = pendingCases[index];
		DiscardPending(index);
	}

	public void DiscardPending(int index) {
		for (int i = index; i < pendingCases.Length - 1; i++) {
			pendingCases[i] = pendingCases[i + 1];
		}
		Array.Resize(ref pendingCases, pendingCases.Length - 1);
	}

	static bool ContainsIn(RecognitionTestCase[] list, Vector3[] positions) {
		foreach (RecognitionTestCase testCase in list) {
			if (SamePositions(testCase.RawPositions, positions)) return true;
		}
		return false;
	}

	static bool SamePositions(Vector3[] left, Vector3[] right) {
		if (left.Length != right.Length) return false;

		for (int i = 0; i < left.Length; i++) {
			if (left[i] != right[i]) return false;
		}
		return true;
	}
}

```

## File: 認識テストケース収集/RecognitionTestCaseDatabaseEditor.cs

```cs
#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

[CustomEditor(typeof(RecognitionTestCaseDatabase))]
public class RecognitionTestCaseDatabaseEditor : Editor {
	const float PreviewSize = 90f;
	const int All = -2;

	// [0]が未設定、[id + 1]が各期待IDのグループの開閉
	bool[] _groupOpen;
	bool[] GroupOpen {
		get {
			if (_groupOpen != null) return _groupOpen;

			_groupOpen = new bool[ShapeTemplates.Count + 1];
			// 未設定は期待値の入力が必要なので、最初から開いておく
			_groupOpen[0] = true;
			return _groupOpen;
		}
	}

	public override void OnInspectorGUI() {
		serializedObject.Update();
		RecognitionTestCaseDatabase database = (RecognitionTestCaseDatabase)target;
		SerializedProperty casesProperty = serializedObject.FindProperty("cases");
		SerializedProperty pendingProperty = serializedObject.FindProperty("pendingCases");

		// -1は操作なし、Allは全件、0以上は該当ケース
		int confirmIndex = -1;
		int discardIndex = -1;
		int deleteIndex = -1;
		DrawPending(database, pendingProperty, ref confirmIndex, ref discardIndex);

		// 未設定(-1)を先頭に、期待IDの順にグループを並べる
		for (int expectedId = -1; expectedId < ShapeTemplates.Count; expectedId++) {
			DrawGroup(database, casesProperty, expectedId, ref deleteIndex);
		}

		// 配列を変更する操作は、描画をすべて終えてから適用する
		if (deleteIndex >= 0) {
			casesProperty.DeleteArrayElementAtIndex(deleteIndex);
			serializedObject.ApplyModifiedProperties();
			GUIUtility.ExitGUI();
		}
		serializedObject.ApplyModifiedProperties();

		EditorGUILayout.Space();
		using (new EditorGUI.DisabledScope(database.Cases.Length == 0)) {
			if (GUILayout.Button("3D生データから全ケースを再認識")) ReplayAll(database);
		}

		// 配列を変える操作は、描画をすべて終えてから行う
		ApplyPendingAction(database, confirmIndex, discardIndex);
	}

	static void DrawPending(
		RecognitionTestCaseDatabase database,
		SerializedProperty pendingProperty,
		ref int confirmIndex,
		ref int discardIndex) {
		if (database.PendingCases.Length == 0) return;

		using (new EditorGUILayout.HorizontalScope()) {
			EditorGUILayout.LabelField(
				"確認待ち  " + database.PendingCases.Length + "件", EditorStyles.boldLabel);
			if (GUILayout.Button("すべて追加", GUILayout.Width(80f))) confirmIndex = All;
			if (GUILayout.Button("すべて破棄", GUILayout.Width(80f))) discardIndex = All;
		}

		for (int i = 0; i < database.PendingCases.Length; i++) {
			DrawCase(database.PendingCases[i], pendingProperty.GetArrayElementAtIndex(i), false);

			using (new EditorGUILayout.HorizontalScope()) {
				if (GUILayout.Button("追加")) confirmIndex = i;
				if (GUILayout.Button("破棄")) discardIndex = i;
			}
		}
		EditorGUILayout.Space();
	}

	static void ApplyPendingAction(
		RecognitionTestCaseDatabase database,
		int confirmIndex,
		int discardIndex) {
		if (confirmIndex == -1 && discardIndex == -1) return;

		Undo.RecordObject(database, "Update recognition test cases");
		if (confirmIndex == All) {
			while (database.PendingCases.Length > 0) database.ConfirmPending(0);
		}
		else if (confirmIndex >= 0) {
			database.ConfirmPending(confirmIndex);
		}
		else if (discardIndex == All) {
			while (database.PendingCases.Length > 0) database.DiscardPending(0);
		}
		else {
			database.DiscardPending(discardIndex);
		}
		EditorUtility.SetDirty(database);
		GUIUtility.ExitGUI();
	}

	void DrawGroup(
		RecognitionTestCaseDatabase database,
		SerializedProperty casesProperty,
		int expectedId,
		ref int deleteIndex) {
		int count = 0;
		int mismatchCount = 0;
		for (int i = 0; i < database.Cases.Length; i++) {
			RecognitionTestCase testCase = database.Cases[i];
			if (testCase.ExpectedShapeId != expectedId) continue;

			count++;
			if (IsMismatch(testCase)) mismatchCount++;
		}
		if (count == 0) return;

		string title = (expectedId < 0 ? "未設定" : ShapeLabel(expectedId)) + "  " + count + "件";
		if (mismatchCount > 0) title += "  / 不一致 " + mismatchCount + "件";

		int index = expectedId + 1;
		GroupOpen[index] = EditorGUILayout.Foldout(GroupOpen[index], title, true);
		if (!GroupOpen[index]) return;

		for (int i = 0; i < database.Cases.Length; i++) {
			if (database.Cases[i].ExpectedShapeId != expectedId) continue;

			if (DrawCase(database.Cases[i], casesProperty.GetArrayElementAtIndex(i), true)) {
				deleteIndex = i;
			}
		}
	}

	static bool DrawCase(
		RecognitionTestCase testCase,
		SerializedProperty caseProperty,
		bool showReplay) {
		SerializedProperty expectedProperty = caseProperty.FindPropertyRelative("expectedShapeId");

		using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox)) {
			using (new EditorGUILayout.HorizontalScope()) {
				DrawPreview("手書き", GetStrokePoints(testCase));

				using (new EditorGUILayout.VerticalScope()) {
					expectedProperty.intValue = ShapePopup("期待", expectedProperty.intValue);
					EditorGUILayout.LabelField("取得時", ShapeLabel(testCase.CapturedShapeId));
					if (showReplay) {
						DrawReplayResult(testCase);
						if (GUILayout.Button("削除", GUILayout.Width(60f))) return true;
					}
				}
			}
		}
		return false;
	}

	static bool IsMismatch(RecognitionTestCase testCase) {
		return testCase.ExpectedShapeId >= 0
			&& testCase.ReplayedShapeId != testCase.ExpectedShapeId;
	}

	static void DrawReplayResult(RecognitionTestCase testCase) {
		Color previous = GUI.contentColor;
		if (IsMismatch(testCase)) GUI.contentColor = Color.red;
		EditorGUILayout.LabelField("再認識", ShapeLabel(testCase.ReplayedShapeId));
		GUI.contentColor = previous;
	}

	static int ShapePopup(string label, int shapeId) {
		string[] options = new string[ShapeTemplates.Count + 1];
		options[0] = "未設定";
		for (int id = 0; id < ShapeTemplates.Count; id++) {
			options[id + 1] = ShapeLabel(id);
		}
		return EditorGUILayout.Popup(label, shapeId + 1, options) - 1;
	}

	static string ShapeLabel(int shapeId) {
		if (shapeId < 0 || shapeId >= ShapeTemplates.Count) return "なし";

		// "/" はプルダウンでサブメニューの区切りになるため、全角にする
		return "ID" + shapeId + ":"
			+ ShapeTemplates.GetShapeName(shapeId).Replace('/', '／');
	}

	static void DrawPreview(string title, Vector2[] points) {
		using (new EditorGUILayout.VerticalScope(GUILayout.Width(PreviewSize))) {
			EditorGUILayout.LabelField(title, GUILayout.Width(PreviewSize));
			Rect rect = GUILayoutUtility.GetRect(PreviewSize, PreviewSize);
			EditorGUI.DrawRect(rect, new Color(0.15f, 0.15f, 0.15f));
			if (points == null || points.Length < 2 || Event.current.type != EventType.Repaint) return;

			// 点は -0.5〜0.5 に収めてあるので枠の内側へ置く（画面のYは下向きなので反転）
			Vector3[] line = new Vector3[points.Length];
			for (int i = 0; i < points.Length; i++) {
				line[i] = new Vector3(
					rect.center.x + points[i].x * PreviewSize * 0.8f,
					rect.center.y - points[i].y * PreviewSize * 0.8f,
					0f);
			}
			Handles.color = Color.white;
			Handles.DrawAAPolyLine(2f, line);
		}
	}

	// 手書きの3D座標を、描画面（右・上）へ投影して -0.5〜0.5 に収める
	static Vector2[] GetStrokePoints(RecognitionTestCase testCase) {
		Vector3[] positions = testCase.RawPositions;
		Vector2[] projected = new Vector2[positions.Length];
		Vector2 min = new Vector2(float.MaxValue, float.MaxValue);
		Vector2 max = new Vector2(float.MinValue, float.MinValue);

		for (int i = 0; i < positions.Length; i++) {
			projected[i] = new Vector2(
				Vector3.Dot(positions[i], testCase.ProjectionRight),
				Vector3.Dot(positions[i], testCase.ProjectionUp));
			min = Vector2.Min(min, projected[i]);
			max = Vector2.Max(max, projected[i]);
		}

		Vector2 center = (min + max) * 0.5f;
		float extent = Mathf.Max(max.x - min.x, max.y - min.y);
		if (extent <= 0f) extent = 1f;

		for (int i = 0; i < projected.Length; i++) {
			projected[i] = (projected[i] - center) / extent;
		}
		return projected;
	}

	static void ReplayAll(RecognitionTestCaseDatabase database) {
		Undo.RecordObject(database, "Replay recognition test cases");
		int matchedExpected = 0;
		int expectedCount = 0;
		foreach (RecognitionTestCase testCase in database.Cases) {
			Vector3 center = Vector3.zero;
			float size = 0f;
			Vector2[] normalized = null;
			int result = StrokeRecognizer.Recognize(
				testCase.RawPositions,
				testCase.ProjectionRight,
				testCase.ProjectionUp,
				ref center,
				ref size,
				ref normalized);
			testCase.SetReplayResult(result);
			if (testCase.ExpectedShapeId < 0) continue;
			expectedCount++;
			if (result == testCase.ExpectedShapeId) matchedExpected++;
		}

		EditorUtility.SetDirty(database);
		AssetDatabase.SaveAssets();
		Debug.Log(
			"[認識テストケース収集] " + database.Cases.Length
			+ "件を再認識しました。期待ID設定済み: " + expectedCount
			+ "件、一致: " + matchedExpected + "件。",
			database);
	}
}
#endif

```

## File: 認識テストケース収集/RecognitionCaptureTools.cs.meta

```meta
fileFormatVersion: 2
guid: 10ce44ca04017a245ad73c1fa4ff9607
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 認識テストケース収集/RecognitionTestCaseDatabase.cs.meta

```meta
fileFormatVersion: 2
guid: 682d4e9b508507e4d8460aec1784b434
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 認識テストケース収集/RecognitionTestCaseDatabaseEditor.cs.meta

```meta
fileFormatVersion: 2
guid: ddb9aaf6977597d4aa5c8e5e9b8bbc10
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 認識テストケース収集/Data.meta

```meta
fileFormatVersion: 2
guid: 78d3ee17f40c1564ca218acb02ab881e
folderAsset: yes
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 浮島ジェネレーター/FloatingIslandGeneratorWindow.cs

```cs
using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

// Editorフォルダー内でのみ動作。生成したPrefabにはスクリプトを付けない。
public class FloatingIslandGeneratorWindow : EditorWindow {
    [SerializeField] FloatingIslandSettings settings = new FloatingIslandSettings();
    [SerializeField] GameObject lastPrefab;
    [SerializeField] bool showDetails;
    Vector2 scroll;
    Editor previewEditor;

    [MenuItem("Tools/MyWorld/浮島ジェネレーター")]
    public static void Open() {
        var window = GetWindow<FloatingIslandGeneratorWindow>("浮島ジェネレーター");
        window.minSize = new Vector2(360f, 620f);
    }

    void OnGUI() {
        scroll = EditorGUILayout.BeginScrollView(scroll);
        EditorGUILayout.LabelField("ローポリの浮島", EditorStyles.boldLabel);
        EditorGUILayout.HelpBox(
            "角の丸みと地面の起伏を調整できる浮島を生成します。単位はm。"
            + "生成だけではシーンへ配置しません。", MessageType.Info);
        if (GUILayout.Button("生成設定をリセット")) ResetSettings();
        settings.islandName = EditorGUILayout.TextField("島の名前", settings.islandName);
        bool validIsland = true;
        string islandFolder = null;
        try {
            islandFolder = FloatingIslandMeshGenerator.GetIslandFolder(settings.islandName);
        } catch (ArgumentException exception) {
            EditorGUILayout.HelpBox(exception.Message, MessageType.Error);
            validIsland = false;
        }

        EditorGUILayout.Space();
        EditorGUILayout.LabelField("大きさ・厚み", EditorStyles.boldLabel);
        settings.width = EditorGUILayout.Slider("幅", settings.width, 2f, 50f);
        settings.depth = EditorGUILayout.Slider("奥行き", settings.depth, 2f, 50f);
        settings.thickness = EditorGUILayout.Slider("岩の厚み", settings.thickness, 0.5f, 20f);
        settings.grassDepth = EditorGUILayout.Slider("草地の厚み", settings.grassDepth, 0.05f, 0.5f);
        EditorGUILayout.Space();
        EditorGUILayout.LabelField("形・地面", EditorStyles.boldLabel);
        settings.segments = EditorGUILayout.IntSlider(new GUIContent("島の細かさ",
            "輪郭と地面の分割をまとめて調整します。大きいほどポリゴンが増えます。"), settings.segments, 6, 40);
        settings.roughness = EditorGUILayout.Slider("輪郭の凹凸", settings.roughness, 0f, 0.35f);
        settings.cornerRounding = EditorGUILayout.Slider("輪郭の角の丸み", settings.cornerRounding, 0f, 1f);
        settings.surfaceHeight = EditorGUILayout.Slider("起伏の高さ", settings.surfaceHeight,
            0f, Mathf.Min(2f, settings.thickness * 0.2f));
        using (new EditorGUI.DisabledScope(settings.surfaceHeight == 0f)) {
            float intensity = EditorGUILayout.Slider(new GUIContent("起伏の激しさ",
                "大きいほど横方向の間隔が狭まり、細かく波打ちます。高低差は「起伏の高さ」で調整します。"),
                11f - settings.surfaceScale, 1f, 10f);
            settings.surfaceScale = 11f - intensity;
        }
        showDetails = EditorGUILayout.Foldout(showDetails, "詳細設定", true);
        if (showDetails) {
            EditorGUI.indentLevel++;
            settings.surfacePointJitter = EditorGUILayout.Slider("地面の頂点のばらつき", settings.surfacePointJitter, 0f, 0.35f);
            settings.grassInset = EditorGUILayout.Slider("草地の縁を凹ませる幅", settings.grassInset,
                0f, Mathf.Min(1f, Mathf.Min(settings.width, settings.depth) * 0.15f));
            settings.grassThicknessVariation = EditorGUILayout.Slider("草地の厚みのばらつき",
                settings.grassThicknessVariation, 0f, 0.8f);
            settings.seed = EditorGUILayout.IntField("乱数シード", settings.seed);
            EditorGUI.indentLevel--;
        }
        if (GUILayout.Button("別のシードにする（未生成）")) {
            settings.seed = Guid.NewGuid().GetHashCode();
        }
        bool validMaterial = DrawMaterialSettings();

        EditorGUILayout.Space();
        EditorGUILayout.LabelField("保存先", islandFolder ?? FloatingIslandMeshGenerator.OutputFolder);
        if (validIsland && AssetDatabase.LoadAssetAtPath<GameObject>(islandFolder + "/Island.prefab") != null) {
            EditorGUILayout.HelpBox("同名の島を上書きします。配置済みの同じPrefabにも反映されます。", MessageType.Info);
        }
        using (new EditorGUI.DisabledScope(!validIsland || !validMaterial || EditorApplication.isPlayingOrWillChangePlaymode
                || EditorApplication.isCompiling)) {
            if (GUILayout.Button("この設定で生成／同名の島を更新", GUILayout.Height(30f))) {
                try {
                    lastPrefab = FloatingIslandMeshGenerator.CreatePrefab(settings);
                    ResetPreview();
                    EditorGUIUtility.PingObject(lastPrefab);
                } catch (Exception exception) {
                    Debug.LogException(exception);
                    EditorUtility.DisplayDialog("浮島の生成に失敗", exception.Message, "閉じる");
                }
            }
        }

        if (lastPrefab != null) {
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("最後に生成した島（設定変更後は再生成）", EditorStyles.boldLabel);
            EditorGUILayout.ObjectField("Prefab", lastPrefab, typeof(GameObject), false);
            MeshFilter filter = lastPrefab.GetComponent<MeshFilter>();
            if (filter != null && filter.sharedMesh != null && filter.sharedMesh.subMeshCount == 2) {
                using (new EditorGUI.DisabledScope(!validMaterial || EditorApplication.isPlayingOrWillChangePlaymode
                        || EditorApplication.isCompiling)) {
                    if (GUILayout.Button("この旧Prefabを1マテリアルに変換")) {
                        try {
                            FloatingIslandMeshGenerator.UpgradePrefab(lastPrefab, settings.materialName);
                            ResetPreview();
                        } catch (Exception exception) {
                            Debug.LogException(exception);
                            EditorUtility.DisplayDialog("浮島の変換に失敗", exception.Message, "閉じる");
                        }
                    }
                }
            }
            if (previewEditor == null) previewEditor = Editor.CreateEditor(lastPrefab);
            Rect previewRect = GUILayoutUtility.GetRect(240f, 260f, GUILayout.ExpandWidth(true));
            if (previewEditor.HasPreviewGUI()) {
                previewEditor.OnInteractivePreviewGUI(previewRect, GUIStyle.none);
            }
            EditorGUILayout.HelpBox(
                "プレビューをドラッグすると回転できます。Prefab欄からHierarchyへ"
                + "ドラッグして配置してください。同じ島の名前で再生成すると上書きします。",
                MessageType.Info);
        }
        EditorGUILayout.EndScrollView();
    }

    void OnDisable() {
        ResetPreview();
    }

    void ResetSettings() {
        Undo.RecordObject(this, "浮島の生成設定をリセット");
        settings = new FloatingIslandSettings();
        Repaint();
    }

    bool DrawMaterialSettings() {
        EditorGUILayout.Space();
        settings.grassColor = EditorGUILayout.ColorField("草地の色", settings.grassColor);
        settings.rockColor = EditorGUILayout.ColorField("岩の色", settings.rockColor);
        EditorGUILayout.LabelField("共有マテリアル", "LowPolyVertexColor");
        EditorGUILayout.HelpBox("色はMeshの頂点へ保存します。色を変えた後は再生成してください。", MessageType.Info);
        return true;
    }

    void ResetPreview() {
        if (previewEditor != null) DestroyImmediate(previewEditor);
        previewEditor = null;
    }
}

[Serializable]
public class FloatingIslandSettings {
    public string islandName = "Island";
    public float width = 12f;
    public float depth = 10f;
    public float thickness = 4.5f;
    public int segments = 14;
    public float roughness = 0.18f;
    public float cornerRounding = 0.5f;
    public float surfaceHeight = 0.2f;
    public float surfaceScale = 3f;
    public float surfacePointJitter = 0.2f;
    public float grassDepth = 0.2f;
    public float grassInset = 0.15f;
    public float grassThicknessVariation = 0.3f;
    public int seed = 12345;
    public string materialName = "Island_Default";
    public Color grassColor = new Color(0.66f, 0.78f, 0.20f);
    public Color rockColor = new Color(0.48f, 0.32f, 0.19f);
}

public static class FloatingIslandMeshGenerator {
    public const string OutputFolder = "Assets/MyAssets/Generated/FloatingIslands";
    public const string SharedMaterialsFolder = OutputFolder + "/SharedMaterials";
    public const string ShaderPath = "Assets/MyAssets/GameObjects/SharedMaterials/LowPolyVertexColor.shader";

    public static Mesh BuildMesh(FloatingIslandSettings settings) {
        Validate(settings);
        var random = new System.Random(settings.seed);
        var originalOutline = CreateOutline(settings, random);
        Vector3 min = originalOutline[0], max = originalOutline[0];
        foreach (Vector3 point in originalOutline) { min = Vector3.Min(min, point); max = Vector3.Max(max, point); }
        // 輪郭の平均的な辺の長さへ地面の密度を合わせる。
        float outlineLength = 0f;
        for (int i = 0; i < originalOutline.Length; i++) {
            outlineLength += Vector3.Distance(originalOutline[i], originalOutline[(i + 1) % originalOutline.Length]);
        }
        // 極端な縦横比でも過密になりすぎないよう、長辺を約48分割までに抑える。
        float spacing = Mathf.Max(outlineLength / settings.segments, Mathf.Max(max.x - min.x, max.z - min.z) / 48f);
        var outline = ResampleOutline(originalOutline, spacing);
        int count = outline.Length;
        var top = new Vector3[count];
        var shoulder = new Vector3[count];
        var grassBottom = new Vector3[count];
        var middle = new Vector3[count];
        var lower = new Vector3[count];
        float grassDepth = Mathf.Min(settings.grassDepth,
            settings.thickness * 0.2f / (1f + settings.grassThicknessVariation));

        var surfaceRandom = new System.Random(settings.seed ^ 0x5f3759df);
        var offset = new Vector2(Range(surfaceRandom, 64f, 1024f), Range(surfaceRandom, 64f, 1024f));
        float centerNoise = Mathf.PerlinNoise(offset.x, offset.y);
        var grassRandom = new System.Random(settings.seed ^ 0x36b84a1d);
        var boundary = new List<Vector2>();
        for (int i = 0; i < count; i++) {
            float radius = new Vector2(outline[i].x, outline[i].z).magnitude;
            float inset = Mathf.Min(settings.grassInset, radius * 0.4f);
            top[i] = outline[i] * (1f - inset / radius);
            top[i].y = SurfaceHeight(top[i], settings, offset, centerNoise);
            boundary.Add(new Vector2(top[i].x, top[i].z));
            float localDepth = grassDepth * Range(grassRandom,
                1f - settings.grassThicknessVariation, 1f + settings.grassThicknessVariation);
            // 四分円の中間点に相当する肩を作り、上端の凹みから外周へ丸く下ろす。
            shoulder[i] = outline[i] * (1f - inset * 0.29289322f / radius);
            shoulder[i].y = top[i].y - localDepth * 0.29289322f;
            grassBottom[i] = outline[i];
            grassBottom[i].y = top[i].y - localDepth;
            // 横方向は段ごとに一定の割合で絞り、局所的な膨らみをなくす。
            middle[i] = outline[i] * 0.85f;
            middle[i].y = Mathf.Lerp(grassBottom[i].y, -settings.thickness, Range(random, 0.35f, 0.5f));
            lower[i] = outline[i] * 0.45f;
            lower[i].y = Mathf.Lerp(grassBottom[i].y, -settings.thickness, Range(random, 0.72f, 0.84f));
        }
        var tip = new Vector3(
            settings.width * Range(random, -0.04f, 0.04f),
            -settings.thickness,
            settings.depth * Range(random, -0.04f, 0.04f));

        var vertices = new List<Vector3>();
        var grassTriangles = new List<int>();
        var rockTriangles = new List<int>();
        // 三角格子の点を輪郭内へ配置して分割。中央や同心リングには依存しない。
        List<Vector2> surfacePoints;
        List<int> surfaceTriangles = FloatingIslandSurfaceTriangulator.Triangulate(
            boundary, spacing, settings.surfacePointJitter, settings.seed, out surfacePoints);
        var surface = new Vector3[surfacePoints.Count];
        for (int i = 0; i < surface.Length; i++) {
            surface[i] = i < count ? top[i] : new Vector3(surfacePoints[i].x, 0f, surfacePoints[i].y);
            if (i >= count) surface[i].y = SurfaceHeight(surface[i], settings, offset, centerNoise);
        }
        for (int i = 0; i < surfaceTriangles.Count; i += 3) {
            // 2Dの反時計回りから、Unityの上向きの面へ並べ替える。
            AddTriangle(surface[surfaceTriangles[i]], surface[surfaceTriangles[i + 2]],
                surface[surfaceTriangles[i + 1]], vertices, grassTriangles);
        }
        for (int i = 0; i < count; i++) {
            int next = (i + 1) % count;
            AddBand(top, shoulder, i, next, vertices, grassTriangles);
            AddBand(shoulder, grassBottom, i, next, vertices, grassTriangles);
            AddBand(grassBottom, middle, i, next, vertices, rockTriangles);
            AddBand(middle, lower, i, next, vertices, rockTriangles);
            AddTriangle(lower[i], lower[next], tip, vertices, rockTriangles);
        }

        var mesh = new Mesh { name = "FloatingIslandMesh" };
        mesh.SetVertices(vertices);
        mesh.subMeshCount = 2;
        mesh.SetTriangles(grassTriangles, 0);
        mesh.SetTriangles(rockTriangles, 1);
        SetSurfaceMaskAndSingleSubmesh(mesh);
        LowPolyVertexColorUtility.BakeIslandMask(mesh, settings.grassColor, settings.rockColor);
        // 面ごとに独立した頂点を使い、角張った陰影にする。
        mesh.RecalculateNormals();
        mesh.RecalculateBounds();
        return mesh;
    }

    static Vector3[] ResampleOutline(Vector3[] outline, float spacing) {
        var result = new List<Vector3>();
        for (int i = 0; i < outline.Length; i++) {
            Vector3 a = outline[i], b = outline[(i + 1) % outline.Length];
            int steps = Mathf.Max(1, Mathf.CeilToInt(Vector3.Distance(a, b) / spacing));
            for (int step = 0; step < steps; step++) result.Add(Vector3.Lerp(a, b, (float)step / steps));
        }
        return result.ToArray();
    }

    static Vector3[] CreateOutline(FloatingIslandSettings settings, System.Random random) {
        int count = settings.segments;
        var outline = new Vector3[count];
        for (int i = 0; i < count; i++) {
            float angle = (i + Range(random, -0.15f, 0.15f)) * Mathf.PI * 2f / count;
            float radius = 1f + Range(random, -settings.roughness, settings.roughness);
            outline[i] = new Vector3(Mathf.Cos(angle) * settings.width * 0.5f * radius,
                0f, Mathf.Sin(angle) * settings.depth * 0.5f * radius);
        }
        if (settings.cornerRounding == 0f) return outline;

        // 辺の中点を追加し、隣接点との平均へ寄せて角を内側へならす。
        // 隣接点の範囲でならし、新たに外へ向けたトゲは追加しない。
        var rounded = new Vector3[count * 2];
        for (int i = 0; i < count; i++) {
            rounded[i * 2] = outline[i];
            rounded[i * 2 + 1] = (outline[i] + outline[(i + 1) % count]) * 0.5f;
        }
        for (int pass = 0; pass < 2; pass++) {
            var next = new Vector3[rounded.Length];
            for (int i = 0; i < rounded.Length; i++) {
                Vector3 average = (rounded[(i + rounded.Length - 1) % rounded.Length]
                    + rounded[i] * 2f + rounded[(i + 1) % rounded.Length]) * 0.25f;
                next[i] = Vector3.Lerp(rounded[i], average, settings.cornerRounding);
            }
            rounded = next;
        }
        return rounded;
    }

    static float SurfaceHeight(Vector3 point, FloatingIslandSettings settings,
            Vector2 offset, float centerNoise) {
        if (settings.surfaceHeight == 0f) return 0f;
        float noise = Mathf.PerlinNoise(point.x / settings.surfaceScale + offset.x,
            point.z / settings.surfaceScale + offset.y);
        // ピボット直上は高さ0。指定値は基準面からの上下変位の上限。
        return Mathf.Clamp((noise - centerNoise) * 2f, -1f, 1f) * settings.surfaceHeight;
    }

    public static GameObject CreatePrefab(FloatingIslandSettings settings) {
        Validate(settings);
        string folder = GetIslandFolder(settings.islandName);
        string prefabPath = folder + "/Island.prefab";
        GameObject existingPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath);
        if (existingPrefab == null && (System.IO.File.Exists(prefabPath) || System.IO.Directory.Exists(prefabPath))) {
            throw new InvalidOperationException("保存先にPrefab以外のファイル等があります: " + prefabPath);
        }
        bool createdFolder = !AssetDatabase.IsValidFolder(folder);
        if (createdFolder && (System.IO.File.Exists(folder) || System.IO.Directory.Exists(folder))) {
            throw new InvalidOperationException("島の保存先をフォルダーとして使用できません: " + folder);
        }

        Scene previewScene = default;
        GameObject root = null;
        Mesh mesh = null;
        Mesh savedMesh = null;
        Mesh backup = null;
        string meshPath = folder + "/IslandMesh.asset";
        bool createdMesh = false;
        bool completed = false;
        try {
            mesh = BuildMesh(settings);
            if (existingPrefab != null) {
                // 元の階層・コンポーネントIDを維持し、子や手動設定は残す。
                root = PrefabUtility.LoadPrefabContents(prefabPath);
            } else {
                previewScene = EditorSceneManager.NewPreviewScene();
                root = EditorUtility.CreateGameObjectWithHideFlags(
                    settings.islandName.Trim(), HideFlags.HideAndDontSave);
                SceneManager.MoveGameObjectToScene(root, previewScene);
                root.hideFlags = HideFlags.None;
                root.isStatic = true;
            }
            root.name = System.IO.Path.GetFileName(folder);
            var filter = root.GetComponent<MeshFilter>();
            if (filter == null) filter = root.AddComponent<MeshFilter>();
            var renderer = root.GetComponent<MeshRenderer>();
            if (renderer == null) renderer = root.AddComponent<MeshRenderer>();
            var collider = root.GetComponent<MeshCollider>();
            if (collider == null) collider = root.AddComponent<MeshCollider>();

            // 旧版を変換したMeshも、その島フォルダー内にあれば参照先で更新する。
            if (filter.sharedMesh != null && AssetDatabase.IsMainAsset(filter.sharedMesh)) {
                string currentPath = AssetDatabase.GetAssetPath(filter.sharedMesh);
                if (System.IO.Path.GetDirectoryName(currentPath).Replace('\\', '/') == folder) {
                    meshPath = currentPath;
                }
            }
            savedMesh = AssetDatabase.LoadAssetAtPath<Mesh>(meshPath);
            if (savedMesh == null && (System.IO.File.Exists(meshPath) || System.IO.Directory.Exists(meshPath))) {
                throw new InvalidOperationException("保存先にMesh以外のファイル等があります: " + meshPath);
            }
            Material material = GetSharedMaterial(settings.materialName, settings.grassColor, settings.rockColor);
            EnsureFolder(folder);
            mesh.name = System.IO.Path.GetFileNameWithoutExtension(meshPath);
            if (savedMesh != null) {
                backup = UnityEngine.Object.Instantiate(savedMesh);
                CopyMeshData(mesh, savedMesh);
                EditorUtility.SetDirty(savedMesh);
                AssetDatabase.SaveAssetIfDirty(savedMesh);
            } else {
                savedMesh = mesh;
                AssetDatabase.CreateAsset(savedMesh, meshPath);
                createdMesh = true;
            }
            AssetDatabase.ImportAsset(meshPath, ImportAssetOptions.ForceUpdate);
            savedMesh = AssetDatabase.LoadAssetAtPath<Mesh>(meshPath);
            filter.sharedMesh = savedMesh;
            renderer.sharedMaterials = new[] { material };
            collider.sharedMesh = null;
            collider.sharedMesh = savedMesh;
            GameObject prefab = PrefabUtility.SaveAsPrefabAsset(root, prefabPath);
            if (prefab == null) throw new InvalidOperationException("Prefabの保存に失敗しました。");
            completed = true;
            RefreshMeshColliders(savedMesh);
            return prefab;
        } catch {
            if (!completed) {
                if (backup != null && savedMesh != null) {
                    CopyMeshData(backup, savedMesh);
                    EditorUtility.SetDirty(savedMesh);
                    AssetDatabase.SaveAssetIfDirty(savedMesh);
                    AssetDatabase.ImportAsset(meshPath, ImportAssetOptions.ForceUpdate);
                }
                if (createdFolder && AssetDatabase.IsValidFolder(folder)) AssetDatabase.DeleteAsset(folder);
                else if (createdMesh) AssetDatabase.DeleteAsset(meshPath);
            }
            throw;
        } finally {
            if (existingPrefab != null && root != null) PrefabUtility.UnloadPrefabContents(root);
            else if (previewScene.IsValid()) EditorSceneManager.ClosePreviewScene(previewScene);
            if (mesh != null && !AssetDatabase.Contains(mesh)) UnityEngine.Object.DestroyImmediate(mesh);
            if (backup != null) UnityEngine.Object.DestroyImmediate(backup);
        }
    }

    static void CopyMeshData(Mesh source, Mesh destination) {
        // シリアライズデータだけでなく、描画用バッファも更新する。
        destination.Clear(false);
        destination.indexFormat = source.indexFormat;
        destination.name = source.name;
        destination.vertices = source.vertices;
        destination.normals = source.normals;
        destination.colors32 = source.colors32;
        destination.subMeshCount = source.subMeshCount;
        for (int i = 0; i < source.subMeshCount; i++) {
            destination.SetTriangles(source.GetTriangles(i), i, false);
        }
        destination.RecalculateBounds();
        destination.UploadMeshData(false);
    }

    static void RefreshMeshColliders(Mesh mesh) {
        // 同じMesh参照を保った更新では、配置済みColliderの再構築も明示する。
        foreach (var collider in Resources.FindObjectsOfTypeAll<MeshCollider>()) {
            if (collider == null || EditorUtility.IsPersistent(collider)
                    || !collider.gameObject.scene.IsValid() || collider.sharedMesh != mesh) continue;
            collider.sharedMesh = null;
            collider.sharedMesh = mesh;
        }
    }

    public static string GetIslandFolder(string islandName) {
        string name = ValidateAssetName(islandName, "島の名前");
        if (string.Equals(name, "SharedMaterials", StringComparison.OrdinalIgnoreCase)) {
            throw new ArgumentException("SharedMaterialsはマテリアル保存用です。別の島の名前を指定してください。");
        }
        return OutputFolder + "/" + name;
    }

    public static Material FindSharedMaterial(string materialName) {
        string path = GetMaterialPath(materialName);
        Material existing = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (existing == null) {
            if (AssetDatabase.LoadMainAssetAtPath(path) != null || System.IO.File.Exists(path)
                    || System.IO.Directory.Exists(path)) {
                throw new InvalidOperationException("同じ保存先にMaterial以外のファイル等があります: " + path);
            }
            return null;
        }
        Shader shader = AssetDatabase.LoadAssetAtPath<Shader>(ShaderPath);
        if (shader == null || existing.shader != shader) {
            throw new InvalidOperationException("同名マテリアルが浮島用シェーダーではありません。別の名前を指定してください。");
        }
        return existing;
    }

    public static string GetMaterialPath(string materialName) {
        if (string.IsNullOrWhiteSpace(materialName)) throw new ArgumentException("マテリアル名を入力してください。");
        string name = materialName.Trim();
        if (name.EndsWith(".mat", StringComparison.OrdinalIgnoreCase)) name = name.Substring(0, name.Length - 4);
        return SharedMaterialsFolder + "/" + ValidateAssetName(name, "マテリアル名") + ".mat";
    }

    static string ValidateAssetName(string name, string label) {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException(label + "を入力してください。");
        name = name.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length > 100 || name.EndsWith(".")
                || name.EndsWith(" ") || name.IndexOfAny(System.IO.Path.GetInvalidFileNameChars()) >= 0
                || name.IndexOf('/') >= 0 || name.IndexOf('\\') >= 0) {
            throw new ArgumentException(label + "は100文字以内のファイル名にしてください。パスや末尾のピリオドは使えません。");
        }
        string stem = name.Split('.')[0].ToUpperInvariant();
        if (stem == "CON" || stem == "PRN" || stem == "AUX" || stem == "NUL"
                || (stem.Length == 4 && (stem.StartsWith("COM") || stem.StartsWith("LPT"))
                    && stem[3] >= '1' && stem[3] <= '9')) {
            throw new ArgumentException("Windowsで予約されている名前は使えません。");
        }
        return name;
    }

    public static Material GetSharedMaterial(string materialName, Color grassColor, Color rockColor) {
        return LowPolyVertexColorUtility.GetMaterial();
    }

    // 旧2マテリアル版を変換。元Meshと旧Materialは削除せず、Prefabの参照だけ更新する。
    public static bool UpgradePrefab(GameObject prefab, string materialName) {
        string path = AssetDatabase.GetAssetPath(prefab);
        if (!path.StartsWith(OutputFolder + "/", StringComparison.Ordinal)) {
            throw new ArgumentException("このツールで生成したPrefabを指定してください。");
        }
        GameObject root = PrefabUtility.LoadPrefabContents(path);
        Mesh mesh = null;
        string meshPath = null;
        bool saved = false;
        try {
            var filter = root.GetComponent<MeshFilter>();
            var renderer = root.GetComponent<MeshRenderer>();
            var collider = root.GetComponent<MeshCollider>();
            if (filter != null && filter.sharedMesh != null && filter.sharedMesh.subMeshCount == 1) return false;
            if (filter == null || filter.sharedMesh == null || filter.sharedMesh.subMeshCount != 2
                    || renderer == null || renderer.sharedMaterials.Length != 2 || collider == null) {
                throw new InvalidOperationException("旧版の浮島Prefabの構成ではありません。");
            }
            var materials = renderer.sharedMaterials;
            if (materials[0] == null || materials[1] == null
                    || !materials[0].HasProperty("_Color") || !materials[1].HasProperty("_Color")) {
                throw new InvalidOperationException("旧Materialの色を読み取れません。");
            }
            Material shared = GetSharedMaterial(materialName, materials[0].color, materials[1].color);
            mesh = UnityEngine.Object.Instantiate(filter.sharedMesh);
            mesh.name = "FloatingIslandMesh";
            SetSurfaceMaskAndSingleSubmesh(mesh);
            LowPolyVertexColorUtility.BakeIslandMask(mesh, materials[0].color, materials[1].color);
            mesh.uv2 = Array.Empty<Vector2>();
            meshPath = AssetDatabase.GenerateUniqueAssetPath(
                System.IO.Path.GetDirectoryName(path).Replace('\\', '/') + "/IslandMesh_TwoColor.asset");
            AssetDatabase.CreateAsset(mesh, meshPath);
            filter.sharedMesh = mesh;
            collider.sharedMesh = mesh;
            renderer.sharedMaterials = new[] { shared };
            if (PrefabUtility.SaveAsPrefabAsset(root, path) == null) {
                throw new InvalidOperationException("変換後のPrefabを保存できませんでした。");
            }
            saved = true;
            return true;
        } finally {
            PrefabUtility.UnloadPrefabContents(root);
            if (!saved && meshPath != null) AssetDatabase.DeleteAsset(meshPath);
            if (mesh != null && !AssetDatabase.Contains(mesh)) UnityEngine.Object.DestroyImmediate(mesh);
        }
    }

    static void SetSurfaceMaskAndSingleSubmesh(Mesh mesh) {
        int[] grass = mesh.GetTriangles(0);
        int[] rock = mesh.GetTriangles(1);
        var colors = new Color32[mesh.vertexCount];
        for (int i = 0; i < colors.Length; i++) colors[i] = new Color32(0, 0, 0, 255);
        foreach (int index in grass) colors[index] = new Color32(255, 0, 0, 255);
        foreach (int index in rock) {
            if (colors[index].r != 0) {
                throw new InvalidOperationException("草地と岩の頂点が共有されています。元の設定で再生成してください。");
            }
        }
        var triangles = new int[grass.Length + rock.Length];
        Array.Copy(grass, 0, triangles, 0, grass.Length);
        Array.Copy(rock, 0, triangles, grass.Length, rock.Length);
        mesh.colors32 = colors;
        mesh.subMeshCount = 1;
        mesh.SetTriangles(triangles, 0);
    }

    static void EnsureFolder(string path) {
        if (AssetDatabase.IsValidFolder(path)) return;
        string parent = System.IO.Path.GetDirectoryName(path).Replace('\\', '/');
        EnsureFolder(parent);
        AssetDatabase.CreateFolder(parent, System.IO.Path.GetFileName(path));
    }

    static void Validate(FloatingIslandSettings settings) {
        if (settings == null) throw new ArgumentNullException(nameof(settings));
        ValidateRange(settings.width, 2f, 50f, "幅");
        ValidateRange(settings.depth, 2f, 50f, "奥行き");
        ValidateRange(settings.thickness, 0.5f, 20f, "岩の厚み");
        ValidateRange(settings.roughness, 0f, 0.35f, "輪郭の凹凸");
        ValidateRange(settings.cornerRounding, 0f, 1f, "輪郭の角の丸み");
        ValidateRange(settings.surfaceHeight, 0f, Mathf.Min(2f, settings.thickness * 0.2f), "地面の凹凸の高さ");
        ValidateRange(settings.surfaceScale, 1f, 10f, "地面の凹凸の間隔");
        ValidateRange(settings.surfacePointJitter, 0f, 0.35f, "地面の頂点のばらつき");
        ValidateRange(settings.grassDepth, 0.05f, 0.5f, "草地の縁の厚み");
        ValidateRange(settings.grassInset, 0f, Mathf.Min(1f, Mathf.Min(settings.width, settings.depth) * 0.15f), "草地の縁を凹ませる幅");
        ValidateRange(settings.grassThicknessVariation, 0f, 0.8f, "草地の厚みのばらつき");
        if (settings.segments < 6 || settings.segments > 40) {
            throw new ArgumentOutOfRangeException(nameof(settings.segments), "島の細かさは6〜40です。");
        }
    }

    static void ValidateRange(float value, float min, float max, string label) {
        if (float.IsNaN(value) || float.IsInfinity(value) || value < min || value > max) {
            throw new ArgumentOutOfRangeException(label, label + "が指定範囲外です。");
        }
    }

    static float Range(System.Random random, float min, float max) {
        return Mathf.Lerp(min, max, (float)random.NextDouble());
    }

    static void AddBand(Vector3[] upper, Vector3[] lower, int i, int next,
            List<Vector3> vertices, List<int> triangles) {
        AddTriangle(upper[i], upper[next], lower[i], vertices, triangles);
        AddTriangle(upper[next], lower[next], lower[i], vertices, triangles);
    }

    static void AddTriangle(Vector3 a, Vector3 b, Vector3 c,
            List<Vector3> vertices, List<int> triangles) {
        int start = vertices.Count;
        vertices.Add(a);
        vertices.Add(b);
        vertices.Add(c);
        triangles.Add(start);
        triangles.Add(start + 1);
        triangles.Add(start + 2);
    }
}

```

## File: 浮島ジェネレーター/FloatingIslandSurfaceTriangulator.cs

```cs
using System;
using System.Collections.Generic;
using UnityEngine;

// 境界を保ち、千鳥格子を土台に揺らした点を挿入。内部の辺を反転して細長い面を減らす。
static class FloatingIslandSurfaceTriangulator {
    struct Triangle {
        public int a, b, c;
        public Triangle(int a, int b, int c) { this.a = a; this.b = b; this.c = c; }
    }

    struct EdgePair {
        public int a, b, first, second;
    }

    public static List<int> Triangulate(List<Vector2> boundary, float spacing, float jitter, int seed,
            out List<Vector2> points) {
        points = new List<Vector2>(boundary);
        var triangles = EarClip(points);
        Vector2 min = boundary[0], max = boundary[0];
        foreach (Vector2 p in boundary) { min = Vector2.Min(min, p); max = Vector2.Max(max, p); }
        float rowStep = spacing * 0.8660254f;
        var random = new System.Random(seed ^ 0x173f6a29);
        for (int row = Mathf.FloorToInt(min.y / rowStep); row <= Mathf.CeilToInt(max.y / rowStep); row++) {
            for (int column = Mathf.FloorToInt(min.x / spacing) - 1;
                    column <= Mathf.CeilToInt(max.x / spacing) + 1; column++) {
                var p = new Vector2((column + ((row & 1) == 0 ? 0f : 0.5f)) * spacing, row * rowStep);
                if (jitter > 0f) {
                    p += new Vector2((float)random.NextDouble() * 2f - 1f,
                        (float)random.NextDouble() * 2f - 1f) * spacing * jitter;
                }
                if (!Inside(p, boundary) || NearBoundary(p, boundary, spacing * 0.35f)) continue;
                if (jitter > 0f && NearPoint(p, points, spacing * 0.4f)) continue;
                Insert(p, points, triangles);
            }
        }
        ImproveEdges(points, triangles);
        var result = new List<int>(triangles.Count * 3);
        foreach (Triangle triangle in triangles) {
            result.Add(triangle.a); result.Add(triangle.b); result.Add(triangle.c);
        }
        return result;
    }

    static List<Triangle> EarClip(List<Vector2> points) {
        var remaining = new List<int>();
        for (int i = 0; i < points.Count; i++) remaining.Add(i);
        var result = new List<Triangle>();
        while (remaining.Count > 3) {
            bool found = false;
            for (int i = 0; i < remaining.Count; i++) {
                int a = remaining[(i + remaining.Count - 1) % remaining.Count];
                int b = remaining[i], c = remaining[(i + 1) % remaining.Count];
                if (Cross(points[a], points[b], points[c]) <= 1e-9) continue;
                bool occupied = false;
                foreach (int index in remaining) {
                    if (index == a || index == b || index == c) continue;
                    if (Contains(points[index], points[a], points[b], points[c])) { occupied = true; break; }
                }
                if (occupied) continue;
                result.Add(new Triangle(a, b, c));
                remaining.RemoveAt(i); found = true; break;
            }
            if (!found) throw new InvalidOperationException("島の輪郭を三角形に分割できません。輪郭の凹凸を下げてください。");
        }
        result.Add(Make(remaining[0], remaining[1], remaining[2], points));
        return result;
    }

    static void Insert(Vector2 p, List<Vector2> points, List<Triangle> triangles) {
        for (int i = 0; i < triangles.Count; i++) {
            Triangle t = triangles[i];
            if (!Contains(p, points[t.a], points[t.b], points[t.c])) continue;
            int a = -1, b = -1, c = -1;
            if (Math.Abs(Cross(points[t.a], points[t.b], p)) <= 1e-7) { a = t.a; b = t.b; c = t.c; }
            else if (Math.Abs(Cross(points[t.b], points[t.c], p)) <= 1e-7) { a = t.b; b = t.c; c = t.a; }
            else if (Math.Abs(Cross(points[t.c], points[t.a], p)) <= 1e-7) { a = t.c; b = t.a; c = t.b; }
            if (a >= 0) {
                // 既存の辺の上なら両側の面を分割し、T字の継ぎ目を作らない。
                int adjacent = -1, d = -1;
                for (int j = 0; j < triangles.Count; j++) {
                    if (j == i) continue;
                    int other = Opposite(triangles[j], a, b);
                    if (other >= 0) { adjacent = j; d = other; break; }
                }
                Vector2 edge = points[b] - points[a];
                p = points[a] + edge * Mathf.Clamp01(Vector2.Dot(p - points[a], edge) / edge.sqrMagnitude);
                int index = points.Count; points.Add(p);
                triangles[i] = Make(a, index, c, points);
                triangles.Add(Make(index, b, c, points));
                if (adjacent >= 0) {
                    triangles[adjacent] = Make(b, index, d, points);
                    triangles.Add(Make(index, a, d, points));
                }
            } else {
                int index = points.Count; points.Add(p);
                triangles[i] = Make(t.a, t.b, index, points);
                triangles.Add(Make(t.b, t.c, index, points));
                triangles.Add(Make(t.c, t.a, index, points));
            }
            return;
        }
        throw new InvalidOperationException("地面の格子点を配置できませんでした。");
    }

    static void ImproveEdges(List<Vector2> points, List<Triangle> triangles) {
        for (int pass = 0; pass < 128; pass++) {
            var edges = new Dictionary<ulong, EdgePair>();
            for (int i = 0; i < triangles.Count; i++) {
                Triangle t = triangles[i];
                Register(edges, t.a, t.b, i); Register(edges, t.b, t.c, i); Register(edges, t.c, t.a, i);
            }
            int flips = 0;
            foreach (EdgePair edge in edges.Values) {
                if (edge.second < 0) continue; // 外周は動かさない。
                int a = edge.a, b = edge.b;
                int c = Opposite(triangles[edge.first], a, b), d = Opposite(triangles[edge.second], a, b);
                if (c < 0 || d < 0) continue; // この走査中に更新された辺は次回へ。
                if (Cross(points[c], points[d], points[a]) * Cross(points[c], points[d], points[b]) >= -1e-12) continue;
                if (!InCircle(points[a], points[b], points[c], points[d])) continue;
                triangles[edge.first] = Make(c, d, a, points);
                triangles[edge.second] = Make(d, c, b, points);
                flips++;
            }
            if (flips == 0) return;
        }
        throw new InvalidOperationException("地面の三角形分割が収束しませんでした。分割間隔を広げてください。");
    }

    static void Register(Dictionary<ulong, EdgePair> edges, int a, int b, int triangle) {
        ulong key = ((ulong)(uint)Math.Min(a, b) << 32) | (uint)Math.Max(a, b);
        EdgePair pair;
        if (edges.TryGetValue(key, out pair)) { pair.second = triangle; edges[key] = pair; }
        else edges.Add(key, new EdgePair { a = a, b = b, first = triangle, second = -1 });
    }

    static int Opposite(Triangle t, int a, int b) {
        bool hasA = t.a == a || t.b == a || t.c == a, hasB = t.a == b || t.b == b || t.c == b;
        if (!hasA || !hasB) return -1;
        return t.a != a && t.a != b ? t.a : t.b != a && t.b != b ? t.b : t.c;
    }

    static Triangle Make(int a, int b, int c, List<Vector2> points) {
        double area = Cross(points[a], points[b], points[c]);
        if (Math.Abs(area) < 1e-10) throw new InvalidOperationException("地面に潰れた三角形ができました。");
        return area > 0 ? new Triangle(a, b, c) : new Triangle(a, c, b);
    }

    static bool Contains(Vector2 p, Vector2 a, Vector2 b, Vector2 c) {
        return Cross(a, b, p) >= -1e-8 && Cross(b, c, p) >= -1e-8 && Cross(c, a, p) >= -1e-8;
    }

    static double Cross(Vector2 a, Vector2 b, Vector2 c) {
        return ((double)b.x - a.x) * ((double)c.y - a.y) - ((double)b.y - a.y) * ((double)c.x - a.x);
    }

    static bool InCircle(Vector2 a, Vector2 b, Vector2 c, Vector2 p) {
        double ax = a.x - (double)p.x, ay = a.y - (double)p.y;
        double bx = b.x - (double)p.x, by = b.y - (double)p.y;
        double cx = c.x - (double)p.x, cy = c.y - (double)p.y;
        double aa = ax * ax + ay * ay, bb = bx * bx + by * by, cc = cx * cx + cy * cy;
        double determinant = aa * (bx * cy - by * cx) - bb * (ax * cy - ay * cx) + cc * (ax * by - ay * bx);
        if (Cross(a, b, c) < 0) determinant = -determinant;
        double scale = Math.Max(aa, Math.Max(bb, cc));
        return determinant > 1e-7 * Math.Max(1d, scale * scale);
    }

    static bool Inside(Vector2 p, List<Vector2> polygon) {
        bool inside = false;
        for (int i = 0, j = polygon.Count - 1; i < polygon.Count; j = i++) {
            Vector2 a = polygon[i], b = polygon[j];
            if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
    }

    static bool NearBoundary(Vector2 p, List<Vector2> polygon, float distance) {
        for (int i = 0; i < polygon.Count; i++) {
            Vector2 a = polygon[i], edge = polygon[(i + 1) % polygon.Count] - a;
            Vector2 closest = a + edge * Mathf.Clamp01(Vector2.Dot(p - a, edge) / edge.sqrMagnitude);
            if ((p - closest).sqrMagnitude < distance * distance) return true;
        }
        return false;
    }

    static bool NearPoint(Vector2 p, List<Vector2> points, float distance) {
        float squared = distance * distance;
        foreach (Vector2 point in points) if ((p - point).sqrMagnitude < squared) return true;
        return false;
    }
}

```

## File: 浮島ジェネレーター/FloatingIslandGeneratorWindow.cs.meta

```meta
fileFormatVersion: 2
guid: 61812396229894149b1776a9cfa22eb2
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 浮島ジェネレーター/FloatingIslandSurfaceTriangulator.cs.meta

```meta
fileFormatVersion: 2
guid: 4fe6456339b49b54bbd39e0ff3055acc
MonoImporter:
  externalObjects: {}
  serializedVersion: 2
  defaultReferences: []
  executionOrder: 0
  icon: {instanceID: 0}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 共通.meta

```meta
fileFormatVersion: 2
guid: c54c0d04a9194928a8149cc7f341ca7d
folderAsset: yes
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 橋ジェネレーター.meta

```meta
fileFormatVersion: 2
guid: 07b8a29f6b544f6da9a5c24b7fe13b1c
folderAsset: yes
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 地形ジェネレーター.meta

```meta
fileFormatVersion: 2
guid: 50297f95e120460ab25490444925dfae
folderAsset: yes
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 頂点カラー変換.meta

```meta
fileFormatVersion: 2
guid: dd0374f25d6344b3ba68ebc8c4f01a91
folderAsset: yes
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 頂点カラー補正.meta

```meta
fileFormatVersion: 2
guid: 59f3ac87c02446d3bf858f3326ae7ac1
folderAsset: yes
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 認識テストケース収集.meta

```meta
fileFormatVersion: 2
guid: e884bf3743bc5eb41903a195c0f8605d
folderAsset: yes
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

## File: 浮島ジェネレーター.meta

```meta
fileFormatVersion: 2
guid: 7d1c1c7a8d4c4f8fa170e2a619f85ab2
folderAsset: yes
DefaultImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 

```

