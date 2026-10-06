(function(){
/* SP-1R サンリオ14件 掲載終了日延長（2026-10-06 SIS・使い捨て）
   BOを開いた状態で押す → 今のBOの値を書き出し → 掲載終了日だけ書き換え → 商品インポート「在庫と状態」に入れて［取込］の手前で止まる */
var NEWEND='2027/12/01 00:00:00';
var CODES=['15-72365-2640-61','15-72366-2640-32','15-72367-2640-91','15-72368-2640-01','15-72369-2640-61','15-72370-2640-01','15-72371-2640-01','15-72372-2640-02','15-72373-2640-51','4-72360-2640-01','4-72361-2640-61','4-72362-2640-50','4-72363-2640-91','4-72364-2640-20'];
var D=document,ROOT=location.origin+'/'+location.pathname.split('/')[1]+'/',URL1=ROOT+'import/imp_goods.aspx';
function el(t,css,txt){var e=D.createElement(t);if(css)e.style.cssText=css;if(txt!=null)e.textContent=txt;return e;}
var old=D.getElementById('dsSanrio');if(old)old.remove();
var box=el('div','position:fixed;inset:0;z-index:2147483000;background:#fff;display:flex;flex-direction:column');box.id='dsSanrio';
var bar=el('div','display:flex;gap:12px;align-items:center;padding:8px 12px;font:14px/1.5 sans-serif;color:#fff;background:#344054');
var st=el('div','flex:1'),x=el('button','padding:4px 12px','閉じる');x.onclick=function(){box.remove();};
bar.appendChild(st);bar.appendChild(x);box.appendChild(bar);D.body.appendChild(box);
function say(a,b,k){st.textContent='';st.appendChild(el('div','font-size:16px;font-weight:bold',a));if(b)st.appendChild(el('div','font-size:13px;opacity:.9',b));bar.style.background=k=='ng'?'#b42318':k=='ok'?'#1a7f37':k=='go'?'#b54708':'#344054';}
function csvp(t){var out=[],row=[],f='',q=false;for(var i=0;i<t.length;i++){var ch=t[i];
 if(q){if(ch=='"'){if(t[i+1]=='"'){f+='"';i++;}else q=false;}else f+=ch;}
 else if(ch=='"')q=true;else if(ch==','){row.push(f);f='';}else if(ch=='\n'){row.push(f.replace(/\r$/,''));out.push(row);row=[];f='';}else f+=ch;}
 if(f||row.length){row.push(f);out.push(row);}return out;}
function cq(v){v=String(v==null?'':v);return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
var SJ=null;
function sjis(s){
 if(!SJ){SJ={};var d=new TextDecoder('shift_jis');
  for(var k=0xA1;k<=0xDF;k++)SJ[d.decode(new Uint8Array([k]))]=[k];
  for(var a=0x81;a<=0xFC;a++){if(a>0x9F&&a<0xE0)continue;for(var b=0x40;b<=0xFC;b++){if(b==0x7F)continue;var c=d.decode(new Uint8Array([a,b]));if(c.length==1&&c!='�'&&!(c in SJ))SJ[c]=[a,b];}}}
 var out=[],bad=[];for(var ch of s){var n=ch.codePointAt(0);if(n<0x80){out.push(n);continue;}var m=SJ[ch];if(m)out.push.apply(out,m);else{bad.push(ch);out.push(0x3F);}}
 return {bytes:new Uint8Array(out),bad:bad};}
function exportAll(){
 return fetch(URL1.replace('imp_goods','exp_goods'),{credentials:'same-origin'}).then(function(r){return r.text();}).then(function(t){
  var g=new DOMParser().parseFromString(t,'text/html'),fm=g.querySelector('form');if(!fm)throw new Error('書き出し画面を開けません（ログイン切れの可能性）');var fd=new URLSearchParams();
  [].slice.call(fm.querySelectorAll('input,select')).forEach(function(i){if(!i.name||/submit|button|image/.test(i.type))return;if((i.type=='radio'||i.type=='checkbox')&&!i.checked)return;fd.append(i.name,i.value);});
  fd.set('table','tmpgoodscustom2');fd.set('format','CSV');fd.set('header','1');fd.append('export.x','10');fd.append('export.y','5');
  return fetch(URL1.replace('imp_goods','exp_goods'),{method:'POST',body:fd,credentials:'same-origin'});
 }).then(function(r){if(!/csv/.test(r.headers.get('content-type')||''))throw new Error('「在庫と状態」を書き出せませんでした');return r.arrayBuffer();}).then(function(b){
  var t=new TextDecoder('utf-8').decode(b);if(t.indexOf('�')>=0)t=new TextDecoder('shift_jis').decode(b);return csvp(t);});}
function build(a){
 var h=a[0],ic=h.indexOf('商品コード'),ie=h.indexOf('掲載終了日'),is=-1,inm=h.indexOf('商品名'),iq=h.indexOf('在庫数');
 h.forEach(function(v,k){if(is<0&&/^状態/.test(v))is=k;});
 if(ic<0||ie<0)throw new Error('書き出した表に「商品コード」「掲載終了日」がありません');
 var want={};CODES.forEach(function(c){want[c]=1;});var rows=[],show=[];
 for(var k=1;k<a.length;k++){var r=a[k];if(!want[r[ic]])continue;delete want[r[ic]];
  show.push([r[ic],r[inm],r[iq],r[is],r[ie]]);var n=r.slice();n[ie]=/-/.test(r[ie])?NEWEND.replace(/\//g,'-'):NEWEND;rows.push(n);}
 var miss=Object.keys(want);if(miss.length)throw new Error('BOに見つからないコードがあります：'+miss.join(' '));
 return {head:h,rows:rows,show:show};}
function table(show){
 var td='padding:3px 10px;border-bottom:1px solid #eaecf0;white-space:nowrap',t=el('table','border-collapse:collapse;margin:10px 12px;font:13px sans-serif'),tr=el('tr');
 ['商品コード','商品名','在庫数（そのまま）','状態（そのまま）','掲載終了日 今 → 新'].forEach(function(s){tr.appendChild(el('th',td+';text-align:left;background:#f2f4f7',s));});t.appendChild(tr);
 show.forEach(function(s){var r=el('tr');[s[0],s[1],s[2],s[3],s[4]+' → '+NEWEND].forEach(function(v,i){r.appendChild(el('td',td+(i==0?';font-family:monospace':''),v));});t.appendChild(r);});
 var w=el('div','max-height:40vh;overflow:auto;border-bottom:1px solid #d0d5dd');w.appendChild(t);return w;}
function stage(o){
 var csv=[o.head.map(cq).join(',')].concat(o.rows.map(function(r){return r.map(cq).join(',');})).join('\r\n')+'\r\n';
 var enc=sjis(csv);if(enc.bad.length)throw new Error('Shift_JISにできない文字があります：'+enc.bad.join(''));
 var f=el('iframe','flex:1;border:0;width:100%');box.appendChild(f);var stg=0;
 f.onload=function(){var g,w;try{g=f.contentDocument;w=f.contentWindow;if(!g||!g.body)throw 0;}catch(e){say('BOの画面を読み込めません（ログイン切れの可能性）',null,'ng');return;}
  try{
   if(g.querySelector('input[type=password]'))throw new Error('ログイン画面です。BOにログインしてから押してください');
   var txt=g.body.innerText||'';
   if(stg==1&&/受付しました/.test(txt)){say('✅ 受付されました','数分後に「処理状況ログ」で success を確認 → 商品ページが開くか確認してください','ok');stg=2;f.src=URL1;return;}
   if(stg==2)return;
   var rd=g.querySelector('input[type=radio][value=tmpgoodscustom2]'),file=g.querySelector('input[type=file]');
   if(!rd||!file)throw new Error('商品インポート画面に「在庫と状態」が見つかりません');
   rd.click();
   var radios=[].slice.call(g.querySelectorAll('input[type=radio]'));
   var hd=radios.filter(function(r){return r.value==='1'&&r.name!==rd.name;})[0],cv=radios.filter(function(r){return r.value==='CSV';})[0];
   if(!hd||!cv)throw new Error('「列見出し 有り」「CSV形式」が見つかりません');hd.click();cv.click();
   var dt=new w.DataTransfer();dt.items.add(new w.File([enc.bytes],'サンリオ掲載終了日延長_'+CODES.length+'件.csv',{type:'text/csv'}));file.files=dt.files;
   if(!rd.checked||!hd.checked||!cv.checked||!file.files.length)throw new Error('画面の選択をそろえられませんでした');
   var btn=[].slice.call(g.querySelectorAll('input[type=submit],button')).filter(function(b){return (b.value||b.textContent).trim()==='取込';})[0];
   if(btn){btn.style.outline='4px solid #f79009';btn.style.outlineOffset='4px';btn.scrollIntoView({block:'center'});}
   stg=1;say('👉 準備できました。上の表を確認して、赤枠の［取込］を押してください（'+o.rows.length+'件・インポート先「在庫と状態」・列見出し有り・CSV形式）','変わるのは掲載終了日だけです（在庫数・状態などは今のBOの値のまま）。押すまで取込はされません','go');
  }catch(e){say('⛔ '+e.message,'取込はまだされていません','ng');}};
 f.src=URL1;}
say('今のBOの値を書き出しています…（「在庫と状態」'+CODES.length+'件）');
exportAll().then(function(a){var o=build(a);box.insertBefore(table(o.show),bar.nextSibling);stage(o);})
 .catch(function(e){say('⛔ '+(e&&e.message||'書き出しに失敗しました'),'取込はまだされていません','ng');});
})();
