/* SIS ロゴ切替 — #SP-1
 * ロゴ画像と表示期間を入れて［反映］→ 期間中だけサイトロゴが切り替わり、期間が終わると元のロゴに戻る（その日時に誰も操作しなくてよい）
 * しくみ：ヘッダー系テンプレート（PC・スマホ、ログイン中も）のロゴ画像を、期間タグ付き（data-t33・data-from・data-to）の画像に置き換える。
 *        期間外の画像はページを開いた瞬間に消える（バナー反映と同じ小さなJSをロゴの直後に置く）。終わった期間は次の［反映］で片づける
 * 画像は /img/usr/common/ に置く（ツールからアップロード）。元のロゴ sitelogo.png には触らない
 * 確認：店舗URLに ?bnrtime=2026-12-01T00:00 を付けると、その日時の表示を見られる
 */
(function () {
  'use strict';
  var VER = 'LOGO v1.0 (2026-11-23)';
  var BO = location.pathname.split('/').slice(0, 2).join('/');
  var STG = /mercart-stg/.test(location.hostname);
  var SHOP = STG ? 'https://shop.seesplanning.mercart-stg.net' : 'https://drugstores-shop.com';
  var C1 = STG ? '#2b8a3e' : '#d9480f', C2 = STG ? '#ebfbee' : '#fff4e6';
  var DIR = 'img/usr/common/';
  var old = document.getElementById('sislogo'); if (old) old.remove();
  var box = document.createElement('div'); box.id = 'sislogo';
  box.innerHTML =
    '<style>#sislogo{position:fixed;right:12px;top:12px;z-index:2147483000;width:640px;max-width:calc(100vw - 24px);max-height:92vh;overflow:auto;background:#fff;border:2px solid ' + C1 + ';border-radius:10px;font:13px/1.5 sans-serif;color:#222;box-shadow:0 4px 16px rgba(0,0,0,.2)}' +
    '#sislogo .hd{padding:8px 12px;background:' + C2 + ';font-weight:bold;display:flex;justify-content:space-between}#sislogo .bd{padding:10px 12px}' +
    '#sislogo table{border-collapse:collapse;width:100%;font-size:12px;margin-top:6px}#sislogo td,#sislogo th{border-bottom:1px solid #eee;padding:4px;text-align:left;vertical-align:middle}' +
    '#sislogo input[type=text]{font-size:12px;padding:3px 4px;border:1px solid #ccc;border-radius:3px;width:140px}' +
    '#sislogo .ok{color:#2b8a3e;font-weight:bold}#sislogo .ng{color:#c92a2a;font-weight:bold}#sislogo .wa{color:#e8590c;font-weight:bold}#sislogo .mu{color:#868e96}' +
    '#sislogo button{padding:7px 12px;margin:8px 6px 0 0;border-radius:6px;border:1px solid #888;background:#f8f8f8;cursor:pointer}#sislogo button.go{background:' + C1 + ';color:#fff;border:none;font-weight:bold}#sislogo button:disabled{opacity:.45;cursor:not-allowed}' +
    '#sislogo img.th{max-height:36px;max-width:220px;vertical-align:middle;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/12px 12px}#sislogo h4{margin:10px 0 2px;font-size:13px}#sislogo pre{white-space:pre-wrap;background:#f6f6f6;padding:6px;max-height:120px;overflow:auto;margin:8px 0 0;font-size:11px}#sislogo a{color:#1971c2}</style>' +
    '<div class="hd"><span>SIS ロゴ切替（' + (STG ? 'stg 検証環境' : '本番') + '）</span><span title="' + VER + '"><a href="#" class="x" style="color:#222;text-decoration:none">×</a></span></div>' +
    '<div class="bd"><div class="now mu">読み込み中…</div>' +
    '<h4>追加する</h4><table><tr><td>画像</td><td><input type="file" class="f" accept="image/png,image/jpeg,image/gif"> <span class="pv"></span></td></tr>' +
    '<tr><td>表示期間</td><td><input type="text" class="s" placeholder="2026/12/01 00:00"> 〜 <input type="text" class="e" placeholder="2026/12/26 00:00"></td></tr></table>' +
    '<button class="go">反映</button><div class="msg"></div><pre class="log"></pre></div>';
  document.body.appendChild(box);
  var $ = function (s) { return box.querySelector(s); };
  $('.x').onclick = function (e) { e.preventDefault(); box.remove(); };
  function log(m) { console.log('[SISLOGO]', m); $('.log').textContent = new Date().toLocaleTimeString('ja-JP') + ' ' + m + '\n' + $('.log').textContent; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var pad = function (n) { return ('0' + n).slice(-2); };
  function iso(s) { var m = String(s || '').match(/(\d{4})\D(\d{1,2})\D(\d{1,2})(?:\D+(\d{1,2}):(\d{2}))?/); return m ? m[1] + '-' + pad(m[2]) + '-' + pad(m[3]) + 'T' + pad(m[4] || 0) + ':' + pad(m[5] || 0) + ':00+09:00' : null; }
  function show(i) { var d = new Date(Date.parse(i) + 9 * 36e5); return d.getUTCFullYear() + '/' + pad(d.getUTCMonth() + 1) + '/' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }

  /* ---------- テンプレート（バナー反映と同じ入出力） ---------- */
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
  function parseCSV(t) {
    var R = [], r = [], f = '', q = false;
    for (var i = 0; i < t.length; i++) { var a = t[i];
      if (q) { if (a === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += a; }
      else if (a === '"') q = true; else if (a === ',') { r.push(f); f = ''; }
      else if (a === '\n') { r.push(f.replace(/\r$/, '')); R.push(r); r = []; f = ''; } else f += a; }
    if (f || r.length) { r.push(f); R.push(r); }
    return R;
  }
  async function tplExport() {
    var G = new URLSearchParams([['table', 'tmptemplate'], ['format', 'CSV'], ['header', '1'], ['export.x', '実行']]);
    var b = await (await fetch(BO + '/import/exp_template.aspx', { method: 'POST', body: G, credentials: 'include' })).arrayBuffer();
    var q = parseCSV(new TextDecoder('shift_jis').decode(b));
    if (!q[0] || q[0][1] !== 'テンプレート名' || q[0].length !== 12) throw new Error('テンプレートを読めない（ログイン切れの可能性）');
    return q;
  }
  async function tplImport(head, rows, tag) {
    var text = [head].concat(rows).map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n') + '\r\n';
    var name = 'SIS_' + tag + '_' + Date.now() + '.csv', fd = new FormData();
    fd.append('table', 'tmptemplate'); fd.append('txtFile', new File([sjis(text)], name, { type: 'text/csv' })); fd.append('header', '1'); fd.append('format', 'CSV'); fd.append('cmdUpload', '取込');
    var t = await (await fetch(BO + '/import/imp_template.aspx', { method: 'POST', body: fd, credentials: 'include' })).text();
    if (!/受付/.test(t)) throw new Error('テンプレートの取込を受け付けてもらえない');
    log('テンプレート取込を送信（' + rows.length + 'か所）');
    for (var i = 0; i < 36; i++) {
      await sleep(5000);
      try { var j = await (await fetch(BO + '/fuctionloggetapi.aspx?number=10&batch_id=ImpTemplateSetting', { credentials: 'include', headers: { 'Content-Type': 'application/json; charset=utf-8' } })).json();
        var me = (j || []).find(function (x) { return x && x['取込ファイル名'] === name; });
        if (me && /success/i.test(String(me['状態']))) { log('取込完了'); return; }
        if (me && /error|fail|失敗|エラー|異常/i.test(String(me['状態']))) throw new Error('テンプレート取込に失敗：' + me['状態']);
      } catch (e) { if (/失敗/.test(e.message)) throw e; }
    }
    throw new Error('3分待っても取込の結果が出ない（テンプレートインポートの処理状況を確認）');
  }
  function upload(dir, name, file) { // ファイル管理を裏で開いて置く
    return new Promise(function (ok, ng) {
      var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:800px';
      fr.src = BO + '/file_explorer/file_explorer.aspx#/files/' + dir;
      fr.onload = function () {
        var w = fr.contentWindow, d = fr.contentDocument, n = 0;
        var iv = setInterval(function () {
          var inp = d && d.querySelector('input#userFile');
          if (!inp) { if (++n > 80) { clearInterval(iv); fr.remove(); ng(new Error('ファイル管理の画面が開けない')); } return; }
          clearInterval(iv); w.confirm = function () { return true; };
          var f = new w.File([file], name, { type: file.type || 'image/png' }), dt = new w.DataTransfer(); dt.items.add(f);
          inp.files = dt.files; inp.dispatchEvent(new w.Event('change', { bubbles: true }));
          var bytes = String(file.size), m = 0, iv2 = setInterval(function () {
            var tx = ' ' + d.body.innerText.replace(/\s+/g, ' '), i = tx.lastIndexOf(' ' + name + ' '), row = i < 0 ? '' : tx.slice(i, i + name.length + 40);
            if (row.indexOf(' ' + bytes) >= 0) { clearInterval(iv2); setTimeout(function () { fr.remove(); }, 500); ok(); }
            else if (++m > 40) { clearInterval(iv2); fr.remove(); ng(new Error(name + ' を置けたか確認できない')); }
          }, 500);
        }, 250);
      };
      document.body.appendChild(fr);
    });
  }

  /* ---------- ロゴの差し替え ---------- */
  var IMG = /<img\b[^>]*class="block-header-logo--img"[^>]*>/;
  var BLK = /<!--SISLOGO ORIG=([\s\S]*?)-->[\s\S]*?<!--\/SISLOGO-->/;
  var GUARD = '<script>(function(){var m=location.search.match(/[?&]bnrtime=([^&]+)/),n=m?Date.parse(decodeURIComponent(m[1])):Date.now(),e=document.querySelectorAll("[data-sislogo]"),i,x,f,t;for(i=0;i<e.length;i++){x=e[i];f=x.getAttribute("data-from");t=x.getAttribute("data-to");if((f&&n<Date.parse(f))||(t&&n>=Date.parse(t))){if(x.parentNode)x.parentNode.removeChild(x);}}var c=document.currentScript;if(c&&c.parentNode)c.parentNode.removeChild(c);})();</script>';
  function tag(img, attrs) { return img.replace(/\s*(\/?)>$/, ' data-sislogo="1"' + attrs + '$1>'); }
  function build(orig, periods) { // periods: [{file,from,to}]（終わっていない分だけ・開始順）
    if (!periods.length) return orig;
    var h = '<!--SISLOGO ORIG=' + orig + '-->', prev = null;
    periods.forEach(function (p) {
      h += tag(orig, (prev ? ' data-from="' + prev + '"' : '') + ' data-to="' + p.from + '"'); // 元のロゴ（期間の前）
      h += tag(orig.replace(/sitelogo\.png/, p.file), ' data-from="' + p.from + '" data-to="' + p.to + '" data-file="' + p.file + '"');
      prev = p.to;
    });
    h += tag(orig, ' data-from="' + prev + '"');
    return h + GUARD + '<!--/SISLOGO-->';
  }
  function readPeriods(text) { // テンプレートに入っている期間
    var m = String(text || '').match(BLK); if (!m) return [];
    var out = [], re = /data-from="([^"]+)" data-to="([^"]+)" data-file="([^"]+)"/g, x;
    while ((x = re.exec(m[0]))) out.push({ from: x[1], to: x[2], file: x[3] });
    return out;
  }
  function origOf(text) { var m = String(text || '').match(BLK); if (m) return m[1]; var i = String(text || '').match(IMG); return i ? i[0] : null; }
  function targets(q) { // ロゴがある本体テンプレート（PC・スマホのヘッダー系）
    return q.slice(1).filter(function (r) { return /^(PC|SB)$/.test(r[0]) && /HEADER$/.test(r[1]) && (IMG.test(r[5]) || IMG.test(r[6]) || BLK.test(r[5]) || BLK.test(r[6])); });
  }

  var S = { periods: [], file: null };
  async function load() {
    try {
      var q = await tplExport(), ts = targets(q);
      if (!ts.length) throw new Error('ロゴのあるテンプレートが見つからない');
      S.periods = readPeriods(ts.map(function (r) { return r[5]; }).join('')).filter(function (p) { return Date.parse(p.to) > Date.now(); });
      render();
    } catch (e) { $('.now').innerHTML = '<span class="ng">' + esc(e.message) + '</span>'; }
  }
  function render() {
    var h = '<h4>いまの予定</h4>';
    if (!S.periods.length) h += '<div class="mu">なし（いつもの sitelogo.png）</div>';
    else {
      h += '<table><tr><th>画像</th><th>表示期間</th><th>確認</th><th></th></tr>';
      S.periods.forEach(function (p, i) {
        var on = Date.parse(p.from) <= Date.now();
        h += '<tr><td><img class="th" src="' + SHOP + '/' + DIR + esc(p.file) + '"> <span class="mu">' + esc(p.file) + '</span></td><td>' + show(p.from) + '〜' + show(p.to) + (on ? ' <span class="ok">表示中</span>' : '') + '</td>' +
          '<td><a target="_blank" href="' + SHOP + '/shop/default.aspx?bnrtime=' + encodeURIComponent(p.from.slice(0, 16)) + '">開始時</a>／<a target="_blank" href="' + SHOP + '/shop/default.aspx?bnrtime=' + encodeURIComponent(p.to.slice(0, 16)) + '">終了時</a></td>' +
          '<td><label><input type="checkbox" class="del" data-i="' + i + '"> 取り消す</label></td></tr>';
      });
      h += '</table>';
    }
    $('.now').innerHTML = h; $('.now').classList.remove('mu');
  }
  $('.f').onchange = function () {
    var f = $('.f').files[0]; S.file = f || null; $('.pv').innerHTML = '';
    if (!f) return;
    if (!/^[A-Za-z0-9_\-.]+\.(png|jpe?g|gif)$/i.test(f.name)) { $('.pv').innerHTML = '<span class="ng">ファイル名は半角英数字にする（例 sitelogo_xmas.png）</span>'; S.file = null; return; }
    if (/^sitelogo\.png$/i.test(f.name)) { $('.pv').innerHTML = '<span class="ng">sitelogo.png 以外の名前にする（元のロゴを上書きしない）</span>'; S.file = null; return; }
    $('.pv').innerHTML = '<span class="mu">' + Math.round(f.size / 1024) + 'KB</span>';
    var rd = new FileReader(); rd.onload = function () { var im = new Image(); im.onload = function () { $('.pv').innerHTML = '<img class="th" src="' + rd.result + '"> <span class="mu">' + im.naturalWidth + '×' + im.naturalHeight + '</span>'; }; im.src = rd.result; }; rd.readAsDataURL(f);
  };
  $('.go').onclick = async function () {
    var btn = $('.go'); btn.disabled = true; $('.msg').innerHTML = '';
    try {
      var periods = S.periods.filter(function (p, i) { var c = box.querySelector('.del[data-i="' + i + '"]'); return !(c && c.checked); });
      var s = $('.s').value.trim(), e = $('.e').value.trim();
      if (S.file || s || e) {
        if (!S.file) throw new Error('画像を選ぶ');
        var fi = iso(s), ti = iso(e);
        if (!fi || !ti) throw new Error('表示期間を「2026/12/01 00:00」の形で入れる');
        if (Date.parse(fi) >= Date.parse(ti)) throw new Error('表示終了が表示開始より前');
        if (Date.parse(ti) <= Date.now()) throw new Error('表示終了が過去');
        if (periods.some(function (p) { return Date.parse(fi) < Date.parse(p.to) && Date.parse(p.from) < Date.parse(ti); })) throw new Error('ほかの予定と期間がかぶっている');
        log('画像をアップロード：' + S.file.name);
        await upload(DIR, S.file.name, S.file);
        periods.push({ file: S.file.name, from: fi, to: ti });
      }
      periods = periods.filter(function (p) { return Date.parse(p.to) > Date.now(); }).sort(function (a, b) { return Date.parse(a.from) - Date.parse(b.from); });
      var q = await tplExport(), head = q[0], rows = [];
      targets(q).forEach(function (r) {
        var nr = r.slice(), ch = false;
        [5, 6].forEach(function (k) {
          var t = nr[k] || ''; if (!IMG.test(t) && !BLK.test(t)) return;
          var orig = origOf(t), next = BLK.test(t) ? t.replace(BLK, function () { return build(orig, periods); }) : t.replace(IMG, function () { return build(orig, periods); });
          if (next !== t) { nr[k] = next; ch = true; }
        });
        if (ch) rows.push(nr);
      });
      if (!rows.length) { $('.msg').innerHTML = '<div class="ok">変更なし（予定どおり反映済み）</div>'; btn.disabled = false; return; }
      log('書き換えるテンプレート：' + rows.map(function (r) { return r[0] + ' ' + r[1]; }).join('、'));
      await tplImport(head, rows, 'logo');
      var q2 = await tplExport(), got = readPeriods(targets(q2).map(function (r) { return r[5]; }).join(''));
      var want = periods.map(function (p) { return p.file + p.from + p.to; }).join('|'), seen = targets(q2).every(function (r) { return [5, 6].every(function (k) { return !IMG.test(r[k] || '') || (periods.length ? readPeriods(r[k]).map(function (p) { return p.file + p.from + p.to; }).join('|') === want : !BLK.test(r[k])); }); });
      if (!seen) throw new Error('反映後のテンプレートが予定と合わない。テンプレート管理で確認');
      S.periods = got.filter(function (p) { return Date.parse(p.to) > Date.now(); }); S.file = null; $('.f').value = ''; $('.s').value = ''; $('.e').value = ''; $('.pv').innerHTML = '';
      render(); $('.msg').innerHTML = '<div class="ok">反映しました（' + rows.length + 'か所）。表の「開始時」「終了時」で見え方を確認</div>';
    } catch (err) { log('止めました：' + err.message); $('.msg').innerHTML = '<div class="ng">止めました：' + esc(err.message) + '</div>'; }
    btn.disabled = false;
  };
  load();
})();
