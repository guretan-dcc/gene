# gene — 群島・ステージ連結型 ローポリ浮島＆橋ジェネレーター

Three.js 製のローポリ浮島・橋ジェネレーター（ブラウザで `index.html` を開くだけで動作。Tailwind / Three.js は CDN 読み込み）。
Unity Prefab / JSON / PLY の書き出しに対応。

## 構成

```
index.html                    画面レイアウト（HTMLのみ）
css/style.css                 スタイル
js/
  utils/random.js             SeededRandom, PerlinNoise2D
  utils/math.js               clamp, smoothstep, 色ユーティリティ
  data/presets.js             群島プリセット定義
  state.js                    アプリ状態・再生成トリガー
  scene/scene.js              Three.js シーン・ライト・カメラ状態
  scene/camera-controls.js    ポインタ/ホイール操作
  scene/archipelago.js        群島全体のビルド
  scene/gizmos.js             ギズモ（調整ハンドル）生成
  scene/route-editing.js      ルート編集（ドラッグ/追加）
  scene/rebuild.js            シーン再構築
  mesh/colored-mesh-builder.js  頂点カラーメッシュビルダー
  generators/island-generator.js  単一浮島生成（地形・湖・洞窟・滝・植生）
  generators/hydrology-rivers.js  河川ネットワーク生成と河道の彫り込み（Unity版 BuildHydrology の移植）
  ui/river-list.js                手動の川(経路点)の一覧UI
  generators/bridge-generator.js  橋メッシュ生成
  export/unity-yaml.js        Unity YAML シリアライズ
  export/exporters.js         Prefab / JSON / PLY 出力
  export/importers.js         設定JSONの読み込み
  history.js                  Undo / Redo（Ctrl+Z / Ctrl+Y）
  ui/scrub.js                 Unity風の数値ドラッグ調整
  ui/tabs.js                  右パネルのタブ切り替え
  ui/*.js                     インスペクタUI（島リスト・ウェイポイント・トースト等）
  main.js                     起動処理
```

各 JS は ES Module（`import` / `export`）で、`index.html` は `js/main.js` だけを読み込みます。依存関係は各ファイル先頭の `import` を見てください。
他ファイルから再代入が必要な状態変数（`state` / `builtArchipelago` / `generationMode`）は `js/state.js` の `setState` などの setter 経由で更新します。

## 起動方法

ES Module は `file://` で直接開くと動かないため、ローカルサーバー経由で開いてください（GitHub Pages ならそのまま動きます）。

```
python3 -m http.server 8000   # → http://localhost:8000/
```

## 操作

- 右パネルは上部に常時表示のバー（元に戻す／やり直し・Prefab・PLY・生成設定書き出し・生成設定読込。生成バーの直下）と、タブ（島／道・橋／地形・水／植生・色）で構成。
- **Ctrl+Z** で元に戻す、**Ctrl+Y** でやり直し（Mac は Cmd）。スライダー・色・ギズモ操作・プリセット変更・生成設定読込などが対象。
- 「生成設定書き出し」で出力した設定ファイルは「生成設定読込」で復元できます。
- 数値欄、または数値欄のある行のラベルを**左右にドラッグ**すると値を調整できます（Shift: 速く / Alt: ゆっくり）。数値欄をクリックするだけなら通常どおり入力できます。

## Unity Prefab 出力の構成

Unity版 `FloatingTerrainPrefabCreator` と同じく、役割ごとにオブジェクトを分けて書き出します。

| オブジェクト | 内容 | MeshCollider |
|---|---|---|
| Terrain | 地形（凍結した湖の氷を含む） | 地形メッシュそのもの |
| Water | 水面・滝 | なし |
| Trees | 木 | 簡易メッシュ（幹の筒＋葉冠の角錐） |
| Grass | 草 | なし |
| Bridges | 橋（板・橋脚） | 床だけのメッシュ |

## Unity 側の準備

1. `unity/LowPolyWater.unitypackage` を Unity に取り込む（`Assets/MyAssets/GameObjects/SharedMaterials/` に `LowPolyWater.shader` と `LowPolyWater.mat` が入ります。同じ内容を `unity/Assets/` にも置いています）。
2. 書き出した `.prefab` を取り込む。Terrain / Trees / Grass / Bridges は既存の `LowPolyVertexColor.mat`、Water は `LowPolyWater.mat` を GUID で参照します。

`LowPolyWater` シェーダーは Built-in RP の半透明シェーダーで、頂点カラーを色に使い、`Tint`・`Opacity`（既定 0.88）・`Brightness`・スペキュラを調整できます。水メッシュの頂点色はUnityエディターと同じくリニアfloatで書き出すため、シェーダー側では色変換をしません。先に深度だけを書き込むパスを持つため、滝の前面・背面が二重に透けて描かれません。

## 川の流れの設計

「地形・水」タブ下部の「川の流れの設計」で島ごとに設定します。このタブを開いている間は、3D画面の操作対象が川の点（水色の球）だけになります（他のタブでは道・橋の球）。

- 自動の川を生成: 山の水源・湖からの自動河川のON/OFF（OFFなら手動の川のみ）
- 湖から川を流し出す: 既定OFF。ONで湖の流出口から川が流れ出ます
- 手動の川: 水源→河口の点を順に置くと、その経路に川を刻みます（`manualRivers: [{points:[{x,z}]}]`、座標は島の半サイズで正規化）。
  終点から先は自然な流下方向をたどり、島の端（滝）か湖まで自動で延長されます。
  水色の球をドラッグで移動、地形をダブルクリックで点を追加できます（地形・水タブ表示中のみ）。
  経路が上り坂でも水面は下流へ単調に下がるため、その区間は溝として深く彫られます。
