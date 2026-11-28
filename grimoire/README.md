# 魔導書ジェネレーター (Grimoire Forge)

開閉とページめくりができるローポリ魔導書を作り、`.unitypackage` / `.glb` / `.obj` / PNG に書き出します。起動方法は[一番上のREADME](../README.md)を参照してください。

## ページ

初期状態は、呪文の解説(図形 → 単語 → 例文)と設定・操作方法の見開きです。見出しタブは各区分の先頭に付きます。

- 呪文データは `js/data/magic-data.js`(myWorld のデータベースから変換したもの)です。差し替えると解説ページも変わります。
- ページの分け方・例文・設定ページの項目は `js/data/magic-pages.js` で決めています。
- ページごとの種類と内容は「ページ」タブで変えられます。解説ページは項目の入力を使いません。
- 設定ページは見た目だけで、操作はできません。

## Unityへの書き出し (.unitypackage)

テクスチャ1枚・マテリアル1つ(`Unlit/Texture`)の軽量な Prefab です。

| 場所 | 内容 |
| --- | --- |
| `Assets/MyAssets/GameObjects/Grimoire/<タイトル>/` | Prefab・テクスチャ・マテリアル・`Meshes/` |
| `Assets/MyAssets/Scripts/U#/Grimoire/` | ページを切り替える `GrimoireBook`(UdonSharp) |

1. パッケージを取り込み、Prefab をシーンに置きます。
2. ルートに `GrimoireBook` コンポーネントを追加します。
3. 本を Use すると次の見開きに進み、最後の次は閉じます。`NextPage` / `PrevPage` / `ToggleOpen` はボタンなどからも呼べます。

- 表示中なのは `Body` と見開き1つ(閉じているときは `Closed`)だけなので、描画は1〜2回です。
- ライトの影響を受けません(面の明るさは色に焼き込んでいます)。
- 開閉とページめくりのアニメーションは書き出しません。表示はプレイヤーごとで、同期しません。
- 立体の紋章と金具は、表紙の絵として描きます。
- 見開きが増えるほど、1ページあたりの解像度が下がります。
- 以前の形式(`Assets/GrimoireForge/`)を取り込んでいる場合は、そのフォルダを削除してください。

## 構成

| 場所 | 役割 |
| --- | --- |
| `index.html` / `css/` | 画面 |
| `js/main.js` | 起動処理 |
| `js/state.js` / `js/rig.js` | 本の設定 / 画面上のThree.jsオブジェクト |
| `js/data/` | 呪文データ・見開きの構成・配色プリセット |
| `js/book/` | 寸法・ページ曲線・束の端と見出しタブ・メッシュ・組み立て |
| `js/textures/` | 表紙・小口・ページのCanvas描画 |
| `js/animation/` | 開閉とページめくり |
| `js/scene/` | シーンと視点操作 |
| `js/ui/` | パネル |
| `js/export/` | 書き出し(`unity/` が unitypackage) |
| `unity/` | unitypackage に同梱する UdonSharp |
