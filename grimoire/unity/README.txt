Grimoire Forge - UnityPackage 導入ガイド
========================================

1. 導入手順
   この .unitypackage を Unity にインポートすると、自動で
   Assets/GrimoireForge/GrimoireBook.prefab
   が生成されます。
   （自動生成されない場合は上部メニュー Tools > Grimoire Forge > Build Book Prefab を実行してください）

2. Unity 通常再生でのテスト操作
   GrimoireBook.prefab をシーンに配置して Play すると以下で動作します：
   - Space キー      : 本を開く / 閉じる
   - 左 / 右矢印キー : ページめくり（シェイプキー駆動＋左右の厚み連動）

3. VRChat (UdonSharp) での使い方
   Assets/GrimoireForge/Scripts/GrimoireBookUdon.cs が同梱されています。
   VRChat SDK3 + UdonSharp が導入されたプロジェクトでは自動的に有効化されます。
   - Prefab ルートの GrimoireBookController を GrimoireBookUdon に差し替え、
     同じ各 Transform / SkinnedMeshRenderer / PageTextures を割り当ててください。
   - Interact で開閉、UI Button 等から NextPage() / PrevPage() / ToggleOpen() を呼ぶと
     マルチプレイ同期付きで開閉・ページめくりが動作します。

4. 含まれている BlendShape (シェイプキー)
   - LeftPageStack / LeftPageUI / RightPageStack / RightPageUI:
     [0] Closed_Thick / [1] Open_Thin / [2] Open_Thick
   - TurningPageFront / TurningPageBack:
     [0] Turn_17 / [1] Turn_33 / [2] Turn_50 / [3] Turn_67 / [4] Turn_83 / [5] Turn_100
