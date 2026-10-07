/* SIS BO tools テスト用 menu v3.0（qoo-ai/sis-bo-tools-test）
   ブックマーク → 小窓(go.html)がGitHubに最新コミットを聞く → このファイルをそのコミットで読む → ツールも同じコミットで読む
   ＝コミットした瞬間に反映（jsDelivrのブランチキャッシュを通らない）。小窓が使えない時だけ @main（最大12時間遅れ）で動く。
   ・ENABLED=false で全ツール停止（契約終了時）。ツール単位は TOOLS の on を false
   ・ツールを足す／直す：tools/<id>.js をコミットし、足す場合は TOOLS に1行。sha の書き換えもキャッシュ消しも不要
   ・本番用（qoo-ai/sis-bo-tools）＝先方に渡すツールだけ。テスト用（qoo-ai/sis-bo-tools-test）＝全部 */
(function(){
var ENABLED=true;
var VERSION='3.0-test';
var ME=(document.currentScript&&document.currentScript.src)||'';
var REF=(ME.match(/@([0-9a-f]{40}|main)\//)||[])[1]||'main';
var CDN='https://cdn.jsdelivr.net/gh/qoo-ai/sis-bo-tools-test@'+REF+'/';
var TOOLS=[
 {id:"stock", name:"在庫更新", desc:"在庫更新シートの「取込用」→ 商品在庫の取込（［取込］の手前まで）", where:'bo', grp:'release', on:true, path:'stock.js'},
 {id:"banner", name:"バナー反映", desc:"バナー依頼シートの「バナー一覧」→ BOのバナー設定", where:'bo', grp:'release', on:true, path:'tools/banner.js'},
 {id:"mailmag", name:"メルマガ", desc:"メルマガの予約画面に流し込む", where:'bo', grp:'release', on:true, path:'tools/mailmag.js'},
 {id:"line", name:"LINE配信", desc:"Linyの配信作成画面に流し込む", where:'liny', grp:'release', on:true, path:'tools/line.js'},
 {id:"sale", name:"セール1ボタン", desc:"セール指示書 → メルカート取込ファイル一式（T-19）", where:'bo', grp:'test', on:true, path:'tools/sale.js'},
 {id:"yoyaku", name:"予約取込", desc:"商品インポート画面で、決めた時刻に［取込］を押す", where:'bo', grp:'test', on:true, path:'tools/yoyaku.js'},
 {id:"sanrio", name:"サンリオ掲載終了日延長（1回限り）", desc:"サンリオ14件の掲載終了日を2027/12/01に（在庫・状態はそのまま）。［取込］の手前まで", where:'bo', grp:'test', on:true, path:'tools/sanrio_end.js'}
];
var D=document;
function bar(msg,bg){var d=D.createElement('div');d.textContent=msg;d.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:12px;background:'+(bg||'#344054')+';color:#fff;font:15px/1.5 sans-serif;text-align:center';D.body.appendChild(d);setTimeout(function(){d.remove();},8000);}
if(!ENABLED){bar('このツールの提供は終了しました。','#667085');return;}
var site=/(^|\.)manager\.liny\.jp$/.test(location.hostname)?'liny':(/\/(opipwy|doecms)\//.test(location.pathname)||/^office\..*mercart/.test(location.hostname))?'bo':null;
if(!site){bar('BO（管理画面）またはLinyの画面を開いた状態で押してください。','#b42318');return;}
function load(t){
 var m=D.getElementById('sisMenu');if(m)m.remove();
 var s=D.createElement('script');s.src=CDN+t.path;s.charset='utf-8';
 s.onerror=function(){bar('「'+t.name+'」を読み込めませんでした。時間をおいてもう一度押してください。','#b42318');};
 D.body.appendChild(s);}
var list=TOOLS.filter(function(t){return t.where===site;});
var live=list.filter(function(t){return t.on;});
if(!live.length){bar('この画面で使えるツールは提供を終了しました。','#667085');return;}
if(live.length===1){load(live[0]);return;}
var old=D.getElementById('sisMenu');if(old)old.remove();
var box=D.createElement('div');box.id='sisMenu';
box.style.cssText='position:fixed;top:12px;right:12px;z-index:2147483646;width:380px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;background:#fff;color:#101828;border:1px solid #d0d5dd;border-radius:10px;box-shadow:0 8px 24px rgba(16,24,40,.18);font:14px/1.5 sans-serif';
var head=D.createElement('div');head.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #eaecf0;font-weight:bold;background:#fff4e5';
head.textContent='【テスト版】どのツールを使いますか？';
var x=D.createElement('button');x.textContent='×';x.style.cssText='border:0;background:none;font-size:18px;cursor:pointer;color:#667085';x.onclick=function(){box.remove();};
head.appendChild(x);box.appendChild(head);
function group(label,arr){
 if(!arr.length)return;
 if(label){var h=D.createElement('div');h.textContent=label;h.style.cssText='padding:8px 14px 2px;font-size:12px;color:#667085';box.appendChild(h);}
 arr.forEach(function(t){
  var b=D.createElement('button');b.style.cssText='display:block;width:calc(100% - 20px);margin:6px 10px;padding:10px 12px;text-align:left;border:1px solid #d0d5dd;border-radius:8px;background:'+(t.on?'#fff':'#f2f4f7')+';cursor:'+(t.on?'pointer':'not-allowed')+';font:inherit;color:inherit';
  var n=D.createElement('div');n.textContent=t.name+(t.on?'':'（提供終了）');n.style.fontWeight='bold';
  var d=D.createElement('div');d.textContent=t.desc;d.style.cssText='font-size:12px;color:#475467';
  b.appendChild(n);b.appendChild(d);
  if(t.on)b.onclick=function(){load(t);};else b.disabled=true;
  box.appendChild(b);});}
group('本番にも出しているもの',list.filter(function(t){return t.grp==='release';}));group('テスト中（本番には未公開）',list.filter(function(t){return t.grp!=='release';}));
var f=D.createElement('div');f.textContent='v'+VERSION+(REF==='main'?'（予備経路）':' · '+REF.slice(0,7));f.style.cssText='padding:4px 14px 8px;font-size:11px;color:#98a2b3;text-align:right';box.appendChild(f);
D.body.appendChild(box);
})();
