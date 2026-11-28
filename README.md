# stageGenerator

画面右上の切り替えから[浮島ジェネレーター（gene）](https://guretan-dcc.github.io/gene/)に移動できます。

部屋を通路と扉で連結する、ローポリ（3D Greedy Meshing）ボクセルステージ ジェネレーター。
ブラウザでプレビューしながら地形を生成し、PLY（地形メッシュ）と JSON（配置データ）を書き出せます。

## 起動

ES Modules を使っているため、`index.html` を直接ダブルクリックしても動きません。ローカルサーバー経由で開いてください。

```bash
python -m http.server 8000
# http://localhost:8000 を開く
```

VS Code の Live Server や GitHub Pages でも動きます。Three.js r128 と Tailwind CSS は CDN から読み込むため、ネット接続が必要です。

## 構成

| 場所 | 役割 |
| --- | --- |
| `index.html` / `css/` | 画面 |
| `js/main.js` | 起動処理 |
| `js/state.js` | 設定値と生成データ |
| `js/config/` | 定数 |
| `js/rooms/` | 部屋ごとの地形・配色・ディテール |
| `js/core/` | 乱数・グリッド座標の共通処理 |
| `js/generation/` | 部屋の並び・地形・彫刻・遮蔽物・敵・トラップの生成 |
| `js/geometry/` | メッシュ生成（PLY出力と共用） |
| `js/render/` | Three.js のシーン構築とアニメーション |
| `js/camera/` / `js/input/` | 視点・操作・クリック編集 |
| `js/ui/` | サイドバー・統計・通知 |
| `js/export/` | unitypackage / PLY / JSON 書き出し |
| `unity/` | unitypackage に含めるエディタースクリプト |

## Unityへの書き出し

「Unity書き出し」で `<ステージ名>.unitypackage` を出力し、Unityの Assets > Import Package > Custom Package で取り込みます。地形ジェネレーター(gene)と同じ構成です。

- `Assets/MyAssets/GameObjects/Stages/<ステージ名>/` に Prefab と、メッシュごとの `.asset` が入ります。
- マテリアルはプロジェクトの共有マテリアル `LowPolyVertexColor.mat` を GUID で参照します（パッケージには含みません）。溶岩も同じマテリアルです。
- Prefab の子は部屋・通路ごとのオブジェクトです。`MeshRenderer` を切り替えると、当たり判定を残したまま非表示にできます。
- `MeshCollider` には判定専用のメッシュ（床・壁・遮蔽物・坂・台座）を使います。装飾と浅い溶岩面は含まず、階段は坂になります。
- 同じステージ名で出し直して取り込むと、シーン内の参照を保ったまま中身が更新されます。
- 座標は数値をそのまま書き出すため、配置JSONと一致します（Unityでは見た目がプレビューと左右反転します）。
- 扉は含みません。
- 開始位置は Prefab 内の `PlayerSpawn` です。取り込んだあと Prefab を選択して **Tools > Stage Generator > 開始位置を設定** を実行すると、シーンに配置して `VRC Scene Descriptor` の Spawns に設定します（`unity/StageSpawnSetup.cs`）。
- 部屋の中から見えない面（壁の外向きの面、壁の向こうの床の側面、溶岩より下、階段の段の裏）は作りません。装飾は `kit.box` を使うと自動で省かれます。

## ステージ構造

入口の部屋から最奥のボス部屋まで一本道です。通路は途中で折れ、各部屋の出口に扉があります。

部屋は1つ1ファイルで、`js/rooms/` にあります。地形(`carve`)・配色(`style`)・寸法(`size`)・高低差(`rise`)・建築ディテール(`decorate`)、必要なら浅い溶岩面の深さ(`lavaDepth`)をまとめて定義します。

| ファイル | 部屋 |
| --- | --- |
| `bridge.js` | 溶岩にかかる長い橋 |
| `arena.js` | 堀に囲まれた闘技場。奥の階段の上に扉（ボス部屋にも使用） |
| `shaft.js` | 長いスロープで上り下りする天窓付きの縦穴 |
| `start.js` | 入口の小部屋 |

部屋を追加するときはファイルを作り、`js/rooms/index.js` に登録して、`index.html` の「表示する部屋」にも選択肢を足します。

## 区画と描画負荷

- 部屋と通路はそれぞれ壁で囲まれた1区画です。
- JSON の `chunks[].visibleChunks` は、その区画にいる間に描画する区画の一覧です（つながる部屋と通路まで）。
- PLY は区画ごとに分割した ZIP で書き出せます。ゲーム側では区画ごとにオブジェクトを分けて表示を切り替えます。
- 表示の切替はゲーム側で行います。プレビューは常に全区画を表示します。壁は内向きの片面なので、外からは部屋の中が見えます。
