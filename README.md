# gene

myWorld 用のジェネレーター集です。各ページ右上(魔導書はパネル上部)で切り替えます。

| フォルダ | 内容 |
| --- | --- |
| [`island/`](island/README.md) | 群島・浮島＆橋ジェネレーター |
| [`stage/`](stage/README.md) | ボクセルステージジェネレーター |
| [`grimoire/`](grimoire/README.md) | ローポリ魔導書ジェネレーター |
| [`enemy/`](enemy/README.md) | 敵(ロボット)ジェネレーター |
| `shared/` | 共通処理(`.unitypackage`、固定GUID、Unity の YAML) |
| `Editor.md` | Unity エディタースクリプトの資料 |

## 起動

ES Modules を使っているため、このフォルダ(リポジトリの一番上)でローカルサーバーを起動して開きます。各フォルダ単体では `shared/` を読み込めません。

```bash
python3 -m http.server 8000   # → http://localhost:8000/
```
