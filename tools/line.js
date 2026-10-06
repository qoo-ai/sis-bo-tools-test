(function(){
var D=document,W=window,H={},STEP='';
function el(t,css,txt){var e=D.createElement(t);if(css)e.style.cssText=css;if(txt!=null)e.textContent=txt;return e;}
var old=D.getElementById('dsLiny');if(old)old.remove();
var box=el('div','position:fixed;inset:0;z-index:2147483000;background:#fff;display:flex;flex-direction:column');box.id='dsLiny';
var bar=el('div','display:flex;gap:12px;align-items:center;padding:8px 12px;font:14px/1.5 sans-serif;color:#fff;background:#344054');
var st=el('div','flex:1');var x=el('button','padding:4px 12px','閉じる');x.onclick=function(){box.remove();};
bar.appendChild(st);bar.appendChild(x);box.appendChild(bar);D.body.appendChild(box);
function say(a,b,kind){if(kind==null&&/^[①-⑥]/.test(a))STEP=a.replace(/…$/,'');st.textContent='';st.appendChild(el('div','font-size:16px;font-weight:bold',a));if(b)st.appendChild(el('div','font-size:13px;opacity:.9',b));
 bar.style.background=kind=='ng'?'#b42318':kind=='ok'?'#1a7f37':'#344054';}
function stop(e){say('⛔ 失敗[v1.6]'+(STEP?'（'+STEP+'）':'')+'：'+(e&&e.message||e),'この後の流れ：原因を直して［閉じる］→ もう一度ブックマークを押す（途中まで作った分は作り直しません）。配信はされていません','ng');}
function parse(t){t=(t||'').trim();if(t.charAt(0)=='"'&&t.charAt(t.length-1)=='"'){t=t.slice(1,-1).replace(/""/g,'"');}
 var d=JSON.parse(t);if(!d||d.v!==1||d.kind!=='liny'||!d.name||!d.date||!d.time||!d.text||!d.images||!d.images.length)throw new Error('シートの「Liny入力データ」ではありません');
 var q=String(d.date).match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);if(!q)throw new Error('配信日が読めません：'+d.date);d.date=q[1]+'/'+('0'+q[2]).slice(-2)+'/'+('0'+q[3]).slice(-2);
 var u=String(d.time).match(/(\d{1,2}):(\d{2})/);if(!u)throw new Error('配信時刻が読めません：'+d.time);d.time=('0'+u[1]).slice(-2)+':'+u[2];return d;}
function ask(){var p=el('div','margin:40px auto;width:560px;max-width:92vw;font:14px sans-serif');
 p.appendChild(el('b',null,'依頼シート「LINE出力」の「Liny入力データ」セルをコピーして、ここに貼り付け'));
 var ta=el('textarea','display:block;width:100%;height:160px;margin:10px 0;font:12px monospace');var go=el('button','padding:8px 18px','流し込む');
 p.appendChild(ta);p.appendChild(go);box.appendChild(p);ta.focus();
 go.onclick=function(){try{var d=parse(ta.value);p.remove();run(d);}catch(e){stop(e);}};}
function html(u){return fetch(u,{credentials:'same-origin'}).then(function(r){return r.text();}).then(function(t){return new DOMParser().parseFromString(t,'text/html');});}
function post(u,obj){var fd=new FormData();for(var k in obj)fd.append(k,obj[k]);return fetch(u,{method:'POST',body:fd,credentials:'same-origin'});}
function api(method,url,body){var h={'Accept':'application/json','X-Requested-With':'XMLHttpRequest'};for(var k in H)if(H[k])h[k]=H[k];if(body)h['Content-Type']='application/json';
 return fetch(url,{method:method,credentials:'same-origin',headers:h,body:body?JSON.stringify(body):undefined}).then(function(r){return r.text().then(function(t){var j=null;try{j=JSON.parse(t);}catch(e){}
  if(!r.ok)throw new Error('Linyがエラーを返しました（'+r.status+' '+t.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,120)+'）');return {data:j,status:r.status};});});}
var AX={get:function(u){return api('GET',u);},post:function(u,b){return api('POST',u,b||{});}};
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
async function media(names){var want={},got={};names.forEach(function(n){want[n.replace(/\.(jpe?g|png|gif)$/i,'')]=n;});
 var left=Object.keys(want).length,p=1,max=1;
 do{var r=await AX.get('/api/editor/media/list/photo/all/'+p);max=r.data.pageMax||1;
  (r.data.items||[]).forEach(function(it){var k=String(it.name).replace(/\.(jpe?g|png|gif)$/i,'');if(want[k]&&!got[want[k]]){got[want[k]]={id:it.id,url:it.full};left--;}});p++;}
 while(left>0&&p<=max);
 var miss=names.filter(function(n){return !got[n];});if(miss.length)throw new Error('Linyの登録メディアに無い画像：'+miss.join(', ')+'（先にLinyへアップしてください）');return got;}
