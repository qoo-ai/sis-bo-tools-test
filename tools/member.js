/* SIS 会員ランク特典（月初）— T-35（#SP-1M）
 * 毎月1日7時のランク更新のあと（1日〜3営業日以内）に、BOでブックマーク →「会員ランク特典（月初）」→ ①確認 → ②反映。
 * やること：今月のランク・生年月日を会員検索から読む → 12グループに振り分け → 会員グループ取込（グループ→メンバー）→ 人数照合
 *          → クーポン9種（お誕生日5・とこトンとん得々4）を作成。お知らせメール3通は ③ から宛先グループを開いて送る。
 * 月末23:50のバックアップは不要：先月のVIPigは「先月1日に作った YYYY-MM会員ランクVIPIG グループ」から読む（ランクは1日7時にしか変わらない）。
 * ③のリンクは会員一覧を最大件数30000で開く（そこから［メール送信］→テンプレート）。
 * 何度押しても二重にならない：今月のグループ・クーポンが既にあれば作らずに飛ばす。途中で止まっても、もう一度②で続きから。
 * ルールは member_tools.py（9/1・10/1の実取込と照合済み）と同じ。前提：会員検索の「表示項目の選択」に 会員ランク・生年月日。
 */
(function () {
  'use strict';
  var VER = 'T35 v1.9 (2026-11-01)';
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
    '#sis35 button{padding:8px 12px;margin:8px 6px 0 0;border-radius:6px;border:1px solid #888;background:#f8f8f8;cursor:pointer}#sis35 button.go{background:' + C1 + ';color:#fff;border:none;font-weight:bold}#sis35 button:disabled{opacity:.45;cursor:not-allowed}' +
    '#sis35 h4{margin:12px 0 2px;font-size:13px}#sis35 pre{white-space:pre-wrap;background:#f6f6f6;padding:6px;max-height:160px;overflow:auto;margin:8px 0 0;font-size:11px}#sis35 a{color:#1971c2}</style>' +
    '<div class="hd"><span>SIS 会員ランク特典（月初）（' + (STG ? 'stg 検証環境' : '本番') + '）</span><span title="' + VER + '"><a href="#" class="x" style="color:#222;text-decoration:none">×</a></span></div>' +
    '<div class="bd"><div>対象月 <input class="ym" value="' + ymNow + '" style="width:80px"> ' +
    '</div>' +
    '<button class="ck go">① 確認（書き込みなし）</button><button class="run go" disabled>② この内容で反映</button><button class="undo" style="display:none">②を取り消す</button>' +
    '<div class="pv"></div><div class="ml"></div><pre class="log" style="display:none"></pre></div>';
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
    if (iR < 0 || iB < 0) throw new Error('会員検索の「表示項目の選択」に「会員ランク」「生年月日」を入れてから、もう一度①');
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
    throw new Error('取込が8分で終わらない（会員グループインポートの処理状況ログを確認し、終わってからもう一度②）');
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
      return { entries: e, xgoods: e.filter(function (x) { return /^x_gname_\d+$/.test(x[0]) && x[1]; }).map(function (x) { return x[1]; }),
               xterm: e.some(function (x) { return x[0] === 'condition_x_term' && x[1] && x[1] !== 'false'; }) };
    } catch (e) { return null; }
  }
  var SKIP = /^(__|mode$|coupon_type$|coupon_event$|name$|customer_group_name$|coupon_count$|s_dt$|f_dt$|x_s_dt$|x_f_dt$|condition_x_term$|amount|cmd|bonus_type_dummy$|customer_allotment_dummy$|smartphone_is_pc$|is_coupon_return$)/;
  function condSig(entries) { // 引き継ぐ条件の中身（照合用）
    return entries.filter(function (x) { return !SKIP.test(x[0]) && x[1] !== '' && !/^(bonus_type|coupon_cut_price|coupon_cut_ratio|coupon_point_ratio|customer_allotment|status|condition_term)$/.test(x[0]); })
      .map(function (x) { return x[0] + '=' + x[1]; }).sort().join('|');
  }
  async function createCoupon(c, prev) {
    var path = 'coupon/event_detail.aspx?mode=regist&coupon_type=1';
    var d = await doc(path), f = d.forms[0], fd = fdOf(f);
    if (prev) {
      prev.entries.forEach(function (x) { if (!SKIP.test(x[0])) fd.set(x[0], x[1]); });
      var has = function (n) { return prev.entries.some(function (x) { return x[0] === n; }); };
      if (has('smartphone_is_pc')) fd.set('smartphone_is_pc', '1'); else fd.delete('smartphone_is_pc');
      if (has('is_coupon_return')) fd.set('is_coupon_return', '1'); else fd.delete('is_coupon_return');
    } else fd.set('smartphone_is_pc', '1');
    fd.set('coupon_event', c.id); fd.set('name', c.name);
    fd.set('bonus_type', c.kind === 'yen' ? '0' : '1'); fd.set(c.kind === 'yen' ? 'coupon_cut_price' : 'coupon_cut_ratio', String(c.v));
    fd.set('customer_allotment', '0'); fd.set('customer_group_name', c.group);
    fd.set('condition_term', 'true'); fd.set('s_dt', c.s); fd.set('f_dt', c.f); fd.set('status', '0');
    fd.set('cmdInsert', f.querySelector('[name=cmdInsert]').value);
    var t = new DOMParser().parseFromString(await (await fetch(BO + '/' + path, { method: 'POST', body: fd, credentials: 'include' })).text(), 'text/html').body.textContent.replace(/\s+/g, ' ');
    var err = (t.match(/[^ ]{0,30}(入力して|できません|存在しません|エラー|不正|重複)[^ ]{0,30}/) || [''])[0];
    if (err) throw new Error('クーポン ' + c.id + ' を作れない：' + err);
    if (prev) { // 作ったクーポンを読み戻して、先月と同じ条件（除外商品など）が入ったか確かめる
      var mine = await prevCouponExtras(c.id);
      if (!mine || condSig(mine.entries) !== condSig(prev.entries)) throw new Error('クーポン ' + c.id + ' の条件が先月と違う（除外商品など）。クーポンイベント管理で確認');
    }
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
      [ym + '会員ランクぶたのおひめさま', '非誕生日グループ', function (x) { return x.rank === 'ぶたのおひめさま'; }],
      [ym + '会員ランクセレブ', '非誕生日グループ', function (x) { return x.rank === 'セレブぶた'; }],
      [ym + '会員ランクおしゃれぶた', '非誕生日グループ', function (x) { return x.rank === 'おしゃれぶた'; }],
      [ym + '会員ランクVIPIG', '非誕生日グループ', function (x) { return up(x.rank) === 'VIPIG'; }],
      ['【☆' + ym + '誕生日】ぶたのおひめさま', '誕生日グループ', function (x) { return isb(x.b) && x.rank === 'ぶたのおひめさま'; }],
      ['【☆' + ym + '誕生日】セレブ', '誕生日グループ', function (x) { return isb(x.b) && x.rank === 'セレブぶた'; }],
      ['【☆' + ym + '誕生日】こぶた', '誕生日グループ', function (x) { return isb(x.b) && KOBUTA.indexOf(x.rank) >= 0; }],
      ['【☆' + ym + '誕生日】おしゃれぶた', '誕生日グループ', function (x) { return isb(x.b) && x.rank === 'おしゃれぶた'; }],
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
  function st(ex, want, unit) { // 状態の表示：これから作る／作成済み／人数が違う
    if (ex == null) return '<td>これから作る</td>';
    if (want == null || +ex === want) return '<td class="ok">作成済み</td>';
    return '<td class="ng">作成済みだが' + unit + 'が違う（' + esc(ex) + '）</td>';
  }
  function render() {
    var r = S.res, ng = r.checks.filter(function (c) { return c[2] !== 'OK'; });
    var h = ng.length ? '<div class="ng">反映できません：' + ng.map(function (c) { return esc(c[0]) + '（' + esc(c[1]) + '）' + (c[3] ? '→' + esc(c[3]) : ''); }).join('／') + '</div>'
                      : '<div class="ok">問題なし。下の内容で反映します。</div>';
    if (!S.prevVip && !S.keepAll) h += '<div class="ng"><label><input type="checkbox" class="ka"> 先月のVIPigグループが無いので、今月のVIPig全員をお礼の宛先にする</label></div>';
    h += '<h4>会員グループ（12）</h4><table><tr><th>グループ</th><th>人数</th><th>状態</th></tr>';
    r.groups.forEach(function (g) { h += '<tr><td>' + esc(g[0]) + '</td><td>' + r.counts[g[0]] + '人</td>' + st(S.gex[g[0]], r.counts[g[0]], '人数') + '</tr>'; });
    h += '</table><h4>クーポン（9）' + esc(S.cps[0].s.slice(5, 10)) + '〜' + esc(S.cps[0].f.slice(5, 10)) + '</h4><table><tr><th>クーポン</th><th>値引き</th><th>発行枚数</th><th>状態</th></tr>';
    S.cps.forEach(function (c) { var ex = S.cex[c.id]; h += '<tr><td>' + esc(c.name.replace(/^\d+年\d+月/, '')) + '</td><td>' + (c.kind === 'yen' ? c.v + '円引き' : c.v + '%引き') + '</td><td>' + r.counts[c.group] + '枚</td>' + st(ex ? ex.count : null, r.counts[c.group], '枚数') + '</tr>'; });
    var pe = S.extra[S.cps[0].tail];
    h += '</table><div>' + (S.extraN === S.cps.length ? '先月と同じ条件で作る' + (pe && pe.xgoods.length ? '（除外商品：' + esc(pe.xgoods.join('、')) + '）' : '') : '<span class="ng">先月のクーポンが' + (S.cps.length - S.extraN) + '種見つからない（条件を引き継げない）</span>') + '</div>';
    $('.pv').innerHTML = h;
    var ka = $('.ka'); if (ka) ka.onchange = function () { S.keepAll = ka.checked; recompute(); };
    var gAll = r.groups.every(function (g) { return S.gex[g[0]] === r.counts[g[0]]; }), cAll = S.cps.every(function (c) { return S.cex[c.id]; });
    $('.run').disabled = !r.ok || (gAll && cAll) || (!STG && S.extraN < S.cps.length);
    $('.run').textContent = gAll && cAll ? '② 反映済み' : '② この内容で反映';
    var any = r.groups.some(function (g) { return S.gex[g[0]] != null; }) || S.cps.some(function (c) { return S.cex[c.id]; });
    $('.undo').style.display = any ? '' : 'none';
    renderMail();
  }
  function recompute() { S.res = build(S.ym, S.mem, S.prev, S.keepAll); render(); }
  function renderMail() {
    var names = [[S.ym + '得々クーポン配布メール', 'とこトンとん得々クーポンのお知らせ'], [S.ym + '誕生日クーポン配布メール', 'お誕生日クーポンのお知らせ'], ['【' + S.ym + 'ランクキープ】VIPIG', 'VIPig継続のお礼']];
    var h = '<h4>お知らせメール（3）</h4><table><tr><th>メール</th><th>宛先</th><th>③ 送る</th></tr>';
    names.forEach(function (n) { var c = S.gex[n[0]]; h += '<tr><td>' + esc(n[1]) + '</td><td>' + S.res.counts[n[0]] + '人</td><td>' + (c != null ? '<a target="_blank" href="' + esc(BO + '/customer/search.aspx?cgname=' + encodeURIComponent(n[0]) + '&disp.divcgname=open&max=30000') + '">宛先を開く</a>' : '②のあと') + '</td></tr>'; });
    $('.ml').innerHTML = h + '</table>';
  }
  async function check() {
    $('.ck').disabled = true; $('.run').disabled = true; $('.pv').innerHTML = '読み込み中…';
    try {
      var ym = $('.ym').value.trim(); if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('対象月は 2026-11 の形で');
      var nd = new Date(), first = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1, 7, 30);
      if (!STG && nd < first) throw new Error(ym + ' 分は ' + (first.getMonth() + 1) + '/1 7:30 以降に（1日7時のランク更新より前だと、先月のランクで作ってしまう）');
      S = { ym: ym, keepAll: false };
      S.mem = await members(); log('今月の会員 ' + S.mem.length + '人');
      var pg = prevYm(ym) + '会員ランクVIPIG', pex = (await groupList(pg)).filter(function (g) { return g.name === pg; })[0];
      var pv = pex && pex.count ? await members({ cgname: pg }) : [];
      S.prev = new Set(pv.map(function (x) { return x.no; })); S.prevVip = S.prev.size;
      if (pex && pex.count && pv.length !== pex.count) throw new Error('先月のVIPigグループ（' + pex.count + '人）を読み切れない（' + pv.length + '人）');
      log('先月のVIPig ' + S.prevVip + '人' + (pex ? '' : '（グループなし）'));
      S.res = build(ym, S.mem, S.prev, false); S.cps = coupons(ym);
      var gl = await groupList(ym); S.gex = {}; S.glink = {}; gl.forEach(function (g) { S.gex[g.name] = g.count; S.glink[g.name] = g.href; });
      var cl = await couponList(ym); S.cex = {}; cl.forEach(function (c) { S.cex[c.id] = c; });
      S.extra = {}; S.extraN = 0;
      for (var c of S.cps) { var e = await prevCouponExtras(prevYm(ym) + c.tail); if (e) { S.extra[c.tail] = e; S.extraN++; } }
      render();
    } catch (e) { $('.pv').innerHTML = '<div class="ng">止めました：' + esc(e.message) + '</div>'; log('NG ' + e.message); }
    $('.ck').disabled = false;
  }
  async function run() {
    if (!S || !S.res.ok) return;
    $('.run').disabled = true; $('.ck').disabled = true;
    try {
      var r = S.res;
      var missing = r.groups.filter(function (g) { return S.gex[g[0]] == null; });
      if (missing.length) await importCSV('tmpcustomergrp', ['会員グループ名', '備考'], missing);
      else log('グループは12個とも既にある（作らない）');
      var gl = await groupList(S.ym); S.gex = {}; S.glink = {}; gl.forEach(function (g) { S.gex[g.name] = g.count; S.glink[g.name] = g.href; });
      var empty = r.groups.filter(function (g) { return !S.gex[g[0]] && r.counts[g[0]] > 0; }).map(function (g) { return g[0]; });
      var wrong = r.groups.filter(function (g) { return S.gex[g[0]] && S.gex[g[0]] !== r.counts[g[0]]; }).map(function (g) { return g[0]; });
      if (wrong.length) throw new Error('人数がもう入っていて計算と違うグループがある（二重取込を防ぐため止めた）：' + wrong.join('、'));
      if (empty.length) await importCSV('tmpcustomergrpmember', ['会員グループ名', '会員番号'], r.assign.filter(function (a) { return empty.indexOf(a[0]) >= 0; }));
      gl = await groupList(S.ym); S.gex = {}; S.glink = {}; gl.forEach(function (g) { S.gex[g.name] = g.count; S.glink[g.name] = g.href; });
      var bad = r.groups.filter(function (g) { return (S.gex[g[0]] || 0) !== r.counts[g[0]]; });
      if (bad.length) throw new Error('取込後の人数が計算と違う：' + bad.map(function (g) { return g[0] + ' ' + (S.gex[g[0]] || 0) + '/' + r.counts[g[0]]; }).join('、'));
      log('12グループとも人数が計算どおり');
      var cl = await couponList(S.ym); S.cex = {}; cl.forEach(function (c) { S.cex[c.id] = c; });
      for (var c of S.cps) { if (S.cex[c.id]) continue; await createCoupon(c, S.extra[c.tail]); log('クーポン作成 ' + c.id); }
      cl = await couponList(S.ym); S.cex = {}; cl.forEach(function (c) { S.cex[c.id] = c; });
      var cbad = S.cps.filter(function (c) { var x = S.cex[c.id]; return !x || +x.count !== r.counts[c.group]; });
      if (cbad.length) throw new Error('クーポンの発行枚数がグループの人数と違う：' + cbad.map(function (c) { return c.id; }).join('、'));
      log('クーポン9種とも、発行枚数＝グループの人数');
      render();
      $('.pv').insertAdjacentHTML('afterbegin', '<div class="ok" style="font-size:14px">✅ ②まで完了。続けて③でメールを送る</div>');
    } catch (e) { render(); $('.pv').insertAdjacentHTML('afterbegin', '<div class="ng">止めました：' + esc(e.message) + '</div>'); log('NG ' + e.message); }
    $('.ck').disabled = false;
  }
  // ②の取り消し：この月にツールが作るクーポン9種とグループ12個だけを消す（メールを送る前に使う。送ったメールは戻せない）
  var undoArmed = false;
  async function undo() {
    if (!undoArmed) { undoArmed = true; $('.undo').textContent = 'メールを送る前だけ。もう一度押すと ' + S.ym + ' 分を消す'; $('.undo').style.background = '#c92a2a'; $('.undo').style.color = '#fff'; return; }
    $('.undo').disabled = true; $('.ck').disabled = true; $('.run').disabled = true;
    try {
      var n1 = 0, n2 = 0;
      for (var c of S.cps) {
        var u = 'coupon/event_detail.aspx?mode=update&coupon_type=1&coupon_event=' + encodeURIComponent(c.id);
        var d = await doc(u), f = d.forms[0]; if (new FormData(f).get('coupon_event') !== c.id) continue;
        var fd = fdOf(f); fd.set('cmdDelete', f.querySelector('[name=cmdDelete]').value);
        await (await fetch(BO + '/' + u, { method: 'POST', body: fd, credentials: 'include' })).text(); n1++; log('クーポン削除 ' + c.id);
      }
      var names = S.res.groups.map(function (g) { return g[0]; });
      var gl = await groupList(S.ym);
      for (var g of gl) {
        if (names.indexOf(g.name) < 0) continue;
        var id = (g.href.match(/customer_group_id=(\d+)/) || [])[1]; if (!id) continue;
        var u2 = 'customergroup/detail.aspx?customer_group_id=' + id, d2 = await doc(u2), f2 = d2.forms[0], fd2 = fdOf(f2);
        fd2.set('cmdDelete', f2.querySelector('[name=cmdDelete]').value);
        await (await fetch(BO + '/' + u2, { method: 'POST', body: fd2, credentials: 'include' })).text(); n2++; log('グループ削除 ' + g.name);
      }
      undoArmed = false; $('.undo').textContent = '②を取り消す'; $('.undo').style.background = ''; $('.undo').style.color = '';
      await check();
      $('.pv').insertAdjacentHTML('afterbegin', '<div class="ok">取り消しました（クーポン' + n1 + '種・グループ' + n2 + '個を削除）。直してからもう一度①→②</div>');
    } catch (e) { $('.pv').insertAdjacentHTML('afterbegin', '<div class="ng">取り消しの途中で止まりました：' + esc(e.message) + '</div>'); }
    $('.undo').disabled = false;
  }
  $('.ck').onclick = check; $('.run').onclick = run; $('.undo').onclick = undo;
})();
