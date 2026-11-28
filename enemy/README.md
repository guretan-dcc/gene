# 敵ジェネレーター

ステージに置くローポリのロボットを作り、Unity 用の `.unitypackage` を書き出します。起動方法は[一番上のREADME](../README.md)を参照してください。

## 作れるもの

- 種類: 近接 / 遠距離 / 大型(ステージジェネレーターの敵とボス部屋に合わせた初期値)
- 身長・体格・頭の形・武器(剣 / 斧 / 槍 / 弓 / ブラスター)・盾・色。シードで比率が少し変わります。
- 動き(待機・歩き・攻撃)はプレビューでの関節の確認用です。アニメーションは書き出しません。

## Unityへの書き出し

- `Assets/MyAssets/GameObjects/Enemies/<名前>/` に Prefab と、部品ごとの `.asset`(`Meshes/`)が入ります。
- マテリアルは共有の `LowPolyVertexColor.mat` を GUID で参照します(パッケージには含みません)。
- Prefab は関節の親子構造です: `Hips` → `Torso` → `Head` / `UpperArm` → `ForeArm` → `Weapon`・`Shield`、`Hips` → `Thigh` → `Shin`。各部品の原点が関節なので、回転させて動かせます。
- 立ち姿勢で、正面は +Z です。足元が原点です。
- 当たり判定はルートの `CapsuleCollider` と、`Weapon` の `BoxCollider`(Trigger)だけです。トリガーの判定を受け取るには、どちらかに `Rigidbody` が必要です。
- 部品ごとに MeshRenderer があるため、1体で最大13回の描画になります。たくさん出すときは数に注意してください。
- 同じ名前で出し直して取り込むと、参照を保ったまま中身が更新されます。

## 構成

| 場所 | 役割 |
| --- | --- |
| `js/model/` | メッシュ・本体・武器 |
| `js/preview/` | 表示と動きの確認 |
| `js/export/` | Prefab と unitypackage |
| `js/ui/` / `js/settings.js` | パネル / 設定と自動保存 |
