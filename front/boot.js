/* SIS front boot（drug store's 店舗画面の売上施策）
   user.js のローダー1行がこのファイルを読む。ここでは「どのコミットの施策を動かすか」だけを決める。
   ・GitHub に main の最新コミットを聞き、そのコミットの config.json と app.js を読む（コミット後すぐ反映）
   ・聞けないときは @main（jsDelivr のキャッシュで最大12時間遅れ）
   ・config.json の enabled:false で全停止（契約終了時はこれだけで元の画面に戻る） */
(function () {
  if (window.__sisBoot) return; window.__sisBoot = 1;
  var OWNER = 'qoo-ai', REPO = 'sis-bo-tools-test';
  var CDN = function (ref) { return 'https://cdn.jsdelivr.net/gh/' + OWNER + '/' + REPO + '@' + ref + '/front/'; };
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function load(ref) {
    fetch(CDN(ref) + 'config.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (cfg) {
      if (!cfg || cfg.enabled === false) return;
      window.SIS_CFG = cfg; window.SIS_REF = ref; window.SIS_CDN = CDN(ref);
      var s = document.createElement('script'); s.src = CDN(ref) + 'app.js'; s.charset = 'utf-8'; s.async = true;
      document.head.appendChild(s);
    }).catch(function () {});
  }
  var m = location.search.match(/[?&]sis_ref=([0-9a-f]{40})/);
  if (m) return load(m[1]);
  var cached = ss('sis_ref'), at = +ss('sis_ref_at') || 0;
  if (cached && Date.now() - at < 120000) return load(cached);
  var ac = window.AbortController ? new AbortController() : null;
  if (ac) setTimeout(function () { ac.abort(); }, 3000);
  fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/commits/main', { cache: 'no-store', signal: ac && ac.signal, headers: { Accept: 'application/vnd.github.sha' } })
    .then(function (r) { if (!r.ok) throw 0; return r.text(); })
    .then(function (sha) { sha = sha.trim(); if (!/^[0-9a-f]{40}$/.test(sha)) throw 0; ss('sis_ref', sha); ss('sis_ref_at', '' + Date.now()); load(sha); })
    .catch(function () { load('main'); });
})();
