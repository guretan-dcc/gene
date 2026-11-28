// stageGenerator で書き出したステージの PlayerSpawn を、VRC Scene Descriptor の Spawns に設定する
// VRChat SDK の型を直接参照せず、SerializedObject 経由で書き換える
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class StageSpawnSetup
{
    private const string MenuPath = "Tools/Stage Generator/開始位置を設定";
    private const string SpawnName = "PlayerSpawn";
    private const string DialogTitle = "Stage Generator";

    [MenuItem(MenuPath)]
    private static void Setup()
    {
        GameObject selected = Selection.activeGameObject;
        if (selected == null)
        {
            Show("ステージのPrefab（ProjectかHierarchy）を選択してから実行してください。");
            return;
        }

        MonoBehaviour descriptor = Object.FindObjectsOfType<MonoBehaviour>()
            .FirstOrDefault(c => c != null && c.GetType().Name == "VRCSceneDescriptor");
        if (descriptor == null)
        {
            Show("シーンに VRC Scene Descriptor（VRCWorld）がありません。");
            return;
        }

        bool isAsset = EditorUtility.IsPersistent(selected);
        GameObject stage = isAsset ? FindOrPlace(selected) : selected;
        Transform spawn = FindSpawn(stage.transform);
        if (spawn == null)
        {
            Show("選択したオブジェクトに " + SpawnName + " がありません。ステージを選択してください。");
            return;
        }

        var serialized = new SerializedObject(descriptor);
        SerializedProperty spawns = serialized.FindProperty("spawns");
        if (spawns == null)
        {
            Show("VRC Scene Descriptor に Spawns が見つかりません。");
            return;
        }

        spawns.arraySize = 1;
        spawns.GetArrayElementAtIndex(0).objectReferenceValue = spawn;
        serialized.ApplyModifiedProperties();
        EditorSceneManager.MarkSceneDirty(descriptor.gameObject.scene);
        Show("Spawns を「" + spawn.parent.name + "」の " + SpawnName + " に設定しました。");
    }

    // シーンに置いてあればそれを使い、なければ配置する
    private static GameObject FindOrPlace(GameObject prefab)
    {
        GameObject placed = EditorSceneManager.GetActiveScene().GetRootGameObjects()
            .FirstOrDefault(o => PrefabUtility.GetCorrespondingObjectFromSource(o) == prefab);
        if (placed != null) return placed;

        var instance = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        Undo.RegisterCreatedObjectUndo(instance, "ステージを配置");
        return instance;
    }

    // 選択がステージ内の子でも見つかるように、親をたどって探す
    private static Transform FindSpawn(Transform from)
    {
        for (Transform t = from; t != null; t = t.parent)
        {
            Transform spawn = t.Find(SpawnName);
            if (spawn != null) return spawn;
        }
        return null;
    }

    private static void Show(string message)
    {
        EditorUtility.DisplayDialog(DialogTitle, message, "OK");
    }
}