function block(i,img,url){return {id:'bl'+Date.now()+i,type:'image',label:'',title:'',imgRatio:'__FIT__',subtitle:'',useLabel:false,useTitle:false,useAction:true,blockColor:'',actionLabel:'',aspectRatio:'3:4',blockMargin:'NN',useSubtitle:false,labelBgColor:'#770000',useActionLabel:false,actionLabelBgColor:'#00000055',
 imgItem:{id:img.id,url:img.url},
 action:{type:'liny-action',label:'Linyアクション',description:'[URLを開く] '+url+'をLINEブラウザで開きます',data:{id:null,type:1,url_action:{url:url,liff_size:'legacy'}}}};}
async function run(d){
 try{
  if(location.host!=='manager.liny.jp')throw new Error('Liny（manager.liny.jp）の画面で押してください');
  var K='dsLiny16:'+d.name,memo={};try{memo=JSON.parse(sessionStorage.getItem(K)||'{}');}catch(e){}
  var form=await html('/line/eggpack/edit/new');var ti0=form.querySelector('input[name=_token]');if(!ti0)throw new Error('Linyにログインしていないようです');var tok=ti0.value,uid=form.querySelector('input[name=_lm_user_id]').value;
  function mt(n){var e=form.querySelector('meta[name="'+n+'"]')||D.querySelector('meta[name="'+n+'"]');return e?e.content:'';}
  var xs=/(?:^|; )XSRF-TOKEN=([^;]+)/.exec(D.cookie);
  H={'X-CSRF-TOKEN':mt('csrf-token')||tok,'lm-user-id':mt('lm-user-id')||uid,'lm-account-id':mt('lm-account-id'),'X-XSRF-TOKEN':xs?decodeURIComponent(xs[1]):''};
  var opts=[].slice.call(form.querySelectorAll('select[name=egg_group_id] option')).map(function(o){return {v:o.value,t:o.textContent.trim()};});
  var m=+d.date.split('/')[1],y=d.date.slice(0,4);
  var want=[d.folder,y+'年度イベント-'+m+'月',y+'年度イベントー'+m+'月','イベント'].filter(Boolean);
  var grp=null;want.some(function(w){var o=opts.filter(function(o){return o.t===w;})[0];if(o){grp=o;return true;}});if(!grp)grp={v:'0',t:'未分類'};
  if(!memo.flex){
   say('① 画像を探しています…',d.images.map(function(i){return i.name;}).join(' , '));
   var got=await media(d.images.map(function(i){return i.name;}));
   say('② フレックスを作っています…');
   var ej={size:'R',themeColors:['#139078','#227DB8','#EF7B3C','#E0483C','#FFFFFF'],panels:d.images.map(function(im,i){return {id:i?'pn'+Date.now()+i:'pn11',type:'panel',bgColor:'#ffffff',bgImage:null,blocks:[block(i,got[im.name],im.url)]};})};
   var r=await AX.post('/api/template/lflexes',{name:d.name,group:+grp.v,editor_json:JSON.stringify(ej),alt_text:String(d.alt||d.title||d.name).slice(0,400),sender_id:0,do_override_sender:0,answer_type:3,twice_do_reply:1,twice_action_id:0});
   var fid=r.data&&(r.data.id||(r.data.data&&r.data.data.id)||(r.data.template&&r.data.template.id));
   if(!fid){throw new Error('フレックスのIDが取れませんでした（応答：'+JSON.stringify(r.data).slice(0,120)+'）');}
   memo.flex=fid;sessionStorage.setItem(K,JSON.stringify(memo));}
  if(!memo.pack){
   say('③ パックを作っています…','フォルダ：'+grp.t);
   var pr=await post('/line/eggpack/edit',{_token:tok,_lm_user_id:uid,id:'',name:d.name,egg_group_id:grp.v});
   var mm=/eggpack\/show\/(\d+)/.exec(pr.url);if(!mm)throw new Error('パックが作れませんでした（'+pr.status+'）');
   memo.pack=mm[1];sessionStorage.setItem(K,JSON.stringify(memo));}
  if(!memo.text){
   say('④ パックにテキストを入れています…');
   var c=await AX.post('/api/templates/contentless',{});var eid=c.data&&(c.data.id||(c.data.data&&c.data.data.id));if(!eid)throw new Error('テキスト用の枠が作れませんでした');
   await AX.post('/api/eggpacks/'+memo.pack+'/holes',{is_template:0,egg_id:eid,template_name:'',template_group:-1,disable_cv:0,sender_id:0,do_override_sender:0,eggtype:8,text_text:d.text});
   memo.text=1;sessionStorage.setItem(K,JSON.stringify(memo));}
  if(!memo.added){
   say('⑤ パックにフレックスを入れています…');
   await post('/line/eggpack/step/template',{_token:tok,_lm_user_id:uid,pack_id:memo.pack,template_id:memo.flex,use_copy:0});
   memo.added=1;sessionStorage.setItem(K,JSON.stringify(memo));}
  var sh=await html('/line/eggpack/show/'+memo.pack);var holes=sh.querySelectorAll('input[name=hole_id]').length;
  if(holes!==2)throw new Error('パックの中身が '+holes+' 件です（テキスト＋フレックスの2件のはず）。/line/eggpack/show/'+memo.pack+' を確認してください');
  memo.d=d;sessionStorage.setItem(K,JSON.stringify(memo));sessionStorage.setItem('dsLiny:last',K);
  openMag(d,memo);
 }catch(e){stop(e);}}
