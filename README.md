# sis-bo-tools-test（テスト用）

SISが試すためのツール置き場です。全部のツールを入れます。先方には渡しません（本番用は qoo-ai/sis-bo-tools）。
本番のBOでも動きます。メニューの見出しが「【テスト版】」になります。

- 本番にも出しているもの：在庫更新／バナー反映／メルマガ／LINE配信
- テスト中（本番には未公開）：セール1ボタン／予約取込／サンリオ掲載終了日延長（1回限り）

テストで固まったら、`tools/<id>.js` と `sis.js` の1行を本番用へ移し、`grp` を `'release'` にします。

## ブックマーク（テスト用）

```
javascript:(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/qoo-ai/sis-bo-tools-test@main/sis.js?t='+Date.now();s.charset='utf-8';document.body.appendChild(s);})();
```

## ツールを止める

- 全部止める（契約終了など）：`sis.js` の `ENABLED` を `false` にする
- 1つだけ止める：`sis.js` の `TOOLS` で、そのツールの `on` を `false` にする

## ツールを足す・直す

1. `tools/<id>.js` をコミットする（`javascript:` を外した素のJSで置く）
2. 1のコミットIDを、`sis.js` の `TOOLS` にあるそのツールの `sha` に書く（足す場合は1行追加）
3. `sis.js` をコミットする
4. `https://purge.jsdelivr.net/gh/qoo-ai/sis-bo-tools-test@main/sis.js` を開いて、キャッシュを消す

ツール本体はコミットIDで読み込むので、ツール側のキャッシュを消す必要はありません。
