/* ノベルティの開始・終了（#SP-1V）v1.0 2026-10-24
   品番・条件・期間を入れる → 1回で次をそろえる
     ① ノベルティ商品の取込ファイル（商品(全項目)・167列。掲載/販売の開始＝フェア開始、終了＝フェア終了。前日に入れても時刻まで出ない）
     ② キャンペーン登録の画面を開いて入力まで（［登録する］だけ人が押す）
     ③ 対象商品のコメント1・アイコン2 の付与ファイル（開始用）と撤去ファイル（終了用）を同時に
     ④ チェック表（画像の有無・同時期の別ノベルティ・在庫0・選択画面の並び・5種まで など）
   ・BOの取込はCP932。このファイルの中でCP932に変換する（Pythonを読み込まない）
   ・コメントは <!--SIS-NOV:ID--> … <!--/SIS-NOV:ID--> で囲んで足すだけ。既存のコメント（キャンセル不可など）は消さない
   ・撤去は「その印の範囲」だけを外す。セールのツール（tools/sale.js）が書いた部分には触らない */
(function () {
  if (window.__sisNov) { window.__sisNov.show(); return; }
  var BO = location.pathname.split('/').slice(0, 2).join('/'); // /opipwy（stg）・/doecms（本番）
  var IS_STG = /mercart-stg/.test(location.hostname);
  var SHOP = IS_STG ? 'https://shop.seesplanning.mercart-stg.net' : 'https://drugstores-shop.com';
  var KEY = 'sisnov:' + location.hostname;
  var H167 = ["商品コード", "カテゴリコード", "購入グループ", "商品名", "商品名２", "バリエーショングループ", "バリエーション順序", "サイズ", "カラー", "品番１", "品番２", "品番３", "仕入先コード", "注文明細拡張", "注文明細拡張入力画面設定", "定価", "原価", "個別税率", "購入限定数", "購入最低数", "会員のみ購入可", "初回のみ購入可", "初回のみ購入可商品の注意文言", "並び順", "商品区分1", "商品区分2", "商品属性1", "商品属性2", "商品属性3", "タイトル", "メタキーワーズ", "メタディスクリプション", "カスタムURL", "一覧画面有無", "詳細画面有無", "商品インポート", "CRITEO連携する", "送料計算個数", "個別送料", "個別送料(税抜)", "配送可能温度帯", "状態(掲載フラグ)", "アイコン１", "アイコン２", "アイコン３", "掲載開始日", "掲載終了日", "販売開始日", "販売終了日", "発売日", "キャッチコピー", "スマートフォンはPCと同一設定", "詳細URL", "詳細URL(スマートフォン)", "出荷伝票用品名", "内部備考", "S画像ファイル", "S画像説明", "Ｌ画像ファイル", "L画像説明", "C画像ファイル", "C画像説明", "１画像ファイル", "１画像説明", "２画像ファイル", "２画像説明", "３画像ファイル", "３画像説明", "４画像ファイル", "4画像説明", "5画像ファイル", "5画像説明", "6画像ファイル", "6画像説明", "7画像ファイル", "7画像説明", "8画像ファイル", "8画像説明", "９画像ファイル", "9画像説明", "D1画像ファイル", "D1画像説明", "D2画像ファイル", "D2画像説明", "D3画像ファイル", "D3画像説明", "D4画像ファイル", "D4画像説明", "D5画像ファイル", "D5画像説明", "D6画像ファイル", "D6画像説明", "D7画像ファイル", "D7画像説明", "D8画像ファイル", "D8画像説明", "D9画像ファイル", "D9画像説明", "D10画像ファイル", "D10画像説明", "絞り込みコード１", "絞り込みコード２", "絞り込みコード３", "絞り込みコード４", "絞り込みコード５", "絞り込みコード６", "絞り込みコード７", "絞り込みコード８", "絞り込みコード９", "絞り込みコード１０", "絞り込みコード１１", "絞り込みコード１２", "販売価格(税込)", "販売価格(税抜)", "ポイント数", "セール開始日", "セール終了日", "セール価格(税込)", "セール価格(税抜)", "セールポイント数", "セール名", "在庫扱いの種別", "在庫数", "在庫少量時コメント", "在庫切れコメント", "在庫通常時コメント", "コメントしきい値", "在庫数の表示方法", "在庫インポート", "商品コメント１", "商品コメント２(補足説明)", "商品コメント３", "商品コメント４", "商品コメント５", "商品コメント６(予備)", "商品コメント７(予備)", "商品コメント８(予備)", "商品コメント９(予備)", "商品コメント１(スマートフォン)", "商品コメント２(スマートフォン)", "商品コメント３(スマートフォン)", "商品コメント４(スマートフォン)", "商品コメント５(スマートフォン)", "購入時メッセージ", "ブランド", "タイプ", "サイズ別カート表示", "カラー別カート表示", "JANコード", "フィード用商品コード", "フィード用製造番号", "Google商品カテゴリ", "CRITEO用商品ブランド", "Google Merchant Center連携する", "フィード用商品ブランド", "フィード用カラー", "フィード用サイズ", "フィード用素材", "フィード用柄", "フィード用性別", "フィード用年齢層", "フィード用送料", "自動更新イベント除外商品", "同一バリエーション画像表示", "税区分", "在庫アラートしきい値", "在庫アラート区分"];
  var TPL = {"カテゴリコード": "1306", "購入グループ": "99999999", "品番１": "2026ﾉﾍﾞﾙﾃｨ", "品番２": "2026AW", "会員のみ購入可": "0", "初回のみ購入可": "0", "並び順": "500", "商品属性1": "1", "一覧画面有無": "0", "詳細画面有無": "1", "商品インポート": "0", "CRITEO連携する": "1", "配送可能温度帯": "normal", "状態(掲載フラグ)": "0", "スマートフォンはPCと同一設定": "1", "販売価格(税込)": "0", "販売価格(税抜)": "0", "ポイント数": "0", "在庫扱いの種別": "1", "在庫少量時コメント": "△", "在庫切れコメント": "×", "在庫通常時コメント": "○", "コメントしきい値": "1", "在庫数の表示方法": "0", "在庫インポート": "0", "サイズ別カート表示": "0", "カラー別カート表示": "0", "Google Merchant Center連携する": "1", "自動更新イベント除外商品": "0", "同一バリエーション画像表示": "1", "在庫アラート区分": "0"};
  var LIMIT = 25 * 1024 * 1024; // 取込は1ファイル28MBまで。余裕を見て25MB
  var st = { files: {}, checks: [] };

  // ---------------------------------------------------------------- 画面
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483646;width:460px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;background:#fff;color:#101828;border:1px solid #d0d5dd;border-radius:10px;box-shadow:0 8px 24px rgba(16,24,40,.18);font:13px/1.5 sans-serif';
  box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#fff4e5;font-weight:bold">ノベルティの開始・終了 <span style="font-weight:normal;color:#667085">' + (IS_STG ? 'stg' : '本番') + '</span><a href="#" class="x" style="text-decoration:none;color:#667085;font-size:18px">×</a></div>' +
    '<div style="padding:10px 14px">' +
    row('キャンペーンID', '<input class="cid" placeholder="1027novelty" style="width:140px">') +
    row('キャンペーン名', '<input class="cname" placeholder="【ノベルティ】選べる湯たんぽ" style="width:100%">') +
    row('開始', '<input class="start" type="datetime-local">') +
    row('終了', '<input class="end" type="datetime-local">') +
    row('最低金額', '<input class="min" type="number" placeholder="11000" style="width:100px"> 円以上（商品合計）') +
    row('選択肢', '<label><input type="checkbox" class="need"> 「ノベルティ不要」も出す</label>') +
    '<div style="margin:6px 0 2px;color:#475467">ノベルティ（最大5。選択画面は品番の小さい順に並ぶ）：品番 ／ 商品名 ／ 在庫</div>' +
    '<textarea class="items" rows="5" style="width:100%;font:12px monospace" placeholder="88-0031-2699-30	【ノベルティ】カバー付き湯たんぽ ①マヌル	30"></textarea>' +
    row('コメント文', '<input class="ctext" style="width:100%" placeholder="空欄なら金額と商品名から作る">') +
    row('コメント対象', '<select class="ctarget"><option value="all">全商品</option><option value="ev">イベントの商品だけ</option><option value="none">付けない</option></select> <input class="cev" placeholder="イベントコード" style="width:110px">') +
    row('アイコン2', '<label><input type="checkbox" class="icon" checked> novelty を付ける（空いている商品だけ）</label>') +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' +
    btn('chk', '1 チェック') + btn('make', '2 ファイルを作る') + btn('goods', '3 ノベルティ商品を取込') + btn('camp', '4 キャンペーン入力') + btn('bonus', '4b 特典入力') + btn('add', '5 コメント付与') + btn('del', '6 コメント撤去（終了時）') + btn('dl', 'ファイルを保存') +
    '</div><div class="state" style="margin-top:8px;font-weight:bold"></div>' +
    '<pre class="log" style="white-space:pre-wrap;background:#f9fafb;border:1px solid #eaecf0;border-radius:6px;padding:6px;max-height:260px;overflow:auto;font:11px/1.45 monospace"></pre></div>';
  document.body.appendChild(box);
  function row(l, h) { return '<div style="display:flex;gap:8px;align-items:center;margin:3px 0"><div style="width:84px;color:#475467">' + l + '</div><div style="flex:1">' + h + '</div></div>'; }
  function btn(c, t) { return '<button class="' + c + '" style="padding:6px 10px;border:1px solid #d0d5dd;border-radius:6px;background:#fff;cursor:pointer">' + t + '</button>'; }
  function $(s) { return box.querySelector(s); }
  window.__sisNov = { show: function () { box.style.display = ''; } };
  $('.x').onclick = function (e) { e.preventDefault(); box.style.display = 'none'; };
  var FIELDS = ['cid', 'cname', 'start', 'end', 'min', 'items', 'ctext', 'ctarget', 'cev'];
  try { var sv = JSON.parse(localStorage.getItem(KEY) || '{}'); FIELDS.forEach(function (k) { if (sv[k] != null) $('.' + k).value = sv[k]; }); if (sv.need) $('.need').checked = true; } catch (e) {}
  function save() { try { var o = {}; FIELDS.forEach(function (k) { o[k] = $('.' + k).value; }); o.need = $('.need').checked; localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function log(m) { $('.log').textContent = new Date().toLocaleTimeString('ja-JP') + ' ' + m + '\n' + $('.log').textContent; }
  function state(m) { $('.state').textContent = m; }

  // ---------------------------------------------------------------- 入力
  function jp(v) { if (!v) return ''; var o = v.replace(/-/g, '/').replace('T', ' '); return v.length === 16 ? o + (/:59$/.test(o) ? ':59' : ':00') : o; } // 23:59 → 23:59:59
  function spec() {
    save();
    var items = $('.items').value.split(/\r?\n/).map(function (l) { return l.split(/\t|\s{2,}|,/).map(function (x) { return x.trim(); }); })
      .filter(function (a) { return /^\d{2}-\d{4}-\d{4}-\d{2}$/.test(a[0] || ''); })
      .map(function (a) { var base = a[0].replace(/-/g, '').slice(0, -2); return { code: a[0], name: a[1] || '', stock: a[2] || '', s: base + '-sa.jpg', l: base + '-la.jpg' }; });
    var min = $('.min').value.trim();
    var names = items.map(function (i) { return i.name.replace(/^【ノベルティ】/, ''); });
    var common = names.length ? names.reduce(function (p, c) { var i = 0; while (i < p.length && p[i] === c[i]) i++; return p.slice(0, i); }).replace(/[\s①-⑳]+$/, '') : '';
    var label = names.length > 1 ? '選べる' + (common || 'ノベルティ') : (names[0] || 'ノベルティ');
    return {
      cid: $('.cid').value.trim(), cname: $('.cname').value.trim(), start: jp($('.start').value), end: jp($('.end').value), startRaw: $('.start').value, endRaw: $('.end').value,
      min: min, need: $('.need').checked, items: items, icon: $('.icon').checked, ctarget: $('.ctarget').value, cev: $('.cev').value.trim(),
      ctext: $('.ctext').value.trim() || ('お支払商品金額、税込' + Number(min || 0).toLocaleString('ja-JP') + '円以上で「' + label + '」プレゼント!!')
    };
  }

  // ---------------------------------------------------------------- CP932（BOの取込はShift_JIS）
  var ENC = null;
  function buildEnc() {
    ENC = new Map(); var dec = new TextDecoder('shift_jis');
    for (var b = 0xA1; b <= 0xDF; b++) ENC.set(dec.decode(new Uint8Array([b])), [b]);
    for (var l = 0x81; l <= 0xFC; l++) { if (l > 0x9F && l < 0xE0) continue;
      for (var t = 0x40; t <= 0xFC; t++) { if (t === 0x7F) continue; var c = dec.decode(new Uint8Array([l, t])); if (c.length === 1 && c !== '\uFFFD' && !ENC.has(c)) ENC.set(c, [l, t]); } }
  }
  function cp932(text) {
    if (!ENC) buildEnc();
    var out = [], bad = {}, FIX = { '〜': '～', '−': '－', '‖': '∥', '¢': '￠', '£': '￡', '¬': '￢', '—': '―' };
    for (var ch of text) { ch = FIX[ch] || ch; var cp = ch.codePointAt(0);
      if (cp < 0x80) out.push(cp); else { var e = ENC.get(ch); if (e) out.push.apply(out, e); else { bad[ch] = 1; out.push(0x3F); } } }
    return { bytes: new Uint8Array(out), bad: Object.keys(bad) };
  }
  function csvText(rows) { return rows.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n') + '\r\n'; }
  function rowsOf(bytes) {
    var t = new TextDecoder('shift_jis').decode(bytes), out = [], row = [], cell = '', q = false;
    for (var i = 0; i < t.length; i++) { var ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); out.push(row); row = []; cell = ''; } else cell += ch; }
    if (cell || row.length) { row.push(cell); out.push(row); }
    return out;
  }
  function put(name, rows) { var e = cp932(csvText(rows)); if (e.bad.length) log('⚠ ' + name + '：Shift_JISにない文字を「?」にした → ' + e.bad.join(' ')); st.files[name] = e.bytes; return e.bytes; }

  // ---------------------------------------------------------------- BOとのやりとり（画面と同じフォームを送る）
  async function exportTable(table, extra) {
    var fd = new FormData(), base = { table: table, rules: '', goods: '', gname: '', keyword: '', event: '', accessory_goods: '', status: '', format: 'CSV', header: '1', 'export.x': '10', 'export.y': '10' };
    Object.keys(extra || {}).forEach(function (k) { base[k] = extra[k]; });
    Object.keys(base).forEach(function (k) { fd.append(k, base[k]); });
    var r = await fetch(BO + '/import/exp_goods.aspx', { method: 'POST', body: fd, credentials: 'include' });
    if (!/csv/.test(r.headers.get('content-type') || '')) {
      var t = await r.text();
      if (/<title>[^<]*ログイン/.test(t)) throw new Error('ログインが切れている（' + table + '）');
      if (/該当/.test(t)) return new Uint8Array(0); // 該当なし＝0件
      throw new Error('エクスポートできない（' + table + '）');
    }
    return new Uint8Array(await r.arrayBuffer());
  }
  async function importFile(table, name, bytes) {
    var page = BO + '/import/imp_goods.aspx';
    var h = await (await fetch(page, { credentials: 'include', cache: 'no-store' })).text();
    if (/ログイン/.test((h.match(/<title>([^<]*)/) || [])[1] || '')) throw new Error('ログインが切れている');
    var opendt = (h.match(/name="opendt"\s+value="([^"]*)"/) || [])[1];
    var fd = new FormData(); fd.append('table', table); fd.append('txtFile', new Blob([bytes], { type: 'text/csv' }), name);
    fd.append('header', '1'); fd.append('format', 'CSV'); if (opendt) fd.append('opendt', opendt); fd.append('cmdUpload', '取込');
    var r = await fetch(page, { method: 'POST', body: fd, credentials: 'include' }), t = await r.text();
    var d = new DOMParser().parseFromString(t, 'text/html'), msg = ((d.querySelector('#content') || d.body || {}).textContent || t).replace(/\s+/g, ' ').trim().slice(0, 300);
    var err = /エラー|失敗|できません|不正/.test(msg) && !/エラー\s*[:：]?\s*0\s*件/.test(msg);
    return { ok: r.ok && !err, msg: msg };
  }
  function imgOk(u) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i.naturalWidth + 'x' + i.naturalHeight); }; i.onerror = function () { ok(''); }; i.src = u + '?t=' + Date.now(); }); }
  async function campaigns() { // キャンペーン一覧（1〜4ページ）→ [{id,name,from,to,status}]
    var out = [];
    for (var p = 1; p <= 4; p++) {
      var h = await (await fetch(BO + '/promotion/list.aspx' + (p > 1 ? '?page=' + p : ''), { credentials: 'include', cache: 'no-store' })).text();
      var d = new DOMParser().parseFromString(h, 'text/html');
      [].forEach.call(d.querySelectorAll('tr'), function (tr) { var td = tr.querySelectorAll('td'); if (td.length < 7) return;
        var per = td[3].textContent.replace(/\s+/g, ' ').match(/(\d{4}\/\d\d\/\d\d \d\d:\d\d:\d\d).*?(\d{4}\/\d\d\/\d\d \d\d:\d\d:\d\d)/); if (!per) return;
        out.push({ id: td[0].textContent.trim(), name: td[1].textContent.trim(), from: per[1], to: per[2], status: td[6].textContent.trim() }); });
      if (!/次へ/.test(h) || out.length >= 98) break;
    }
    var seen = {}; return out.filter(function (c) { if (seen[c.id]) return false; seen[c.id] = 1; return true; });
  }

  // ---------------------------------------------------------------- チェック
  function ck(id, label, bad, impact) { st.checks.push([id, label, bad.length ? '要確認' : 'OK', bad.length, bad.length ? impact : '', bad.slice(0, 20).join(' / ')]); if (bad.length) log('⚠ ' + id + ' ' + label + '：' + bad.slice(0, 5).join(' / ')); }
  async function check() {
    var s = spec(); st.checks = [['#', '確認すること', '結果', '件数', '放置すると', '該当']];
    ck('N01', '開始・終了・最低金額・キャンペーンIDが空', [!s.start && '開始', !s.end && '終了', !s.min && '最低金額', !s.cid && 'キャンペーンID', !s.cname && 'キャンペーン名'].filter(Boolean), '登録できない／全員に付く');
    ck('N02', '終了が開始より前', s.start && s.end && s.end <= s.start ? [s.start + ' → ' + s.end] : [], 'すぐ終わる');
    ck('N03', 'ノベルティが0件または6件以上', s.items.length < 1 || s.items.length > 5 ? [s.items.length + '件'] : [], 'メルカートの選択肢は5つまで（10/13 stg実測）');
    ck('N04', '在庫が0か空', s.items.filter(function (i) { return !(+i.stock > 0); }).map(function (i) { return i.code; }), '在庫0だと付与されない（選択肢にも出ない）');
    // 選択画面の並びは決められない（10/24 stg実測：品番順でも並び順でも名前順でもなく、BO内部の登録順。0031→0033→0032 と出た）
    ck('N05', '商品名に①②③や「柄1」などの番号が入っている', s.items.length > 1 ? s.items.filter(function (i) { return /[①-⑳]|柄\s*\d|No\.?\s*\d/.test(i.name); }).map(function (i) { return i.name; }) : [], '選択画面の並びは指定できないため、番号を入れると①③②のように並ぶ（10/15 15周年で発生）。名前だけにする');
    var noImg = [];
    for (var i of s.items) { if (!(await imgOk(SHOP + '/img/goods/S/' + i.s))) noImg.push(i.s); if (!(await imgOk(SHOP + '/img/goods/L/' + i.l))) noImg.push(i.l); }
    ck('N06', '画像がこの環境にない（' + SHOP.replace('https://', '') + '）', noImg, '選択画面・注文に画像が出ない。CMS＞ファイル管理 /img/goods/s・/l に上げる');
    var exist = [];
    for (var j of s.items) { var r = rowsOf(await exportTable('tmpgoodscustom2', { goods: j.code })); if (r.length > 1 && r.slice(1).some(function (x) { return x[0] === j.code; })) exist.push(j.code); }
    ck('N07', '同じ品番の商品がすでにある（上書きになる）', exist, '既存の在庫・日付を上書きする。意図どおりか確認');
    var cs = await campaigns(), clash = [];
    cs.forEach(function (c) { if (!/有効/.test(c.status) || c.id === s.cid) return; if (!/novelty|ノベルティ|fair|フェア/i.test(c.id + c.name)) return;
      if (s.start && s.end && c.from < s.end && c.to > s.start) clash.push(c.id + ' ' + c.name + '（' + c.from + '〜' + c.to + '）'); });
    ck('N08', '期間が重なる有効なノベルティ・フェアのキャンペーン', clash, '先に登録された方が付く（10/15 湯たんぽが残りマグカップが出なかった）。前のキャンペーンの終了日時を開始の直前に');
    ck('N09', '同じキャンペーンIDがすでにある', cs.filter(function (c) { return c.id === s.cid; }).map(function (c) { return c.id + ' ' + c.status; }), '新規登録できない');
    ck('N10', '開始が12:00ちょうどでない', s.start && !/ 12:00:00$/.test(s.start) ? [s.start] : [], 'メール・LINEの時刻とずれる（通常は12:00）');
    put('90_チェック表_' + (s.cid || 'novelty') + '.csv', st.checks);
    var ng = st.checks.slice(1).filter(function (c) { return c[2] !== 'OK'; }).length;
    state('チェック：要確認 ' + ng + '件'); log('チェック完了（キャンペーン ' + cs.length + '件を確認）');
    return ng;
  }

  // ---------------------------------------------------------------- ファイル
  function goodsRows(s) {
    var rows = [H167];
    s.items.forEach(function (it, k) {
      var r = H167.map(function (h) { return TPL[h] != null ? TPL[h] : ''; });
      var set = function (k, v) { var i = H167.indexOf(k); if (i < 0) throw new Error('列がない: ' + k); r[i] = v; };
      set('商品コード', it.code); set('商品名', it.name); set('バリエーショングループ', it.code.slice(0, -1));
      set('品番２', (+s.start.slice(5, 7) >= 3 && +s.start.slice(5, 7) <= 8) ? s.start.slice(0, 4) + 'SS' : s.start.slice(0, 4) + 'AW');
      set('品番１', s.start.slice(0, 4) + 'ﾉﾍﾞﾙﾃｨ');
      ['掲載開始日', '販売開始日', '発売日'].forEach(function (k) { set(k, s.start); });
      ['掲載終了日', '販売終了日'].forEach(function (k) { set(k, s.end); });
      set('S画像ファイル', it.s); set('Ｌ画像ファイル', it.l); set('在庫数', it.stock || '0');
      rows.push(r);
    });
    return rows;
  }
  function campRows(s) {
    var sorted = s.items.slice().sort(function (a, b) { return a.code < b.code ? -1 : 1; });
    var r = [['画面', '項目', '入れる値'],
      ['販促キャンペーン新規登録', 'キャンペーンID', s.cid], ['', 'キャンペーン名', s.cname], ['', 'キャンペーン期間', s.start + ' 〜 ' + s.end],
      ['', '状態', '有効'], ['', '並び順', '99'], ['', '参加方法', '自動参加'], ['', 'キャンペーン対象', 'ゲスト可'],
      ['特典登録', '特典タイプ', 'ノベルティ付与'], ['', 'ノベルティ不要の選択肢を表示しない', s.need ? 'チェックしない（不要も出す）' : 'チェックする']];
    sorted.forEach(function (i, k) { r.push(['', 'ノベルティ商品' + (k + 1), i.code + '　' + i.name]); });
    r.push(['', '対象商品', '任意の商品'], ['', '最低注文金額', s.min], ['終了時', 'キャンペーン', '期間で自動終了（' + s.end + '）。早く終えるときは状態を「無効」に']);
    return r;
  }
  var MARK = function (id) { return { a: '<!--SIS-NOV:' + id + '-->', b: '<!--/SIS-NOV:' + id + '-->' }; };
  function block(s) {
    var m = MARK(s.cid);
    return m.a + '<div class="sis-nov" style="margin:0 0 8px"><div style="background:#D12629;color:#fff;font-weight:900;line-height:22px;padding:0 10px">ノベルティ対象商品</div>' +
      '<div style="line-height:26px;color:#141414">' + s.ctext.replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }) + '</div></div>' + m.b;
  }
  function strip(v, id) { var m = MARK(id); var re = new RegExp(m.a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + m.b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'); return String(v || '').replace(re, ''); }
  async function commentRows(s, mode) { // mode: add / del
    var extra = s.ctarget === 'ev' ? { event: s.cev } : {};
    state('コメント：エクスポート中…（全商品だと数分）');
    var rows = rowsOf(await exportTable('tmpgoodscustom3', extra)), h = rows[0];
    if (!h) return { out: [], back: [] };
    var c1 = h.indexOf('商品コメント１'), c1s = h.indexOf('商品コメント１(スマートフォン)'), i2 = h.indexOf('アイコン２');
    if (c1 < 0 || c1s < 0 || i2 < 0) throw new Error('セールコメントのレイアウトに「商品コメント１」「商品コメント１(スマートフォン)」「アイコン２」がない');
    var codes = {}; s.items.forEach(function (i) { codes[i.code] = 1; });
    var out = [h], back = [h], busyIcon = [], legacy = [];
    rows.slice(1).forEach(function (r) {
      if (!r[0] || codes[r[0]] || r.length < h.length) return;
      var n = r.slice();
      if (mode === 'add') {
        if (/ノベルティ対象品/.test(r[c1]) && r[c1].indexOf('SIS-NOV:') < 0) legacy.push(r[0]);
        n[c1] = block(s) + strip(r[c1], s.cid); n[c1s] = block(s) + strip(r[c1s], s.cid);
        if (s.icon) { if (!r[i2]) n[i2] = 'novelty'; else if (r[i2] !== 'novelty') busyIcon.push(r[0] + '=' + r[i2]); }
      } else {
        n[c1] = strip(r[c1], s.cid); n[c1s] = strip(r[c1s], s.cid);
        if (r[i2] === 'novelty') n[i2] = '';
      }
      if (n.join('\u0001') === r.join('\u0001')) return;
      out.push(n); back.push(r);
    });
    ck(mode === 'add' ? 'N11' : 'N12', mode === 'add' ? 'アイコン2が別の値で埋まっている（付けない）' : '（撤去）対象', mode === 'add' ? busyIcon : [], '一覧でノベルティのアイコンが出ない');
    if (mode === 'add') ck('N13', '前のノベルティのコメント（手作業版）が残っている', legacy, '古いノベルティの告知と2つ並ぶ。前回分を先に外す');
    return { out: out, back: back };
  }
  function split(rows, name) { // 25MBごとに分ける
    var parts = [], cur = [rows[0]], size = 0, head = cp932(csvText([rows[0]])).bytes.length;
    rows.slice(1).forEach(function (r) { var b = cp932(csvText([r])).bytes.length; if (size + b + head > LIMIT && cur.length > 1) { parts.push(cur); cur = [rows[0]]; size = 0; } cur.push(r); size += b; });
    if (cur.length > 1) parts.push(cur);
    return parts.map(function (p, k) { var nm = name.replace(/\.csv$/, '') + (parts.length > 1 ? '_' + String(k + 1).padStart(2, '0') : '') + '.csv'; return { name: nm, bytes: put(nm, p), n: p.length - 1 }; });
  }

  // ---------------------------------------------------------------- ボタン
  async function guard(f) { try { box.querySelectorAll('button').forEach(function (b) { b.disabled = true; }); await f(); } catch (e) { state('止まりました'); log('✖ ' + e.message); } finally { box.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); } }
  $('.chk').onclick = function () { guard(check); };
  $('.make').onclick = function () { guard(async function () {
    var s = spec(); var g = put('60_取込_ノベルティ商品_' + s.cid + '.csv', goodsRows(s)); put('62_設定_キャンペーン_' + s.cid + '.csv', campRows(s));
    log('ノベルティ商品 ' + s.items.length + '件・キャンペーン設定表を作りました'); state('作成済み（「ファイルを保存」で手元に）'); }); };
  $('.goods').onclick = function () { guard(async function () {
    var s = spec(), name = '60_取込_ノベルティ商品_' + s.cid + '.csv', b = put(name, goodsRows(s));
    if (!IS_STG && !confirm('本番にノベルティ商品 ' + s.items.length + '件を取り込みます。よろしいですか？\n掲載開始 ' + s.start + '（それまでお客様には見えません）')) return;
    state('取込中…'); var r = await importFile('tmpgoods', name, b); log((r.ok ? '✔ ' : '✖ ') + 'ノベルティ商品の取込：' + r.msg); state(r.ok ? 'ノベルティ商品を取り込みました' : '取込に失敗'); }); };
  $('.camp').onclick = function () { guard(async function () {
    var s = spec(), w = window.open(BO + '/promotion/sales.aspx?mode=regist', 'sisnov_camp', 'width=880,height=900');
    if (!w) throw new Error('小窓を開けない（ポップアップを許可してください）');
    await new Promise(function (ok) { var t = setInterval(function () { try { if (w.document && w.document.readyState === 'complete' && w.document.querySelector('input[name=promotion]')) { clearInterval(t); ok(); } } catch (e) {} }, 300); });
    var d = w.document, v = function (n, x) { var e = d.querySelector('[name="' + n + '"]'); if (e) { e.value = x; e.dispatchEvent(new Event('change', { bubbles: true })); } };
    var rd = function (n, x) { var e = d.querySelector('input[name="' + n + '"][value="' + x + '"]'); if (e) e.click(); };
    v('promotion', s.cid); v('name', s.cname); v('s_dt', s.start); v('f_dt', s.end); rd('status', '0'); v('seq', '99'); rd('apply', '0'); rd('target', '0');
    log('キャンペーンの小窓に入力しました →［登録する］を押してください。続けて「特典登録」でノベルティ付与：' + s.items.map(function (i) { return i.code; }).sort().join(', ') + '／最低 ' + s.min + '円／不要の選択肢 ' + (s.need ? '出す' : '出さない'));
    state('小窓の［登録する］を押してください'); }); };
  $('.bonus').onclick = function () { guard(async function () {
    var s = spec(), w = window.open(BO + '/promotion/detail.aspx?promotion=' + encodeURIComponent(s.cid), 'sisnov_bonus', 'width=820,height=900');
    if (!w) throw new Error('小窓を開けない（ポップアップを許可してください）');
    var ready = function (sel) { return new Promise(function (ok, ng) { var n = 0, t = setInterval(function () { try { if (w.document && w.document.readyState === 'complete' && w.document.querySelector(sel)) { clearInterval(t); ok(); } } catch (e) {} if (++n > 60) { clearInterval(t); ng(new Error('特典の画面が開かない（キャンペーンを先に登録）')); } }, 300); }); };
    await ready('input[name=type]');
    var d = w.document, t8 = d.querySelector('input[name=type][value="8"]'); if (t8 && !d.querySelector('input[name=novelty_goods1]')) t8.click();
    await ready('input[name=novelty_goods1]'); d = w.document;
    var v = function (n, x) { var e = d.querySelector('[name="' + n + '"]'); if (e) { e.value = x; e.dispatchEvent(new Event('change', { bubbles: true })); } };
    s.items.slice().sort(function (a, b) { return a.code < b.code ? -1 : 1; }).forEach(function (i, k) { v('novelty_goods' + (k + 1), i.code); });
    var rq = d.querySelector('input[name=required_novelty]'); if (rq) rq.checked = !s.need;
    var ga = d.querySelector('input[name=goods_type][value=all]'); if (ga) ga.click();
    v('min_price', s.min);
    log('特典の小窓に入力しました（ノベルティ付与・' + s.items.length + '種・最低 ' + s.min + '円・不要の選択肢 ' + (s.need ? '出す' : '出さない') + '）→［登録する］を押してください');
    state('特典の小窓の［登録する］を押してください'); }); };
  $('.add').onclick = function () { guard(async function () {
    var s = spec(); if (s.ctarget === 'none') { log('コメント対象＝付けない'); return; }
    var c = await commentRows(s, 'add'); if (c.out.length < 2) { log('付ける対象がありません'); return; }
    put('51_戻し_コメント_' + s.cid + '.csv', c.back);
    var parts = split(c.out, '50_取込_コメント付与_' + s.cid + '.csv');
    log('付与ファイル ' + parts.length + '本（' + (c.out.length - 1) + '商品）・戻しファイルを作りました');
    if (!IS_STG && !confirm('本番の ' + (c.out.length - 1) + '商品にノベルティのコメントを付けます（' + parts.length + '回に分けて取込）。よろしいですか？')) return;
    for (var p of parts) { state('取込中… ' + p.name); var r = await importFile('tmpgoodscustom3', p.name, p.bytes); log((r.ok ? '✔ ' : '✖ ') + p.name + '：' + r.msg); if (!r.ok) throw new Error('取込に失敗。戻しファイル（51_戻し）で元に戻せます'); }
    state('コメントを付けました'); }); };
  $('.del').onclick = function () { guard(async function () {
    var s = spec(); var c = await commentRows(s, 'del'); if (c.out.length < 2) { log('外す対象がありません（' + s.cid + ' の印が付いた商品なし）'); state('外す対象なし'); return; }
    put('53_戻し_撤去前_' + s.cid + '.csv', c.back);
    var parts = split(c.out, '52_取込_コメント撤去_' + s.cid + '.csv');
    if (!IS_STG && !confirm('本番の ' + (c.out.length - 1) + '商品からノベルティのコメントを外します。よろしいですか？')) return;
    for (var p of parts) { state('取込中… ' + p.name); var r = await importFile('tmpgoodscustom3', p.name, p.bytes); log((r.ok ? '✔ ' : '✖ ') + p.name + '：' + r.msg); if (!r.ok) throw new Error('取込に失敗'); }
    state('コメントを外しました'); }); };
  $('.dl').onclick = function () { Object.keys(st.files).forEach(function (n, i) { setTimeout(function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([st.files[n]], { type: 'text/csv' })); a.download = n; a.click(); }, i * 400); }); };
  log('準備OK（' + (IS_STG ? 'stg' : '本番') + '）。1→2→3→4→5の順。終了時は6');
})();
