/* SIS front tidy v2 — イベントページとトップの並び（守り）
   所有：SIS（qoo-ai）。boot.js が config.json の tidy.on のときだけ読む。設定は config.json の "tidy"。
   ─────────────────────────────────────────────────────────────
   部品（上から順に動く。トラブル時はブラウザのコンソールで window.SIS_TIDY を見る）
     A. 名簿（リスト）読み込み …… イベントページ /shop/e/e○○/ の全ページを読み、商品コードと名前の一覧を作る（60分キャッシュ）
     B. 印の名簿 …………………… 小物ページ(ekomono)・後回し(eback)・先頭固定(epin) に載っている商品を印として読む
     C. 人気データ ………………… 貴社サイトの /js/usr/sis_data.js（GA4：閲覧・カート・購入の実数）
     D. お客様の好み ……………… この端末で見た商品（localStorage sis_viewed）から、よく見るカテゴリ・ブランドを数える
     E. 並べ方 ……………………… ページごとの規則（mix/new/sales）で並べる。mix は「売れ筋3＋在庫十分1」の繰り返しで、
                                    同じ人には同じ日は同じ並び（日替わりのゆらぎ）。先頭固定→本体→小物・後回し の順
     F. ページ間のかぶり防止 …… priority の順に各ページの「上から dedupeTop 枚」を決め、上位ページで使った商品は
                                    下位ページの上段に出さない。1ページの上段では同じ商品の色違いを1枚にする
     G. 在庫と重複（イベントページだけ）… カラーごとに商品ページを1回読み、全サイズ売り切れの色は隠す。
                                    選択サイズだけ売り切れなら在庫のあるサイズへリンクを差し替える。同じ色の重複は1枚に
     H. 表示 ……………………… イベントページ：全件を1ページに並べ直し（元と同じ1行の枚数）、ページ番号を隠す
                                    トップ：各イベント枠を、そのページの上段（F の結果）で入れ替える（枠の枚数はそのまま）
     I. NEWアイコン ……………… 新作ページに載っている商品だけ NEW を残す（掲載開始日でNEWが付く仕様への対策）
   決まり（10/8の不具合を繰り返さない）
     ・URLにパラメータを足さない ・在庫が判定できない商品は隠さない ・トップの見出し・もっと見るは触らない
     ・お客様が並び替えやページ番号を選んだ（_sg や _p2 など）ページは触らない */
