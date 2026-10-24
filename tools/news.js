/* NEWS反映（#SP-1W）v1.0 2026-10-24
   バナー依頼シート「NEWS」タブの行をコピー → ブックマーク →「NEWS反映」
   ・1行＝NEWS 1本。種類「イベント3本」は 予告・開催中・【終了】の3本に展開する
   ・見出しが同じトピックがBOにあれば上書き、なければ新規登録（stg→本番で同じコピーを使い回せる・何度押しても重複しない）
   ・「消す」行は掲載終了日時を今にする（削除はしない＝戻せる）
   ・日付の後ろの曜日 (水)（木）(曜)() は日付から自動で正しく入れ直し、直した箇所を表示する
   ・登録の前に一覧で確認 →［登録する］で1本ずつ入れ、読み戻して照合する */
(function(){
"use strict";
var W=window,D=document,VER='NEWS v1.2 (2026-10-24)';
var ROOT='/'+location.pathname.split('/')[1]+'/';
var host=location.hostname,ENV=/mercart-stg/.test(host)?'stg':/mercart-bo/.test(host)?'本番':null;
var SHOP=ENV==='stg'?'https://shop.seesplanning.mercart-stg.net':'https://drugstores-shop.com';
function el(t,css,txt){var e=D.createElement(t);if(css)e.style.cssText=css;if(txt!=null)e.textContent=txt;return e;}
var old=D.getElementById('sisNews');if(old)old.remove();
var box=el('div','position:fixed;top:12px;right:12px;width:680px;max-width:calc(100vw - 24px);max-height:92vh;overflow:auto;z-index:2147483647;background:#fff;border:2px solid #1a73e8;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.25);font:13px/1.6 sans-serif;color:#222;padding:14px 16px');box.id='sisNews';
var hd=el('div','display:flex;justify-content:space-between;align-items:center');hd.appendChild(el('b','font-size:15px','NEWS反映'));hd.appendChild(el('span','color:#888;font-size:11px',VER));box.appendChild(hd);
var env=el('div','margin:6px 0;padding:4px 8px;border-radius:6px;font-weight:bold','反映先：'+(ENV||'不明')+'　'+host);env.style.background=ENV==='本番'?'#fde2e1':'#e6f4ea';box.appendChild(env);
var log=el('div');box.appendChild(log);var body=el('div');box.appendChild(body);
var foot=el('div','text-align:right;margin-top:8px');var cl=el('button','font-size:12px','閉じる');cl.onclick=function(){box.remove();};foot.appendChild(cl);box.appendChild(foot);
D.body.appendChild(box);
function say(t,k){var d=el('div',k===2?'color:#c5221f':k===1?'color:#b06000':'',(k===2?'× ':k===1?'△ ':k===0?'✓ ':'・')+t);log.appendChild(d);d.scrollIntoView({block:'nearest'});}
if(!ENV){say('メルカートのBO（stg または 本番）を開いてから押してください',2);return;}

/* ---------- 日付 ---------- */
var WD='日月火水木金土';
function pad(n){return ('0'+n).slice(-2);}
function pdt(s){s=String(s||'').trim().replace(/[年月]/g,'/').replace(/日/,'').replace(/-/g,'/');if(!s)return null;
 var m=s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);if(!m)return undefined;
 return new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0),+(m[6]||0));}
function fmt(d){return d.getFullYear()+'/'+pad(d.getMonth()+1)+'/'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());}
function md(d){return (d.getMonth()+1)+'/'+d.getDate()+'('+WD[d.getDay()]+')';}
function hm(d){return d.getHours()+':'+pad(d.getMinutes());}
function untilTxt(d){ /* 0:00終了は前日24:00と書く */
 if(d.getHours()===0&&d.getMinutes()===0){var p=new Date(d.getTime()-86400000);return md(p)+'24:00';}return md(d)+hm(d);}
/* 本文・見出しの「10/25(日)」「10月25日（日）」の曜日を日付から入れ直す。base＝掲載日（年の決め手） */
function fixWd(s,base,fixes){
 var y0=base.getFullYear(),m0=base.getMonth()+1;
 function wd(mo,da){var y=y0;if(mo<m0-6)y++;else if(mo>m0+6)y--;var d=new Date(y,mo-1,da);if(d.getMonth()!==mo-1)return null;return WD[d.getDay()];}
 return String(s).replace(/(\d{1,2})(\/|月)(\d{1,2})(日?)(\s*)([（(])\s*([日月火水木金土]|曜)?\s*(曜日?)?\s*([）)])/g,function(all,mo,sep,da,ni,sp,o,w,yo,c){
  var r=wd(+mo,+da);if(!r){fixes.push('「'+all+'」は存在しない日付です');return all;}
  if(w!==r){fixes.push(mo+sep+da+ni+' の曜日：'+(w&&w!=='曜'?'「'+w+'」→':'')+'「'+r+'」');}
  return mo+sep+da+ni+sp+o+r+c;});}

