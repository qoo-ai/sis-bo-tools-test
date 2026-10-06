(function(){
var W=window,D=document,ROOT=location.origin+'/'+location.pathname.split('/')[1]+'/';
var lk=[].slice.call(D.querySelectorAll('a[href*="reservation.aspx"]')).filter(function(a){return /mail/i.test(a.href);})[0];
var URL1=lk?lk.href.split('?')[0]:ROOT+'mailnews/reservation.aspx';
function el(t,css,txt){var e=D.createElement(t);if(css)e.style.cssText=css;if(txt)e.textContent=txt;return e;}
var old=D.getElementById('dsOne');if(old)old.remove();
var box=el('div','position:fixed;inset:0;z-index:2147483000;background:#fff;display:flex;flex-direction:column');box.id='dsOne';
var bar=el('div','display:flex;gap:12px;align-items:center;padding:8px 12px;font:14px/1.5 sans-serif;color:#fff;background:#344054');
var st=el('div','flex:1');var x=el('button','padding:4px 12px','閉じる');x.onclick=function(){box.remove();};
bar.appendChild(st);bar.appendChild(x);box.appendChild(bar);D.body.appendChild(box);
function say2(a,b,kind){st.textContent='';var x=D.createElement('div');x.style.cssText='font-size:16px;font-weight:bold';x.textContent=a;st.appendChild(x);if(b){var y=D.createElement('div');y.style.cssText='font-size:13px;opacity:.9';y.textContent=b;st.appendChild(y);}bar.style.background=kind=='ng'?'#b42318':kind=='ok'?'#1a7f37':'#344054';}
function say(t,kind){st.textContent=t;bar.style.background=kind=='ng'?'#b42318':kind=='ok'?'#1a7f37':'#344054';}
function parse(t){t=(t||'').trim();if(t.charAt(0)=='"'&&t.charAt(t.length-1)=='"'){t=t.slice(1,-1).replace(/""/g,'"');}
 var d=JSON.parse(t);if(!d||d.v!==1||!d.html||!d.subject||!d.name||!d.date||!d.time)throw new Error('シートの「BO入力データ」ではありません');return d;}
function ask(){var p=el('div','margin:40px auto;width:560px;max-width:92vw;font:14px sans-serif');
 p.appendChild(el('b',null,'メルマガ依頼シートの「BO入力データ」セルをコピーしてから、ここに貼り付け'));
 var ta=el('textarea','display:block;width:100%;height:160px;margin:10px 0;font:12px monospace');var go=el('button','padding:8px 18px','流し込む');
 p.appendChild(ta);p.appendChild(go);box.appendChild(p);ta.focus();
 go.onclick=function(){try{var d=parse(ta.value);p.remove();run(d);}catch(e){say2('⛔ 失敗：'+e.message,'この後の流れ：画面の赤字を直して手で続ける、または［閉じる］→ もう一度ブックマークを押す。送信・登録はされていません','ng');}};}
function run(d){
 say('予約配信の画面を開いています…');
 var f=el('iframe','flex:1;border:0;width:100%');box.appendChild(f);var stage=0,tries=0;
 f.onload=function(){var g;try{g=f.contentDocument;if(!g||!g.body)throw 0;}catch(e){say('BOの画面を読み込めません（ログイン切れの可能性）。ログインし直して、もう一度押してください。','ng');return;}
  var q=function(s){return g.querySelector(s);};
  try{
   if(q('#mail_body')){step2(g,q,d);return;}
   if(q('input[name=delivery_name]')){
    if(stage>0&&++tries>2)throw new Error('基本設定から先に進めません。画面の赤字エラーを確認してください');
    stage=1;step1(g,q,d);return;}
   if(q('input[type=password]'))throw new Error('ログイン画面です。BOにログインしてから押してください');
   if(stage==0){stage=-1;f.src=URL1;return;}
   throw new Error('予約配信の画面を開けませんでした（'+g.title+'）。BOのトップ画面で押し直してください');
  }catch(e){say2('⛔ 失敗：'+e.message,'この後の流れ：画面の赤字を直して手で続ける、または［閉じる］→ もう一度ブックマークを押す。送信・登録はされていません','ng');}};
 f.src=URL1;}
function btn(g,label){return [].slice.call(g.querySelectorAll('input[type=button],input[type=submit],button')).filter(function(b){return (b.value||b.textContent).trim()===label;})[0];}
function step1(g,q,d){
 var n=q('input[name=delivery_name]'),dt=q('input[name=delivery_estimate_date]'),tm=q('select[name=delivery_estimate_time]');
 if(!n||!dt||!tm)throw new Error('基本設定の入力欄が見つかりません');
 var dom=q('input[name=domain_target][value="0"]'),cr=q('input[name=customer_regist][value="0"]');if(dom)dom.checked=true;if(cr)cr.checked=true;
 n.value=d.name;dt.value=d.date;tm.value=d.time;
 if(tm.value!==d.time)throw new Error('配信時刻 '+d.time+' を選べません（9〜22時の正時のみ）');
 if(n.value!==d.name||dt.value!==d.date)throw new Error('予約名／配信日が正しく入りませんでした');
 say('基本設定を入れました。内容設定へ進みます…');
 var nx=btn(g,'次へ');if(!nx)throw new Error('［次へ］が見つかりません');nx.click();}
function pick(s,w){if(!s)return false;for(var i=0;i<s.options.length;i++){if(s.options[i].text.indexOf(w)>=0){s.value=s.options[i].value;return true;}}return false;}
function step2(g,q,d){
 var r=g.getElementById('is_html_mail_2');if(!r)throw new Error('「HTMLメール」の選択肢が見つかりません');r.click();
 q('#mail_subject').value=d.subject;q('#mail_body').value=d.html;q('#mail_body_alt').value=d.text;
 var ok1=pick(q('select[name=signature]'),'HTML用署名'),ok2=pick(q('select[name=signature_alt]'),'お問い合わせ用署名');
 var it=q('input[name=image_tag][value="0"]');if(it)it.checked=true;
 var mp=g.getElementById('mobile_is_pc_1');if(mp&&!mp.checked)mp.click();
 var tt=q('input[name=test_mail_to]');if(tt)tt.value=d.test;
 var bad=[];if(q('#mail_subject').value!==d.subject)bad.push('件名');if(q('#mail_body').value!==d.html)bad.push('HTML本文');
 if(q('#mail_body_alt').value!==d.text)bad.push('テキスト本文');if(!ok1||!ok2)bad.push('署名');if(tt&&tt.value!==d.test)bad.push('テスト配信先');
 if(bad.length)throw new Error(bad.join('・')+' が正しく入りませんでした');
 var tb=btn(g,'テスト配信');if(tb){tb.style.outline='4px solid #f79009';tb.scrollIntoView({block:'center'});}
 var n=d.test.split(/[,\s]+/).filter(Boolean).length,wd='日月火水木金土'.charAt(new Date(d.date).getDay());
 say2('✅ 入力完了（まだ送信・登録はされていません）','この後の流れ：①オレンジ枠の［テスト配信］→ ②届いたメールを確認 → ③［次へ］→［登録する］→ ④予約一覧で「配信待ち」を確認 ｜ 確認：'+d.date.slice(5).replace('/','月').replace(/^0/,'')+'日('+wd+') '+String(+d.time.slice(0,2))+':00 配信・テスト送信先 '+n+'件','ok');}
function start(){ if(navigator.clipboard&&navigator.clipboard.readText){navigator.clipboard.readText().then(function(t){try{run(parse(t));}catch(e){ask();}},function(){ask();});}else{ask();} }
start();
})();
