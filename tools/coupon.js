/* SIS クーポン設定（T-34）— セール依頼シートの「クーポン」タブを貼り付けて、BOのクーポンを登録・更新する
 * 使い方：シートの「クーポン」タブで Cmd＋A → Cmd＋C → BOでブックマーク「クーポン設定」→ 欄に Cmd＋V →「この内容で反映」
 * 管理画面で手入力する項目はない（ダブルチェックはシートで行う）。
 * 対応：特典（n%OFF／n円引き／送料無料／ポイントn倍）・有効期間・除外期間・対象イベント（その商品だけ）・除外イベント・
 *       ○円以上・1人○回まで・先着○回まで・会員限定・有効／無効。共通クーポン（コード1つ）のみ。
 */
(function () {
  'use strict';
  var BO = location.pathname.split('/').slice(0, 2).join('/');
  var STG = /mercart-stg|stg/.test(location.hostname);
  var VER = 'T34 v1.0 (2026-10-24)';
  var old = document.getElementById('sis34'); if (old) old.remove();
  var box = document.createElement('div'); box.id = 'sis34';
  box.innerHTML =
    '<style>#sis34{position:fixed;right:12px;top:12px;z-index:2147483000;width:560px;max-height:92vh;overflow:auto;background:#fff;border:2px solid ' + (STG ? '#2b8a3e' : '#d9480f') + ';border-radius:10px;font:13px/1.5 sans-serif;color:#222;box-shadow:0 4px 16px rgba(0,0,0,.2)}' +
    '#sis34 .hd{padding:8px 12px;background:' + (STG ? '#ebfbee' : '#fff4e6') + ';font-weight:bold;display:flex;justify-content:space-between}#sis34 .bd{padding:10px 12px}' +
    '#sis34 textarea{width:100%;height:60px;box-sizing:border-box;font-size:11px}#sis34 table{border-collapse:collapse;width:100%;font-size:12px;margin-top:6px}' +
    '#sis34 td,#sis34 th{border-bottom:1px solid #eee;padding:3px 4px;text-align:left;vertical-align:top}#sis34 .new{color:#1971c2;font-weight:bold}#sis34 .upd{color:#e8590c;font-weight:bold}#sis34 .same{color:#868e96}#sis34 .ng{color:#c92a2a;font-weight:bold}' +
    '#sis34 button{padding:8px 12px;margin:8px 6px 0 0;border-radius:6px;border:1px solid #888;background:#f8f8f8;cursor:pointer}#sis34 button.go{background:' + (STG ? '#2b8a3e' : '#d9480f') + ';color:#fff;border:none;font-weight:bold}' +
    '#sis34 pre{white-space:pre-wrap;background:#f6f6f6;padding:6px;max-height:200px;overflow:auto;margin:8px 0 0;font-size:12px}</style>' +
    '<div class="hd"><span>SIS クーポン設定（' + (STG ? 'stg 検証環境' : '本番') + '）</span><span style="font-weight:normal;color:#888;font-size:11px">' + VER + '　<a href="#" class="x">×</a></span></div>' +
    '<div class="bd"><div style="font-size:12px;color:#555">セール依頼シートの「クーポン」タブで Cmd＋A → Cmd＋C → 下の欄をクリックして Cmd＋V</div>' +
    '<textarea class="paste" placeholder="ここに貼り付け"></textarea><button class="rd" style="margin-top:2px;font-size:12px;padding:4px 8px">コピーした内容を読む（貼り付けできないとき）</button><div class="pv"></div>' +
    '<button class="go" disabled>この内容で反映</button><pre class="log"></pre></div>';
  document.body.appendChild(box);
  var $ = function (s) { return box.querySelector(s); };
  $('.x').onclick = function (e) { e.preventDefault(); box.remove(); };
  var st = { plan: null };
  function log(m) { $('.log').textContent = new Date().toLocaleTimeString('ja-JP') + ' ' + m + '\n' + $('.log').textContent; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tsv(t) {
    var out = [], row = [], cell = '', q = false; t = String(t || '').replace(/\r\n?/g, '\n');
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"' && cell === '') q = true;
      else if (ch === '\t') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); out.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); out.push(row); }
    return out;
  }
  function dt(v, end) { // 2026/11/13 12:00 → 2026/11/13 12:00:00（終了は :59）
    var m = String(v || '').match(/(\d{4})\D(\d{1,2})\D(\d{1,2})(?:\D+(\d{1,2}):(\d{2}))?/); if (!m) return '';
    var hh = m[4] != null ? ('0' + m[4]).slice(-2) : (end ? '23' : '00'), mm = m[5] != null ? m[5] : (end ? '59' : '00');
    return m[1] + '/' + ('0' + m[2]).slice(-2) + '/' + ('0' + m[3]).slice(-2) + ' ' + hh + ':' + mm + ':' + (end && mm === '59' ? '59' : '00');
  }
  function num(v) { var s = String(v || '').replace(/[,，円￥¥\s]/g, ''); return /^\d+(\.\d+)?$/.test(s) ? s : ''; }
  function bonus(v) { // 特典の書き方 → [bonus_type, 値の欄, 値]
    var s = String(v || '').replace(/\s/g, '').replace(/％/g, '%');
    var m;
    if ((m = s.match(/^(\d+)%(OFF|オフ|引き|引)?$/i))) return [1, 'coupon_cut_ratio', m[1]];
    if ((m = s.match(/^[￥¥]?([\d,]+)円?(OFF|オフ|引き|引)?$/i))) return [0, 'coupon_cut_price', m[1].replace(/,/g, '')];
    if (/送料無料/.test(s)) return [2, '', ''];
    if ((m = s.match(/ポイント([\d.]+)倍/))) return [3, 'coupon_point_ratio', m[1]];
    return null;
  }
  function evs(v) { return String(v || '').split(/[,、，\s]+/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 6); }
  function read(text) {
    var rows = tsv(text), hi = rows.findIndex(function (r) { return r.some(function (v) { return String(v).trim() === 'クーポンID'; }); });
    if (hi < 0) throw new Error('「クーポンID」の見出しがない（「クーポン」タブを Cmd＋A でまるごとコピー）');
    var H = rows[hi].map(function (v) { return String(v).trim(); }), col = function (re) { return H.findIndex(function (h) { return re.test(h); }); };
    var C = { id: col(/^クーポンID$/), name: col(/クーポン名/), code: col(/コード/), bonus: col(/特典|割引/), s: col(/有効期間.*開始|^開始/), f: col(/有効期間.*終了|^終了/),
      xs: col(/除外期間.*開始/), xf: col(/除外期間.*終了/), ev: col(/^対象イベント/), xev: col(/除外イベント/), min: col(/円以上|最低/), per: col(/1人|１人/), all: col(/先着/), mem: col(/会員限定/), on: col(/^(状態|有効区分|有効／無効)$/) };
    var get = function (r, k) { return C[k] >= 0 ? String(r[C[k]] == null ? '' : r[C[k]]).trim() : ''; };
    var out = [];
    rows.slice(hi + 1).forEach(function (r, i) {
      var id = get(r, 'id'); if (!id || id === '記入例' || id[0] === '#') return;
      var b = bonus(get(r, 'bonus')), err = [];
      if (!/^[A-Za-z0-9_-]+$/.test(id)) err.push('IDは半角英数字');
      if (!get(r, 'name')) err.push('クーポン名が空');
      if (!b) err.push('特典が読めない（10% ／ 500円 ／ 送料無料 ／ ポイント3倍）');
      var s = dt(get(r, 's')), f = dt(get(r, 'f'), true), xs = dt(get(r, 'xs')), xf = dt(get(r, 'xf'), true);
      if ((get(r, 's') && !s) || (get(r, 'f') && !f)) err.push('有効期間が読めない');
      if (s && f && f <= s) err.push('有効期間の終了が開始より前');
      if ((xs && !xf) || (!xs && xf)) err.push('除外期間は開始と終了の両方');
      var ev = evs(get(r, 'ev')), xev = evs(get(r, 'xev'));
      if (ev.length > 5 || xev.length > 5) err.push('イベントは5つまで');
      if (num(get(r, 'per')) && !/^(○|〇|はい|会員|true|1)$/i.test(get(r, 'mem'))) err.push('「1人○回まで」は会員限定に○のときだけ使える（メルカートの決まり）');
      out.push({ row: hi + 2 + i, id: id, name: get(r, 'name'), code: get(r, 'code') || id, b: b, s: s, f: f, xs: xs, xf: xf, ev: ev, xev: xev,
        min: num(get(r, 'min')), per: num(get(r, 'per')), all: num(get(r, 'all')), mem: /^(○|〇|はい|会員|true|1)$/i.test(get(r, 'mem')),
        on: !/^(無効|×|停止|off|いいえ)$/i.test(get(r, 'on')), err: err });
    });
    return out;
  }
  async function form(q) {
    var d = new DOMParser().parseFromString(await (await fetch(BO + '/coupon/event_detail.aspx' + q, { credentials: 'include', cache: 'no-store' })).text(), 'text/html');
    var fm = d.querySelector('form'); if (!fm) throw new Error('クーポンの画面を開けない（ログイン切れの可能性）');
    return { d: d, fd: new FormData(fm) };
  }
  async function exists(id) {
    var f = await form('?mode=update&coupon_type=0&coupon_event=' + encodeURIComponent(id));
    return f.d.querySelector('[name=cmdUpdate]') && f.fd.get('coupon_event') === id ? f : null;
  }
  function fill(fd, c) { // 1行の内容をフォームへ。変えた欄を返す
    var ch = [], set = function (k, v) { v = v == null ? '' : String(v); if (String(fd.get(k) == null ? '' : fd.get(k)) !== v) ch.push(k); fd.set(k, v); };
    set('name', c.name);
    set('bonus_type', c.b[0]); set('bonus_type_dummy', c.b[0]);
    ['coupon_cut_price', 'coupon_cut_ratio', 'coupon_point_ratio'].forEach(function (k) { set(k, k === c.b[1] ? c.b[2] : ''); });
    set('s_dt', c.s); set('f_dt', c.f); set('condition_term', c.s || c.f ? 'true' : '');
    set('x_s_dt', c.xs); set('x_f_dt', c.xf); set('condition_x_term', c.xs ? 'true' : '');
    set('subtotal_min', c.min); set('subtotal_max', ''); set('condition_subtotal', c.min ? 'true' : '');
    set('customer_cnt_limit', c.per); set('condition_customer_cnt_limit', c.per ? 'true' : '');
    set('amount_cnt_limit', c.all); set('condition_amount_cnt_limit', c.all ? 'true' : '');
    set('coupon_target', '0'); set('condition_coupon_target', c.mem ? 'true' : ''); // 会員限定は condition_coupon_target だけで決まる（coupon_target は0のまま。1にすると「クーポン対象が大きすぎます」）
    for (var i = 1; i <= 5; i++) { set('event_' + i, c.ev[i - 1] || ''); set('x_event_' + i, c.xev[i - 1] || ''); }
    set('condition_goods_event', c.ev.length ? 'true' : ''); set('condition_x_goods_event', c.xev.length ? 'true' : '');
    set('status', c.on ? '0' : '1');
    return ch;
  }
  var LABEL = { name: '名前', bonus_type: '特典', coupon_cut_price: '金額', coupon_cut_ratio: '割引率', coupon_point_ratio: 'ポイント倍率', s_dt: '有効期間', f_dt: '有効期間', x_s_dt: '除外期間', x_f_dt: '除外期間',
    subtotal_min: '○円以上', customer_cnt_limit: '1人○回', amount_cnt_limit: '先着○回', coupon_target: '会員限定', status: '有効／無効' };
  async function plan(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.err.length) { out.push({ c: c, act: 'ng', why: c.err.join('、') }); continue; }
      var f = await exists(c.id);
      if (!f) { out.push({ c: c, act: 'new' }); continue; }
      var ch = fill(f.fd, c).map(function (k) { return LABEL[k] || (/event/.test(k) ? '対象イベント' : ''); }).filter(Boolean);
      ch = ch.filter(function (x, j) { return ch.indexOf(x) === j; });
      out.push({ c: c, act: ch.length ? 'upd' : 'same', why: ch.join('・') });
    }
    return out;
  }
  function show(p) {
    var cnt = { new: 0, upd: 0, same: 0, ng: 0 }; p.forEach(function (x) { cnt[x.act]++; });
    var NAME = { new: '新規', upd: '変更', same: '変更なし', ng: '直して' };
    var tb = '<table><tr><th>行</th><th>ID</th><th>名前・特典</th><th>期間</th><th>動き</th></tr>' + p.map(function (x) {
      var c = x.c;
      return '<tr><td>' + c.row + '</td><td>' + esc(c.id) + '</td><td>' + esc(c.name) + '<br>' + esc(c.b ? (c.b[0] === 1 ? c.b[2] + '%OFF' : c.b[0] === 0 ? c.b[2] + '円引き' : c.b[0] === 2 ? '送料無料' : 'ポイント' + c.b[2] + '倍') : '') +
        (c.ev.length ? '<br>対象：' + esc(c.ev.join(',')) : '') + '</td><td>' + esc((c.s || '').slice(0, 16)) + '〜<br>' + esc((c.f || '').slice(0, 16)) + (c.xs ? '<br>除外 ' + esc(c.xs.slice(5, 16)) + '〜' + esc(c.xf.slice(5, 16)) : '') +
        '</td><td class="' + x.act + '">' + NAME[x.act] + (x.why ? '<br><span style="font-weight:normal">' + esc(x.why) + '</span>' : '') + (c.on ? '' : '<br>（無効）') + '</td></tr>';
    }).join('') + '</table>';
    $('.pv').innerHTML = '<div>新規 ' + cnt.new + '・変更 ' + cnt.upd + '・変更なし ' + cnt.same + (cnt.ng ? '・<span class="ng">直して ' + cnt.ng + '</span>' : '') + '</div>' + tb;
    $('.go').disabled = !(cnt.new + cnt.upd) || cnt.ng > 0;
    if (cnt.ng) log('⚠ 「直して」の行があるので反映できません。シートを直して貼り直してください');
  }
  function take(t) {
    (async function () {
      try { var list = read(t); log('貼り付け：' + list.length + '件を確認中…'); st.plan = await plan(list); show(st.plan); log('確認しました。表を見て「この内容で反映」'); }
      catch (er) { log('⚠ ' + er.message); }
    })();
  }
  $('.paste').addEventListener('paste', function (e) { var t = e.clipboardData && e.clipboardData.getData('text/plain'); if (!t) return; e.preventDefault(); this.value = ''; take(t); });
  $('.rd').onclick = async function () { try { take(await navigator.clipboard.readText()); } catch (e) { log('⚠ コピーした内容を読めない（ブラウザの許可）。欄をクリックして Cmd＋V してください'); } };
  $('.go').onclick = async function () {
    var todo = (st.plan || []).filter(function (x) { return x.act === 'new' || x.act === 'upd'; });
    if (!todo.length) return;
    if (!confirm((STG ? '【stg】' : '【本番】') + 'クーポンを反映します。\n' + todo.map(function (x) { return (x.act === 'new' ? '新規 ' : '変更 ') + x.c.id + ' ' + x.c.name; }).join('\n'))) return;
    this.disabled = true;
    for (var i = 0; i < todo.length; i++) {
      var x = todo[i], c = x.c;
      try {
        var f = x.act === 'new' ? await form('?mode=regist&coupon_type=0') : await exists(c.id);
        if (x.act === 'new') { f.fd.set('coupon_event', c.id); f.fd.set('coupon', c.code); }
        fill(f.fd, c);
        f.fd.append(x.act === 'new' ? 'cmdInsert' : 'cmdUpdate', x.act === 'new' ? '登録する' : '更新する');
        var t = await (await fetch(BO + '/coupon/event_detail.aspx', { method: 'POST', body: f.fd, credentials: 'include' })).text();
        var ok = /登録しました|更新しました/.test(t);
        log((ok ? '✅ ' : '⚠ ') + (x.act === 'new' ? '新規 ' : '変更 ') + c.id + (ok ? '' : '：' + new DOMParser().parseFromString(t, 'text/html').body.textContent.replace(/\s+/g, ' ').replace(/.*続けて使用する/, '').slice(0, 160)));
      } catch (e) { log('⚠ ' + c.id + '：' + e.message); }
    }
    log('反映後の内容を読み直しています…');
    st.plan = await plan(st.plan.map(function (p) { return p.c; })); show(st.plan);
    var left = st.plan.filter(function (p) { return p.act !== 'same'; }).length;
    log(left ? '⚠ シートと違うものが ' + left + '件残っています（表の「変更」）' : '✅ すべてシートのとおりになったことを確認');
  };
  window.__sis34 = { st: st, read: read, plan: plan };
})();
