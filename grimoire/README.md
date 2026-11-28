# 魔導書ジェネレーター (Grimoire Forge)

開閉とページめくりができるローポリ魔導書を作り、`.unitypackage` / `.glb` / `.obj` / PNG に書き出します。起動方法は[一番上のREADME](../README.md)を参照してください。

## 構成

| 場所 | 役割 |
| --- | --- |
| `index.html` / `css/` | 画面 |
| `js/main.js` | 起動処理 |
| `js/state.js` / `js/rig.js` | 本の設定 / 画面上のThree.jsオブジェクト |
| `js/data/` | 初期の見開きと配色プリセット |
| `js/book/` | 寸法・ページ曲線・シェイプキー付きメッシュ・組み立て |
| `js/textures/` | 表紙・小口・ページのCanvas描画 |
| `js/animation/` | 開閉とページめくり |
| `js/scene/` | シーンと視点操作 |
| `js/ui/` | パネル |
| `js/export/` | 書き出し(`unity/` が unitypackage) |
| `unity/` | unitypackage に同梱する C# / UdonSharp / 説明書 |
