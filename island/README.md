# gene — 群島・ステージ連結型 ローポリ浮島＆橋ジェネレーター

Three.js 製のローポリ浮島・橋ジェネレーター（Tailwind / Three.js は CDN 読み込み）。
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
  ../shared/                    unitypackage作成・固定GUID(全ジェネレーター共通)
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

起動方法は[一番上のREADME](../README.md)を参照してください(`/island/` を開きます)。

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
| WaterVolume | 湖・川の水を囲む閉じた立体（水中に入ったときの色付け用。水面の外周と川底の下を囲む） | なし |
| Trees | 木 | 簡易メッシュ（幹の筒＋葉冠の角錐） |
| Grass | 草 | なし |
| Bridges | 橋（板・橋脚） | 床だけのメッシュ |

## Unity 側の準備

1. `unity/LowPolyWater.unitypackage` を Unity に取り込む（`Assets/MyAssets/GameObjects/SharedMaterials/` に `LowPolyWater.shader` / `LowPolyWater.mat` / `LowPolyWaterVolume.shader` / `LowPolyWaterVolume.mat` が入ります。同じ内容を `unity/Assets/` にも置いています）。
2. 「Prefab」ボタンで書き出した `<ステージ名>.unitypackage` を取り込む（Assets > Import Package > Custom Package、またはダブルクリック）。`Assets/MyAssets/GameObjects/Stages/<ステージ名>/` に Prefab と、メッシュごとの `.asset`（`Meshes/`）が入ります。GUID はステージ名から決まる固定値なので、同じステージ名で出し直して取り込めば、シーンに置いたPrefabなどの参照を保ったまま中身だけ更新されます（ステージ名を変えると別のアセットになります）。Terrain / Trees / Grass / Bridges は既存の `LowPolyVertexColor.mat`、Water は `LowPolyWater.mat`、WaterVolume は `LowPolyWaterVolume.mat` を GUID で参照します。

`LowPolyWater` シェーダーは Built-in RP の半透明シェーダーで、頂点カラーを色に使い、`Tint`・`Opacity`（既定 0.88）・`Brightness`・スペキュラを調整できます。水メッシュの頂点色はUnityエディターと同じくリニアfloatで書き出すため、シェーダー側では色変換をしません。先に深度だけを書き込むパスを持つため、滝の前面・背面が二重に透けて描かれません。

- **波（頂点の変形）**: 上向きの水面の頂点を、ワールド座標と時間で決まる3つのsin波で上下させます（`Wave Height` / `Wave Scale` / `Wave Speed` / `Wave Normal Strength`）。同じ位置の頂点は必ず同じ高さになるので、ポリゴンごとに頂点が分かれたメッシュでも隙間は開きません。滝のような縦の面は動きません。
- **両面描画**: 水面は裏からも見えます（`Cull Off`）。裏面（水中から見上げたとき）は暗く、不透明寄りになり、スペキュラは出ません（`Underside Brightness` / `Underside Min Opacity`）。

### 水中の色付け（WaterVolume）

`LowPolyWaterVolume` シェーダーは、スクリプト・深度テクスチャ・ポストプロセスなしで「カメラが水の中にいるときだけ画面を水色にする」ものです（VRChatのワールドでも使えます）。

1. 各ピクセルで、WaterVolume の「裏面の数 − 表面の数」をステンシルで数えます（水の外からは差が0、水の中からは1）。
2. 差が0でないピクセルだけに、水色を重ねます。濃さは「カメラからその裏面までの距離」で決まるので、遠くほど水に霞みます（`Fog Density`）。
3. 色と明るさは `Under Water Color`、近くの濃さは `Near Tint`、遠くの濃さは `Far Tint` で調整します。水中が明るすぎるときは `Under Water Color` を暗くします。

ステンシルの下位4ビット（0〜15）だけを使い、塗り終わったら0に戻します。WaterVolume は必ず「閉じた立体で面が外向き」である必要があり、このツールの出力はそうなっています。滝・凍結した湖の氷には付きません。

## 川の流れの設計

「地形・水」タブ下部の「川の流れの設計」で島ごとに設定します。このタブを開いている間は、3D画面の操作対象が川の点（水色の球）だけになります（他のタブでは道・橋の球）。

- 自動の川を生成: 山の水源・湖からの自動河川のON/OFF（OFFなら手動の川のみ）
- 湖から川を流し出す: 既定OFF。ONで湖の流出口から川が流れ出ます
- 手動の川: 水源→河口の点を順に置くと、その経路に川を刻みます（`manualRivers: [{points:[{x,z}]}]`、座標は島の半サイズで正規化）。
  終点から先は自然な流下方向をたどり、島の端（滝）か湖まで自動で延長されます。
  自動で生成された川にも水色の球が表示され、つかむとその島の自動の川がすべて手動の川に変換されて編集できます（変換しても形はほぼ同じ）。球はドラッグで移動、地形をダブルクリックで点を追加できます（地形・水タブ表示中のみ）。
  経路が上り坂でも水面は下流へ単調に下がるため、その区間は溝として深く彫られます。

## 前回の設定の自動保存

編集内容はブラウザ(localStorage)に自動保存され、次回起動時に復元されます。完全に初期状態へ戻したい場合は、各タブの「このタブを初期化」を使うか、ブラウザのサイトデータを消去してください。別PC・別ブラウザへ移す場合は「生成設定書き出し/読込」を使います。
