# stageGenerator

縦長・超巨大・超ローポリ（3D Greedy Meshing）ボクセルアリーナ ジェネレーター。
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
| `js/config/` | 定数・ティア配色 |
| `js/core/` | 乱数・グリッド座標の共通処理 |
| `js/generation/` | 地形・遮蔽物・スロープ・敵・トラップの生成（地形プリセットは `layouts/`） |
| `js/geometry/` | メッシュ生成（PLY出力と共用） |
| `js/render/` | Three.js のシーン構築とアニメーション |
| `js/camera/` / `js/input/` | 視点・操作・クリック編集 |
| `js/ui/` | サイドバー・統計・通知 |
| `js/export/` | PLY / JSON 書き出し |

## 地形プリセットの追加

1. `js/generation/layouts/` に彫刻関数を追加する
2. `layouts/index.js` の `LAYOUTS` に登録する
3. `index.html` の `<select id="preset">` に同じ値の `<option>` を追加する