function openMag(d,memo){
 say('⑥ パックまで完成。下の青いボタンで配信設定を開きます','Linyの配信設定画面は枠の中に表示できないため、別タブで開いて自動入力します（まだ配信・登録はされていません）');
 var old=D.getElementById('dsLinyGo');if(old)old.remove();
 var go=el('button','margin:60px auto 0;display:block;padding:18px 36px;font:bold 18px sans-serif;color:#fff;background:#1570ef;border:0;border-radius:8px;cursor:pointer','▶ 配信設定を別タブで開いて入力する');go.id='dsLinyGo';box.appendChild(go);
 go.onclick=function(){
  var w=W.open('/line/magazine/new?group=0&egg_id='+memo.pack,'dsLinyMag');
  if(!w){say('⛔ 別タブが開けませんでした（ポップアップがブロックされています）','アドレスバー右端のアイコンから manager.liny.jp のポップアップを［常に許可］→ もう一度青いボタン','ng');return;}
  say('⑥ 別タブで配信設定を入力しています…','入力が終わると、別タブの上に結果の帯が出ます');
  waitMag(w).then(function(){var bs=bandIn(w.document);return fill(w.document,w,d,bs).then(function(ok){
    say(ok?'✅ 別タブに入力しました（まだ配信・登録はされていません）':'⚠ 別タブに入力しました。赤帯の項目だけ手で直してください',ok?'別タブで内容を確認 → オレンジ枠の［配信登録］→ テスト送信で確認。このタブは［閉じる］でOK':'直したら オレンジ枠の［配信登録］→ テスト送信で確認',ok?'ok':'ng');
    if(ok){go.remove();}w.focus();});}).catch(stop);};}
function waitMag(w){return new Promise(function(res,rej){var n=0,t=setInterval(function(){n++;var ok=false;
 try{ok=w.document&&w.location.pathname.indexOf('/line/magazine/new')>=0&&w.document.readyState==='complete'&&[].slice.call(w.document.querySelectorAll('label')).some(function(l){return l.innerText.trim()==='配信日時を指定する';});}catch(e){}
 if(ok){clearInterval(t);setTimeout(res,400);}else if(n>80||w.closed){clearInterval(t);rej(new Error('別タブの配信設定画面が開きませんでした（'+(w.closed?'タブが閉じられました':'20秒待っても表示されません')+'）'));}},250);});}
function bandIn(g){var o=g.getElementById('dsLinyBand');if(o)o.remove();
 var b=g.createElement('div');b.id='dsLinyBand';b.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483000;display:flex;gap:12px;align-items:center;padding:8px 12px;font:14px/1.5 sans-serif;color:#fff;background:#344054';
 var t=g.createElement('div');t.style.cssText='flex:1';var c=g.createElement('button');c.textContent='帯を閉じる';c.style.cssText='padding:4px 12px';c.onclick=function(){b.remove();};
 b.appendChild(t);b.appendChild(c);g.body.appendChild(b);
 return function(a,s,kind){t.textContent='';var h=g.createElement('div');h.style.cssText='font-size:16px;font-weight:bold';h.textContent=a;t.appendChild(h);if(s){var p=g.createElement('div');p.style.cssText='font-size:13px;opacity:.9';p.textContent=s;t.appendChild(p);}
  b.style.background=kind=='ng'?'#b42318':kind=='ok'?'#1a7f37':'#344054';};}
