
(function () {
  if (window.__sisYoyaku) { window.__sisYoyaku.show(); return; }
  var box = null, KEEP_MS = 4 * 60 * 1000, st = { timer: null, keep: null, lock: null, at: null, target: '', file: '' };

  function labelOf(el) {
    var l = el.id && document.querySelector('label[for="' + el.id + '"]');
    return ((l && l.textContent) || (el.parentNode && el.parentNode.textContent) || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  }
  function checkedLabel() { // 画面の選択状態をまとめて1本の文字にする（インポート先・見出し有無・プルダウン・チェック）
    var out = [];
    [].forEach.call(document.querySelectorAll('input[type=radio]:checked'), function (r) { if (!box || !box.contains(r)) out.push(labelOf(r)); });
    [].forEach.call(document.querySelectorAll('select'), function (x) { if (x.selectedIndex >= 0) out.push((x.name || '') + '=' + x.options[x.selectedIndex].text.trim()); });
    [].forEach.call(document.querySelectorAll('input[type=checkbox]'), function (c) { if (!box || !box.contains(c)) out.push(labelOf(c) + (c.checked ? '☑' : '☐')); });
    return out.join(' / ');
  }
  function fileName() {
    var f = document.querySelector('input[type=file]');
    return f && f.files && f.files[0] ? f.files[0].name : '';
  }
  function submitBtn() { // ボタン（input/button）を優先。リンク型は画面内の実行リンク（javascript:）だけ
    function ok(b) {
      if (typeof box !== 'undefined' && box && box.contains(b)) return false;
      return /^(取込|取り込み|インポート|実行)/.test((b.value || b.textContent || '').trim());
    }
    var c = [].filter.call(document.querySelectorAll('input[type=submit],input[type=button],button'), ok);
    if (!c.length) c = [].filter.call(document.querySelectorAll('a[href^="javascript:"]'), ok);
    return c[0];
  }
  function log(m) {
    var t = new Date().toLocaleTimeString('ja-JP');
    box.querySelector('.sy-log').textContent = t + ' ' + m + '\n' + box.querySelector('.sy-log').textContent;
    try { localStorage.setItem('sisYoyakuLog', t + ' ' + m + '\n' + (localStorage.getItem('sisYoyakuLog') || '')); } catch (e) {}
  }
  function keepAlive() {
    fetch(location.href, { credentials: 'include', cache: 'no-store' }).then(function (r) {
      return r.text();
    }).then(function (h) {
      if (/ログイン/.test(h.slice(0, 3000)) && /password/i.test(h)) { log('⚠ ログインが切れた。取込は押せない'); cancel(); alert('予約取込: BOのログインが切れました。ログインし直して予約し直してください。'); }
      else log('ログイン維持OK');
    }).catch(function (e) { log('⚠ 維持アクセス失敗 ' + e); });
  }
  function fire() {
    var tg = checkedLabel(), fn = fileName(), b = submitBtn();
    if (tg !== st.target || fn !== st.file || !b) {
      log('⚠ 押さずに停止: 取込先[' + tg + '] ファイル[' + fn + '] ボタン[' + (b ? 'あり' : 'なし') + ']');
      cancel(); return;
    }
    log('取込を押す: ' + st.target + ' / ' + st.file);
    try { localStorage.setItem('sisYoyakuLast', JSON.stringify({ at: new Date().toISOString(), target: st.target, file: st.file })); } catch (e) {}
    window.confirm = function () { return true; }; // 取込画面の確認ダイアログで止まらないように（このタブの中だけ）
    b.click();
  }
  function reserve() {
    var v = box.querySelector('.sy-at').value; // yyyy-mm-ddThh:mm
    var at = new Date(v);
    if (!v || isNaN(at)) { alert('時刻を入れてください'); return; }
    st.target = checkedLabel(); st.file = fileName();
    if (!st.target || !st.file) { alert('先に「インポート先」と「ファイル」を選んでください'); return; }
    if (!submitBtn()) { alert('取込ボタンが見つかりません。商品インポート画面で使ってください'); return; }
    var ms = at - Date.now();
    if (ms < 0) { alert('過去の時刻です'); return; }
    cancel(true);
    st.at = at;
    st.timer = setTimeout(fire, ms);
    st.keep = setInterval(keepAlive, KEEP_MS);
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { st.lock = l; log('画面消灯を止めた'); }).catch(function () { log('⚠ 消灯止め不可（タブを前に出す）'); });
    document.addEventListener('visibilitychange', relock);
    box.querySelector('.sy-state').textContent = '予約中: ' + at.toLocaleString('ja-JP') + ' に「' + st.target + '」へ ' + st.file;
    box.style.background = '#fff4d6';
    document.title = '⏰予約 ' + at.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) + ' ' + document.title.replace(/^⏰予約 \S+ /, '');
    log('予約した（あと ' + Math.round(ms / 60000) + ' 分）');
  }
  function relock() { if (st.at && document.visibilityState === 'visible' && navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { st.lock = l; }).catch(function () {}); }
  function cancel(quiet) {
    clearTimeout(st.timer); clearInterval(st.keep); st.timer = st.keep = null; st.at = null;
    if (st.lock) { st.lock.release(); st.lock = null; }
    box.querySelector('.sy-state').textContent = '予約なし'; box.style.background = '#fff';
    document.title = document.title.replace(/^⏰予約 \S+ /, '');
    if (!quiet) log('予約を取り消した');
  }
  box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;width:340px;padding:10px;border:2px solid #d9822b;border-radius:8px;background:#fff;font:13px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.2)';
  box.innerHTML = '<b>SIS 予約取込</b> <a href="#" class="sy-x" style="float:right">×</a>' +
    '<div style="margin:6px 0">1) 上の画面でインポート先とファイルを選ぶ<br>2) 時刻を入れて「予約」</div>' +
    '<input type="datetime-local" class="sy-at" style="width:200px"> <button class="sy-ok">予約</button> <button class="sy-cn">取消</button>' +
    '<div class="sy-state" style="margin:6px 0;font-weight:bold">予約なし</div>' +
    '<pre class="sy-log" style="max-height:120px;overflow:auto;background:#f6f6f6;margin:0;padding:4px;white-space:pre-wrap"></pre>';
  document.body.appendChild(box);
  box.querySelector('.sy-ok').onclick = reserve;
  box.querySelector('.sy-cn').onclick = function () { cancel(); };
  box.querySelector('.sy-x').onclick = function (e) { e.preventDefault(); box.style.display = 'none'; };
  window.__sisYoyaku = { show: function () { box.style.display = 'block'; }, reserve: reserve, cancel: cancel, fire: fire, st: st };
  try { var last = localStorage.getItem('sisYoyakuLog'); if (last) box.querySelector('.sy-log').textContent = last.split('\n').slice(0, 8).join('\n'); } catch (e) {}
})();
