/* SIS ハッピーバッグ（福袋）— #SP-1
 * ① 配送日：福袋ごとに「届く日（から〜まで）」を決めて［反映］
 *    ・購入グループ（happy bag）のリードタイム・表示件数を、次に売る福袋の全注文日でその期間が選べる値に自動計算して更新
 *    ・店舗の /js/usr/sis_hb.js を書き出す（注文画面で期間外の日付を消し、案内文を出す）
 *      order.js・order_sb.js に読み込みの1行が入っていること（設置は一度だけ。本番はメルカート確認後）
 * ② クーポン：販売終了後に［読み込む］→［作成］
 *    ・注文（キャンセル除く）から会員ごとに買った福袋と個数を数え、券種ごとに「n枚目」のユニーククーポンと会員グループを作る
 *    ・同じ人数のn枚目はグループを1つにまとめる（例：2027福袋_3000円1-5）。2個買った人は6枚目以降で自動的に増える
 *    ・何度押しても二重にならない（同じ名前のグループ・同じIDのクーポンがあれば飛ばす）
 */
(function () {
  'use strict';
  var VER = 'HB v1.0 (2026-11-22)';
  var BO = location.pathname.split('/').slice(0, 2).join('/');
  var STG = /mercart-stg/.test(location.hostname);
  var C1 = STG ? '#2b8a3e' : '#d9480f', C2 = STG ? '#ebfbee' : '#fff4e6';
  var KEY = 'sis_hb_cfg_v1';
  var DEF = {
    rules: '88888888',
    bags: [
      { name: 'リサイクル福袋', start: '2026/11/24 12:00', end: '2026/11/30 00:00', from: '2027/01/02', to: '2027/01/06', nopref: '', codes: '' },
      { name: 'Web限定福袋', start: '2026/12/08 12:00', end: '2026/12/14 00:00', from: '2027/01/01', to: '2027/01/04', nopref: '2027/01/01', codes: '' }
    ],
    od1: '2026/12/08', od2: '2026/12/13', idHead: '2701', gHead: '2027福袋', s: '2027/01/04 12:00:00', f: '2027/06/30 23:59:59', tmpl: '',
    items: [
      { code: '', spec: '3000x5' },
      { code: '', spec: '3000x5,5000x2' },
      { code: '', spec: '3000x5,5000x5' }
    ]
  };
  var CFG; try { CFG = JSON.parse(localStorage.getItem(KEY)) || DEF; } catch (e) { CFG = DEF; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(CFG)); } catch (e) {} }

  var old = document.getElementById('sishb'); if (old) old.remove();
  var box = document.createElement('div'); box.id = 'sishb';
  box.innerHTML =
    '<style>#sishb{position:fixed;right:12px;top:12px;z-index:2147483000;width:720px;max-width:calc(100vw - 24px);max-height:92vh;overflow:auto;background:#fff;border:2px solid ' + C1 + ';border-radius:10px;font:13px/1.5 sans-serif;color:#222;box-shadow:0 4px 16px rgba(0,0,0,.2)}' +
    '#sishb .hd{padding:8px 12px;background:' + C2 + ';font-weight:bold;display:flex;justify-content:space-between}#sishb .bd{padding:10px 12px}' +
    '#sishb table{border-collapse:collapse;width:100%;font-size:12px;margin-top:6px}#sishb td,#sishb th{border-bottom:1px solid #eee;padding:3px 4px;text-align:left;vertical-align:top}' +
    '#sishb input[type=text]{font-size:12px;padding:2px 4px;border:1px solid #ccc;border-radius:3px;box-sizing:border-box;width:100%}' +
    '#sishb .ok{color:#2b8a3e;font-weight:bold}#sishb .ng{color:#c92a2a;font-weight:bold}#sishb .wa{color:#e8590c;font-weight:bold}#sishb .mu{color:#868e96}' +
    '#sishb button{padding:7px 12px;margin:8px 6px 0 0;border-radius:6px;border:1px solid #888;background:#f8f8f8;cursor:pointer}#sishb button.go{background:' + C1 + ';color:#fff;border:none;font-weight:bold}#sishb button:disabled{opacity:.45;cursor:not-allowed}' +
    '#sishb .tab{display:inline-block;padding:4px 14px;margin-right:4px;border-radius:6px 6px 0 0;cursor:pointer;color:#868e96;border:1px solid transparent}#sishb .tab.on{color:#222;font-weight:bold;border-color:#ddd;border-bottom-color:#fff}' +
    '#sishb .pane{border-top:1px solid #ddd;padding-top:6px}#sishb h4{margin:10px 0 2px;font-size:13px}#sishb pre{white-space:pre-wrap;background:#f6f6f6;padding:6px;max-height:140px;overflow:auto;margin:8px 0 0;font-size:11px}#sishb a{color:#1971c2}</style>' +
    '<div class="hd"><span>SIS ハッピーバッグ（' + (STG ? 'stg 検証環境' : '本番') + '）</span><span title="' + VER + '"><a href="#" class="x" style="color:#222;text-decoration:none">×</a></span></div>' +
    '<div class="bd"><span class="tab on" data-p="d">配送日</span><span class="tab" data-p="c">クーポン</span>' +
    '<div class="pane pd"></div><div class="pane pc" style="display:none"></div><pre class="log"></pre></div>';
  document.body.appendChild(box);
  var $ = function (s) { return box.querySelector(s); };
  $('.x').onclick = function (e) { e.preventDefault(); box.remove(); };
  [].slice.call(box.querySelectorAll('.tab')).forEach(function (t) {
    t.onclick = function () { [].slice.call(box.querySelectorAll('.tab')).forEach(function (x) { x.classList.toggle('on', x === t); }); $('.pd').style.display = t.dataset.p === 'd' ? '' : 'none'; $('.pc').style.display = t.dataset.p === 'c' ? '' : 'none'; };
  });
  function log(m) { console.log('[SISHB]', m); $('.log').textContent = new Date().toLocaleTimeString('ja-JP') + ' ' + m + '\n' + $('.log').textContent; }
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

  /* ======================= ① 配送日 ======================= */
  async function readGroup() {
    var d = await doc('rules/detail.aspx?Rules=' + encodeURIComponent(CFG.rules)), f = d.forms[0];
    var v = function (n) { var e = f.querySelector('[name="' + n + '"]'); return e ? e.value : null; };
    if (v('rules') !== CFG.rules) throw new Error('購入グループ ' + CFG.rules + ' が見つからない');
    return { d: d, f: f, name: v('name'), use: v('use_delivery_date'), lt1: v('leadtime1'), lt2: v('leadtime2'), cnt: v('date_dispcount'), icon: v('icon1') };
  }
  // 次に売る福袋（販売終了前で一番早いもの）で、全注文日に「届く日」の期間が全部選べるリードタイムと表示件数
  function plan(now) {
    var bags = CFG.bags.filter(function (b) { return b.name && tms(b.end) > now; }).sort(function (a, b) { return tms(a.start) - tms(b.start); });
    if (!bags.length) return { err: '販売終了前の福袋がない' };
    var b = bags[0], d1 = Math.max(jstDay(tms(b.start)), jstDay(now)), d2 = jstDay(tms(b.end) - 60000), F = dnum(b.from), T = dnum(b.to);
    if ([d1, d2, F, T].some(isNaN)) return { err: b.name + 'の日付を確認' };
    if (F > T) return { err: b.name + '：届く日の「から」が「まで」より後' };
    var lt2 = F - d2 - 1; // 最終注文日でも「から」の日が最初に出る
    if (lt2 < 0) return { err: b.name + '：販売終了日より前に届く日がある' };
    var cnt = T - d1 - lt2; // 最初の注文日でも「まで」の日まで出る
    return { bag: b, next: bags[1] || null, lt2: lt2, cnt: cnt, first: [dstr(d1 + lt2 + 1), dstr(d2 + lt2 + 1)], last: [dstr(d1 + lt2 + cnt), dstr(d2 + lt2 + cnt)] };
  }
  function hbScript() { // 店舗に置く /js/usr/sis_hb.js
    var R = CFG.bags.filter(function (b) { return b.name; }).map(function (b) {
      return { n: b.name, s: tms(b.start), e: tms(b.end), f: b.from.replace(/\D/g, ''), t: b.to.replace(/\D/g, ''),
        msg: '配送希望日は' + md(dnum(b.from)) + 'から' + md(dnum(b.to)) + 'の中からお選びください。' + (b.nopref ? '希望なしの場合は' + md(dnum(b.nopref)) + '着でお届けします。' : ''),
        c: String(b.codes || '').split(/[,、\s]+/).filter(Boolean) };
    });
    var icon = '/img/icon/' + (CFG.icon || 'happy') + '.';
    var now = new Date();
    return '/* SIS 福袋の配送希望日（BOのハッピーバッグツールが作成 ' + now.getFullYear() + '/' + pad(now.getMonth() + 1) + '/' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + '。手で直さない） */\n' +
      '(function(){var R=' + JSON.stringify(R) + ',ICON=' + JSON.stringify(icon) + ',DT=/(\\d{4})\\D(\\d{1,2})\\D(\\d{1,2})/;\n' +
      'function pick(){var h=document.body.innerHTML,i,j;for(i=0;i<R.length;i++)for(j=0;j<R[i].c.length;j++)if(h.indexOf(R[i].c[j])>=0)return R[i];var n=Date.now(),a=R.filter(function(r){return n<r.e;}).sort(function(x,y){return x.e-y.e;});return a[0]||null;}\n' +
      'function run(){if(!/\\/order\\//i.test(location.pathname))return;var hb=document.querySelector(\'img[src*="\'+ICON+\'"]\'),r=pick();if(!r||(!hb&&!r.c.some(function(c){return document.body.innerHTML.indexOf(c)>=0;})))return;\n' +
      '[].slice.call(document.querySelectorAll("select")).forEach(function(s){var o=[].slice.call(s.options),d=o.filter(function(x){return DT.test(x.text);});if(d.length<2||s.getAttribute("data-sis-hb")===r.f+r.t)return;s.setAttribute("data-sis-hb",r.f+r.t);\n' +
      'd.forEach(function(x){var m=x.text.match(DT),v=m[1]+("0"+m[2]).slice(-2)+("0"+m[3]).slice(-2);if(v<r.f||v>r.t){if(x.selected)s.selectedIndex=0;s.removeChild(x);}});\n' +
      'if(!s.parentNode.querySelector(".sis-hb-note")){var p=document.createElement("p");p.className="sis-hb-note";p.style.cssText="color:#c00;font-size:12px;margin:4px 0;";p.textContent=r.msg;s.parentNode.insertBefore(p,s);}});}\n' +
      'function go(){run();try{var t;new MutationObserver(function(){clearTimeout(t);t=setTimeout(run,200);}).observe(document.body,{childList:true,subtree:true});}catch(e){}}\n' +
      'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();})();\n';
  }
  function upload(dir, name, text) { // BOの［ファイル管理］を裏で開いて置く（kpi.js と同じ）
    return new Promise(function (ok, ng) {
      var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:800px';
      fr.src = BO + '/file_explorer/file_explorer.aspx#/files/' + dir;
      fr.onload = function () {
        var w = fr.contentWindow, d = fr.contentDocument, n = 0;
        var iv = setInterval(function () {
          var inp = d && d.querySelector('input#userFile');
          if (!inp) { if (++n > 80) { clearInterval(iv); fr.remove(); ng(new Error('ファイル管理の画面が開けない')); } return; }
          clearInterval(iv);
          w.confirm = function () { return true; };
          var f = new w.File([text], name, { type: 'application/javascript' }), dt = new w.DataTransfer(); dt.items.add(f);
          inp.files = dt.files; inp.dispatchEvent(new w.Event('change', { bubbles: true }));
          var bytes = String(new TextEncoder().encode(text).length), m = 0, iv2 = setInterval(function () {
            var tx = ' ' + d.body.innerText.replace(/\s+/g, ' '), i = tx.lastIndexOf(' ' + name + ' '), row = i < 0 ? '' : tx.slice(i, i + name.length + 40);
            if (row.indexOf(' ' + bytes) >= 0) { clearInterval(iv2); setTimeout(function () { fr.remove(); }, 500); ok(); }
            else if (++m > 40) { clearInterval(iv2); fr.remove(); ng(new Error(name + ' を置けたか確認できない')); }
          }, 500);
        }, 250);
      };
      document.body.appendChild(fr);
    });
  }
  function fileRow(dir, name) { // ファイル管理の一覧の「更新日時 サイズ」
    return new Promise(function (ok) {
      var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:800px';
      fr.src = BO + '/file_explorer/file_explorer.aspx#/files/' + dir;
      var n = 0; fr.onload = function () { var iv = setInterval(function () {
        var d = fr.contentDocument, tx = d && d.body ? d.body.innerText.replace(/\s+/g, ' ') : '';
        if (/order\.js/.test(tx) || ++n > 60) { clearInterval(iv); var re = new RegExp('(?:^| )' + name.replace(/\./g, '\\.') + ' (\\d{4}/\\d\\d/\\d\\d \\d\\d:\\d\\d) (\\d+)'), m = tx.match(re); fr.remove(); ok(m ? { at: m[1], size: +m[2] } : null); }
      }, 250); };
      document.body.appendChild(fr);
    });
  }
  async function renderD(msg) {
    var h = '<div style="margin-top:6px">購入グループ <input type="text" class="rid" value="' + esc(CFG.rules) + '" style="width:90px"> <span class="gst mu">読み込み中…</span></div>' +
      '<table class="bt"><tr><th>福袋</th><th>販売開始</th><th>販売終了</th><th>届く日（から）</th><th>（まで）</th><th>希望なし時</th><th>商品コード</th></tr>';
    CFG.bags.forEach(function (b, i) {
      h += '<tr>' + ['name', 'start', 'end', 'from', 'to', 'nopref', 'codes'].map(function (k) { return '<td><input type="text" data-i="' + i + '" data-k="' + k + '" value="' + esc(b[k]) + '"></td>'; }).join('') + '</tr>';
    });
    h += '</table><div class="mu">商品コードは空でも動く（空なら販売期間で判定）。行を足すときは福袋名の空いた行に入れる</div><div class="pl"></div>' +
      '<button class="dgo go">反映</button><button class="add">行を足す</button><div class="dmsg">' + (msg || '') + '</div>';
    $('.pd').innerHTML = h;
    [].slice.call($('.pd').querySelectorAll('.bt input')).forEach(function (e) { e.onchange = function () { CFG.bags[+e.dataset.i][e.dataset.k] = e.value.trim(); save(); showPlan(); }; });
    $('.rid').onchange = function () { CFG.rules = $('.rid').value.trim(); save(); renderD(); };
    $('.add').onclick = function () { CFG.bags.push({ name: '', start: '', end: '', from: '', to: '', nopref: '', codes: '' }); save(); renderD(); };
    $('.dgo').onclick = applyD;
    showPlan();
    try {
      var g = await readGroup(), js = await fileRow('js/usr/', 'sis_hb.js');
      CFG.icon = g.icon || 'happy'; save();
      $('.gst').innerHTML = esc(g.name) + '：リードタイム ' + esc(g.lt2 || '0') + '日・表示 ' + esc(g.cnt) + '件' + (g.use === '1' ? '' : ' <span class="ng">配送希望日：使わない</span>') +
        '｜sis_hb.js ' + (js ? esc(js.at) : '<span class="wa">未作成</span>');
      $('.gst').classList.remove('mu');
    } catch (e) { $('.gst').innerHTML = '<span class="ng">' + esc(e.message) + '</span>'; }
  }
  function showPlan() {
    var p = plan(Date.now()), el = $('.pl'); if (!el) return;
    if (p.err) { el.innerHTML = '<div class="ng">' + esc(p.err) + '</div>'; return; }
    el.innerHTML = '<h4>反映する値（' + esc(p.bag.name) + '）</h4><table><tr><td>リードタイム</td><td><b>' + p.lt2 + '日</b></td><td>表示件数</td><td><b>' + p.cnt + '件</b></td></tr>' +
      '<tr><td>初日の注文</td><td colspan="3">' + p.first[0] + '〜' + p.last[0] + ' が出る → ' + esc(p.bag.from) + '〜' + esc(p.bag.to) + ' だけ残す</td></tr>' +
      '<tr><td>最終日の注文</td><td colspan="3">' + p.first[1] + '〜' + p.last[1] + ' が出る → ' + esc(p.bag.from) + '〜' + esc(p.bag.to) + ' だけ残す</td></tr></table>' +
      (p.next ? '<div class="wa">' + esc(p.bag.name) + 'の販売終了後〜' + esc(p.next.name) + 'の販売開始までに、もう一度［反映］</div>' : '');
  }
  async function applyD() {
    var btn = $('.dgo'); btn.disabled = true;
    try {
      var p = plan(Date.now()); if (p.err) throw new Error(p.err);
      var g = await readGroup(), f = g.f, fd = fdOf(f);
      fd.set('use_delivery_date', '1'); fd.set('leadtime2', String(p.lt2)); fd.set('date_dispcount', String(p.cnt));
      fd.set('cmdUpdate', f.querySelector('[name=cmdUpdate]').value);
      log('購入グループを更新：リードタイム ' + p.lt2 + '日・表示 ' + p.cnt + '件');
      var t = new DOMParser().parseFromString(await (await fetch(BO + '/rules/detail.aspx?Rules=' + encodeURIComponent(CFG.rules), { method: 'POST', body: fd, credentials: 'include' })).text(), 'text/html').body.textContent.replace(/\s+/g, ' ');
      var err = (t.match(/[^ ]{0,30}(入力して|できません|不正|エラー)[^ ]{0,30}/) || [''])[0]; if (err) throw new Error('購入グループを更新できない：' + err);
      var chk = await readGroup(); if (chk.lt2 !== String(p.lt2) || chk.cnt !== String(p.cnt)) throw new Error('購入グループの値が変わっていない（' + chk.lt2 + '日・' + chk.cnt + '件）');
      var js = hbScript(); log('sis_hb.js を書き出し（' + js.length + '文字）');
      await upload('js/usr/', 'sis_hb.js', js);
      await renderD('<div class="ok">反映しました：リードタイム ' + p.lt2 + '日・表示 ' + p.cnt + '件／sis_hb.js 更新。注文画面で日付を確認</div>');
    } catch (e) { log('止めました：' + e.message); $('.dmsg').innerHTML = '<div class="ng">止めました：' + esc(e.message) + '</div>'; btn.disabled = false; }
  }

  /* ======================= ② クーポン ======================= */
  function specOf(s) { // "3000x5,5000x2" → [{amt:3000,n:5},{amt:5000,n:2}]
    return String(s || '').split(/[,、\s]+/).filter(Boolean).map(function (x) { var m = x.replace(/[円枚]/g, '').match(/^(\d+)[x×*](\d+)$/i); if (!m) throw new Error('券の書き方：' + x + '（例 3000x5）'); return { amt: +m[1], n: +m[2] }; });
  }
  async function orders() {
    var a = CFG.od1, b = CFG.od2;
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
  function build(od) {
    var items = CFG.items.filter(function (x) { return x.code; }).map(function (x) { return { code: x.code, spec: specOf(x.spec) }; });
    if (!items.length) throw new Error('商品コードを入れる');
    var byCode = {}; items.forEach(function (x) { byCode[x.code] = x; });
    var need = {}, amts = {}, guest = 0, canN = 0, buyers = {}, bags = 0;
    od.lines.forEach(function (l) {
      var it = byCode[l.code]; if (!it || !l.q) return;
      if (od.can[l.no]) { canN += l.q; return; }
      var m = od.mem[l.no]; if (m == null) return;
      if (!m) { guest += l.q; return; }
      bags += l.q; buyers[m] = (buyers[m] || 0) + l.q;
      it.spec.forEach(function (s) { amts[s.amt] = 1; var k = m + '|' + s.amt; need[k] = (need[k] || 0) + s.n * l.q; });
    });
    var groups = [], coupons = [];
    Object.keys(amts).map(Number).sort(function (a, b) { return a - b; }).forEach(function (amt) {
      var mems = Object.keys(buyers).map(function (m) { return { m: m, n: need[m + '|' + amt] || 0 }; }).filter(function (x) { return x.n; });
      var max = mems.reduce(function (s, x) { return Math.max(s, x.n); }, 0), k = 1;
      while (k <= max) { // 同じ人たちが持つ n枚目 はグループを1つにまとめる
        var set = mems.filter(function (x) { return x.n >= k; }), sig = set.length, e = k;
        while (e + 1 <= max && mems.filter(function (x) { return x.n >= e + 1; }).length === sig) e++;
        var gname = CFG.gHead + '_' + amt + '円' + (k === e ? k : k + '-' + e);
        groups.push({ name: gname, members: set.map(function (x) { return x.m; }) });
        for (var i = k; i <= e; i++) coupons.push({ id: CFG.idHead + '-' + amt + '-' + i, name: '福袋' + amt.toLocaleString() + '円クーポン' + i + '枚目', amt: amt, group: gname, n: set.length });
        k = e + 1;
      }
    });
    return { groups: groups, coupons: coupons, buyers: Object.keys(buyers).length, bags: bags, guest: guest, can: canN, multi: Object.keys(buyers).filter(function (m) { return buyers[m] > 1; }).length };
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
  async function createCoupon(c, tmpl) {
    var path = 'coupon/event_detail.aspx?mode=regist&coupon_type=1';
    var d = await doc(path), f = d.forms[0], fd = fdOf(f);
    if (tmpl) tmpl.forEach(function (x) { if (!SKIP.test(x[0])) fd.set(x[0], x[1]); });
    else fd.set('smartphone_is_pc', '1');
    fd.set('coupon_event', c.id); fd.set('name', c.name);
    fd.set('bonus_type', '0'); fd.set('coupon_cut_price', String(c.amt));
    fd.set('customer_allotment', '0'); fd.set('customer_group_name', c.group);
    fd.set('condition_term', 'true'); fd.set('s_dt', CFG.s); fd.set('f_dt', CFG.f); fd.set('status', '0');
    fd.set('cmdInsert', f.querySelector('[name=cmdInsert]').value);
    var t = new DOMParser().parseFromString(await (await fetch(BO + '/' + path, { method: 'POST', body: fd, credentials: 'include' })).text(), 'text/html').body.textContent.replace(/\s+/g, ' ');
    var err = (t.match(/[^ ]{0,30}(入力して|できません|存在しません|エラー|不正|重複)[^ ]{0,30}/) || [''])[0];
    if (err) throw new Error('クーポン ' + c.id + ' を作れない：' + err);
    if (!(await couponForm(c.id))) throw new Error('クーポン ' + c.id + ' を読み戻せない。クーポンイベント管理で確認');
  }
  var S = { res: null, gex: {}, cex: {} };
  function renderC(msg) {
    var inp = function (k, w) { return '<input type="text" class="cf" data-k="' + k + '" value="' + esc(CFG[k]) + '" style="width:' + w + 'px">'; };
    var h = '<table><tr><td>注文日</td><td>' + inp('od1', 90) + ' 〜 ' + inp('od2', 90) + '</td></tr>' +
      '<tr><td>クーポンID</td><td>' + inp('idHead', 60) + '-金額-n（例 ' + esc(CFG.idHead) + '-3000-1）</td></tr>' +
      '<tr><td>グループ名</td><td>' + inp('gHead', 120) + '_金額円n枚目（例 ' + esc(CFG.gHead) + '_3000円1-5）</td></tr>' +
      '<tr><td>使える期間</td><td>' + inp('s', 140) + ' 〜 ' + inp('f', 140) + '</td></tr>' +
      '<tr><td>条件のコピー元</td><td>' + inp('tmpl', 140) + ' <span class="mu">クーポンID（空なら条件なし）</span></td></tr></table>' +
      '<table class="it"><tr><th>商品コード（福袋）</th><th>1袋あたりの券（例 3000x5,5000x2）</th></tr>';
    CFG.items.forEach(function (x, i) { h += '<tr><td><input type="text" data-i="' + i + '" data-k="code" value="' + esc(x.code) + '"></td><td><input type="text" data-i="' + i + '" data-k="spec" value="' + esc(x.spec) + '"></td></tr>'; });
    h += '</table><button class="ld">読み込む</button><button class="cgo go" disabled>作成</button><button class="iadd">行を足す</button><div class="cmsg">' + (msg || '') + '</div><div class="pv"></div>';
    $('.pc').innerHTML = h;
    [].slice.call($('.pc').querySelectorAll('.cf')).forEach(function (e) { e.onchange = function () { CFG[e.dataset.k] = e.value.trim(); save(); S.res = null; $('.cgo').disabled = true; }; });
    [].slice.call($('.pc').querySelectorAll('.it input')).forEach(function (e) { e.onchange = function () { CFG.items[+e.dataset.i][e.dataset.k] = e.value.trim(); save(); S.res = null; $('.cgo').disabled = true; }; });
    $('.iadd').onclick = function () { CFG.items.push({ code: '', spec: '' }); save(); renderC(); };
    $('.ld').onclick = load; $('.cgo').onclick = runC;
    if (S.res) preview();
  }
  function stc(ex, want) { if (ex == null) return '<td>未作成</td>'; return +ex === want ? '<td class="ok">作成済</td>' : '<td class="ng">作成済（' + ex + '）</td>'; }
  function preview() {
    var r = S.res, h = '<h4>購入者 ' + r.buyers + '人・' + r.bags + '袋' + (r.multi ? '（2袋以上 ' + r.multi + '人）' : '') + '</h4>' +
      (r.guest ? '<div class="wa">ゲスト購入 ' + r.guest + '袋：会員番号がないためクーポンを付けられない</div>' : '') + (r.can ? '<div class="mu">キャンセル ' + r.can + '袋は除外</div>' : '');
    h += '<table><tr><th>会員グループ</th><th>人数</th><th>状態</th></tr>';
    r.groups.forEach(function (g) { h += '<tr><td>' + esc(g.name) + '</td><td>' + g.members.length + '人</td>' + stc(S.gex[g.name], g.members.length) + '</tr>'; });
    h += '</table><table><tr><th>クーポンID</th><th>名前</th><th>値引き</th><th>枚数</th><th>状態</th></tr>';
    r.coupons.forEach(function (c) { var ex = S.cex[c.id]; h += '<tr><td>' + esc(c.id) + '</td><td>' + esc(c.name) + '</td><td>' + c.amt.toLocaleString() + '円</td><td>' + c.n + '枚</td>' + stc(ex ? ex.count : null, c.n) + '</tr>'; });
    h += '</table>';
    var done = r.groups.every(function (g) { return S.gex[g.name] === g.members.length; }) && r.coupons.every(function (c) { return S.cex[c.id] && +S.cex[c.id].count === c.n; });
    if (done) h += '<div class="ok" style="margin-top:6px">すべて作成済み（枚数＝人数）</div>';
    $('.pv').innerHTML = h; $('.cgo').disabled = done || !r.groups.length;
  }
  async function refresh() {
    var gl = await groupList(CFG.gHead + '_'); S.gex = {}; gl.forEach(function (g) { S.gex[g.name] = g.count; });
    var cl = await couponList(CFG.idHead + '-'); S.cex = {}; cl.forEach(function (c) { S.cex[c.id] = c; });
  }
  async function load() {
    $('.ld').disabled = true; $('.cmsg').innerHTML = '<span class="mu">読み込み中…</span>';
    try { S.res = build(await orders()); await refresh(); $('.cmsg').innerHTML = ''; preview(); }
    catch (e) { S.res = null; $('.cmsg').innerHTML = '<div class="ng">' + esc(e.message) + '</div>'; }
    $('.ld').disabled = false;
  }
  async function runC() {
    var r = S.res; $('.cgo').disabled = true; $('.ld').disabled = true;
    try {
      await refresh();
      var bad = r.groups.filter(function (g) { return S.gex[g.name] != null && S.gex[g.name] !== 0 && S.gex[g.name] !== g.members.length; });
      if (bad.length) throw new Error('人数の違うグループが既にある：' + bad.map(function (g) { return g.name; }).join('、') + '（会員グループ管理で確認）');
      var miss = r.groups.filter(function (g) { return S.gex[g.name] == null; });
      if (miss.length) await importCSV('tmpcustomergrp', ['会員グループ名', '備考'], miss.map(function (g) { return [g.name, 'SISハッピーバッグ ' + CFG.od1 + 'から' + CFG.od2 + 'の購入者']; }));
      await refresh();
      var empty = r.groups.filter(function (g) { return !S.gex[g.name]; });
      if (empty.length) { var rows = []; empty.forEach(function (g) { g.members.forEach(function (m) { rows.push([g.name, m]); }); }); await importCSV('tmpcustomergrpmember', ['会員グループ名', '会員番号'], rows); }
      await refresh();
      var ng = r.groups.filter(function (g) { return S.gex[g.name] !== g.members.length; });
      if (ng.length) throw new Error('グループの人数が合わない：' + ng.map(function (g) { return g.name + ' ' + S.gex[g.name] + '/' + g.members.length; }).join('、'));
      var tmpl = null; if (CFG.tmpl) { tmpl = await couponForm(CFG.tmpl); if (!tmpl) throw new Error('条件のコピー元クーポン ' + CFG.tmpl + ' が見つからない'); }
      for (var c of r.coupons) { if (S.cex[c.id]) continue; log('クーポン作成 ' + c.id); await createCoupon(c, tmpl); }
      await refresh(); preview();
      var cng = r.coupons.filter(function (c) { return !S.cex[c.id] || +S.cex[c.id].count !== c.n; });
      if (cng.length) throw new Error('枚数が合わない：' + cng.map(function (c) { return c.id + ' ' + (S.cex[c.id] ? S.cex[c.id].count : 'なし') + '/' + c.n; }).join('、'));
      $('.cmsg').innerHTML = '<div class="ok">作成しました：グループ ' + r.groups.length + '・クーポン ' + r.coupons.length + '</div>';
    } catch (e) { log('止めました：' + e.message); $('.cmsg').innerHTML = '<div class="ng">止めました：' + esc(e.message) + '</div>'; await refresh().catch(function () {}); preview(); }
    $('.ld').disabled = false;
  }

  renderD(); renderC();
})();