async function fill(g,FW,d,say2){
 function lab(t){return [].slice.call(g.querySelectorAll('label')).filter(function(l){return l.innerText.trim()===t;})[0];}
 function need(t){var l=lab(t);if(!l)throw new Error('画面に「'+t+'」が見つかりません（Linyの画面が変わった可能性）');return l;}
 function radio(t){var l=lab(t);if(!l)return null;return l.htmlFor?g.getElementById(l.htmlFor):l.querySelector('input');}
 for(var i=0;i<40&&!lab('配信日時を指定する');i++)await sleep(250);
 if(!lab('配信日時を指定する'))throw new Error('配信設定の画面が出ません');
 function setv(e,v){var p=Object.getOwnPropertyDescriptor(FW.HTMLInputElement.prototype,'value').set;p.call(e,v);e.dispatchEvent(new FW.Event('input',{bubbles:true}));e.dispatchEvent(new FW.Event('change',{bubbles:true}));}
 var ti=null,tl=lab('タイトル');for(var p=tl,k=0;p&&k<6&&!ti;k++){p=p.parentElement;ti=p&&p.querySelector('input[type=text]:not(.dp__input)');}
 if(!ti)ti=[].slice.call(g.querySelectorAll('input[type=text]')).filter(function(e){return e.offsetParent&&!e.classList.contains('dp__input');})[0];
 if(ti)setv(ti,d.title||d.name);
 need('友だち全員に配信する').click();need('配信日時を指定する').click();await sleep(600);
 var dp=g.querySelector('input.dp__input'),tm=g.querySelector('input[type=time]');
 if(dp){dp.focus();setv(dp,d.date);dp.dispatchEvent(new FW.KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));dp.blur();}
 if(tm){setv(tm,d.time);tm.dispatchEvent(new FW.Event('blur'));}
 await sleep(600);
 var bad=[],now=radio('登録後すぐに配信する'),sch=radio('配信日時を指定する'),all=radio('友だち全員に配信する');
 if(!sch||!sch.checked||(now&&now.checked))bad.push('配信日時が「指定する」になっていません（このまま登録すると即配信されます）');
 if(!all||!all.checked)bad.push('配信先が「友だち全員」になっていません');
 dp=g.querySelector('input.dp__input');tm=g.querySelector('input[type=time]');
 function dg(v){return String(v||'').replace(/\D/g,'');}
 if(!dp||dg(dp.value)!==dg(d.date))bad.push('日付が '+(dp?dp.value:'空')+' です → '+d.date+' に手で直してください');
 if(!tm||String(tm.value).slice(0,5)!==d.time)bad.push('時刻が '+(tm?tm.value:'空')+' です → '+d.time+' に手で直してください');
 if(ti&&ti.value!==(d.title||d.name))bad.push('管理用タイトルが入っていません');
 var rb=[].slice.call(g.querySelectorAll('button')).filter(function(b){return b.innerText.trim()==='配信登録';})[0];
 if(rb){rb.style.outline='4px solid #f79009';rb.scrollIntoView({block:'center'});}
 var wd='日月火水木金土'.charAt(new Date(d.date).getDay()),when=d.date.slice(5).replace('/','月').replace(/^0/,'')+'日('+wd+') '+d.time;
 if(bad.length){say2('⚠ ほぼ完了（まだ配信・登録はされていません）　手で直す所：'+bad.join(' ／ '),'この後の流れ：①上の項目を直す → ②オレンジ枠の［配信登録］→ ③一斉配信一覧で「配信予約中」を確認 → ④テスト送信で確認','ng');return false;}
 say2('✅ 入力完了（まだ配信・登録はされていません）','この後の流れ：①オレンジ枠の［配信登録］→ ②一斉配信一覧で「配信予約中」を確認 → ③テスト送信で確認 ｜ 確認：'+when+' 配信','ok');
 try{sessionStorage.removeItem('dsLiny16:'+d.name);sessionStorage.removeItem('dsLiny:last');}catch(e){}
 return true;}
function selfFill(){var K=null,m=null;try{K=sessionStorage.getItem('dsLiny:last');m=K&&JSON.parse(sessionStorage.getItem(K)||'null');}catch(e){}
 var eg=/[?&]egg_id=(\d+)/.exec(location.search);
 if(!m||!m.d||!eg||String(m.pack)!==eg[1])return false;
 box.remove();var bs=bandIn(D);bs('⑥ この画面に入力しています…');fill(D,W,m.d,bs).catch(function(e){bs('⛔ 失敗[v1.6]（⑥）：'+(e&&e.message||e),'配信はされていません。手で入力してください','ng');});return true;}
if(/\/line\/magazine\/new/.test(location.pathname)&&selfFill()){}
else if(navigator.clipboard&&navigator.clipboard.readText){navigator.clipboard.readText().then(function(t){try{run(parse(t));}catch(e){ask();}},function(){ask();});}else{ask();}
})();
