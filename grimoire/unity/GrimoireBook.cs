using UdonSharp;
using UnityEngine;

// 魔導書のページ切り替え(表示は各プレイヤーごと)
// 本のルート(BoxCollider があるオブジェクト)に付ける
[UdonBehaviourSyncMode(BehaviourSyncMode.None)]
public class GrimoireBook : UdonSharpBehaviour {
	const string SpreadPrefix = "Spread_";
	const int Closed = -1;

	int _page;

	void Start() {
		Show(0);
	}

	public override void Interact() {
		NextPage();
	}

	// 最後の見開きの次は閉じる。閉じていたら最初から開く
	public void NextPage() {
		Show(_page + 1 < CountSpreads() ? _page + 1 : Closed);
	}

	// 最初の見開きの前は閉じる。閉じていたら最後を開く
	public void PrevPage() {
		Show(_page == Closed ? CountSpreads() - 1 : _page - 1);
	}

	public void ToggleOpen() {
		Show(_page == Closed ? 0 : Closed);
	}

	int CountSpreads() {
		int count = 0;
		for (int i = 0; i < transform.childCount; i++) {
			if (transform.GetChild(i).name.StartsWith(SpreadPrefix)) count++;
		}
		return count;
	}

	void Show(int page) {
		_page = page;
		int index = 0;

		for (int i = 0; i < transform.childCount; i++) {
			GameObject child = transform.GetChild(i).gameObject;

			if (child.name.StartsWith(SpreadPrefix)) {
				child.SetActive(index == page);
				index++;
			}
			else if (child.name == "Body") {
				child.SetActive(page != Closed);
			}
			else if (child.name == "Closed") {
				child.SetActive(page == Closed);
			}
		}
	}
}
