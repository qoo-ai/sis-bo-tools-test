# front/ — drug store's 店舗画面の売上施策（SIS）

店舗（メルカート）の user.js・user_sb.js に `loader-line.js` の1行だけを入れ、施策の本体はここから配信する。

- 関係者限定：店舗URLに `?sis=p` を付けて一度開いた端末だけ動く（`?sis=off` で解除）
- 全停止：`config.json` の `enabled` を `false` にしてコミット。施策ごとは `features` の値を `false`
- 反映：`boot.js` が GitHub に最新コミットを聞いて、そのコミットの `config.json`・`app.js` を読む（数十秒で反映）
- 数字・期限・在庫は実データのみ（カートの中身、BOのクーポン、GA4の購入数、在庫記号△、コーデページ）

| ファイル | 中身 |
|---|---|
| loader-line.js | user.js・user_sb.js に入れる1行（2026-10-24 stg 投入済み） |
| boot.js | どのコミットを動かすかを決めて読み込む |
| app.js | 施策20本（welcome / exit / source / coupon / shipbar / countdown / kuji / rank / newRepeat / catBanner / sizeMemo / modelSize / lowStock / ranking / extraOff / coord / cartReminder / crossSell / ab / ga4） |
| config.json | 送料条件・クーポン・期限・ランク表・施策のオンオフ |
| data/coords.json | スタッフコーデ索引（`python3 front/tools/build_coords.py` で再作成） |
| data/ranking.json | 売れ筋（GA4 eコマース購入数から作成） |

確認用パラメータは app.js 冒頭のコメント参照（`sis_show` `sis_src` `sis_rank` `sis_visit` `sis_now` `sis_ab` `sis_demo` `sis_debug` `sis_only` `sis_chip=0` `sis_noanim=1`）。

注意：PC版のカート画面は user.js を読まない（スマホ版は user_sb.js を読む）。PC版カートでクロスセルを出すには、カート画面に読み込みを入れる場所をメルカートに確認する。
