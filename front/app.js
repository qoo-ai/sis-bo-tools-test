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
  function ss(k, v) { try { if (v === undefined) { var s = sessionStorage.getItem('sis_' + k); return s ? JSON.parse(s) : null; } sessionStorage.setItem('sis_' + k, JSON.stringify(v)); } catch (e) { return null; } }
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
  function stem(code) { var p = String(code).split('-'); if (p.length < 4) return code; return p[0] + '-' + p[1].slice(0, -1) + '-' + p[2] + '-' + p[3]; }

  /* ---------- 訪問・セッション ---------- */
  var vid = ls('vid'); if (!vid) { vid = Math.random().toString(36).slice(2) + Date.now().toString(36); ls('vid', vid); }
  var newSession = !ss('sess'); if (newSession) { ss('sess', 1); ls('visits', (ls('visits') || 0) + 1); }
  var visits = ls('visits') || 1;
  var isNew = Q.get('sis_visit') ? Q.get('sis_visit') === 'new' : visits <= 1;
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
    '.sis-sp .sis-grid{grid-template-columns:repeat(2,1fr)}',
    '.sis-sp .sis-sec{margin:16px 10px;padding:14px}',
    '.sis-sp .sis-strip{font-size:13px;padding:8px 10px;gap:8px}',
    '.sis-sp .sis-coord{grid-template-columns:1fr}',
    '.sis-sp .sis-coord .sis-grid{grid-template-columns:repeat(3,1fr)}',
    '.sis-sp .sis-modal h3{font-size:19px}',
    '.sis-sp .sis-fab{bottom:76px;width:68px;height:68px;font-size:12px}'
  ].join('\n');
  function style() { if (D.getElementById('sis-css')) return; var s = D.createElement('style'); s.id = 'sis-css'; s.textContent = css; D.head.appendChild(s); D.documentElement.classList.add(SP ? 'sis-sp' : 'sis-pc'); }

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
    return '<a class="sis-card" href="' + esc(g.href) + '" data-sis-goods="' + esc(g.code) + '">' + (g.img ? '<img loading="lazy" src="' + esc(g.img) + '" alt="">' : '<img alt="">') +
      '<div class="sis-cn">' + esc(g.name) + '</div><div class="sis-cp">' + (g.price ? yen(g.price) : '') + '</div>' +
      (opt && opt.add ? '<button type="button" class="sis-add" data-sis-add="' + esc(g.code) + '">カートに入れる</button>' : '') + '</a>';
  }

  /* ---------- 店舗データ（実データ） ---------- */
  var cartP = null;
  function cart(force) {
    if (cartP && !force) return cartP;
    cartP = get('/shop/js/cart.aspx', 6000).then(function (html) {
      var d = parseDoc('<div>' + html + '</div>'), items = [];
      d.querySelectorAll('.block-jscart--items').forEach(function (it) {
        var a = it.querySelector('.block-jscart--name a');
        items.push({ name: a ? a.textContent.trim() : '', href: a ? a.getAttribute('href') : '', code: codeOf(a && a.getAttribute('href')),
          variation: (it.querySelector('.variation-name') || {}).textContent || '', qty: num((it.querySelector('.block-jscart--qty') || {}).textContent) || 1,
          amt: num((it.querySelector('.block-jscart--amt') || {}).textContent) });
      });
      var total = items.reduce(function (s, i) { return s + i.amt; }, 0);
      var count = items.reduce(function (s, i) { return s + i.qty; }, 0);
      return { items: items, total: total, count: count };
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

  /* 1. 初回ポップアップ（LINE友だち追加） */
  FX.welcome = function (forced) {
    if (!forced && (PAGE === 'order' || PAGE === 'cart' || ls('welcomeShown') || !isNew || source() === 'line')) return;
    var v = ab('welcome');
    var head = v === 'B' ? '新作とシークレットセールを<br>LINEでいち早く' : 'LINE友だち追加で<br>500円OFFクーポン';
    var cp = coupon('welcome');
    setTimeout(function () {
      var m = modal('welcome',
        '<span class="sis-tag">はじめての方へ</span><h3>' + head + '</h3>' +
        '<ul class="sis-list"><li>' + esc(SHOP.linePerk || 'アンケート回答でWEBSHOP限定クーポン') + '</li><li>お誕生月にバースデークーポン</li><li>友だち限定シークレットセールのご案内</li></ul>' +
        (cp ? '<p style="margin:10px 0">' + ticket(cp) + '</p>' : '') +
        '<p><a class="sis-btn sis-line" href="' + esc(SHOP.lineUrl) + '" target="_blank" rel="noopener" data-sis="line">LINEで友だち追加</a></p>' +
        '<p><button class="sis-btn sis-ghost" data-sis-close="later" style="padding:8px 18px;font-size:13px">あとで見る</button></p>' +
        '<div class="sis-x2">ABテスト ' + v + '</div>', { force: forced });
      if (!m) return; ls('welcomeShown', Date.now());
      m.querySelector('[data-sis="line"]').onclick = function () { track('welcome', 'line_click'); };
    }, forced ? 0 : 2500);
  };

  /* 2. 離脱時ポップアップ */
  FX.exit = function (forced) {
    if (!forced && (PAGE === 'order' || ss('exitShown'))) return;
    function fire() {
      if (ss('exitShown') && !forced) return; ss('exitShown', 1);
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
    var s = ss('src');
    if (!s || Q.get('sis_src') || Q.get('utm_source')) {
      var u = (Q.get('sis_src') || Q.get('utm_source') || '').toLowerCase(), r = D.referrer.toLowerCase();
      s = /line/.test(u) || /line\.me|liff/.test(r) ? 'line' : /insta|ig/.test(u) || /instagram/.test(r) ? 'instagram' : /qr|store|shop|tenpo/.test(u) ? 'qr' : (s || 'other');
      ss('src', s);
    }
    return s;
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

  /* 5. あと○円で送料無料・ノベルティのバー */
  FX.shipbar = function () {
    if (PAGE === 'order') return;
    cart().then(function (c) {
      if (c.error) return;
      var free = SHOP.freeShipping || 0, nov = C.novelty || {};
      var html;
      if (c.count === 0) {
        html = '<span>🚚 商品代金 <b>' + yen(free) + '（税込）以上で送料無料</b></span>' + (nov.on ? ' <span>／ ' + yen(nov.threshold) + '以上で <b>' + esc(nov.label) + '</b> プレゼント</span>' : '');
      } else {
        var rest = free - c.total, pct = Math.min(100, Math.round(c.total / free * 100));
        html = rest > 0 ? '<span>🚚 あと <b>' + yen(rest) + '</b> で送料無料</span><span class="sis-bar"><i style="width:' + pct + '%"></i></span><span style="font-size:12px;color:#888">カート ' + yen(c.total) + ' / ' + yen(free) + '</span>'
          : '<span>🎉 <b>送料無料ライン達成！</b>（カート ' + yen(c.total) + '）</span>';
        if (nov.on) { var nr = nov.threshold - c.total; html += nr > 0 ? ' <span>／ あと <b>' + yen(nr) + '</b> で ' + esc(nov.label) + '</span>' : ' <span>／ <b>' + esc(nov.label) + '</b> 対象です</span>'; }
      }
      strip('shipbar', html); track('shipbar', 'impression', { sis_value: c.total });
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
    if (PAGE !== 'top') return;
    var slider = D.getElementById('block_of_top_body') || mainEl().firstElementChild;
    if (isNew) {
      section('newRepeat', '<h4><span class="sis-tag">はじめての方へ</span>drug store\'s WEBSHOPのお買い物ガイド</h4>' +
        '<div class="sis-grid" style="grid-template-columns:repeat(' + (SP ? 1 : 3) + ',1fr)">' +
        '<a class="sis-card" style="padding:14px;font-size:14px" href="/shop/pages/guide.aspx#guide_07"><b style="color:#c4561a">🚚 送料</b><br>商品代金' + yen(SHOP.freeShipping) + '（税込）以上で送料無料</a>' +
        '<a class="sis-card" style="padding:14px;font-size:14px" href="' + esc(SHOP.rankPage) + '"><b style="color:#c4561a">🐷 会員ランク</b><br>お買い物金額に応じてクーポン・ポイントがアップ</a>' +
        '<a class="sis-card" style="padding:14px;font-size:14px" href="' + esc(SHOP.linePage) + '"><b style="color:#c4561a">💬 LINE</b><br>' + esc(SHOP.linePerk) + '</a>' +
        '</div>', slider, 'after');
    } else {
      var hist = D.getElementById('block_of_itemhistory');
      var mine = (ls('viewed') || []).slice(0, SP ? 4 : 4);
      if (!mine.length) return;
      Promise.all(mine.map(function (g) { return goodsInfo(g.code); })).then(function (arr) {
        arr = arr.filter(function (g) { return g && g.price && !g.soldout; });
        if (!arr.length) return;
        var el = section('newRepeat', '<h4><span class="sis-tag">おかえりなさい</span>前回チェックした商品（最新の価格・在庫）</h4><div class="sis-grid">' + arr.map(function (g) { return card(g); }).join('') + '</div>', slider, 'after');
        el.querySelectorAll('a').forEach(function (a) { a.onclick = function () { track('newRepeat', 'click'); }; });
      });
    }
  };

  /* 10. 閲覧カテゴリ別バナー */
  function recordCategory() {
    var m = P.match(/^\/shop\/c\/(c\d+)/i); if (!m) return;
    var name = (D.title.split(/[|｜]/)[0] || '').replace(/\s*[:：].*$/, '').trim();
    var h1 = D.querySelector('h1'); if (h1 && h1.textContent.trim().length < 20) name = h1.textContent.trim();
    var cats = ls('cats') || {}; var c = cats[m[1]] || { n: 0 }; c.n++; c.name = name; c.t = Date.now(); cats[m[1]] = c; ls('cats', cats);
  }
  FX.catBanner = function () {
    recordCategory();
    if (PAGE !== 'top') return;
    var cats = ls('cats') || {}, best = null;
    Object.keys(cats).forEach(function (k) { var c = cats[k]; if (c.n >= 2 && (!best || c.n > best.n || c.n === best.n && c.t > best.t)) best = { code: k, n: c.n, t: c.t, name: c.name }; });
    if (!best) return;
    get('/shop/c/' + best.code + '_srd/', 8000).catch(function () { return get('/shop/c/' + best.code + '/'); }).then(function (html) {
      var items = listItems(parseDoc(html)).filter(function (g) { return g.price; }).slice(0, 4);
      if (!items.length) return;
      var anchor = D.getElementById('block_of_event') || D.getElementById('block_of_top_free2');
      var el = section('catBanner', '<h4><span class="sis-tag">よく見ているカテゴリ</span>「' + esc(best.name) + '」の新着</h4><div class="sis-grid">' + items.map(function (g) { return card(g); }).join('') + '</div><p style="text-align:right;margin:10px 0 0"><a href="/shop/c/' + best.code + '/" style="color:#c4561a">「' + esc(best.name) + '」をすべて見る ›</a></p>', anchor, 'before');
      el.querySelectorAll('a').forEach(function (a) { a.onclick = function () { track('catBanner', 'click', { sis_label: best.code }); }; });
    });
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
    if (active && label(active) === memo) hint = h('<div class="sis-root sis-size-hint">✓ いつものサイズ「<b>' + esc(memo) + '</b>」を選んでいます（' + esc(cat) + '）</div>');
    else {
      var a = target.querySelector('a'); var dis = /disable|soldout|nostock/.test(target.className);
      hint = h('<div class="sis-root sis-size-hint">いつものサイズは「<b>' + esc(memo) + '</b>」です。' + (a && !dis ? ' <a href="' + esc(a.getAttribute('href')) + '">「' + esc(memo) + '」に切り替える ›</a>' : '（このカラーは「' + esc(memo) + '」の在庫がありません）') + '</div>');
      var link = hint.querySelector('a'); if (link) link.onclick = function () { track('sizeMemo', 'switch', { sis_label: memo }); };
    }
    list.parentNode.insertBefore(hint, list); SIS.active.sizeMemo = 'on'; track('sizeMemo', 'impression', { sis_label: memo });
  };
  function recordViewed() {
    if (PAGE !== 'goods') return;
    var code = codeOf(P); if (!code) return;
    var v = (ls('viewed') || []).filter(function (x) { return x.code !== code && stem(x.code) !== stem(code); });
    v.unshift({ code: code, t: Date.now() }); ls('viewed', v.slice(0, 12));
  }

  /* 12. 在庫僅少バッジ（メルカートの在庫表示「△」をそのまま使う） */
  FX.lowStock = function () {
    if (PAGE !== 'goods') return;
    var s = D.getElementById('spec_stock_msg'); if (!s) return;
    var t = s.textContent.trim(); if (!/△|残りわずか|僅少/.test(t)) return;
    var price = D.querySelector('.block-goods-price');
    if (price) price.parentNode.insertBefore(h('<div class="sis-root"><span class="sis-badge">残りわずか</span></div>'), price);
    var btn = D.querySelector('.block-add-cart');
    if (btn) btn.parentNode.insertBefore(h('<div class="sis-root" style="font-size:13px;color:#e8473b;font-weight:bold;margin:6px 0">このカラー・サイズは在庫が残りわずかです</div>'), btn);
    SIS.active.lowStock = 'on'; track('lowStock', 'impression', { sis_label: codeOf(P) });
  };

  /* 13. 売れ筋ランキング（data/ranking.json があるときだけ） */
  FX.ranking = function () {
    if (PAGE !== 'top' && PAGE !== 'list') return;
    fetch(CDN + 'data/ranking.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (rk) {
      var codes = (rk.items || []).slice(0, 8).map(function (x) { return x.code; }); if (!codes.length) return;
      return Promise.all(codes.map(goodsInfo)).then(function (arr) {
        arr = arr.filter(function (g) { return g && !g.soldout; }).slice(0, 4); if (!arr.length) return;
        var anchor = D.getElementById('block_of_event');
        section('ranking', '<h4><span class="sis-tag">売れ筋</span>' + esc(rk.title || '今週の売れ筋') + '<span style="font-size:12px;color:#888;font-weight:normal">集計：' + esc(rk.period || '') + '</span></h4><div class="sis-grid">' + arr.map(function (g, i) { return card(g).replace('<div class="sis-cn">', '<div class="sis-cn"><b style="color:#c4561a">' + (i + 1) + '位</b> '); }).join('') + '</div>', anchor, 'before');
      });
    }).catch(function () { SIS.active.ranking = 'データ待ち'; });
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
      goodsInfo(first.code).then(function (g) {
        var rest = SHOP.freeShipping - c.total;
        var el = toast('cartReminder', (g && g.img ? '<img src="' + esc(g.img) + '" alt="">' : '') +
          '<div style="flex:1;font-size:14px"><b>前回のお買い物がカートに残っています</b><br>' + esc(first.name) + (c.items.length > 1 ? ' ほか' : '') + '（' + c.count + '点・' + yen(c.total) + '）' +
          (rest > 0 ? '<br><span style="font-size:12px;color:#888">あと' + yen(rest) + 'で送料無料</span>' : '') + '</div>' +
          '<a class="sis-btn" style="padding:8px 14px;font-size:13px;flex:none" href="/shop/cart/cart.aspx">カートへ</a>');
        el.querySelector('a.sis-btn').onclick = function () { track('cartReminder', 'click'); };
      });
    });
  };

  /* 17. カート内クロスセル（送料無料まであと少しの人へ） */
  FX.crossSell = function () {
    if (PAGE !== 'cart') return;
    cart(true).then(function (c) {
      if (!c.count) return;
      var rest = SHOP.freeShipping - c.total; if (rest <= 0) return;
      var inCart = {}; c.items.forEach(function (i) { inCart[stem(i.code)] = 1; });
      var base = SHOP.salePage.replace(/\/$/, '');
      var pages = [base + '_ssp/', base + '_ssp/?p=2', base + '_ssp/?p=3', base + '_ssp/?p=4'];
      var found = [];
      (function next(i) {
        if (i >= pages.length || found.length >= 8) return done();
        get(pages[i], 8000).then(function (html) {
          listItems(parseDoc(html)).forEach(function (g) { if (g.price >= rest && !inCart[stem(g.code)]) found.push(g); });
          if (found.length >= 4) return done(); next(i + 1);
        }).catch(done);
      })(0);
      function done() {
        if (done.ran) return; done.ran = 1;
        found.sort(function (a, b) { return a.price - b.price; });
        var pick = found.slice(0, 4); if (!pick.length) return;
        var anchor = D.querySelector('.block-cart--container') || D.querySelector('.block-cart');
        var el = section('crossSell', '<h4><span class="sis-tag">あと ' + yen(rest) + ' で送料無料</span>1点足すと送料が無料になるアイテム</h4><div class="sis-grid">' + pick.map(function (g) { return card(g, { add: true }); }).join('') + '</div><p class="sis-note">' + esc(SHOP.saleName) + ' の商品から、' + yen(rest) + '以上で価格の近い順に表示しています</p>', anchor, 'after');
        bindAdd(el);
      }
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
  var NAMES = { welcome: '初回ポップアップ', exit: '離脱時ポップアップ', source: '流入元別の出し分け', coupon: '入店時クーポン', shipbar: '送料無料バー', countdown: '期限カウントダウン', kuji: 'くじ', rank: '会員ランク別UI', newRepeat: '新規／リピーター', catBanner: '閲覧カテゴリ別バナー', sizeMemo: 'サイズ記憶', lowStock: '在庫僅少バッジ', ranking: '売れ筋ランキング', extraOff: 'さらに◯%OFF', coord: 'コーデまとめ買い', cartReminder: 'カゴ落ち表示', crossSell: 'カート内クロスセル' };
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

  SIS.show = function (k) { var fn = FX[k === 'cart' ? 'cartReminder' : k]; if (fn) fn(true); };

  /* ---------- 起動 ---------- */
  onReady(function () {
    style();
    recordViewed();
    var order = ['countdown', 'source', 'coupon', 'rank', 'shipbar', 'newRepeat', 'catBanner', 'ranking', 'sizeMemo', 'lowStock', 'extraOff', 'coord', 'crossSell', 'cartReminder', 'welcome', 'kuji', 'exit'];
    var only = (Q.get('sis_only') || '').split(',').filter(Boolean);
    order.forEach(function (k) { if (F[k] === false || !FX[k] || only.length && only.indexOf(k) < 0) return; try { FX[k](false); } catch (e) { SIS.active[k] = 'エラー'; if (window.console) console.warn('[SIS]', k, e); } });
    var sh = Q.get('sis_show'); if (sh) setTimeout(function () { SIS.show(sh); }, 600);
    chip(); renderDebug();
  });
})();
