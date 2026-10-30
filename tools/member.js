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
  var VER = 'T35 v1.3 (2026-10-30)';
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
    '<div class="hd"><span>SIS 会員ランク特典（月初）（' + (STG ? 'stg 検証環境' : '本番') + '）</span><span style="font-weight:normal;color:#888;font-size:11px">' + VER + '　<a href="#" class="x">×</a></span></div>' +
    '<div class="bd"><div>対象月 <input class="ym" value="' + ymNow + '" style="width:80px"> ' +
    '<span class="mu" style="font-size:12px">1日7時のランク更新のあと、3営業日以内に。押すのは①→②の2回だけ</span></div>' +
    '<button class="ck go">① 確認（書き込みなし）</button><button class="run go" disabled>② この内容で反映</button>' +
    '<div class="pv"></div><div class="ml"></div><pre class="log"></pre></div>';
  document.body.appendChild(box);
  var $ = function (s) { return box.querySelector(s); };
  $('.x').onclick = function (e) { e.preventDefault(); box.remove(); };
  function log(m) { $('.log').textContent = new Date().toLocaleTimeString('ja-JP') + ' ' + m + '\n' + $('.log').textContent; }
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
    var r = await fetch(BO + '/customer/search.aspx', { method: 'POST', body: fd, credentials: 'include' });
    var t = new TextDecoder('shift_jis').decode(await r.arrayBuffer()), rows = parseCSV(t);
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
  async function prevCouponExtras(id) {
    try {
      var d = await doc('coupon/event_detail.aspx?mode=update&coupon_type=1&coupon_event=' + encodeURIComponent(id));
      var f = d.forms[0]; if (new FormData(f).get('coupon_event') !== id) return null;
      var g = function (n) { var e = f.querySelector('[name=' + n + ']'); return e ? e.value : ''; };
      var c = function (n) { var e = f.querySelector('[name=' + n + ']'); return !!(e && e.checked); };
      return { freespace: g('freespace'), freespace_sp: g('freespace_sp'), remarks: g('remarks'), ret: c('is_coupon_return'), sp: c('smartphone_is_pc') };
    } catch (e) { return null; }
  }
  async function createCoupon(c, extra) {
    var path = 'coupon/event_detail.aspx?mode=regist&coupon_type=1';
    var d = await doc(path), f = d.forms[0], fd = fdOf(f);
    fd.set('coupon_event', c.id); fd.set('name', c.name);
    fd.set('bonus_type', c.kind === 'yen' ? '0' : '1'); fd.set(c.kind === 'yen' ? 'coupon_cut_price' : 'coupon_cut_ratio', String(c.v));
    fd.set('customer_allotment', '0'); fd.set('customer_group_name', c.group);
    fd.set('condition_term', '1'); fd.set('s_dt', c.s); fd.set('f_dt', c.f); fd.set('status', '0');
    if (extra) {
      fd.set('freespace', extra.freespace || ''); fd.set('freespace_sp', extra.freespace_sp || ''); fd.set('remarks', extra.remarks || '');
      if (extra.ret) fd.set('is_coupon_return', '1'); else fd.delete('is_coupon_return');
      if (extra.sp) fd.set('smartphone_is_pc', '1'); else fd.delete('smartphone_is_pc');
    } else fd.set('smartphone_is_pc', '1');
    fd.set('cmdInsert', f.querySelector('[name=cmdInsert]').value);
    var t = new DOMParser().parseFromString(await (await fetch(BO + '/' + path, { method: 'POST', body: fd, credentials: 'include' })).text(), 'text/html').body.textContent.replace(/\s+/g, ' ');
    var err = (t.match(/[^ ]{0,30}(入力して|できません|存在しません|エラー|不正|重複)[^ ]{0,30}/) || [''])[0];
    if (err) throw new Error('クーポン ' + c.id + ' を作れない：' + err);
  }

  // ---------- ルール（member_tools.py と同じ） ----------
  var EXCLUDE = '不正クレジット使用不可会員', KOBUTA = ['こぶた', 'こぶた(CP)'], RANK4 = ['おしゃれぶた', 'セレブぶた', 'ぶたのおひめさま', 'VIPIG'];
  var KNOWN = ['こぶた', 'おしゃれぶた', 'セレブぶた', 'ぶたのおひめさま', 'VIPig', 'こぶた(CP)', EXCLUDE, 'ゲスト', 'クレジット、paypayのみ可', 'close', 'test', 'テスト', 'クレジット注文のみ可'];
  var up = function (s) { return (s || '').toUpperCase(); };
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
      [ym + '誕生日クーポン配布メール', '誕生日グループ全員', function (x) { return isb(x.b); }],
      ['【' + ym + 'ランクキープ】VIPIG', keepAll ? '今月VIPIG全員' : '2ヶ月連続VIPIG', function (x) { return up(x.rank) === 'VIPIG' && (keepAll || prev.has(x.no)); }]
    ];
    var ms = mem.map(function (x) { return { no: x.no, rank: x.rank, b: bmonth(x.birth) }; });
    var assign = [], counts = {};
    G.forEach(function (g) { var a = ms.filter(function (x) { return x.rank !== EXCLUDE && g[2](x); }); a.forEach(function (x) { assign.push([g[0], x.no]); }); counts[g[0]] = a.length; });
    var rc = {}; ms.forEach(function (x) { rc[x.rank] = (rc[x.rank] || 0) + 1; });
    var unk = Object.keys(rc).filter(function (r) { return KNOWN.indexOf(r) < 0; });
    var nb = ms.filter(function (x) { return isb(x.b) && x.rank !== EXCLUDE; }).length;
    var bt = G.slice(4, 9).reduce(function (s, g) { return s + counts[g[0]]; }, 0), rt = G.slice(0, 4).reduce(function (s, g) { return s + counts[g[0]]; }, 0);
    var dup = ms.length - new Set(ms.map(function (x) { return x.no; })).size, badb = ms.filter(function (x) { return x.b === '?'; }).length;
    var checks = [
      ['今月の会員数', ms.length, ms.length >= (STG ? 1 : 15000) ? 'OK' : 'NG', '少なすぎる＝会員検索が読めていない'],
      ['先月のVIPig（' + prevYm(ym) + '会員ランクVIPIG グループ）', prev.size, prev.size || keepAll ? 'OK' : 'NG', '0人だとランクキープのお礼メールの宛先が空になる'],
      ['読めないランク名', unk.join('・') || 0, unk.length ? 'NG' : 'OK', '新しいランクができた可能性（増田へ）'],
      ['生年月日が日付でない', badb, badb ? 'NG' : 'OK', '誕生日グループから漏れる'],
      ['会員番号の重複', dup, dup ? 'NG' : 'OK', ''],
      ['誕生日5グループの合計＝誕生日メールの人数', bt + ' / ' + counts[G[10][0]], bt === counts[G[10][0]] && bt === nb ? 'OK' : 'NG', ''],
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
  function render() {
    var r = S.res, h = '<h4>チェック</h4><table>';
    r.checks.forEach(function (c) { h += '<tr><td class="' + (c[2] === 'OK' ? 'ok' : 'ng') + '">' + c[2] + '</td><td>' + esc(c[0]) + '</td><td>' + esc(c[1]) + '</td><td class="mu">' + (c[2] === 'OK' ? '' : esc(c[3])) + '</td></tr>'; });
    h += '</table>';
    if (!S.prevVip && !S.keepAll) h += '<div class="wa">先月の「' + esc(prevYm(S.ym)) + '会員ランクVIPIG」グループが見つかりません。<label><input type="checkbox" class="ka"> 今月のVIPig全員をランクキープのお礼の宛先にする</label></div>';
    h += '<h4>会員グループ（12）</h4><table><tr><th>グループ</th><th>入る人数</th><th>BOの今</th></tr>';
    r.groups.forEach(function (g) { var ex = S.gex[g[0]]; h += '<tr><td>' + esc(g[0]) + '</td><td>' + r.counts[g[0]] + '</td><td class="' + (ex == null ? 'mu' : ex === r.counts[g[0]] ? 'ok' : 'wa') + '">' + (ex == null ? 'まだ無い' : ex + '人' + (ex === r.counts[g[0]] ? '（済）' : '（人数が違う）')) + '</td></tr>'; });
    h += '</table><h4>クーポン（9）有効期間 ' + esc(S.cps[0].s.slice(0, 10)) + '〜' + esc(S.cps[0].f.slice(0, 10)) + '</h4><table><tr><th>ID</th><th>値引き</th><th>発行先</th><th>BOの今</th></tr>';
    S.cps.forEach(function (c) { var ex = S.cex[c.id]; h += '<tr><td>' + esc(c.id) + '</td><td>' + (c.kind === 'yen' ? '￥' + c.v + '引き' : c.v + '％引き') + '</td><td>' + esc(c.group) + '</td><td class="' + (ex ? 'ok' : 'mu') + '">' + (ex ? '作成済（' + esc(ex.count) + '枚）' : 'まだ無い') + '</td></tr>'; });
    h += '</table><div class="mu" style="font-size:11px">先月分のクーポンの文言（フリースペース等）：' + (S.extraFrom ? esc(S.extraFrom) + ' から引き継ぐ' : '見つからないので空のまま作る') + '</div>';
    $('.pv').innerHTML = h;
    var ka = $('.ka'); if (ka) ka.onchange = function () { S.keepAll = ka.checked; recompute(); };
    var gAll = r.groups.every(function (g) { return S.gex[g[0]] === r.counts[g[0]]; }), cAll = S.cps.every(function (c) { return S.cex[c.id]; });
    $('.run').disabled = !r.ok || (gAll && cAll);
    $('.run').textContent = gAll && cAll ? '② 反映済み' : '② この内容で反映';
    renderMail();
  }
  function recompute() { S.res = build(S.ym, S.mem, S.prev, S.keepAll); render(); }
  function renderMail() {
    var names = [[S.ym + '得々クーポン配布メール', 'とこトンとん得々クーポン付与のお知らせ'], [S.ym + '誕生日クーポン配布メール', 'お誕生日クーポン付与のお知らせ'], ['【' + S.ym + 'ランクキープ】VIPIG', 'VIPigランク継続のお礼']];
    var h = '<h4>③ お知らせメール3通（②のあとに）</h4><div class="mu" style="font-size:12px">ランクアップのお知らせは10時にメルカートが自動で送るので不要。リンクを押すと、宛先グループの会員一覧が最大件数30000で開く（100人だけに届く事故は起きない）。件数を確かめて［メール送信］→ テンプレートを選ぶ →［下記のメールリストで確定する］→ テスト送信 → 一括送信。</div><table>';
    names.forEach(function (n) { var c = S.gex[n[0]]; h += '<tr><td>' + esc(n[1]) + '</td><td>' + esc(n[0]) + '</td><td>' + (c != null ? '<a target="_blank" href="' + esc(BO + '/customer/search.aspx?cgname=' + encodeURIComponent(n[0]) + '&disp.divcgname=open&max=30000') + '">宛先' + c + '人を開く</a>' : '<span class="mu">②のあとに出る</span>') + '</td></tr>'; });
    $('.ml').innerHTML = h + '</table>';
  }
  async function check() {
    $('.ck').disabled = true; $('.run').disabled = true; $('.pv').innerHTML = '読み込み中…（会員数が多いと30秒ほど）';
    try {
      var ym = $('.ym').value.trim(); if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error('対象月は 2026-11 の形で');
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
      S.extra = {}; S.extraFrom = '';
      for (var c of S.cps) { var e = await prevCouponExtras(prevYm(ym) + c.tail); if (e) { S.extra[c.tail] = e; S.extraFrom = prevYm(ym) + '分'; } }
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
      $('.pv').insertAdjacentHTML('afterbegin', '<div class="ok" style="font-size:14px">✅ ②まで完了。続けて③のお知らせメールを送ってください。</div>');
    } catch (e) { render(); $('.pv').insertAdjacentHTML('afterbegin', '<div class="ng">止めました：' + esc(e.message) + '<br>直してからもう一度①→②（済んだところは飛ばします）</div>'); log('NG ' + e.message); }
    $('.ck').disabled = false;
  }
  $('.ck').onclick = check; $('.run').onclick = run;
})();
