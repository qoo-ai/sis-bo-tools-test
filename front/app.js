/* SIS front app — drug store's 店舗画面の売上施策（19本）
   所有：SIS（qoo-ai）。設定は config.json、データは data/。表示する数字・期限・在庫はすべて実データのみ。
   ・プレビュー用パラメータ（関係者のみ）
     sis_show=<施策id>   その施策をその場で出す（welcome / exit / kuji / cart / coupon）
     sis_src=line|instagram|qr   流入元を指定して表示
     sis_rank=<ランク名>  会員ランク別UIの表示確認（ログインしていない時のみ）
     sis_visit=new|repeat 新規／リピーター表示の切替
     sis_now=2026-11-23T20:00   期限表示を指定時刻で確認（ルールは実物のまま）
     sis_ab=<テストid>:<A|B>  ABテストの割付を固定
     sis_demo=1          BO設定待ち（クーポン未発行など）の施策を「設定待ち」表示で出す
     sis_debug=1         計測イベントの一覧パネルを出す
     sis_chip=0          左下のSISチップを隠す（スクショ用）
     sis_only=a,b        指定した施策だけ動かす（スクショ用） */
(function () {
  'use strict';
  if (window.SIS && window.SIS.loaded) return;
  var C = window.SIS_CFG || {}, F = C.features || {}, SHOP = C.shop || {};
  var D = document, L = location, Q = new URLSearchParams(L.search);
  var CDN = window.SIS_CDN || '';
  var SIS = window.SIS = { loaded: true, version: C.version, ref: (window.SIS_REF || '').slice(0, 7), events: [], active: {}, show: null };

  /* ---------- 基本 ---------- */
  var SP = !!D.querySelector('link[href*="sb_layout"]') || /iphone|android.+mobile/i.test(navigator.userAgent) && !D.querySelector('link[href*="/css/usr/layout"]');
  var P = L.pathname;
  var PAGE = /^\/(shop\/?)?(default\.aspx)?$/i.test(P) ? 'top'
    : /^\/shop\/g\/g/i.test(P) ? 'goods'
    : /^\/shop\/(c|e|r)\//i.test(P) || /\/goods\/search\.aspx/i.test(P) ? 'list'
    : /^\/shop\/cart\/cart\.aspx/i.test(P) ? 'cart'
    : /^\/shop\/(order|customer\/(entry|login))/i.test(P) ? 'order'
    : /^\/shop\/customer\//i.test(P) ? 'mypage' : 'other';
  var NOWOFF = 0;
  if (Q.get('sis_now')) { var pv = new Date(Q.get('sis_now')); if (!isNaN(pv)) NOWOFF = pv - new Date(); }
  function now() { return new Date(Date.now() + NOWOFF); }
  var DEMO = Q.get('sis_demo') === '1';
  function ls(k, v) { try { if (v === undefined) { var s = localStorage.getItem('sis_' + k); return s ? JSON.parse(s) : null; } if (v === null) localStorage.removeItem('sis_' + k); else localStorage.setItem('sis_' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function ss(k, v) { try { if (v === undefined) { var s = sessionStorage.getItem('sis_' + k); return s ? JSON.parse(s) : null; } if (v === null) sessionStorage.removeItem('sis_' + k); else sessionStorage.setItem('sis_' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function yen(n) { return '¥' + Math.round(n).toLocaleString('ja-JP'); }
  function num(s) { var m = String(s || '').replace(/,/g, '').match(/\d+/); return m ? +m[0] : 0; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function h(html) { var t = D.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function onReady(fn) { if (D.readyState !== 'loading') fn(); else D.addEventListener('DOMContentLoaded', fn); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function parseDoc(html) { return new DOMParser().parseFromString(html, 'text/html'); }
  function get(url, ms) {
    var ac = new AbortController(); setTimeout(function () { ac.abort(); }, ms || 8000);
    return fetch(url, { credentials: 'include', signal: ac.signal }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); });
  }
  function codeOf(href) { var m = String(href || '').match(/\/shop\/g\/g([^/?#]+)\/?/); return m ? m[1] : null; }
  function pkey(code) { var p = String(code).split('-'); return p.length < 4 ? code : p[0] + '-' + p[1].slice(0, -1) + '-' + p[2]; }
  function uniqProduct(arr) { var s = {}; return arr.filter(function (g) { var k = pkey(g.code); if (s[k]) return false; s[k] = 1; return true; }); }
  function stem(code) { var p = String(code).split('-'); if (p.length < 4) return code; return p[0] + '-' + p[1].slice(0, -1) + '-' + p[2] + '-' + p[3]; }

  /* ---------- 訪問・セッション ---------- */
  var vid = ls('vid'); if (!vid) { vid = Math.random().toString(36).slice(2) + Date.now().toString(36); ls('vid', vid); }
  var newSession = !ss('sess'); if (newSession) { ss('sess', 1); ls('visits', (ls('visits') || 0) + 1); }
  var visits = ls('visits') || 1;
  var isNew = Q.get('sis_visit') ? Q.get('sis_visit') === 'new' : visits <= ((C.visitor || {}).newUntilVisits || 1);
  ss('pv', (ss('pv') || 0) + 1);

  /* ---------- ABテスト・計測 ---------- */
  function hash(s) { var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  var abOverride = {}; (Q.get('sis_ab') || '').split(',').forEach(function (kv) { var p = kv.split(':'); if (p[1]) abOverride[p[0]] = p[1]; });
  function ab(test) {
    var t = (C.ab || {})[test]; if (!t || !F.ab) return 'A';
    var v = abOverride[test] || t.variants[hash(vid + ':' + test) % t.variants.length];
    SIS.active['ab:' + test] = v; return v;
  }
  function track(feature, action, extra) {
    var e = { event: (C.ga4 || {}).eventName || 'sis_event', sis_feature: feature, sis_action: action, sis_page: PAGE, sis_device: SP ? 'sp' : 'pc' };
    var t = (C.ab || {})[feature]; if (t) e.sis_variant = ab(feature);
    for (var k in extra || {}) e[k] = extra[k];
    e.time = now().toTimeString().slice(0, 8);
    SIS.events.push(e); renderDebug();
    var staff = true; // 現在は関係者限定（?sis=p）でのみ読み込まれる
    if (F.ga4 && (!staff || (C.ga4 || {}).sendInStaffMode)) { try { (window.dataLayer = window.dataLayer || []).push(e); } catch (x) {} }
  }

  /* ---------- 見た目 ---------- */
  var ORANGE = '#ee7832';
  var css = [
    '.sis-root,.sis-root *{box-sizing:border-box}',
    '.sis-root{font-family:"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP",Meiryo,sans-serif;color:#333;line-height:1.6;letter-spacing:.02em}',
    '.sis-strip{display:flex;align-items:center;gap:12px;justify-content:center;flex-wrap:wrap;margin:0 auto;padding:10px 16px;font-size:14px;background:#fff7f0;border-bottom:1px solid #f6d3b8;text-align:center}',
    '.sis-strip b{color:' + ORANGE + '}',
    '.sis-strip a.sis-btn{padding:4px 14px;font-size:13px}',
    '.sis-btn{display:inline-block;padding:12px 22px;border-radius:999px;background:' + ORANGE + ';color:#fff!important;font-weight:bold;text-decoration:none!important;border:0;cursor:pointer;font-size:15px;line-height:1.3}',
    '.sis-btn:hover{opacity:.88}',
    '.sis-btn.sis-ghost{background:#fff;color:#666!important;border:1px solid #ccc;font-weight:normal}',
    '.sis-btn.sis-line{background:#06c755}',
    '.sis-tag{display:inline-block;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:bold;background:#fde7d7;color:#c4561a}',
    '.sis-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(40,30,25,.45);display:flex;align-items:center;justify-content:center;padding:16px;animation:sisfade .2s}',
    '.sis-modal{position:relative;width:100%;max-width:440px;background:#fff;border-radius:16px;padding:28px 24px 22px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.18);animation:sispop .25s}',
    '.sis-modal h3{margin:6px 0 8px;font-size:21px;line-height:1.4;color:#333}',
    '.sis-modal p{margin:6px 0;font-size:14px}',
    '.sis-x{position:absolute;top:8px;right:10px;width:36px;height:36px;border:0;background:none;font-size:24px;color:#999;cursor:pointer}',
    '.sis-list{list-style:none;margin:14px 0;padding:0;text-align:left}',
    '.sis-list li{position:relative;padding:8px 10px 8px 34px;margin:6px 0;background:#fff7f0;border-radius:8px;font-size:14px}',
    '.sis-list li:before{content:"✓";position:absolute;left:12px;top:8px;color:' + ORANGE + ';font-weight:bold}',
    '.sis-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:2147482000;width:calc(100% - 24px);max-width:560px;background:#fff;border:1px solid #f0c9a8;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.15);padding:14px 44px 14px 16px;display:flex;gap:12px;align-items:center;animation:sisup .3s}',
    '.sis-toast img{width:56px;height:56px;object-fit:cover;border-radius:8px;flex:none}',
    '.sis-toast .sis-x{top:4px;right:4px}',
    '.sis-sec{margin:24px auto;max-width:1200px;padding:18px;border:1px solid #f0d8c4;border-radius:14px;background:#fffaf6}',
    '.sis-sec h4{margin:0 0 12px;font-size:17px;color:#333;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.sis-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}',
    '.sis-grid.sis-4>:nth-child(n+5){display:none}',
    '.sis-card{display:block;background:#fff;border-radius:10px;overflow:hidden;text-decoration:none!important;color:#333!important;border:1px solid #eee;font-size:12px}',
    '.sis-card img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;background:#f6f6f6}',
    '.sis-card .sis-cn{padding:6px 8px 2px;height:3.2em;overflow:hidden;line-height:1.6}',
    '.sis-card .sis-cp{padding:0 8px 8px;font-weight:bold;color:#c4561a;font-size:14px}',
    '.sis-card .sis-add{display:block;margin:0 8px 8px;padding:6px;border-radius:999px;border:1px solid ' + ORANGE + ';color:' + ORANGE + ';background:#fff;font-size:12px;cursor:pointer;width:calc(100% - 16px)}',
    '.sis-bar{height:8px;background:#f1e4da;border-radius:99px;overflow:hidden;min-width:140px;flex:1;max-width:260px}',
    '.sis-bar i{display:block;height:100%;background:linear-gradient(90deg,#f6a463,' + ORANGE + ');border-radius:99px}',
    '.sis-fab{position:fixed;right:16px;bottom:88px;z-index:2147481000;width:76px;height:76px;border-radius:50%;background:#fff;border:3px solid ' + ORANGE + ';color:' + ORANGE + ';font-weight:bold;font-size:13px;line-height:1.2;cursor:pointer;box-shadow:0 6px 18px rgba(238,120,50,.35);animation:sisbob 2.4s infinite}',
    '.sis-ticket{display:inline-flex;align-items:center;gap:10px;border:2px dashed ' + ORANGE + ';border-radius:10px;padding:8px 14px;background:#fff;font-weight:bold}',
    '.sis-ticket code{font-size:18px;letter-spacing:.08em;color:#c4561a;font-family:inherit}',
    '.sis-pending{color:#999!important;font-size:13px!important;font-weight:normal;letter-spacing:0!important}',
    '.sis-badge{display:inline-block;margin:6px 0;padding:3px 10px;border-radius:4px;background:#e8473b;color:#fff;font-size:13px;font-weight:bold}',
    '.sis-note{font-size:12px;color:#888;margin-top:8px}',
    '.sis-chip{position:fixed;left:10px;bottom:10px;z-index:2147483600;padding:6px 12px;border-radius:999px;background:#fff;border:1px solid #ccc;font-size:12px;color:#555;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.12)}',
    '.sis-panel{position:fixed;left:10px;bottom:46px;z-index:2147483600;width:340px;max-height:70vh;overflow:auto;background:#fff;border:1px solid #ddd;border-radius:12px;padding:12px;font-size:12px;box-shadow:0 6px 24px rgba(0,0,0,.15)}',
    '.sis-panel table{width:100%;border-collapse:collapse}.sis-panel td{padding:3px 4px;border-bottom:1px solid #f1f1f1;vertical-align:top}',
    '.sis-cd{font-variant-numeric:tabular-nums;font-weight:bold;color:#c4561a;font-size:16px}',
    '.sis-rank{display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:999px;background:#fde7d7;color:#a2481a;font-weight:bold}',
    '.sis-coord{display:grid;grid-template-columns:200px 1fr;gap:16px;align-items:start}',
    '.sis-coord>img{width:100%;border-radius:10px}',
    '.sis-coord .sis-grid{grid-template-columns:repeat(3,1fr)}',
    '.sis-size-hint{margin:8px 0;padding:8px 12px;border-radius:8px;background:#fff7f0;border:1px solid #f6d3b8;font-size:13px}',
    '.sis-size-hint a{color:#c4561a;font-weight:bold}',
    '.sis-memo-on{outline:3px solid ' + ORANGE + '!important;outline-offset:2px}',
    '.sis-kuji{display:flex;gap:10px;justify-content:center;margin:16px 0}',
    '.sis-kuji button{width:96px;height:120px;border-radius:12px;border:2px solid ' + ORANGE + ';background:#fff7f0;font-size:34px;cursor:pointer;transition:transform .5s}',
    '.sis-kuji button.sis-open{transform:rotateY(180deg);background:#fff}',
    '.sis-x2{text-align:right;font-size:11px;color:#aaa}',
    '@keyframes sisfade{from{opacity:0}to{opacity:1}}@keyframes sispop{from{transform:scale(.94);opacity:0}to{transform:none;opacity:1}}',
    '@keyframes sisup{from{transform:translate(-50%,20px);opacity:0}to{transform:translate(-50%,0);opacity:1}}',
    '@keyframes sisbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}',
    '.sis-shipfix{position:fixed;left:0;right:0;bottom:0;z-index:2147481500;background:#fff7f0;border-top:1px solid #f6d3b8;box-shadow:0 -2px 10px rgba(0,0,0,.06);padding-right:40px}',
    '.sis-alert{position:fixed;right:16px;bottom:16px;z-index:2147482500;width:320px;max-width:calc(100% - 24px);background:#fff;border:1px solid #f0c9a8;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.15);padding:12px 36px 12px 12px;display:flex;gap:10px;align-items:center;animation:sisslide .3s;transition:opacity .4s}',
    '.sis-alert img{width:60px;height:60px;object-fit:cover;border-radius:8px;flex:none}',
    '@keyframes sisslide{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}',
    '.sis-sp .sis-grid{grid-template-columns:repeat(2,1fr)}',
    '.sis-sp .sis-sec{margin:16px 10px;padding:14px}',
    '.sis-sp .sis-strip{font-size:13px;padding:8px 10px;gap:8px}',
    '.sis-sp .sis-coord{grid-template-columns:1fr}',
    '.sis-sp .sis-coord .sis-grid{grid-template-columns:repeat(3,1fr)}',
    '.sis-sp .sis-modal h3{font-size:19px}',
    '.sis-sp .sis-fab{bottom:76px;width:68px;height:68px;font-size:12px}'
  ].join('\n');
  function style() { if (D.getElementById('sis-css')) return; var s = D.createElement('style'); s.id = 'sis-css'; s.textContent = css + (Q.get('sis_noanim') === '1' ? '\n.sis-root,.sis-root *{animation:none!important;transition:none!important}' : ''); D.head.appendChild(s); D.documentElement.classList.add(SP ? 'sis-sp' : 'sis-pc'); }

  /* ---------- 部品 ---------- */
  var mainEl = function () { return D.querySelector('main.pane-main, main, .pane-main, #main, .pane-contents') || D.body; };
  var stripBox;
  function strip(id, html) {
    if (!stripBox) { stripBox = h('<div class="sis-root" id="sis-strips"></div>'); var m = mainEl(); m.insertBefore(stripBox, m.firstChild); }
    var old = D.getElementById('sis-s-' + id); if (old) old.remove();
    var el = h('<div class="sis-strip" id="sis-s-' + id + '">' + html + '</div>');
    stripBox.appendChild(el); SIS.active[id] = 'on'; return el;
  }
  var modalOpen = false;
  function modal(id, html, opt) {
    if (modalOpen && !(opt && opt.force)) return null;
    modalOpen = true; SIS.active[id] = 'on';
    var ov = h('<div class="sis-root sis-ov" id="sis-m-' + id + '"><div class="sis-modal" role="dialog" aria-modal="true"><button class="sis-x" aria-label="閉じる">×</button>' + html + '</div></div>');
    function close(why) { ov.remove(); modalOpen = false; track(id, 'close', { sis_label: why || 'x' }); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close('outside'); });
    ov.querySelector('.sis-x').onclick = function () { close('x'); };
    ov.querySelectorAll('[data-sis-close]').forEach(function (b) { b.onclick = function () { close(b.getAttribute('data-sis-close')); }; });
    D.body.appendChild(ov); track(id, 'impression'); ov.sisClose = close; return ov;
  }
  function toast(id, html) {
    var old = D.getElementById('sis-t-' + id); if (old) old.remove();
    var el = h('<div class="sis-root sis-toast" id="sis-t-' + id + '"><button class="sis-x" aria-label="閉じる">×</button>' + html + '</div>');
    el.querySelector('.sis-x').onclick = function () { el.remove(); track(id, 'close'); };
    D.body.appendChild(el); SIS.active[id] = 'on'; track(id, 'impression'); return el;
  }
  function section(id, html, where, pos) {
    var old = D.getElementById('sis-sec-' + id); if (old) old.remove();
    var el = h('<section class="sis-root sis-sec" id="sis-sec-' + id + '">' + html + '</section>');
    if (where && where.parentNode) { if (pos === 'before') where.parentNode.insertBefore(el, where); else if (pos === 'prepend') where.insertBefore(el, where.firstChild); else where.parentNode.insertBefore(el, where.nextSibling); }
    else { var m = mainEl(); m.appendChild(el); }
    SIS.active[id] = 'on'; track(id, 'impression'); return el;
  }
  function card(g, opt) {
    return '<a class="sis-card" href="' + esc(g.href) + '" data-sis-goods="' + esc(g.code) + '">' + (g.img ? '<img src="' + esc(g.img) + '" alt="" onerror="var c=this.closest(\'.sis-card\');if(c)c.remove()">' : '<img alt="">') +
      '<div class="sis-cn">' + esc(g.name) + '</div><div class="sis-cp">' + (g.price ? yen(g.price) : '') + '</div>' +
      (opt && opt.add ? '<button type="button" class="sis-add" data-sis-add="' + esc(g.code) + '">カートに入れる</button>' : '') + '</a>';
  }

  /* ---------- 店舗データ（実データ） ---------- */
  var cartP = null;
  function headerCount() { var e = D.querySelector('.block-headernav--cart-count, .js-cart-count'); return e ? num(e.textContent) : null; }
  function parseCartPage(d) { // カート画面（PC・スマホ共通の部品名）から読む
    var items = [];
    d.querySelectorAll('.block-cart--goods-list-item').forEach(function (it) {
      var box = it.closest('.block-cart--goods-list-item-container, .js-enhanced-ecommerce-item') || it.parentNode;
      var a = box.querySelector('a[href*="/shop/g/g"]') || (box.parentNode && box.parentNode.querySelector('a[href*="/shop/g/g"]'));
      var img = (box.parentNode || box).querySelector('.block-cart--goods-list-image img, img[src*="/img/goods/"]');
      var qEl = it.querySelector('.block-cart--goods-list-item-qty, input[name*="qty"], select');
      var vEl = it.querySelector('.block-cart--goods-list-item-comment');
      var price = num((it.querySelector('.block-cart--goods-list-item-price') || {}).textContent);
      var qty = qEl ? (num(qEl.value || qEl.textContent) || 1) : 1;
      items.push({ name: ((it.querySelector('.block-cart--goods-list-item-name') || {}).textContent || '').replace(/\s+/g, ' ').trim(), href: a ? a.getAttribute('href') : '', code: codeOf(a && a.getAttribute('href')),
        variation: vEl ? vEl.textContent.replace(/\s+/g, ' ').trim() : '', qty: qty, amt: price * qty, img: img ? img.getAttribute('src') : '' });
    });
    var sub = num((d.querySelector('.block-cart--subtotal-price') || {}).textContent);
    var total = sub || items.reduce(function (s, i) { return s + i.amt; }, 0);
    var snap = { items: items, total: total, count: items.reduce(function (s, i) { return s + i.qty; }, 0), at: Date.now() };
    ls('cartSnap', snap); return snap;
  }
  function cart(force) {
    if (cartP && !force) return cartP;
    if (PAGE === 'cart') { cartP = Promise.resolve(parseCartPage(D)); return cartP; }
    cartP = get('/shop/js/cart.aspx', 6000).then(function (html) {
      var d = parseDoc('<div>' + html + '</div>'), items = [];
      d.querySelectorAll('.block-jscart--items').forEach(function (it) {
        var a = it.querySelector('.block-jscart--name a');
        items.push({ name: a ? a.textContent.trim() : '', href: a ? a.getAttribute('href') : '', code: codeOf(a && a.getAttribute('href')),
          variation: (it.querySelector('.variation-name') || {}).textContent || '', qty: num((it.querySelector('.block-jscart--qty') || {}).textContent) || 1,
          amt: num((it.querySelector('.block-jscart--amt') || {}).textContent) });
      });
      if (items.length) return { items: items, total: items.reduce(function (s, i) { return s + i.amt; }, 0), count: items.reduce(function (s, i) { return s + i.qty; }, 0) };
      // スマホ版は軽いカート断片が空で返るため、ヘッダーの点数と、カート画面で読んだ内容を使う
      var hc = headerCount();
      if (!hc) return { items: [], total: 0, count: 0 };
      var snap = ls('cartSnap');
      if (snap && snap.count === hc && Date.now() - snap.at < 6 * 3600e3) return snap;
      return get('/shop/cart/cart.aspx', 8000).then(function (h2) { return parseCartPage(parseDoc(h2)); });
    }).catch(function () { return { items: [], total: 0, count: 0, error: true }; });
    return cartP;
  }
  function addToCart(code) {
    var fd = new FormData(); fd.append('goods', code);
    return fetch('/shop/cart/cart.aspx', { method: 'POST', body: fd, credentials: 'include' }).then(function () { cartP = null; });
  }
  function listItems(doc) {
    var out = [], seen = {};
    doc.querySelectorAll('a[href*="/shop/g/g"]').forEach(function (a) {
      var code = codeOf(a.getAttribute('href')); if (!code || seen[code]) return;
      var img = a.querySelector('img'); if (!img) return;
      var box = a.parentNode, up = 0;
      while (box && box.parentNode && !/[￥¥]\s?[\d,]+/.test(box.textContent) && up++ < 6) box = box.parentNode;
      var txt = box.textContent.replace(/\s+/g, ' ');
      var nameEl = box.querySelector('[class*="goods-name"], [class*="--name"]');
      var name = (nameEl ? nameEl.textContent : img.getAttribute('alt') || '').replace(/\s+/g, ' ').trim();
      var price = 0, re = /(通常価格\s*)?[￥¥]\s?([\d,]+)/g, m;
      while ((m = re.exec(txt))) { if (!m[1]) { price = num(m[2]); break; } }
      seen[code] = 1;
      out.push({ code: code, href: '/shop/g/g' + code + '/', name: name, price: price, img: img.getAttribute('data-src') || img.getAttribute('src'), sale: /通常価格/.test(txt) });
    });
    return out;
  }
  var goodsCache = {};
  function goodsInfo(code) {
    if (goodsCache[code]) return goodsCache[code];
    goodsCache[code] = get('/shop/g/g' + code + '/', 8000).then(function (html) {
      var d = parseDoc(html);
      var og = d.querySelector('meta[property="og:image"]');
      var gi = d.querySelector('.block-goods-gallery img, .block-goods-detail img');
      var img = og ? og.getAttribute('content') : gi ? gi.getAttribute('src') : '';
      var name = ((d.querySelector('.block-goods-name, h1') || {}).textContent || '').replace(/\s+/g, ' ').trim();
      var ca = d.querySelector('.block-color--item.active'), color = ca ? ca.getAttribute('title') || '' : '';
      var size = ((d.querySelector('.block-size--item.active') || {}).textContent || '').trim();
      var stock = ((d.querySelector('#spec_stock_msg') || {}).textContent || '').trim();
      return { code: code, href: '/shop/g/g' + code + '/', name: name, color: color, size: size, img: img,
        price: num((d.querySelector('.block-goods-price--price') || {}).textContent), stock: stock, soldout: /×|在庫なし|売り切れ/.test(stock) };
    }).catch(function () { return null; });
    return goodsCache[code];
  }
  function saleCount() { return get(SHOP.salePage, 8000).then(function (html) { return num((parseDoc(html).querySelector('.pager-count') || {}).textContent); }).catch(function () { return 0; }); }
  function bindAdd(root) {
    root.querySelectorAll('[data-sis-add]').forEach(function (b) {
      b.onclick = function (e) {
        e.preventDefault(); e.stopPropagation(); b.disabled = true; b.textContent = '追加中…';
        track(root.id.replace(/^sis-(sec|t|m)-/, ''), 'add_to_cart', { sis_label: b.getAttribute('data-sis-add') });
        addToCart(b.getAttribute('data-sis-add')).then(function () { L.href = '/shop/cart/cart.aspx'; });
      };
    });
  }

  /* ============================================================
     施策
     ============================================================ */
  var FX = {};

  /* 1. ポップアップ枠（優先度つき・全ポップアップ共通で1人◯時間に1回まで） */
  var PC = C.popup || {};
  function popupRecent() { var t = ls('popupAt'); return !!t && Date.now() - t < (PC.capHours || 24) * 3600e3; }
  function deadlineById(id) { return activeDeadlines().filter(function (x) { return x.d.id === id; })[0]; }
  function popupContext() {
    var need = (PC.rules || []).some(function (r) { return r.cart != null; });
    return (need ? cart() : Promise.resolve(null)).then(function (c) { return { src: source(), visits: visits, isNew: isNew, cart: c, rank: ((D.getElementById('customer-rank') || {}).textContent || Q.get('sis_rank') || '').trim() }; });
  }
  function ruleMatch(r, x) {
    if (r.off) return false;
    if (r.pages && r.pages.indexOf(PAGE) < 0) return false;
    if (r.source && r.source.indexOf(x.src) < 0) return false;
    if (r.notSource && r.notSource.indexOf(x.src) >= 0) return false;
    if (r.visitsMax && x.visits > r.visitsMax) return false;
    if (r.visitsMin && x.visits < r.visitsMin) return false;
    if (r.deadline && !deadlineById(r.deadline)) return false;
    if (r.from && now() < new Date(r.from)) return false;
    if (r.to && now() > new Date(r.to)) return false;
    if (r.cart === true && !(x.cart && x.cart.count)) return false;
    if (r.cart === false && x.cart && x.cart.count) return false;
    if (r.rank && !r.rank.some(function (n) { return x.rank.indexOf(n) >= 0; })) return false;
    if (r.type === 'coupon' && !coupon(r.coupon)) return false;
    return true;
  }
  var POP = {
    line: function (r) {
      var v = ab('welcome');
      var head = v === 'B' ? '新作とシークレットセールを<br>LINEでいち早く' : 'LINE友だち追加で<br>500円OFFクーポン';
      return { html: '<span class="sis-tag">' + esc(r.tag || 'はじめての方へ') + '</span><h3>' + head + '</h3>' +
        '<ul class="sis-list"><li>' + esc(SHOP.linePerk || '') + '</li><li>お誕生月にバースデークーポン</li><li>友だち限定シークレットセールのご案内</li></ul>' +
        '<p><a class="sis-btn sis-line" href="' + esc(SHOP.lineUrl) + '" target="_blank" rel="noopener" data-sis="go">LINEで友だち追加</a></p>' +
        '<div class="sis-x2">ABテスト ' + v + '</div>', goal: 'line_click' };
    },
    sale: function (r) {
      var dl = deadlineById(r.deadline), end = dl ? dl.end : null;
      var endTxt = end ? (end.getHours() === 0 ? (new Date(end - 1).getMonth() + 1) + '/' + new Date(end - 1).getDate() + ' 23:59' : (end.getMonth() + 1) + '/' + end.getDate() + ' ' + end.toTimeString().slice(0, 5)) : '';
      return { html: '<span class="sis-tag">' + esc(r.tag || '開催中') + '</span><h3>' + esc(r.title || SHOP.saleName) + '</h3>' +
        (endTxt ? '<p>' + endTxt + ' まで　残り <span class="sis-cd" data-end="' + (+end) + '">--:--:--</span></p>' : '') +
        (r.text ? '<p>' + esc(r.text) + '</p>' : '') +
        '<p style="margin-top:14px"><a class="sis-btn" href="' + esc(r.url || SHOP.salePage) + '" data-sis="go">セール会場を見る</a></p>', goal: 'click' };
    },
    coupon: function (r) {
      var c = coupon(r.coupon);
      return { html: '<span class="sis-tag">' + esc(r.tag || 'あなたへのクーポン') + '</span><h3>' + esc(r.title || c.title || 'クーポン') + '</h3>' +
        '<p style="margin:12px 0">' + ticket(c) + '</p>' + (c.expiresLabel ? '<p class="sis-note">有効期限 ' + esc(c.expiresLabel) + '</p>' : '') +
        '<p style="margin-top:10px"><a class="sis-btn" href="' + esc(r.url || SHOP.salePage) + '" data-sis="go">お買い物を続ける</a></p>', goal: 'click' };
    }
  };
  FX.popup = function (forced) {
    if (!forced && (PAGE === 'order' || PAGE === 'cart' || popupRecent())) return;
    popupContext().then(function (x) {
      var rules = PC.rules || [], r = null;
      if (typeof forced === 'string') r = rules.filter(function (q) { return q.id === forced || q.type === forced; })[0];
      if (!r) r = rules.filter(function (q) { return ruleMatch(q, x); })[0];
      if (!r || !POP[r.type]) return;
      setTimeout(function () {
        var c = POP[r.type](r);
        var m = modal('popup', c.html + '<p><button class="sis-btn sis-ghost" data-sis-close="later" style="padding:8px 18px;font-size:13px">閉じる</button></p>', { force: !!forced });
        if (!m) return; ls('popupAt', Date.now()); track('popup', 'show', { sis_label: r.id });
        var go = m.querySelector('[data-sis="go"]'); if (go) go.onclick = function () { track('popup', c.goal, { sis_label: r.id }); };
        var cd = m.querySelector('.sis-cd[data-end]'); if (cd) { var tk = function () { var ms = +cd.getAttribute('data-end') - now(); if (ms < 0) ms = 0; var s = Math.floor(ms / 1000); cd.textContent = (s >= 86400 ? Math.floor(s / 86400) + '日 ' : '') + String(Math.floor(s % 86400 / 3600)).padStart(2, '0') + ':' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }; tk(); setInterval(tk, 1000); }
      }, forced ? 0 : (PC.delaySec || 3) * 1000);
    });
  };
  FX.welcome = function (forced) { if (forced) FX.popup('line'); };

  /* 2. 離脱時ポップアップ */
  FX.exit = function (forced) {
    if (!forced && (PAGE === 'order' || PAGE === 'cart' || ss('exitShown'))) return;
    function fire() {
      if ((ss('exitShown') || popupRecent()) && !forced) return; ss('exitShown', 1); ls('popupAt', Date.now());
      Promise.all([cart(), saleCount()]).then(function (r) {
        var c = r[0], n = r[1], body;
        if (c.count > 0) {
          var rest = (SHOP.freeShipping || 0) - c.total;
          body = '<span class="sis-tag">お買い忘れはありませんか？</span><h3>カートに' + c.count + '点<br>（' + yen(c.total) + '）入っています</h3>' +
            '<p>' + c.items.slice(0, 2).map(function (i) { return esc(i.name) + ' <span style="color:#888;font-size:12px">' + esc(i.variation.trim()) + '</span>'; }).join('<br>') + (c.items.length > 2 ? '<br>ほか' : '') + '</p>' +
            (rest > 0 ? '<p>あと<b style="color:#c4561a">' + yen(rest) + '</b>で送料無料です</p>' : '<p><b style="color:#c4561a">送料無料ライン達成中</b>です</p>') +
            '<p style="margin-top:14px"><a class="sis-btn" href="/shop/cart/cart.aspx" data-sis="go">カートを見る</a></p>';
        } else {
          body = '<span class="sis-tag">開催中</span><h3>' + esc(SHOP.saleName) + '</h3>' +
            (n ? '<p>ただいま<b style="color:#c4561a;font-size:20px"> ' + n + '点 </b>がセール価格です</p>' : '') +
            '<p style="margin-top:14px"><a class="sis-btn" href="' + esc(SHOP.salePage) + '" data-sis="go">セール会場を見る</a></p>';
        }
        var m = modal('exit', body + '<p><button class="sis-btn sis-ghost" data-sis-close="later" style="padding:8px 18px;font-size:13px">閉じる</button></p>', { force: forced });
        if (m) m.querySelector('[data-sis="go"]').onclick = function () { track('exit', 'click', { sis_label: c.count ? 'cart' : 'sale' }); };
      });
    }
    if (forced) return fire();
    var armedAt = Date.now() + (SP ? 15000 : 8000);
    if (!SP) D.addEventListener('mouseout', function (e) { if (!e.relatedTarget && e.clientY <= 5 && Date.now() > armedAt) fire(); });
    else { var lastY = scrollY, lastT = Date.now(); addEventListener('scroll', function () { var t = Date.now(); if (t > armedAt && lastY - scrollY > 500 && t - lastT < 500) fire(); if (t - lastT > 300) { lastY = scrollY; lastT = t; } }, { passive: true }); }
  };

  /* 3. 流入元別の出し分け */
  function source() {
    var ttl = ((C.source || {}).ttlHours || 24) * 3600e3, st = ls('src');
    var u = (Q.get('sis_src') || Q.get('utm_source') || '').toLowerCase(), r = D.referrer.toLowerCase();
    var ext = r && r.indexOf(L.hostname) < 0;
    var fresh = /line/.test(u) || ext && /line\.me|liff/.test(r) ? 'line' : /insta|ig/.test(u) || ext && /instagram/.test(r) ? 'instagram' : /qr|store|shop|tenpo/.test(u) ? 'qr' : u ? 'other' : null;
    if (fresh) { st = { s: fresh, t: Date.now() }; ls('src', st); }
    return st && Date.now() - st.t < ttl ? st.s : 'other';
  }
  FX.source = function () {
    var s = source(), msg = {
      line: '<span class="sis-tag">LINEからお越しの方へ</span> <b>' + esc(SHOP.saleName) + '</b> 開催中。トークでお知らせした商品もこちらから <a class="sis-btn" href="' + esc(SHOP.salePage) + '">セール会場へ</a>',
      instagram: '<span class="sis-tag">Instagramからお越しの方へ</span> 投稿で紹介したコーデは <b>スタッフおすすめコーデ</b> にまとめています <a class="sis-btn" href="' + esc(SHOP.coordPage) + '">コーデを見る</a>',
      qr: '<span class="sis-tag">店舗からお越しの方へ</span> WEBSHOPは <b>' + yen(SHOP.freeShipping) + '（税込）以上で送料無料</b>。店頭にないサイズ・カラーもこちらで <a class="sis-btn" href="' + esc(SHOP.newPage) + '">新作を見る</a>'
    }[s];
    if (!msg) return;
    var el = strip('source', msg); track('source', 'impression', { sis_label: s });
    el.querySelectorAll('a').forEach(function (a) { a.onclick = function () { track('source', 'click', { sis_label: s }); }; });
  };

  /* 4. 入店時クーポン表示 */
  function coupon(id) {
    var c = (C.coupons || []).filter(function (x) { return x.id === id; })[0];
    if (!c) return null; if (c.code) return c; return DEMO ? c : null;
  }
  function ticket(c) {
    return '<span class="sis-ticket">' + (c.value ? esc(c.value) + ' ' : '') + 'クーポンコード ' +
      (c.code ? '<code>' + esc(c.code) + '</code><button type="button" class="sis-btn sis-ghost" style="padding:3px 10px;font-size:12px" data-sis-copy="' + esc(c.code) + '">コピー</button>'
        : '<code class="sis-pending">BOで発行後に表示</code>') + '</span>';
  }
  FX.coupon = function (forced) {
    if (PAGE === 'order') return;
    var list = (C.coupons || []).filter(function (c) {
      if (/^kuji/.test(c.id)) return false;
      if (c.expires && now() > new Date(c.expires)) return false;
      if (c.audience === 'new' && !isNew) return false;
      if (c.audience === 'repeat' && isNew) return false;
      return c.code || DEMO;
    });
    if (!list.length) return;
    var c = list[0];
    var el = strip('coupon', '<span class="sis-tag">ご来店クーポン</span> <span>' + esc(c.title || '') + '</span> ' + ticket(c) + (c.expiresLabel ? ' <span style="font-size:12px;color:#888">有効期限 ' + esc(c.expiresLabel) + '</span>' : ''));
    var b = el.querySelector('[data-sis-copy]'); if (b) b.onclick = function () { try { navigator.clipboard.writeText(b.getAttribute('data-sis-copy')); } catch (e) {} b.textContent = 'コピーしました'; track('coupon', 'copy', { sis_label: c.code }); };
    track('coupon', 'impression', { sis_label: c.code || c.id });
  };

  /* 5. あと○円で送料無料・ノベルティのバー（カートに入れた人だけ、全ページの下に固定） */
  function bottomOffset() {
    var off = 0;
    [].slice.call(D.querySelectorAll('body *')).forEach(function (el) {
      if (el.closest('.sis-root')) return;
      var cs = getComputedStyle(el); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return;
      var rc = el.getBoundingClientRect(); if (rc.width < innerWidth * 0.6 || rc.height > 160 || rc.bottom < innerHeight - 2) return;
      off = Math.max(off, innerHeight - rc.top);
    });
    return off;
  }
  FX.shipbar = function () {
    var cfg = C.shipbar || {};
    if (PAGE === 'order' || PAGE === 'cart' || ss('shipbarClosed')) return;
    cart().then(function (c) {
      if (c.error || (!c.count && !cfg.showWhenEmpty)) return;
      var free = SHOP.freeShipping || 0, nov = C.novelty || {};
      var rest = free - c.total, pct = Math.min(100, Math.round(c.total / free * 100));
      var html = rest > 0 ? '<span>🚚 あと <b>' + yen(rest) + '</b> で送料無料</span><span class="sis-bar"><i style="width:' + pct + '%"></i></span><span style="font-size:12px;color:#888">カート ' + yen(c.total) + '</span>'
        : '<span>🎉 <b>送料無料ライン達成</b>（カート ' + yen(c.total) + '）</span>';
      if (nov.on) { var nr = nov.threshold - c.total; html += nr > 0 ? ' <span>／ あと <b>' + yen(nr) + '</b> で ' + esc(nov.label) + '</span>' : ' <span>／ <b>' + esc(nov.label) + '</b> 対象</span>'; }
      html += ' <a class="sis-btn" href="/shop/cart/cart.aspx" style="padding:4px 12px;font-size:12px">カートへ</a>';
      if (cfg.position === 'top') { strip('shipbar', html); }
      else {
        var old = D.getElementById('sis-shipfix'); if (old) old.remove();
        var el = h('<div class="sis-root sis-shipfix" id="sis-shipfix"><div class="sis-strip" style="border:0;background:transparent">' + html + '</div><button class="sis-x" aria-label="閉じる" style="top:50%;transform:translateY(-50%)">×</button></div>');
        el.querySelector('.sis-x').onclick = function () { el.remove(); ss('shipbarClosed', 1); track('shipbar', 'close'); };
        D.body.appendChild(el); el.style.bottom = bottomOffset() + 'px'; SIS.active.shipbar = 'on';
      }
      track('shipbar', 'impression', { sis_value: c.total });
    });
  };

  /* 6. 期限のカウントダウン（実在の期限だけ） */
  function activeDeadlines() {
    var t = now(), out = [];
    (C.deadlines || []).forEach(function (d) {
      if (d.rule === 'monthlyDays') {
        var day = t.getDate(); if (d.days.indexOf(day) < 0) return;
        var last = day; while (d.days.indexOf(last + 1) >= 0) last++;
        var end = new Date(t.getFullYear(), t.getMonth(), last, 0, 0, 0); end.setHours(d.endHour || 24);
        out.push({ d: d, end: end });
      } else if (d.end) { var e = new Date(d.end), s = d.start ? new Date(d.start) : null; if (t < e && (!s || t >= s)) out.push({ d: d, end: e }); }
    });
    (C.coupons || []).forEach(function (c) { if (c.code && c.expires) { var e = new Date(c.expires); if (now() < e) out.push({ d: { id: c.id, text: (c.value || '') + 'クーポン「' + c.code + '」' }, end: e }); } });
    return out;
  }
  FX.countdown = function () {
    if (PAGE === 'order') return;
    var list = activeDeadlines(); if (!list.length) return;
    list.sort(function (p, q) { return p.end - q.end; });
    var x = list[0];
    var md = (x.end.getMonth() + 1) + '/' + x.end.getDate();
    var endLabel = x.end.getHours() === 0 ? (new Date(x.end - 1).getMonth() + 1) + '/' + new Date(x.end - 1).getDate() + ' 23:59' : md + ' ' + x.end.toTimeString().slice(0, 5);
    var el = strip('countdown', '<span>⏰ <b>' + esc(x.d.text) + '</b>は ' + endLabel + ' まで</span><span>残り <span class="sis-cd">--:--:--</span></span>' + (x.d.url ? ' <a class="sis-btn" href="' + esc(x.d.url) + '">詳しく</a>' : ''));
    var cd = el.querySelector('.sis-cd');
    function tick() {
      var ms = x.end - now(); if (ms <= 0) { el.remove(); return; }
      var s = Math.floor(ms / 1000), dd = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), mm = Math.floor(s % 3600 / 60), sc = s % 60;
      cd.textContent = (dd ? dd + '日 ' : '') + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':' + String(sc).padStart(2, '0');
    }
    tick(); setInterval(tick, 1000); track('countdown', 'impression', { sis_label: x.d.id });
  };

  /* 7. くじ演出 */
  FX.kuji = function (forced) {
    var prizes = (C.coupons || []).filter(function (c) { return /^kuji/.test(c.id) && (c.code || DEMO); });
    if (!prizes.length) return;
    var today = now().toISOString().slice(0, 10);
    if (!forced && (PAGE === 'order' || ls('kujiDay') === today)) return;
    function open() {
      var m = modal('kuji', '<span class="sis-tag">1日1回</span><h3>ご来店くじ</h3><p>どれか1枚えらんでください</p><div class="sis-kuji"><button>？</button><button>？</button><button>？</button></div><div id="sis-kuji-r"></div>', { force: true });
      if (!m) return; var fab = D.getElementById('sis-fab-kuji'); if (fab) fab.remove();
      m.querySelectorAll('.sis-kuji button').forEach(function (b) {
        b.onclick = function () {
          if (m.dataset.done) return; m.dataset.done = 1; ls('kujiDay', today);
          var sum = prizes.reduce(function (s, p) { return s + (p.weight || 1); }, 0), r = Math.random() * sum, win = prizes[0];
          for (var i = 0; i < prizes.length; i++) { r -= prizes[i].weight || 1; if (r <= 0) { win = prizes[i]; break; } }
          b.classList.add('sis-open'); b.textContent = '🎉';
          setTimeout(function () {
            m.querySelector('#sis-kuji-r').innerHTML = '<p><b style="font-size:18px;color:#c4561a">' + esc(win.value || 'クーポン') + ' があたりました</b></p><p>' + ticket(win) + '</p><p class="sis-note">ご注文手続きの画面でコードを入力してください</p>';
            track('kuji', 'draw', { sis_label: win.id });
          }, 500);
        };
      });
    }
    if (forced) return open();
    if ((ss('pv') || 1) < 2) return;
    var fab = h('<button class="sis-root sis-fab" id="sis-fab-kuji">ご来店<br>くじ</button>');
    fab.onclick = function () { track('kuji', 'fab_click'); open(); };
    D.body.appendChild(fab); SIS.active.kuji = 'on'; track('kuji', 'impression');
  };

  /* 8. 会員ランク別UI */
  function readRank() {
    return new Promise(function (res) {
      if (Q.get('sis_rank')) return res({ name: Q.get('sis_rank'), preview: true });
      var tries = 0; (function poll() {
        var t = ((D.getElementById('customer-rank') || {}).textContent || '').trim();
        if (t) return res({ name: t });
        if (++tries > 12) return res(null); setTimeout(poll, 250);
      })();
    });
  }
  FX.rank = function () {
    if (PAGE === 'order') return;
    readRank().then(function (r) {
      if (!r) return;
      var ranks = C.ranks || [], i = -1;
      ranks.forEach(function (x, k) { if (r.name.indexOf(x.name) >= 0 && i < 0) i = k; });
      if (i < 0) return;
      var me = ranks[i], up = ranks[i - 1];
      var perks = [];
      if (me.monthly) perks.push('毎月の特別クーポン <b>' + esc(me.monthly) + '</b>');
      if (me.pointDay) perks.push('22・23日はポイント <b>' + esc(me.pointDay) + '</b>');
      perks.push('お誕生日クーポン <b>' + esc(me.birthday) + '</b>');
      var html = '<span class="sis-rank">🐷 ' + esc(me.name) + '</span><span>' + perks.join('／') + '</span>' +
        (up ? '<span style="font-size:12px;color:#888">次は「' + esc(up.name) + '」（3ヶ月で' + yen(up.min) + '以上）</span>' : '') +
        ' <a class="sis-btn" href="' + esc(SHOP.rankPage) + '">特典を見る</a>';
      strip('rank', html); track('rank', 'impression', { sis_label: me.name });
    });
  };

  /* 9. 新規・リピーターでトップを変える */
  FX.newRepeat = function () {
    if (PAGE !== 'top') return Promise.resolve(false);
    var slider = D.getElementById('block_of_top_body') || mainEl().firstElementChild;
    if (isNew) {
      section('newRepeat', '<h4><span class="sis-tag">はじめての方へ</span>drug store\'s WEBSHOPのお買い物ガイド</h4>' +
        '<div class="sis-grid" style="grid-template-columns:repeat(' + (SP ? 1 : 3) + ',1fr)">' +
        '<a class="sis-card" style="padding:14px;font-size:14px" href="/shop/pages/guide.aspx#guide_07"><b style="color:#c4561a">🚚 送料</b><br>商品代金' + yen(SHOP.freeShipping) + '（税込）以上で送料無料</a>' +
        '<a class="sis-card" style="padding:14px;font-size:14px" href="' + esc(SHOP.rankPage) + '"><b style="color:#c4561a">🐷 会員ランク</b><br>お買い物金額に応じてクーポン・ポイントがアップ</a>' +
        '<a class="sis-card" style="padding:14px;font-size:14px" href="' + esc(SHOP.linePage) + '"><b style="color:#c4561a">💬 LINE</b><br>' + esc(SHOP.linePerk) + '</a>' +
        '</div>', slider, 'after');
      return Promise.resolve(true);
    } else {
      var hist = D.getElementById('block_of_itemhistory');
      var mine = (ls('viewed') || []).slice(0, SP ? 4 : 4);
      if (!mine.length) return Promise.resolve(false);
      return Promise.all(mine.map(function (g) { return goodsInfo(g.code); })).then(function (arr) {
        arr = arr.filter(function (g) { return g && g.price && !g.soldout; });
        if (!arr.length) return false;
        var el = section('newRepeat', '<h4><span class="sis-tag">おかえりなさい</span>前回チェックした商品（最新の価格・在庫）</h4><div class="sis-grid">' + arr.map(function (g) { return card(g); }).join('') + '</div>', slider, 'after');
        el.querySelectorAll('a').forEach(function (a) { a.onclick = function () { track('newRepeat', 'click'); }; });
        return true;
      });
    }
  };

  /* 10. 閲覧カテゴリ別バナー ／ よく見るジャンルを上に並べ替え */
  var CB = C.catBanner || {};
  function stamp(key, id, name) { var all = ls(key) || {}; var c = all[id] || { ts: [] }; if (c.n && !c.ts.length) c.ts = [c.t || Date.now()]; c.ts.push(Date.now()); c.ts = c.ts.slice(-30); if (name) c.name = name; all[id] = c; ls(key, all); }
  function countIn(c) { var w = (CB.windowDays || 14) * 864e5; return (c.ts || (c.t ? [c.t] : [])).filter(function (t) { return Date.now() - t < w; }).length; }
  function recordCategory() {
    var m = P.match(/^\/shop\/c\/(c\d+)/i);
    if (m) { var name = (D.title.split(/[|｜]/)[0] || '').replace(/\s*[:：].*$/, '').trim(); var h1 = D.querySelector('h1'); if (h1 && h1.textContent.trim().length < 20) name = h1.textContent.trim(); stamp('cats', m[1], name.split('/').pop()); }
    var e2 = P.match(/^\/shop\/e\/e([^/_]+)/i); if (e2) stamp('evs', e2[1]);
  }
  FX.catBanner = function () {
    recordCategory();
    if (PAGE !== 'top') return Promise.resolve(false);
    var cats = ls('cats') || {}, best = null;
    Object.keys(cats).forEach(function (k) { var n = countIn(cats[k]); if (n >= (CB.minViews || 2) && (!best || n > best.n)) best = { code: k, n: n, name: cats[k].name }; });
    if (!best) return Promise.resolve(false);
    return get('/shop/c/' + best.code + '_srd/', 8000).catch(function () { return get('/shop/c/' + best.code + '/'); }).then(function (html) {
      var items = uniqProduct(listItems(parseDoc(html)).filter(function (g) { return g.price; })).slice(0, 8);
      if (!items.length) return false;
      var anchor = D.getElementById('block_of_event') || D.getElementById('block_of_top_free2');
      var el = section('catBanner', '<h4><span class="sis-tag">よく見ているカテゴリ</span>「' + esc(best.name) + '」の新着<span style="font-size:12px;color:#888;font-weight:normal">直近' + (CB.windowDays || 14) + '日で' + best.n + '回</span></h4><div class="sis-grid sis-4">' + items.map(function (g) { return card(g); }).join('') + '</div><p style="text-align:right;margin:10px 0 0"><a href="/shop/c/' + best.code + '/" style="color:#c4561a">「' + esc(best.name) + '」をすべて見る ›</a></p>', anchor, 'before');
      el.querySelectorAll('a').forEach(function (a) { a.onclick = function () { track('catBanner', 'click', { sis_label: best.code }); }; });
      return true;
    }).catch(function () { return false; });
  };
  FX.eventOrder = function () { // トップのイベント枠（セール・新作・定番など）を、その人がよく見ている順に並べ替える
    if (PAGE !== 'top' || CB.reorderEvents === false) return;
    var box = D.getElementById('block_of_event'); if (!box) return;
    var groups = [], cur = null;
    [].slice.call(box.children).forEach(function (el) { if (/block-top-event--header/.test(el.className)) { cur = { els: [], id: '' }; groups.push(cur); var a = el.querySelector('a[href*="/shop/e/"]'); cur.id = a ? (a.getAttribute('href').match(/\/shop\/e\/e([^/_]+)/) || [])[1] || '' : ''; } if (cur) cur.els.push(el); });
    if (groups.length < 2) return;
    var evs = ls('evs') || {}, mine = {};
    (ls('viewed') || []).concat(ls('interest') || []).forEach(function (v) { if (Date.now() - v.t < (CB.windowDays || 14) * 864e5) mine[pkey(v.code)] = 1; });
    groups.forEach(function (g, i) {
      g.i = i; g.score = countIn(evs[g.id] || {}) * 2;
      g.els.forEach(function (el) { el.querySelectorAll && el.querySelectorAll('a[href*="/shop/g/g"]').forEach(function (a) { if (mine[pkey(codeOf(a.getAttribute('href')))]) g.score++; }); });
    });
    if (!groups.some(function (g) { return g.score > 0; })) return;
    var sorted = groups.slice().sort(function (x, y) { return y.score - x.score || x.i - y.i; });
    if (sorted.every(function (g, i) { return g === groups[i]; })) return;
    sorted.forEach(function (g) { g.els.forEach(function (el) { box.appendChild(el); }); });
    SIS.active.eventOrder = sorted.map(function (g) { return g.id + ':' + g.score; }).join(' ');
    track('eventOrder', 'reorder', { sis_label: sorted[0].id });
  };

  /* 11. サイズ記憶 ／ 閲覧履歴の記録 */
  function goodsCat1() { var m = D.title.match(/[:：]\s*([^|｜]+?)\s*[|｜]/); return m ? m[1].trim() : 'all'; }
  FX.sizeMemo = function () {
    if (PAGE !== 'goods') return;
    var code = codeOf(P), cat = goodsCat1();
    var items = [].slice.call(D.querySelectorAll('.block-size--item'));
    var label = function (el) { return (el.textContent || '').replace(/\s+/g, '').trim(); };
    var active = items.filter(function (e) { return /\bactive\b/.test(e.className); })[0];
    var memo = (ls('size') || {})[cat];
    function save(sz) { var s = ls('size') || {}; s[cat] = sz; ls('size', s); }
    D.querySelectorAll('.block-add-cart--btn').forEach(function (b) { b.addEventListener('click', function () { if (active) { save(label(active)); track('sizeMemo', 'save', { sis_label: label(active) }); } }); });
    items.forEach(function (it) { it.addEventListener('click', function () { save(label(it)); }); });
    if (!memo || !items.length) return;
    var target = items.filter(function (e) { return label(e) === memo; })[0];
    var list = D.querySelector('.block-size--item-list') || (items[0] && items[0].parentNode);
    if (!target || !list) return;
    target.classList.add('sis-memo-on');
    var hint;
    var fromSw = ss('szFrom');
    if (active && label(active) === memo && fromSw && fromSw.to === code) { hint = h('<div class="sis-root sis-size-hint">✓ いつものサイズ「<b>' + esc(memo) + '</b>」に切り替えました <a href="' + esc(fromSw.from) + '?sis_szback=1">「' + esc(fromSw.size || '元のサイズ') + '」に戻す</a></div>'); ss('szFrom', null); }
    else if (active && label(active) === memo) hint = h('<div class="sis-root sis-size-hint">✓ いつものサイズ「<b>' + esc(memo) + '</b>」を選んでいます（' + esc(cat) + '）</div>');
    else {
      var a = target.querySelector('a'), oc = (target.querySelector('[onclick]') || target).getAttribute('onclick') || '';
      var href = a ? a.getAttribute('href') : (oc.match(/location\.href\s*=\s*['"]([^'"]+)['"]/) || [])[1];
      var dis = /disable|soldout|nostock/.test(target.className);
      var auto = (C.sizeMemo || {}).autoSwitch, done = ss('szAuto') || {};
      if (auto && href && !dis && !done[pkey(code)]) { done[pkey(code)] = 1; ss('szAuto', done); ss('szFrom', { to: codeOf(href), from: P, size: label(active || {}), memo: memo }); track('sizeMemo', 'auto_switch', { sis_label: memo }); L.replace(href + (href.indexOf('?') < 0 ? '?' : '&') + 'sis_sz=1' + (L.search.indexOf('sis_') >= 0 ? '&' + L.search.slice(1).split('&').filter(function (kv) { return /^sis_/.test(kv) && !/^sis_sz/.test(kv); }).join('&') : '')); return; }
      hint = h('<div class="sis-root sis-size-hint">いつものサイズは「<b>' + esc(memo) + '</b>」です。' + (href && !dis ? ' <a href="' + esc(href) + '">「' + esc(memo) + '」に切り替える ›</a>' : '（このカラーは「' + esc(memo) + '」の在庫がありません）') + '</div>');
      var link = hint.querySelector('a'); if (link) link.onclick = function () { track('sizeMemo', 'switch', { sis_label: memo }); };
    }
    list.parentNode.insertBefore(hint, list); SIS.active.sizeMemo = 'on'; track('sizeMemo', 'impression', { sis_label: memo });
  };
  function curGoods() {
    var code = codeOf(P); if (!code) return null;
    return { code: code, name: ((D.querySelector('.block-goods-name') || {}).textContent || '').replace(/\s+/g, ' ').trim(), price: num((D.querySelector('.block-goods-price--price') || {}).textContent) };
  }
  function recordViewed() {
    if (PAGE !== 'goods') return;
    var g = curGoods(); if (!g) return;
    var v = (ls('viewed') || []).filter(function (x) { return x.code !== g.code && stem(x.code) !== stem(g.code); });
    v.unshift({ code: g.code, name: g.name, price: g.price, t: Date.now() }); ls('viewed', v.slice(0, 20));
  }
  function addInterest(g, kind) {
    var it = (ls('interest') || []).filter(function (x) { return !(x.code === g.code && x.kind === kind); });
    it.unshift({ code: g.code, name: g.name, price: g.price, kind: kind, t: Date.now() }); ls('interest', it.slice(0, 30));
  }
  function trackInterest() { // 長く見た・カートに入れた・お気に入りした商品を「気になる商品」として覚える
    if (PAGE !== 'goods') return;
    var g = curGoods(); if (!g) return;
    var need = ((C.interest || {}).dwellSec || 20) * 1000, seen = 0, last = Date.now(), done = false;
    var iv = setInterval(function () { var t = Date.now(); if (!D.hidden) seen += t - last; last = t; if (!done && seen >= need) { done = true; addInterest(g, 'dwell'); clearInterval(iv); } }, 1000);
    D.querySelectorAll('.block-add-cart--btn').forEach(function (b) { b.addEventListener('click', function () { addInterest(g, 'cart'); }); });
    D.querySelectorAll('.block-goods-favorite--btn, [class*="favorite--btn"]').forEach(function (b) { b.addEventListener('click', function () { addInterest(g, 'fav'); }); });
  }
  var saleSetP = null;
  function saleSet() { // セール会場（設定のsalePage）に載っている商品の一覧（セッション中は使い回す）
    if (saleSetP) return saleSetP;
    var cached = ss('saleSet'); if (cached && Date.now() - cached.t < 3600e3) return (saleSetP = Promise.resolve(cached.k));
    var base = SHOP.salePage.replace(/\/$/, ''), keys = {};
    saleSetP = [base + '/', base + '/?p=2', base + '/?p=3', base + '/?p=4'].reduce(function (pr, u) {
      return pr.then(function () { return get(u, 8000).then(function (h2) { listItems(parseDoc(h2)).forEach(function (x) { keys[pkey(x.code)] = 1; }); }).catch(function () {}); });
    }, Promise.resolve()).then(function () { ss('saleSet', { t: Date.now(), k: keys }); return keys; });
    return saleSetP;
  }
  /* 気になる商品のお知らせ（在庫残りわずか・セール終了間近・値下がり）を右下に数秒だけ出す */
  FX.interestAlert = function (forced) {
    var cfg = C.interest || {};
    if (PAGE === 'order') return;
    var here = codeOf(P), days = (cfg.windowDays || 14) * 864e5;
    var list = (ls('interest') || []).filter(function (x) { return Date.now() - x.t < days; });
    cart().then(function (c) {
      c.items.forEach(function (i) {
        var code = i.code || ((ls('viewed') || []).filter(function (v) { return v.name && i.name && v.name === i.name; })[0] || {}).code;
        if (code) list.unshift({ code: code, name: i.name, kind: 'cart', t: Date.now() });
      });
      var seenK = {}, uniq = [];
      list.forEach(function (x) { if (!seenK[x.code] && x.code !== here) { seenK[x.code] = 1; uniq.push(x); } });
      uniq = uniq.slice(0, cfg.maxItems || 6); if (!uniq.length) return;
      var shown = ls('alertSeen') || {}, cap = (cfg.capHours || 24) * 3600e3;
      var saleDl = activeDeadlines().filter(function (x) { return x.d.id === (cfg.saleDeadline || 'sale15') && x.end - now() < (cfg.saleEndHours || 48) * 3600e3; })[0];
      return Promise.all([Promise.all(uniq.map(function (x) { return goodsInfo(x.code); })), saleDl ? saleSet() : Promise.resolve({})]).then(function (r) {
        var infos = r[0], sale = r[1], pick = null;
        uniq.forEach(function (x, i) {
          var g = infos[i]; if (pick || !g || g.soldout) return;
          var why = /△|残りわずか/.test(g.stock) ? 'low' : saleDl && sale[pkey(x.code)] ? 'saleEnd' : x.price && g.price && g.price < x.price ? 'drop' : null;
          if (!why || (!forced && shown[x.code + why] && Date.now() - shown[x.code + why] < cap)) return;
          pick = { x: x, g: g, why: why };
        });
        if (!pick) return;
        var from = { cart: 'カートに入れた', dwell: 'じっくり見ていた', fav: 'お気に入りの' }[pick.x.kind] || '気になっていた';
        var msg = pick.why === 'low' ? '在庫が<b>残りわずか</b>です' : pick.why === 'saleEnd' ? '<b>セール価格は' + ((saleDl.end.getMonth() + 1) + '/' + new Date(saleDl.end - 1).getDate()) + ' 23:59まで</b>です' : '<b>' + yen(pick.x.price - pick.g.price) + '値下がり</b>しました';
        var el = h('<a class="sis-root sis-alert" href="' + esc(pick.g.href) + '" style="text-decoration:none;color:#333">' + (pick.g.img ? '<img src="' + esc(pick.g.img) + '" alt="">' : '') +
          '<div style="font-size:13px;line-height:1.5"><span style="font-size:11px;color:#888">' + from + '商品</span><br>' + esc(pick.g.name.slice(0, 26)) + '<br>' + msg + '</div><button class="sis-x" aria-label="閉じる" style="top:2px;right:2px">×</button></a>');
        el.querySelector('.sis-x').onclick = function (ev) { ev.preventDefault(); el.remove(); track('interestAlert', 'close'); };
        el.addEventListener('click', function () { track('interestAlert', 'click', { sis_label: pick.why }); });
        D.body.appendChild(el); var fix = D.getElementById('sis-shipfix'); if (fix) el.style.bottom = (fix.getBoundingClientRect().height + 16 + parseInt(fix.style.bottom || 0)) + 'px';
        shown[pick.x.code + pick.why] = Date.now(); ls('alertSeen', shown); SIS.active.interestAlert = pick.why;
        track('interestAlert', 'show', { sis_label: pick.why });
        var sec = forced ? 0 : (cfg.durationSec == null ? 5 : cfg.durationSec);
        if (sec > 0 && !Q.get('sis_hold')) setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 400); }, sec * 1000);
      });
    });
  };

  /* 11b. サイズの目安（商品写真のモデル着用情報を使う） */
  FX.modelSize = function () {
    if (PAGE !== 'goods') return;
    var seen = {}, rows = [];
    [].slice.call(D.querySelectorAll('.block-goods-gallery p, .block-src-L div, .js-goods-img-item div')).forEach(function (e) {
      if (e.children.length) return;
      var m = e.textContent.replace(/\s+/g, ' ').match(/着用サイズ[：:]\s*(\S+)\s*モデル身長[：:]\s*(\d{3})\s*cm/);
      if (!m) return; var k = m[2] + '-' + m[1]; if (seen[k]) return; seen[k] = 1; rows.push({ size: m[1], h: +m[2] });
    });
    if (!rows.length) return;
    rows.sort(function (x, y) { return x.h - y.h; });
    var list = D.querySelector('.block-size--item-list'); if (!list) return;
    var html = '<div class="sis-root sis-size-hint" id="sis-modelsize">📏 サイズの目安（撮影モデルの着用）：' + rows.map(function (r) { return '身長' + r.h + 'cm → <b>' + esc(r.size) + '</b>'; }).join('／') + '</div>';
    list.parentNode.insertBefore(h(html), list); SIS.active.modelSize = 'on'; track('modelSize', 'impression', { sis_label: rows.length });
  };

  /* 12. 在庫僅少バッジ（メルカートの在庫表示「△」をそのまま使う） */
  FX.lowStock = function () {
    if (PAGE !== 'goods') return;
    var s = D.getElementById('spec_stock_msg'); if (!s) return;
    var t = s.textContent.trim(); if (!/△|残りわずか|僅少/.test(t)) return;
    var price = D.querySelector('.block-goods-price');
    if (price) price.insertBefore(h('<div class="sis-root"><span class="sis-badge">残りわずか</span></div>'), price.firstChild);
    var btn = D.querySelector('.block-add-cart');
    if (btn) btn.insertBefore(h('<div class="sis-root" style="font-size:13px;color:#e8473b;font-weight:bold;margin:0 0 8px">このカラー・サイズは在庫が残りわずかです</div>'), btn.firstChild);
    SIS.active.lowStock = 'on'; track('lowStock', 'impression', { sis_label: codeOf(P) });
  };

  /* 13. 売れ筋ランキング（data/ranking.json があるときだけ） */
  FX.ranking = function () {
    if (PAGE !== 'top' && PAGE !== 'list') return Promise.resolve(false);
    return fetch(CDN + 'data/ranking.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (rk) {
      var list = (rk.items || []).slice(0, 8); if (!list.length) return;
      return Promise.all(list.map(function (x) { return goodsInfo(x.code); })).then(function (arr) {
        var rows = [];
        arr.forEach(function (g, i) { if (g && g.price && !g.soldout) rows.push({ g: g, rank: list[i].rank || i + 1 }); });
        rows = rows.slice(0, 4); if (!rows.length) return false;
        var anchor = D.getElementById('block_of_event');
        section('ranking', '<h4><span class="sis-tag">売れ筋</span>' + esc(rk.title || 'いま売れているアイテム') + '<span style="font-size:12px;color:#888;font-weight:normal">' + esc(rk.period || '') + 'の購入数順</span></h4><div class="sis-grid">' +
          rows.map(function (r) { return card(r.g).replace('<div class="sis-cn">', '<div class="sis-cn"><b style="color:#c4561a">' + r.rank + '位</b> '); }).join('') + '</div>', anchor, 'before');
        return true;
      });
    }).catch(function () { SIS.active.ranking = 'データ待ち'; return false; });
  };

  /* 14. さらに◯%OFF表示（BOでプロモーションを作ってから） */
  FX.extraOff = function () {
    var x = C.extraOff || {}; if (!x.on && !DEMO) return;
    var rate = x.rate || 20, lab = (x.label || 'カートでさらに{rate}%OFF').replace('{rate}', rate) + (x.on ? '' : '（BO設定待ちのプレビュー）');
    var inScope = (x.scopePaths || []).some(function (p) { return P.indexOf(p) === 0; });
    var n = 0;
    if (PAGE === 'list' && inScope) {
      D.querySelectorAll('.block-goods-detail-j--price-items, .block-thumbnail-t--price-items, [class*="--price-items"]').forEach(function (box) {
        var p = num((box.querySelector('[class*="--price"]:not([class*="default"])') || box).textContent); if (!p) return;
        box.appendChild(h('<div class="sis-root" style="margin-top:4px;font-size:12px;color:#e8473b;font-weight:bold">' + esc(lab) + ' → ' + yen(Math.floor(p * (100 - rate) / 100)) + '</div>')); n++;
      });
    }
    if (PAGE === 'goods' && D.querySelector('.block-goods-price--default-price')) {
      var pr = D.querySelector('.block-goods-price--price'); var p = num(pr && pr.textContent);
      if (p) { pr.parentNode.appendChild(h('<div class="sis-root" style="margin:6px 0;padding:6px 10px;border-radius:6px;background:#fdecea;color:#e8473b;font-weight:bold;display:inline-block">' + esc(lab) + '　お支払い ' + yen(Math.floor(p * (100 - rate) / 100)) + '</div>')); n++; }
    }
    if (n) { SIS.active.extraOff = x.on ? 'on' : 'プレビュー（BO設定待ち）'; track('extraOff', 'impression', { sis_value: n }); }
  };

  /* 15. コーデまとめ買い */
  FX.coord = function () {
    if (PAGE !== 'goods') return;
    var code = codeOf(P);
    fetch(CDN + 'data/coords.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (data) {
      var hit = (data.coords || []).filter(function (c) { return c.goods.indexOf(code) >= 0; })[0] ||
        (data.coords || []).filter(function (c) { return c.goods.some(function (g) { return stem(g) === stem(code); }); })[0];
      if (!hit) return;
      return Promise.all(hit.goods.map(goodsInfo)).then(function (arr) {
        arr = arr.filter(function (g) { return g && g.price; }); if (arr.length < 2) return;
        var avail = arr.filter(function (g) { return !g.soldout; });
        var sum = avail.reduce(function (s, g) { return s + g.price; }, 0);
        return cart().then(function (c) {
          var inCart = {}; c.items.forEach(function (i) { inCart[i.code] = 1; });
          var add = avail.filter(function (g) { return !inCart[g.code]; });
          var after = c.total + add.reduce(function (s, g) { return s + g.price; }, 0);
          var ship = after >= SHOP.freeShipping ? '<b style="color:#c4561a">まとめて買うと送料無料（' + yen(SHOP.freeShipping) + '以上）</b>' : 'あと ' + yen(SHOP.freeShipping - after) + ' で送料無料';
          var anchor = D.querySelector('.block-add-cart');
          var el = section('coord', '<h4><span class="sis-tag">スタッフコーデ</span>このアイテムを使ったコーデ<span style="font-size:12px;color:#888;font-weight:normal">' + esc(hit.label) + '</span></h4>' +
            '<div class="sis-coord"><a href="' + esc(hit.page) + '"><img src="' + esc(hit.img) + '" alt="スタッフコーデ"></a><div><div class="sis-grid">' + arr.map(function (g) { return card(g).replace('</a>', (g.soldout ? '<div style="padding:0 8px 8px;color:#999">在庫なし</div>' : '') + '</a>'); }).join('') + '</div>' +
            '<p style="margin:12px 0 4px;font-size:15px">' + avail.length + '点合計 <b style="font-size:20px;color:#c4561a">' + yen(sum) + '</b>　' + ship + '</p>' +
            (add.length ? '<p style="margin:8px 0 0"><button type="button" class="sis-btn" id="sis-coord-all">コーデをまとめてカートへ（' + add.length + '点）</button></p>' : '<p>コーデのアイテムはすべてカートに入っています</p>') + '</div></div>',
            D.querySelector('.block-goods-detail') || anchor, 'after');
          var b = el.querySelector('#sis-coord-all');
          if (b) b.onclick = function () {
            b.disabled = true; b.textContent = 'カートに追加しています…'; track('coord', 'add_all', { sis_value: add.length });
            add.reduce(function (p, g) { return p.then(function () { return addToCart(g.code); }); }, Promise.resolve()).then(function () { L.href = '/shop/cart/cart.aspx'; });
          };
        });
      });
    }).catch(function () {});
  };

  /* 16. カゴ落ち表示 */
  FX.cartReminder = function (forced) {
    if (!forced && (PAGE === 'cart' || PAGE === 'order' || !newSession || ss('cartRemShown'))) return;
    cart().then(function (c) {
      if (!c.count) return; ss('cartRemShown', 1);
      var first = c.items[0];
      Promise.all(c.items.slice(0, 6).map(function (i) { return i.code ? goodsInfo(i.code) : Promise.resolve(null); })).then(function (gs) {
        var g = gs[0] || (first.img ? { img: first.img } : null), rest = SHOP.freeShipping - c.total;
        var low = gs.filter(function (x) { return x && /△|残りわずか/.test(x.stock); });
        if (low.length) { SIS.active.cartReminder = '在庫△' + low.length; track('cartReminder', 'low_stock', { sis_value: low.length }); }
        var el = toast('cartReminder', (g && g.img ? '<img src="' + esc(g.img) + '" alt="">' : '') +
          '<div style="flex:1;font-size:14px"><b>前回のお買い物がカートに残っています</b><br>' + esc(first.name) + (c.items.length > 1 ? ' ほか' : '') + '（' + c.count + '点・' + yen(c.total) + '）' +
          (low.length ? '<br><span style="font-size:12px;color:#c4561a;font-weight:bold">「' + esc(low[0].name.slice(0, 16)) + '」' + (low.length > 1 ? 'ほか' + (low.length - 1) + '点' : '') + 'の在庫が残りわずかです</span>' : '') +
          (rest > 0 ? '<br><span style="font-size:12px;color:#888">あと' + yen(rest) + 'で送料無料</span>' : '') + '</div>' +
          '<a class="sis-btn" style="padding:8px 14px;font-size:13px;flex:none" href="/shop/cart/cart.aspx">カートへ</a>');
        el.querySelector('a.sis-btn').onclick = function () { track('cartReminder', 'click'); };
      });
    });
  };

  /* 17. カート内クロスセル（送料無料まであと少しの人へ。その人が興味を持った商品を優先） */
  function crossCandidates(rest, inCart) {
    var out = [], seen = {};
    function push(g, why) { if (!g || !g.price || g.soldout || g.price < rest || inCart[pkey(g.code)] || seen[pkey(g.code)]) return; seen[pkey(g.code)] = 1; g.why = why; out.push(g); }
    var interest = (ls('interest') || []).concat(ls('viewed') || []).slice(0, 10);
    return Promise.all(interest.map(function (x) { return goodsInfo(x.code); })).then(function (arr) {
      arr.forEach(function (g) { push(g, '最近見た商品'); });
      var cats = ls('cats') || {}, top = Object.keys(cats).sort(function (p, q) { return countIn(cats[q]) - countIn(cats[p]); })[0];
      return top ? get('/shop/c/' + top + '_ssp/', 8000).then(function (h2) { listItems(parseDoc(h2)).forEach(function (g) { push(g, 'よく見るカテゴリ'); }); }).catch(function () {}) : null;
    }).then(function () {
      if (out.length >= 4) return;
      var base = SHOP.salePage.replace(/\/$/, '');
      return [base + '_ssp/', base + '_ssp/?p=2', base + '_ssp/?p=3'].reduce(function (pr, u) { return pr.then(function () { if (out.length >= 8) return; return get(u, 8000).then(function (h2) { listItems(parseDoc(h2)).forEach(function (g) { push(g, 'セール'); }); }).catch(function () {}); }); }, Promise.resolve());
    }).then(function () {
      var rank = { '最近見た商品': 0, 'よく見るカテゴリ': 1, 'セール': 2 };
      out.sort(function (p, q) { return rank[p.why] - rank[q.why] || p.price - q.price; });
      return uniqProduct(out).slice(0, 8);
    });
  }
  FX.crossSell = function () {
    if (PAGE === 'goods') { // 商品ページ：この商品を足すと送料無料になるかを、カートボタンの上に一言
      cart().then(function (c) {
        if (!c.count) return; var rest = SHOP.freeShipping - c.total; if (rest <= 0) return;
        var price = num((D.querySelector('.block-goods-price--price') || {}).textContent); var btn = D.querySelector('.block-add-cart');
        if (!price || !btn) return;
        var msg = price >= rest ? '🚚 この商品を足すと<b>送料無料</b>になります（カート ' + yen(c.total) + '）' : '🚚 この商品を足すと、送料無料まであと<b>' + yen(rest - price) + '</b>';
        btn.insertBefore(h('<div class="sis-root sis-size-hint" style="margin:0 0 8px">' + msg + '</div>'), btn.firstChild);
        SIS.active.crossSell = 'goods'; track('crossSell', 'goods_hint', { sis_value: rest });
      });
      return;
    }
    if (PAGE !== 'cart') return;
    cart(true).then(function (c) {
      if (!c.count) return;
      var rest = SHOP.freeShipping - c.total; if (rest <= 0) return;
      var inCart = {}; c.items.forEach(function (i) { if (i.code) inCart[pkey(i.code)] = 1; });
      crossCandidates(rest, inCart).then(function (pick) {
        if (!pick.length) return;
        var anchor = D.querySelector('.block-cart--container') || D.querySelector('.block-cart');
        var el = section('crossSell', '<h4><span class="sis-tag">あと ' + yen(rest) + ' で送料無料</span>1点足すと送料が無料になるアイテム</h4><div class="sis-grid sis-4">' +
          pick.map(function (g) { return card(g, { add: true }).replace('<div class="sis-cn">', '<div class="sis-cn"><span style="font-size:10px;color:#c4561a;font-weight:bold">' + esc(g.why) + '</span><br>'); }).join('') +
          '</div><p class="sis-note">あなたが最近見た商品・よく見るカテゴリを優先し、足りない額（' + yen(rest) + '）以上で価格の近いものを表示しています</p>', anchor, 'after');
        bindAdd(el);
      });
    });
  };

  /* ---------- 計測パネル（sis_debug=1） ---------- */
  var dbg;
  function renderDebug() {
    if (Q.get('sis_debug') !== '1') return;
    if (!dbg) { dbg = h('<div class="sis-root sis-panel" style="left:auto;right:10px;bottom:10px;width:380px"></div>'); onReady(function () { D.body.appendChild(dbg); }); }
    dbg.innerHTML = '<b>GA4に送るイベント（' + SIS.events.length + '件）</b><div class="sis-note" style="margin:2px 0 6px">イベント名 sis_event／パラメータ sis_feature・sis_action・sis_variant</div><table>' +
      SIS.events.slice(-14).reverse().map(function (e) { return '<tr><td>' + e.time + '</td><td><b>' + esc(e.sis_feature) + '</b></td><td>' + esc(e.sis_action) + '</td><td>' + esc(e.sis_variant || e.sis_label || '') + '</td></tr>'; }).join('') + '</table>';
  }

  /* ---------- 関係者チップ ---------- */
  var NAMES = { welcome: '初回ポップアップ', popup: 'ポップアップ枠', interestAlert: '気になる商品のお知らせ', eventOrder: 'イベント枠の並べ替え', exit: '離脱時ポップアップ', source: '流入元別の出し分け', coupon: '入店時クーポン', shipbar: '送料無料バー', countdown: '期限カウントダウン', kuji: 'くじ', rank: '会員ランク別UI', newRepeat: '新規／リピーター', catBanner: '閲覧カテゴリ別バナー', sizeMemo: 'サイズ記憶', modelSize: 'サイズの目安', lowStock: '在庫僅少バッジ', ranking: '売れ筋ランキング', extraOff: 'さらに◯%OFF', coord: 'コーデまとめ買い', cartReminder: 'カゴ落ち表示', crossSell: 'カート内クロスセル' };
  function chip() {
    if (Q.get('sis_chip') === '0') return;
    var c = h('<button class="sis-root sis-chip">SIS施策 ON</button>'); var panel;
    c.onclick = function () {
      if (panel) { panel.remove(); panel = null; return; }
      panel = h('<div class="sis-root sis-panel"><b>この画面で動いている施策</b> <span class="sis-note">v' + esc(C.version) + ' · ' + esc(SIS.ref) + '</span><table>' +
        Object.keys(NAMES).map(function (k) { return '<tr><td>' + NAMES[k] + '</td><td>' + (F[k] === false ? '停止中' : esc(SIS.active[k] || '—')) + '</td><td><a href="#" data-show="' + k + '">出す</a></td></tr>'; }).join('') +
        '</table><p style="margin:8px 0 0"><a href="#" data-reset>はじめての訪問に戻す</a>　<a href="?sis=off">関係者モードを終了</a></p></div>');
      panel.querySelectorAll('[data-show]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); SIS.show(a.getAttribute('data-show')); }; });
      panel.querySelector('[data-reset]').onclick = function (e) { e.preventDefault(); ['welcomeShown', 'visits', 'kujiDay', 'size', 'cats', 'viewed'].forEach(function (k) { ls(k, null); }); try { sessionStorage.clear(); } catch (x) {} L.reload(); };
      D.body.appendChild(panel);
    };
    D.body.appendChild(c);
  }

  SIS.show = function (k) { var p = k.split(':'); if (p[0] === 'popup') return FX.popup(p[1] || true); if (k === 'welcome') return FX.popup('line'); var fn = FX[k === 'cart' ? 'cartReminder' : k === 'alert' ? 'interestAlert' : k]; if (fn) fn(true); };

  /* ---------- 起動 ---------- */
  onReady(function () {
    style();
    recordViewed();
    trackInterest();
    var order = ['countdown', 'source', 'coupon', 'rank', 'shipbar', 'eventOrder', 'newRepeat', 'catBanner', 'ranking', 'sizeMemo', 'modelSize', 'lowStock', 'extraOff', 'coord', 'crossSell', 'cartReminder', 'interestAlert', 'popup', 'kuji', 'exit'];
    var slot = C.topSlot || {};
    if (PAGE === 'top' && slot.mode === 'one' && !Q.get('sis_only')) { // トップの「あなた向け枠」は優先順に1つだけ出す
      var so = (slot.order || ['newRepeat', 'catBanner', 'ranking']).filter(function (k) { return F[k] !== false && FX[k]; });
      order = order.filter(function (k) { return so.indexOf(k) < 0; });
      so.reduce(function (pr, k) { return pr.then(function (done) { if (done) return true; try { return Promise.resolve(FX[k](false)).then(function (r) { return !!r; }); } catch (e) { return false; } }); }, Promise.resolve(false));
    }
    var only = (Q.get('sis_only') || '').split(',').filter(Boolean);
    order.forEach(function (k) { if (F[k] === false || !FX[k] || only.length && only.indexOf(k) < 0) return; try { FX[k](false); } catch (e) { SIS.active[k] = 'エラー'; if (window.console) console.warn('[SIS]', k, e); } });
    var sh = Q.get('sis_show'); if (sh) setTimeout(function () { SIS.show(sh); }, 600);
    chip(); renderDebug();
  });
})();
