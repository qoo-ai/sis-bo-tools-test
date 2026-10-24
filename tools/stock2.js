(function(){
/* SIS BO tools: 在庫更新（関様の在庫データをそのまま）v2.0 (2026-10-24, #SP-1R)
   関様がいつも作っている在庫データ（BOの「在庫と状態」書き出し＋イベントページ・プライス・店在庫・在庫数の列）を
   Excelで全部コピーしてブックマークを押すだけで、次の4つをまとめて行う。
     1. 在庫数        … 「在庫数」列（「店在庫」は読まない）
     2. 公開の予約    … 「掲載開始日」「掲載終了日」列（新作・セール品の再出品の時刻をそのままBOに入れる）
     3. 完売の収納    … 同じバリエーショングループの在庫が全部0になったら見えないようにする／在庫が戻ったら出し直す
     4. ダブルチェック … 新しく出る商品・予約中なのにファイルに無い商品・在庫0のまま出る新作などを一覧にする
   取り込むのは「今のBOと違う行」だけ。今のBOの行（商品名など）を土台に、上の4項目だけを差し替えて「在庫と状態」で取り込む。
   最後の［取込］は必ず人が押す。古いChrome（Windows 7 の 109 など）でも動くように ES5 で書いている（inset なども使わない）。 */
var VERSION='2.0';
var HIDE='3';            /* 完売で見えなくするときの状態。今の運用（SIS が「完売しまう」で入れている値）に合わせる */
var W=window,D=document,ROOT=location.origin+'/'+location.pathname.split('/')[1]+'/',URL1=ROOT+'import/imp_goods.aspx';
function el(t,css,txt){var e=D.createElement(t);if(css)e.style.cssText=css;if(txt!=null)e.textContent=txt;return e;}
var old=D.getElementById('dsStock2');if(old)old.remove();
var box=el('div','position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483000;background:#fff;display:flex;flex-direction:column;font:14px/1.5 sans-serif;color:#101828');box.id='dsStock2';
var bar=el('div','display:flex;gap:12px;align-items:center;padding:8px 12px;color:#fff;background:#344054');
var st=el('div','flex:1'),x=el('button','padding:4px 12px','閉じる');x.onclick=function(){box.remove();};
bar.appendChild(st);bar.appendChild(x);box.appendChild(bar);D.body.appendChild(box);
var body=el('div','flex:1;overflow:auto');box.appendChild(body);
function say(a,b,kind){st.textContent='';st.appendChild(el('div','font-size:16px;font-weight:bold',a));if(b)st.appendChild(el('div','font-size:13px;opacity:.9',b));
 bar.style.background=kind=='ng'?'#b42318':kind=='ok'?'#1a7f37':kind=='go'?'#b54708':'#344054';}
function fail(e){say('⛔ '+(e&&e.message||e),'取込はまだされていません。直してから、もう一度ブックマークを押してください','ng');}

/* ---------- 文字・日付 ---------- */
function z2(n){return ('0'+n).slice(-2);}
function trim(s){return String(s==null?'':s).replace(/^[\s\u3000]+|[\s\u3000]+$/g,'');}
function digits(s){return String(s||'').replace(/[^0-9]/g,'');}
function pdate(v){                       /* 'YYYY/MM/DD hh:mm(:ss)' / 'YYYY-MM-DD' / Excelの日付シリアル → Date */
 v=trim(v);if(!v)return null;
 if(/^\d{5}(\.\d+)?$/.test(v)){var n=parseFloat(v);if(n>30000&&n<80000){var ms=Math.round((n-25569)*86400000);var u=new Date(ms);return new Date(u.getUTCFullYear(),u.getUTCMonth(),u.getUTCDate(),u.getUTCHours(),u.getUTCMinutes(),0);}}
 var m=v.match(/^(\d{4})\D(\d{1,2})\D(\d{1,2})(?:\D+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
 return m?new Date(+m[1],m[2]-1,+m[3],+(m[4]||0),+(m[5]||0),0):undefined;}  /* undefined＝読めない */
function same(a,b){return (a?a.getTime():0)===(b?b.getTime():0);}
function fmt(d,like){                    /* BOの書き方（like）にそろえて書く */
 if(!d)return '';var sep=/-/.test(like||'')?'-':'/';var s=d.getFullYear()+sep+z2(d.getMonth()+1)+sep+z2(d.getDate());
 var timeLike=/\d:\d/.test(like||'');if(timeLike||d.getHours()||d.getMinutes())s+=' '+z2(d.getHours())+':'+z2(d.getMinutes())+':00';return s;}
function show(d){return d?(d.getMonth()+1)+'/'+d.getDate()+' '+z2(d.getHours())+':'+z2(d.getMinutes()):'（なし）';}
function showY(d){return d?d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate()+' '+z2(d.getHours())+':'+z2(d.getMinutes()):'（なし）';}
function cq(v){v=String(v==null?'':v);return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
var SJ=null;
function sjis(s){
 if(!SJ){SJ={};var dc=new TextDecoder('shift_jis');
  for(var k=0xA1;k<=0xDF;k++)SJ[dc.decode(new Uint8Array([k]))]=[k];
  for(var a=0x81;a<=0xFC;a++){if(a>0x9F&&a<0xE0)continue;for(var b=0x40;b<=0xFC;b++){if(b==0x7F)continue;var c=dc.decode(new Uint8Array([a,b]));if(c.length==1&&c!='\ufffd'&&!(c in SJ))SJ[c]=[a,b];}}}
 var out=[],bad=[];for(var i=0;i<s.length;i++){var ch=s.charAt(i),n=s.charCodeAt(i);
  if(n>=0xD800&&n<=0xDBFF){ch=s.substr(i,2);i++;}
  if(n<0x80){out.push(n);continue;}var mm=SJ[ch];if(mm)out.push.apply(out,mm);else{bad.push(ch);out.push(0x3F);}}
 return {bytes:new Uint8Array(out),bad:bad};}

/* ---------- 表の読み取り ---------- */
function parseTable(t,sep){            /* " で囲まれたセル（改行・区切りを含む）にも対応 */
 var out=[],row=[],f='',q=false;t=String(t||'').replace(/\r\n?/g,'\n');
 for(var i=0;i<t.length;i++){var ch=t.charAt(i);
  if(q){if(ch=='"'){if(t.charAt(i+1)=='"'){f+='"';i++;}else q=false;}else f+=ch;}
  else if(ch=='"'&&f==='')q=true;else if(ch==sep){row.push(f);f='';}else if(ch=='\n'){row.push(f);out.push(row);row=[];f='';}else f+=ch;}
 if(f!==''||row.length){row.push(f);out.push(row);}return out;}
function readInput(text){
 text=String(text||'');if(!trim(text))throw new Error('コピーした内容が空です');
 if(/チェックがNG/.test(text))throw new Error('在庫更新シートの判定がNGです。「チェック」タブを直してからコピーしてください');
 var first=text.split(/\r?\n/)[0]||'',sep=first.indexOf('\t')>=0?'\t':',';
 var a=parseTable(text,sep),hi=-1;
 for(var i=0;i<Math.min(a.length,10);i++){var h=a[i].map(trim);if(h.indexOf('在庫数')>=0&&(h.indexOf('商品コード')>=0||h.indexOf('12桁')>=0)){hi=i;break;}}
 if(hi<0)throw new Error('1行目に「商品コード」（または「12桁」）と「在庫数」の見出しがありません。在庫データを見出しの行ごとコピーしてください');
 var H=a[hi].map(trim);
 function col(re){for(var k=0;k<H.length;k++)if(re.test(H[k]))return k;return -1;}
 var codeCols=[];H.forEach(function(h,k){if(h==='商品コード'||h==='12桁'||h==='12桁(正)')codeCols.push(k);});
 var C={code:codeCols,qty:H.indexOf('在庫数'),st:col(/^状態/),start:col(/^掲載開始日$/),end:col(/^掲載終了日$/),grp:col(/^バリエーショングループ$/),ev:col(/^イベントページ$/),pr:col(/^プライス$/),name:col(/^商品名$/)};
 var rows=[];
 for(var r=hi+1;r<a.length;r++){var v=a[r];if(!v||!v.some(function(s){return trim(s)!=='';}))continue;
  rows.push({line:r+1,codes:codeCols.map(function(k){return trim(v[k]);}),qty:trim(v[C.qty]),st:C.st>=0?trim(v[C.st]):null,
   start:C.start>=0?trim(v[C.start]):null,end:C.end>=0?trim(v[C.end]):null,ev:C.ev>=0?trim(v[C.ev]):'',pr:C.pr>=0?trim(v[C.pr]):'',name:C.name>=0?trim(v[C.name]):''});}
 if(!rows.length)throw new Error('見出しの下に行がありません');
 return {cols:C,rows:rows,head:H};}

/* ---------- BOの「在庫と状態」 ---------- */
function exportAll(){
 return fetch(URL1.replace('imp_goods','exp_goods'),{credentials:'same-origin'}).then(function(r){return r.text();}).then(function(t){
  var g=new DOMParser().parseFromString(t,'text/html'),fm=g.querySelector('form');if(!fm)throw new Error('BOの書き出し画面を開けません（ログイン切れの可能性）。ログインし直してもう一度押してください');var fd=new URLSearchParams();
  [].slice.call(fm.querySelectorAll('input,select')).forEach(function(i){if(!i.name||/submit|button|image/.test(i.type))return;if((i.type=='radio'||i.type=='checkbox')&&!i.checked)return;fd.append(i.name,i.value);});
  fd.set('table','tmpgoodscustom2');fd.set('format','CSV');fd.set('header','1');fd.append('export.x','10');fd.append('export.y','5');
  return fetch(URL1.replace('imp_goods','exp_goods'),{method:'POST',body:fd,credentials:'same-origin'});
 }).then(function(r){if(!/csv/.test(r.headers.get('content-type')||''))throw new Error('BOの「在庫と状態」を書き出せませんでした');return r.arrayBuffer();}).then(function(b){
  var t=new TextDecoder('utf-8').decode(b);if(t.indexOf('\ufffd')>=0)t=new TextDecoder('shift_jis').decode(b);
  var a=parseTable(t,',');while(a.length&&a[a.length-1].length==1&&a[a.length-1][0]==='')a.pop();return a;});}
function master(a){
 var h=a[0].map(trim),ix={code:h.indexOf('商品コード'),name:h.indexOf('商品名'),grp:h.indexOf('バリエーショングループ'),size:h.indexOf('サイズ'),color:h.indexOf('カラー'),qty:h.indexOf('在庫数'),st:-1,start:h.indexOf('掲載開始日'),end:h.indexOf('掲載終了日')};
 h.forEach(function(v,k){if(ix.st<0&&/^状態/.test(v))ix.st=k;});
 if(ix.code<0||ix.qty<0||ix.st<0||ix.start<0||ix.end<0)throw new Error('BOの書き出しに必要な列（商品コード・在庫数・状態・掲載開始日・掲載終了日）がありません');
 var by={},dg={},grp={};
 for(var k=1;k<a.length;k++){var r=a[k];if(!r[ix.code])continue;var o={raw:r,code:r[ix.code],name:r[ix.name]||'',grp:r[ix.grp]||r[ix.code],q:parseInt(r[ix.qty],10)||0,st:String(r[ix.st]),start:pdate(r[ix.start]),end:pdate(r[ix.end]),startRaw:r[ix.start],endRaw:r[ix.end],label:[r[ix.color],r[ix.size]].filter(Boolean).join(' ')};
  by[o.code]=o;var d=digits(o.code);(dg[d]=dg[d]||[]).push(o.code);(grp[o.grp]=grp[o.grp]||[]).push(o);}
 return {head:a[0],ix:ix,by:by,dg:dg,grp:grp};}
function live(o,now){return o.st==='0'&&!(o.start&&o.start>now)&&!(o.end&&o.end<now);}

/* ---------- 突き合わせ ---------- */
function plan(inp,M,opt){
 var now=new Date(),P={err:[],un:[],amb:[],rows:{},touchedGrp:{},ev:0,qtyChg:0,dateChg:0,newNow:[],newLater:{},vanish:[],hide:[],unhide:[],zeroNew:[],keptNon0:[],missResv:[],partial:[],qtySkip:0};
 inp.rows.forEach(function(r){
  var code=null,cands=r.codes.filter(Boolean);
  for(var i=0;i<cands.length&&!code;i++){var c=cands[i];if(M.by[c])code=c;else{var l=M.dg[digits(c)];if(l&&l.length==1)code=l[0];else if(l&&l.length>1){P.amb.push([c,l.join(' ')]);return;}}}
  if(!code){if(cands.length)P.un.push([cands[0],r.qty,r.name]);return;}
  var o=M.by[code],t=P.rows[code];
  if(t){P.err.push(r.line+'行目：同じ商品コードが2回あります（'+code+'）');return;}
  var q=null;
  if(r.qty!==''){if(!/^[0-9]+$/.test(r.qty.replace(/,/g,''))){P.err.push(r.line+'行目：在庫数が数字ではありません（'+code+' → '+r.qty+'）');return;}q=parseInt(r.qty.replace(/,/g,''),10);}else P.qtySkip++;
  var s=r.start===null||r.start===''?undefined:pdate(r.start),e=r.end===null||r.end===''?undefined:pdate(r.end);
  if(s===undefined&&r.start)P.err.push(r.line+'行目：掲載開始日が読めません（'+code+' → '+r.start+'）');
  if(e===undefined&&r.end)P.err.push(r.line+'行目：掲載終了日が読めません（'+code+' → '+r.end+'）');
  var want={q:q==null?o.q:q,st:o.st,start:s===undefined?o.start:s,end:e===undefined?o.end:e};   /* 状態はファイルの列を使わない（古い書き出しで終息品が生き返らないように）。変えるのは完売の収納だけ */
  P.rows[code]={o:o,want:want,inFile:true};P.touchedGrp[o.grp]=1;if(r.ev&&r.ev!=='#N/A'||r.pr&&r.pr!=='#N/A')P.ev++;});
 /* 完売の収納：ファイルに出てきたグループだけを見る */
 Object.keys(P.touchedGrp).forEach(function(g){
  var mem=M.grp[g]||[],tot=0,future=false,inFile=0;
  mem.forEach(function(o){var t=P.rows[o.code];var w=t?t.want:{q:o.q,st:o.st,start:o.start,end:o.end};
   if(w.st==='0'||w.st===HIDE)tot+=w.q;if(w.start&&w.start>now&&w.st!==HIDE)future=true;if(t)inFile++;});
  mem.forEach(function(o){var t=P.rows[o.code];
   if(!t&&(o.st==='0'||o.st===HIDE)&&inFile)P.partial.push(o);
   if(!opt.kanbai)return;
   if(tot===0){
    if(future){if(t&&t.want.st==='0')P.zeroNew.push(o);return;}   /* 発売前は完売にしない（在庫は当日までに入る前提）。代わりに警告 */
    if(!t&&o.st!=='0')return;
    var w=t?t.want:(P.rows[o.code]={o:o,want:{q:o.q,st:o.st,start:o.start,end:o.end},inFile:false}).want;
    if(w.st==='0'){w.st=HIDE;P.hide.push(o);}
   }else{
    if(t&&o.st===HIDE&&t.want.st===HIDE){t.want.st='0';P.unhide.push(o);}   /* 前に完売で隠した商品に在庫が戻った */
   }});});
 /* 差分 */
 var out=[];
 Object.keys(P.rows).forEach(function(code){var t=P.rows[code],o=t.o,w=t.want;
  var dq=w.q!==o.q,ds=w.st!==o.st,dS=!same(w.start,o.start),dE=!same(w.end,o.end);
  if(!(dq||ds||dS||dE))return;
  if(dq)P.qtyChg++;if(dS||dE)P.dateChg++;
  var wasLive=live(o,now),willLive=w.st==='0'&&!(w.end&&w.end<now);
  if(willLive&&!wasLive){if(w.start&&w.start>now){var k=w.start.getTime();(P.newLater[k]=P.newLater[k]||[]).push(o);}else P.newNow.push(o);
   if(w.q===0&&P.zeroNew.indexOf(o)<0)P.zeroNew.push(o);}
  var liveNow=w.st==='0'&&!(w.start&&w.start>now)&&!(w.end&&w.end<now);
  if(wasLive&&!liveNow&&w.st!==HIDE)P.vanish.push(o);   /* 今出ているのに、掲載開始日が先・掲載終了日が過去になって消える */
  if(t.inFile&&w.st!=='0'&&w.st!==HIDE&&w.q>0)P.keptNon0.push(o);
  var n=o.raw.slice();var ix=M.ix;n[ix.qty]=String(w.q);n[ix.st]=w.st;n[ix.start]=fmt(w.start,o.startRaw);n[ix.end]=fmt(w.end,o.endRaw);out.push(n);});
 /* 予約中（掲載開始日が先）なのにファイルに無い商品 */
 Object.keys(M.by).forEach(function(c){var o=M.by[c];if(P.rows[c])return;if(o.st==='0'&&o.start&&o.start>now&&!P.touchedGrp[o.grp])P.missResv.push(o);});
 P.out=out;return P;}

/* ---------- 画面 ---------- */
function groupList(list){var gs=[],ix={};list.forEach(function(o){var G=ix[o.grp];if(!G){G=ix[o.grp]={o:o,n:0,lab:[]};gs.push(G);}G.n++;if(G.lab.length<6)G.lab.push(o.label||o.code);});return gs;}
function section(title,list,note,color){
 var gs=groupList(list),wrap=el('div','margin:6px 0;border:1px solid #eaecf0;border-radius:8px;background:'+(color||'#fff'));
 var head=el('div','padding:8px 12px;cursor:pointer;font-weight:bold');head.textContent=(list.length?'▶ ':'・ ')+title+'　'+list.length+'件'+(gs.length!==list.length?'（'+gs.length+'商品）':'');wrap.appendChild(head);
 if(note)wrap.appendChild(el('div','padding:0 12px 6px;font-size:12px;color:#475467',note));
 if(!list.length)return wrap;
 var tb=el('div','display:none;max-height:40vh;overflow:auto;padding:0 12px 8px');
 var td='padding:2px 8px;border-bottom:1px solid #f2f4f7;vertical-align:top;font-size:13px',t=el('table','border-collapse:collapse');
 gs.forEach(function(G){var tr=el('tr');tr.appendChild(el('td',td+';font-family:monospace;white-space:nowrap',G.o.code));tr.appendChild(el('td',td,G.o.name));tr.appendChild(el('td',td+';color:#475467',G.n+'件 '+G.lab.join('・')+(G.n>G.lab.length?' ほか':'')));t.appendChild(tr);});
 tb.appendChild(t);wrap.appendChild(tb);head.onclick=function(){var o=tb.style.display=='none';tb.style.display=o?'block':'none';head.textContent=head.textContent.replace(/^[▶▼]/,o?'▼':'▶');};
 return wrap;}
function summaryText(P){
 var L=[];L.push('在庫更新 '+new Date().toLocaleString()+'（取り込む行 '+P.out.length+'件）');
 function add(t,list){L.push('■ '+t+' '+list.length+'件');groupList(list).slice(0,200).forEach(function(G){L.push(G.o.code+'\t'+G.o.name+'\t'+G.n+'件 '+G.lab.join('・'));});}
 add('今すぐ新しく出る商品',P.newNow);Object.keys(P.newLater).sort().forEach(function(k){add(showY(new Date(+k))+' に出る商品',P.newLater[k]);});
 add('今出ているのに、いったん見えなくなる商品',P.vanish);add('完売で見えなくする',P.hide);add('在庫が戻ったので出し直す',P.unhide);add('出す（予約する）のに在庫0の商品',P.zeroNew);add('予約中なのに今回のデータに無い商品',P.missResv);add('同じ商品の色・サイズが一部だけ無い',P.partial);
 L.push('■ Webに無いコード（飛ばす） '+P.un.length+'件');P.un.slice(0,200).forEach(function(u){L.push(u[0]+'\t'+u[2]);});
 return L.join('\n');}
function render(inp,M,opt){
 var P=plan(inp,M,opt);body.textContent='';
 if(P.err.length){say('⛔ 直さないと取り込めない行が '+P.err.length+'件あります','Excelを直して、もう一度コピー → ブックマークを押してください（取込はされていません）','ng');
  var e=el('div','padding:12px;color:#b42318;white-space:pre-wrap;font:13px/1.6 monospace');e.textContent=P.err.slice(0,100).join('\n');body.appendChild(e);return;}
 if(!P.out.length){say('BOと同じ内容でした。取り込むものはありません','在庫数・状態・掲載開始日・掲載終了日がすべて今のBOと同じです','ok');return;}
 var p=el('div','max-width:1100px;margin:0 auto;padding:12px 16px');body.appendChild(p);
 var k=el('div','display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 10px');
 function kpi(n,l){var b=el('div','border:1px solid #d0d5dd;border-radius:8px;padding:6px 12px;min-width:120px');b.appendChild(el('div','font-size:22px;font-weight:bold',String(n)));b.appendChild(el('div','font-size:12px;color:#475467',l));k.appendChild(b);}
 var later=0;Object.keys(P.newLater).forEach(function(x){later+=P.newLater[x].length;});
 kpi(P.out.length,'取り込む行（BOと違う行だけ）');kpi(P.qtyChg,'在庫数が変わる');kpi(P.newNow.length+later,'新しく出る（今すぐ＋予約）');kpi(P.hide.length,'完売で見えなくする');kpi(P.unhide.length,'在庫が戻って出し直す');p.appendChild(k);
 p.appendChild(el('div','font-weight:bold;margin:10px 0 2px','① 出す商品の確認（今回出さない商品が混ざっていないか）'));
 p.appendChild(section('取込後すぐサイトに出る商品',P.newNow,'今はサイトに出ていない商品です。出すつもりのない商品があれば［閉じる］で止めて、Excelの在庫数を空欄にするか行を消してください','#fff'));
 Object.keys(P.newLater).sort().forEach(function(x){p.appendChild(section(showY(new Date(+x))+' に自動で出る商品',P.newLater[x],'掲載開始日のとおり、その時刻に自動でサイトに出ます（その時刻に作業は要りません）','#f6fef9'));});
 if(P.vanish.length)p.appendChild(section('今サイトに出ているのに、いったん見えなくなる商品',P.vanish,'掲載開始日が先の日時になった、または掲載終了日が過ぎた商品です。意図どおりか確認してください','#fef3f2'));
 p.appendChild(el('div','font-weight:bold;margin:12px 0 2px','② 抜けの確認'));
 p.appendChild(section('出す（予約する）のに在庫0の商品',P.zeroNew,'新作で在庫0なら、在庫数の入れ忘れの可能性があります。発売前の商品は完売扱いにせず、そのまま予約します','#fffaeb'));
 p.appendChild(section('予約中（掲載開始日が先）なのに今回のデータに無い商品',P.missResv,'BOでは公開予定になっている商品です。品番の抜けでなければそのままで大丈夫です','#fffaeb'));
 p.appendChild(section('同じ商品の色・サイズが一部だけデータに無い',P.partial,'無い色・サイズは今のBOの在庫数のままです','#fff'));
 p.appendChild(section('Webに無いコード（取り込まずに飛ばします）',P.un.map(function(u){return {code:u[0],name:u[2]||'',grp:u[0],label:'在庫数 '+u[1]};}),'店舗だけの商品・打ち間違いなど','#fff'));
 if(P.keptNon0.length)p.appendChild(section('在庫は入るが、状態が通常以外のため出ない商品',P.keptNon0,'終息・非表示などの商品です。出したい場合はSISへ','#fff'));
 p.appendChild(el('div','font-weight:bold;margin:12px 0 2px','③ 完売の収納'));
 var lab=el('label','display:block;margin:4px 0;cursor:pointer'),cb=el('input');cb.type='checkbox';cb.checked=opt.kanbai;cb.onchange=function(){opt.kanbai=cb.checked;render(inp,M,opt);};
 lab.appendChild(cb);lab.appendChild(D.createTextNode(' 同じ商品（バリエーショングループ）の在庫が全部0になったら、見えないようにする（状態'+HIDE+'）。在庫が戻ったら出し直す'));p.appendChild(lab);
 p.appendChild(section('完売で見えなくする商品',P.hide,null,'#fff'));p.appendChild(section('在庫が戻ったので出し直す商品',P.unhide,null,'#fff'));
 if(P.ev)p.appendChild(el('div','margin:12px 0 0;padding:8px 12px;background:#f2f4f7;border-radius:8px;font-size:13px','イベントページ・プライスの指示が '+P.ev+'行あります。これは取り込まれません。いつもどおり #設定依頼 にこのExcelを上げてください（SISが反映します）'));
 var go=el('button','margin:14px 0 4px;padding:10px 22px;font-size:15px;font-weight:bold;color:#fff;background:#b54708;border:0;border-radius:8px;cursor:pointer','この内容で取込画面に入れる（'+P.out.length+'行）');
 var cp=el('button','margin:14px 0 4px 10px;padding:10px 16px','確認結果をコピー（Slack用）');cp.onclick=function(){var s=summaryText(P);try{navigator.clipboard.writeText(s).then(function(){cp.textContent='コピーしました';},function(){fallbackCopy(s,cp);});}catch(e){fallbackCopy(s,cp);}};
 p.appendChild(go);p.appendChild(cp);
 go.onclick=function(){try{stage(P,M);}catch(e){fail(e);}};
 say('確認してください（まだ取り込んでいません）','下の①②③を見て、よければ［この内容で取込画面に入れる］。取り込むのは今のBOと違う '+P.out.length+'行だけです','go');}
function fallbackCopy(s,btn){var ta=el('textarea','position:fixed;left:-9999px');ta.value=s;D.body.appendChild(ta);ta.select();try{D.execCommand('copy');btn.textContent='コピーしました';}catch(e){}ta.remove();}
function rollbackLink(M,P){                        /* 取り込む前のBOの値（戻し用）を Shift_JIS のCSVで保存できるようにする */
 var rows=P.out.map(function(n){return M.by[n[M.ix.code]].raw;});
 var csv=[M.head.map(cq).join(',')].concat(rows.map(function(r){return r.map(cq).join(',');})).join('\r\n')+'\r\n';
 var enc=sjis(csv),a=el('a','margin-left:12px;color:#fff;text-decoration:underline;font-size:13px','戻し用ファイル（取込前の値）を保存');
 var d=new Date();a.download='在庫更新_戻し用_'+d.getFullYear()+z2(d.getMonth()+1)+z2(d.getDate())+'_'+z2(d.getHours())+z2(d.getMinutes())+'.csv';
 a.href=URL.createObjectURL(new Blob([enc.bytes],{type:'text/csv'}));return a;}
function stage(P,M){
 var csv=[M.head.map(cq).join(',')].concat(P.out.map(function(r){return r.map(cq).join(',');})).join('\r\n')+'\r\n';
 var enc=sjis(csv);if(enc.bad.length)throw new Error('Shift_JISにできない文字があります：'+enc.bad.slice(0,10).join(''));
 body.textContent='';say('商品インポートの画面を開いています…（'+P.out.length+'行）');
 var f=el('iframe','flex:1;border:0;width:100%');body.style.overflow='hidden';body.style.display='flex';body.style.flexDirection='column';body.appendChild(f);var stg=0;
 f.onload=function(){var g,w;try{g=f.contentDocument;w=f.contentWindow;if(!g||!g.body)throw 0;}catch(e){say('BOの画面を読み込めません（ログイン切れの可能性）','BOにログインし直して、もう一度ブックマークを押してください','ng');return;}
  try{
   if(g.querySelector('input[type=password]'))throw new Error('ログイン画面です。BOにログインしてから押してください');
   var txt=g.body.innerText||'';
   if(stg==1&&/受付しました/.test(txt)){
    var m=txt.match(/総件数\s*([0-9,]+)\s*件/),n=m?parseInt(m[1].replace(/,/g,''),10):null;
    if(n===P.out.length)say('✅ 受付されました（'+n+'行）','数分後に下の「処理状況ログ」で［更新］を押し、success になっていれば反映済みです。終わったら［閉じる］','ok');
    else say('⚠ 受付件数が合いません（受付 '+n+'行／取り込む行 '+P.out.length+'行）','何も押さずに、この画面のままSISへご連絡ください','ng');
    st.appendChild(rollbackLink(M,P));stg=2;setTimeout(function(){f.src=URL1;},1500);return;}
   if(stg==2)return;
   var rd=g.querySelector('input[type=radio][value=tmpgoodscustom2]'),file=g.querySelector('input[type=file]');
   if(!rd||!file){if(stg==0){stg=-1;f.src=URL1;return;}throw new Error('商品インポート画面に「在庫と状態」が見つかりません');}
   rd.click();
   var radios=[].slice.call(g.querySelectorAll('input[type=radio]'));
   var hd=radios.filter(function(r){return r.value==='1'&&r.name!==rd.name;})[0],cv=radios.filter(function(r){return r.value==='CSV';})[0];
   if(!hd||!cv)throw new Error('「列見出し 有り」「CSV形式」が見つかりません');hd.click();cv.click();
   var d=new Date(),name='在庫更新_'+d.getFullYear()+z2(d.getMonth()+1)+z2(d.getDate())+'_'+z2(d.getHours())+z2(d.getMinutes())+'_'+P.out.length+'行.csv';
   var dt=new w.DataTransfer();dt.items.add(new w.File([enc.bytes],name,{type:'text/csv'}));file.files=dt.files;
   if(!rd.checked||!hd.checked||!cv.checked||!file.files.length)throw new Error('画面の選択をそろえられませんでした');
   var btn=[].slice.call(g.querySelectorAll('input[type=submit],button')).filter(function(b){return (b.value||b.textContent).trim()==='取込';})[0];
   if(btn){btn.style.outline='4px solid #f79009';btn.style.outlineOffset='4px';btn.scrollIntoView({block:'center'});}
   stg=1;say('👉 準備できました。赤い［取込］を押してください（'+P.out.length+'行・インポート先「在庫と状態」）','押すまで取込はされません。やめるときは［閉じる］','go');
  }catch(e){fail(e);}};
 f.src=URL1;}

/* ---------- 起動 ---------- */
function run(text){
 var inp;try{inp=readInput(text);}catch(e){fail(e);ask();return;}
 say('BOの商品一覧と照らし合わせています…（'+inp.rows.length+'行）');
 exportAll().then(function(a){var M=master(a);render(inp,M,{kanbai:true});}).catch(fail);}
function ask(){
 var p=el('div','margin:40px auto;width:620px;max-width:92vw');
 p.appendChild(el('b',null,'在庫データ（Excel）を見出しの行ごと全部コピーしてから、ここに貼り付け（Ctrl+V）'));
 p.appendChild(el('div','font-size:12px;color:#475467;margin-top:4px','Excelで在庫データのシートを開き、左上の角をクリック（またはCtrl+A）→ Ctrl+C。在庫更新シートの「取込用」タブを貼っても使えます'));
 var ta=el('textarea','display:block;width:100%;height:180px;margin:10px 0;font:12px monospace');
 var go=el('button','padding:8px 18px','読み込む');p.appendChild(ta);p.appendChild(go);body.textContent='';body.appendChild(p);ta.focus();
 go.onclick=function(){var v=ta.value;p.remove();run(v);};}
say('在庫更新 v'+VERSION+'：コピーした在庫データを読み取っています…');
try{
 if(navigator.clipboard&&navigator.clipboard.readText){
  navigator.clipboard.readText().then(function(t){if(t&&/在庫数/.test(t.split(/\r?\n/).slice(0,10).join('\n')))run(t);else ask();},function(){ask();});
 }else ask();
}catch(e){ask();}
})();
