# stageGenerator

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
| `js/config/` | 定数・ティア配色 |
| `js/core/` | 乱数・グリッド座標の共通処理 |
| `js/generation/` | 部屋グラフ・彫刻・遮蔽物・敵・トラップの生成 |
| `js/geometry/` | メッシュ生成（PLY出力と共用） |
| `js/render/` | Three.js のシーン構築とアニメーション |
| `js/camera/` / `js/input/` | 視点・操作・クリック編集 |
| `js/ui/` | サイドバー・統計・通知 |
| `js/export/` | PLY / JSON 書き出し |

## ステージ構造

- 入口の部屋から最奥のボス部屋まで、段ごとに部屋が並びます。
- 中間の段は左右に分岐できます。片側は戦闘部屋、もう片側は報酬部屋（`shop` / `life` / `weapon`）です。
- 分岐が連続する場合は同じ側の部屋同士がつながります。
- 部屋の入口には扉があり、JSON の `doors`（`fromRoom` → `toRoom`）に出力します。扉の開閉処理はゲーム側で実装します。
