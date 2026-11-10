/* drug store's WEBSHOP KPI（受信とダッシュボード）  #SP-1
   doPost：BOツール「KPI取得」から届いた表を、KPIシートの raw_ タブに丸ごと書き込む（KPI_KEY が一致したときだけ）
   doGet ：?v=<VIEW_KEY> で開くと、raw_ タブを読んでダッシュボードを表示（開くたびに最新）
   スクリプトプロパティ：SHEET_ID / KPI_KEY / VIEW_KEY */
var P = PropertiesService.getScriptProperties();
var TABS = {daily:'raw_日次', monthly:'raw_月次', hourly:'raw_時間帯', channels:'raw_流入元', products:'raw_商品', keywords:'raw_検索', info:'raw_情報'};
var GA = {ga_daily:'raw_GA4日次', ga_channels:'raw_GA4流入元'};
var GA4_PROPERTY = '478197534';
var HTML_ID = '1e9CrsSKUmZ5Ih39xaMWnPYKlNc6Bo1PH';  // 画面はDriveの kpi_dash.html（直すときはこのファイルを書き換えるだけ）

function ss_() { return SpreadsheetApp.openById(P.getProperty('SHEET_ID')); }

function doPost(e) {
  var out = {ok:false};
  try {
    var d = JSON.parse(e.postData.contents);
    if (!d || d.key !== P.getProperty('KPI_KEY')) { out.error = 'key'; return json_(out); }
    var ss = ss_(), n = {};
    Object.keys(TABS).forEach(function (k) {
      var rows = d[k];
      if (!rows || !rows.length || !Array.isArray(rows[0])) return;
      var w = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
      rows = rows.map(function (r) { r = r.slice(); while (r.length < w) r.push(''); return r; });
      var sh = ss.getSheetByName(TABS[k]) || ss.insertSheet(TABS[k]);
      sh.clearContents();
      sh.getRange(1, 1, rows.length, w).setValues(rows);
      n[k] = rows.length - 1;
    });
    var info = ss.getSheetByName(TABS.info) || ss.insertSheet(TABS.info);
    info.getRange('A1:B1').setValues([['最終取得', Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm')]]);
    out.ok = true; out.rows = n;
  } catch (err) { out.error = String(err); }
  return json_(out);
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function read_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 1) return [];
  return sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
}

function doGet(e) {
  if (!e || !e.parameter || e.parameter.v !== P.getProperty('VIEW_KEY')) {
    return HtmlService.createHtmlOutput('<p style="font:14px sans-serif;padding:24px">このページは、共有されたリンクから開いてください。</p>');
  }
  var data = {};
  Object.keys(TABS).forEach(function (k) { data[k] = read_(TABS[k]); });
  Object.keys(GA).forEach(function (k) { data[k] = read_(GA[k]); });
  var t = HtmlService.createTemplate(DriveApp.getFileById(HTML_ID).getBlob().getDataAsString());
  t.DATA = JSON.stringify(data);
  return t.evaluate().setTitle("drug store's WEBSHOP KPI").addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* 初回だけ手で実行：プロパティを入れる */
function setup() {
  P.setProperties({SHEET_ID:'1tBze4E0Xfp9AO2_7LMgyY6qEY-HBgRgFg3y_8SIHBaE',
    KPI_KEY: P.getProperty('KPI_KEY') || Utilities.getUuid().replace(/-/g,''),
    VIEW_KEY: P.getProperty('VIEW_KEY') || Utilities.getUuid().replace(/-/g,'').slice(0,16)});
  Logger.log(JSON.stringify(P.getProperties()));
}

/* ===== GA4：毎朝自動で取る（トリガー ga4Update・毎日7時台） ===== */
function ga4_(body) {  // 高度なサービス AnalyticsData（Google Analytics Data API）
  var j = AnalyticsData.Properties.runReport(body, 'properties/' + GA4_PROPERTY);
  return (j.rows || []).map(function (x) {
    return x.dimensionValues.map(function (d) { return d.value; }).concat(x.metricValues.map(function (m) { return Number(m.value); }));
  });
}
function put_(name, rows) {
  var ss = ss_(), sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  if (rows.length) sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}
function ga4Update() {
  var tz = 'Asia/Tokyo', y = Utilities.formatDate(new Date(Date.now() - 864e5), tz, 'yyyy-MM-dd');
  var d = ga4_({dateRanges: [{startDate: '2025-01-01', endDate: y}], dimensions: [{name: 'date'}, {name: 'deviceCategory'}],
    metrics: [{name: 'sessions'}, {name: 'totalUsers'}, {name: 'ecommercePurchases'}, {name: 'purchaseRevenue'}], limit: 100000});
  var m = {};
  d.forEach(function (r) {
    var k = r[0].slice(0, 4) + '/' + r[0].slice(4, 6) + '/' + r[0].slice(6, 8);
    var o = m[k] = m[k] || [k, 0, 0, 0, 0, 0, 0, 0];
    o[1] += r[2]; o[2] += r[3]; o[3] += r[4]; o[4] += r[5];
    if (r[1] === 'mobile' || r[1] === 'tablet') { o[5] += r[2]; o[6] += r[4]; o[7] += r[5]; }
  });
  var rows = [['日付', 'セッション', 'ユーザー', '購入数', '売上', 'スマホ等セッション', 'スマホ等購入数', 'スマホ等売上']]
    .concat(Object.keys(m).sort().map(function (k) { return m[k]; }));
  put_(GA.ga_daily, rows);
  var s30 = Utilities.formatDate(new Date(Date.now() - 30 * 864e5), tz, 'yyyy-MM-dd');
  var c = ga4_({dateRanges: [{startDate: s30, endDate: y}], dimensions: [{name: 'sessionDefaultChannelGroup'}],
    metrics: [{name: 'sessions'}, {name: 'ecommercePurchases'}, {name: 'purchaseRevenue'}], orderBys: [{metric: {metricName: 'sessions'}, desc: true}]});
  put_(GA.ga_channels, [['チャネル', 'セッション', '購入数', '売上']].concat(c));
  var info = ss_().getSheetByName(TABS.info) || ss_().insertSheet(TABS.info);
  info.getRange('A2:B2').setValues([['GA4最終取得', Utilities.formatDate(new Date(), tz, 'yyyy/MM/dd HH:mm')]]);
}
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'ga4Update') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('ga4Update').timeBased().everyDays(1).atHour(7).inTimezone('Asia/Tokyo').create();
  ga4Update();
}