/* ---------- シートの行（タブ区切り） ---------- */
function tsv(t){var rows=[],row=[],c='',q=false;t=String(t||'').replace(/\r\n?/g,'\n');
 for(var i=0;i<t.length;i++){var a=t[i];if(q){if(a==='"'){if(t[i+1]==='"'){c+='"';i++;}else q=false;}else c+=a;}
  else if(a==='"'&&c===''){q=true;}else if(a==='\t'){row.push(c);c='';}else if(a==='\n'){row.push(c);rows.push(row);row=[];c='';}else c+=a;}
 if(c||row.length){row.push(c);rows.push(row);}return rows;}
function key(h){return String(h||'').replace(/【[^】]*】/g,'').replace(/[（(][\s\S]*$/,'').replace(/\s/g,'');}
var COLS={kind:'種類',pub:'掲載日時',st:'イベント開始日時',en:'イベント終了日時',title:'見出し',text:'本文',img:'画像',link:'リンク',end:'掲載終了',del:'消す',skip:'反映しない'};
function parseSheet(t){
 var r=tsv(t),hi=-1;for(var i=0;i<r.length;i++){if(r[i].some(function(c){return key(c)==='見出し';})){hi=i;break;}}
 var hdr=hi>=0?r[hi].map(key):null;
 /* 見出し行を含めずにコピーした時は、列の並びで読む */
 var order=['kind','pub','st','en','title','text','img','link','end','del','skip'];
 var idx={};order.forEach(function(k,j){var n=hdr?hdr.indexOf(key(COLS[k])):j;idx[k]=n;});
 if(hdr&&(idx.title<0||idx.pub<0))throw new Error('NEWSタブの見出し行が読めません（「見出し」「掲載日時」の列が必要です）');
 var data=r.slice(hi+1),out=[];
 data.forEach(function(row,j){function g(k){return idx[k]>=0?String(row[idx[k]]||'').trim():'';}
  if(!g('title')&&!g('pub'))return;
  out.push({n:(hi>=0?hi+2:1)+j,kind:g('kind')||'お知らせ',pub:g('pub'),st:g('st'),en:g('en'),title:g('title'),text:String(row[idx.text]||'').replace(/\r/g,''),img:g('img'),link:g('link'),end:g('end'),del:/^(TRUE|✓|☑|はい|1)$/i.test(g('del')),skip:/^(TRUE|✓|☑|はい|1)$/i.test(g('skip'))});});
 return out;}

/* ---------- 1行 → トピック（1本 or 3本） ---------- */
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function imgUrl(v){v=String(v||'').trim();if(!v)return '';if(/^https?:\/\//.test(v))return v.replace(/^https?:\/\/[^/]+/,'');if(v.charAt(0)==='/')return v;return '/img/usr/demo/'+v;}
function linkUrl(v){v=String(v||'').trim();if(!v)return '';if(/^https?:\/\//.test(v))return v.replace(/^https?:\/\/(www\.)?drugstores-shop\.com/,'');if(v.charAt(0)!=='/')v='/shop/'+v.replace(/^shop\//,'');return v;}
function html(title,text,img,link){
 var t=String(text||'');var bodyHtml=/^\s*</.test(t)?t:'<p>\n'+esc(t).replace(/\n/g,'<br />\n')+'\n</p>';
 var im=img?'<img src="'+esc(img)+'" alt="'+esc(title.replace(/【[^】]*】/g,''))+'" />':'';
 if(im&&link)im='<a href="'+esc(link)+'">'+im+'</a>';
 return '<style>\nimg {\n  width: 100%;\n  max-width: 400px;\n  height: auto;\n}\n</style>\n<div class="page_contents">\n'+(im?im+'\n':'')+bodyHtml+'\n</div>';}
function build(rows){var out=[],errs=[];
 rows.forEach(function(r){
  if(r.skip)return;
  var where=r.n+'行目：';var pub=pdt(r.pub),end=pdt(r.end);
  if(!r.title){errs.push(where+'見出しが空です');return;}
  if(!pub){errs.push(where+'掲載日時が読めません（'+(r.pub||'空')+'）。2026/10/23 12:00 の形で');return;}
  if(end===undefined){errs.push(where+'掲載終了が読めません（'+r.end+'）');return;}
  if(end&&end<=pub){errs.push(where+'掲載終了が掲載日時より前です');return;}
  var img=imgUrl(r.img),link=linkUrl(r.link);
  if(/イベント/.test(r.kind)&&/3|３/.test(r.kind)){
   var st=pdt(r.st),en=pdt(r.en);
   if(!st||!en){errs.push(where+'イベント3本は「イベント開始日時」「イベント終了日時」が要ります');return;}
   if(!(pub<st&&st<en)){errs.push(where+'掲載日時（予告）＜イベント開始＜イベント終了 の順にしてください');return;}
   var nm=r.title.replace(/^【[^】]*】\s*/,'');
   var e3=end||new Date(en.getTime()+3*86400000);
   out.push({row:r.n,part:'予告',title:'【イベント】'+nm+' '+md(st)+hm(st)+'よりスタート！',text:r.text,s:pub,f:st,img:img,link:link});
   out.push({row:r.n,part:'開催中',title:'【イベント】'+nm+' 開催中！'+untilTxt(en)+'まで',text:r.text,s:st,f:en,img:img,link:link});
   out.push({row:r.n,part:'終了',title:'【終了】'+nm+'は終了しました',text:nm+'は、'+untilTxt(en)+'をもちまして終了いたしました。\nたくさんのご利用、誠にありがとうございました。',s:en,f:e3,img:'',link:''});
  }else{
   out.push({row:r.n,part:r.del?'消す':'',title:r.title,text:r.text,s:pub,f:end,img:img,link:link,del:r.del});}
 });
 out.forEach(function(t){var fx=[];t.title=fixWd(t.title,t.s,fx);t.text=fixWd(t.text,t.s,fx);t.fixes=fx;t.html=html(t.title,t.text,t.img,t.link);});
 return {list:out,errs:errs};}

/* ---------- BO：既存トピックを見出しで探す ---------- */
function fetchDoc(u){return fetch(u,{credentials:'include'}).then(function(r){return r.text();}).then(function(t){return new DOMParser().parseFromString(t,'text/html');});}
function existing(){ /* 一覧の先頭3ページ（更新日の新しい順・90件）を見出しで引けるようにする */
 var ids=[],map={};
 function page(p){return fetchDoc(ROOT+'topic/list.aspx?absolutepage='+p+'&pagesize=30').then(function(d){
   if(d.querySelector('input[type=password]'))throw new Error('ログインが切れています。BOにログインし直してから押してください');
   [].slice.call(d.querySelectorAll('a[onclick*="topic"]')).forEach(function(a){var m=(a.getAttribute('onclick')||'').match(/topic=(\d+)/);if(m&&ids.indexOf(m[1])<0)ids.push(m[1]);});});}
 return page(1).then(function(){return page(2);}).then(function(){return page(3);}).then(function(){
  return Promise.all(ids.map(function(id){return fetchDoc(ROOT+'topic/detail.aspx?topic='+id).then(function(d){var c=d.querySelector('[name=comment]');if(c&&c.value)(map[c.value.trim()]=map[c.value.trim()]||[]).push(id);});}));
 }).then(function(){return map;});}

/* ---------- BO：1本入れる（画面をiframeで開いて入力→［登録］/［更新］） ---------- */
function put(t,id){return new Promise(function(ok,ng){
 var f=el('iframe','position:fixed;left:-3000px;top:0;width:1100px;height:800px;border:0');D.body.appendChild(f);var st=0;
 var timer=setTimeout(function(){f.remove();ng(new Error('BOの応答がありません（60秒）'));},60000);
 f.onload=function(){var g,w;try{g=f.contentDocument;w=f.contentWindow;}catch(e){clearTimeout(timer);f.remove();ng(new Error('BOの画面を読めません'));return;}
  if(g.querySelector('input[type=password]')){clearTimeout(timer);f.remove();ng(new Error('ログインが切れています'));return;}
  if(st===0){st=1;
   var q=function(n){return g.querySelector('[name='+n+']');};
   if(!q('comment')){clearTimeout(timer);f.remove();ng(new Error('トピックの編集画面が開けません'));return;}
   if(!id){q('category').value='0';if(q('category_name'))q('category_name').value='トップページ';}
   q('comment').value=t.title;q('s_dt').value=fmt(t.s);q('f_dt').value=t.f?fmt(t.f):'';
   if(!t.del){q('contents').value=t.html;q('contents2').value=t.html;var sp=q('smartphone_is_pc');if(sp&&!sp.checked)sp.click();}
   var s=q('status');if(s)s.value='0';
   w.confirm=function(){return true;};w.alert=function(m){t.alertMsg=m;};
   var b=g.querySelector(id?'[name=cmdUpdate]':'[name=cmdInsert]');if(!b){clearTimeout(timer);f.remove();ng(new Error('［'+(id?'更新':'登録')+'］ボタンが見つかりません'));return;}
   b.click();return;}
  /* 送信後の画面 */
  clearTimeout(timer);
  var err=[].slice.call(g.querySelectorAll('.error,.err,font[color=red],.alert,span[style*="red"]')).map(function(e){return e.textContent.trim();}).filter(Boolean).join(' / ');
  var tid=(g.querySelector('[name=topic]')||{}).value||id||'';
  var cm=(g.querySelector('[name=comment]')||{}).value;
  f.remove();
  if(err&&!tid)ng(new Error('BOのエラー：'+err.slice(0,200)));else ok({id:tid,comment:cm,err:err,alert:t.alertMsg});};
 f.src=ROOT+'topic/detail.aspx'+(id?'?topic='+id:'');});}
function verify(t,id){return fetchDoc(ROOT+'topic/detail.aspx?topic='+id).then(function(d){var g=function(n){var e=d.querySelector('[name='+n+']');return e?e.value:'';};
 var bad=[];if(g('comment').trim()!==t.title)bad.push('見出し');if(g('s_dt')!==fmt(t.s))bad.push('掲載日時（BO：'+g('s_dt')+'）');
 if((g('f_dt')||'')!==(t.f?fmt(t.f):''))bad.push('掲載終了（BO：'+(g('f_dt')||'空')+'）');
 if(!t.del&&g('contents').replace(/\s/g,'')!==t.html.replace(/\s/g,''))bad.push('本文');return bad;});}

/* ---------- 画面 ---------- */
function preview(L){body.innerHTML='';
 var tb=el('table','width:100%;border-collapse:collapse;margin-top:6px;font-size:12px');
 var h=el('tr');['行','見出し（NEWSに出る文字）','掲載','',''].forEach(function(x){h.appendChild(el('th','text-align:left;border-bottom:1px solid #ccc;padding:3px',x));});tb.appendChild(h);
 L.list.forEach(function(t){var tr=el('tr');
  tr.appendChild(el('td','padding:3px;vertical-align:top;white-space:nowrap',t.row+(t.part?' '+t.part:'')));
  var c=el('td','padding:3px;vertical-align:top');c.appendChild(el('div','font-weight:bold',t.title));
  t.fixes.forEach(function(x){c.appendChild(el('div','color:#b06000','曜日を直しました：'+x));});
  if(!t.del){var dt=el('details');dt.appendChild(el('summary','cursor:pointer;color:#1a73e8','本文を見る'));var pv=el('div','border:1px solid #ddd;padding:6px;margin:4px 0;max-height:240px;overflow:auto');pv.innerHTML=t.html.replace(/<style[\s\S]*?<\/style>/,'').replace(/src="\//g,'src="'+SHOP+'/');var ims=pv.querySelectorAll('img');for(var i=0;i<ims.length;i++)ims[i].style.cssText='max-width:200px;height:auto';dt.appendChild(pv);c.appendChild(dt);}
  tr.appendChild(c);
  tr.appendChild(el('td','padding:3px;vertical-align:top;white-space:nowrap',t.del?'押した時刻で掲載終了':fmt(t.s).slice(5,16)+' 〜 '+(t.f?fmt(t.f).slice(5,16):'ずっと')));
  t.st=el('td','padding:3px;vertical-align:top;white-space:nowrap',t.ex?'上書き #'+t.ex:t.del?'（BOに無い）':'新規');tr.appendChild(t.st);
  tb.appendChild(tr);});
 body.appendChild(tb);
 var bad=L.list.filter(function(t){return t.fixes.some(function(x){return /存在しない/.test(x);});});
 if(bad.length){say('存在しない日付があります。シートを直してからコピーし直してください',2);return;}
 var go=el('button','margin-top:10px;padding:8px 18px;font-size:14px;background:'+(ENV==='本番'?'#c5221f':'#1a73e8')+';color:#fff;border:0;border-radius:6px;cursor:pointer',ENV+'のBOに '+L.list.length+' 本を登録する');
 body.appendChild(go);go.onclick=function(){go.disabled=true;go.textContent='登録しています…';run(L.list).then(function(){go.remove();});};}
function run(list){var i=0,okN=0;
 function next(){if(i>=list.length){say(okN+'/'+list.length+' 本を'+ENV+'に入れ、読み戻して一致を確認しました',okN===list.length?0:2);
   var a=el('a','display:inline-block;margin-top:6px',ENV+'のトップでNEWSを見る');a.href=SHOP+'/shop/default.aspx#block_of_topic';a.target='_blank';body.appendChild(a);
   say('未来の掲載日時の分は、その時刻にNEWSに出ます。本文の見え方はBOの各トピックの［プレビュー］で確認できます');return Promise.resolve();}
  var t=list[i++];
  if(t.del&&!t.ex){t.st.textContent='—';say(t.row+'行目「'+t.title+'」はBOに無いので、消す作業はありません',1);return next();}
  if(t.del){t.f=new Date();t.f.setSeconds(0,0);if(t.f<=t.s)t.s=new Date(t.f.getTime()-60000);}
  t.st.textContent='登録中…';
  /* 読み戻して食い違えば、同じトピックに1回だけ入れ直す（初回の画面読み込みで本文が空になることがある：10/24 stg実測） */
  function once(id,retry){return put(t,id).then(function(r){if(!r.id)throw new Error('トピック番号が取れません'+(r.err?'（'+r.err+'）':''));return verify(t,r.id).then(function(bad){
    if(bad.length&&!retry){t.st.textContent='入れ直し中… #'+r.id;return once(r.id,true);}
    if(bad.length){t.st.textContent='× #'+r.id;say(t.row+'行目 #'+r.id+'：BOと食い違い（'+bad.join('・')+'）',2);}
    else{okN++;t.st.textContent='✓ #'+r.id+(retry?'（入れ直し）':'');}});});}
  return once(t.ex,false)
   .catch(function(e){t.st.textContent='×';say(t.row+'行目「'+t.title+'」：'+e.message,2);}).then(next);}
 return next();}
function start(text){var rows;try{rows=parseSheet(text);}catch(e){say(e.message,2);ask();return;}
 if(!rows.length){say('NEWSの行が読めませんでした。NEWSタブで見出し行から最後の行までを選んでコピーしてください',2);ask();return;}
 var L=build(rows);L.errs.forEach(function(x){say(x,2);});
 if(L.errs.length){say('上の行を直してからコピーし直してください（他の行も登録していません）',2);return;}
 if(!L.list.length){say('反映する行がありません（「反映しない」にチェックが付いています）',1);return;}
 say('シートから '+L.list.length+' 本を読みました。BOの既存トピックと照合しています…');
 existing().then(function(map){L.list.forEach(function(t){var h=map[t.title];if(h&&h.length)t.ex=h[0];if(h&&h.length>1)say('「'+t.title+'」がBOに'+h.length+'本あります。#'+h[0]+' を上書きします',1);});
  var nx=L.list.filter(function(t){return !t.ex&&!t.del;}).length,up=L.list.filter(function(t){return t.ex;}).length;
  say('新規 '+nx+' 本／上書き '+up+' 本。内容を確認して［登録する］を押してください',0);preview(L);})
 .catch(function(e){say(e.message,2);});}
function ask(){body.innerHTML='';var p=el('div','margin-top:8px');p.appendChild(el('div',null,'バナー依頼シート「NEWS」タブで、見出し行から最後の行までを選んでコピー → ここに貼り付け'));
 var ta=el('textarea','display:block;width:100%;height:120px;margin:6px 0;font:12px monospace');var b=el('button','padding:6px 16px','読み込む');
 b.onclick=function(){log.innerHTML='';start(ta.value);};p.appendChild(ta);p.appendChild(b);body.appendChild(p);ta.focus();}
if(W.__SIS_NEWS_TSV){var t0=W.__SIS_NEWS_TSV;W.__SIS_NEWS_TSV=null;start(t0);}
else if(navigator.clipboard&&navigator.clipboard.readText){navigator.clipboard.readText().then(function(t){if(/見出し|掲載日時/.test(t)||/\t/.test(t))start(t);else ask();},function(){ask();});}
else ask();
})();
