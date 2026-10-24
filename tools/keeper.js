/*!
 * セッション維持（keeper）— SIS自分用・テスト版のみ（先方の本番用には入れない）
 * メルカートBackOfficeを「枠（シェル）」に入れ、中の画面遷移をまたいで
 * 延長確認モーダルの「継続」ボタンを自動で押し続ける。OFFを押すかタブを閉じるまで有効。
 * ON中にもう一度メニューから選ぶ／右下の緑の表示を押す＝OFF。
 * 枠の中で開いたメニュー（sis.js）からの他ツールは、枠の中の画面に対して動く。
 */
(() => {
  const VERSION = '2.0.0';
  const BTN = '#login_expiration_extension_continue_button';
  const STOP = /\/(logout|default|login)\.aspx/i;
  const COOLDOWN_MS = 10000;

  if (window.top !== window) { try { window.top.__boKeeper && window.top.__boKeeper.off(); } catch (e) {} return; }
  if (window.__boKeeper) { window.__boKeeper.off(); return; }
  if (!/mercart-(bo|stg)\.net$/.test(location.hostname)) { alert('BackOfficeの画面で押してください'); return; }
  if (STOP.test(location.pathname)) { alert('ログイン後の画面で押してください'); return; }

  // 1) 今のページ自身のログアウトタイマーを止める（枠の外側が勝手にlogoutへ飛ばないように）
  const maxId = setTimeout(() => {}, 0);
  for (let i = 0; i <= maxId; i++) { clearTimeout(i); clearInterval(i); }

  // 2) ページを「全画面の枠＋同じURLのiframe」に置き換える
  const startUrl = location.href;
  const title = document.title;
  document.documentElement.innerHTML =
    '<head><meta charset="utf-8"><title></title></head><body style="margin:0;overflow:hidden"></body>';
  document.title = title;
  const frame = document.createElement('iframe');
  frame.src = startUrl;
  frame.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0';
  document.body.appendChild(frame);

  const pill = document.createElement('div');
  pill.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483647;background:#fff;' +
    'color:#0a7a3d;border:1px solid #0a7a3d;border-radius:999px;padding:5px 12px;' +
    'font:12px/1.4 -apple-system,"Hiragino Sans",sans-serif;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.08)';
  pill.title = 'クリックでOFF（元の画面に戻ります）';
  document.body.appendChild(pill);

  let clicks = 0, lastClick = 0, lastAt = '—', timer = null;
  const render = () => { pill.textContent = `延長ON（OFFにするまで）｜延長${clicks}回・最後 ${lastAt}`; };

  // 3) 枠の中（入れ子フレーム含む）から継続ボタンを探して押す
  const docs = (win, out = []) => {
    try { out.push(win.document); for (let i = 0; i < win.frames.length; i++) docs(win.frames[i], out); } catch (e) {}
    return out;
  };
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const tick = () => {
    let inner;
    try { inner = frame.contentWindow.location; } catch (e) { return; }
    if (STOP.test(inner.pathname)) { off('ログアウトを検知したので停止しました'); return; }
    if (Date.now() - lastClick < COOLDOWN_MS) return;
    for (const d of docs(frame.contentWindow)) {
      const el = d.querySelector(BTN);
      if (visible(el)) {
        el.click(); clicks++; lastClick = Date.now(); lastAt = new Date().toLocaleTimeString();
        console.log('[BO Session Keeper] 継続ボタンを押しました', lastAt); render(); break;
      }
    }
  };

  // 3b) タブが裏にあるとタイマーが間引かれるため、ポーリングだけに頼らず
  //     モーダル表示（DOMの変化）そのものを検知して即押す
  const watched = new WeakSet();
  const watch = () => {
    for (const d of docs(frame.contentWindow)) {
      if (!d || !d.documentElement || watched.has(d)) continue;
      watched.add(d);
      new MutationObserver(tick).observe(d.documentElement, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'open']
      });
    }
  };

  // 4) 中で画面遷移したら、アドレスバーとタブ名を中に合わせる（リロードしても同じ画面に戻れる）
  frame.addEventListener('load', () => {
    try {
      const w = frame.contentWindow;
      if (w.location.href !== location.href) history.replaceState(null, '', w.location.href);
      document.title = '⏱ ' + w.document.title;
      // target=_top のリンクで枠の外に出ないよう、枠の中に留める
      w.document.querySelectorAll('a[target="_top"],form[target="_top"]').forEach((a) => a.removeAttribute('target'));
    } catch (e) {}
    watch();
    tick();
  });

  const off = (msg) => {
    clearInterval(timer);
    window.__boKeeper = null;
    let url = startUrl;
    try { url = frame.contentWindow.location.href; } catch (e) {}
    if (msg) alert('BO Session Keeper: ' + msg);
    location.href = url; // 枠をやめて普通の画面に戻す
  };

  window.__boKeeper = { off: () => off(), version: VERSION, frame, stats: () => ({ clicks, lastAt }) };
  pill.addEventListener('click', () => off());
  timer = setInterval(() => { watch(); tick(); }, 2000);
  render();
  console.log('[BO Session Keeper] ON', VERSION);
})();