(function () {
  'use strict';
  if (window.__sisTidy) return; window.__sisTidy = 1;
  var CFG = (window.SIS_CFG || {}).tidy || {};
  if (CFG.on === false) return;
  var D = document, L = location;
  var KW_DEFAULT = ['バッグ', 'リュック', '財布', '帽子', 'キャップ', 'ハット', 'ベルト', 'マフラー', 'ストール', '手袋', 'ソックス', '靴下', 'マスク', 'ヘアゴム', 'シュシュ', 'ヘアクリップ', 'ポーチ', 'エコバッグ', 'ハンカチ', 'タオル', 'キーホルダー'];
  var KW = (CFG.komonoWords || KW_DEFAULT).map(function (w) { return w.toLowerCase(); });
  var PRIORITY = CFG.priority || ['special', 'sale2', 'new', 'osusume', 'stan', '70off', '50off', '30off', '15off', 'stan-in', 'stan-st'];
  var TOPN = CFG.dedupeTop || 12, MIX_EVERY = CFG.mixEvery || 4;
  var W = CFG.weights || { hotPop: 0.6, hotAff: 0.25, hotRnd: 0.15, restAff: 0.55, restRnd: 0.45 };
  var CARD = 'dl.block-goods-detail-j--goods';
  var report = window.SIS_TIDY = { v: 2, page: null, steps: {} };
  function step(k, v) { report.steps[k] = v; }

  /* ---------- 共通の小道具 ---------- */
  function codeOf(href) { var x = String(href || '').match(/\/shop\/g\/g([^/?#]+)\/?/); return x ? x[1] : null; }
  function stem(code) { var p = String(code).split('-'); return p.length < 4 ? code : p[0] + '-' + p[1].slice(0, -1) + '-' + p[2] + '-' + p[3]; }   // 商品＋カラー
  function pk(code) { var p = String(code || '').split('-'); return p.length < 4 ? code : p[0] + '-' + p[1].slice(0, -1) + '-' + p[2]; }        // 商品
  function num(s) { var x = String(s || '').replace(/,/g, '').match(/\d+/); return x ? +x[0] : 0; }
  function parse(h) { return new DOMParser().parseFromString(h, 'text/html'); }
  function get(url, ms) {
    var ac = window.AbortController ? new AbortController() : null; if (ac) setTimeout(function () { ac.abort(); }, ms || 10000);
    return fetch(url, { credentials: 'include', signal: ac && ac.signal }).then(function (r) { if (!r.ok) throw r.status; return r.text(); });
  }
  function cacheGet(store, k, ttl) { try { var v = JSON.parse(store.getItem('sis_tidy_' + k) || 'null'); return v && Date.now() - v.t < ttl ? v.d : null; } catch (e) { return null; } }
  function cacheSet(store, k, d) { try { store.setItem('sis_tidy_' + k, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} }
  function ls(k) { try { return JSON.parse(localStorage.getItem('sis_' + k) || 'null'); } catch (e) { return null; } }
  function nameOf(dl) { return ((dl.querySelector('.block-goods-detail-j--goods-name') || {}).textContent || '').replace(/\s+/g, ' ').trim(); }
  function linkCode(dl) { var a = dl.querySelector('a[href*="/shop/g/g"]'); return codeOf(a && a.getAttribute('href')); }
  function ready() { return new Promise(function (ok) { if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', ok); else ok(); }); }

  /* ---------- A. 名簿：イベントの全ページを読む（60分キャッシュ） ---------- */
  var docs = {};   // 'ev:p' → Document（このページ表示中だけ持つ）
  function pageDoc(ev, p) {
    var k = ev + ':' + p; if (docs[k]) return Promise.resolve(docs[k]);
    return get('/shop/e/e' + ev + (p > 1 ? '_p' + p : '') + '/').then(function (h) { return (docs[k] = parse(h)); });
  }
  function eventList(ev) {
    var c = cacheGet(localStorage, 'list_' + ev, (CFG.listTtlMin || 60) * 60e3); if (c) return Promise.resolve(c);
    return pageDoc(ev, 1).then(function (d1) {
      var last = 1; d1.querySelectorAll('a[href]').forEach(function (a) { var x = (a.getAttribute('href') || '').match(new RegExp('/shop/e/e' + ev + '_p(\\d+)/', 'i')); if (x) last = Math.max(last, +x[1]); });
      var reqs = [Promise.resolve(d1)]; for (var p = 2; p <= Math.min(last, CFG.maxPages || 20); p++) reqs.push(pageDoc(ev, p).catch(function () { return null; }));
      return Promise.all(reqs);
    }).then(function (ds) {
      var out = [], idx = 0;
      ds.forEach(function (d, i) { if (!d) return; d.querySelectorAll(CARD).forEach(function (dl) { var c = linkCode(dl); if (c) out.push({ c: c, n: nameOf(dl), p: i + 1, i: idx++ }); }); });
      cacheSet(localStorage, 'list_' + ev, out); return out;
    }).catch(function () { return []; });
  }

  /* ---------- B. 印の名簿（小物・後回し・先頭固定） ---------- */
  function memberSet(ev) { return eventList(ev).then(function (l) { var s = {}; l.forEach(function (x) { s[pk(x.c)] = 1; }); return s; }); }
  function marks() {
    var last = CFG.lastEvents || ['komono', 'back'], first = CFG.firstEvents || ['pin'];
    return Promise.all(last.map(memberSet).concat(first.map(memberSet))).then(function (ss) {
      var back = {}, pin = {};
      ss.slice(0, last.length).forEach(function (s) { Object.keys(s).forEach(function (k) { back[k] = 1; }); });
      ss.slice(last.length).forEach(function (s) { Object.keys(s).forEach(function (k) { pin[k] = 1; }); });
      step('marks', { back: Object.keys(back).length, pin: Object.keys(pin).length });
      return { back: back, pin: pin };
    });
  }

  /* ---------- C. 人気データ（GA4の実数・貴社サイト側のファイル） ---------- */
  function stats() {
    return fetch(CFG.dataUrl || '/js/usr/sis_data.js', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (t) {
      var d = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)), s = {}, it = d.popular && d.popular.items;
      if (typeof it === 'string') it.split(';').forEach(function (x) { var kv = x.split(':'); if (kv[1]) { var a = kv[1].split(',').map(Number); s[kv[0]] = { v: a[0] || 0, c: a[1] || 0, p: a[2] || 0 }; } });
      else if (it) Object.keys(it).forEach(function (k) { var a = it[k]; s[k] = { v: a[0] || 0, c: a[1] || 0, p: a[2] || 0 }; });
      step('stats', Object.keys(s).length + '商品'); return s;
    }).catch(function () { step('stats', '読めない（人気は使わず並べる）'); return {}; });
  }

  /* ---------- D. お客様の好み（この端末で見た商品から） ---------- */
  function catOf(name) { var m = String(name || '').match(/【([^】]+)】/); return m ? m[1] : ''; }
  function profile() {
    var v = (ls('viewed') || []).filter(function (x) { return x && x.code && Date.now() - (x.t || 0) < 30 * 864e5; });
    var cat = {}, brand = {}; v.forEach(function (x) { var c = catOf(x.name); if (c) cat[c] = (cat[c] || 0) + 1; var b = String(x.code).split('-')[0]; brand[b] = (brand[b] || 0) + 1; });
    var seed = ls('seed'); if (!seed) { seed = String(Math.random()).slice(2, 10); try { localStorage.setItem('sis_seed', JSON.stringify(seed)); } catch (e) {} }
    var day = new Date(); day = day.getFullYear() * 1e4 + (day.getMonth() + 1) * 100 + day.getDate();
    var mc = Math.max.apply(null, [1].concat(Object.keys(cat).map(function (k) { return cat[k]; }))), mb = Math.max.apply(null, [1].concat(Object.keys(brand).map(function (k) { return brand[k]; })));
    step('profile', { viewed: v.length, cats: cat });
    return { n: v.length, cat: cat, brand: brand, mc: mc, mb: mb, seed: seed + ':' + day };
  }
  function rnd(seed, key) { var h = 2166136261, s = seed + '|' + key; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
  function aff(prof, name, code) { if (!prof.n) return 0; var c = catOf(name); return 0.6 * ((prof.cat[c] || 0) / prof.mc) + 0.4 * ((prof.brand[String(code).split('-')[0]] || 0) / prof.mb); }

  /* ---------- E. 並べ方 ---------- */
  // items: [{code, name, idx, stockLow?}]  → 並んだ配列
  function orderItems(items, rule, ctx) {
    var mk = ctx.marks, st = ctx.stats, prof = ctx.prof;
    var maxP = 1; items.forEach(function (g) { var s = st[pk(g.code)]; if (s && s.p > maxP) maxP = s.p; });
    items.forEach(function (g) {
      var k = pk(g.code), s = st[k] || { p: 0 };
      g.pin = !!mk.pin[k]; g.back = !!mk.back[k] || KW.some(function (w) { return g.name.toLowerCase().indexOf(w) >= 0; });
      g.pop = Math.log(1 + s.p) / Math.log(1 + maxP); g.hot = s.p > 0;
      g.aff = aff(prof, g.name, g.code); g.rnd = rnd(prof.seed, k);
      g.sHot = W.hotPop * g.pop + W.hotAff * g.aff + W.hotRnd * g.rnd;
      g.sRest = W.restAff * g.aff + W.restRnd * g.rnd;
    });
    var byIdx = function (a, b) { return a.idx - b.idx; };
    var pin = items.filter(function (g) { return g.pin; }).sort(byIdx);
    var tail = items.filter(function (g) { return !g.pin && g.back; }).sort(function (a, b) { return b.sHot - a.sHot; });
    var body = items.filter(function (g) { return !g.pin && !g.back; });
    var out;
    if (rule === 'new' || rule === 'none') out = body.sort(byIdx);
    else if (rule === 'sales') out = body.sort(function (a, b) { return b.sHot - a.sHot || a.idx - b.idx; });
    else {   // mix
      var hot = body.filter(function (g) { return g.hot; }).sort(function (a, b) { return b.sHot - a.sHot; });
      var rest = body.filter(function (g) { return !g.hot; }).sort(function (a, b) { return (a.stockLow ? 1 : 0) - (b.stockLow ? 1 : 0) || b.sRest - a.sRest; });
      out = [];
      while (hot.length || rest.length) {
        for (var k = 0; k < MIX_EVERY - 1 && hot.length; k++) out.push(hot.shift());
        if (rest.length) out.push(rest.shift());
        if (!hot.length) { out = out.concat(rest); rest = []; }
      }
    }
    return pin.concat(out, tail);
  }

  /* ---------- F. ページ間のかぶり防止＋上段の色違いまとめ ---------- */
  // ordered：E の結果。reserved：上位ページで上段に使った商品（pk）。上段 TOPN 枚を決め、残りを後ろへ
  function topFirst(ordered, reserved) {
    var top = [], usedP = {}, rest = [];
    ordered.forEach(function (g) {
      var k = pk(g.code);
      if (top.length < TOPN && !g.pin && !g.back && !reserved[k] && !usedP[k]) { top.push(g); usedP[k] = 1; } else rest.push(g);
    });
    var pinned = rest.filter(function (g) { return g.pin; });
    rest = rest.filter(function (g) { return !g.pin; });
    if (top.length < TOPN) {   // 上段が埋まらない（商品が少ない）ときは、かぶりを許して埋める
      var fill = rest.filter(function (g) { return !g.back; }).slice(0, TOPN - top.length);
      top = top.concat(fill); rest = rest.filter(function (g) { return fill.indexOf(g) < 0; });
    }
    return { list: pinned.concat(top, rest), top: top };
  }
  // priority の順に各ページの上段を決める（until のページの直前まで、または全部）
  function allocate(until, ctx) {
    var evs = until ? PRIORITY.slice(0, Math.max(0, PRIORITY.indexOf(until))) : PRIORITY.slice();
    return Promise.all(evs.map(eventList)).then(function (lists) {
      var reserved = {}, tops = {};
      evs.forEach(function (ev, i) {
        var stockCache = function (c) { return cacheGet(sessionStorage, stem(c), 30 * 60e3); };
        var items = lists[i].filter(function (x) { var s = stockCache(x.c); return !(s && s.sizes && s.sizes.length && !s.sizes.some(function (z) { return z.ok !== false; })); })
          .filter(function (x, j, a) { return a.findIndex(function (y) { return stem(y.c) === stem(x.c); }) === j; })
          .map(function (x) { return { code: x.c, name: x.n, idx: x.i, page: x.p }; });
        var res = topFirst(orderItems(items, (CFG.pages || {})[ev] || CFG.defaultRule || 'mix', ctx), reserved);
        tops[ev] = res.top; res.top.forEach(function (g) { reserved[pk(g.code)] = 1; });
      });
      return { reserved: reserved, tops: tops };
    });
  }
  // 確認用：コンソールで SIS_TIDY_CHECK() → 各ページの上段とかぶり数
  window.SIS_TIDY_CHECK = function () {
    return Promise.all([marks(), stats()]).then(function (r) {
      var ctx = { marks: r[0], stats: r[1], prof: profile() };
      return allocate(null, ctx).then(function (a) {
        var seen = {}, dup = 0, rows = {};
        PRIORITY.forEach(function (ev) { rows[ev] = (a.tops[ev] || []).map(function (g) { var k = pk(g.code); if (seen[k]) dup++; seen[k] = 1; return g.name.slice(0, 18); }); });
        return { overlapInTops: dup, tops: rows };
      });
    });
  };

  /* ---------- I. NEWアイコン ---------- */
  function fixNew() {
    if (CFG.newOnlyFromNewPage === false) return;
    memberSet('new').then(function (set) {
      if (!Object.keys(set).length) return;
      var go = function () {
        D.querySelectorAll('.block-icon--auto-new').forEach(function (ic) {
          var box = ic.closest('dl') || D, a = box.querySelector && box.querySelector('a[href*="/shop/g/g"]');
          var code = a ? codeOf(a.getAttribute('href')) : codeOf(L.pathname);
          if (code && !set[pk(code)]) ic.style.display = 'none';
        });
      };
      ready().then(go); setTimeout(go, 3000);
    });
  }
  fixNew();

  /* ---------- H-1. トップページ ---------- */
  if (/^\/(shop\/?)?(default\.aspx)?$/i.test(L.pathname)) {
    report.page = 'top';
    if (CFG.topOn === false) return;
    Promise.all([ready(), marks(), stats()]).then(function (r) {
      var ctx = { marks: r[1], stats: r[2], prof: profile() };
      var secs = [].slice.call(D.querySelectorAll('.block-top-event--goods')).map(function (s) {
        var h = s.previousElementSibling, a = h && h.querySelector && h.querySelector('a[href*="/shop/e/e"]');
        return { el: s, ev: a ? (a.getAttribute('href').match(/\/shop\/e\/e([^\/_?]+)/) || [])[1] : null };
      });
      return allocate(null, ctx).then(function (al) {
        return Promise.all(secs.map(function (sec) {
          var top = sec.ev && al.tops[sec.ev]; if (!top || !top.length) return null;
          var cards = [].slice.call(sec.el.querySelectorAll(CARD)), n = cards.length;
          var byCode = {}; cards.forEach(function (dl) { byCode[linkCode(dl)] = dl; });
          var want = top.slice(0, n);
          return Promise.all(want.map(function (g) {
            if (byCode[g.code]) return byCode[g.code];
            return pageDoc(sec.ev, g.page || 1).then(function (d) {
              var dl = [].slice.call(d.querySelectorAll(CARD)).filter(function (x) { return linkCode(x) === g.code; })[0];
              return dl ? D.importNode(dl, true) : null;
            }).catch(function () { return null; });
          })).then(function (newCards) {
            if (newCards.some(function (x) { return !x; })) return { ev: sec.ev, kept: 'カードを作れない商品があり、この枠はそのまま' };
            var rows = cards.map(function (dl) { return dl.parentNode; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
            var counts = rows.map(function (row) { return row.querySelectorAll(CARD).length; });
            cards.forEach(function (dl) { if (dl.parentNode) dl.parentNode.removeChild(dl); });
            var j = 0; rows.forEach(function (row, ri) { for (var c = 0; c < counts[ri]; c++) row.appendChild(newCards[j++]); });
            return { ev: sec.ev, shown: want.map(function (g) { return g.name.slice(0, 16); }) };
          });
        })).then(function (res) { step('top', res); D.documentElement.setAttribute('data-sis-tidy', 'top'); });
      });
    }).catch(function (e) { step('error', String(e)); });
    return;
  }

  /* ---------- H-2. イベントページ ---------- */
  var m = L.pathname.match(/^\/shop\/e\/e([^_\/]+)(_[^\/]*)?\/?$/i);
  if (!m) return;
  var EV = m[1], SUF = m[2] || '';
  if (SUF && SUF !== '_p1') return;
  var RULE = (CFG.pages || {})[EV] || CFG.defaultRule || 'mix';
  if (RULE === 'off') return;
  report.page = EV; report.rule = RULE;

  /* G. 在庫：カラーごとに商品ページを1回だけ読む（30分キャッシュ） */
  function colorStock(code) {
    var k = stem(code), c = cacheGet(sessionStorage, k, 30 * 60e3); if (c) return Promise.resolve(c);
    return get('/shop/g/g' + code + '/', 8000).then(function (h) {
      var d = parse(h), sizes = [];
      d.querySelectorAll('.block-size--item').forEach(function (it) {
        var a = it.querySelector('a'), oc = (it.querySelector('[onclick]') || it).getAttribute('onclick') || '';
        var href = a ? a.getAttribute('href') : (oc.match(/location\.href\s*=\s*['"]([^'"]+)['"]/) || [])[1];
        var cls = it.className;
        sizes.push({ label: it.textContent.replace(/\s+/g, ''), code: codeOf(href) || (/\bactive\b/.test(cls) ? code : null), ok: /enable-stock/.test(cls) ? true : /disable|soldout|nostock/.test(cls) ? false : null });
      });
      var msg = ((d.querySelector('#spec_stock_msg') || {}).textContent || '').trim();
      var res = { sizes: sizes, low: /△|残りわずか/.test(msg), msg: msg.slice(0, 10) };
      cacheSet(sessionStorage, k, res); return res;
    }).catch(function () { return null; });
  }
  function pool(items, n, fn) {
    var i = 0, out = new Array(items.length);
    function next() { if (i >= items.length) return Promise.resolve(); var j = i++; return fn(items[j]).then(function (r) { out[j] = r; return next(); }); }
    var ws = []; for (var w = 0; w < n; w++) ws.push(next());
    return Promise.all(ws).then(function () { return out; });
  }

  function run() {
    var first = [].slice.call(D.querySelectorAll(CARD)); if (!first.length) return;
    var ctxP = Promise.all([marks(), stats()]).then(function (r) { return { marks: r[0], stats: r[1], prof: profile() }; });
    Promise.all([eventList(EV), ctxP]).then(function (x) {
      var list = x[0], ctx = x[1];
      // 1ページ目のカードは今の画面のもの、2ページ目以降は名簿を読んだときのページから取る
      var firstByCode = {}; first.forEach(function (dl) { firstByCode[linkCode(dl)] = dl; });
      return Promise.all(list.map(function (it) {
        if (it.p === 1 && firstByCode[it.c]) return Promise.resolve({ el: firstByCode[it.c], it: it });
        return pageDoc(EV, it.p).then(function (d) {
          var dl = [].slice.call(d.querySelectorAll(CARD)).filter(function (q) { return linkCode(q) === it.c; })[0];
          return dl ? { el: D.importNode(dl, true), it: it } : null;
        }).catch(function () { return null; });
      })).then(function (cards) {
        cards = cards.filter(Boolean);
        var g0 = cards.map(function (c) { return { el: c.el, code: c.it.c, name: c.it.n, idx: c.it.i }; });
        step('total', g0.length);
        var colors = {}; g0.forEach(function (g) { (colors[stem(g.code)] = colors[stem(g.code)] || []).push(g); });
        var reps = Object.keys(colors).map(function (k) { return colors[k][0]; });
        return Promise.all([pool(reps, CFG.concurrency || 6, function (g) { return colorStock(g.code); }), allocate(EV, ctx)]).then(function (res) {
          var stockOf = {}; reps.forEach(function (g, i) { stockOf[stem(g.code)] = res[0][i]; });
          var keep = [], hidden = 0, swapped = 0, merged = 0, unknown = 0;
          Object.keys(colors).forEach(function (k) {
            var group = colors[k], st = stockOf[k];
            if (!st || !st.sizes.length) { unknown++; keep.push(group[0]); merged += group.length - 1; return; }
            var okSizes = st.sizes.filter(function (s) { return s.ok; });
            if (!okSizes.length && st.sizes.some(function (s) { return s.ok === false; })) { hidden += group.length; return; }
            var g = group.filter(function (q) { return okSizes.some(function (s) { return s.code === q.code; }); })[0] || group[0];
            merged += group.length - 1;
            var alt = okSizes.filter(function (s) { return s.code; })[0];
            if (!okSizes.some(function (s) { return s.code === g.code; }) && alt) {
              g.el.querySelectorAll('a[href*="/shop/g/g' + g.code + '/"]').forEach(function (a) { a.setAttribute('href', a.getAttribute('href').replace(g.code, alt.code)); });
              g.el.setAttribute('data-sis-swap', g.code + '>' + alt.code); swapped++;
            }
            g.stockLow = st.low; keep.push(g);
          });
          step('stock', { hidden: hidden, swapped: swapped, merged: merged, unknown: unknown });
          var res2 = topFirst(orderItems(keep, RULE, ctx), res[1].reserved);
          step('dedupe', { reservedFromHigherPages: Object.keys(res[1].reserved).length, top: res2.top.map(function (g) { return g.name.slice(0, 16); }) });
          render(first, res2.list);
        });
      });
    }).catch(function (e) { step('error', String(e)); if (window.console) console.warn('[SIS tidy]', e); });
  }
  function render(first, sorted) {
    var row0 = first[0].parentNode, list0 = row0.parentNode;
    var perRow = Math.max.apply(null, first.map(function (dl) { return dl.parentNode; }).filter(function (x, i, a) { return a.indexOf(x) === i; })
      .map(function (row) { return row.querySelectorAll(CARD).length; })) || 4;
    var oldRows = [].slice.call(list0.children), rowTpl = row0.cloneNode(false);
    first.forEach(function (dl) { if (dl.parentNode) dl.parentNode.removeChild(dl); });
    var anchor = oldRows[0], cur = null;
    sorted.forEach(function (g, i) { if (i % perRow === 0) { cur = rowTpl.cloneNode(false); list0.insertBefore(cur, anchor); } cur.appendChild(g.el); });
    oldRows.forEach(function (row) { if (!row.querySelector(CARD) && row.parentNode) row.parentNode.removeChild(row); });
    D.querySelectorAll('.pagination').forEach(function (p) { p.style.display = 'none'; });
    var cnt = D.querySelector('.pager-count'); if (cnt) cnt.textContent = sorted.length + '件あります';
    D.documentElement.setAttribute('data-sis-tidy', RULE);
    step('shown', sorted.length);
    if (window.console) console.info('[SIS tidy]', report);
  }
  ready().then(run);
})();
