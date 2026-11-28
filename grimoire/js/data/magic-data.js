// 呪文データ(myWorld の Shape / Character / CharacterColor / PartOfSpeech / Word の各データベースから変換)。
// 解説ページはこのファイルだけを参照するので、差し替えればページの内容も変わる。

export const SHAPES = [
  {"name": "―", "closed": false, "points": [[-0.5, 0.0], [0.5, 0.0]]},
  {"name": "│", "closed": false, "points": [[0.0, -0.5], [0.0, 0.5]]},
  {"name": "\\", "closed": false, "points": [[0.4, -0.5], [-0.4, 0.5]]},
  {"name": "/", "closed": false, "points": [[-0.4, -0.5], [0.4, 0.5]]},
  {"name": "∨", "closed": false, "points": [[-0.5, 0.5], [0.0, -0.5], [0.5, 0.5]]},
  {"name": "∧", "closed": false, "points": [[-0.5, -0.5], [0.0, 0.5], [0.5, -0.5]]},
  {"name": ">", "closed": false, "points": [[-0.5, 0.5], [0.5, 0.0], [-0.5, -0.5]]},
  {"name": "<", "closed": false, "points": [[0.5, 0.5], [-0.5, 0.0], [0.5, -0.5]]},
  {"name": "○", "closed": true, "points": [[0.5, 0.0], [0.49, 0.101], [0.459, 0.197], [0.41, 0.286], [0.344, 0.362], [0.264, 0.424], [0.174, 0.469], [0.076, 0.494], [-0.025, 0.499], [-0.125, 0.484], [-0.22, 0.449], [-0.306, 0.395], [-0.379, 0.326], [-0.437, 0.243], [-0.477, 0.15], [-0.497, 0.051], [-0.497, -0.051], [-0.477, -0.15], [-0.437, -0.243], [-0.379, -0.326], [-0.306, -0.395], [-0.22, -0.449], [-0.125, -0.484], [-0.025, -0.499], [0.076, -0.494], [0.174, -0.469], [0.264, -0.424], [0.344, -0.362], [0.41, -0.286], [0.459, -0.197], [0.49, -0.101]]},
  {"name": "□", "closed": true, "points": [[0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]]}
];

export const CHARACTERS = [
  {"name": "―", "shapes": [0], "color": "#63afff"},
  {"name": "│", "shapes": [1], "color": "#fde267"},
  {"name": "\\", "shapes": [2], "color": "#a8e04f"},
  {"name": "/", "shapes": [3], "color": "#b692ff"},
  {"name": "∨", "shapes": [4], "color": "#63e6a5"},
  {"name": "∧", "shapes": [5], "color": "#ff9b45"},
  {"name": ">", "shapes": [6], "color": "#45e5ff"},
  {"name": "<", "shapes": [7], "color": "#f78bd3"},
  {"name": "○", "shapes": [8], "color": "#ff4c5f"},
  {"name": "□", "shapes": [9], "color": "#5059ff"},
  {"name": "+", "shapes": [0, 1], "color": "#ff5954"},
  {"name": "×", "shapes": [2, 3], "color": "#585858"},
  {"name": "卡", "shapes": [4, 5], "color": "#7c1e0a"},
  {"name": "⇈", "shapes": [5, 5], "color": "#804d17"},
  {"name": "⇊", "shapes": [4, 4], "color": "#173b80"}
];

export const PARTS_OF_SPEECH = ["主体", "作用", "条件", "接続詞", "条件接続詞"];

