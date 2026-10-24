/* SIS front tidy — イベントページの整理（守り）
   所有：SIS（qoo-ai）。boot.js が config.json の tidy.on のときだけ読む。
   やること（イベントページ /shop/e/e○○/ の既定の並びで開いたときだけ。お客様が並び替えやページ番号を選んだら触らない）
     1. 全ページの商品を1ページにまとめる（並び替えを全件で行うため）
     2. 在庫：そのカラーの全サイズが在庫切れ → 隠す。選ばれているサイズだけ在庫切れ → 在庫のあるサイズに差し替える
     3. 同じ商品・同じカラーが2枚以上 → 1枚にまとめる
     4. 並び替え：ページごとに new（新着＝今の並びのまま）／mix（売れ筋と在庫の混合）／sales（売れ筋）／none
     5. 小物はどのページでも最後
   10/8の不具合を繰り返さないための決まり
     ・URLにパラメータを足さない（filtercode13 は使わない）
     ・在庫が判定できない商品は隠さない（セール開始前・在庫印なしでも出す）
     ・トップの導線（見出し・もっと見る）は触らない */
(function () {
  'use strict';
  if (window.__sisTidy) return; window.__sisTidy = 1;
  var CFG = (window.SIS_CFG || {}).tidy || {};
  if (CFG.on === false) return;
  var CDN = window.SIS_CDN || '';
  var D = document, L = location;
  var m = L.pathname.match(/^\/shop\/e\/e([^_\/]+)(_[^\/]*)?\/?$/i);
  if (!m) return;
  var EV = m[1], SUF = m[2] || '';
  if (SUF && SUF !== '_p1') return;                       // 並び替え・2ページ目以降はお客様の操作なので触らない
  var RULE = (CFG.pages || {})[EV] || CFG.defaultRule || 'mix';
  if (RULE === 'off') return;
  var KOMONO = (CFG.komonoWords || []).map(function (w) { return w.toLowerCase(); });
  var MIX_EVERY = CFG.mixEvery || 4;                     // mix：売れ筋3枚ごとに在庫が多い商品を1枚
  var report = window.SIS_TIDY = { page: EV, rule: RULE, total: 0, hidden: 0, swapped: 0, merged: 0, komono: 0, unknown: 0 };

  function num(s) { var x = String(s || '').replace(/,/g, '').match(/\d+/); return x ? +x[0] : 0; }
  function codeOf(href) { var x = String(href || '').match(/\/shop\/g\/g([^/?#]+)\/?/); return x ? x[1] : null; }
  function stem(code) { var p = String(code).split('-'); return p.length < 4 ? code : p[0] + '-' + p[1].slice(0, -1) + '-' + p[2] + '-' + p[3]; }   // 商品＋カラー
  function pkey(code) { var p = String(code).split('-'); return p.length < 4 ? code : p[0] + '-' + p[1].slice(0, -1) + '-' + p[2]; }           // 商品
  function get(url, ms) {
    var ac = window.AbortController ? new AbortController() : null; if (ac) setTimeout(function () { ac.abort(); }, ms || 8000);
    return fetch(url, { credentials: 'include', signal: ac && ac.signal }).then(function (r) { if (!r.ok) throw r.status; return r.text(); });
  }
  function parse(html) { return new DOMParser().parseFromString(html, 'text/html'); }
  function ssGet(k) { try { var v = JSON.parse(sessionStorage.getItem('sis_tidy_' + k) || 'null'); return v && Date.now() - v.t < 30 * 60e3 ? v.d : null; } catch (e) { return null; } }
  function ssSet(k, d) { try { sessionStorage.setItem('sis_tidy_' + k, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} }

  var CARD = 'dl.block-goods-detail-j--goods';
  function cardsOf(doc) { return [].slice.call(doc.querySelectorAll(CARD)); }
  function info(dl, idx) {
    var a = dl.querySelector('a[href*="/shop/g/g"]'), code = codeOf(a && a.getAttribute('href'));
    var name = ((dl.querySelector('.block-goods-detail-j--goods-name') || {}).textContent || '').replace(/\s+/g, ' ').trim();
    var price = num((dl.querySelector('.block-goods-detail-j--price') || {}).textContent);
    var low = name.toLowerCase();
    return { el: dl, code: code, name: name, price: price, idx: idx, komono: KOMONO.some(function (w) { return low.indexOf(w) >= 0; }) };
  }

  /* 1. 全ページを集める */
  function allPages() {
    var first = cardsOf(D);
    if (!first.length) return Promise.resolve(null);
    var last = 1;
    D.querySelectorAll('a[href]').forEach(function (a) { var x = (a.getAttribute('href') || '').match(new RegExp('/shop/e/e' + EV + '_p(\\d+)/', 'i')); if (x) last = Math.max(last, +x[1]); });
    var reqs = [];
    for (var p = 2; p <= Math.min(last, CFG.maxPages || 20); p++) reqs.push(get('/shop/e/e' + EV + '_p' + p + '/', 10000).then(function (h) { return cardsOf(parse(h)); }).catch(function () { return []; }));
    return Promise.all(reqs).then(function (pages) {
      var all = first.slice(); pages.forEach(function (arr) { arr.forEach(function (dl) { all.push(D.importNode(dl, true)); }); });
      return { first: first, all: all, pages: last };
    });
  }

  /* 2. 在庫：カラーごとに商品ページを1回だけ読む（30分キャッシュ） */
  function colorStock(code) {
    var k = stem(code), c = ssGet(k); if (c) return Promise.resolve(c);
    return get('/shop/g/g' + code + '/', 8000).then(function (h) {
      var d = parse(h), sizes = [];
      d.querySelectorAll('.block-size--item').forEach(function (it) {
        var a = it.querySelector('a'), oc = (it.querySelector('[onclick]') || it).getAttribute('onclick') || '';
        var href = a ? a.getAttribute('href') : (oc.match(/location\.href\s*=\s*['"]([^'"]+)['"]/) || [])[1];
        var cls = it.className;
        sizes.push({ label: it.textContent.replace(/\s+/g, ''), code: codeOf(href) || (/\bactive\b/.test(cls) ? code : null), ok: /enable-stock/.test(cls) ? true : /disable|soldout|nostock/.test(cls) ? false : null });
      });
      var msg = ((d.querySelector('#spec_stock_msg') || {}).textContent || '').trim();
      var self = sizes.filter(function (s) { return s.code === code; })[0];
      var res = { sizes: sizes, selfOk: self ? self.ok : (/×|在庫なし|売り切れ/.test(msg) ? false : /○|△/.test(msg) ? true : null), low: /△|残りわずか/.test(msg) };
      ssSet(k, res); return res;
    }).catch(function () { return null; });
  }
  function pool(items, n, fn) {
    var i = 0, out = new Array(items.length);
    function next() { if (i >= items.length) return Promise.resolve(); var j = i++; return fn(items[j]).then(function (r) { out[j] = r; return next(); }); }
    var ws = []; for (var w = 0; w < n; w++) ws.push(next());
    return Promise.all(ws).then(function () { return out; });
  }

  /* 4. 売れ筋データ（data/ranking.json：GA4の購入数） */
  function sales() {
    return fetch(CDN + 'data/ranking.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (rk) {
      var s = {}; (rk.items || []).forEach(function (x) { if (x.code) s[pkey(x.code)] = (s[pkey(x.code)] || 0) + (x.purchases || 0); }); return s;
    }).catch(function () { return {}; });
  }

  function order(list, buy) {
    var body = list.filter(function (g) { return !g.komono; }), tail = list.filter(function (g) { return g.komono; });
    report.komono = tail.length;
    function byIdx(a, b) { return a.idx - b.idx; }
    function bySales(a, b) { return (buy[pkey(b.code)] || 0) - (buy[pkey(a.code)] || 0) || a.idx - b.idx; }
    if (RULE === 'new' || RULE === 'none') return body.sort(byIdx).concat(tail.sort(byIdx));
    if (RULE === 'sales') return body.sort(bySales).concat(tail.sort(bySales));
    // mix：売れ筋（購入あり）を上から3枚、4枚目に在庫が十分な商品（売れ筋以外・元の並び）を1枚、を繰り返す
    var hot = body.filter(function (g) { return buy[pkey(g.code)]; }).sort(bySales);
    var rest = body.filter(function (g) { return !buy[pkey(g.code)]; });
    var plenty = rest.filter(function (g) { return g.stock && !g.stock.low; }).sort(byIdx);
    var others = rest.filter(function (g) { return !(g.stock && !g.stock.low); }).sort(byIdx);
    var out = [];
    while (hot.length || plenty.length) {
      for (var k = 0; k < MIX_EVERY - 1 && hot.length; k++) out.push(hot.shift());
      if (plenty.length) out.push(plenty.shift());
      if (!hot.length) { out = out.concat(plenty); plenty = []; }
    }
    return out.concat(others).concat(tail.sort(bySales));
  }

  function run() {
    allPages().then(function (r) {
      if (!r) return;
      var list = r.all.map(info).filter(function (g) { return g.code; });
      report.total = list.length; report.pages = r.pages;
      // 3. 同じ商品・同じカラーは1枚に（在庫判定の後で、在庫のある方を残す）
      var colors = {}; list.forEach(function (g) { (colors[stem(g.code)] = colors[stem(g.code)] || []).push(g); });
      var reps = Object.keys(colors).map(function (k) { return colors[k][0]; });
      return Promise.all([pool(reps, CFG.concurrency || 6, function (g) { return colorStock(g.code); }), sales()]).then(function (res) {
        var stockOf = {}; reps.forEach(function (g, i) { stockOf[stem(g.code)] = res[0][i]; });
        var buy = res[1], keep = [];
        Object.keys(colors).forEach(function (k) {
          var group = colors[k], st = stockOf[k];
          if (!st || !st.sizes.length) { report.unknown++; keep.push(group[0]); report.merged += group.length - 1; return; }   // 判定できない → 隠さない
          var okSizes = st.sizes.filter(function (s) { return s.ok; });
          if (!okSizes.length && st.sizes.some(function (s) { return s.ok === false; })) { report.hidden += group.length; return; }  // 全サイズ在庫切れ
          var g = group.filter(function (x) { return okSizes.some(function (s) { return s.code === x.code; }); })[0] || group[0];
          report.merged += group.length - 1;
          var selfOk = okSizes.some(function (s) { return s.code === g.code; });
          var alt = okSizes.filter(function (s) { return s.code; })[0];
          if (!selfOk && alt) {        // 選ばれているサイズだけ在庫切れ → 在庫のあるサイズへ
            g.el.querySelectorAll('a[href*="/shop/g/g' + g.code + '/"]').forEach(function (a) { a.setAttribute('href', a.getAttribute('href').replace(g.code, alt.code)); });
            g.el.setAttribute('data-sis-swap', g.code + '>' + alt.code); report.swapped++;
          }
          g.stock = st; keep.push(g);
        });
        var sorted = order(keep, buy);
        // 1ページ目の入れ物に並べ直し、ページ送りを隠す
        var box = r.first[0].parentNode;
        r.first.forEach(function (dl) { if (dl.parentNode) dl.parentNode.removeChild(dl); });
        sorted.forEach(function (g) { box.appendChild(g.el); });
        D.querySelectorAll('.pager, [class*="pager-"]').forEach(function (p) { if (!/pager-count/.test(p.className)) p.style.display = 'none'; });
        var cnt = D.querySelector('.pager-count'); if (cnt) cnt.textContent = sorted.length + '件あります';
        D.documentElement.setAttribute('data-sis-tidy', RULE);
        if (window.SIS && window.SIS.active) window.SIS.active.tidy = RULE + '・' + sorted.length + '件（隠す' + report.hidden + '／差替' + report.swapped + '）';
        if (window.console) console.info('[SIS tidy]', report);
      });
    }).catch(function (e) { if (window.console) console.warn('[SIS tidy]', e); });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', run); else run();
})();
