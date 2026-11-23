/* SIS 購入者クーポン — #SP-1
 * 決めた商品を決めた期間に買った会員に、1つ買うごとに決めた枚数のクーポンを配る（例：福袋のお年玉クーポン）
 * ［確認］で人数と配る枚数を見て、［作成］で会員グループの取込 → ユニーククーポンの作成 → 枚数の照合まで進める
 * しくみ（使う人は知らなくてよい）：
 *  ・注文（キャンセル除く）から会員ごとに買った個数を数え、券の金額ごとに「n枚目」のユニーククーポンを作る（発行先＝会員グループ）
 *  ・同じ人たちが持つn枚目はグループを1つにまとめる（例：2027福袋_3000円1-5）。2個買った人は6枚目以降で自動的に増える
 *  ・クーポンIDは「使える期間の開始年月（YYMM）-金額-n枚目」（例 2701-3000-1）。何度押しても二重にならない
 *  ・ゲスト購入（会員番号なし）は配れないので人数だけ出す
 */
(function () {
  'use strict';
  var VER = '購入者クーポン v1.0 (2026-11-23)';
  var BO = location.pathname.split('/').slice(0, 2).join('/');
  var STG = /mercart-stg/.test(location.hostname);
  var C1 = STG ? '#2b8a3e' : '#d9480f', C2 = STG ? '#ebfbee' : '#fff4e6';
  var KEY = 'sis_buyercoupon_v1';
  var CFG; try { CFG = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { CFG = null; }
  if (!CFG) CFG = { title: '', od1: '', od2: '', s: '', f: '', items: [{ code: '', amt: '', n: '' }] };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(CFG)); } catch (e) {} }

  var old = document.getElementById('sisbc'); if (old) old.remove();
  var box = document.createElement('div'); box.id = 'sisbc';
  box.innerHTML =
    '<style>#sisbc{position:fixed;right:12px;top:12px;z-index:2147483000;width:640px;max-width:calc(100vw - 24px);max-height:92vh;overflow:auto;background:#fff;border:2px solid ' + C1 + ';border-radius:10px;font:13px/1.6 sans-serif;color:#222;box-shadow:0 4px 16px rgba(0,0,0,.2)}' +
    '#sisbc .hd{padding:8px 12px;background:' + C2 + ';font-weight:bold;display:flex;justify-content:space-between}#sisbc .bd{padding:10px 12px}' +
    '#sisbc table{border-collapse:collapse;width:100%;font-size:12px;margin-top:4px}#sisbc td,#sisbc th{border-bottom:1px solid #eee;padding:4px;text-align:left}' +
    '#sisbc input{font-size:12px;padding:3px 4px;border:1px solid #ccc;border-radius:3px;box-sizing:border-box}' +
    '#sisbc .ok{color:#2b8a3e;font-weight:bold}#sisbc .ng{color:#c92a2a;font-weight:bold}#sisbc .wa{color:#e8590c;font-weight:bold}#sisbc .mu{color:#868e96}' +
    '#sisbc button{padding:7px 14px;margin:10px 6px 0 0;border-radius:6px;border:1px solid #888;background:#f8f8f8;cursor:pointer}#sisbc button.go{background:' + C1 + ';color:#fff;border:none;font-weight:bold}#sisbc button:disabled{opacity:.45;cursor:not-allowed}' +
    '#sisbc .del{border:none;background:none;color:#868e96;font-size:16px;cursor:pointer;padding:0 4px;margin:0}#sisbc h4{margin:12px 0 2px;font-size:13px}</style>' +
    '<div class="hd"><span>SIS 購入者クーポン（' + (STG ? 'stg 検証環境' : '本番') + '）</span><span title="' + VER + '"><a href="#" class="x" style="color:#222;text-decoration:none">×</a></span></div>' +
    '<div class="bd"><div class="fm"></div><button class="ld">確認</button><button class="go" disabled>作成</button><div class="msg"></div><div class="pv"></div></div>';
  document.body.appendChild(box);
  var $ = function (s) { return box.querySelector(s); };
  $('.x').onclick = function (e) { e.preventDefault(); box.remove(); };
  function log(m) { console.log('[SISBC]', m); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var pad = function (n) { return ('0' + n).slice(-2); };

  /* ---------- 日付（日本時間・日単位） ---------- */
  function dnum(s) { var m = String(s || '').match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : NaN; } // 日の通し番号
  function dstr(n) { var d = new Date(n * 864e5); return d.getUTCFullYear() + '/' + pad(d.getUTCMonth() + 1) + '/' + pad(d.getUTCDate()); }
  function tms(s) { var m = String(s || '').match(/(\d{4})\D(\d{1,2})\D(\d{1,2})(?:\D+(\d{1,2}):(\d{2}))?/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], (+m[4] || 0) - 9, +m[5] || 0) : NaN; } // 日本時間→ミリ秒
  function jstDay(ms) { return Math.floor((ms + 9 * 36e5) / 864e5); }
  function md(n) { var d = new Date(n * 864e5); return (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日'; }

  /* ---------- Shift_JIS・CSV ---------- */
  var ENC = null;
  function sjis(str) {
    if (!ENC) {
      ENC = new Map(); var dec = new TextDecoder('shift_jis');
      for (var b1 = 0x81; b1 <= 0xFC; b1++) { if (b1 > 0x9F && b1 < 0xE0) continue;
        for (var b2 = 0x40; b2 <= 0xFC; b2++) { if (b2 === 0x7F) continue; var s = dec.decode(new Uint8Array([b1, b2])); if (s.length === 1 && s !== '\ufffd' && !ENC.has(s)) ENC.set(s, [b1, b2]); } }
      for (var b = 0xA1; b <= 0xDF; b++) ENC.set(dec.decode(new Uint8Array([b])), [b]);
    }
    var out = [];
    for (var ch of str.replace(/\u301c/g, '\uff5e').replace(/\u2212/g, '\uff0d')) { var c = ch.codePointAt(0); if (c < 0x80) { out.push(c); continue; } var x = ENC.get(ch); if (!x) throw new Error('Shift_JISにできない文字: ' + ch); out.push.apply(out, x); }
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

  /* ---------- BOの画面を裏で使う ---------- */
  async function doc(path) {
    var d = new DOMParser().parseFromString(await (await fetch(BO + '/' + path, { credentials: 'include', cache: 'no-store' })).text(), 'text/html');
    if (!d.forms[0]) throw new Error('BOの画面を開けない（ログイン切れの可能性）: ' + path.split('?')[0]);
    return d;
  }
  function fdOf(form) {
    var fd = new FormData();
    for (var e of form.elements) { if (!e.name || e.disabled) continue;
      if ((e.type === 'checkbox' || e.type === 'radio') && !e.checked) continue;
      if (e.type === 'submit' || e.type === 'button' || e.type === 'file') continue;
      if (e.tagName === 'SELECT' && e.multiple) { [].slice.call(e.selectedOptions).forEach(function (o) { fd.append(e.name, o.value); }); continue; }
      fd.append(e.name, e.value); }
    return fd;
  }
  function live(path, read) {
    return new Promise(function (ok, ng) {
      var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:-9999px;width:800px;height:600px';
      var t = setTimeout(function () { fr.remove(); ng(new Error('画面が開けない: ' + path)); }, 30000);
      fr.onload = function () { setTimeout(function () { clearTimeout(t);
        try { var d = fr.contentDocument; if (!d || !d.forms[0]) throw new Error('ログイン切れの可能性'); var v = read(d); fr.remove(); ok(v); } catch (e) { fr.remove(); ng(e); } }, 1200); };
      fr.src = BO + '/' + path; document.body.appendChild(fr);
    });
  }
  async function post(path, pairs) {
    var fd = new URLSearchParams(); pairs.forEach(function (p) { fd.append(p[0], p[1]); });
    var r = await fetch(BO + '/' + path, { method: 'POST', body: fd, credentials: 'include', cache: 'no-store' });
    var ct = r.headers.get('content-type') || '', b = await r.arrayBuffer();
    var t = new TextDecoder(/html/.test(ct) ? 'utf-8' : 'shift_jis').decode(b);
    if (/html/.test(ct)) throw new Error('注文検索のCSVが取れない（ログイン切れの可能性）');
    return t;
  }

  async function orders() {
    var a = CFG.od1.replace(/-/g, '/'), b = CFG.od2.replace(/-/g, '/');
    log('注文を読む ' + a + '〜' + b);
    var O = parseCSV(await post('sales/search.aspx', [['mode', 'VIEW_CSV'], ['order_dt1', a], ['order_dt2', b], ['max', '100000'], ['view.cancel_dt', '1'], ['view.customer', '1'], ['view.order_dt', '1']]));
    var oh = O[0] || [], iNo = oh.indexOf('注文番号'), iC = oh.indexOf('キャンセル日'), iM = oh.indexOf('会員番号');
    if (iNo < 0 || iM < 0) throw new Error('注文検索のCSVに注文番号・会員番号がない');
    var mem = {}, can = {}; O.slice(1).forEach(function (c) { var no = c[iNo]; if (!no) return; if (c[iC]) can[no] = 1; else mem[no] = (c[iM] || '').trim(); });
    var Dt = parseCSV(await post('sales/search.aspx', [['mode', 'DETAIL_CSV'], ['order_dt1', a], ['order_dt2', b], ['max', '200000'], ['csvview.goods', '1'], ['csvview.qty', '1']]));
    var dh = Dt[0] || [], jNo = dh.indexOf('注文番号'), jG = dh.indexOf('商品コード'), jQ = dh.indexOf('数量');
    if (jNo < 0 || jG < 0 || jQ < 0) throw new Error('注文明細のCSVに注文番号・商品コード・数量がない');
    return { mem: mem, can: can, lines: Dt.slice(1).map(function (c) { return { no: c[jNo], code: (c[jG] || '').trim(), q: +c[jQ] || 0 }; }) };
  }
  async function groupList(word) {
    var d = await doc('customergroup/list.aspx');
    return [].slice.call(d.querySelectorAll('a')).filter(function (a) { return a.textContent.indexOf(word) >= 0; }).map(function (a) {
      return { name: a.textContent.trim(), count: +((a.parentElement.textContent.match(/\((\d+)\)/) || [])[1] || 0) };
    });
  }
  function importLog() {
    return live('import/imp_customergroup.aspx', function (d) {
      return [].slice.call(d.querySelectorAll('tr')).map(function (tr) { return [].slice.call(tr.cells).map(function (c) { return c.textContent.trim().replace(/\s+/g, ' '); }); })
        .filter(function (c) { return /20\d\d\/\d\d\/\d\d \d/.test(c[0] || ''); }).map(function (c) { return { status: c[1], file: c[2] }; });
    });
  }
  async function importCSV(table, header, rows) {
    var d = await doc('import/imp_customergroup.aspx'), f = d.forms[0], fd = fdOf(f);
    fd.set('table', table); fd.set('header', '1'); fd.set('format', 'CSV'); fd.delete('initialize');
    var name = 'sishb_' + table + '_' + Date.now() + '.csv';
    fd.set('txtFile', new Blob([sjis([header].concat(rows).map(csvLine).join('\r\n') + '\r\n')], { type: 'text/csv' }), name);
    fd.set('cmdUpload', f.querySelector('[name=cmdUpload]').value);
    await (await fetch(BO + '/import/imp_customergroup.aspx', { method: 'POST', body: fd, credentials: 'include' })).text();
    log('取込を送信：' + (table === 'tmpcustomergrp' ? 'グループ' : 'メンバー') + ' ' + rows.length + '行');
    for (var i = 0; i < 60; i++) {
      await sleep(8000);
      var me = (await importLog()).filter(function (x) { return x.file === name; })[0];
      if (me && /success/i.test(me.status)) { log('取込完了'); return; }
      if (me && /error|fail|エラー/i.test(me.status)) throw new Error('取込エラー：' + me.status);
    }
    throw new Error('取込が8分で終わらない（会員グループインポートの処理状況を確認してから、もう一度［作成］）');
  }
  async function couponList(prefix) {
    var d = await doc('coupon/event_list.aspx?coupon_event=' + encodeURIComponent(prefix) + '&cmdSearch=1');
    return [].slice.call(d.querySelectorAll('tr')).map(function (tr) { return [].slice.call(tr.cells).map(function (c) { return c.textContent.trim().replace(/\s+/g, ' '); }); })
      .filter(function (c) { return c[1] && c[1].indexOf(prefix) === 0; }).map(function (c) { return { id: c[1], name: c[2], term: c[3], count: c[5] }; });
  }
  var SKIP = /^(__|mode$|coupon_type$|coupon_event$|name$|customer_group_name$|coupon_count$|s_dt$|f_dt$|x_s_dt$|x_f_dt$|condition_x_term$|amount|cmd|bonus_type|coupon_cut_|customer_allotment|status$|condition_term$)/;
  async function couponForm(id) {
    try {
      var d = await doc('coupon/event_detail.aspx?mode=update&coupon_type=1&coupon_event=' + encodeURIComponent(id)), fd = new FormData(d.forms[0]);
      if (fd.get('coupon_event') !== id) return null; var e = []; fd.forEach(function (v, k) { e.push([k, String(v)]); }); return e;
    } catch (x) { return null; }
  }
  async function createCoupon(c) {
    var path = 'coupon/event_detail.aspx?mode=regist&coupon_type=1';
    var d = await doc(path), f = d.forms[0], fd = fdOf(f);
    fd.set('smartphone_is_pc', '1');
    fd.set('coupon_event', c.id); fd.set('name', c.name);
    fd.set('bonus_type', '0'); fd.set('coupon_cut_price', String(c.amt));
    fd.set('customer_allotment', '0'); fd.set('customer_group_name', c.group);
    fd.set('condition_term', 'true'); fd.set('s_dt', c.s); fd.set('f_dt', c.f); fd.set('status', '0');
    fd.set('cmdInsert', f.querySelector('[name=cmdInsert]').value);
    var t = new DOMParser().parseFromString(await (await fetch(BO + '/' + path, { method: 'POST', body: fd, credentials: 'include' })).text(), 'text/html').body.textContent.replace(/\s+/g, ' ');
    var err = (t.match(/[^ ]{0,30}(入力して|できません|存在しません|エラー|不正|重複)[^ ]{0,30}/) || [''])[0];
    if (err) throw new Error('クーポン ' + c.id + ' を作れない：' + err);
    if (!(await couponForm(c.id))) throw new Error('クーポン ' + c.id + ' を読み戻せない。クーポンイベント管理で確認');
  }

  /* ---------- 画面 ---------- */
  function dt(s) { var m = String(s || '').match(/(\d{4})\D(\d{1,2})\D(\d{1,2})\D(\d{1,2}):(\d{2})/); return m ? m[1] + '/' + pad(m[2]) + '/' + pad(m[3]) + ' ' + pad(m[4]) + ':' + m[5] + ':00' : null; }
  function idHead() { var m = String(CFG.s || '').match(/\d{2}(\d{2})\D(\d{1,2})/); return m ? m[1] + pad(m[2]) : ''; }
  function form() {
    var inp = function (k, t, w, ph) { return '<input type="' + t + '" class="cf" data-k="' + k + '" value="' + esc(CFG[k]) + '" style="width:' + w + 'px"' + (ph ? ' placeholder="' + ph + '"' : '') + '>'; };
    var h = '<table><tr><td style="width:110px">名前</td><td>' + inp('title', 'text', 200, '例：2027福袋') + ' <span class="mu">クーポン名・グループ名に付く</span></td></tr>' +
      '<tr><td>対象の注文日</td><td>' + inp('od1', 'date', 140) + ' 〜 ' + inp('od2', 'date', 140) + '</td></tr>' +
      '<tr><td>使える期間</td><td>' + inp('s', 'datetime-local', 190) + ' 〜 ' + inp('f', 'datetime-local', 190) + '</td></tr></table>' +
      '<h4>商品ごとのクーポン（1つ買うごと）</h4><table><tr><th>商品コード</th><th>1枚の金額</th><th>枚数</th><th></th></tr>';
    CFG.items.forEach(function (x, i) {
      h += '<tr><td><input type="text" class="it" data-i="' + i + '" data-k="code" value="' + esc(x.code) + '" style="width:200px"></td>' +
        '<td><input type="number" class="it" data-i="' + i + '" data-k="amt" value="' + esc(x.amt) + '" style="width:90px" placeholder="3000"> 円</td>' +
        '<td><input type="number" class="it" data-i="' + i + '" data-k="n" value="' + esc(x.n) + '" style="width:60px" placeholder="5"> 枚</td>' +
        '<td><button class="del" data-i="' + i + '" title="この行を消す">×</button></td></tr>';
    });
    h += '</table><div class="mu">金額が2種類ある商品は、同じ商品コードで2行にする</div><button class="add">＋ 行を足す</button>';
    $('.fm').innerHTML = h;
    var reset = function () { S.res = null; $('.go').disabled = true; $('.pv').innerHTML = ''; };
    [].slice.call(box.querySelectorAll('.cf')).forEach(function (e) { e.onchange = function () { CFG[e.dataset.k] = e.value.trim(); save(); reset(); }; });
    [].slice.call(box.querySelectorAll('.it')).forEach(function (e) { e.onchange = function () { CFG.items[+e.dataset.i][e.dataset.k] = e.value.trim(); save(); reset(); }; });
    [].slice.call(box.querySelectorAll('.fm .del')).forEach(function (e) { e.onclick = function () { CFG.items.splice(+e.dataset.i, 1); if (!CFG.items.length) CFG.items.push({ code: '', amt: '', n: '' }); save(); reset(); form(); }; });
    $('.add').onclick = function () { CFG.items.push({ code: '', amt: '', n: '' }); save(); form(); };
  }
  function validate() {
    if (!CFG.title) throw new Error('名前を入れる');
    if (!CFG.od1 || !CFG.od2) throw new Error('対象の注文日を入れる');
    if (!dt(CFG.s) || !dt(CFG.f)) throw new Error('使える期間を入れる');
    if (dt(CFG.s) >= dt(CFG.f)) throw new Error('使える期間の終わりが始まりより前');
    var items = CFG.items.filter(function (x) { return x.code || x.amt || x.n; });
    if (!items.length) throw new Error('商品コードを入れる');
    items.forEach(function (x) { if (!x.code || !(+x.amt > 0) || !(+x.n > 0)) throw new Error('商品コード・金額・枚数を全部入れる（' + (x.code || '空の行') + '）'); });
    return items;
  }
  function build(od, items) {
    var byCode = {}; items.forEach(function (x) { (byCode[x.code] = byCode[x.code] || []).push({ amt: +x.amt, n: +x.n }); });
    var need = {}, amts = {}, guest = 0, canN = 0, buyers = {}, bags = 0;
    od.lines.forEach(function (l) {
      var sp = byCode[l.code]; if (!sp || !l.q) return;
      if (od.can[l.no]) { canN += l.q; return; }
      var m = od.mem[l.no]; if (m == null) return;
      if (!m) { guest += l.q; return; }
      bags += l.q; buyers[m] = (buyers[m] || 0) + l.q;
      sp.forEach(function (s) { amts[s.amt] = 1; var k = m + '|' + s.amt; need[k] = (need[k] || 0) + s.n * l.q; });
    });
    var groups = [], coupons = [], head = idHead();
    Object.keys(amts).map(Number).sort(function (a, b) { return a - b; }).forEach(function (amt) {
      var mems = Object.keys(buyers).map(function (m) { return { m: m, n: need[m + '|' + amt] || 0 }; }).filter(function (x) { return x.n; });
      var max = mems.reduce(function (s, x) { return Math.max(s, x.n); }, 0), k = 1;
      while (k <= max) {
        var set = mems.filter(function (x) { return x.n >= k; }), e = k;
        while (e + 1 <= max && mems.filter(function (x) { return x.n >= e + 1; }).length === set.length) e++;
        var g = { name: CFG.title + '_' + amt + '円' + (k === e ? k : k + '-' + e), label: amt.toLocaleString() + '円券（' + (k === e ? k : k + '〜' + e) + '枚目）', members: set.map(function (x) { return x.m; }), ids: [] };
        for (var i = k; i <= e; i++) { var c = { id: head + '-' + amt + '-' + i, name: CFG.title + ' ' + amt.toLocaleString() + '円クーポン（' + i + '枚目）', amt: amt, group: g.name, n: set.length }; coupons.push(c); g.ids.push(c.id); }
        groups.push(g); k = e + 1;
      }
    });
    return { groups: groups, coupons: coupons, buyers: Object.keys(buyers).length, bags: bags, guest: guest, can: canN, multi: Object.keys(buyers).filter(function (m) { return buyers[m] > 1; }).length };
  }
  var S = { res: null, gex: {}, cex: {} };
  async function refresh() {
    S.gex = {}; (await groupList(CFG.title + '_')).forEach(function (g) { S.gex[g.name] = g.count; });
    S.cex = {}; (await couponList(idHead() + '-')).forEach(function (c) { S.cex[c.id] = c; });
  }
  function gstate(g) {
    var ex = S.gex[g.name], cs = g.ids.map(function (id) { return S.cex[id]; });
    if (ex == null && cs.every(function (c) { return !c; })) return '<td>未作成</td>';
    if (ex === g.members.length && cs.every(function (c) { return c && +c.count === g.members.length; })) return '<td class="ok">作成済</td>';
    return '<td class="wa">途中</td>';
  }
  function preview() {
    var r = S.res, h = '<h4>購入者 ' + r.buyers + '人・' + r.bags + '個' + (r.multi ? '（2個以上 ' + r.multi + '人）' : '') + '</h4>' +
      (r.guest ? '<div class="wa">ゲスト購入 ' + r.guest + '個：会員でないため配れない</div>' : '') + (r.can ? '<div class="mu">キャンセル ' + r.can + '個は除く</div>' : '');
    h += '<table><tr><th>配るクーポン</th><th>人数</th><th>状態</th></tr>';
    r.groups.forEach(function (g) { h += '<tr><td>' + esc(g.label) + '</td><td>' + g.members.length + '人</td>' + gstate(g) + '</tr>'; });
    h += '</table>';
    var done = r.groups.length && r.groups.every(function (g) { return /作成済/.test(gstate(g)); });
    if (done) h += '<div class="ok" style="margin-top:6px">すべて作成済み</div>';
    $('.pv').innerHTML = h; $('.go').disabled = done || !r.groups.length;
  }
  $('.ld').onclick = async function () {
    $('.ld').disabled = true; $('.msg').innerHTML = '<span class="mu">確認中…</span>';
    try {
      var items = validate(); S.res = build(await orders(), items);
      await refresh();
      var clash = S.res.coupons.filter(function (c) { return S.cex[c.id] && S.cex[c.id].name.indexOf(CFG.title) !== 0; });
      if (clash.length) throw new Error('同じIDの別のクーポンがある（' + clash[0].id + '）。使える期間の開始月を確認');
      $('.msg').innerHTML = S.res.groups.length ? '' : '<div class="wa">対象の注文がない</div>'; preview();
    } catch (e) { S.res = null; $('.msg').innerHTML = '<div class="ng">' + esc(e.message) + '</div>'; }
    $('.ld').disabled = false;
  };
  $('.go').onclick = async function () {
    var r = S.res; $('.go').disabled = true; $('.ld').disabled = true; $('.msg').innerHTML = '<span class="mu">作成中…（数分）</span>';
    try {
      await refresh();
      var bad = r.groups.filter(function (g) { return S.gex[g.name] != null && S.gex[g.name] !== 0 && S.gex[g.name] !== g.members.length; });
      if (bad.length) throw new Error('人数の違う同じ名前のグループがある：' + bad.map(function (g) { return g.name; }).join('、'));
      var miss = r.groups.filter(function (g) { return S.gex[g.name] == null; });
      if (miss.length) await importCSV('tmpcustomergrp', ['会員グループ名', '備考'], miss.map(function (g) { return [g.name, 'SIS購入者クーポン ' + CFG.od1 + 'から' + CFG.od2 + 'の購入者']; }));
      await refresh();
      var empty = r.groups.filter(function (g) { return !S.gex[g.name]; });
      if (empty.length) { var rows = []; empty.forEach(function (g) { g.members.forEach(function (m) { rows.push([g.name, m]); }); }); await importCSV('tmpcustomergrpmember', ['会員グループ名', '会員番号'], rows); }
      await refresh();
      var ng = r.groups.filter(function (g) { return S.gex[g.name] !== g.members.length; });
      if (ng.length) throw new Error('グループの人数が合わない：' + ng.map(function (g) { return g.name; }).join('、'));
      var sdt = dt(CFG.s), fdt = dt(CFG.f).replace(/:00$/, ':59');
      for (var c of r.coupons) { if (S.cex[c.id]) continue; log('クーポン作成 ' + c.id); await createCoupon({ id: c.id, name: c.name, amt: c.amt, group: c.group, s: sdt, f: fdt }); }
      await refresh(); preview();
      var cng = r.coupons.filter(function (c) { return !S.cex[c.id] || +S.cex[c.id].count !== c.n; });
      if (cng.length) throw new Error('枚数が合わない：' + cng.map(function (c) { return c.id; }).join('、'));
      $('.msg').innerHTML = '<div class="ok">作成しました</div>';
    } catch (e) { log(e.message); $('.msg').innerHTML = '<div class="ng">止めました：' + esc(e.message) + '</div>'; await refresh().catch(function () {}); preview(); }
    $('.ld').disabled = false;
  };
  form();
})();
