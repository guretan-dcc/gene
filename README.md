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
  generators/island-generator.js  単一浮島生成（地形・川・湖・洞窟・植生）
  generators/bridge-generator.js  橋メッシュ生成
  export/unity-yaml.js        Unity YAML シリアライズ
  export/exporters.js         Prefab / JSON / PLY 出力
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
