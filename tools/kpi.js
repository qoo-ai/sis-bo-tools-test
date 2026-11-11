/* KPI取得（#SP-1）
   BOの［分析/集計］を裏で読み、小窓（kpi.html・GitHub Pages）経由で KPIシートの raw_ タブへ送る。
   BOの読み込み制限（CSP）でBOから直接Googleへは送れないため、小窓が中継する。
   「毎日自動」をONにすると、この画面と小窓を開いたままの間、毎日決まった時刻に自動で取る。 */
(function () {
  var W = window;
  // セッション維持ONで枠の中から呼ばれたら、外側（画面を移動しても消えない側）で開き直す
  try {
    if (W.top !== W && W.top.location.host === location.host) {
      if (W.top.__sisKpi) { W.top.__sisKpi.show(); return; }
      var me = document.currentScript && document.currentScript.src;
      if (me) { var sc = W.top.document.createElement('script'); sc.src = me; sc.charset = 'utf-8'; W.top.document.body.appendChild(sc); return; }
    }
  } catch (e) {}
  if (W.__sisKpi) { W.__sisKpi.show(); return; }
  var D = W.document, BO = location.pathname.match(/^\/[a-z]+/)[0];
  var G = 'https://qoo-ai.github.io', RELAY = G + '/sis-bo-tools-test/kpi.html#' + encodeURIComponent(location.origin);
  var AUTO_KEY = 'sisKpiAuto', LAST_KEY = 'sisKpiLast', AT = '07:30';
  var st = { busy: false, relay: null, timer: null };

  /* ---------- 画面 ---------- */
  var box = D.createElement('div');
  box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483646;width:360px;max-width:calc(100vw - 24px);background:#fff;color:#101828;border:1px solid #d0d5dd;border-radius:10px;box-shadow:0 8px 24px rgba(16,24,40,.18);font:14px/1.5 sans-serif';
  box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #eaecf0;background:#fff4e5;font-weight:bold">KPI取得<button data-x style="border:0;background:none;font-size:18px;cursor:pointer;color:#667085">×</button></div>'
    + '<div style="padding:12px 14px">'
    + '<button data-run style="width:100%;height:40px;border:0;border-radius:8px;background:#ee7832;color:#fff;font:inherit;font-weight:bold;cursor:pointer">今すぐ取得</button>'
    + '<label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px"><input type="checkbox" data-auto> 毎日 ' + AT + ' に自動で取得</label>'
    + '<div data-st style="margin-top:8px;font-size:12px;color:#475467"></div>'
    + '<div data-log style="margin-top:8px;max-height:180px;overflow:auto;font-size:12px;color:#344054;white-space:pre-wrap"></div></div>';
  D.body.appendChild(box);
  var $ = function (s) { return box.querySelector('[' + s + ']'); };
  function log(m) { $('data-log').textContent += m + '\n'; $('data-log').scrollTop = 1e9; }
  function status() {
    var last = ''; try { last = W.localStorage.getItem(LAST_KEY) || ''; } catch (e) {}
    $('data-st').textContent = (last ? '前回の取得：' + last : 'まだ取得していません') + ($('data-auto').checked ? ' ・ 自動ON（この画面と小窓を開いたままにしてください）' : '');
  }
  $('data-x').onclick = function () { box.style.display = 'none'; };
  W.__sisKpi = { show: function () { box.style.display = ''; } };

  /* ---------- 日付 ---------- */
  function pad(n) { return ('0' + n).slice(-2); }
  function ymd(d, sep) { sep = sep || '/'; return d.getFullYear() + sep + pad(d.getMonth() + 1) + sep + pad(d.getDate()); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }

  /* ---------- BOの集計を読む ---------- */
  function dec(buf) { var u = new TextDecoder('utf-8').decode(buf); return (u.match(/�/g) || []).length > 5 ? new TextDecoder('shift_jis').decode(buf) : u; }
  async function get(path, params) {
    var q = new URLSearchParams(); params.forEach(function (p) { q.append(p[0], p[1]); });
    var r = await fetch(BO + '/' + path + '?' + q.toString(), { credentials: 'include', cache: 'no-store' });
    var t = dec(await r.arrayBuffer());
    if (/<form[^>]+default\.aspx|name="?login/i.test(t) && /ログイン/.test(t)) throw new Error('ログインが切れています');
    return t;
  }
  function tsv(t) { return t.split(/\r?\n/).filter(function (x) { return x.trim(); }).map(function (l) { return l.split('\t'); }); }
  function col(h, name) { return h.indexOf(name); }
  function n(v) { var x = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(x) ? '' : x; }
  function tables(html) {
    var d = new DOMParser().parseFromString(html, 'text/html');
    return [].slice.call(d.querySelectorAll('table')).filter(function (t) { return !t.querySelector('table'); })
      .map(function (t) { return [].map.call(t.rows, function (r) { return [].map.call(r.cells, function (c) { return c.textContent.replace(/\s+/g, ' ').trim(); }); }); });
  }
  // 日別集計は「10/01（水）」のように年がないので、開始日から順に年を付ける
  function withYear(rows, start) {
    var y = start.getFullYear(), pm = start.getMonth() + 1;
    return rows.map(function (r) {
      var m = Number(r[0].slice(0, 2)), d = r[0].slice(3, 5);
      if (m < pm) y++; pm = m;
      return [y + '/' + pad(m) + '/' + d].concat(r.slice(1));
    });
  }

  function csv(t) {  // 改行・カンマを含む項目にも対応
    var R = [], r = [], f = '', q = false;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { r.push(f); f = ''; }
      else if (ch === '\n') { r.push(f.replace(/\r$/, '')); R.push(r); r = []; f = ''; }
      else f += ch;
    }
    if (f || r.length) { r.push(f); R.push(r); }
    return R;
  }
  async function post(path, pairs) {
    var fd = new URLSearchParams(); pairs.forEach(function (p) { fd.append(p[0], p[1]); });
    var r = await fetch(BO + '/' + path, { method: 'POST', body: fd, credentials: 'include', cache: 'no-store' });
    var ct = r.headers.get('content-type') || '', b = await r.arrayBuffer();
    var t = new TextDecoder(/html/.test(ct) ? 'utf-8' : 'shift_jis').decode(b);
    if (/html/.test(ct) && /ログイン/.test(t) && /name="?login/i.test(t)) throw new Error('ログインが切れています');
    return t;
  }
  // 日別の割引と通常価格の売上（粗利の計算用）。個人情報は集計だけに使い、送らない
  // 原価（税抜・1個あたり）：BOの商品マスタに入っていればそれ、なければKPIシートの「原価」タブ（商品コードか、その上位の品番）
  async function sheetCost() {
    try { var r = await send({ want: 'cost' }, true); var c = r.cost || {}; log('　原価表 ' + Object.keys(c).length + '件'); return c; }
    catch (e) { log('　原価表は読めませんでした（仮の原価率で計算）'); return {}; }
  }
  async function profitDaily(now, SC) {
    log('商品の通常価格と原価…');
    var G = csv(await post('goods/search.aspx', [['view.goods', '1'], ['view.price', '1'], ['view.cost', '1'], ['mode', 'CSV'], ['max', '200000']]));
    var gh = G[0] || [], gi = gh.indexOf('商品コード'), pi = gh.lastIndexOf('販売価格(税込)'), ci = gh.indexOf('原価'), ni = gh.indexOf('商品名'), PR = {}, BC = {}, NM = {}, CC = {};
    G.slice(1).forEach(function (c) { if (!c[gi]) return; PR[c[gi]] = +c[pi] || 0; NM[c[gi]] = ni < 0 ? '' : c[ni]; if (ci >= 0 && +c[ci] > 0) BC[c[gi]] = +c[ci]; });
    function cost(code) {
      if (code in CC) return CC[code];
      var v = BC[code] != null ? BC[code] : null, k = code;
      while (v == null && k) { if (SC[k] != null) v = SC[k]; var j = k.lastIndexOf('-'); k = j > 0 ? k.slice(0, j) : ''; }
      return CC[code] = v;
    }
    var y1 = ymd(addDays(now, -364)), SK = {};
    var day = {}, hd = ['日付', '注文数', '通常価格の商品売上', '商品売上（セール後）', 'クーポン値引', 'キャンペーン値引', 'ポイント値引', '金額調整', '送料', '手数料', '注文金額合計', '通常価格不明の明細', '原価（登録分）', '原価未登録の通常価格売上'];
    function D(k) { return day[k] = day[k] || [k, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; }
    function dk(s) { var m = String(s).match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/); return m ? m[1] + '/' + pad(+m[2]) + '/' + pad(+m[3]) : ''; }
    for (var i = 24; i >= 0; i--) {
      var a = new Date(now.getFullYear(), now.getMonth() - i, 1), b = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      if (b > now) b = now;
      log('　割引と通常価格 ' + a.getFullYear() + '/' + pad(a.getMonth() + 1) + '…');
      var O = csv(await post('sales/search.aspx', [['mode', 'VIEW_CSV'], ['order_dt1', ymd(a)], ['order_dt2', ymd(b)], ['max', '100000'],
        ['view.cancel_dt', '1'], ['view.subtotal', '1'], ['view.charge', '1'], ['view.postage', '1'], ['view.discount', '1'], ['view.total', '1'],
        ['view.point_out', '1'], ['view.coupon_discount', '1'], ['view.promotion_discount', '1'], ['view.order_dt', '1']]));
      var oh = O[0] || [], X = function (k) { return oh.indexOf(k); }, can = {};
      O.slice(1).forEach(function (c) {
        var no = c[X('注文番号')]; if (!no) return;
        if (c[X('キャンセル日')]) { can[no] = 1; return; }
        var r = D(dk(c[X('注文日')])); if (!r[0]) return;
        var g = function (k) { return +(c[X(k)] || 0) || 0; };
        r[1]++; r[4] += g('クーポン値引き額'); r[5] += g('キャンペーン値引き額'); r[6] += g('ポイント使用(値引き)'); r[7] += g('金額調整');
        r[8] += g('送料'); r[9] += g('手数料'); r[10] += g('注文金額合計');
      });
      var Dt = csv(await post('sales/search.aspx', [['mode', 'DETAIL_CSV'], ['order_dt1', ymd(a)], ['order_dt2', ymd(b)], ['max', '200000'],
        ['csvview.goods', '1'], ['csvview.qty', '1'], ['csvview.amt', '1']]));
      var dh = Dt[0] || [], Y = function (k) { return dh.indexOf(k); };
      Dt.slice(1).forEach(function (c) {
        var no = c[Y('注文番号')]; if (!no || can[no]) return;
        var r = D(dk(c[Y('注文日')])); if (!r[0]) return;
        var code = c[Y('商品コード')], q = +c[Y('数量')] || 0, amt = +c[Y('合計')] || 0, p = PR[code], reg = amt;
        r[3] += amt; if (p && p * q >= amt) reg = p * q; else r[11]++;
        r[2] += reg;
        var cv = cost(code); if (cv != null) r[12] += cv * q; else r[13] += reg;
        if (r[0] >= y1) { var o = SK[code] = SK[code] || [code, NM[code] || c[Y('商品名')] || '', 0, 0]; o[2] += q; o[3] += amt; }
      });
    }
    var daily = [hd].concat(Object.keys(day).filter(function (k) { return k; }).sort().map(function (k) { return day[k]; }));
    var skus = [['商品コード', '商品名', '直近1年の販売数', '直近1年の売上']].concat(Object.keys(SK).map(function (k) { return SK[k]; }).sort(function (a, b) { return b[3] - a[3]; }));
    return { daily: daily, skus: skus };
  }

  async function collect() {
    var now = new Date(), today = ymd(now), d30 = ymd(addDays(now, -29)), d90 = ymd(addDays(now, -89));
    var start = new Date(2024, 0, 1), S = ['visitor', 'order', 'repeater', 'customer', 'cancel'];
    var dev = [['devicetype', 'P'], ['devicetype', 'S'], ['devicetype', 'M']];
    var out = {};

    log('日別（2024/01〜）…');
    var a = tsv(await get('report/summary_d.aspx', [['dt1', ymd(start)], ['dt2', today], ['source', '0']].concat(S.map(function (s) { return ['sales', s]; }), [['output', 'TAB'], ['search.x', '1']])));
    log('日別（スマホ）…');
    var b = tsv(await get('report/summary_d.aspx', [['dt1', ymd(start)], ['dt2', today], ['source', '0'], ['devicetype', 'S'], ['sales', 'visitor'], ['sales', 'order'], ['output', 'TAB'], ['search.x', '1']]));
    var ha = a[0], hb = b[0];
    var A = withYear(a.slice(1).filter(function (r) { return /^\d\d\/\d\d/.test(r[0]); }), start);
    var B = withYear(b.slice(1).filter(function (r) { return /^\d\d\/\d\d/.test(r[0]); }), start), BM = {};
    B.forEach(function (r) { BM[r[0]] = r; });
    out.daily = [['日付', '来客数', '注文件数', '注文金額', '新規会員', 'メルマガ登録', 'キャンセル件数', 'キャンセル金額', 'スマホ来客数', 'スマホ注文件数', 'スマホ注文金額', 'リピート注文数']]
      .concat(A.map(function (r) {
        var s = BM[r[0]] || [];
        return [r[0], n(r[col(ha, '来客数')]), n(r[col(ha, '注文件数')]), n(r[col(ha, '注文金額')]), n(r[col(ha, '新規会員登録数')]), n(r[col(ha, 'メールニュース登録数')]),
          n(r[col(ha, 'キャンセル件数')]), n(r[col(ha, 'キャンセル金額')]), n(s[col(hb, '来客数')]), n(s[col(hb, '注文件数')]), n(s[col(hb, '注文金額')]), n(r[col(ha, 'リピート注文数')])];
      }));
    log('　' + (out.daily.length - 1) + '日分');

    log('月別（2017/01〜）…');
    var m = tsv(await get('report/summary_m.aspx', [['dt1', '2017/01/01'], ['dt2', today], ['source', '0']].concat(S.map(function (s) { return ['sales', s]; }), [['output', 'TAB'], ['search.x', '1']])));
    var hm = m[0];
    out.monthly = [['月', '来客数', '注文件数', '注文金額', 'リピート注文数', '新規会員', 'メルマガ登録', 'キャンセル件数', 'キャンセル金額', '月初日']]
      .concat(m.slice(1).filter(function (r) { return /^\d{4}\/\d{2}$/.test(r[0]); }).map(function (r) {
        return [r[0], n(r[col(hm, '来客数')]), n(r[col(hm, '注文件数')]), n(r[col(hm, '注文金額')]), n(r[col(hm, 'リピート注文数')]), n(r[col(hm, '新規会員登録数')]),
          n(r[col(hm, 'メールニュース登録数')]), n(r[col(hm, 'キャンセル件数')]), n(r[col(hm, 'キャンセル金額')]), r[0].replace('/', '-') + '-01'];
      }));

    log('時間帯（直近90日）…');
    var h = tsv(await get('report/summary_t.aspx', [['dt1', d90], ['dt2', today], ['source', '0'], ['sales', 'visitor'], ['sales', 'order'], ['output', 'TAB'], ['search.x', '1']]));
    var hh = h[0];
    out.hourly = [['時間帯', '来客数', '注文件数', '注文金額']].concat(h.slice(1).filter(function (r) { return /^\d+:/.test(r[0]); }).map(function (r) {
      return [('0' + parseInt(r[0], 10)).slice(-2) + '時', n(r[col(hh, '来客数')]), n(r[col(hh, '注文件数')]), n(r[col(hh, '注文金額')])];
    }));

    log('流入元（直近30日）…');
    var c = tsv(await get('report/session.aspx', [['s_dt', d30 + ' 00:00'], ['e_dt', today + ' 23:59']].concat(dev, [['group', 'referer_domain'], ['sort', 'cnt'], ['desc', 'desc'], ['top', '100'], ['output', 'TAB'], ['search.x', '1']])));
    out.channels = [['参照元', '訪問数', '注文数', '注文金額']].concat(c.slice(1).map(function (r) { return [r[3] || '', n(r[0]), n(r[1]), n(r[2])]; }));

    log('売れている商品（直近30日）…');
    var p = tsv(await get('report/sales.aspx', [['s_dt', d30], ['e_dt', today], ['dt', 'order_dt'], ['group', 'variation_group'], ['sort', 'amt'], ['sort2', 'desc']].concat(dev, [['exists_cancel_dt', 'n'], ['source', '0'], ['top', '100'], ['output', 'TAB'], ['search.x', '1']])));
    out.products = [['商品コード', '商品名', '平均単価', '数量', '金額', '件数']].concat(p.slice(1).filter(function (r) { return r[0] && !/^合計/.test(r[0]); }).map(function (r) {
      var i = r[0].indexOf('/'); return [r[0].slice(0, i), r[0].slice(i + 1), n(r[1]), n(r[2]), n(r[3]), n(r[4])];
    }));

    log('検索キーワード（直近30日）…');
    var k = tables(await get('searchlog/rank.aspx', [['s_dt', d30 + ' 00:00'], ['e_dt', today + ' 23:59']].concat(dev, [['top', '100'], ['where', 'cnt'], ['order', 'desc'], ['search.x', '1']])))
      .filter(function (t) { return t[0] && t[0].join('').indexOf('キーワード') >= 0; })[0] || [];
    out.keywords = [['キーワード', '検索数', 'ヒット商品数']].concat(k.slice(1).map(function (r) { return [r[2], n(r[3]), n(r[4])]; }));

    log('会員ランク（月別の人数）…');
    var rj = JSON.parse(await get('customer/rank_transition_api.aspx', [['From', '2025/10'], ['To', now.getFullYear() + '/' + pad(now.getMonth() + 1)]]));
    out.ranks = [['月', 'ランク', '人数', 'ランクアップ', 'ランクダウン']];
    (rj.transitionData || []).forEach(function (m) {
      (m.rankUpDownData || []).forEach(function (r) {
        var t = (r.rankUp || 0) + (r.rankDown || 0) + (r.rankKeep || 0);
        if (t > 0) out.ranks.push([m.month, r.name, t, r.rankUp || 0, r.rankDown || 0]);
      });
    });

    log('会員ランク別の売上…');
    var d365 = ymd(addDays(now, -364));
    out.rank_sales = [['期間', 'ランク', '平均単価', '数量', '金額', '件数']];
    for (var pi = 0, PS = [['直近30日', d30], ['直近365日', d365]]; pi < PS.length; pi++) {
      var rs = tsv(await get('report/sales.aspx', [['s_dt', PS[pi][1]], ['e_dt', today], ['dt', 'order_dt'], ['group', 'rank'], ['sort', 'amt'], ['sort2', 'desc'], ['exists_cancel_dt', 'n'], ['source', '0'], ['top', '100'], ['output', 'TAB'], ['search.x', '1']]));
      rs.slice(1).filter(function (r) { return !/^合計/.test(r[0] || ''); }).forEach(function (r) {
        out.rank_sales.push([PS[pi][0], r[1] || (r[0] ? r[0] : '会員以外'), n(r[2]), n(r[3]), n(r[4]), n(r[5])]);
      });
    }

    var SC = await sheetCost(), pf = await profitDaily(now, SC);
    out.daily_profit = pf.daily; out.skus = pf.skus;

    out.info = [['最終取得', ymd(now) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes())], ['GA4最終取得', ''], ['時間帯の期間', d90 + '〜' + today], ['流入元・商品・検索の期間', d30 + '〜' + today]];
    return out;
  }

  /* ---------- 小窓（中継）とのやりとり ---------- */
  function openRelay() {
    if (st.relay && !st.relay.closed) return st.relay;
    st.relay = W.open(RELAY, 'sisKpiRelay', 'width=360,height=220,left=' + (W.screenX + 40) + ',top=' + (W.screenY + 60));
    return st.relay;
  }
  function send(data, keep) {
    return new Promise(function (ok, ng) {
      var w = st.relay; if (!w || w.closed) { ng(new Error('小窓が開けませんでした（ポップアップを許可してください）')); return; }
      var done = false, to = setTimeout(function () { if (!done) { W.removeEventListener('message', on); ng(new Error('小窓から返事がありません')); } }, 120000);
      function on(e) {
        var m = e.data && e.data.sisKpi; if (e.origin !== G || !m) return;
        if (m.ready) { w.postMessage({ sisKpi: { data: data, keep: keep } }, G); return; }
        if (m.result) { done = true; clearTimeout(to); W.removeEventListener('message', on); m.result.ok ? ok(m.result) : ng(new Error(m.result.error || '送信に失敗しました')); }
      }
      W.addEventListener('message', on);
      try { w.postMessage({ sisKpi: { ping: 1 } }, G); } catch (e) {}
    });
  }

  async function run(auto) {
    if (st.busy) return; st.busy = true; $('data-run').disabled = true; $('data-log').textContent = '';
    try {
      if (!auto) openRelay();
      var data = await collect();
      log('KPIシートへ送信…');
      var r = await send(data, !!auto || $('data-auto').checked);
      var now = new Date(), s = ymd(now) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
      try { W.localStorage.setItem(LAST_KEY, s); } catch (e) {}
      log('完了：' + Object.keys(r.rows || {}).map(function (k) { return k + ' ' + r.rows[k]; }).join(' / '));
    } catch (e) { log('止まりました：' + e.message); }
    st.busy = false; $('data-run').disabled = false; status();
  }

  function tick() {
    if (!$('data-auto').checked || st.busy) return;
    var now = new Date(), hm = pad(now.getHours()) + ':' + pad(now.getMinutes()), last = '';
    try { last = W.localStorage.getItem(LAST_KEY) || ''; } catch (e) {}
    if (hm >= AT && last.slice(0, 10) !== ymd(now)) run(true);
  }
  $('data-run').onclick = function () { run(false); };
  $('data-auto').onchange = function () {
    try { W.localStorage.setItem(AUTO_KEY, this.checked ? '1' : ''); } catch (e) {}
    if (this.checked) openRelay();
    status();
  };
  try { $('data-auto').checked = W.localStorage.getItem(AUTO_KEY) === '1'; } catch (e) {}
  st.timer = W.setInterval(tick, 60000);
  status();
})();