export const WORDS = [
  {"id": 1, "name": "○", "chars": [8], "pos": 0, "meaning": "球体", "canStart": true, "canEnd": true, "implemented": true, "next": [{"pos": 3, "words": [3]}, {"pos": 1, "words": [5, 8, 9, 10, 11, 12, 13, 14, 15, 16]}]},
  {"id": 2, "name": "□", "chars": [9], "pos": 0, "meaning": "立方体", "canStart": true, "canEnd": true, "implemented": true, "next": [{"pos": 3, "words": [3]}, {"pos": 1, "words": [5, 8, 9, 10, 11, 12, 13, 14, 15, 16]}]},
  {"id": 3, "name": "<", "chars": [7], "pos": 3, "meaning": "再生成", "canStart": false, "canEnd": false, "implemented": true, "next": [{"pos": 1, "words": [5, 8, 9, 10, 11, 12, 13, 14, 15, 16]}]},
  {"id": 4, "name": "/", "chars": [3], "pos": 3, "meaning": "作用に対して条件を記述する", "canStart": false, "canEnd": false, "implemented": true, "next": [{"pos": 2, "words": [7, 17, 18, 21]}]},
  {"id": 5, "name": "×", "chars": [11], "pos": 1, "meaning": "空中に固定", "canStart": false, "canEnd": true, "implemented": true, "next": [{"pos": 3, "words": [4]}]},
  {"id": 6, "name": "+", "chars": [10], "pos": 3, "meaning": "前と同じ品詞を同列に付加する。作用を二つつける。", "canStart": false, "canEnd": false, "implemented": false, "next": []},
  {"id": 7, "name": "―", "chars": [0], "pos": 2, "meaning": "地面。現状はstaticObjectに対して接触した時発動", "canStart": false, "canEnd": true, "implemented": true, "next": [{"pos": 4, "words": [19, 20]}]},
  {"id": 8, "name": "<>", "chars": [7, 6], "pos": 1, "meaning": "オブジェクトを大きくする、効果範囲を広くする", "canStart": false, "canEnd": true, "implemented": true, "next": [{"pos": 3, "words": [4]}]},
  {"id": 9, "name": "><", "chars": [6, 7], "pos": 1, "meaning": "オブジェクトを小さくする、効果範囲を狭くする", "canStart": false, "canEnd": true, "implemented": true, "next": [{"pos": 3, "words": [4]}]},
  {"id": 10, "name": "―∨", "chars": [0, 4], "pos": 1, "meaning": "重力を無くす", "canStart": false, "canEnd": true, "implemented": true, "next": [{"pos": 3, "words": [4]}]},
  {"id": 11, "name": "卡", "chars": [12], "pos": 1, "meaning": "爆発する", "canStart": true, "canEnd": true, "implemented": false, "next": [{"pos": 3, "words": [4]}]},
  {"id": 12, "name": "<―", "chars": [7, 0], "pos": 1, "meaning": "前に飛ばす", "canStart": true, "canEnd": true, "implemented": true, "next": [{"pos": 3, "words": [4]}]},
  {"id": 13, "name": "<<", "chars": [7, 7], "pos": 1, "meaning": "左に飛ばす", "canStart": true, "canEnd": true, "implemented": true, "next": [{"pos": 3, "words": [4]}]},
  {"id": 14, "name": "⇈", "chars": [13], "pos": 1, "meaning": "上に飛ばす", "canStart": true, "canEnd": true, "implemented": true, "next": [{"pos": 3, "words": [4]}]},
  {"id": 15, "name": "⇊", "chars": [14], "pos": 1, "meaning": "下に飛ばす", "canStart": true, "canEnd": true, "implemented": true, "next": [{"pos": 3, "words": [4]}]},
  {"id": 16, "name": ">>", "chars": [6, 6], "pos": 1, "meaning": "右に飛ばす", "canStart": true, "canEnd": true, "implemented": true, "next": [{"pos": 3, "words": [4]}]},
  {"id": 17, "name": "∨", "chars": [4], "pos": 2, "meaning": "5秒後", "canStart": false, "canEnd": true, "implemented": true, "next": [{"pos": 4, "words": [19, 20]}]},
  {"id": 18, "name": "│", "chars": [1], "pos": 2, "meaning": "１秒後", "canStart": false, "canEnd": true, "implemented": true, "next": [{"pos": 4, "words": [19, 20]}]},
  {"id": 19, "name": "∧", "chars": [5], "pos": 4, "meaning": "かつ", "canStart": false, "canEnd": false, "implemented": true, "next": []},
  {"id": 20, "name": "∨", "chars": [4], "pos": 4, "meaning": "または", "canStart": false, "canEnd": false, "implemented": true, "next": []},
  {"id": 21, "name": "×", "chars": [11], "pos": 2, "meaning": "10秒後", "canStart": false, "canEnd": true, "implemented": true, "next": [{"pos": 4, "words": [19, 20]}]}
];
