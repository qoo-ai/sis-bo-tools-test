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
  /* 裏で読むページは同時に2件まで。お客様がカートに入れる・ページを移るときは裏の読み込みをすべて止める
     （メルカートは同じお客様のリクエストを順番に処理するため、裏の読み込みが多いとカート投入が待たされる） */
  var getQ = [], getN = 0, getAll = [], stopped = false;
  function stopAll() { stopped = true; getQ.length = 0; getAll.forEach(function (ac) { try { ac.abort(); } catch (e) {} }); getAll = []; }
  D.addEventListener('submit', stopAll, true);
  D.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href], button[type="submit"], input[type="submit"], .block-add-cart--btn'); if (a && !(a.closest && a.closest('.sis-root')) && !/^#|javascript:/i.test(a.getAttribute('href') || '')) stopAll(); }, true);
  addEventListener('pagehide', stopAll);
  function get(url, ms) {
    if (stopped) return Promise.reject(new Error('stopped'));
    return new Promise(function (res, rej) {
      getQ.push(function () {
        var ac = new AbortController(); getAll.push(ac); var t = setTimeout(function () { ac.abort(); }, ms || 8000);
        return fetch(url, { credentials: 'include', signal: ac.signal, priority: 'low' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
          .then(res, rej).then(function () { clearTimeout(t); getAll = getAll.filter(function (x) { return x !== ac; }); });
      });
      (function pumpGet() { while (getN < 2 && getQ.length) { getN++; getQ.shift()().then(function () { getN--; pumpGet(); }); } })();
    });
  }
  function codeOf(href) { var m = String(href || '').match(/\/shop\/g\/g([^/?#]+)\/?/); return m ? m[1] : null; }
  function pkey(code) { var p = String(code).split('-'); return p.length < 4 ? code : p[0] + '-' + p[1] + '-' + p[2]; } // 色違いをまとめた番号（商品番号-サイズ番号-シーズン）
  function uniqProduct(arr) { var s = {}; return arr.filter(function (g) { var k = pkey(g.code), nm = (g.name || '').split(/[（(￥¥]/)[0].replace(/\s+/g, ' ').trim(); nm = nm ? 'n:' + nm : ''; if (s[k] || (nm && s[nm])) return false; s[k] = 1; if (nm) s[nm] = 1; return true; }); } // 色・サイズ違い（同じ商品名）は1つにまとめる
  function stem(code) { return pkey(code); }

  /* ---------- 訪問・セッション ---------- */
  var vid = ls('vid'); if (!vid) { vid = Math.random().toString(36).slice(2) + Date.now().toString(36); ls('vid', vid); }
  var newSession = !ss('sess'); if (newSession) { ss('sess', 1); ls('visits', (ls('visits') || 0) + 1); }
  var visits = ls('visits') || 1;
  var isNew = Q.get('sis_visit') ? Q.get('sis_visit') === 'new' : visits <= ((C.visitor || {}).newUntilVisits || 1);
  ss('pv', (ss('pv') || 0) + 1);

  /* ---------- ABテスト・計測 ---------- */
  function hash(s) { // 訪問者ID全体から作る番号（末尾の数字ではない）。最後に混ぜ直して、施策ごとの振り分けが互いに偏らないようにする
    var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return x >>> 0;
  }
  var abOverride = {}; (Q.get('sis_ab') || '').split(',').forEach(function (kv) { var p = kv.split(':'); if (p[1]) abOverride[p[0]] = p[1]; });
  function ab(test) {
    var t = (C.ab || {})[test]; if (!t || !F.ab) return 'A';
    var hv = hash(vid + ':' + test), v = abOverride[test];
    if (!v && t.weights) { var r = hv % 100, acc = 0; for (var i = 0; i < t.variants.length; i++) { acc += t.weights[i] || 0; if (r < acc) { v = t.variants[i]; break; } } } // weights:[70,30] でA70%・B30%
    if (!v) v = t.variants[hv % t.variants.length];
    SIS.active['ab:' + test] = v; return v;
  }
  function track(feature, action, extra) {
    var e = { event: (C.ga4 || {}).eventName || 'sis_event', sis_feature: feature, sis_action: action, sis_page: PAGE, sis_device: SP ? 'sp' : 'pc' };
    var t = (C.ab || {})[feature]; if (t) e.sis_variant = ab(feature);
    for (var k in extra || {}) e[k] = extra[k];
    e.time = now().toTimeString().slice(0, 8);
    if (/click|add|copy|draw|go/.test(action) && feature !== 'session') { var tc = ss('touched') || []; if (tc.indexOf(feature) < 0) { tc.push(feature); ss('touched', tc); } } // 注文完了のときに「この訪問で触った施策」として送る
    SIS.events.push(e); renderDebug();
    var staff = true; // 現在は関係者限定（?sis=p）でのみ読み込まれる
    if (F.ga4 && (!staff || (C.ga4 || {}).sendInStaffMode)) { try { (window.dataLayer = window.dataLayer || []).push(e); } catch (x) {} }
  }

  /* ---------- 見た目（drug store's の紫・コーラルに合わせた部品） ---------- */
  var ICON = {
    truck: '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    ticket: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M9 6v12" stroke-dasharray="2 2"/>',
    gift: '<path d="M4 11h16v9H4z"/><path d="M3 7h18v4H3z"/><path d="M12 7v13"/><path d="M12 7c-2-3-6-3-6-1s4 1 6 1zm0 0c2-3 6-3 6-1s-4 1-6 1z"/>',
    fire: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    cart: '<path d="M3 4h2l2 11h11l2-8H6"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
    check: '<path d="M5 12l4 4 10-10"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    spark: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
    ruler: '<path d="M3 15L15 3l6 6L9 21z"/><path d="M7 11l2 2M10 8l2 2M13 5l2 2"/>',
    heart: '<path d="M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    store: '<path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6z"/><path d="M10 20v-5h4v5"/>',
    arrow: '<path d="M9 5l7 7-7 7"/>',
    down: '<path d="M12 4v14M6 13l6 6 6-6"/>',
    shirt: '<path d="M8 3l-5 3 2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>'
  };
  function ic(n, cls) { return '<svg class="sis-ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[n] || '') + '</svg>'; }
  var css = [
    ':root{--sis-p:#633783;--sis-pd:#4E2A69;--sis-pl:#F5F0F9;--sis-pm:#E6DBEF;--sis-c:#FF8363;--sis-cd:#E8613F;--sis-cl:#FFF2EC;--sis-cm:#FFD9CB;--sis-r:#D8361F;--sis-rl:#FDEDEA;--sis-g:#06C755;--sis-gl:#E7F8EE;--sis-y:#F0A800;--sis-yl:#FFF6D9;--sis-ink:#2E2433;--sis-mu:#6F6677;--sis-ln:#ECE5F1;--sis-sh:0 8px 28px rgba(46,36,51,.14);--sis-sh2:0 2px 8px rgba(46,36,51,.08)}',
    '.sis-root,.sis-root *{box-sizing:border-box}',
    '.sis-root{font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic",Meiryo,sans-serif;color:var(--sis-ink);line-height:1.6;letter-spacing:.02em;-webkit-font-smoothing:antialiased}',
    '.sis-ic{width:20px;height:20px;flex:none;display:inline-block;vertical-align:middle}',
    /* ボタン */
    '.sis-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 22px;border-radius:999px;background:var(--sis-c);color:#fff!important;font-weight:700;text-decoration:none!important;border:0;cursor:pointer;font-size:15px;line-height:1.2;box-shadow:0 4px 12px rgba(255,131,99,.35);transition:transform .15s ease-out,background .15s ease-out,box-shadow .15s}',
    '.sis-btn:hover{background:var(--sis-cd);transform:translateY(-1px)}.sis-btn:active{transform:translateY(0);box-shadow:none}.sis-btn:focus-visible{outline:3px solid var(--sis-pm);outline-offset:2px}',
    '.sis-btn[disabled]{opacity:.6;cursor:default;transform:none}',
    '.sis-btn.sis-sm{min-height:36px;padding:0 16px;font-size:13px;box-shadow:none}',
    '.sis-btn.sis-block{display:flex;width:100%;min-height:52px;font-size:16px;border-radius:14px}',
    '.sis-btn.sis-line{background:var(--sis-g);box-shadow:0 4px 12px rgba(6,199,85,.3)}.sis-btn.sis-line:hover{background:#05b04b}',
    '.sis-btn.sis-pur{background:var(--sis-p);box-shadow:0 4px 12px rgba(99,55,131,.3)}.sis-btn.sis-pur:hover{background:var(--sis-pd)}',
    '.sis-btn.sis-ghost{background:#fff;color:var(--sis-ink)!important;border:1px solid var(--sis-ln);box-shadow:none;font-weight:500}.sis-btn.sis-ghost:hover{background:var(--sis-pl)}',
    '.sis-link{background:none;border:0;color:var(--sis-mu);font-size:13px;cursor:pointer;padding:10px;text-decoration:underline;font-family:inherit}',
    '.sis-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;background:var(--sis-cl);color:var(--sis-cd);line-height:1.4;white-space:nowrap}',
    '.sis-tag.sis-t-p{background:var(--sis-pl);color:var(--sis-p)}.sis-tag.sis-t-r{background:var(--sis-r);color:#fff}.sis-tag.sis-t-g{background:var(--sis-gl);color:#05964a}.sis-tag.sis-t-y{background:var(--sis-yl);color:#8a5d00}',
    '.sis-tag .sis-ic{width:14px;height:14px}',
    /* 上部のバナー列 */
    '#sis-strips{display:flex;flex-direction:column;gap:8px;max-width:1200px;margin:12px auto;padding:0 12px}',
    '.sis-bnr{display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:14px;background:#fff;border:1px solid var(--sis-ln);box-shadow:var(--sis-sh2);position:relative;overflow:hidden}',
    '.sis-bnr:before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--sis-tone,var(--sis-c))}',
    '.sis-bnr-ic{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none;background:var(--sis-tonel,var(--sis-cl));color:var(--sis-tone,var(--sis-c))}.sis-bnr-ic .sis-ic{width:24px;height:24px}',
    '.sis-bnr-tx{flex:1;min-width:0}.sis-bnr-k{font-size:12px;font-weight:700;color:var(--sis-tone,var(--sis-cd))}.sis-bnr-t{font-size:15px;font-weight:700;line-height:1.45}.sis-bnr-t b{color:var(--sis-cd)}.sis-bnr-s{font-size:12px;color:var(--sis-mu)}',
    '.sis-bnr-r{display:flex;align-items:center;gap:12px;flex:none}',
    '.sis-tone-sale{--sis-tone:var(--sis-c);--sis-tonel:var(--sis-cl)}.sis-tone-p{--sis-tone:var(--sis-p);--sis-tonel:var(--sis-pl)}.sis-tone-g{--sis-tone:var(--sis-g);--sis-tonel:var(--sis-gl)}.sis-tone-r{--sis-tone:var(--sis-r);--sis-tonel:var(--sis-rl)}.sis-tone-y{--sis-tone:var(--sis-y);--sis-tonel:var(--sis-yl)}',
    /* カウントダウンのタイル */
    '.sis-tiles{display:inline-flex;align-items:flex-end;gap:4px;font-variant-numeric:tabular-nums}',
    '.sis-tiles span{display:flex;flex-direction:column;align-items:center}',
    '.sis-tiles b{display:block;min-width:36px;padding:4px 4px;border-radius:8px;background:var(--sis-p);color:#fff;font-size:20px;line-height:1.2;text-align:center;font-weight:700}',
    '.sis-tiles small{font-size:10px;color:var(--sis-mu);margin-top:2px}',
    '.sis-tiles i{font-style:normal;font-weight:700;color:var(--sis-p);padding-bottom:18px}',
    /* クーポン券 */
    '.sis-tk{display:inline-flex;align-items:stretch;border-radius:12px;background:var(--sis-c);color:#fff;position:relative;filter:drop-shadow(0 4px 10px rgba(255,131,99,.3));text-align:left;max-width:100%}',
    '.sis-tk:before,.sis-tk:after{content:"";position:absolute;left:calc(var(--sis-tkw,96px) - 9px);width:18px;height:18px;border-radius:50%;background:var(--sis-holebg,#fff)}.sis-tk:before{top:-9px}.sis-tk:after{bottom:-9px}',
    '.sis-tk-l{width:var(--sis-tkw,96px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 10px;border-right:2px dashed rgba(255,255,255,.7);flex:none}',
    '.sis-tk-l b{font-size:28px;line-height:1;font-weight:800;letter-spacing:0}.sis-tk-l small{font-size:12px;font-weight:700}.sis-tk-l b.sis-tk-txt{font-size:17px}',
    '.sis-tk-r{display:flex;align-items:center;gap:10px;padding:8px 12px 8px 16px;background:#fff;color:var(--sis-ink);border-radius:0 12px 12px 0;margin:2px 2px 2px 0}',
    '.sis-tk-r small{display:block;font-size:11px;color:var(--sis-mu);line-height:1.2}.sis-tk-r code{display:block;font-family:inherit;font-size:19px;font-weight:800;letter-spacing:.06em;color:var(--sis-cd);line-height:1.3}',
    '.sis-tk-r button{min-height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--sis-c);background:#fff;color:var(--sis-cd);font-weight:700;font-size:12px;cursor:pointer;font-family:inherit}.sis-tk-r button:hover{background:var(--sis-cl)}',
    '.sis-pending{color:var(--sis-mu)!important;font-size:13px!important;font-weight:500!important;letter-spacing:0!important}',
    /* ポップアップ */
    '.sis-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(46,36,51,.55);display:flex;align-items:center;justify-content:center;padding:16px;animation:sisfade .2s ease-out}',
    '.sis-modal{position:relative;width:100%;max-width:420px;max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:22px;text-align:center;box-shadow:0 20px 60px rgba(46,36,51,.3);animation:sispop .28s cubic-bezier(.2,.9,.3,1.2)}',
    '.sis-mhd{position:relative;padding:28px 24px 20px;background:var(--sis-tonel,var(--sis-cl));overflow:hidden}',
    '.sis-mhd:after{content:"";position:absolute;right:-30px;top:-30px;width:120px;height:120px;border-radius:50%;background:var(--sis-tone,var(--sis-c));opacity:.12}',
    '.sis-mhd:before{content:"";position:absolute;left:-20px;bottom:-40px;width:90px;height:90px;border-radius:50%;background:var(--sis-tone,var(--sis-c));opacity:.08}',
    '.sis-mic{width:64px;height:64px;border-radius:20px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;background:var(--sis-tone,var(--sis-c));color:#fff;box-shadow:0 8px 18px rgba(46,36,51,.18);position:relative;z-index:1}.sis-mic .sis-ic{width:34px;height:34px}',
    '.sis-mhd .sis-tag{position:relative;z-index:1;background:#fff;color:var(--sis-tone,var(--sis-cd))}',
    '.sis-modal h3{margin:8px 0 0;font-size:22px;line-height:1.4;color:var(--sis-ink);font-weight:800;position:relative;z-index:1}',
    '.sis-modal h3 em{font-style:normal;color:var(--sis-tone,var(--sis-cd))}',
    '.sis-mimg img{width:100%;display:block}.sis-mhd.sis-mhd-s{padding:14px 24px 4px;background:#fff}.sis-mhd.sis-mhd-s:before,.sis-mhd.sis-mhd-s:after{display:none}.sis-mhd-s .sis-tag{background:var(--sis-tonel,var(--sis-cl))}',
    '.sis-mbd{padding:20px 24px 16px}.sis-mbd p{margin:8px 0;font-size:14px}',
    '.sis-x{position:absolute;top:10px;right:10px;width:36px;height:36px;border:0;border-radius:50%;background:rgba(255,255,255,.9);font-size:20px;line-height:36px;color:var(--sis-mu);cursor:pointer;z-index:3;padding:0}.sis-x:hover{background:#fff;color:var(--sis-ink)}',
    '.sis-perks{list-style:none;margin:0 0 16px;padding:0;text-align:left;display:flex;flex-direction:column;gap:8px}',
    '.sis-perks li{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--sis-pl);font-size:14px;font-weight:500}',
    '.sis-perks li .sis-ic{color:var(--sis-tone,var(--sis-p));width:22px;height:22px}',
    '.sis-x2{font-size:10px;color:#b3abb9;margin-top:4px}',
    '.sis-items{display:flex;flex-direction:column;gap:8px;margin:0 0 14px;text-align:left}',
    '.sis-item{display:flex;align-items:center;gap:10px;padding:8px;border-radius:12px;border:1px solid var(--sis-ln)}.sis-item img{width:52px;height:52px;border-radius:8px;object-fit:cover;flex:none;background:#f4f1f6}',
    '.sis-item div{font-size:13px;line-height:1.45;min-width:0}.sis-item small{color:var(--sis-mu)}',
    /* くじ */
    '.sis-kuji{display:flex;gap:12px;justify-content:center;margin:6px 0 14px;perspective:800px}',
    '.sis-kc{width:96px;height:128px;border:0;padding:0;background:none;cursor:pointer;position:relative}',
    '.sis-kc-in{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .6s cubic-bezier(.3,.8,.3,1)}',
    '.sis-kc.sis-open .sis-kc-in{transform:rotateY(180deg)}',
    '.sis-kc-f,.sis-kc-b{position:absolute;inset:0;border-radius:14px;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}',
    '.sis-kc-f{background:var(--sis-p);color:#fff;box-shadow:0 6px 16px rgba(99,55,131,.35);background-image:radial-gradient(rgba(255,255,255,.16) 2px,transparent 2px);background-size:14px 14px}',
    '.sis-kc-f b{font-size:40px;line-height:1;color:#ffd36b}.sis-kc-f small{font-size:11px;letter-spacing:.1em}',
    '.sis-kc:not(.sis-open):hover .sis-kc-in{transform:translateY(-6px) rotate(-2deg)}',
    '.sis-kc-b{transform:rotateY(180deg);background:#fff;border:3px solid var(--sis-y);color:var(--sis-ink)}',
    '.sis-kc-b b{font-size:22px;line-height:1.1;color:var(--sis-cd);font-weight:800}.sis-kc-b small{font-size:11px;color:var(--sis-mu)}',
    '.sis-kc.sis-dim .sis-kc-b{border-color:var(--sis-ln);opacity:.55}.sis-kc.sis-win .sis-kc-b{box-shadow:0 0 0 6px rgba(240,168,0,.25),0 8px 20px rgba(240,168,0,.35)}',
    '.sis-kc .sis-kc-win{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:var(--sis-y);color:#fff;font-size:11px;font-weight:800;padding:2px 10px;border-radius:999px;white-space:nowrap}',
    '.sis-conf{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2}.sis-conf i{position:absolute;top:-12px;width:8px;height:14px;border-radius:2px;animation:sisfall 1.6s ease-in forwards}',
    '.sis-res{animation:sisup2 .35s ease-out}.sis-res h4{margin:4px 0 10px;font-size:18px;font-weight:800;color:var(--sis-cd)}',
    '.sis-fab{position:fixed;right:16px;bottom:96px;z-index:2147481000;width:72px;height:72px;border-radius:50%;background:var(--sis-p);border:3px solid #fff;color:#fff;cursor:pointer;box-shadow:0 8px 20px rgba(99,55,131,.4);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding:0;font-family:inherit}',
    '.sis-fab .sis-ic{width:30px;height:30px;color:#ffd36b}.sis-fab span{font-size:12px;font-weight:800;line-height:1.1}',
    '.sis-fab em{position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);background:var(--sis-c);color:#fff;font-style:normal;font-size:10px;font-weight:700;padding:1px 8px;border-radius:999px;white-space:nowrap}',
    '.sis-fab:before{content:"";position:absolute;inset:-3px;border-radius:50%;border:3px solid var(--sis-p);animation:sisring 2s ease-out infinite}',
    /* 下部の送料バー */
    '.sis-shipfix{position:fixed;left:0;right:0;bottom:0;z-index:2147481500;background:#fff;border-top:1px solid var(--sis-ln);box-shadow:0 -6px 20px rgba(46,36,51,.1);animation:sisup3 .3s ease-out}',
    '.sis-ship{display:flex;align-items:center;gap:14px;max-width:1200px;margin:0 auto;padding:10px 56px 10px 16px}',
    '.sis-ship-ic{width:44px;height:44px;border-radius:50%;background:var(--sis-cl);color:var(--sis-cd);display:flex;align-items:center;justify-content:center;flex:none}.sis-ship-ic .sis-ic{width:24px;height:24px}',
    '.sis-ship-ic.sis-done{background:var(--sis-gl);color:#05964a}',
    '.sis-ship-m{flex:1;min-width:0}.sis-ship-t{font-size:15px;font-weight:700;line-height:1.4}.sis-ship-t b{color:var(--sis-cd);font-size:19px}',
    '.sis-trk{position:relative;height:8px;border-radius:99px;background:var(--sis-cl);margin:6px 0 2px}.sis-trk i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:var(--sis-c)}',
    '.sis-trk u{position:absolute;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#fff;border:3px solid var(--sis-c);text-decoration:none}',
    '.sis-trk-l{display:flex;justify-content:space-between;font-size:11px;color:var(--sis-mu)}',
    '.sis-shipfix .sis-x{top:50%;transform:translateY(-50%);right:8px;background:transparent}',
    /* 画面下・右下のお知らせ */
    '.sis-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:2147482000;width:calc(100% - 24px);max-width:560px;background:#fff;border-radius:18px;box-shadow:var(--sis-sh);padding:14px 48px 14px 14px;display:flex;gap:12px;align-items:center;animation:sisup .3s ease-out;border:1px solid var(--sis-ln)}',
    '.sis-thumbs{display:flex;flex:none}.sis-thumbs img{width:56px;height:56px;object-fit:cover;border-radius:12px;border:2px solid #fff;box-shadow:var(--sis-sh2);background:#f4f1f6}.sis-thumbs img+img{margin-left:-22px}',
    '.sis-tb{flex:1;min-width:0;font-size:13px;line-height:1.5}.sis-tb .sis-tt{font-size:15px;font-weight:800}.sis-tb .sis-ts{color:var(--sis-mu)}',
    '.sis-low{display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:2px 8px;border-radius:6px;background:var(--sis-rl);color:var(--sis-r);font-size:12px;font-weight:700}.sis-low .sis-ic{width:14px;height:14px}',
    '.sis-alert{position:fixed;right:16px;bottom:16px;z-index:2147482500;width:340px;max-width:calc(100% - 24px);background:#fff;border-radius:18px;box-shadow:var(--sis-sh);padding:12px 40px 14px 12px;display:flex;gap:12px;align-items:center;animation:sisslide .35s cubic-bezier(.2,.9,.3,1.2);transition:opacity .4s,transform .4s;border:1px solid var(--sis-ln);overflow:hidden;text-decoration:none!important;color:var(--sis-ink)!important}',
    '.sis-alert img{width:64px;height:64px;object-fit:cover;border-radius:12px;flex:none;background:#f4f1f6}',
    '.sis-alert .sis-tb .sis-tt{font-size:13px;font-weight:700;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.sis-alert .sis-why{font-size:14px;font-weight:800;margin-top:2px}.sis-alert .sis-why.r{color:var(--sis-r)}.sis-alert .sis-why.c{color:var(--sis-cd)}.sis-alert .sis-why.g{color:#05964a}',
    '.sis-alert .sis-timer{position:absolute;left:0;bottom:0;height:3px;background:var(--sis-c);animation:sistimer linear forwards}',
    '.sis-alert .sis-x{top:6px;right:6px;width:32px;height:32px;line-height:32px;font-size:18px}',
    /* セクション・商品カード */
    '.sis-sec{margin:24px auto;max-width:1200px;padding:20px;border-radius:20px;background:#fff;border:1px solid var(--sis-ln);box-shadow:var(--sis-sh2)}',
    '.sis-sh{display:flex;align-items:center;gap:12px;margin:0 0 14px}',
    '.sis-sh-ic{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none;background:var(--sis-tonel,var(--sis-cl));color:var(--sis-tone,var(--sis-cd))}.sis-sh-ic .sis-ic{width:22px;height:22px}',
    '.sis-sh-t{flex:1;min-width:0}.sis-sh-t h4{margin:0;font-size:18px;font-weight:800;line-height:1.4;color:var(--sis-ink)}.sis-sh-t small{display:block;font-size:12px;color:var(--sis-mu)}',
    '.sis-more{display:inline-flex;align-items:center;gap:2px;font-size:13px;font-weight:700;color:var(--sis-p)!important;text-decoration:none!important;white-space:nowrap;min-height:44px}.sis-more .sis-ic{width:16px;height:16px}',
    '.sis-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}',
    '.sis-grid.sis-4>:nth-child(n+5){display:none}',
    '.sis-card{display:flex;flex-direction:column;background:#fff;border-radius:14px;overflow:hidden;text-decoration:none!important;color:var(--sis-ink)!important;font-size:12px;position:relative;transition:transform .15s ease-out,box-shadow .15s}',
    '.sis-card:hover{transform:translateY(-3px);box-shadow:var(--sis-sh)}',
    '.sis-card .sis-im{position:relative;border-radius:14px;overflow:hidden;background:#f4f1f6}',
    '.sis-card img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block}',
    '.sis-card .sis-bd{position:absolute;left:8px;top:8px;display:flex;flex-direction:column;gap:4px;align-items:flex-start}',
    '.sis-medal{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;background:var(--sis-p);box-shadow:var(--sis-sh2)}.sis-medal.m1{background:#E0A800}.sis-medal.m2{background:#9AA3AE}.sis-medal.m3{background:#C07A45}',
    '.sis-card .sis-cn{padding:8px 2px 0;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:3em}',
    '.sis-card .sis-cp{padding:2px 2px 0;font-weight:800;font-size:15px;color:var(--sis-ink)}.sis-card .sis-cp.sale{color:var(--sis-r)}.sis-card .sis-cp s{font-size:11px;color:var(--sis-mu);font-weight:400;margin-left:4px}',
    '.sis-card .sis-why2{font-size:11px;font-weight:700;color:var(--sis-p);padding:6px 2px 0}',
    '.sis-card .sis-add{display:flex;align-items:center;justify-content:center;gap:4px;margin:8px 0 2px;min-height:40px;border-radius:999px;border:1.5px solid var(--sis-c);color:var(--sis-cd);background:#fff;font-size:13px;font-weight:700;cursor:pointer;width:100%;font-family:inherit}.sis-card .sis-add:hover{background:var(--sis-c);color:#fff}',
    '.sis-guide{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}',
    '.sis-gc{display:flex;gap:12px;align-items:flex-start;padding:16px;border-radius:16px;background:var(--sis-pl);text-decoration:none!important;color:var(--sis-ink)!important;transition:transform .15s}.sis-gc:hover{transform:translateY(-2px)}',
    '.sis-gc .sis-sh-ic{background:#fff;color:var(--sis-p)}.sis-gc b{display:block;font-size:15px}.sis-gc span{font-size:13px;color:var(--sis-mu)}',
    /* 商品ページの案内 */
    '.sis-hint{display:flex;align-items:center;gap:10px;margin:8px 0;padding:10px 12px;border-radius:12px;background:var(--sis-pl);font-size:13px;line-height:1.5;color:var(--sis-ink)}',
    '.sis-hint .sis-ic{color:var(--sis-p);width:22px;height:22px}.sis-hint b{color:var(--sis-p)}.sis-hint a{color:var(--sis-cd);font-weight:700}',
    '.sis-hint.sis-hc{background:var(--sis-cl)}.sis-hint.sis-hc .sis-ic,.sis-hint.sis-hc b{color:var(--sis-cd)}',
    '.sis-hint.sis-hr{background:var(--sis-rl)}.sis-hint.sis-hr .sis-ic,.sis-hint.sis-hr b{color:var(--sis-r)}',
    '.sis-memo-on{box-shadow:0 0 0 3px var(--sis-c)!important;border-radius:4px}',
    '.sis-badge{display:inline-flex;align-items:center;gap:6px;margin:6px 0;padding:4px 12px;border-radius:999px;background:var(--sis-r);color:#fff;font-size:13px;font-weight:800}',
    '.sis-badge:before{content:"";width:8px;height:8px;border-radius:50%;background:#fff;animation:sisblink 1.2s infinite}',
    '.sis-proof{margin:12px 0;border-radius:16px;border:1px solid var(--sis-ln);overflow:hidden;background:#fff}',
    '.sis-proof-h{display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--sis-pl);font-size:12px;font-weight:800;color:var(--sis-p)}',
    '.sis-proof ul{list-style:none;margin:0;padding:6px 14px}.sis-proof li{display:flex;align-items:center;gap:10px;padding:7px 0;font-size:14px;border-bottom:1px dashed var(--sis-ln)}.sis-proof li:last-child{border-bottom:0}',
    '.sis-proof li .sis-ic{width:22px;height:22px;color:var(--sis-p)}.sis-proof li b{font-size:17px;color:var(--sis-ink)}.sis-proof li.hot .sis-ic,.sis-proof li.hot b{color:var(--sis-r)}',
    '.sis-proof-f{padding:0 14px 8px;font-size:11px;color:var(--sis-mu)}',
    '.sis-coord{display:grid;grid-template-columns:240px 1fr;gap:20px;align-items:start}',
    '.sis-coord>a img{width:100%;border-radius:16px;display:block}',
    '.sis-coord .sis-grid{grid-template-columns:repeat(3,1fr)}',
    '.sis-sum{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:16px 0 0;padding:14px 16px;border-radius:16px;background:var(--sis-cl)}',
    '.sis-sum .sis-sum-p{font-size:13px}.sis-sum .sis-sum-p b{font-size:24px;color:var(--sis-cd);font-weight:800}',
    '.sis-xoff{display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:4px 10px;border-radius:8px;background:var(--sis-rl);color:var(--sis-r);font-size:12px;font-weight:800}',
    '.sis-rank{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:var(--sis-p);color:#fff;font-weight:800;font-size:13px}.sis-rank .sis-ic{width:16px;height:16px;color:#ffd36b}',
    '.sis-note{font-size:12px;color:var(--sis-mu);margin-top:8px}',
    '.sis-chip{position:fixed;left:10px;bottom:10px;z-index:2147483600;padding:6px 12px;border-radius:999px;background:#fff;border:1px solid var(--sis-ln);font-size:12px;color:var(--sis-mu);cursor:pointer;box-shadow:var(--sis-sh2)}',
    '.sis-panel{position:fixed;left:10px;bottom:46px;z-index:2147483600;width:340px;max-height:70vh;overflow:auto;background:#fff;border:1px solid var(--sis-ln);border-radius:14px;padding:12px;font-size:12px;box-shadow:var(--sis-sh)}',
    '.sis-panel table{width:100%;border-collapse:collapse}.sis-panel td{padding:3px 4px;border-bottom:1px solid #f1f1f1;vertical-align:top}',
    '@keyframes sisfade{from{opacity:0}to{opacity:1}}@keyframes sispop{from{transform:scale(.9) translateY(10px);opacity:0}to{transform:none;opacity:1}}',
    '@keyframes sisup{from{transform:translate(-50%,24px);opacity:0}to{transform:translate(-50%,0);opacity:1}}@keyframes sisup2{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}@keyframes sisup3{from{transform:translateY(100%)}to{transform:none}}',
    '@keyframes sisring{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.35);opacity:0}}@keyframes sisblink{50%{opacity:.25}}',
    '@keyframes sisslide{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}@keyframes sistimer{from{width:100%}to{width:0}}',
    '@keyframes sisfall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(520px) rotate(540deg);opacity:.2}}',
    /* スマホ */
    '.sis-sp #sis-strips{margin:8px auto;padding:0 10px;gap:6px}',
    '.sis-sp .sis-bnr{padding:10px 12px;gap:10px;flex-wrap:wrap;border-radius:12px}.sis-sp .sis-bnr-ic{width:36px;height:36px;border-radius:10px}.sis-sp .sis-bnr-t{font-size:14px}',
    '.sis-sp .sis-bnr-r{width:100%;justify-content:space-between;padding-left:46px}',
    '.sis-sp .sis-tiles b{min-width:32px;font-size:17px}',
    '.sis-sp .sis-sec{margin:16px 10px;padding:16px 12px;border-radius:16px}',
    '.sis-sp .sis-grid{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;margin:0 -12px;padding:0 12px 4px;-webkit-overflow-scrolling:touch;scrollbar-width:none}',
    '.sis-sp .sis-grid::-webkit-scrollbar{display:none}.sis-sp .sis-grid>*{flex:0 0 42%;scroll-snap-align:start}.sis-sp .sis-grid.sis-4>:nth-child(n+5){display:flex}',
    '.sis-sp .sis-guide{grid-template-columns:1fr}',
    '.sis-sp .sis-coord{grid-template-columns:1fr}.sis-sp .sis-coord .sis-grid>*{flex-basis:38%}',
    '.sis-sp .sis-modal h3{font-size:20px}.sis-sp .sis-kc{width:88px;height:118px}',
    '.sis-sp .sis-fab{bottom:88px;width:64px;height:64px}.sis-sp .sis-fab .sis-ic{width:26px;height:26px}',
    '.sis-sp .sis-ship{padding:8px 44px 8px 12px;gap:10px}.sis-sp .sis-ship-ic{width:36px;height:36px}.sis-sp .sis-ship-t{font-size:13px}.sis-sp .sis-ship-t b{font-size:16px}.sis-sp .sis-ship .sis-btn{min-height:40px;padding:0 14px;font-size:13px}',
    '.sis-sp .sis-alert{left:12px;right:12px;width:auto}',
    '.sis-sp .sis-tk-r code{font-size:16px}',
    '.sis-sp .sis-toast{flex-wrap:wrap;padding:12px 44px 12px 12px;gap:10px}.sis-sp .sis-toast .sis-thumbs img{width:48px;height:48px}.sis-sp .sis-toast .sis-tb{flex:1 1 calc(100% - 120px)}.sis-sp .sis-toast>.sis-btn{width:100%}',
    '.sis-sp .sis-sh-t h4{font-size:16px}.sis-sp .sis-sh{gap:10px}.sis-sp .sis-sh-ic{width:36px;height:36px}',
    '.sis-sp .sis-ship-t{white-space:nowrap}.sis-sp .sis-trk-l{font-size:10px}',
    /* v4：見出し・帯のアイコンを外す（作り物っぽさを消す）。くじのボタンだけ残す */
    '.sis-root .sis-ic{display:none}.sis-fab .sis-ic{display:inline-block}',
    '.sis-bnr-ic,.sis-sh-ic,.sis-mic,.sis-ship-ic{display:none!important}',
    '.sis-mhd{padding:24px 24px 18px}',
    /* v4：上部の帯（サイトのバナーに近い面の帯。白カード＋影はやめる） */
    '#sis-strips{gap:6px;margin:10px auto}',
    '.sis-bnr{background:var(--sis-tonel,var(--sis-cl));border:0;box-shadow:none;border-radius:10px;padding:10px 18px;gap:16px}',
    '.sis-bnr:before{display:none}',
    '.sis-bnr-k{display:inline-block;font-size:11px;letter-spacing:.06em;padding:1px 8px;border-radius:4px;background:var(--sis-tone,var(--sis-c));color:#fff!important;margin-bottom:2px}',
    '.sis-bnr-t{font-size:16px}.sis-bnr-t b{color:var(--sis-tone,var(--sis-cd))}',
    '.sis-bnr .sis-tiles b{background:#fff;color:var(--sis-tone,var(--sis-p));box-shadow:inset 0 0 0 1.5px var(--sis-tone,var(--sis-p))}.sis-bnr .sis-tiles i{color:var(--sis-tone,var(--sis-p))}',
    '.sis-bnr .sis-tk{--sis-holebg:var(--sis-tonel,var(--sis-cl))}',
    '.sis-sp .sis-bnr{padding:10px 12px}.sis-sp .sis-bnr-r{padding-left:0}.sis-sp .sis-bnr-t{font-size:14px}',
    /* v4：ヘッダーのバナーを2つに分ける（左＝今のバナー画像、右＝残り時間とコードのコピー） */
    '.sis-hsplit{display:flex;height:100%;background:#fff}.sis-hsplit>a{flex:0 0 auto;display:block;height:100%}.sis-hsplit>a img{height:100%;width:auto;display:block}',
    '.sis-hs-r{flex:1;display:flex;align-items:center;justify-content:center;gap:18px;padding:0 20px;background:var(--sis-pl);min-width:0}',
    '.sis-hs-r .sis-hs-t{font-size:13px;font-weight:700;color:var(--sis-p);line-height:1.4}.sis-hs-r .sis-hs-t b{display:block;font-size:18px;color:var(--sis-ink)}',
    '.sis-hs-code{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 14px;border-radius:999px;background:#fff;border:2px dashed var(--sis-c)}.sis-hs-code code{font-family:inherit;font-size:18px;font-weight:800;letter-spacing:.06em;color:var(--sis-cd)}',
    '.sis-hs-code button{min-height:34px;padding:0 14px;border-radius:999px;border:0;background:var(--sis-c);color:#fff;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit}',
    '.sis-hsplit-sp{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;background:var(--sis-pl)}.sis-hsplit-sp .sis-hs-t{font-size:11px;line-height:1.3}.sis-hsplit-sp .sis-hs-code{padding:3px 4px 3px 10px;gap:6px}.sis-hsplit-sp .sis-hs-code code{font-size:14px}.sis-hsplit-sp .sis-tiles b{min-width:24px;font-size:13px;padding:1px 2px}.sis-hsplit-sp .sis-tiles small{font-size:9px}.sis-hsplit-sp .sis-tiles i{padding-bottom:14px}',
    '.sis-hs-code button{white-space:nowrap;flex:none}',
    /* v4：左の「現在のランク」の下に特典と次のランクまでの金額 */
    '.sis-rkbox{margin:8px 0 12px;padding:10px 10px 12px;border-radius:10px;background:var(--sis-pl);font-size:12px;line-height:1.5}',
    '.sis-rkbox dl{margin:0 0 8px}.sis-rkbox dt{font-size:11px;color:var(--sis-mu)}.sis-rkbox dd{margin:0 0 4px;font-weight:700}',
    '.sis-rkbox .sis-rk-next{padding-top:8px;border-top:1px dashed var(--sis-pm)}.sis-rkbox .sis-rk-next b{color:var(--sis-cd);font-size:15px}',
    '.sis-rkbox .sis-trk{height:6px;background:#fff}.sis-rkbox .sis-trk i{background:var(--sis-p)}',
    '.sis-rkbox .sis-rk-warn{margin-top:6px;color:var(--sis-r);font-weight:700}',
    /* v4：Amazon型の売れ筋（タブ＋順位の札＋「◯で◯位」） */
    '.sis-tabs{display:flex;gap:6px;margin:0 0 12px;overflow-x:auto;scrollbar-width:none}.sis-tabs button{flex:none;min-height:36px;padding:0 16px;border-radius:999px;border:1px solid var(--sis-ln);background:#fff;color:var(--sis-ink);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}',
    '.sis-tabs button[aria-selected="true"]{background:var(--sis-p);border-color:var(--sis-p);color:#fff}',
    '.sis-grid.sis-g5{grid-template-columns:repeat(5,1fr)}',
    '.sis-rk{position:absolute;left:0;top:0;padding:3px 10px 3px 8px;background:var(--sis-c);color:#fff;font-weight:800;font-size:13px;border-radius:14px 0 10px 0}.sis-rk.r1{background:#E8613F}',
    '.sis-rk~.sis-bd{top:34px}',
    '.sis-best{display:inline-flex;align-items:center;gap:4px;margin:4px 0;padding:2px 8px;border-radius:4px;background:var(--sis-c);color:#fff;font-size:12px;font-weight:800;line-height:1.5}.sis-best span{font-weight:500}',
    '.sis-best-g{display:inline-block;margin:8px 0 4px;padding:4px 10px;border-radius:4px;background:var(--sis-cl);color:var(--sis-cd);font-size:13px;font-weight:800}',
    /* v4：一覧のサムネイルの在庫（メルカートの在庫記号 △・× をそのまま） */
    '.sis-stk{position:absolute;left:6px;bottom:6px;z-index:2;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:800;color:#fff;background:var(--sis-r);pointer-events:none}.sis-stk.out{background:#6F6677}',
    /* v4：カゴ落ち表示の商品ごとの状態 */
    '.sis-crows{display:flex;flex-direction:column;gap:6px;margin:6px 0 0}.sis-crow{display:flex;align-items:center;gap:8px;font-size:12px}.sis-crow img{width:36px;height:36px;border-radius:6px;object-fit:cover;flex:none}',
    '.sis-crow .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sis-st{flex:none;padding:1px 8px;border-radius:4px;font-size:11px;font-weight:800;color:#fff;background:var(--sis-r)}.sis-st.sale{background:var(--sis-c)}.sis-st.out{background:#6F6677}.sis-st.drop{background:#05964a}',
    '.sis-toast.sis-wide{align-items:flex-start}',
    /* v4：購入手続きでクーポンを入れたお知らせ */
    '.sis-ordnote{margin:8px 0;padding:10px 12px;border-radius:8px;background:var(--sis-cl);color:var(--sis-ink);font-size:13px;line-height:1.5}.sis-ordnote b{color:var(--sis-cd)}',
    /* v4：トップのスライダーに入れる「はじめての方へ」 */
    '.sis-onb{display:flex!important;flex-direction:column;justify-content:center;gap:24px;width:100%;height:100%;min-height:300px;padding:36px 44px;background:var(--sis-pl);text-decoration:none!important;color:var(--sis-ink)!important;box-sizing:border-box}',
    '.sis-onb h3{margin:0;font-size:36px;font-weight:800;line-height:1.3;color:var(--sis-p)}.sis-onb h3 small{display:block;font-size:14px;color:var(--sis-mu);font-weight:700;margin-bottom:6px}',
    '.sis-onb ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.sis-onb li{background:#fff;border-radius:12px;padding:16px}.sis-onb li b{display:block;font-size:24px;color:var(--sis-cd);line-height:1.3}.sis-onb li span{font-size:13px;color:var(--sis-mu)}',
    '.sis-onb .sis-btn{align-self:flex-start}',
    '.sis-sp .sis-onb{padding:20px 16px;gap:12px;min-height:0}.sis-sp .sis-onb h3{font-size:20px}.sis-sp .sis-onb ol{grid-template-columns:1fr;gap:6px}.sis-sp .sis-onb li{padding:8px 12px}.sis-sp .sis-onb li b{font-size:15px;display:inline;margin-right:6px}.sis-onb>*{flex:none}.sis-sp .sis-onb{gap:8px;padding:12px 16px}.sis-sp .sis-onb h3{font-size:18px}.sis-sp .sis-onb h3 small{font-size:12px;margin-bottom:2px}.sis-sp .sis-onb li span{display:none}.sis-sp .sis-onb li b{font-size:14px}.sis-sp .sis-onb .sis-btn{min-height:0;height:auto;padding:8px 18px;font-size:13px;line-height:1.5}'
  ].join('\n');
  function style() { if (D.getElementById('sis-css')) return; var s = D.createElement('style'); s.id = 'sis-css'; s.textContent = css + (Q.get('sis_noanim') === '1' ? '\n.sis-root,.sis-root *,.sis-root:before,.sis-fab:before{animation:none!important;transition:none!important}' : ''); D.head.appendChild(s); D.documentElement.classList.add(SP ? 'sis-sp' : 'sis-pc'); }

  /* ---------- 部品 ---------- */
  var mainEl = function () { return D.querySelector('main.pane-main, main, .pane-main, #main, .pane-contents') || D.body; };
  var stripBox;
  function strip(id, o) { // 上部のバナー（o: tone, icon, kicker, title, sub, right）
    if (!stripBox) { stripBox = h('<div class="sis-root" id="sis-strips"></div>'); var m = mainEl(); m.insertBefore(stripBox, m.firstChild); }
    var old = D.getElementById('sis-s-' + id); if (old) old.remove();
    var html = typeof o === 'string' ? o : '<span class="sis-bnr-ic">' + ic(o.icon || 'spark') + '</span><div class="sis-bnr-tx">' + (o.kicker ? '<div class="sis-bnr-k">' + o.kicker + '</div>' : '') + '<div class="sis-bnr-t">' + o.title + '</div>' + (o.sub ? '<div class="sis-bnr-s">' + o.sub + '</div>' : '') + '</div>' + (o.right ? '<div class="sis-bnr-r">' + o.right + '</div>' : '');
    var el = h('<div class="sis-bnr sis-tone-' + ((o && o.tone) || 'sale') + '" id="sis-s-' + id + '">' + html + '</div>');
    var order = (C.strips || {}).order || ['source', 'countdown', 'rank', 'coupon', 'shipbar']; // 上にあるほど優先
    var after = null; [].slice.call(stripBox.children).forEach(function (c) { if (order.indexOf(c.id.replace('sis-s-', '')) < order.indexOf(id)) after = c; });
    stripBox.insertBefore(el, after ? after.nextSibling : stripBox.firstChild); SIS.active[id] = 'on';
    var max = (C.strips || {}).max || 2; // 上部の帯は優先順に最大◯本（多すぎると邪魔になるため）
    [].slice.call(stripBox.children).forEach(function (c, i) { c.style.display = i < max ? '' : 'none'; if (i >= max) SIS.active[c.id.replace('sis-s-', '')] = '枠の上限で非表示'; });
    return el;
  }
  function tiles(end) { return '<span class="sis-tiles" data-end="' + (+end) + '"></span>'; }
  function runTiles(root) { // カウントダウンのタイルを1秒ごとに更新
    [].slice.call(root.querySelectorAll('.sis-tiles[data-end]')).forEach(function (t) {
      var end = +t.getAttribute('data-end');
      function tk() {
        var s = Math.max(0, Math.floor((end - now()) / 1000)), d = Math.floor(s / 86400), p = function (n) { return String(n).padStart(2, '0'); };
        t.innerHTML = (d ? '<span><b>' + d + '</b><small>日</small></span>' : '') + '<span><b>' + p(Math.floor(s % 86400 / 3600)) + '</b><small>時間</small></span><i>:</i><span><b>' + p(Math.floor(s % 3600 / 60)) + '</b><small>分</small></span><i>:</i><span><b>' + p(s % 60) + '</b><small>秒</small></span>';
      }
      tk(); setInterval(tk, 1000);
    });
  }
  var modalOpen = false;
  function mhead(tone, icon, tag, title, img) { // img があれば貴社の実際のバナー画像を上に出す
    if (img) return '<div class="sis-mimg"><img src="' + esc(img) + '" alt=""></div><div class="sis-mhd sis-tone-' + tone + ' sis-mhd-s">' + (tag ? '<span class="sis-tag">' + tag + '</span>' : '') + '<h3>' + title + '</h3></div>';
    return '<div class="sis-mhd sis-tone-' + tone + '"><div class="sis-mic">' + ic(icon) + '</div>' + (tag ? '<span class="sis-tag">' + tag + '</span>' : '') + '<h3>' + title + '</h3></div>'; }
  function modal(id, html, opt) {
    if (modalOpen && !(opt && opt.force)) return null;
    modalOpen = true; SIS.active[id] = 'on';
    var ov = h('<div class="sis-root sis-ov" id="sis-m-' + id + '"><div class="sis-modal" role="dialog" aria-modal="true"><button class="sis-x" aria-label="閉じる">×</button>' + html + '</div></div>');
    function close(why) { ov.remove(); modalOpen = false; track(id, 'close', { sis_label: why || 'x' }); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close('outside'); });
    ov.querySelector('.sis-x').onclick = function () { close('x'); };
    ov.querySelectorAll('[data-sis-close]').forEach(function (b) { b.onclick = function () { close(b.getAttribute('data-sis-close')); }; });
    D.body.appendChild(ov); runTiles(ov); bindCopy(ov, id); track(id, 'impression'); ov.sisClose = close; return ov;
  }
  function toast(id, html) {
    var old = D.getElementById('sis-t-' + id); if (old) old.remove();
    var el = h('<div class="sis-root sis-toast" id="sis-t-' + id + '"><button class="sis-x" aria-label="閉じる">×</button>' + html + '</div>');
    function fix(show) { var f = D.getElementById('sis-shipfix'); if (f) f.style.visibility = show ? '' : 'hidden'; } // 下部の送料バーと重ねない（トーストにも送料の残額が出る）
    el.querySelector('.sis-x').onclick = function () { el.remove(); fix(true); track(id, 'close'); };
    var n = 0;
    (function place() { // ポップアップが開いている間は出さず、閉じてから出す
      if ((SIS.popupPending || D.querySelector('.sis-modal')) && n++ < 120) return setTimeout(place, 1000);
      D.body.appendChild(el); fix(false); SIS.active[id] = 'on'; track(id, 'impression');
    })();
    return el;
  }
  function shead(o) { // セクションの見出し（o: tone, icon, title, sub, more:{href,label}）
    return '<div class="sis-sh sis-tone-' + (o.tone || 'sale') + '"><span class="sis-sh-ic">' + ic(o.icon || 'spark') + '</span><div class="sis-sh-t"><h4>' + o.title + '</h4>' + (o.sub ? '<small>' + o.sub + '</small>' : '') + '</div>' +
      (o.more ? '<a class="sis-more" href="' + esc(o.more.href) + '">' + esc(o.more.label || 'すべて見る') + ic('arrow') + '</a>' : '') + '</div>';
  }
  function section(id, html, where, pos) {
    var old = D.getElementById('sis-sec-' + id); if (old) old.remove();
    var el = h('<section class="sis-root sis-sec" id="sis-sec-' + id + '">' + html + '</section>');
    if (where && where.parentNode) { if (pos === 'before') where.parentNode.insertBefore(el, where); else if (pos === 'prepend') where.insertBefore(el, where.firstChild); else where.parentNode.insertBefore(el, where.nextSibling); }
    else { var m = mainEl(); m.appendChild(el); }
    SIS.active[id] = 'on'; track(id, 'impression'); return el;
  }
  function card(g, opt) {
    opt = opt || {};
    var bd = (opt.rank ? '<span class="sis-medal' + (opt.rank <= 3 ? ' m' + opt.rank : '') + '">' + opt.rank + '</span>' : '') + (opt.badge || '') + (g.low && !/残りわずか/.test(opt.badge || '') ? '<span class="sis-tag sis-t-r">残りわずか</span>' : '');
    var sale = g.orig && g.orig > g.price;
    return '<a class="sis-card" href="' + esc(g.href) + '" data-sis-goods="' + esc(g.code) + '"><div class="sis-im">' + (g.img ? '<img src="' + esc(g.img) + '" alt="' + esc(g.name) + '" onerror="var c=this.closest(\'.sis-card\');if(c)c.remove()">' : '<img alt="">') + (bd ? '<div class="sis-bd">' + bd + '</div>' : '') + '</div>' +
      (opt.why ? '<div class="sis-why2">' + esc(opt.why) + '</div>' : '') +
      '<div class="sis-cn">' + esc(g.name) + '</div><div class="sis-cp' + (sale ? ' sale' : '') + '">' + (g.price ? yen(g.price) : '') + (sale ? '<s>' + yen(g.orig) + '</s>' : '') + '</div>' +
      (opt.add ? '<button type="button" class="sis-add" data-sis-add="' + esc(g.code) + '">' + ic('cart') + 'カートに入れる</button>' : '') + '</a>';
  }
  function bindCopy(root, id) {
    [].slice.call(root.querySelectorAll('[data-sis-copy]')).forEach(function (b) {
      b.onclick = function (e) { e.preventDefault(); var v = b.getAttribute('data-sis-copy'); try { navigator.clipboard.writeText(v); } catch (x) {} b.textContent = 'コピー済み'; b.disabled = true; track(id, 'copy', { sis_label: v }); };
    });
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
    var cp = ls('cartPrices') || {}; items.forEach(function (i) { if (i.code && i.qty && !cp[i.code]) cp[i.code] = Math.round(i.amt / i.qty); }); ls('cartPrices', cp); // 次の訪問で「値下がり」を出すため、入れたときの価格を覚える
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
    stopAll(); // 裏の読み込みを止めてからカートに入れる
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
      var name = (nameEl ? nameEl.textContent : img.getAttribute('alt') || '').replace(/\s+/g, ' ').split(/\s[（(]|[￥¥]/)[0].trim(); // 色・サイズ・価格の表記は除く
      var price = 0, orig = 0, re = /(通常価格\s*)?[￥¥]\s?([\d,]+)/g, m;
      while ((m = re.exec(txt))) { if (m[1]) orig = orig || num(m[2]); else if (!price) price = num(m[2]); }
      seen[code] = 1;
      out.push({ code: code, href: '/shop/g/g' + code + '/', name: name, price: price, orig: orig, img: img.getAttribute('data-src') || img.getAttribute('src'), sale: /通常価格/.test(txt) });
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
        price: num((d.querySelector('.block-goods-price--price') || {}).textContent), orig: num((d.querySelector('.block-goods-price--default-price') || {}).textContent), stock: stock, low: /△|残りわずか/.test(stock), soldout: /×|在庫なし|売り切れ/.test(stock) };
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
    return (need ? cart() : Promise.resolve(null)).then(function (c) { return { src: source(), visits: visits, isNew: isNew, cart: c, rank: (rankName() || Q.get('sis_rank') || '').trim() }; });
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
      var head = v === 'B' ? '新作とシークレットセールを<br><em>LINEでいち早く</em>' : 'LINE友だち追加で<br><em>500円OFFクーポン</em>';
      return { tone: 'g', html: mhead('g', 'chat', esc(r.tag || 'はじめての方へ'), head, r.img) + '<div class="sis-mbd">' +
        '<ul class="sis-perks"><li>' + ic('ticket') + esc(SHOP.linePerk || '') + '</li><li>' + ic('gift') + 'お誕生月にバースデークーポン</li><li>' + ic('spark') + '友だち限定シークレットセールのご案内</li></ul>' +
        '<a class="sis-btn sis-line sis-block" href="' + esc(SHOP.lineUrl) + '" target="_blank" rel="noopener" data-sis="go">' + ic('chat') + 'LINEで友だち追加</a>' +
        '<button class="sis-link" data-sis-close="later">今はしない</button><div class="sis-x2">ABテスト ' + v + '</div></div>', goal: 'line_click' };
    },
    sale: function (r) {
      var dl = deadlineById(r.deadline), end = dl ? dl.end : null;
      var endTxt = end ? (end.getHours() === 0 ? (new Date(end - 1).getMonth() + 1) + '/' + new Date(end - 1).getDate() + ' 23:59' : (end.getMonth() + 1) + '/' + end.getDate() + ' ' + end.toTimeString().slice(0, 5)) : '';
      return { html: mhead('sale', 'tag', esc(r.tag || '開催中'), esc(r.title || SHOP.saleName), r.img) + '<div class="sis-mbd">' +
        (endTxt ? '<p style="margin:0 0 8px;font-weight:700">' + endTxt + ' まで　終了まであと</p><p style="margin:0 0 16px">' + tiles(end) + '</p>' : '') +
        (r.text ? '<p>' + esc(r.text) + '</p>' : '') +
        '<a class="sis-btn sis-block" href="' + esc(r.url || SHOP.salePage) + '" data-sis="go">セール会場を見る' + ic('arrow') + '</a>' +
        '<button class="sis-link" data-sis-close="later">閉じる</button></div>', goal: 'click' };
    },
    coupon: function (r) {
      var c = coupon(r.coupon);
      return { html: mhead('sale', 'ticket', esc(r.tag || 'あなたへのクーポン'), esc(r.title || c.title || 'クーポン')) + '<div class="sis-mbd">' +
        '<p style="margin:0 0 12px">' + ticket(c) + '</p>' + (c.expiresLabel ? '<p class="sis-note" style="margin:0 0 14px">有効期限 ' + esc(c.expiresLabel) + '</p>' : '') +
        '<a class="sis-btn sis-block" href="' + esc(r.url || SHOP.salePage) + '" data-sis="go">お買い物を続ける' + ic('arrow') + '</a><button class="sis-link" data-sis-close="later">閉じる</button></div>', goal: 'click' };
    }
  };
  FX.popup = function (forced) {
    if (!forced && (PAGE === 'order' || PAGE === 'cart' || popupRecent())) return;
    SIS.popupPending = true; // 判定中は下のトーストを待たせる
    popupContext().then(function (x) {
      var rules = PC.rules || [], r = null;
      if (typeof forced === 'string') r = rules.filter(function (q) { return q.id === forced || q.type === forced; })[0];
      if (!r) r = rules.filter(function (q) { return ruleMatch(q, x); })[0];
      if (!r || !POP[r.type]) { SIS.popupPending = false; return; }
      setTimeout(function () {
        SIS.popupPending = false;
        var c = POP[r.type](r);
        var m = modal('popup', c.html, { force: !!forced });
        if (!m) return; ls('popupAt', Date.now()); track('popup', 'show', { sis_label: r.id });
        var go = m.querySelector('[data-sis="go"]'); if (go) go.onclick = function () { track('popup', c.goal, { sis_label: r.id }); };
      }, forced ? 0 : (PC.delaySec || 3) * 1000);
    }).catch(function () { SIS.popupPending = false; });
  };
  FX.welcome = function (forced) { if (forced) FX.popup('line'); };

  /* 2. 離脱時ポップアップ */
  FX.exit = function (forced) {
    if (!forced && (PAGE === 'order' || PAGE === 'cart' || ss('exitShown'))) return;
    function fire() {
      if ((ss('exitShown') || popupRecent()) && !forced) return; ss('exitShown', 1); ls('popupAt', Date.now());
      Promise.all([cart(), saleCount()]).then(function (r) {
        return Promise.all(r[0].items.slice(0, 3).map(function (i) { return i.img || !i.code ? Promise.resolve(null) : goodsInfo(i.code); })).then(function (gs) { gs.forEach(function (g, k) { if (g && g.img) r[0].items[k].img = g.img; }); return r; });
      }).then(function (r) {
        var c = r[0], n = r[1], body;
        if (c.count > 0) {
          var rest = (SHOP.freeShipping || 0) - c.total;
          body = mhead('p', 'cart', 'お買い忘れはありませんか？', 'カートに<em>' + c.count + '点</em>入っています') + '<div class="sis-mbd"><div class="sis-items">' +
            c.items.slice(0, 3).map(function (i) { return '<div class="sis-item">' + (i.img ? '<img src="' + esc(i.img) + '" alt="">' : '') + '<div>' + esc(i.name) + '<br><small>' + esc((i.variation || '').trim()) + '</small></div></div>'; }).join('') + '</div>' +
            (rest > 0 ? '<p style="margin:0 0 14px;font-weight:700">あと<b style="color:var(--sis-cd);font-size:20px"> ' + yen(rest) + ' </b>で送料無料</p>' : '<p style="margin:0 0 14px;font-weight:700;color:#05964a">送料無料ライン達成中です</p>') +
            '<a class="sis-btn sis-block" href="/shop/cart/cart.aspx" data-sis="go">' + ic('cart') + 'カートを見る（' + yen(c.total) + '）</a><button class="sis-link" data-sis-close="later">閉じる</button></div>';
        } else {
          body = mhead('sale', 'tag', '開催中', esc(SHOP.saleName)) + '<div class="sis-mbd">' +
            (n ? '<p style="margin:0 0 16px">ただいま <b style="color:var(--sis-cd);font-size:26px">' + n + '</b> 点がセール価格です</p>' : '') +
            '<a class="sis-btn sis-block" href="' + esc(SHOP.salePage) + '" data-sis="go">セール会場を見る' + ic('arrow') + '</a><button class="sis-link" data-sis-close="later">閉じる</button></div>';
        }
        var m = modal('exit', body, { force: forced });
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
    var s = source(), o = {
      line: { tone: 'g', icon: 'chat', kicker: 'LINEからお越しの方へ', title: '<b>' + esc(SHOP.saleName) + '</b> 開催中。トークでお知らせした商品もこちらから', right: '<a class="sis-btn sis-sm sis-line" href="' + esc(SHOP.salePage) + '">セール会場へ</a>' },
      instagram: { tone: 'p', icon: 'shirt', kicker: 'Instagramからお越しの方へ', title: '投稿で紹介したコーデは<b>スタッフおすすめコーデ</b>にまとめています', right: '<a class="sis-btn sis-sm sis-pur" href="' + esc(SHOP.coordPage) + '">コーデを見る</a>' },
      qr: { tone: 'p', icon: 'store', kicker: '店舗からお越しの方へ', title: 'WEBSHOPは<b>' + yen(SHOP.freeShipping) + '（税込）以上で送料無料</b>。店頭にないサイズ・カラーもこちらで', right: '<a class="sis-btn sis-sm sis-pur" href="' + esc(SHOP.newPage) + '">新作を見る</a>' }
    }[s];
    if (!o) return;
    var el = strip('source', o); track('source', 'impression', { sis_label: s });
    el.querySelectorAll('a').forEach(function (a) { a.onclick = function () { track('source', 'click', { sis_label: s }); }; });
  };

  /* 4. 入店時クーポン表示 */
  function coupon(id) {
    var c = (C.coupons || []).filter(function (x) { return x.id === id; })[0];
    if (!c) return null; if (c.code) return c; return DEMO ? c : null;
  }
  function ticket(c) { // クーポン券（左に割引額、右にコード）
    var v = String(c.value || ''), m = v.match(/^(\d[\d,]*)(.*)$/);
    var left = m ? '<b>' + esc(m[1]) + '</b><small>' + esc(m[2] || '') + '</small>' : '<b class="sis-tk-txt">' + esc(v || 'クーポン') + '</b>';
    return '<span class="sis-tk"><span class="sis-tk-l">' + left + '</span><span class="sis-tk-r"><span><small>クーポンコード</small>' +
      (c.code ? '<code>' + esc(c.code) + '</code></span><button type="button" data-sis-copy="' + esc(c.code) + '">コピー</button>' : '<code class="sis-pending">BOで発行後に表示</code></span>') + '</span></span>';
  }
  function myCoupons() { // ログイン中の会員が持っているクーポン（マイページ「クーポンの確認」の表をそのまま読む。誕生日・毎月のランククーポンなど）
    if (Q.get('sis_mycoupon')) { var p = Q.get('sis_mycoupon').split('|'); return Promise.resolve([{ code: p[0], title: p[1] || '', value: p[2] || '', until: p[3] || '', preview: true }]); }
    if (!rankName()) return Promise.resolve([]);
    var c = ss('myCoupons'); if (c && Date.now() - c.t < 30 * 60e3) return Promise.resolve(c.list);
    return get('/shop/customer/coupon.aspx', 8000).then(function (html) {
      var d = parseDoc(html), out = [];
      [].slice.call(d.querySelectorAll('table')).forEach(function (t) {
        var hd = [].slice.call(t.querySelectorAll('th')).map(function (x) { return x.textContent.replace(/\s+/g, ''); });
        var ic2 = hd.indexOf('クーポンコード'); if (ic2 < 0) return;
        var iname = hd.indexOf('クーポンイベント名'), ival = hd.indexOf('クーポン特典'), iper = hd.indexOf('有効期間');
        [].slice.call(t.querySelectorAll('tr')).forEach(function (tr) {
          var td = [].slice.call(tr.querySelectorAll('td')).map(function (x) { return x.textContent.replace(/\s+/g, ' ').trim(); });
          if (td.length < 3 || !td[ic2]) return;
          var per = td[iper] || '', m = per.match(/[～~]\s*(\d{4})\/(\d{1,2})\/(\d{1,2})/);
          out.push({ code: td[ic2], title: td[iname] || '', value: (td[ival] || '').replace(/\s*引き$/, 'OFF'), until: m ? (+m[2]) + '/' + (+m[3]) + 'まで' : '' });
        });
      });
      ss('myCoupons', { t: Date.now(), list: out }); return out;
    }).catch(function () { return []; });
  }
  FX.coupon = function (forced) {
    if (PAGE === 'order') return;
    var list = (C.coupons || []).filter(function (c) {
      if (/^kuji/.test(c.id)) return false;
      if (c.inHeader) return false; // ヘッダーのバナーに出ているクーポンは帯に重ねない
      if (c.expires && now() > new Date(c.expires)) return false;
      if (c.audience === 'new' && !isNew) return false;
      if (c.audience === 'repeat' && isNew) return false;
      if (c.audience === 'guest' && rankName()) return false;
      return c.code || DEMO;
    });
    myCoupons().then(function (mine) {
      if (mine.length) { // ①会員が持っているクーポン（誕生日・毎月のランククーポンなど）が最優先
        var m = mine[0];
        var el = strip('coupon', { tone: 'p', kicker: 'お持ちのクーポン' + (mine.length > 1 ? ' ' + mine.length + '枚' : ''), title: esc(m.title) + '　<b>' + esc(m.value) + '</b>', sub: (m.until ? esc(m.until) + '・' : '') + 'ご注文手続きの「利用可能なクーポンを表示」から選べます', right: ticket({ value: m.value, code: m.code }) });
        bindCopy(el, 'coupon'); track('coupon', 'impression', { sis_label: 'mine' }); return;
      }
      if (!list.length) return;
      var c = list[0]; // ②ログインしていない人には会員登録の特典など（設定にあるもの）
      var el2 = strip('coupon', { tone: 'sale', kicker: c.kicker || 'ご来店クーポン', title: esc(c.title || ''), sub: c.expiresLabel ? '有効期限 ' + esc(c.expiresLabel) + '・ご注文手続きでコードを入力' : (c.sub || ''), right: c.url ? '<a class="sis-btn sis-sm" href="' + esc(c.url) + '">' + esc(c.cta || '詳しく見る') + '</a>' : ticket(c) });
      bindCopy(el2, 'coupon'); track('coupon', 'impression', { sis_label: c.code || c.id });
    });
  };

  /* 4b. ヘッダーのバナーを2つに分ける（左＝今のバナー画像、右＝クーポンの残り時間とコードのコピー） */
  FX.headerSplit = function () {
    var cfg = C.headerSplit || {}; if (!cfg.on && !Q.get('sis_hsplit')) return;
    var key = cfg.bannerKey || '', box = SP ? null : D.querySelector(cfg.selector || '#header-news2');
    if (SP) { var im = [].slice.call(D.querySelectorAll('img')).filter(function (i) { return key && i.src.indexOf(key) >= 0; })[0]; box = im ? (im.closest('a') || im) : null; }
    if (!box) return;
    var c = (C.coupons || []).filter(function (x) { return x.code && x.code === (cfg.coupon || '') && (!x.expires || now() < new Date(x.expires)); })[0]; if (!c) return;
    var bg = SP ? 'x' : (getComputedStyle(box).backgroundImage.match(/url\("?([^")]+)"?\)/) || [])[1]; if (!bg) return;
    var link = box.closest('a') || box.querySelector('a'), href = link ? link.getAttribute('href') : (cfg.href || '');
    var end = c.expires ? new Date(c.expires) : null;
    var right = (end ? '<div class="sis-hs-t">' + esc(c.expiresLabel || '') + '　終了まで<b>' + tiles(end) + '</b></div>' : '') +
      '<div class="sis-hs-code"><code>' + esc(c.code) + '</code><button type="button" data-sis-copy="' + esc(c.code) + '">コピー</button></div>';
    if (!SP) {
      box.style.backgroundImage = 'none';
      box.innerHTML = ''; box.appendChild(h('<div class="sis-root sis-hsplit"><a href="' + esc(href || '#') + '"><img src="' + esc(bg) + '" alt=""></a><div class="sis-hs-r">' + right + '</div></div>'));
    } else {
      box.parentNode.insertBefore(h('<div class="sis-root sis-hsplit-sp">' + right + '</div>'), box.nextSibling);
    }
    runTiles(D.querySelector('.sis-hsplit, .sis-hsplit-sp')); bindCopy(D.querySelector('.sis-hsplit, .sis-hsplit-sp'), 'headerSplit');
    SIS.active.headerSplit = 'on'; track('headerSplit', 'impression', { sis_label: c.code });
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
    Promise.all([cart(), readRank().then(function (r) { return r && !r.preview || Q.get('sis_hist') ? r && rankStatus(r) : null; })]).then(function (rr) {
      var c = rr[0], rs = rr[1];
      if (c.error || (!c.count && !cfg.showWhenEmpty)) return;
      var free = SHOP.freeShipping || 0, nov = C.novelty || {};
      var rest = free - c.total, pct = Math.min(100, Math.round(c.total / free * 100));
      var rankBar = '';
      if (rest <= 0 && rs && rs.up && rs.amt != null) { // 送料無料を越えたら、次の会員ランクまでのバーに切り替える（この注文も足して計算）
        var after = rs.amt + c.total, need = Math.max(0, rs.up.min - after), rp = Math.min(100, Math.round(after / rs.up.min * 100));
        rankBar = need > 0 ? '<div class="sis-ship-t">送料無料ライン達成。あと <b>' + yen(need) + '</b>（' + rs.nextLabel + 'の判定まで）で「' + esc(rs.up.name) + '」</div><div class="sis-trk"><i style="width:' + rp + '%;background:var(--sis-p)"></i><u style="left:' + rp + '%;border-color:var(--sis-p)"></u></div><div class="sis-trk-l"><span>3ヶ月の累計 ' + yen(after) + '（この注文を含む）</span><span>' + yen(rs.up.min) + '</span></div>'
          : '<div class="sis-ship-t">送料無料ライン達成。この注文で' + rs.nextLabel + 'に「' + esc(rs.up.name) + '」へ</div>';
      }
      var html = '<div class="sis-ship-m">' +
        (rest > 0 ? '<div class="sis-ship-t">あと <b>' + yen(rest) + '</b> で送料無料</div><div class="sis-trk"><i style="width:' + pct + '%"></i><u style="left:' + pct + '%"></u></div><div class="sis-trk-l"><span>カート ' + yen(c.total) + '</span><span>' + yen(free) + '</span></div>'
          : rankBar || '<div class="sis-ship-t" style="color:#05964a">送料無料ライン達成！</div><div class="sis-trk-l"><span>カート ' + yen(c.total) + '（' + yen(free) + '以上）</span></div>');
      if (nov.on) { var nr = nov.threshold - c.total; html += '<div class="sis-trk-l"><span>' + (nr > 0 ? 'あと ' + yen(nr) + ' で ' + esc(nov.label) : esc(nov.label) + ' 対象') + '</span></div>'; }
      html += '</div><a class="sis-btn sis-sm" href="/shop/cart/cart.aspx">' + ic('cart') + 'カートを見る</a>';
      if (cfg.position === 'top') { strip('shipbar', '<div class="sis-ship" style="padding:0;width:100%">' + html + '</div>'); }
      else {
        var old = D.getElementById('sis-shipfix'); if (old) old.remove();
        var el = h('<div class="sis-root sis-shipfix" id="sis-shipfix"><div class="sis-ship">' + html + '</div><button class="sis-x" aria-label="閉じる">×</button></div>');
        el.querySelector('.sis-x').onclick = function () { el.remove(); ss('shipbarClosed', 1); track('shipbar', 'close'); };
        D.body.appendChild(el); el.style.bottom = bottomOffset() + 'px'; SIS.active.shipbar = 'on';
        if (parseInt(el.style.bottom)) var iv = setInterval(function () { var cb = D.getElementById('cookieBox'); if (!cb || getComputedStyle(cb).display === 'none') { clearInterval(iv); setTimeout(function () { el.style.bottom = bottomOffset() + 'px'; }, 400); } }, 1500); // Cookie同意バーが消えたら下まで下げる
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
    var el = strip('countdown', { tone: 'sale', icon: 'clock', kicker: '終了まであと少し', title: esc(x.d.text) + '<span style="font-weight:500;color:var(--sis-mu)">　' + endLabel + ' まで</span>', right: tiles(x.end) + (x.d.url ? '<a class="sis-btn sis-sm" href="' + esc(x.d.url) + '">会場へ</a>' : '') });
    runTiles(el);
    var iv = setInterval(function () { if (x.end - now() <= 0) { el.remove(); clearInterval(iv); } }, 1000);
    track('countdown', 'impression', { sis_label: x.d.id });
  };

  /* 7. くじ演出 */
  FX.kuji = function (forced) {
    var prizes = (C.coupons || []).filter(function (c) { return /^kuji/.test(c.id) && (c.code || DEMO); });
    if (!prizes.length) return;
    var today = now().toISOString().slice(0, 10);
    if (!forced && (PAGE === 'order' || ls('kujiDay') === today)) return;
    function face(p) { var m = String(p.value || '').match(/^(\d[\d,]*)(.*)$/); return m ? '<b>' + esc(m[1]) + '<span style="font-size:13px">' + esc(m[2]) + '</span></b>' : '<b style="font-size:18px">' + esc(p.value) + '</b>'; }
    function confetti(box) {
      var cols = ['#FF8363', '#633783', '#F0A800', '#06C755', '#FFD36B', '#E6DBEF'], c = h('<div class="sis-conf"></div>');
      for (var i = 0; i < 36; i++) { var e = D.createElement('i'); e.style.left = Math.random() * 100 + '%'; e.style.background = cols[i % cols.length]; e.style.animationDelay = (Math.random() * .5) + 's'; e.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)'; c.appendChild(e); }
      box.appendChild(c); setTimeout(function () { c.remove(); }, 2600);
    }
    function open() {
      var cards = [0, 1, 2].map(function () { return '<button type="button" class="sis-kc" aria-label="くじを引く"><span class="sis-kc-in"><span class="sis-kc-f"><b>?</b><small>TAP</small></span><span class="sis-kc-b"></span></span></button>'; }).join('');
      var m = modal('kuji', mhead('y', 'gift', '本日1回', 'ご来店<em>くじ</em>') + '<div class="sis-mbd"><p style="margin:0 0 12px">気になる1枚をえらんでください。<b>ハズレなし</b>です</p><div class="sis-kuji">' + cards + '</div><div id="sis-kuji-r"></div></div>', { force: true });
      if (!m) return; var fab = D.getElementById('sis-fab-kuji'); if (fab) fab.remove();
      var box = m.querySelector('.sis-modal');
      var btns = [].slice.call(m.querySelectorAll('.sis-kc'));
      btns.forEach(function (b, bi) {
        b.onclick = function () {
          if (m.dataset.done) return; m.dataset.done = 1; ls('kujiDay', today);
          var sum = prizes.reduce(function (s, p) { return s + (p.weight || 1); }, 0), r = Math.random() * sum, win = prizes[0];
          for (var i = 0; i < prizes.length; i++) { r -= prizes[i].weight || 1; if (r <= 0) { win = prizes[i]; break; } }
          var others = prizes.filter(function (p) { return p !== win; });
          b.querySelector('.sis-kc-b').innerHTML = face(win) + '<small>あたり</small>'; b.classList.add('sis-open', 'sis-win');
          b.insertAdjacentHTML('beforeend', '<span class="sis-kc-win">あなたの賞</span>');
          setTimeout(function () { btns.forEach(function (o, oi) { if (o === b) return; var p = others.shift() || win; o.querySelector('.sis-kc-b').innerHTML = face(p) + '<small>ほかの賞</small>'; o.classList.add('sis-open', 'sis-dim'); }); }, 700);
          setTimeout(function () {
            confetti(box);
            ls('kujiWin', { code: win.code, value: win.value, exp: win.expires || null, t: Date.now() }); // ご注文手続きの画面でクーポン欄に自動で入れる
            m.querySelector('#sis-kuji-r').innerHTML = '<div class="sis-res"><h4>おめでとうございます！ ' + esc(win.value || 'クーポン') + '</h4><p style="margin:0 0 10px">' + ticket(win) + '</p><p class="sis-note" style="margin:0 0 14px"><b>ご注文手続きの画面で、クーポン欄に自動で入ります</b>（コピー不要）' + (win.expiresLabel ? '・有効期限 ' + esc(win.expiresLabel) : '') + '</p>' +
              '<a class="sis-btn sis-block" href="' + esc(SHOP.salePage) + '">このクーポンでお買い物' + ic('arrow') + '</a><button class="sis-link" data-sis-close="later">閉じる</button></div>';
            var cl = m.querySelector('#sis-kuji-r [data-sis-close]'); if (cl) cl.onclick = function () { m.sisClose('later'); };
            bindCopy(m, 'kuji'); track('kuji', 'draw', { sis_label: win.id });
          }, 900);
        };
      });
    }
    if (forced) return open();
    if ((ss('pv') || 1) < 2) return;
    var fab = h('<button class="sis-root sis-fab" id="sis-fab-kuji" aria-label="ご来店くじを引く">' + ic('gift') + '<span>くじ</span><em>1日1回</em></button>');
    fab.onclick = function () { track('kuji', 'fab_click'); open(); };
    D.body.appendChild(fab); SIS.active.kuji = 'on'; track('kuji', 'impression');
  };

  /* 7b. 購入手続き：くじで当たったクーポンをクーポン欄に入れておく（お客様はコピー・貼り付け不要） */
  FX.orderCoupon = function () {
    if (PAGE !== 'order') return;
    var w = ls('kujiWin'); if (!w || !w.code || (w.exp && now() > new Date(w.exp)) || w.used) return;
    var inp = D.querySelector('input[name="coupon"]'); if (!inp || inp.value) return;
    inp.value = w.code; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
    var note = h('<div class="sis-root sis-ordnote">ご来店くじの <b>' + esc(w.value || 'クーポン') + '</b>（' + esc(w.code) + '）を入れてあります。使わない場合は消してください。</div>');
    (inp.closest('td, dd, div') || inp.parentNode).appendChild(note);
    SIS.active.orderCoupon = 'on'; track('orderCoupon', 'autofill', { sis_label: w.code });
  };
  /* 7c. 注文完了：この端末で買ったことを覚える／この訪問で触った施策を「購入」として送る */
  FX.orderDone = function () {
    if (PAGE !== 'order' || !/ご注文ありがとうございま|ご注文が完了|ご注文を受け付け/.test(D.body.textContent)) return;
    if (ss('orderDone')) return; ss('orderDone', 1);
    ls('bought', Date.now()); var w = ls('kujiWin'); if (w) { w.used = true; ls('kujiWin', w); }
    var touched = ss('touched') || [];
    track('session', 'purchase', { sis_label: touched.join(',') || 'none' });
    SIS.active.orderDone = 'on';
  };

  /* 8. 会員ランク別UI */
  function rankName() { // ログイン中の会員ランク（文字、なければランク画像のalt）
    var e = D.getElementById('customer-rank'); if (!e) return '';
    var t = e.textContent.trim(); if (t) return t;
    var im = e.querySelector('img'); return im ? (im.getAttribute('alt') || '').trim() : '';
  }
  function readRank() {
    return new Promise(function (res) {
      if (Q.get('sis_rank')) return res({ name: Q.get('sis_rank'), preview: true });
      if (!D.getElementById('customer-rank') && D.readyState !== 'loading') return res(null); // ログインしていない
      var tries = 0; (function poll() {
        var t = rankName();
        if (t) return res({ name: t });
        if (++tries > 12) return res(null); setTimeout(poll, 250);
      })();
    });
  }
  /* 会員の購入金額（マイページ「購入履歴」の注文日と注文金額合計を足す。キャンセルは除く）。端末が違っても会員ごとに同じ */
  var histP = null;
  function orderHistory() {
    if (histP) return histP;
    if (Q.get('sis_hist')) { // 画面確認用：sis_hist=2026-09-10:12000,2026-10-05:8000
      histP = Promise.resolve(Q.get('sis_hist').split(',').map(function (s) { var p = s.split(':'); return { date: new Date(p[0] + 'T12:00:00+09:00'), amt: +p[1] }; })); return histP;
    }
    if (!rankName()) { histP = Promise.resolve(null); return histP; }
    var c = ss('hist'); if (c && Date.now() - c.t < 30 * 60e3) { histP = Promise.resolve(c.list.map(function (x) { return { date: new Date(x.d), amt: x.a }; })); return histP; }
    histP = get('/shop/customer/history.aspx', 8000).then(function (html) {
      var d = parseDoc(html), out = [];
      [].slice.call(d.querySelectorAll('table')).forEach(function (t) {
        var hd = [].slice.call(t.querySelectorAll('th')).map(function (x) { return x.textContent.replace(/\s+/g, ''); });
        var idt = hd.indexOf('注文日'), iam = hd.indexOf('注文金額合計'), ist = hd.indexOf('処理状態'); if (idt < 0 || iam < 0) return;
        [].slice.call(t.querySelectorAll('tr')).forEach(function (tr) {
          var td = [].slice.call(tr.querySelectorAll('td')).map(function (x) { return x.textContent.replace(/\s+/g, ' ').trim(); });
          var m = (td[idt] || '').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/); if (!m) return;
          if (ist >= 0 && /キャンセル|取消/.test(td[ist] || '')) return;
          out.push({ date: new Date(+m[1], +m[2] - 1, +m[3], 12), amt: num(td[iam]) });
        });
      });
      ss('hist', { t: Date.now(), list: out.map(function (x) { return { d: +x.date, a: x.amt }; }) }); return out;
    }).catch(function () { return null; });
    return histP;
  }
  function rankStatus(r) { // ランクは「過去3ヶ月の累計」で毎月1日に更新（会員ランクについて）。次の1日は「今月＋前の2ヶ月」で決まる前提
    var ranks = C.ranks || [], i = -1;
    ranks.forEach(function (x, k) { if (r.name.indexOf(x.name) >= 0 && i < 0) i = k; });
    if (i < 0) return Promise.resolve(null);
    return orderHistory().then(function (hist) {
      var t = now(), next = new Date(t.getFullYear(), t.getMonth() + 1, 1), from = new Date(t.getFullYear(), t.getMonth() - ((C.ranksWindowMonths || 3) - 1), 1);
      var amt = hist ? hist.filter(function (x) { return x.date >= from && x.date < next; }).reduce(function (s, x) { return s + x.amt; }, 0) : null;
      var me = ranks[i], up = ranks[i - 1], down = ranks[i + 1];
      var keep = amt != null ? Math.max(0, (me.min || 0) - amt) : null;
      return { me: me, up: up, down: down, amt: amt, toUp: up && amt != null ? Math.max(0, up.min - amt) : null, toKeep: keep, next: next, from: from, nextLabel: (next.getMonth() + 1) + '/1' };
    });
  }
  function perksOf(me) {
    var p = [];
    if (me.monthly) p.push(['毎月のクーポン', me.monthly]);
    if (me.pointDay) p.push(['22・23日ポイント', me.pointDay]);
    p.push(['お誕生日クーポン', me.birthday]);
    return p;
  }
  FX.rank = function () {
    if (PAGE === 'order') return;
    readRank().then(function (r) { return r && rankStatus(r); }).then(function (st) {
      if (!st) return;
      var me = st.me, up = st.up;
      var nextTxt = up ? (st.amt != null ? '<div>' + st.nextLabel + 'の判定まで　あと <b>' + yen(st.toUp) + '</b> で<br>「' + esc(up.name) + '」</div>' : '<div>次は「' + esc(up.name) + '」（3ヶ月で' + yen(up.min) + '以上）</div>') : '<div>最上位ランクです</div>';
      var pct = up && st.amt != null ? Math.min(100, Math.round(st.amt / up.min * 100)) : 0;
      var warn = st.toKeep ? '<div class="sis-rk-warn">このままだと' + st.nextLabel + 'に「' + esc(st.down ? st.down.name : '') + '」へ（維持まであと ' + yen(st.toKeep) + '）</div>' : '';
      // ①PC：左の「現在のランク」の下に入れる（メルカートのランク画像はそのまま）
      var rkEl = D.getElementById('customer-rank'), side = rkEl && rkEl.closest('.block-side-rank, .pane-left-menu, aside, .pane-side, [class*="left"]');
      var holder = rkEl ? (rkEl.closest('[class*="rank"]') && rkEl.closest('[class*="rank"]') !== rkEl ? rkEl.closest('[class*="rank"]') : rkEl) : null;
      if (!SP && holder && side) {
        var box = h('<div class="sis-root sis-rkbox" id="sis-rkbox"><dl>' + perksOf(me).map(function (p) { return '<dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd>'; }).join('') + '</dl>' +
          '<div class="sis-rk-next">' + nextTxt + (pct ? '<div class="sis-trk"><i style="width:' + pct + '%"></i></div><div class="sis-trk-l"><span>3ヶ月 ' + yen(st.amt) + '</span><span>' + yen(up.min) + '</span></div>' : '') + warn + '</div></div>');
        holder.parentNode.insertBefore(box, holder.nextSibling); SIS.active.rank = 'サイドバー'; track('rank', 'impression', { sis_label: me.name }); return;
      }
      // ②スマホなど左の枠がない画面：上部の帯
      strip('rank', { tone: 'p', kicker: esc(me.name), title: perksOf(me).map(function (p) { return esc(p[0]) + ' <b>' + esc(p[1]) + '</b>'; }).join('　'),
        sub: up ? (st.amt != null ? st.nextLabel + 'の判定まで あと<b>' + yen(st.toUp) + '</b>で「' + esc(up.name) + '」' + (st.toKeep ? '／このままだと「' + esc(st.down.name) + '」へ' : '') : '次は「' + esc(up.name) + '」（3ヶ月で' + yen(up.min) + '以上）') : '最上位ランクです',
        right: '<a class="sis-btn sis-sm sis-pur" href="' + esc(SHOP.rankPage) + '">特典を見る</a>' });
      track('rank', 'impression', { sis_label: me.name });
    });
  };

  /* 9. 新規・リピーターでトップを変える */
  FX.newRepeat = function () {
    if (PAGE !== 'top') return Promise.resolve(false);
    var slider = D.getElementById('block_of_top_body') || mainEl().firstElementChild;
    return firstTimer().then(function (first) {
    if (first) {
      var nr = C.newRepeat || {};
      if ((nr.mode === 'slider' && !rankName() || Q.get('sis_onb') === 'slider') && window.jQuery && jQuery('#top-slider').hasClass('slick-initialized')) { // メインバナーの先頭に「はじめての方へ」を1枚足す
        var slide = '<div class="sis-root"><a class="sis-onb" href="/shop/pages/guide.aspx"><h3><small>はじめての方へ</small>drug store\'s WEBSHOPの3つのお得</h3><ol>' +
          '<li><b>' + yen(SHOP.freeShipping) + '以上で送料無料</b><span>商品代金（税込）の合計で判定</span></li><li><b>会員ランクで毎月クーポン</b><span>お買い物金額に応じてアップ</span></li><li><b>LINEで500円OFF</b><span>' + esc(SHOP.linePerk) + '</span></li></ol><span class="sis-btn sis-pur">ご利用ガイドを見る</span></a></div>';
        var hh = 0; jQuery('#top-slider .slick-slide:not(.slick-cloned)').each(function () { hh = Math.max(hh, this.offsetHeight); });
        jQuery('#top-slider').slick('slickAdd', slide, 0, true); jQuery('#top-slider').slick('slickGoTo', 0, true);
        if (hh) [].slice.call(D.querySelectorAll('#top-slider .sis-onb')).forEach(function (e) { e.style.height = hh + 'px'; }); // ほかのバナーと同じ高さにそろえる
        SIS.active.newRepeat = 'メインバナー'; track('newRepeat', 'impression', { sis_label: 'slider' }); return true;
      }
      section('newRepeat', shead({ tone: 'p', icon: 'spark', title: 'はじめての方へ　お買い物ガイド', sub: 'drug store\'s WEBSHOPで知っておくとお得な3つ' }) +
        '<div class="sis-guide">' +
        '<a class="sis-gc" href="/shop/pages/guide.aspx#guide_07"><span class="sis-sh-ic">' + ic('truck') + '</span><div><b>' + yen(SHOP.freeShipping) + '以上で送料無料</b><span>商品代金（税込）の合計で判定します</span></div></a>' +
        '<a class="sis-gc" href="' + esc(SHOP.rankPage) + '"><span class="sis-sh-ic">' + ic('crown') + '</span><div><b>会員ランクで毎月クーポン</b><span>お買い物金額に応じてクーポン・ポイントがアップ</span></div></a>' +
        '<a class="sis-gc" href="' + esc(SHOP.linePage) + '"><span class="sis-sh-ic">' + ic('chat') + '</span><div><b>LINEで500円OFF</b><span>' + esc(SHOP.linePerk) + '</span></div></a>' +
        '</div>', slider, 'after');
      return true;
    } else {
      var hist = D.getElementById('block_of_itemhistory');
      var mine = (ls('viewed') || []).slice(0, SP ? 4 : 4);
      if (!mine.length) return Promise.resolve(false);
      return Promise.all(mine.map(function (g) { return goodsInfo(g.code); })).then(function (arr) {
        arr = arr.filter(function (g) { return g && g.price && !g.soldout; });
        if (!arr.length) return false;
        var el = section('newRepeat', shead({ tone: 'p', icon: 'eye', title: 'おかえりなさい　前回チェックした商品', sub: '最新の価格・在庫で表示しています' }) + '<div class="sis-grid">' + arr.map(function (g) { return card(g); }).join('') + '</div>', slider, 'after');
        el.querySelectorAll('a').forEach(function (a) { a.onclick = function () { track('newRepeat', 'click'); }; });
        return true;
      });
    }
    });
  };
  /* 「はじめての方」の判定：①ログイン中なら会員の購入履歴（端末をまたいで共通）を優先し、購入があれば出さない
     ②この端末で注文完了したことがあれば出さない ③ログインしていなければ、この端末の来店回数（設定の回数まで） */
  function firstTimer() {
    if (Q.get('sis_visit')) return Promise.resolve(Q.get('sis_visit') === 'new');
    if (ls('bought')) return Promise.resolve(false);
    return readRank().then(function (r) {
      if (!r) return isNew;
      return orderHistory().then(function (hist) { return hist ? hist.length === 0 : isNew; });
    });
  }

  /* 10. 閲覧カテゴリ別バナー ／ よく見るジャンルを上に並べ替え */
  var CB = C.catBanner || {};
  function stamp(key, id, name) { var all = ls(key) || {}; var c = all[id] || {}; if (!c.ts) { c.ts = []; for (var i = 0; i < (c.n || 0); i++) c.ts.push(c.t || Date.now()); delete c.n; delete c.t; } c.ts.push(Date.now()); c.ts = c.ts.slice(-30); if (name) c.name = name; all[id] = c; ls(key, all); }
  function countIn(c) { var w = (CB.windowDays || 14) * 864e5; var ts = c.ts; if (!ts) { ts = []; for (var i = 0; i < (c.n || 0); i++) ts.push(c.t); } return ts.filter(function (t) { return Date.now() - t < w; }).length; }
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
      var el = section('catBanner', shead({ tone: 'sale', icon: 'shirt', title: 'よく見ている「' + esc(best.name) + '」の新着', sub: '直近' + (CB.windowDays || 14) + '日で' + best.n + '回ご覧になったカテゴリです', more: { href: '/shop/c/' + best.code + '/', label: 'すべて見る' } }) + '<div class="sis-grid sis-4">' + items.map(function (g, i) { return card(g, { badge: i < 2 ? '<span class="sis-tag">NEW</span>' : '' }); }).join('') + '</div>', anchor, 'before');
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
    if (active && label(active) === memo && fromSw && fromSw.to === code) { hint = h('<div class="sis-root sis-hint">' + ic('check') + '<span>いつものサイズ「<b>' + esc(memo) + '</b>」に切り替えました　<a href="' + esc(fromSw.from) + '?sis_szback=1">「' + esc(fromSw.size || '元のサイズ') + '」に戻す</a></span></div>'); ss('szFrom', null); }
    else if (active && label(active) === memo) hint = h('<div class="sis-root sis-hint">' + ic('check') + '<span>いつものサイズ「<b>' + esc(memo) + '</b>」を選んでいます（' + esc(cat) + '）</span></div>');
    else {
      var a = target.querySelector('a'), oc = (target.querySelector('[onclick]') || target).getAttribute('onclick') || '';
      var href = a ? a.getAttribute('href') : (oc.match(/location\.href\s*=\s*['"]([^'"]+)['"]/) || [])[1];
      var dis = /disable|soldout|nostock/.test(target.className);
      var auto = (C.sizeMemo || {}).autoSwitch, done = ss('szAuto') || {};
      if (auto && href && !dis && !done[pkey(code)]) { done[pkey(code)] = 1; ss('szAuto', done); ss('szFrom', { to: codeOf(href), from: P, size: label(active || {}), memo: memo }); track('sizeMemo', 'auto_switch', { sis_label: memo }); L.replace(href + (href.indexOf('?') < 0 ? '?' : '&') + 'sis_sz=1' + (L.search.indexOf('sis_') >= 0 ? '&' + L.search.slice(1).split('&').filter(function (kv) { return /^sis_/.test(kv) && !/^sis_sz/.test(kv); }).join('&') : '')); return; }
      hint = h('<div class="sis-root sis-hint">' + ic('ruler') + '<span>いつものサイズは「<b>' + esc(memo) + '</b>」です。' + (href && !dis ? '　<a href="' + esc(href) + '">「' + esc(memo) + '」に切り替える</a>' : '（このカラーは「' + esc(memo) + '」の在庫がありません）') + '</span></div>');
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
    if (!forced && !FX.interestAlert.waited) { FX.interestAlert.waited = 1; return setTimeout(function () { FX.interestAlert(false); }, ((C.popup || {}).delaySec || 3) * 1000 + 1500); } // ポップアップの判定が済んでから
    var here = codeOf(P), days = (cfg.windowDays || 14) * 864e5;
    var list = (ls('interest') || []).filter(function (x) { return Date.now() - x.t < days; });
    cart().then(function (c) {
      c.items.forEach(function (i) {
        var code = i.code || ((ls('viewed') || []).filter(function (v) { return v.name && i.name && v.name === i.name; })[0] || {}).code;
        if (code) list.unshift({ code: code, name: i.name, kind: 'cart', t: Date.now() });
      });
      var seenK = {}, uniq = [];
      list.forEach(function (x) { var k = pkey(x.code); if (!seenK[k] && k !== pkey(here)) { seenK[k] = 1; uniq.push(x); } });
      uniq = uniq.slice(0, cfg.maxItems || 6); if (!uniq.length) return;
      var shown = ls('alertSeen') || {}, cap = (cfg.capHours || 24) * 3600e3;
      var saleDl = activeDeadlines().filter(function (x) { return x.d.id === (cfg.saleDeadline || 'sale15') && x.end - now() < (cfg.saleEndHours || 48) * 3600e3; })[0];
      return Promise.all([Promise.all(uniq.map(function (x) { return goodsInfo(x.code); })), saleDl ? saleSet() : Promise.resolve({})]).then(function (r) {
        var infos = r[0], sale = r[1], pick = null;
        uniq.forEach(function (x, i) {
          var g = infos[i]; if (pick || !g) return;
          if (g.soldout && x.kind !== 'cart') return; // カートに入れた商品だけ「売り切れました」も知らせる（次は早めに買ってもらうため）
          var why = g.soldout ? 'gone' : /△|残りわずか/.test(g.stock) ? 'low' : saleDl && sale[pkey(x.code)] ? 'saleEnd' : x.price && g.price && g.price < x.price ? 'drop' : null;
          if (!why || (!forced && shown[pkey(x.code) + why] && Date.now() - shown[pkey(x.code) + why] < cap)) return;
          pick = { x: x, g: g, why: why };
        });
        if (!pick) return;
        var from = { cart: 'カートに入れた', dwell: 'じっくり見ていた', fav: 'お気に入りの' }[pick.x.kind] || '気になっていた';
        var W = { gone: ['r', 'fire', 'このカラー・サイズは売り切れました', 'sis-t-r', '売り切れ'], low: ['r', 'fire', '在庫が残りわずかです', 'sis-t-r', '残りわずか'], saleEnd: ['c', 'clock', 'セール価格は' + (saleDl ? (new Date(saleDl.end - 1).getMonth() + 1) + '/' + new Date(saleDl.end - 1).getDate() : '') + ' 23:59まで', '', 'まもなく終了'], drop: ['g', 'tag', yen(pick.x.price - pick.g.price) + ' 値下がりしました', 'sis-t-g', '値下がり'] }[pick.why];
        var sec0 = forced ? 0 : (cfg.durationSec == null ? 5 : cfg.durationSec);
        var el = h('<a class="sis-root sis-alert" href="' + esc(pick.g.href) + '">' + (pick.g.img ? '<img src="' + esc(pick.g.img) + '" alt="">' : '') +
          '<div class="sis-tb"><span class="sis-tag ' + W[3] + '">' + ic(W[1]) + W[4] + '</span><div class="sis-ts" style="font-size:11px;margin-top:4px">' + from + '商品</div><div class="sis-tt">' + esc(pick.g.name) + '</div><div class="sis-why ' + W[0] + '">' + W[2] + '</div></div><button class="sis-x" aria-label="閉じる">×</button>' +
          (sec0 > 0 && !Q.get('sis_hold') ? '<span class="sis-timer" style="animation-duration:' + sec0 + 's"></span>' : '') + '</a>');
        el.querySelector('.sis-x').onclick = function (ev) { ev.preventDefault(); el.remove(); track('interestAlert', 'close'); };
        el.addEventListener('click', function () { track('interestAlert', 'click', { sis_label: pick.why }); });
        var waited = 0;
        (function place() { // ポップアップが開いている間は待ち、閉じてから出す（同時に2つ出さない）
          if ((SIS.popupPending || D.querySelector('.sis-modal, .sis-toast')) && waited++ < 120 && !forced) return setTimeout(place, 1000);
          show();
        })();
        function show() {
        D.body.appendChild(el); var fix = D.getElementById('sis-shipfix'); if (fix) el.style.bottom = (fix.getBoundingClientRect().height + 16 + parseInt(fix.style.bottom || 0)) + 'px';
        shown[pkey(pick.x.code) + pick.why] = Date.now(); ls('alertSeen', shown); SIS.active.interestAlert = pick.why;
        track('interestAlert', 'show', { sis_label: pick.why });
        var sec = forced ? 0 : (cfg.durationSec == null ? 5 : cfg.durationSec);
        if (sec > 0 && !Q.get('sis_hold')) setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 400); }, sec * 1000);
        }
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
    var html = '<div class="sis-root sis-hint" id="sis-modelsize">' + ic('ruler') + '<span>サイズの目安（撮影モデルの着用）　' + rows.map(function (r) { return '身長' + r.h + 'cm → <b>' + esc(r.size) + '</b>'; }).join('／') + '</span></div>';
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
    if (btn) btn.insertBefore(h('<div class="sis-root sis-hint sis-hr" style="margin:0 0 8px">' + ic('fire') + '<span>このカラー・サイズは<b>在庫が残りわずか</b>です</span></div>'), btn.firstChild);
    SIS.active.lowStock = 'on'; track('lowStock', 'impression', { sis_label: codeOf(P) });
  };

  /* 12a. 一覧のサムネイルにも「残りわずか」「在庫なし」（メルカートのクイックビューの在庫記号 △・× を、画面に見えた商品だけ取りに行く） */
  var qvCache = {}, qvQueue = [], qvRunning = 0;
  function quickStock(code) {
    var k = pkey(code);
    if (!qvCache[k]) {
      var c = ss('qv_' + k); if (c && Date.now() - c.t < 10 * 60e3) qvCache[k] = Promise.resolve(c.m);
      else if (SP) qvCache[k] = new Promise(function (res) { qvQueue.push(function () { // スマホ版はクイックビューが使えない（500になる）ので商品ページの在庫表示を読む
        return goodsInfo(code).then(function (g) { var m = {}; if (g && g.stock) m[code] = g.soldout ? '×' : g.low ? '△' : '○'; ss('qv_' + k, { t: Date.now(), m: m }); res(m); });
      }); pump(); });
      else qvCache[k] = new Promise(function (res) { qvQueue.push(function () {
        return get('/shop/goods/quickviewajax.aspx?goods=' + encodeURIComponent(code), 6000).then(function (html) {
          var t = parseDoc(html).body.textContent.replace(/\s+/g, ' '), m = {}, re = /商品コード\s*([\w-]+)\s*在庫\s*([○△×])/g, x;
          while ((x = re.exec(t))) m[x[1]] = x[2];
          ss('qv_' + k, { t: Date.now(), m: m }); res(m);
        }).catch(function () { res({}); });
      }); pump(); });
    }
    return qvCache[k].then(function (m) { return m[code] || null; });
  }
  function pump() { while (qvRunning < (SP ? 2 : 3) && qvQueue.length) { qvRunning++; qvQueue.shift()().then(function () { qvRunning--; pump(); }); } }
  FX.listStock = function () {
    if (PAGE !== 'list' && PAGE !== 'top') return;
    var n = 0, io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); mark(e.target); } }); }, { rootMargin: '200px' }) : null;
    function mark(img) {
      var a = img.closest('a'), code = a && codeOf(a.getAttribute('href')); if (!code) return;
      quickStock(code).then(function (s) {
        if (s !== '△' && s !== '×') return;
        var wrap = img.parentNode; if (wrap.querySelector('.sis-stk')) return;
        if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
        wrap.appendChild(h('<span class="sis-root sis-stk' + (s === '×' ? ' out' : '') + '">' + (s === '×' ? 'この色・サイズは在庫なし' : '残りわずか') + '</span>'));
        n++; SIS.active.listStock = n + '件';
      });
    }
    [].slice.call(D.querySelectorAll('a[href*="/shop/g/g"] img')).forEach(function (img, i) { if (img.closest('.sis-root')) return; if (io && !D.hidden) io.observe(img); else if (i < 40) mark(img); }); // 画面が裏にあるときは先頭40件だけ
    SIS.active.listStock = SIS.active.listStock || '確認中';
  };

  /* 12b. 人気の実数（旅行サイト型：見られた回数・カートに入った回数・売れた点数。GA4の実数だけ）
     数字は貴社サイト側のファイル（BO＞JavaScript管理の sis_data.js）に置き、SISの配信には貴社のデータを置かない */
  var dataP = null;
  function siteData() {
    return dataP || (dataP = fetch((C.dataUrl || '/js/usr/sis_data.js'), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.text(); })
      .then(function (t) { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); }).catch(function () { return null; }));
  }
  function popular() { return siteData().then(function (d) {
    var p = d && d.popular; if (!p) return null;
    if (typeof p.items === 'string') { var m = {}; p.items.split(';').forEach(function (s) { var kv = s.split(':'); if (kv[1]) m[kv[0]] = kv[1].split(',').map(Number); }); p.items = m; } // 「番号:閲覧,カート,購入;…」の形でも読む
    return p;
  }); }
  function rankData() { return siteData().then(function (d) { return d && d.ranking; }); }
  function familyCodes() { // この商品の色・サイズ違いの番号（ページ内のリンクから）
    var set = {}; set[codeOf(P)] = 1;
    [].slice.call(D.querySelectorAll('.block-variation--item, .block-color--item, .block-size--item, .block-variation a, .block-color a')).forEach(function (el) {
      var a = el.tagName === 'A' ? el : el.querySelector('a'), oc = (el.querySelector('[onclick]') || el).getAttribute('onclick') || '';
      var href = a ? a.getAttribute('href') : (oc.match(/location\.href\s*=\s*['"]([^'"]+)['"]/) || [])[1];
      var c = codeOf(href); if (c) set[c] = 1;
    });
    return Object.keys(set);
  }
  function popSum(items, codes) {
    var keys = {}, s = [0, 0, 0]; codes.forEach(function (c) { keys[pkey(c)] = 1; });
    Object.keys(keys).forEach(function (k) { var v = items[k]; if (v && v[1] <= v[0]) { s[0] += v[0]; s[1] += v[1]; s[2] += v[2]; } }); // カート数が閲覧数を超える番号（ノベルティ等）は除く
    return s;
  }
  FX.proof = function () {
    if (PAGE !== 'goods') return;
    var cfg = C.proof || {}, min = cfg.min || { views: 50, carts: 5, sold: 3 };
    Promise.all([popular(), rankData(), weekly()]).then(function (r) {
      var pop = r[0], rk = r[1]; if (!pop) { SIS.active.proof = 'データ待ち'; return; }
      var codes = familyCodes(), s = popSum(pop.items || {}, codes), rows = [];
      var d = pop.days || 7, rank = null;
      ((rk && rk.items) || []).forEach(function (x, i) { if (!rank && codes.some(function (c) { return pkey(c) === pkey(x.code); })) rank = x.rank || i + 1; });
      if (s[2] >= min.sold) rows.push('<li class="hot">' + ic('fire') + '<span>この' + d + '日間で <b>' + s[2] + '点</b> 売れています</span></li>');
      if (s[1] >= min.carts) rows.push('<li>' + ic('cart') + '<span>この' + d + '日間で <b>' + s[1] + '回</b> カートに入りました</span></li>');
      if (s[0] >= min.views) rows.push('<li>' + ic('eye') + '<span>この' + d + '日間で <b>' + s[0].toLocaleString() + '回</b> 見られています</span></li>');
      if (rank && rank <= 10 && !(r[2] && r[2].index)) rows.push('<li>' + ic('crown') + '<span>売れ筋ランキング <b>' + rank + '位</b>（' + esc((rk && rk.period) || '') + '）</span></li>');
      var wk = r[2] && (function () { var v = null; codes.forEach(function (c) { var x = r[2].index[pkey(c)]; if (x && x.r && (!v || x.r < v.r)) v = x; }); return v; })();
      if (wk && wk.r <= 10) rows.push('<li><span>週間売れ筋ランキング（' + esc(wk.g) + '） <b>' + wk.r + '位</b></span></li>');
      var st = ((D.getElementById('spec_stock_msg') || {}).textContent || '').trim();
      if (/△|残りわずか/.test(st)) rows.push('<li class="hot">' + ic('fire') + '<span>このカラー・サイズは <b>在庫が残りわずか</b></span></li>');
      if (!rows.length) return;
      var box = h('<div class="sis-root sis-proof" id="sis-proof"><div class="sis-proof-h">' + ic('spark') + 'この商品の人気（drug store\'s WEBSHOPの実数）</div><ul>' + rows.join('') + '</ul><div class="sis-proof-f">GA4の集計 ' + esc(pop.period || '') + '・色とサイズの合計</div></div>');
      var anchor = D.querySelector('.block-add-cart'); if (!anchor) return;
      anchor.parentNode.insertBefore(box, anchor);
      SIS.active.proof = rows.length + '行'; track('proof', 'impression', { sis_value: s[2] });
    });
  };
  /* 週間の売れ筋（ジャンル別TOP10）。Amazonの「ベストセラー1位（カテゴリ）」と同じ見せ方で、商品ページ・一覧にも順位を出す */
  function weekly() { return siteData().then(function (d) {
    var w = d && d.rank7; if (!w) return null;
    if (!w.index) { w.index = {}; (w.genres || []).forEach(function (g) { (g.items || []).forEach(function (code, i) { var k = pkey(code); if (g.name === '総合') { (w.index[k] = w.index[k] || {}).all = i + 1; } else { (w.index[k] = w.index[k] || {}).g = g.name; w.index[k].r = i + 1; } }); });
      Object.keys(w.alias || {}).forEach(function (k) { if (w.index[w.alias[k]]) w.index[k] = w.index[w.alias[k]]; }); } // 同じ商品の色・サイズ違いにも同じ順位
    return w;
  }); }
  FX.proofList = function () { // 一覧のサムネイルの下に「トップス 週間3位」（ジャンルTOP10に入っている商品だけ）
    if (PAGE !== 'list' && PAGE !== 'top') return;
    weekly().then(function (w) {
      if (!w) return; var n = 0, done = {};
      [].slice.call(D.querySelectorAll('a[href*="/shop/g/g"]')).forEach(function (a) {
        if (a.closest('.sis-root') || !a.querySelector('img')) return;
        var code = codeOf(a.getAttribute('href')), v = code && w.index[pkey(code)];
        if (!v || !v.r || v.r > 10 || done[pkey(code)]) return; done[pkey(code)] = 1;
        var box = a.parentNode, up = 0; while (box && !/[￥¥]\s?[\d,]+/.test(box.textContent) && up++ < 5) box = box.parentNode;
        if (!box || box.querySelector('.sis-sold')) return;
        box.appendChild(h('<div class="sis-root sis-sold"><span class="sis-best">' + esc(v.g) + ' 週間' + v.r + '位</span></div>')); n++;
      });
      if (n) { SIS.active.proofList = n + '件'; track('proofList', 'impression', { sis_value: n }); }
    });
  };
  FX.bestBadge = function () { // 商品ページ：商品名の近くに「トップス 週間売れ筋 1位」
    if (PAGE !== 'goods') return;
    weekly().then(function (w) {
      if (!w) return; var v = null; familyCodes().forEach(function (c) { var x = w.index[pkey(c)]; if (x && x.r && x.r <= 10 && (!v || x.r < v.r)) v = x; });
      if (!v) return;
      var nm = D.querySelector('.block-goods-name, h1.block-goods-name--text, h1'); if (!nm) return;
      nm.parentNode.insertBefore(h('<div class="sis-root"><a class="sis-best-g" href="/?sis_rank_tab=' + encodeURIComponent(v.g) + '#sis-sec-ranking" style="text-decoration:none">' + esc(v.g) + ' 週間売れ筋 ' + v.r + '位</a></div>'), nm);
      SIS.active.bestBadge = v.g + v.r + '位'; track('bestBadge', 'impression', { sis_label: v.g + ':' + v.r });
    });
  };

  /* 12c. トップの「あなた向け枠」：気になっていた商品が残りわずか・値下がり */
  FX.interestTop = function () {
    if (PAGE !== 'top') return Promise.resolve(false);
    var days = ((C.interest || {}).windowDays || 14) * 864e5;
    var list = (ls('interest') || []).concat(ls('viewed') || []).filter(function (x) { return Date.now() - x.t < days; });
    var seen = {}; list = list.filter(function (x) { var k = pkey(x.code); if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, 8);
    if (!list.length) return Promise.resolve(false);
    return Promise.all(list.map(function (x) { return goodsInfo(x.code); })).then(function (arr) {
      var hits = [];
      arr.forEach(function (g, i) { if (!g || g.soldout || !g.price) return; var x = list[i]; var why = g.low ? '残りわずか' : x.price && g.price < x.price ? yen(x.price - g.price) + '値下がり' : null; if (why) hits.push({ g: g, why: why }); });
      hits = uniqProduct(hits.map(function (x) { x.g.why = x.why; return x.g; })).map(function (g) { return { g: g, why: g.why }; });
      if (!hits.length) return false;
      var slider = D.getElementById('block_of_top_body') || mainEl().firstElementChild;
      var el = section('interestTop', shead({ tone: 'r', icon: 'fire', title: '気になっていた商品が' + (hits.every(function (x) { return x.why === '残りわずか'; }) ? '残りわずかです' : '動いています'), sub: 'あなたが見た・カートに入れた商品の、いまの在庫と価格です' }) +
        '<div class="sis-grid">' + hits.slice(0, 4).map(function (x) { return card(x.g, { badge: '<span class="sis-tag sis-t-r">' + esc(x.why) + '</span>' }); }).join('') + '</div>', slider, 'after');
      el.querySelectorAll('a').forEach(function (a) { a.onclick = function () { track('interestTop', 'click'); }; });
      return true;
    });
  };

  /* 13. 売れ筋ランキング（貴社サイト側の sis_data.js があるときだけ） */
  FX.ranking = function () {
    if (PAGE !== 'top' && PAGE !== 'list') return Promise.resolve(false);
    return weekly().then(function (w) {
      if (!w) return legacyRanking();
      var genres = (w.genres || []).filter(function (g) { return (g.items || []).length >= 3; }); if (!genres.length) return false;
      var anchor = D.getElementById('block_of_event');
      var el = section('ranking', shead({ tone: 'p', title: '週間売れ筋ランキング', sub: esc(w.period || '') + 'の購入数順（drug store\'s WEBSHOPの実績）・毎週更新' }) +
        '<div class="sis-tabs" role="tablist">' + genres.map(function (g, i) { return '<button type="button" role="tab" aria-selected="' + (i === 0) + '" data-g="' + i + '">' + esc(g.name) + '</button>'; }).join('') + '</div><div class="sis-grid sis-g5" id="sis-rank-grid"><div class="sis-note">読み込み中…</div></div>', anchor, 'before');
      function show(i) {
        [].slice.call(el.querySelectorAll('.sis-tabs button')).forEach(function (b) { b.setAttribute('aria-selected', String(+b.getAttribute('data-g') === i)); });
        var codes = genres[i].items.slice(0, 14);
        Promise.all(codes.map(goodsInfo)).then(function (arr) {
          var rows = uniqProduct(arr.filter(function (g) { return g && g.price && !g.soldout; })).slice(0, 10); // 同じ商品のサイズ違い・色違いは1つにまとめる
          el.querySelector('#sis-rank-grid').innerHTML = rows.map(function (g, k) { return card(g, { badge: '' }).replace('<div class="sis-im">', '<div class="sis-im"><span class="sis-rk' + (k === 0 ? ' r1' : '') + '">' + (k + 1) + '位</span>'); }).join('');
          track('ranking', 'tab', { sis_label: genres[i].name });
        });
      }
      el.querySelectorAll('.sis-tabs button').forEach(function (b) { b.onclick = function () { show(+b.getAttribute('data-g')); }; });
      var want = Q.get('sis_rank_tab'), start = 0; genres.forEach(function (g, i) { if (g.name === want) start = i; });
      show(start); return true;
    });
  };
  function legacyRanking() {
    return rankData().then(function (rk) {
      if (!rk) throw 0; var list = (rk.items || []).slice(0, 8); if (!list.length) return false;
      return Promise.all(list.map(function (x) { return goodsInfo(x.code); })).then(function (arr) {
        var rows = [];
        arr.forEach(function (g, i) { if (g && g.price && !g.soldout) rows.push({ g: g, rank: list[i].rank || i + 1 }); });
        rows = rows.slice(0, 4); if (!rows.length) return false;
        var anchor = D.getElementById('block_of_event');
        section('ranking', shead({ tone: 'y', icon: 'crown', title: esc(rk.title || 'いま売れているアイテム'), sub: esc(rk.period || '') + 'の購入数順（drug store\'s WEBSHOPの実績）' }) + '<div class="sis-grid">' +
          rows.map(function (r) { return card(r.g, { rank: r.rank }); }).join('') + '</div>', anchor, 'before');
        return true;
      });
    }).catch(function () { SIS.active.ranking = 'データ待ち'; return false; });
  }

  /* 14. さらに◯%OFF表示（BOでプロモーションを作ってから） */
  /* 14. いま使えるクーポン・まとめ割を、商品の価格の横に出す（クーポン・キャンペーンがある期間だけ）
     例：boohallo26（セール品にも使える500円OFF）／まとめてお得キャンペーン（2点で10%・3点以上で20%OFF、2026-07に実施） */
  FX.offers = function () {
    var list = (C.offers || []).filter(function (o) { return !o.off && (!o.from || now() >= new Date(o.from)) && (!o.to || now() < new Date(o.to)); }); if (!list.length) return;
    var n = 0;
    list.forEach(function (o) {
      var inScope = !o.scopePaths || !o.scopePaths.length || o.scopePaths.some(function (p) { return P.indexOf(p) === 0; });
      var txt = o.type === 'bundle' ? o.label : (o.code ? 'クーポン「' + o.code + '」で' : '') + o.label;
      if (PAGE === 'list' && inScope) {
        D.querySelectorAll('.block-goods-detail-j--price-items, .block-thumbnail-t--price-items, [class*="--price-items"]').forEach(function (box) {
          if (o.saleOnly && !/通常価格/.test(box.textContent)) return; if (box.querySelector('.sis-offer')) return;
          var p = num((box.querySelector('[class*="--price"]:not([class*="default"])') || box).textContent);
          var short = o.type === 'yen' && p > o.yen ? (o.short || 'クーポン併用で') + ' ' + yen(p - o.yen) : o.type === 'percent' && p ? (o.short || 'クーポン併用で') + ' ' + yen(Math.floor(p * (100 - o.rate) / 100)) : o.label; // 一覧は1行で短く
          box.appendChild(h('<div class="sis-root sis-offer"><span class="sis-xoff">' + esc(short) + '</span></div>')); n++;
        });
      }
      if (PAGE === 'goods' && (!o.saleOnly || D.querySelector('.block-goods-price--default-price'))) {
        var pr = D.querySelector('.block-goods-price--price'), p = num(pr && pr.textContent);
        if (pr && p) { var pay = o.type === 'yen' && p > o.yen ? '　この商品1点なら ' + yen(p - o.yen) : o.type === 'percent' ? '　お支払い ' + yen(Math.floor(p * (100 - o.rate) / 100)) : ''; pr.parentNode.appendChild(h('<div class="sis-root sis-offer"><span class="sis-xoff" style="font-size:14px;padding:6px 12px">' + esc(txt) + esc(pay) + (o.until ? '（' + esc(o.until) + '）' : '') + '</span></div>')); n++; }
      }
      if (PAGE === 'cart' && o.type === 'bundle' && o.tiers) {
        cart(true).then(function (c) {
          var t = o.tiers.filter(function (x) { return x.n > c.count; })[0], cur = o.tiers.filter(function (x) { return x.n <= c.count; }).pop();
          var msg = t ? 'あと' + (t.n - c.count) + '点で <b>さらに' + t.rate + '%OFF</b>（' + esc(o.name || 'まとめ割') + '）' : '<b>' + cur.rate + '%OFF</b> が適用される点数です（' + esc(o.name || 'まとめ割') + '）';
          var anchor = D.querySelector('.block-cart--container') || D.querySelector('.block-cart'); if (anchor) anchor.parentNode.insertBefore(h('<div class="sis-root sis-ordnote" style="max-width:1200px;margin:10px auto">' + msg + '</div>'), anchor);
        });
      }
    });
    if (n) { SIS.active.offers = n + '件'; track('offers', 'impression', { sis_value: n }); }
  };
  FX.extraOff = function () {
    var x = C.extraOff || {}; if (!x.on && !DEMO) return;
    var rate = x.rate || 20, lab = (x.label || 'カートでさらに{rate}%OFF').replace('{rate}', rate) + (x.on ? '' : '（BO設定待ちのプレビュー）');
    var inScope = (x.scopePaths || []).some(function (p) { return P.indexOf(p) === 0; });
    var n = 0;
    if (PAGE === 'list' && inScope) {
      D.querySelectorAll('.block-goods-detail-j--price-items, .block-thumbnail-t--price-items, [class*="--price-items"]').forEach(function (box) {
        var p = num((box.querySelector('[class*="--price"]:not([class*="default"])') || box).textContent); if (!p) return;
        box.appendChild(h('<div class="sis-root"><span class="sis-xoff">' + ic('tag') + 'さらに' + rate + '%OFF → ' + yen(Math.floor(p * (100 - rate) / 100)) + '</span></div>')); n++;
      });
    }
    if (PAGE === 'goods' && D.querySelector('.block-goods-price--default-price')) {
      var pr = D.querySelector('.block-goods-price--price'); var p = num(pr && pr.textContent);
      if (p) { pr.parentNode.appendChild(h('<div class="sis-root"><span class="sis-xoff" style="font-size:14px;padding:6px 12px">' + ic('tag') + esc(lab) + '　お支払い ' + yen(Math.floor(p * (100 - rate) / 100)) + '</span></div>')); n++; }
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
          var ship = after >= SHOP.freeShipping ? '<span class="sis-tag sis-t-g">' + ic('truck') + 'まとめて買うと送料無料</span>' : '<span class="sis-tag">あと ' + yen(SHOP.freeShipping - after) + ' で送料無料</span>';
          var anchor = D.querySelector('.block-add-cart');
          var el = section('coord', shead({ tone: 'p', icon: 'shirt', title: 'このアイテムを使ったスタッフコーデ', sub: esc(hit.label), more: { href: hit.page, label: 'コーデ一覧' } }) +
            '<div class="sis-coord"><a href="' + esc(hit.page) + '"><img src="' + esc(hit.img) + '" alt="スタッフコーデ"></a><div><div class="sis-grid">' + arr.map(function (g) { return card(g, { badge: g.soldout ? '<span class="sis-tag sis-t-p">在庫なし</span>' : '' }); }).join('') + '</div>' +
            '<div class="sis-sum"><div class="sis-sum-p">コーデ' + avail.length + '点の合計<br><b>' + yen(sum) + '</b>　' + ship + '</div>' +
            (add.length ? '<button type="button" class="sis-btn" id="sis-coord-all">' + ic('cart') + 'まとめてカートへ（' + add.length + '点）</button>' : '<span>コーデのアイテムはすべてカートに入っています</span>') + '</div></div></div>',
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
      var first = c.items[0], prev = ls('cartPrices') || {}, nowP = {};
      Promise.all(c.items.slice(0, 6).map(function (i) { return i.code ? goodsInfo(i.code) : Promise.resolve(null); })).then(function (gs) {
        var rest = SHOP.freeShipping - c.total, cnt = { out: 0, low: 0, sale: 0, drop: 0 };
        // 商品ごとの状態：在庫切れ（×）／残りわずか（△）／前に見たときより値下がり／セール中（通常価格つき）
        var rows = c.items.slice(0, 6).map(function (it, k) {
          var g = gs[k] || {}, unit = it.qty ? Math.round(it.amt / it.qty) : 0, p0 = prev[it.code];
          if (it.code && (g.price || unit)) nowP[it.code] = g.price || unit;
          var st = g.soldout ? ['out', '在庫切れになりました'] : g.low ? ['low', '残りわずか'] : p0 && g.price && g.price < p0 ? ['drop', yen(p0 - g.price) + '値下がり'] : g.orig && g.price && g.orig > g.price ? ['sale', 'セール中'] : null;
          var dm = (Q.get('sis_cartstate') || '').split(',')[k]; // 画面確認用：sis_cartstate=out,low,drop
          if (dm) st = { out: ['out', '在庫切れになりました'], low: ['low', '残りわずか'], drop: ['drop', '¥500値下がり'], sale: ['sale', 'セール中'] }[dm] || st;
          if (st) cnt[st[0]]++;
          return { img: g.img || it.img, name: it.name, st: st };
        });
        ls('cartPrices', nowP);
        var flagged = rows.filter(function (r) { return r.st; });
        if (flagged.length) { SIS.active.cartReminder = Object.keys(cnt).filter(function (k) { return cnt[k]; }).map(function (k) { return k + cnt[k]; }).join(' '); track('cartReminder', 'status', { sis_label: SIS.active.cartReminder }); }
        var show = (flagged.length ? flagged : rows).slice(0, 3);
        var el = toast('cartReminder', '<div class="sis-tb"><div class="sis-tt">カートに' + c.count + '点 残っています</div><div class="sis-ts">' + yen(c.total) + (rest > 0 ? '・あと' + yen(rest) + 'で送料無料' : '・送料無料') + (cnt.out ? '・<b style="color:var(--sis-r)">売り切れた商品があります</b>' : '') + '</div>' +
          '<div class="sis-crows">' + show.map(function (r) { return '<div class="sis-crow">' + (r.img ? '<img src="' + esc(r.img) + '" alt="">' : '') + '<span class="nm">' + esc(r.name) + '</span>' + (r.st ? '<span class="sis-st ' + r.st[0] + '">' + esc(r.st[1]) + '</span>' : '') + '</div>'; }).join('') + '</div></div>' +
          '<a class="sis-btn sis-sm" style="flex:none" href="/shop/cart/cart.aspx">カートへ</a>');
        el.classList.add('sis-wide');
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
        var msg = price >= rest ? 'この商品を足すと<b>送料無料</b>になります（カート ' + yen(c.total) + '）' : 'この商品を足すと、送料無料まであと<b>' + yen(rest - price) + '</b>';
        btn.insertBefore(h('<div class="sis-root sis-hint sis-hc" style="margin:0 0 8px">' + ic('truck') + '<span>' + msg + '</span></div>'), btn.firstChild);
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
        var el = section('crossSell', shead({ tone: 'sale', icon: 'truck', title: 'あと ' + yen(rest) + ' で送料無料　この1点でクリア', sub: '最近見た商品・よく見るカテゴリから、足りない額以上のものを選んでいます' }) + '<div class="sis-grid sis-4">' +
          pick.map(function (g) { return card(g, { add: true, why: g.why }); }).join('') + '</div>', anchor, 'after');
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
  var NAMES = { headerSplit: 'ヘッダーの分割（残り時間・コード）', orderCoupon: '購入手続きでくじのクーポンを自動入力', orderDone: '注文完了の記録', listStock: '一覧の在庫（残りわずか・在庫なし）', bestBadge: '商品ページの週間順位', offers: 'クーポン・まとめ割の表示', proof: '人気の実数（旅行サイト型）', proofList: '一覧の週間順位', interestTop: '気になる商品（トップ）', popup: 'ポップアップ枠', interestAlert: '気になる商品のお知らせ', eventOrder: 'イベント枠の並べ替え', exit: '離脱時ポップアップ', source: '流入元別の出し分け', coupon: '入店時クーポン', shipbar: '送料無料バー', countdown: '期限カウントダウン', kuji: 'くじ', rank: '会員ランク別UI', newRepeat: '新規／リピーター', catBanner: '閲覧カテゴリ別バナー', sizeMemo: 'サイズ記憶', modelSize: 'サイズの目安', lowStock: '在庫僅少バッジ', ranking: '売れ筋ランキング', extraOff: 'さらに◯%OFF', coord: 'コーデまとめ買い', cartReminder: 'カゴ落ち表示', crossSell: 'カート内クロスセル' };
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
    var order = ['orderCoupon', 'orderDone', 'headerSplit', 'countdown', 'source', 'coupon', 'rank', 'shipbar', 'eventOrder', 'interestTop', 'newRepeat', 'catBanner', 'ranking', 'proofList', 'listStock', 'bestBadge', 'sizeMemo', 'modelSize', 'lowStock', 'proof', 'offers', 'extraOff', 'coord', 'crossSell', 'cartReminder', 'interestAlert', 'popup', 'kuji', 'exit'];
    var slot = C.topSlot || {};
    if (PAGE === 'top' && slot.mode === 'one' && !Q.get('sis_only')) { // トップの「あなた向け枠」は優先順に1つだけ出す
      var so = (slot.order || ['interestTop', 'newRepeat', 'catBanner', 'ranking']).filter(function (k) { return F[k] !== false && FX[k]; });
      order = order.filter(function (k) { return so.indexOf(k) < 0; });
      so.reduce(function (pr, k) { return pr.then(function (done) { if (done) return true; try { return Promise.resolve(FX[k](false)).then(function (r) { return !!r; }); } catch (e) { return false; } }); }, Promise.resolve(false));
    }
    var only = (Q.get('sis_only') || '').split(',').filter(Boolean);
    order.forEach(function (k) { if (F[k] === false || !FX[k] || only.length && only.indexOf(k) < 0) return; try { FX[k](false); } catch (e) { SIS.active[k] = 'エラー'; if (window.console) console.warn('[SIS]', k, e); } });
    var sh = Q.get('sis_show'); if (sh) setTimeout(function () { SIS.show(sh); }, 600);
    chip(); renderDebug();
  });
})();
