/* SIS 会員ランク特典（月初）— T-35（#SP-1M）
 * 毎月1日7時のランク更新のあと（1日〜3営業日以内）に、BOでブックマーク →「会員ランク特典（月初）」→ 開くと自動で読み込み → ①グループとクーポンを作成 → ②メール送信を進める。
 * やること：今月のランク・生年月日を会員検索から読む → 12グループに振り分け → 会員グループ取込（グループ→メンバー）→ 人数照合
 *          → クーポン9種（お誕生日5・とこトンとん得々4）を作成。お知らせメール3通は「宛先を開く」から送る。
 * 月末23:50のバックアップは不要：先月のVIPigは「先月1日に作った YYYY-MM会員ランクVIPIG グループ」から読む（ランクは1日7時にしか変わらない）。
 * 「宛先を開く」は会員一覧を最大件数30000で開く（そこから［メール送信］→テンプレート）。
 * 何度押しても二重にならない：今月のグループ・クーポンが既にあれば作らずに飛ばす。途中で止まっても、もう一度①で続きから。
 * ルールは member_tools.py（9/1・10/1の実取込と照合済み）と同じ。前提：会員検索の「表示項目の選択」に 会員ランク・生年月日。
 */
(function () {
  'use strict';
  var VER = 'T35 v2.12 (2026-11-01)';
  var BO = location.pathname.split('/').slice(0, 2).join('/');
  var STG = /mercart-stg/.test(location.hostname);
  var C1 = STG ? '#2b8a3e' : '#d9480f', C2 = STG ? '#ebfbee' : '#fff4e6';
  var old = document.getElementById('sis35'); if (old) old.remove();
  var now = new Date(), ymNow = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);
  var box = document.createElement('div'); box.id = 'sis35';
  box.innerHTML =
    '<style>#sis35{position:fixed;right:12px;top:12px;z-index:2147483000;width:600px;max-width:calc(100vw - 24px);max-height:92vh;overflow:auto;background:#fff;border:2px solid ' + C1 + ';border-radius:10px;font:13px/1.5 sans-serif;color:#222;box-shadow:0 4px 16px rgba(0,0,0,.2)}' +
    '#sis35 .hd{padding:8px 12px;background:' + C2 + ';font-weight:bold;display:flex;justify-content:space-between}#sis35 .bd{padding:10px 12px}' +
    '#sis35 table{border-collapse:collapse;width:100%;font-size:12px;margin-top:6px}#sis35 td,#sis35 th{border-bottom:1px solid #eee;padding:3px 4px;text-align:left;vertical-align:top}' +
    '#sis35 .ok{color:#2b8a3e;font-weight:bold}#sis35 .ng{color:#c92a2a;font-weight:bold}#sis35 .wa{color:#e8590c;font-weight:bold}#sis35 .mu{color:#868e96}' +
    '#sis35 button{padding:8px 12px;margin:8px 6px 0 0;border-radius:6px;border:1px solid #888;background:#f8f8f8;cursor:pointer}#sis35 button.go{background:' + C1 + ';color:#fff;border:none;font-weight:bold}#sis35 button:disabled{opacity:.45;cursor:not-allowed}#sis35 .bz .hd2{color:#1971c2;font-weight:bold}#sis35 .bz ol{margin:4px 0 0;padding:0;list-style:none}#sis35 .bz li{padding:2px 6px;border-radius:4px;color:#adb5bd}#sis35 .bz li.now{background:#e7f5ff;color:#1971c2;font-weight:bold}#sis35 .bz li.done{color:#2b8a3e}#sis35 button.nx{outline:3px solid #fd7e14;outline-offset:2px}#sis35 button.dn{background:#dee2e6;color:#868e96;border:1px solid #ced4da;font-weight:normal}' +
    '#sis35 h4{margin:12px 0 2px;font-size:13px}#sis35 pre{white-space:pre-wrap;background:#f6f6f6;padding:6px;max-height:160px;overflow:auto;margin:8px 0 0;font-size:11px}#sis35 a{color:#1971c2}</style>' +
    '<div class="hd"><span>SIS 会員ランク特典（月初）（' + (STG ? 'stg 検証環境' : '本番') + '）</span><span title="' + VER + '"><a href="#" class="x" style="color:#222;text-decoration:none">×</a></span></div>' +
    '<div class="bd"><div>対象月：<input class="ym" value="' + ymNow + '" style="width:80px"> の月初分</div>' +
    '<button class="ck" style="display:none"></button><button class="run go" disabled>①グループとクーポンを作成</button><button class="mail go" disabled>②メール送信を進める</button><button class="undo" style="display:none">クーポンを取り消す</button>' +
    '<div class="bz" style="display:none;margin-top:8px"></div><div class="pv"></div><div class="ml"></div><pre class="log" style="display:none"></pre></div>';
  document.body.appendChild(box);
  var $ = function (s) { return box.querySelector(s); };
  $('.x').onclick = function (e) { e.preventDefault(); box.remove(); };
  function log(m) { console.log('[SIS35]', m); $('.log').textContent = new Date().toLocaleTimeString('ja-JP') + ' ' + m + '\n' + $('.log').textContent; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // ---------- Shift_JIS（BOの取込はShift_JIS） ----------
  var ENC = null;
  function sjis(str) {
    if (!ENC) {
      ENC = new Map(); var dec = new TextDecoder('shift_jis');
      for (var b1 = 0x81; b1 <= 0xFC; b1++) { if (b1 > 0x9F && b1 < 0xE0) continue;
        for (var b2 = 0x40; b2 <= 0xFC; b2++) { if (b2 === 0x7F) continue; var s = dec.decode(new Uint8Array([b1, b2])); if (s.length === 1 && s !== '�' && !ENC.has(s)) ENC.set(s, [b1, b2]); } }
      for (var b = 0xA1; b <= 0xDF; b++) ENC.set(dec.decode(new Uint8Array([b])), [b]);
    }
    var out = [];
    for (var ch of str) { var c = ch.codePointAt(0); if (c < 0x80) { out.push(c); continue; } var x = ENC.get(ch); if (!x) throw new Error('Shift_JISにできない文字: ' + ch); out.push.apply(out, x); }
    return new Uint8Array(out);
  }
  function csvLine(r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }
  function parseCSV(t) {
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < t.length; i++) { var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += c; }
    if (f || row.length) { row.push(f.replace(/\r$/, '')); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim(); }); });
  }

  // ---------- BOの画面を裏で使う ----------
  async function doc(path) {
    var d = new DOMParser().parseFromString(await (await fetch(BO + '/' + path, { credentials: 'include', cache: 'no-store' })).text(), 'text/html');
    if (!d.forms[0]) throw new Error('BOの画面を開けない（ログイン切れの可能性）: ' + path.split('?')[0]);
    return d;
  }
  function fdOf(form) {
    var fd = new FormData();
    for (var e of form.elements) { if (!e.name || e.disabled) continue;
      if ((e.type === 'checkbox' || e.type === 'radio') && !e.checked) continue;
      if (e.type === 'submit' || e.type === 'button' || e.type === 'file') continue; fd.append(e.name, e.value); }
    return fd;
  }
  // 画面のJSが足す項目（会員検索の表示項目など）が要る画面は、見えないiframeで実際に開く
  function live(path, read) {
    return new Promise(function (ok, ng) {
      var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:-9999px;width:800px;height:600px';
      var t = setTimeout(function () { fr.remove(); ng(new Error('画面が開けない: ' + path)); }, 30000);
      fr.onload = function () { setTimeout(function () { clearTimeout(t);
        try { var d = fr.contentDocument; if (!d || !d.forms[0]) throw new Error('ログイン切れの可能性'); var v = read(d); fr.remove(); ok(v); } catch (e) { fr.remove(); ng(e); } }, 1200); };
      fr.src = BO + '/' + path; document.body.appendChild(fr);
    });
  }
  async function members(cond) {
    var fd = await live('customer/search.aspx', function (d) { return new FormData(d.forms[0]); });
    fd.set('mode', 'CSV'); fd.set('max', '30000'); fd.set('cmdsearch', '1'); fd.set('searched', '1');
    Object.keys(cond || {}).forEach(function (k) { fd.set(k, cond[k]); });
    var t = '';
    for (var i = 0; i < 4; i++) { // 「The service is unavailable.」が一時的に返ることがある（2026-11-01 本番実測）
      t = new TextDecoder('shift_jis').decode(await (await fetch(BO + '/customer/search.aspx', { method: 'POST', body: fd, credentials: 'include' })).arrayBuffer());
      if (!/service is unavailable/i.test(t)) break; await sleep(10000);
    }
    var rows = parseCSV(t);
    if (!rows.length || (rows[0].indexOf('会員番号') < 0 && t.length < 500)) return [];
    var h = rows[0], iNo = h.indexOf('会員番号'), iR = h.indexOf('会員ランク'), iB = h.indexOf('生年月日');
    if (iNo < 0) throw new Error('会員検索のCSVが取れない（ログイン切れの可能性）');
    if (iR < 0 || iB < 0) throw new Error('会員検索の「表示項目の選択」に「会員ランク」「生年月日」を入れてから、ツールを開き直してください');
    return rows.slice(1).map(function (r) { return { no: (r[iNo] || '').trim(), rank: (r[iR] || '').trim(), birth: (r[iB] || '').trim() }; });
  }
  async function groupList(word) {
    var d = await doc('customergroup/list.aspx');
    return [].slice.call(d.querySelectorAll('a')).filter(function (a) { return a.textContent.indexOf(word) >= 0; }).map(function (a) {
      return { name: a.textContent.trim(), count: +((a.parentElement.textContent.match(/\((\d+)\)/) || [])[1] || 0), href: a.getAttribute('href') };
    });
  }
  function importLog() {
    return live('import/imp_customergroup.aspx', function (d) {
      return [].slice.call(d.querySelectorAll('tr')).map(function (tr) { return [].slice.call(tr.cells).map(function (c) { return c.textContent.trim().replace(/\s+/g, ' '); }); })
        .filter(function (c) { return /20\d\d\/\d\d\/\d\d \d/.test(c[0] || ''); }).map(function (c) { return { status: c[1], file: c[2], end: c[4] }; });
    });
  }
  async function importCSV(table, header, rows) {
    var d = await doc('import/imp_customergroup.aspx'), f = d.forms[0], fd = fdOf(f);
    fd.set('table', table); fd.set('header', '1'); fd.set('format', 'CSV'); fd.delete('initialize');
    var name = 'sis35_' + table + '_' + Date.now() + '.csv';
    fd.set('txtFile', new Blob([sjis([header].concat(rows).map(csvLine).join('\r\n') + '\r\n')], { type: 'text/csv' }), name);
    fd.set('cmdUpload', f.querySelector('[name=cmdUpload]').value);
    await (await fetch(BO + '/import/imp_customergroup.aspx', { method: 'POST', body: fd, credentials: 'include' })).text();
    log('取込を送信：' + (table === 'tmpcustomergrp' ? 'グループ' : 'メンバー') + ' ' + rows.length + '行');
    for (var i = 0; i < 60; i++) { // 最大8分
      await sleep(8000);
      var me = (await importLog()).filter(function (x) { return x.file === name; })[0];
      if (me && /success/i.test(me.status)) { log('取込完了（success）'); return; }
      if (me && /error|fail|エラー/i.test(me.status)) throw new Error('取込エラー：' + me.status + '（会員グループインポートの処理状況ログを確認）');
    }
    throw new Error('取込が8分で終わらない（会員グループインポートの処理状況ログを確認し、終わってからもう一度①）');
  }
  async function couponList(prefix) {
    var d = await doc('coupon/event_list.aspx?coupon_event=' + encodeURIComponent(prefix) + '&cmdSearch=1');
    return [].slice.call(d.querySelectorAll('tr')).map(function (tr) { return [].slice.call(tr.cells).map(function (c) { return c.textContent.trim().replace(/\s+/g, ' '); }); })
      .filter(function (c) { return c[1] && c[1].indexOf(prefix) === 0; }).map(function (c) { return { id: c[1], name: c[2], term: c[3], count: c[5], bonus: c[6], status: c[7] }; });
  }
  // 先月の同じクーポンの「フリースペース・備考・再利用・スマホ同一」を引き継ぐ（無ければ空のまま）
  // 先月の同じクーポンの設定（除外商品・対象条件・フリースペース・再利用など）を丸ごと読む。無ければ null
  async function prevCouponExtras(id) {
    try {
      var d = await doc('coupon/event_detail.aspx?mode=update&coupon_type=1&coupon_event=' + encodeURIComponent(id));
      var f = d.forms[0], fd = new FormData(f); if (fd.get('coupon_event') !== id) return null;
      var e = []; fd.forEach(function (v, k) { e.push([k, String(v)]); });
      var xg = []; e.forEach(function (x) { var m = x[0].match(/^x_goods_(\d+)$/); if (m && x[1].trim()) xg.push({ code: x[1].trim(), name: (e.filter(function (y) { return y[0] === 'x_gname_' + m[1]; })[0] || [0, ''])[1] }); });
      return { entries: e, xg: xg, xgoods: xg.map(function (g) { return g.name || g.code; }),
               xterm: e.some(function (x) { return x[0] === 'condition_x_term' && x[1] && x[1] !== 'false'; }) };
    } catch (e) { return null; }
  }
  var XG = /^(x_goods_|x_gname_|condition_x_goods$)/;
  var SKIP = /^(__|mode$|coupon_type$|coupon_event$|name$|customer_group_name$|coupon_count$|s_dt$|f_dt$|x_s_dt$|x_f_dt$|condition_x_term$|amount|cmd|bonus_type_dummy$|customer_allotment_dummy$|smartphone_is_pc$|is_coupon_return$)/;
  function condSig(entries) { // 引き継ぐ条件の中身（照合用）
    return entries.filter(function (x) { return !SKIP.test(x[0]) && x[1] !== '' && !/^(bonus_type|coupon_cut_price|coupon_cut_ratio|coupon_point_ratio|customer_allotment|status|condition_term)$/.test(x[0]); })
      .filter(function (x) { return !XG.test(x[0]); }).map(function (x) { return x[0] + '=' + x[1]; }).sort().join('|');
  }
  function xgSig(list) { return list.map(function (g) { return g.code; }).sort().join('|'); }
  async function createCoupon(c, prev, xg) { // xg＝除外商品（ツールで決めた最終の一覧）
    var path = 'coupon/event_detail.aspx?mode=regist&coupon_type=1';
    var d = await doc(path), f = d.forms[0], fd = fdOf(f);
    if (prev) {
      prev.entries.forEach(function (x) { if (!SKIP.test(x[0])) fd.set(x[0], x[1]); });
      var has = function (n) { return prev.entries.some(function (x) { return x[0] === n; }); };
      if (has('smartphone_is_pc')) fd.set('smartphone_is_pc', '1'); else fd.delete('smartphone_is_pc');
      if (has('is_coupon_return')) fd.set('is_coupon_return', '1'); else fd.delete('is_coupon_return');
    } else fd.set('smartphone_is_pc', '1');
    [].slice.call(fd.keys()).filter(function (k) { return /^(x_goods_|x_gname_)\d+$/.test(k); }).forEach(function (k) { fd.set(k, ''); });
    xg.forEach(function (g, i) { fd.set('x_goods_' + (i + 1), g.code); fd.set('x_gname_' + (i + 1), g.name || ''); });
    if (xg.length) fd.set('condition_x_goods', 'true'); else fd.delete('condition_x_goods');
    fd.set('coupon_event', c.id); fd.set('name', c.name);
    fd.set('bonus_type', c.kind === 'yen' ? '0' : '1'); fd.set(c.kind === 'yen' ? 'coupon_cut_price' : 'coupon_cut_ratio', String(c.v));
    fd.set('customer_allotment', '0'); fd.set('customer_group_name', c.group);
    fd.set('condition_term', 'true'); fd.set('s_dt', c.s); fd.set('f_dt', c.f); fd.set('status', '0');
    fd.set('cmdInsert', f.querySelector('[name=cmdInsert]').value);
    var t = new DOMParser().parseFromString(await (await fetch(BO + '/' + path, { method: 'POST', body: fd, credentials: 'include' })).text(), 'text/html').body.textContent.replace(/\s+/g, ' ');
    var err = (t.match(/[^ ]{0,30}(入力して|できません|存在しません|エラー|不正|重複)[^ ]{0,30}/) || [''])[0];
    if (err) throw new Error('クーポン ' + c.id + ' を作れない：' + err);
    var mine = await prevCouponExtras(c.id); // 作ったクーポンを読み戻して確かめる
    if (!mine) throw new Error('クーポン ' + c.id + ' を読み戻せない。クーポンイベント管理で確認');
    if (prev && condSig(mine.entries) !== condSig(prev.entries)) throw new Error('クーポン ' + c.id + ' の条件が先月と違う。クーポンイベント管理で確認');
    if (xgSig(mine.xg) !== xgSig(xg)) throw new Error('クーポン ' + c.id + ' の除外商品が入っていない（' + mine.xg.length + '/' + xg.length + '件）。クーポンイベント管理で確認');
  }
  // ---------- ルール（member_tools.py と同じ） ----------
  var EXCLUDE = '不正クレジット使用不可会員', KOBUTA = ['こぶた', 'こぶた(CP)'], RANK4 = ['おしゃれぶた', 'セレブぶた', 'ぶたのおひめさま', 'VIPIG'];
  var KNOWN = ['こぶた', 'おしゃれぶた', 'セレブぶた', 'ぶたのおひめさま', 'VIPig', 'こぶた(CP)', EXCLUDE, 'ゲスト', 'クレジット、paypayのみ可', 'close', 'test', 'テスト', 'クレジット注文のみ可'];
  var up = function (s) { return (s || '').toUpperCase(); };
  var BDAY5 = function (r) { return KOBUTA.indexOf(r) >= 0 || RANK4.indexOf(up(r)) >= 0; }; // お誕生日クーポンがあるランク
  function bmonth(s) { if (!s) return null; var m = s.match(/^\d{4}[\/-](\d{1,2})[\/-]\d{1,2}/); return m ? +m[1] : '?'; }
  function prevYm(ym) { var p = ym.split('-').map(Number), y = p[0], m = p[1] - 1; if (!m) { m = 12; y--; } return y + '-' + ('0' + m).slice(-2); }
  function build(ym, mem, prev, keepAll) {
    var m = +ym.split('-')[1], isb = function (b) { return b === m; };
    var G = [
      [ym + '会員ランクおしゃれぶた', '非誕生日グループ', function (x) { return x.rank === 'おしゃれぶた'; }],
      [ym + '会員ランクセレブ', '非誕生日グループ', function (x) { return x.rank === 'セレブぶた'; }],
      [ym + '会員ランクぶたのおひめさま', '非誕生日グループ', function (x) { return x.rank === 'ぶたのおひめさま'; }],
      [ym + '会員ランクVIPIG', '非誕生日グループ', function (x) { return up(x.rank) === 'VIPIG'; }],
      ['【☆' + ym + '誕生日】こぶた', '誕生日グループ', function (x) { return isb(x.b) && KOBUTA.indexOf(x.rank) >= 0; }],
      ['【☆' + ym + '誕生日】おしゃれぶた', '誕生日グループ', function (x) { return isb(x.b) && x.rank === 'おしゃれぶた'; }],
      ['【☆' + ym + '誕生日】セレブ', '誕生日グループ', function (x) { return isb(x.b) && x.rank === 'セレブぶた'; }],
      ['【☆' + ym + '誕生日】ぶたのおひめさま', '誕生日グループ', function (x) { return isb(x.b) && x.rank === 'ぶたのおひめさま'; }],
      ['【☆' + ym + '誕生日】VIPIG', '誕生日グループ', function (x) { return isb(x.b) && up(x.rank) === 'VIPIG'; }],
      [ym + '得々クーポン配布メール', '非誕生日グループ全員', function (x) { return RANK4.indexOf(up(x.rank)) >= 0; }],
      [ym + '誕生日クーポン配布メール', '誕生日グループ全員', function (x) { return isb(x.b) && BDAY5(x.rank); }],
      ['【' + ym + 'ランクキープ】VIPIG', keepAll ? '今月VIPIG全員' : '2ヶ月連続VIPIG', function (x) { return up(x.rank) === 'VIPIG' && (keepAll || prev.has(x.no)); }]
    ];
    var ms = mem.map(function (x) { return { no: x.no, rank: x.rank, b: bmonth(x.birth) }; });
    var assign = [], counts = {};
    G.forEach(function (g) { var a = ms.filter(function (x) { return x.rank !== EXCLUDE && g[2](x); }); a.forEach(function (x) { assign.push([g[0], x.no]); }); counts[g[0]] = a.length; });
    var rc = {}; ms.forEach(function (x) { rc[x.rank] = (rc[x.rank] || 0) + 1; });
    var unk = Object.keys(rc).filter(function (r) { return KNOWN.indexOf(r) < 0; });
    var nb = ms.filter(function (x) { return isb(x.b) && BDAY5(x.rank); }).length, nbOut = ms.filter(function (x) { return isb(x.b) && !BDAY5(x.rank) && x.rank !== EXCLUDE; }).length;
    var bt = G.slice(4, 9).reduce(function (s, g) { return s + counts[g[0]]; }, 0), rt = G.slice(0, 4).reduce(function (s, g) { return s + counts[g[0]]; }, 0);
    var dup = ms.length - new Set(ms.map(function (x) { return x.no; })).size, badb = ms.filter(function (x) { return x.b === '?'; }).length;
    var checks = [
      ['今月の会員数', ms.length, ms.length >= (STG ? 1 : 15000) ? 'OK' : 'NG', '少なすぎる＝会員検索が読めていない'],
      ['先月のVIPig（' + prevYm(ym) + '会員ランクVIPIG グループ）', prev.size, prev.size || keepAll ? 'OK' : 'NG', '0人だとランクキープのお礼メールの宛先が空になる'],
      ['読めないランク名', unk.join('・') || 0, unk.length ? 'NG' : 'OK', '新しいランクができた可能性（増田へ）'],
      ['生年月日が日付でない', badb, badb ? 'NG' : 'OK', '誕生日グループから漏れる'],
      ['会員番号の重複', dup, dup ? 'NG' : 'OK', ''],
      ['誕生日5グループの合計＝誕生日メールの人数', bt + ' / ' + counts[G[10][0]], bt === counts[G[10][0]] && bt === nb ? 'OK' : 'NG', ''],
      ['誕生月だがクーポンの無いランク（ゲスト等・取り込まない）', nbOut, 'OK', ''],
      ['得々メールの人数＝ランク別4グループの合計', counts[G[9][0]] + ' / ' + rt, counts[G[9][0]] === rt ? 'OK' : 'NG', '']
    ];
    return { ym: ym, groups: G.map(function (g) { return [g[0], g[1]]; }), assign: assign, counts: counts, checks: checks, ok: checks.every(function (c) { return c[2] === 'OK'; }) };
  }
  function coupons(ym) {
    var p = ym.split('-').map(Number), y = p[0], m = p[1], mm = ('0' + m).slice(-2), last = new Date(y, m, 0).getDate();
    var s = y + '/' + mm + '/01 00:00:00', f = y + '/' + mm + '/' + last + ' 23:59:59';
    return [
      ['hbkobuta500', 'お誕生日クーポン(こぶた会員)', 'yen', 500, '【☆' + ym + '誕生日】こぶた'],
      ['hbosya10off', 'お誕生日クーポン(おしゃれぶた会員)', 'pct', 10, '【☆' + ym + '誕生日】おしゃれぶた'],
      ['hbcel10off', 'お誕生日クーポン(セレブぶた会員)', 'pct', 10, '【☆' + ym + '誕生日】セレブ'],
      ['hbqu15off', 'お誕生日クーポン(ぶたのおひめさま会員)', 'pct', 15, '【☆' + ym + '誕生日】ぶたのおひめさま'],
      ['hbvip20off', 'お誕生日クーポン(VIPIG会員)', 'pct', 20, '【☆' + ym + '誕生日】VIPIG'],
      ['osya10off', 'とこトンとん得々クーポン(おしゃれぶた会員)', 'pct', 10, ym + '会員ランクおしゃれぶた'],
      ['cel10off', 'とこトンとん得々クーポン(セレブぶた会員)', 'pct', 10, ym + '会員ランクセレブ'],
      ['qu15off', 'とこトンとん得々クーポン(ぶたのおひめさま会員)', 'pct', 15, ym + '会員ランクぶたのおひめさま'],
      ['vip20off', 'とこトンとん得々クーポン(VIPig会員)', 'pct', 20, ym + '会員ランクVIPIG']
    ].map(function (r) { return { tail: r[0], id: ym + r[0], name: y + '年' + m + '月' + r[1], kind: r[2], v: r[3], group: r[4], s: s, f: f }; });
  }

  // ---------- 画面 ----------
  var S = null;
  function st(ex, want, unit) { // 状態：未作成／作成済（誰かが先に作っていないかを見る）
    if (ex == null) return '<td>未作成</td>';
    if (want == null || +ex === want) return '<td class="ok">作成済</td>';
    return '<td class="ng">作成済・' + unit + 'が違う（' + esc(ex) + '）</td>';
  }
  function render() {
    var r = S.res, ng = r.checks.filter(function (c) { return c[2] !== 'OK'; });
    var h = ng.length ? '<div class="ng">作成できません：' + ng.map(function (c) { return esc(c[0]) + '（' + esc(c[1]) + '）' + (c[3] ? '→' + esc(c[3]) : ''); }).join('／') + '</div>'
                      : '<div class="ok">下の内容で問題なければ、「①グループとクーポンを作成」を押してください。</div>';
    var gAll = r.groups.every(function (g) { return S.gex[g[0]] === r.counts[g[0]]; }), cAll = S.cps.every(function (c) { return S.cex[c.id]; });
    var mSent = (S.mlog || []).length ? TMPL.filter(function (t) { return S.mlog.some(function (x) { return x.tmpl.indexOf(t) >= 0; }); }).length : 0;
    var phase = !(gAll && cAll) ? 0 : mSent < 3 ? 1 : 2;
    var flow = ['グループとクーポンを作成', 'メール送信（' + mSent + '/3）'];
    h = '<div style="margin:6px 0 4px">' + flow.map(function (t, i) { var n = ('0' + (i + 1)).slice(-2); return '<span style="display:inline-block;margin-right:6px;padding:2px 8px;border-radius:4px;' + (i < phase ? 'color:#2b8a3e">' + n + ' ' + esc(t) + ' ✓' : i === phase ? 'background:#e7f5ff;color:#1971c2;font-weight:bold">' + n + ' ' + esc(t) + ' ← いまここ' : 'color:#adb5bd">' + n + ' ' + esc(t)) + '</span>'; }).join('') + (phase === 2 ? '<span class="ok">すべて完了</span>' : '') + '</div>' + h;
    if (!ng.length && phase === 1) h = h.replace(/<div class="ok">下の内容で問題なければ[^<]*<\/div>/, '<div class="ok">「②メール送信を進める」を押すと、3通分のタブが開きます。<br>各タブでテスト送信→一括送信を押してください。</div>');
    if (!ng.length && phase === 2) h = h.replace(/<div class="ok">下の内容で問題なければ[^<]*<\/div>/, '');
    if (!S.prevVip && !S.keepAll) h += '<div class="ng"><label><input type="checkbox" class="ka"> 先月のVIPigグループが無いので、今月のVIPig全員をお礼の宛先にする</label></div>';
    h += '<h4>会員グループ（12）</h4><table><tr><th>グループ</th><th>人数</th><th>状態</th></tr>';
    r.groups.forEach(function (g) { h += '<tr><td>' + esc(g[0]) + '</td><td>' + r.counts[g[0]] + '人</td>' + st(S.gex[g[0]], r.counts[g[0]], '人数') + '</tr>'; });
    h += '</table><h4>クーポン（9）' + esc(S.cps[0].s.slice(5, 10)) + '〜' + esc(S.cps[0].f.slice(5, 10)) + '</h4><table><tr><th>クーポン</th><th>値引き</th><th>発行枚数</th><th>状態</th></tr>';
    S.cps.forEach(function (c) { var ex = S.cex[c.id]; h += '<tr><td>' + esc(c.name.replace(/^\d+年\d+月/, '')) + '</td><td>' + (c.kind === 'yen' ? c.v + '円引き' : c.v + '%引き') + '</td><td>' + r.counts[c.group] + '枚</td>' + st(ex ? ex.count : null, r.counts[c.group], '枚数') + '</tr>'; });
    h += '</table>';
    if (S.extraN < S.cps.length) h += '<div class="ng">先月のクーポンが' + (S.cps.length - S.extraN) + '種見つからない（条件を引き継げない）</div>';
    h += '<h4>クーポン対象外商品（9種共通）</h4><div class="mu">クーポンの利用対象外の商品を追加・削除してください。翌月は、前月の設定を引き継ぎます。</div><table><tr><th></th><th>商品コード</th><th>商品名</th></tr>';
    xgAll().forEach(function (g) { h += '<tr><td><input type="checkbox" class="xgc" data-code="' + esc(g.code) + '"' + (S.xgDel[g.code] ? '' : ' checked') + (cAll ? ' disabled' : '') + '></td><td>' + esc(g.code) + '</td><td>' + esc(g.name || '') + '</td></tr>'; });
    if (!xgAll().length) h += '<tr><td></td><td colspan="2">なし</td></tr>';
    h += '</table>' + (cAll ? '' : '<div><input class="xgn" placeholder="商品コード（例 69-00018-2599-99）" style="width:230px"> <button class="xga" style="margin:4px 0 0;padding:4px 10px">追加</button> <span class="xgm"></span></div>');
    $('.pv').innerHTML = h;
    var ka = $('.ka'); if (ka) ka.onchange = function () { S.keepAll = ka.checked; recompute(); };
    [].slice.call(box.querySelectorAll('.xgc')).forEach(function (cb) { cb.onchange = function () { var k = cb.getAttribute('data-code'); if (cb.checked) delete S.xgDel[k]; else S.xgDel[k] = 1; }; });
    var xa = $('.xga'); if (xa) xa.onclick = async function () {
      var v = $('.xgn').value.trim(), msg = $('.xgm'); if (!v) return;
      if (xgAll().some(function (g) { return g.code === v; })) { delete S.xgDel[v]; render(); return; }
      var on = xgAll().filter(function (g) { return !S.xgDel[g.code]; }).length;
      if (on >= 5) { msg.innerHTML = '<span class="ng">除外商品は5件まで（BOの画面の枠が5つ）</span>'; return; }
      xa.disabled = true; msg.textContent = '商品を探しています…';
      try {
        var hit = await goodsLookup(v);
        if (hit.exact) { S.xgAdd.push({ code: hit.exact.code, name: hit.exact.name, add: 1 }); render(); return; }
        msg.innerHTML = '<span class="ng">商品コード「' + esc(v) + '」の商品が見つからない' + (hit.list.length ? '。近いもの：' + hit.list.slice(0, 3).map(function (g) { return esc(g.code + ' ' + g.name); }).join('／') : '') + '</span>';
      } catch (e) { msg.innerHTML = '<span class="ng">商品を探せない：' + esc(e.message) + '</span>'; }
      xa.disabled = false;
    };
    $('.run').disabled = !r.ok || (gAll && cAll) || (!STG && S.extraN < S.cps.length);
    $('.run').textContent = gAll && cAll ? 'グループとクーポン作成済' : '①グループとクーポンを作成';
    var any = r.groups.some(function (g) { return S.gex[g[0]] != null; }) || S.cps.some(function (c) { return S.cex[c.id]; });
    $('.undo').style.display = any ? '' : 'none';
    renderMail();
  }
  var TMPL = ['今月もありがとう！今月の"とこトンとん得々クーポン"はこちら♪', 'HAPPY BIRTHDAY！今月お誕生日のあなたへ特別クーポン', '今月も「VIPig」ステータスをキープ！ありがとうございます！！'];
  function xgAll() { // 先月の9種の除外商品（重複なし）＋追加分
    var m = {}, out = [];
    S.cps.forEach(function (c) { var e = S.extra[c.tail]; (e ? e.xg : []).forEach(function (g) { if (!m[g.code]) { m[g.code] = 1; out.push(g); } }); });
    S.xgAdd.forEach(function (g) { if (!m[g.code]) { m[g.code] = 1; out.push(g); } });
    return out;
  }
  function xgFor(c) { // そのクーポンに入れる除外商品＝先月のそのクーポンの分－外した分＋追加分
    var e = S.extra[c.tail], base = (e ? e.xg : []).filter(function (g) { return !S.xgDel[g.code]; });
    S.xgAdd.forEach(function (g) { if (!S.xgDel[g.code] && !base.some(function (b) { return b.code === g.code; })) base.push({ code: g.code, name: '' }); });
    return base;
  }
  async function goodsLookup(code) { // BOの商品選択画面で商品コードを探す（無い商品は除外に入れられない＝反映が途中で止まるのを防ぐ）
    var u = 'master/goods.aspx?formname=frmCoupon&returntype=accessory', d = await doc(u), f = d.forms[0], fd = fdOf(f);
    fd.set('goods', code); fd.set('cmdSearch', f.querySelector('[name=cmdSearch]').value);
    var t = new DOMParser().parseFromString(await (await fetch(BO + '/' + u, { method: 'POST', body: fd, credentials: 'include' })).text(), 'text/html');
    var list = [].slice.call(t.querySelectorAll('tr')).map(function (tr) { return [].slice.call(tr.cells).map(function (c) { return c.textContent.trim().replace(/\s+/g, ' '); }); })
      .filter(function (c) { return c.length >= 2 && /^[0-9A-Za-z][0-9A-Za-z\-_]{2,}$/.test(c[0]); }).map(function (c) { return { code: c[0], name: c[1].replace(/\(※[^)]*\)$/, '') }; });
    return { exact: list.filter(function (g) { return g.code === code; })[0] || null, list: list };
  }
  async function mailLog(ym) { // 一括メール発行履歴（その月の1日以降）
    try {
      var d = await doc('maillog/maillistlog.aspx'), f = d.forms[0], fd = fdOf(f);
      fd.set('from_startdt', ym.replace('-', '/') + '/01'); fd.set('cmdSearch', f.querySelector('[name=cmdSearch]').value);
      var t = new DOMParser().parseFromString(await (await fetch(BO + '/maillog/maillistlog.aspx', { method: 'POST', body: fd, credentials: 'include' })).text(), 'text/html');
      return [].slice.call(t.querySelectorAll('table tr')).map(function (tr) { return [].slice.call(tr.cells).map(function (c) { return c.textContent.trim().replace(/\s+/g, ' '); }); })
        .filter(function (c) { return c.length >= 6 && /^\d+$/.test(c[0]) && /^\d{4}\/\d{2}/.test(c[2] || ''); })
        .map(function (c) { return { tmpl: c[1], start: c[2], total: c[4], sent: c[5] }; })
        .filter(function (x) { return x.start.slice(0, 7) === ym.replace('-', '/'); });
    } catch (e) { log('メール発行履歴が読めない ' + e.message); return null; }
  }
  function recompute() { S.res = build(S.ym, S.mem, S.prev, S.keepAll); render(); }
  var MAILS = function () { return [[S.ym + '得々クーポン配布メール', '得々クーポン'], [S.ym + '誕生日クーポン配布メール', 'お誕生日クーポン'], ['【' + S.ym + 'ランクキープ】VIPIG', 'VIPig継続のお礼']]; };
  var EMAIL = /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/;
  function sentOf(i) { return (S.mlog || []).filter(function (x) { return x.tmpl.indexOf(TMPL[i]) >= 0; }); }
  function renderMail() {
    var names = MAILS(), made = S.gex[names[0][0]] != null;
    var h = '<h4>お知らせメール（3）</h4><table><tr><th>メール</th><th>宛先</th><th>状態</th></tr>';
    names.forEach(function (n, i) { var sent = sentOf(i), ps = (S.mprep || {})[i];
      var stt = S.mlog === null ? '<td class="wa">確認できない</td>' : sent.length ? '<td class="ok">送信済み</td>'
        : ps ? '<td class="' + (ps.c || '') + '">' + esc(ps.t) + '</td>' : '<td>未送信</td>';
      h += '<tr><td>' + esc(n[1]) + '</td><td>' + S.res.counts[n[0]] + '人</td>' + stt + '</tr>'; });
    h += '</table><div style="margin-top:6px">テスト送信先（カンマ区切り）<br><input class="tm" style="width:100%;box-sizing:border-box" value="' + esc((S.tmail || []).join(', ')) + '"><div class="mu">翌月は、今月の送信先を引き継ぎます。</div></div>';
    $('.ml').innerHTML = h;
    var todo = names.some(function (n, i) { return !sentOf(i).length && !((S.mprep || {})[i] && S.mprep[i].ok); }); // 準備できたものは二度開かない（開き直すならツールを開き直す）
    $('.mail').disabled = !made || S.mlog === null || !todo || S.mbusy;
    $('.mail').textContent = names.every(function (n, i) { return sentOf(i).length; }) ? 'メール送信済み' : '②メール送信を進める';
    $('.run').classList.toggle('nx', !$('.run').disabled); $('.mail').classList.toggle('nx', $('.run').disabled && !$('.mail').disabled); // 次に押すボタンにオレンジ枠
  }
  // テスト送信先：今月の「得々クーポン配布メール」グループの備考に保存（無ければ先月のグループ→既定）。BOに置くので誰のPCでも同じ
  var TM_DEF = ['qoo.masuda@gmail.com', 'seki_yu@drugstores.co.jp', 'info@drugstores-shop.com'];
  function tmParse(t) { var m = String(t || '').match(/テスト送信先[:：]\s*([^｜\n]*)/); return m ? m[1].split(/[,、\s]+/).filter(function (x) { return EMAIL.test(x); }) : null; }
  async function grpDetail(name) { var g = (await groupList(name)).filter(function (x) { return x.name === name; })[0]; if (!g) return null; var u = 'customergroup/' + g.href.replace(/^.*customergroup\//, ''), d = await doc(u); return { u: u, d: d, remarks: (d.querySelector('[name=remarks]') || {}).value || '' }; }
  async function tmLoad() {
    var cur = await grpDetail(S.ym + '得々クーポン配布メール'), v = cur && tmParse(cur.remarks);
    if (!v) { var pv = await grpDetail(prevYm(S.ym) + '得々クーポン配布メール'); v = pv && tmParse(pv.remarks); }
    return v && v.length ? v : TM_DEF.slice();
  }
  async function tmSave(list) {
    var g = await grpDetail(S.ym + '得々クーポン配布メール'); if (!g) throw new Error('得々クーポン配布メールのグループが無い');
    var base = g.remarks.replace(/｜?テスト送信先[:：][^｜\n]*/, ''), want = base + '｜テスト送信先：' + list.join(', ');
    if (g.remarks === want) return;
    var f = g.d.forms[0], fd = fdOf(f); fd.set('remarks', want); fd.set('cmdUpdate', f.querySelector('[name=cmdUpdate]').value);
    await (await fetch(BO + '/' + g.u, { method: 'POST', body: fd, credentials: 'include' })).text();
    var chk = await grpDetail(S.ym + '得々クーポン配布メール'); if (!chk || chk.remarks !== want) throw new Error('テスト送信先を保存できない');
  }
  // 1つのボタンで3通分のタブを開き、それぞれ 会員検索（宛先グループ）→ メール送信 → テンプレート → 送信先を確定 → テスト送信の画面（テスト送信先を入れた状態）まで進める。送信ボタンは押さない
  async function mailAll() {
    var names = MAILS(), list = $('.tm').value.split(/[,、\s]+/).filter(function (x) { return x; });
    var bad = list.filter(function (x) { return !EMAIL.test(x); });
    if (!list.length || bad.length) { $('.ml').insertAdjacentHTML('afterbegin', '<div class="ng">テスト送信先を確認：' + esc(bad.join(', ') || '空') + '</div>'); return; }
    var todo = names.map(function (n, i) { return i; }).filter(function (i) { return !sentOf(i).length; });
    var ws = {}; todo.forEach(function (i) { ws[i] = window.open('about:blank', '_blank'); }); // クリックした瞬間に開く（後だとポップアップとして止められる）
    S.mbusy = true; S.mprep = {}; $('.mail').disabled = true;
    try {
      if (todo.some(function (i) { return !ws[i]; })) throw new Error('タブを開けない。アドレスバー右のポップアップ表示から「常に許可」にしてもう一度');
      todo.forEach(function (i) { S.mprep[i] = { t: '準備中' }; }); renderMail(); $('.tm').value = list.join(', ');
      await tmSave(list); S.tmail = list;
      var ml = await mailLog(S.ym); S.mlog = ml; // 二重送信を防ぐ：送付済のメールは進めない
      if (ml === null) throw new Error('送信履歴が読めない（二重送信を防ぐため止めた）');
      await Promise.all(todo.map(function (i) {
        if (sentOf(i).length) { ws[i].close(); return Promise.resolve(); }
        return mailPrep(i, names[i][0], ws[i], list);
      }));
    } catch (e) { Object.keys(ws).forEach(function (k) { try { if (ws[k] && ws[k].location.href === 'about:blank') ws[k].close(); } catch (x) {} }); $('.ml').insertAdjacentHTML('afterbegin', '<div class="ng">止めました：' + esc(e.message) + '</div>'); }
    S.mbusy = false; renderMail();
  }
  function mark(d, el) { if (!el) return; el.style.outline = '3px solid #fd7e14'; el.style.outlineOffset = '2px'; try { el.scrollIntoView({ block: 'center' }); } catch (e) {} }
  async function watchBulk(w) { // テスト送信のあと、次の画面の「一括送信」ボタンにもオレンジ枠（最大30分見張る）
    for (var k = 0; k < 1800; k++) { await sleep(1000); try { if (w.closed) return; var d = w.document; if (d.readyState !== 'complete') continue;
      var b = [].slice.call(d.querySelectorAll('input[type=submit],input[type=button],button')).filter(function (x) { return /一括/.test(x.value || x.textContent); })[0];
      if (b) { if (!b.style.outline) mark(d, b); if (/送信開始|送信しました|完了/.test(d.body.innerText) && !b) return; } } catch (e) {} }
  }
  async function mailPrep(i, grp, w, list) {
    var want = S.res.counts[grp], t0 = Date.now();
    var show = function (m, c) { S.mprep[i] = { t: m, c: c }; var td = $('.ml').querySelectorAll('tr')[i + 1]; if (td) { td.cells[2].textContent = m; td.cells[2].className = c || ''; } };
    var wait = async function (ok) { for (var k = 0; k < 120; k++) { await sleep(500); try { if (w.closed) throw new Error('タブが閉じられた'); var d = w.document; if (d.readyState === 'complete' && ok(d, w.location.pathname)) return d; } catch (e) { if (/閉じ/.test(e.message)) throw e; } show('準備中'); } throw new Error('タブが進まない（ログイン切れの可能性）'); };
    var num = function (d) { return +(((d.body.innerText.match(/([\d,]+)\s*件/) || [])[1] || '0').replace(/,/g, '')); };
    try {
      w.location.href = BO + '/customer/search.aspx?cgname=' + encodeURIComponent(grp) + '&disp.divcgname=open&max=30000';
      var d = await wait(function (d, p) { return /customer\/search/.test(p) && typeof w.doCmdMail === 'function'; });
      if (num(d) !== want) throw new Error('宛先が' + num(d) + '件（' + want + '件のはず）');
      w.setTimeout(function () { w.doCmdMail(); }, 50);
      d = await wait(function (d, p) { return /cust_maillist/.test(p) && d.querySelector('select[name=mailtmpl]'); });
      var sel = d.querySelector('select[name=mailtmpl]'), o = [].slice.call(sel.options).filter(function (o) { return o.textContent.trim() === TMPL[i]; })[0];
      if (!o && STG) o = [].slice.call(sel.options).filter(function (o) { return o.value; })[0]; // stgには本番のテンプレートが無いので、試験用に先頭のものを使う
      if (!o) throw new Error('テンプレートが無い');
      sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
      w.setTimeout(function () { d.querySelector('[name=submitButton]').click(); }, 50);
      d = await wait(function (d) { var b = d.querySelector('[name=button]'); return b && /送信先を確定/.test(b.value); });
      if (num(d) !== want) throw new Error('送信先が' + num(d) + '件（' + want + '件のはず）');
      w.setTimeout(function () { d.querySelector('[name=button]').click(); }, 50);
      d = await wait(function (d) { var b = d.querySelector('[name=button]'); return b && /テスト送信/.test(b.value); });
      var am = d.querySelector('[name=adminmail]'); if (!am) throw new Error('テスト送信先の欄が無い');
      am.value = list.join(','); am.dispatchEvent(new Event('change', { bubbles: true }));
      if (!(d.querySelector('[name=subject_text]') || {}).value) throw new Error('件名が空');
      show('未送信'); S.mprep[i].ok = 1;
      mark(d, d.querySelector('[name=button]'));
      watchBulk(w);
    } catch (e) { show('エラー：' + e.message, 'ng'); }
  }
  // 処理中の表示：「読み込み中…（平均◯ほどで完了・経過◯）」。平均は実際にかかった時間の直近5回（ブラウザに保存）
  var DEF = { ck: 30, run: 180, undo: 40 }, LBL = { ck: '読み込み中', run: '作成中', undo: '取り消し中' }, bzT = null, bz0 = 0, bzK = '';
  function fmt(sec) { sec = Math.round(sec); return sec < 60 ? sec + '秒' : Math.floor(sec / 60) + '分' + (sec % 60 ? sec % 60 + '秒' : ''); }
  function hist(k) { try { return JSON.parse(localStorage.getItem('sis35_t_' + (STG ? 'stg_' : '') + k) || '[]'); } catch (e) { return []; } }
  // いまどの工程か：01 02 … と並べ、作業中の工程だけ色づけ（作業中 ◯秒経過）、終わった工程は ✓、これからの工程は灰色
  var STEPS = {
    ck: ['今月の会員を読み込む', '先月のVIPigを読み込む', 'すでに作ったグループ・クーポンを確認する', '先月のクーポン設定を読み込む', 'メールの送信履歴を確認する'],
    run: ['会員グループ12個を作る', 'グループに会員を入れる', 'グループの人数を照合する', 'クーポン9種を作る', '発行枚数・対象外商品を照合する'],
    undo: ['クーポンを消す', 'グループを消す', '読み込み直す']
  }, stI = -1, st0 = 0, stSub = '';
  function step(i, sub) { if (i !== stI) st0 = Date.now(); stI = i; stSub = sub || ''; if (bzT) bzTick(); }
  var bzTick = function () {};
  function busyOn(k) {
    var h = hist(k), avg = h.length ? h.reduce(function (a, b) { return a + b; }, 0) / h.length : DEF[k];
    bzK = k; bz0 = Date.now(); stI = -1; clearInterval(bzT);
    bzTick = function () {
      var x = '<div class="hd2">' + LBL[k] + '（' + (h.length ? '平均' : '目安') + fmt(avg) + '・経過' + fmt((Date.now() - bz0) / 1000) + '）</div><ol>';
      STEPS[k].forEach(function (t, i) { var n = ('0' + (i + 1)).slice(-2);
        x += i < stI ? '<li class="done">' + n + ' ' + esc(t) + ' ✓</li>' : i === stI ? '<li class="now">' + n + ' ' + esc(t) + (stSub ? '（' + esc(stSub) + '）' : '') + '　作業中 ' + fmt((Date.now() - st0) / 1000) + '</li>' : '<li>' + n + ' ' + esc(t) + '</li>'; });
      $('.bz').innerHTML = x + '</ol>';
    };
    $('.bz').style.display = ''; step(0); bzTick(); bzT = setInterval(bzTick, 1000);
  }
  function busyOff(ok) {
    clearInterval(bzT); bzT = null; $('.bz').style.display = 'none';
    if (!ok || !bzK) return;
    try { var h = hist(bzK); h.push(Math.round((Date.now() - bz0) / 1000)); localStorage.setItem('sis35_t_' + (STG ? 'stg_' : '') + bzK, JSON.stringify(h.slice(-5))); } catch (e) {}
  }
  var ckId = 0;
  async function check() {
    var my = ++ckId;
    $('.ck').disabled = true; $('.run').disabled = true; $('.mail').disabled = true; $('.pv').innerHTML = ''; $('.ml').innerHTML = ''; var fromUndo = bzK === 'undo' && $('.bz').style.display === ''; if (!fromUndo) busyOn('ck');
    try {
      var ym = $('.ym').value.trim(); if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('対象月は 2026-11 の形で');
      var nd = new Date(), first = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1, 7, 30);
      if (!STG && nd < first) throw new Error(ym + ' 分は ' + (first.getMonth() + 1) + '/1 7:30 以降に（1日7時のランク更新より前だと、先月のランクで作ってしまう）');
      S = { ym: ym, keepAll: false, xgDel: {}, xgAdd: [] };
      if (!fromUndo) step(0); S.mem = await members(); log('今月の会員 ' + S.mem.length + '人');
      if (!fromUndo) step(1);
      var pg = prevYm(ym) + '会員ランクVIPIG', pex = (await groupList(pg)).filter(function (g) { return g.name === pg; })[0];
      var pv = pex && pex.count ? await members({ cgname: pg }) : [];
      S.prev = new Set(pv.map(function (x) { return x.no; })); S.prevVip = S.prev.size;
      if (pex && pex.count && pv.length !== pex.count) throw new Error('先月のVIPigグループ（' + pex.count + '人）を読み切れない（' + pv.length + '人）');
      log('先月のVIPig ' + S.prevVip + '人' + (pex ? '' : '（グループなし）'));
      S.res = build(ym, S.mem, S.prev, false); S.cps = coupons(ym);
      if (!fromUndo) step(2);
      var gl = await groupList(ym); S.gex = {}; S.glink = {}; gl.forEach(function (g) { S.gex[g.name] = g.count; S.glink[g.name] = g.href; });
      var cl = await couponList(ym); S.cex = {}; cl.forEach(function (c) { S.cex[c.id] = c; });
      if (!fromUndo) step(3);
      S.extra = {}; S.extraN = 0;
      for (var c of S.cps) { var e = await prevCouponExtras(prevYm(ym) + c.tail); if (e) { S.extra[c.tail] = e; S.extraN++; } }
      if (!fromUndo) step(4);
      S.mlog = await mailLog(ym); S.tmail = await tmLoad().catch(function () { return TM_DEF.slice(); });
      if (my !== ckId) return; // 途中で対象月を変えた：古い読み込みは捨てる
      if (!fromUndo) busyOff(true);
      render();
    } catch (e) { if (my !== ckId) return; if (!fromUndo) busyOff(false); $('.pv').innerHTML = '<div class="ng">止めました：' + esc(e.message) + '</div>'; log('NG ' + e.message); }
    $('.ck').disabled = false;
  }
  async function run() {
    if (!S || !S.res.ok) return;
    $('.run').disabled = true; $('.ck').disabled = true; $('.mail').disabled = true; busyOn('run');
    try {
      var r = S.res;
      step(0); var missing = r.groups.filter(function (g) { return S.gex[g[0]] == null; });
      if (missing.length) await importCSV('tmpcustomergrp', ['会員グループ名', '備考'], missing);
      else log('グループは12個とも既にある（作らない）');
      var gl = await groupList(S.ym); S.gex = {}; S.glink = {}; gl.forEach(function (g) { S.gex[g.name] = g.count; S.glink[g.name] = g.href; });
      var empty = r.groups.filter(function (g) { return !S.gex[g[0]] && r.counts[g[0]] > 0; }).map(function (g) { return g[0]; });
      var wrong = r.groups.filter(function (g) { return S.gex[g[0]] && S.gex[g[0]] !== r.counts[g[0]]; }).map(function (g) { return g[0]; });
      if (wrong.length) throw new Error('人数がもう入っていて計算と違うグループがある（二重取込を防ぐため止めた）：' + wrong.join('、'));
      step(1); if (empty.length) await importCSV('tmpcustomergrpmember', ['会員グループ名', '会員番号'], r.assign.filter(function (a) { return empty.indexOf(a[0]) >= 0; }));
      gl = await groupList(S.ym); S.gex = {}; S.glink = {}; gl.forEach(function (g) { S.gex[g.name] = g.count; S.glink[g.name] = g.href; });
      step(2); var bad = r.groups.filter(function (g) { return (S.gex[g[0]] || 0) !== r.counts[g[0]]; });
      if (bad.length) throw new Error('取込後の人数が計算と違う：' + bad.map(function (g) { return g[0] + ' ' + (S.gex[g[0]] || 0) + '/' + r.counts[g[0]]; }).join('、'));
      log('12グループとも人数が計算どおり');
      var cl = await couponList(S.ym); S.cex = {}; cl.forEach(function (c) { S.cex[c.id] = c; });
      step(3); var ci = 0;
      for (var c of S.cps) { ci++; if (S.cex[c.id]) continue; step(3, ci + '/9 ' + c.name.replace(/^\d+年\d+月/, '')); await createCoupon(c, S.extra[c.tail], xgFor(c)); log('クーポン作成 ' + c.id); }
      step(4);
      cl = await couponList(S.ym); S.cex = {}; cl.forEach(function (c) { S.cex[c.id] = c; });
      var cbad = S.cps.filter(function (c) { var x = S.cex[c.id]; return !x || +x.count !== r.counts[c.group]; });
      if (cbad.length) throw new Error('クーポンの発行枚数がグループの人数と違う：' + cbad.map(function (c) { return c.id; }).join('、'));
      log('クーポン9種とも、発行枚数＝グループの人数');
      busyOff(true); render(); // 冒頭に②の案内と 02 ← いまここ が出る
    } catch (e) { busyOff(false); render(); $('.pv').insertAdjacentHTML('afterbegin', '<div class="ng">止めました：' + esc(e.message) + '</div>'); log('NG ' + e.message); }
    $('.ck').disabled = false;
  }
  // 反映の取り消し：この月にツールが作るクーポン9種とグループ12個だけを消す（メールを送る前に使う。送ったメールは戻せない）
  var undoArmed = false;
  async function undo() {
    if (!undoArmed) { undoArmed = true; $('.undo').textContent = 'もう一度押すと取り消す（メール送信前だけ）'; $('.undo').style.background = '#c92a2a'; $('.undo').style.color = '#fff'; return; }
    $('.undo').disabled = true; $('.ck').disabled = true; $('.run').disabled = true; $('.mail').disabled = true; busyOn('undo');
    try {
      var n1 = 0, n2 = 0; step(0);
      for (var c of S.cps) {
        var u = 'coupon/event_detail.aspx?mode=update&coupon_type=1&coupon_event=' + encodeURIComponent(c.id);
        var d = await doc(u), f = d.forms[0]; if (new FormData(f).get('coupon_event') !== c.id) continue;
        var fd = fdOf(f); fd.set('cmdDelete', f.querySelector('[name=cmdDelete]').value);
        await (await fetch(BO + '/' + u, { method: 'POST', body: fd, credentials: 'include' })).text(); n1++; log('クーポン削除 ' + c.id);
      }
      step(1); var names = S.res.groups.map(function (g) { return g[0]; });
      var gl = await groupList(S.ym);
      for (var g of gl) {
        if (names.indexOf(g.name) < 0) continue;
        var id = (g.href.match(/customer_group_id=(\d+)/) || [])[1]; if (!id) continue;
        var u2 = 'customergroup/detail.aspx?customer_group_id=' + id, d2 = await doc(u2), f2 = d2.forms[0], fd2 = fdOf(f2);
        fd2.set('cmdDelete', f2.querySelector('[name=cmdDelete]').value);
        await (await fetch(BO + '/' + u2, { method: 'POST', body: fd2, credentials: 'include' })).text(); n2++; log('グループ削除 ' + g.name);
      }
      undoArmed = false; $('.undo').textContent = 'クーポンを取り消す'; $('.undo').style.background = ''; $('.undo').style.color = '';
      step(2); await check(); busyOff(true);
      $('.pv').insertAdjacentHTML('afterbegin', '<div class="ok">取り消しました（クーポン' + n1 + '種・グループ' + n2 + '個）</div>');
    } catch (e) { busyOff(false); $('.pv').insertAdjacentHTML('afterbegin', '<div class="ng">取り消しの途中で止まりました：' + esc(e.message) + '</div>'); }
    $('.undo').disabled = false;
  }
  $('.ck').onclick = check; $('.run').onclick = run; $('.undo').onclick = undo; $('.mail').onclick = mailAll;
  $('.ym').onchange = check; // 対象月を変えたら読み直す
  check(); // 開いたらそのまま読み込む（書き込みはしない）
})();
