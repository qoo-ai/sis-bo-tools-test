/* SIS 福袋の配送日 — #SP-1
 * 福袋ごとに商品コード・販売期間・「お届け日（から〜まで）」を入れて［反映］→ 注文画面で、その福袋の配送希望日がお届け日の中だけになる
 *  ・注文画面のどの福袋かは商品コードで判定（注文画面の rowgoodsN の値。前方一致）。同じ時期に複数の福袋を売ってもよい
 * しくみ（使う人は知らなくてよい）：
 *  ・購入グループ「happy bag」（88888888）のリードタイム2・表示件数を、まだ販売が終わっていない全福袋の全注文日でお届け日が全部出る値にする
 *  ・/js/usr/sis_hb.js を書き出し、注文画面のヘッダー（COMMON_ORDER_HEADER のPC・スマホ）に読み込みを入れる（テンプレート取込。何度押しても1つだけ）
 *  ・sis_hb.js は福袋（購入グループのアイコン happy）の注文画面だけ、お届け日以外の日付を消し、案内文を出す
 */
(function () {
  'use strict';
  var VER = '福袋の配送日 v2.3 (2026-11-23)';
  var BO = location.pathname.split('/').slice(0, 2).join('/');
  var STG = /mercart-stg/.test(location.hostname);
  var C1 = STG ? '#2b8a3e' : '#d9480f', C2 = STG ? '#ebfbee' : '#fff4e6';
  var RULES = '88888888';
  var KEY = 'sis_hb_bags_v2';
  var BAGS; try { BAGS = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { BAGS = []; }
  if (!BAGS.length) BAGS.push({ name: '', codes: '', start: '', end: '', from: '', to: '' });
  function save() { try { localStorage.setItem(KEY, JSON.stringify(BAGS)); } catch (e) {} }

  var old = document.getElementById('sishb'); if (old) old.remove();
  var box = document.createElement('div'); box.id = 'sishb';
  box.innerHTML =
    '<style>#sishb{position:fixed;right:12px;top:12px;z-index:2147483000;width:960px;max-width:calc(100vw - 24px);max-height:92vh;overflow:auto;background:#fff;border:2px solid ' + C1 + ';border-radius:10px;font:13px/1.6 sans-serif;color:#222;box-shadow:0 4px 16px rgba(0,0,0,.2)}' +
    '#sishb .hd{padding:8px 12px;background:' + C2 + ';font-weight:bold;display:flex;justify-content:space-between}#sishb .bd{padding:10px 12px}' +
    '#sishb table{border-collapse:collapse;width:100%;font-size:12px}#sishb td,#sishb th{border-bottom:1px solid #eee;padding:4px;text-align:left}' +
    '#sishb input{font-size:12px;padding:3px 4px;border:1px solid #ccc;border-radius:3px;box-sizing:border-box;width:100%}' +
    '#sishb .ok{color:#2b8a3e;font-weight:bold}#sishb .ng{color:#c92a2a;font-weight:bold}#sishb .mu{color:#868e96}' +
    '#sishb button{padding:7px 14px;margin:10px 6px 0 0;border-radius:6px;border:1px solid #888;background:#f8f8f8;cursor:pointer}#sishb button.go{background:' + C1 + ';color:#fff;border:none;font-weight:bold}#sishb button:disabled{opacity:.45;cursor:not-allowed}' +
    '#sishb .del{border:none;background:none;color:#868e96;font-size:16px;cursor:pointer;padding:0 4px;margin:0}</style>' +
    '<div class="hd"><span>SIS 福袋の配送日（' + (STG ? 'stg 検証環境' : '本番') + '）</span><span title="' + VER + '"><a href="#" class="x" style="color:#222;text-decoration:none">×</a></span></div>' +
    '<div class="bd"><div class="mu">福袋ごとに入れて［反映］。その福袋の注文画面で、選べる配送希望日が「お届け日」の中だけになる</div><div class="tb"></div>' +
    '<button class="add">＋ 福袋を足す</button><button class="go">反映</button><div class="msg"></div></div>';
  document.body.appendChild(box);
  var $ = function (s) { return box.querySelector(s); };
  $('.x').onclick = function (e) { e.preventDefault(); box.remove(); };
  function log(m) { console.log('[SISHB]', m); }
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
  var HB = /<!--SISHB-->[\s\S]*?<!--\/SISHB-->/;
  async function loader() { // 注文画面のヘッダー（PC・スマホ）に sis_hb.js の読み込みを1つだけ入れる。版を変えて古いキャッシュを使わせない
    var q = await tplExport(), v = Date.now().toString(36);
    var tag = '<!--SISHB--><script src="/js/usr/sis_hb.js?v=' + v + '" charset="utf-8"></script><!--/SISHB-->';
    var rows = q.slice(1).filter(function (r) { return /^(PC|SB)$/.test(r[0]) && r[1] === 'COMMON_ORDER_HEADER'; }).map(function (r) {
      var nr = r.slice(); [5, 6].forEach(function (k) { var t = nr[k] || ''; if (k === 6 && !t) return; nr[k] = HB.test(t) ? t.replace(HB, tag) : t + tag; }); return nr;
    });
    if (rows.length !== 2) throw new Error('注文画面のヘッダーテンプレート（PC・スマホ）が見つからない');
    await tplImport(q[0], rows, 'happybag');
    var ok = (await tplExport()).slice(1).filter(function (r) { return /^(PC|SB)$/.test(r[0]) && r[1] === 'COMMON_ORDER_HEADER'; }).every(function (r) { return (r[5] || '').indexOf(tag) >= 0; });
    if (!ok) throw new Error('注文画面のヘッダーに読み込みが入っていない。テンプレート管理で確認');
  }

  /* ---------- 配送日 ---------- */
  async function readGroup() {
    var d = await doc('rules/detail.aspx?Rules=' + RULES), f = d.forms[0];
    var v = function (n) { var e = f.querySelector('[name="' + n + '"]'); return e ? e.value : null; };
    if (v('rules') !== RULES) throw new Error('福袋の購入グループ（' + RULES + '）が見つからない');
    return { f: f, lt2: v('leadtime2'), cnt: v('date_dispcount'), icon: v('icon1') };
  }
  function check() { // 入力の確認と、全福袋をまかなう設定値
    var bags = BAGS.filter(function (b) { return b.name || b.codes || b.start || b.end || b.from || b.to; });
    if (!bags.length) return { err: '福袋を入れる' };
    for (var b of bags) {
      var w = b.name || '名前のない行';
      if (!b.name || !b.codes || !b.start || !b.end || !b.from || !b.to) return { err: w + '：空いている欄がある' };
      if ([tms(b.start), tms(b.end), dnum(b.from), dnum(b.to)].some(isNaN)) return { err: w + '：日付の形を確認' };
      if (tms(b.start) >= tms(b.end)) return { err: w + '：販売終了が販売開始より前' };
      if (dnum(b.from) > dnum(b.to)) return { err: w + '：お届け日の「まで」が「から」より前' };
      if (dnum(b.from) <= jstDay(tms(b.end) - 60000)) return { err: w + '：お届け日が販売終了より前' };
    }
    var now = Date.now(), live = bags.filter(function (b) { return tms(b.end) > now; });
    if (!live.length) return { err: '販売が終わっていない福袋がない' };
    var lt2 = Math.min.apply(null, live.map(function (b) { return dnum(b.from) - jstDay(tms(b.end) - 60000) - 1; })); // どの最終注文日でも「から」の日が出る
    var cnt = Math.max.apply(null, live.map(function (b) { return dnum(b.to) - Math.max(jstDay(tms(b.start)), jstDay(now)) - lt2; })); // どの初日でも「まで」の日が出る
    return { bags: bags, lt2: lt2, cnt: cnt };
  }
  function hbScript(bags, icon) {
    var R = bags.map(function (b) {
      return { c: String(b.codes).split(/[\s,、]+/).filter(Boolean), e: tms(b.end), f: dstr(dnum(b.from)).replace(/\D/g, ''), t: dstr(dnum(b.to)).replace(/\D/g, ''), msg: '配送希望日は' + md(dnum(b.from)) + 'から' + md(dnum(b.to)) + 'の中からお選びください。' };
    });
    var now = new Date();
    return '/* SIS 福袋の配送希望日（BOのツール「福袋の配送日」が作成 ' + now.getFullYear() + '/' + pad(now.getMonth() + 1) + '/' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + '。手で直さない） */\n' +
      '(function(){var R=' + JSON.stringify(R) + ',ICON=' + JSON.stringify('/img/icon/' + (icon || 'happy') + '.') + ',DT=/(\\d{4})\\D(\\d{1,2})\\D(\\d{1,2})/;\n' +
      'function pick(){var g=[].slice.call(document.querySelectorAll(\'input[name^="rowgoods"]\')).map(function(e){return e.value;}),h=g.length?"":document.body.innerText,m=R.filter(function(r){return r.c.some(function(c){return g.length?g.some(function(v){return v.indexOf(c)===0;}):h.indexOf(c)>=0;});});if(!m.length)return null;if(m.length===1)return m[0];var f=m.map(function(r){return r.f;}).sort().pop(),t=m.map(function(r){return r.t;}).sort()[0];return f<=t?{f:f,t:t,msg:m[0].msg}:m[0];}\n' +
      'function run(){if(!/\\/order\\//i.test(location.pathname))return;var r=pick();if(!r)return;\n' +
      '[].slice.call(document.querySelectorAll("select")).forEach(function(s){var d=[].slice.call(s.options).filter(function(x){return DT.test(x.text);});if(d.length<2||s.getAttribute("data-sis-hb")===r.f+r.t)return;s.setAttribute("data-sis-hb",r.f+r.t);\n' +
      'd.forEach(function(x){var m=x.text.match(DT),v=m[1]+("0"+m[2]).slice(-2)+("0"+m[3]).slice(-2);if(v<r.f||v>r.t){if(x.selected)s.selectedIndex=0;s.removeChild(x);}});\n' +
      'if(!s.parentNode.querySelector(".sis-hb-note")){var p=document.createElement("p");p.className="sis-hb-note";p.style.cssText="color:#c00;font-size:12px;margin:4px 0;";p.textContent=r.msg;s.parentNode.insertBefore(p,s);}});}\n' +
      'function go(){run();try{var t;new MutationObserver(function(){clearTimeout(t);t=setTimeout(run,200);}).observe(document.body,{childList:true,subtree:true});}catch(e){}}\n' +
      'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();})();\n';
  }
  function render() {
    var h = '<table><tr><th style="width:15%">福袋（内部用）</th><th style="width:17%">商品コード</th><th>販売開始</th><th>販売終了</th><th>お届け日（から）</th><th>お届け日（まで）</th><th></th></tr>';
    BAGS.forEach(function (b, i) {
      var f = function (k, t, ph) { return '<td><input type="' + t + '" data-i="' + i + '" data-k="' + k + '" value="' + esc(b[k]) + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '></td>'; };
      h += '<tr>' + f('name', 'text', '例：リサイクル福袋') + f('codes', 'text', '複数はカンマ区切り') + f('start', 'datetime-local') + f('end', 'datetime-local') + f('from', 'date') + f('to', 'date') +
        '<td><button class="del" data-i="' + i + '" title="この行を消す">×</button></td></tr>';
    });
    $('.tb').innerHTML = h + '</table>';
    [].slice.call(box.querySelectorAll('.tb input')).forEach(function (e) { e.onchange = function () { BAGS[+e.dataset.i][e.dataset.k] = e.value.trim(); save(); }; });
    [].slice.call(box.querySelectorAll('.tb .del')).forEach(function (e) { e.onclick = function () { BAGS.splice(+e.dataset.i, 1); if (!BAGS.length) BAGS.push({ name: '', codes: '', start: '', end: '', from: '', to: '' }); save(); render(); }; });
  }
  $('.add').onclick = function () { BAGS.push({ name: '', codes: '', start: '', end: '', from: '', to: '' }); save(); render(); };
  $('.go').onclick = async function () {
    var btn = $('.go'); btn.disabled = true; $('.msg').innerHTML = '<span class="mu">反映中…（1分ほど）</span>';
    try {
      var p = check(); if (p.err) throw new Error(p.err);
      var g = await readGroup(), fd = fdOf(g.f);
      fd.set('use_delivery_date', '1'); fd.set('leadtime2', String(p.lt2)); fd.set('date_dispcount', String(p.cnt));
      fd.set('cmdUpdate', g.f.querySelector('[name=cmdUpdate]').value);
      log('購入グループ：リードタイム2 ' + p.lt2 + '・表示件数 ' + p.cnt);
      var t = new DOMParser().parseFromString(await (await fetch(BO + '/rules/detail.aspx?Rules=' + RULES, { method: 'POST', body: fd, credentials: 'include' })).text(), 'text/html').body.textContent.replace(/\s+/g, ' ');
      var err = (t.match(/[^ ]{0,30}(入力して|できません|不正|エラー)[^ ]{0,30}/) || [''])[0]; if (err) throw new Error('購入グループを更新できない：' + err);
      var chk = await readGroup(); if (chk.lt2 !== String(p.lt2) || chk.cnt !== String(p.cnt)) throw new Error('購入グループが更新されていない');
      await upload('js/usr/', 'sis_hb.js', hbScript(p.bags, chk.icon));
      await loader();
      $('.msg').innerHTML = '<div class="ok">反映しました</div><div>' + p.bags.map(function (b) { return esc(b.name) + '：' + md(dnum(b.from)) + '〜' + md(dnum(b.to)) + 'だけ選べる'; }).join('<br>') + '</div>';
    } catch (e) { log(e.message); $('.msg').innerHTML = '<div class="ng">止めました：' + esc(e.message) + '</div>'; }
    btn.disabled = false;
  };
  render();
})();
