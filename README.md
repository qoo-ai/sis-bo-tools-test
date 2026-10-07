# sis-bo-tools-test（テスト用）

SISが試すためのツール置き場です。全部のツールを入れます。先方には渡しません（本番用は qoo-ai/sis-bo-tools）。
本番のBOでも動きます。メニューの見出しが「【テスト版】」になります。

- 本番にも出しているもの：在庫更新／バナー反映／メルマガ／LINE配信
- テスト中（本番には未公開）：セール1ボタン／予約取込／サンリオ掲載終了日延長（1回限り）

テストで固まったら、`tools/<id>.js` と `sis.js` の1行を本番用へ移し、`grp` を `'release'` にします。

## ブックマーク（テスト用）

```
javascript:(function(){var R='sis-bo-tools-test',G='https://qoo-ai.github.io',d=0,D=document;function L(f){if(d)return;d=1;removeEventListener('message',H);var s=D.createElement('script');s.src='https://cdn.jsdelivr.net/gh/qoo-ai/'+R+'@'+f+'/sis.js';s.charset='utf-8';D.body.appendChild(s);}function H(e){var m=e.data&&e.data.sis;if(e.origin!==G||!m||m.repo!=='qoo-ai/'+R)return;L(/^[0-9a-f]{40}$/.test(m.sha||'')?m.sha:'main');}addEventListener('message',H);var w=window.open(G+'/'+R+'/go.html#'+encodeURIComponent(location.origin),'sisgo','width=320,height=120,left='+(screenX+40)+',top='+(screenY+40));if(!w)L('main');else setTimeout(function(){L('main');},6000);})();
```

## しくみ（コミットした瞬間に反映）

1. ブックマークを押すと、小窓（`go.html`、GitHub Pages）が一瞬開いて閉じる
2. 小窓が GitHub に「今の main の最新コミット」を直接聞いて、元の画面に渡す
3. 元の画面は `cdn.jsdelivr.net/gh/qoo-ai/sis-bo-tools-test@<そのコミット>/sis.js` を読む。ツールも同じコミットで読む

コミットを指定した読み込みはキャッシュが効かないので、**コミットした数十秒後には反映**されます（2026-10-07 stgで実測：更新・停止とも約20秒）。
小窓が開けない／GitHubが応答しない時だけ、予備経路として `@main` を読みます（こちらは配信元の都合で最大12時間古いことがある）。

## ツールを止める

- 全部止める（契約終了など）：`sis.js` の `ENABLED` を `false` にしてコミット（数十秒で全員止まる）
- 1つだけ止める：`sis.js` の `TOOLS` で、そのツールの `on` を `false` にしてコミット

## ツールを足す・直す

- 直す：`tools/<id>.js`（在庫更新は `stock.js`）をコミットするだけ。コミットIDの書き換えもキャッシュ消しも不要
- 足す：`tools/<id>.js` を置き、`sis.js` の `TOOLS` に1行足してコミット
