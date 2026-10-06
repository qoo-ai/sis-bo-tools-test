(function () {
  if (window.__sis1) { window.__sis1.show(); return; }
  var PY = { sw: "# -*- coding: utf-8 -*-\n\"\"\"シルバーウィーク型セール指示書 → メルカート取込ファイル一式（T-19 セール指示書コンバータ）\n\n入力\n  1. 関様の指示書 xlsx（J列=イベントページ / Q列=web大処分プライス）\n  2. BackOffice 商品エクスポート CSV（任意。あれば カテゴリ/販売価格/在庫/購入グループ を引く）\n出力（すべて CP932/CRLF）\n  event.csv          イベントコード,商品コード,並び順（カラー代表1SKU）\n  hide.csv           「ださない」の非表示（状態=1）\n  restore_state.csv  上の戻し用（エクスポート時点の状態）\n  price_*.csv        割引率ごとの対象（セール価格一括登録・補助イベント用）\n  checks             ダブルチェック結果\n\n2026-09-30 追加（#SP-1S）\n  build(..., extra_events=True)  … セールアイテム(sale)と率別(20off/30off/…)の行を同じイベント商品ファイルに入れる\n                                   （イベント運用変更案3章「取込1回」）。無い率のページはC12で止める\n  build(..., all_sizes=True)     … カラー代表1件でなく全サイズを登録（同じ色は同じ並び番号で隣り合う）\n  split_price(...)               … 商品価格を「前日に入れてよい分」と「開始時刻に入れる分」に分ける\n                                   （1商品1セール期間。今セール中の商品に未来開始の価格を入れると今のセールが\n                                    即終了する＝9/23 stg実測。今セール中でない商品は前日でよい見込み→stg(a)で確定）\n\"\"\"\nimport collections, csv, io, re\nimport openpyxl\n\nPAGE = {  # 指示書J列 → 役割\n    '・シルバーウィークスペシャルセール！！': 'sale',\n    '・新作商品': 'new',\n    '・定番アイテム': 'stan',\n    '・おすすめアイテム': 'osusume',\n    '・ださない': 'hide',\n}\nOFF_EVENT = {20: '20off', 30: '30off', 45: '45off', 50: '50off', 70: '70off', 80: '80off'}  # 本番のヘッダーメニュー実在分(9/30 フロント実測)\nSALE_ITEM_EVENT = 'sale'  # /shop/e/esale/（常設セールアイテム）\nSALE_GROUP = '66666666'   # 購入グループ（stg実在: ラスト3DAYSスペシャルバザーアイテム）。回ごとに要確認\nBRAND_ORDER = {'1': 1, '5': 2, '12': 3, '6': 4}          # drug → DSC → mof → fu-ai\nBRAND_ORDER_NEW = {'1': 1, '12': 2, '5': 3, '6': 4}      # 新作: drug → mof → その他\n\n\ndef to_code(v):\n    \"\"\"指示書の12桁/13桁 → メルカート商品コード 1-04084-2420-92 / 12-00060-2620-91\"\"\"\n    s = re.sub(r'\\D', '', str(v))\n    if len(s) == 12:\n        b, rest = s[:1], s[1:]\n    elif len(s) == 13:\n        b, rest = s[:2], s[2:]\n    else:\n        raise ValueError('桁数が想定外: %r' % v)\n    return '%s-%s-%s-%s' % (b, rest[:5], rest[5:9], rest[9:11])\n\n\ndef color_key(code):\n    \"\"\"サイズ（第2ブロック末尾2桁）を除いたキー＝同じカラーのサイズ違い\"\"\"\n    b, p, v, c = code.split('-')\n    return '%s-%s-%s-%s' % (b, p[:3], v, c)\n\n\ndef group_key(code):\n    \"\"\"カラーも除いたキー＝同じ商品（バリエーショングループ相当）\"\"\"\n    b, p, v, c = code.split('-')\n    return '%s-%s-%s' % (b, p[:3], v)\n\n\ndef season_rank(s):\n    \"\"\"'2026年　秋物' → 大きいほど新しい\"\"\"\n    m = re.match(r'(\\d{4})年\\s*(\\S+)', str(s or ''))\n    if not m:\n        return 0\n    order = {'春物': 1, '夏物': 2, '秋物': 3, '冬物': 4}\n    return int(m.group(1)) * 10 + order.get(m.group(2), 0)\n\n\ndef item_rank(catname, mcat=None):\n    \"\"\"アイテム順: カットソー → シャツ系 → パンツ系 → その他 → 小物。\n    メルカートのカテゴリコードがあればそれを優先する。\"\"\"\n    if mcat:\n        order = ['1102', '1109', '1107', '1101', '1103', '1104', '1105', '1106', '1108', '1110',\n                 '1201', '1202', '1203', '1204', '1301', '1302', '1303', '1304', '1305', '1306']\n        return order.index(mcat) if mcat in order else 90\n    n = str(catname or '')\n    if re.search(r'ｶｯﾄｿｰ|Tｼｬﾂ|ﾄｯﾌﾟｽ', n):\n        return 0\n    if re.search(r'ｼｬﾂ|ﾁｭﾆｯｸ|ﾌﾞﾗｳｽ', n):\n        return 1\n    if re.search(r'ﾊﾟﾝﾂ|ﾃﾞﾆﾑ|ｽｶｰﾄ|ﾚｷﾞﾝｽ|ﾎﾞﾄﾑ', n):\n        return 10\n    if re.search(r'ｿｯｸｽ|ﾊﾞｯｸﾞ|ﾎﾟｰﾁ|ﾏｽｸ|帽|ｽﾄｰﾙ|小物|雑貨', n):\n        return 50\n    return 5\n\n\ndef load_instruction(path):\n    wb = openpyxl.load_workbook(path, data_only=True)\n    ws = wb.worksheets[0]\n    head_row = None\n    for i, r in enumerate(ws.iter_rows(min_row=1, max_row=30, values_only=True), 1):\n        if r and r[0] == '展示会名':\n            head_row, head = i, list(r)\n            break\n    if not head_row:\n        raise RuntimeError('見出し行（展示会名）が見つかりません')\n    idx = {h: n for n, h in enumerate(head) if h}\n    out = []\n    for n, r in enumerate(ws.iter_rows(min_row=head_row + 1, values_only=True), head_row + 1):\n        if not r or not r[idx['12桁']]:\n            continue\n        page = str(r[idx['イベントページ']] or '').strip()\n        price = str(r[idx['web大処分プライス']] or '').strip()\n        m = re.match(r'(\\d+)%OFF', price)\n        out.append(dict(\n            row=n, season=r[idx['展示会名']], code=to_code(r[idx['12桁']]),\n            jan=r[idx['JAN']], cat=r[idx['カテゴリー名']], hinban=r[idx['メーカー品番']],\n            color=r[idx['カラーCD']], size=r[idx['サイズCD']],\n            page=page, role=PAGE.get(page, '?'), price_raw=price,\n            off=int(m.group(1)) if m else (0 if price == 'P' else None),\n            jodai=r[idx['上代']], hanbai=r[idx['販売額']], stock=r[idx['在庫']],\n        ))\n    return out\n\n\ndef read_export(text):\n    \"\"\"BackOffice の商品エクスポート（CP932 CSV をデコードした文字列）→ 商品コードで引ける dict\"\"\"\n    rd = csv.DictReader(io.StringIO(text))\n    return {r['商品コード']: r for r in rd}\n\n\ndef build(rows, export=None, events=None, sort_step=1, sale_sort='stock', extra_events=False, all_sizes=False):\n    events = events or {'sale': 'sale', 'new': 'new', 'stan': 'stan', 'osusume': 'osusume'}\n    export = export or {}\n    checks = []\n\n    def gkey(code):\n        e = export.get(code)\n        return e['バリエーショングループ'] if e and e.get('バリエーショングループ') else '?' + group_key(code)\n\n    def ckey(code):\n        e = export.get(code)\n        if e and e.get('バリエーショングループ'):\n            return e['バリエーショングループ'] + '|' + code.split('-')[3]\n        return '?' + color_key(code)\n\n    def chk(cid, label, bad, impact):\n        checks.append([cid, label, '✅' if not bad else '⚠ %d件' % len(bad), impact,\n                       ', '.join(map(str, bad[:15]))])\n\n    # C01 J列が既知の値か\n    chk('C01', 'イベントページ(J列)が既知の5種か', [r['row'] for r in rows if r['role'] == '?'],\n        '載せ先不明の行が出る')\n    # C02 Q列が 数値%OFF / P / ださない か\n    chk('C02', 'プライス(Q列)が「n%OFF」「P」「ださない」のどれか',\n        [r['row'] for r in rows if r['off'] is None and r['role'] != 'hide'], '価格が決まらない')\n    # C03 「ださない」なのにプライスが入っている\n    chk('C03', '「ださない」行にプライスが入っていない（入っていれば指示の矛盾）',\n        [r['code'] for r in rows if r['role'] == 'hide' and r['price_raw'] not in ('・ださない', '')],\n        '出す／出さないの判断違い')\n    # C04 販売額 = 上代×(1-割引) の検算\n    bad = []\n    for r in rows:\n        if r['off'] and isinstance(r['jodai'], (int, float)) and isinstance(r['hanbai'], (int, float)):\n            if round(r['jodai'] * (100 - r['off']) / 100) != r['hanbai']:\n                bad.append(r['code'])\n    chk('C04', '販売額＝上代×(1−割引率) になっているか', bad, '指示書内の価格計算ミス')\n    # C05 同じ商品（カラー違い含む）で割引率が揃っているか\n    g = collections.defaultdict(set)\n    for r in rows:\n        if r['role'] != 'hide':\n            g[gkey(r['code'])].add((r['role'], r['off']))\n    chk('C05', '同じ商品グループ内で 載せ先・割引率が揃っているか',\n        [k for k, v in g.items() if len(v) > 1], '同じ商品ページにカラーで違う価格が出る')\n    # C06 同一商品グループで一部SKUが「ださない」\n    gh = collections.defaultdict(set)\n    for r in rows:\n        gh[gkey(r['code'])].add(r['role'] == 'hide')\n    chk('C06', '同じ商品グループで「ださない」と「出す」が混在していないか（混在=カラー単位の非表示）',\n        [k for k, v in gh.items() if len(v) > 1], '要目視（意図どおりなら問題なし）')\n    # C07 エクスポートに存在しない商品コード\n    if export:\n        chk('C07', '指示書の商品コードがメルカートに存在するか',\n            [r['code'] for r in rows if r['code'] not in export], '取込エラー')\n\n    # C09 出す商品なのに状態が通常(0)以外 → イベントページに出ない（stg実測 9/15: 状態0だけが一覧に出る）\n    if export:\n        bad = [r['code'] for r in rows if r['role'] in ('sale', 'new', 'stan', 'osusume')\n               and str((export.get(r['code']) or {}).get('状態', (export.get(r['code']) or {}).get('状態(掲載フラグ)', '0'))) not in ('0', '')]\n        chk('C09', '載せる商品の状態が「通常(0)」か（0以外はイベントに出ない）', bad,\n            'セールページに出ない。在庫があるなら状態0に戻す')\n    # C10 ①の購入グループ\n    if export:\n        bad = [r['code'] for r in rows if r['role'] == 'sale'\n               and (export.get(r['code']) or {}).get('購入グループ') not in (None, SALE_GROUP)]\n        chk('C10', '①の商品の購入グループがセール用(%s)になっているか' % SALE_GROUP, bad,\n            'セール品と通常品が同じカートで分かれない（送料無料判定の問い合わせ）')\n\n    # ---- イベント（カラー代表1SKU）\n    def stock_of(r):\n        e = export.get(r['code'])\n        if e:\n            try:\n                return int(float(e.get('在庫数') or 0))\n            except ValueError:\n                return 0\n        return int(r['stock'] or 0)\n\n    group_stock = collections.Counter()\n    for code, e in export.items():\n        if e.get('バリエーショングループ'):\n            try:\n                group_stock[e['バリエーショングループ']] += max(0, int(float(e.get('在庫数') or 0)))\n            except ValueError:\n                pass\n\n    reps = collections.OrderedDict()\n    for r in rows:\n        if r['role'] in ('hide', '?'):\n            continue\n        if all_sizes:\n            # 2026-09-30 イベント運用変更案5章: 全サイズを登録し、在庫0も登録したまま。\n            # 売り切れ・同じ色の2枚目は一覧JS＋?filtercode13=1で隠す（毎日の差し替えが不要）\n            reps[(r['role'], r['code'])] = r\n            continue\n        k = (r['role'], ckey(r['code']))\n        if k not in reps or stock_of(r) > stock_of(reps[k]):\n            reps[k] = r\n\n    def sortkey(r):\n        b = r['code'].split('-')[0]\n        mcat = (export.get(r['code']) or {}).get('カテゴリコード')\n        if r['role'] == 'sale':\n            if sale_sort == 'stock':\n                # 9/15 関様指示: ①ページだけ「バリエーショングループの合計在庫数が多い順」。\n                # 同じグループのカラーは同順位で隣り合わせにする。\n                g = gkey(r['code'])\n                return (-group_stock.get(g, 0), g, r['code'])\n            return (item_rank(r['cat'], mcat), BRAND_ORDER.get(b, 9), r['code'])\n        if r['role'] == 'new':\n            return (-season_rank(r['season']), BRAND_ORDER_NEW.get(b, 9), r['code'])\n        if r['role'] == 'stan':\n            n = str(r['cat'])\n            return (0 if 'ｲﾝﾅｰ' in n else 1 if 'ｽﾄﾚｯﾁ' in n else 2, BRAND_ORDER.get(b, 9), r['code'])\n        # おすすめ: 小物、サンリオは最後\n        n = str(r['cat'])\n        return (1 if re.search('ｻﾝﾘｵ|サンリオ', n) else 0, item_rank(n, mcat), r['code'])\n\n    ev = [['イベントコード', '商品コード', '並び順']]\n    per = collections.defaultdict(list)\n    for (role, _), r in reps.items():\n        per[role].append(r)\n    for role in ('sale', 'new', 'stan', 'osusume'):\n        lst = sorted(per[role], key=sortkey)\n        rank, prev = 0, None\n        for r in lst:\n            k = sortkey(r)[:-1]\n            if k != prev:\n                rank += sort_step\n                prev = k\n            ev.append([events[role], r['code'], rank])\n    if extra_events:\n        # セールアイテム・率別ページ: 値引きのある「出す」行すべて（ページの役割を問わない）。並びはフェアと同じ規則\n        sale_like = [r for (role, _), r in reps.items() if r['off']]\n        seen = {(x[0], x[1]) for x in ev[1:]}\n        sale_like = list({r['code']: r for r in sale_like}.values())\n        for ev_code, pick in [(SALE_ITEM_EVENT, lambda r: True)] + [\n                (OFF_EVENT[o], (lambda o: lambda r: r['off'] == o)(o)) for o in sorted(OFF_EVENT)]:\n            lst = sorted([r for r in sale_like if pick(r)],\n                         key=lambda r: (-group_stock.get(gkey(r['code']), 0), gkey(r['code']), r['code']))\n            rank, prev = 0, None\n            for r in lst:\n                if gkey(r['code']) != prev:\n                    rank += sort_step\n                    prev = gkey(r['code'])\n                if (ev_code, r['code']) not in seen:   # フェアのイベントコードと同じなら二重に入れない\n                    ev.append([ev_code, r['code'], rank])\n        chk('C12', '割引率に対応する%OFFページがあるか（無い率は載せ先が無い）',\n            sorted({'%d%%' % r['off'] for r in sale_like if r['off'] not in OFF_EVENT}), 'その率のページを新設するか関様に確認')\n    chk('C08', 'イベントに同じ商品コードが二重登録されていないか',\n        [k for k, v in collections.Counter((x[0], x[1]) for x in ev[1:]).items() if v > 1], '取込エラー')\n\n    # ---- 非表示（ださない）\n    hide = [['商品コード', '状態']] + [[r['code'], 1] for r in rows if r['role'] == 'hide']\n    restore = [['商品コード', '状態']]\n    for r in rows:\n        if r['role'] == 'hide':\n            e = export.get(r['code']) or {}\n            restore.append([r['code'], e.get('状態', e.get('状態(掲載フラグ)', '0'))])\n\n    # ---- 割引率別の対象リスト（セール価格一括登録の条件にする）\n    by_off = collections.defaultdict(list)\n    for r in rows:\n        if r['role'] != 'hide' and r['off']:\n            by_off[r['off']].append(r['code'])\n\n    # ---- 購入グループ（①だけ分ける）: 商品コード,購入グループ ＋ 戻し用\n    pgroup = [['商品コード', '購入グループ']] + [[r['code'], SALE_GROUP] for r in rows if r['role'] == 'sale']\n    pgroup_restore = [['商品コード', '購入グループ']] + [\n        [r['code'], (export.get(r['code']) or {}).get('購入グループ', '99999999')] for r in rows if r['role'] == 'sale']\n\n    summary = collections.Counter((r['role'], r['price_raw']) for r in rows)\n    return dict(event=ev, hide=hide, restore=restore, by_off=dict(by_off), checks=checks,\n                pgroup=pgroup, pgroup_restore=pgroup_restore,\n                summary=summary, reps=len(ev) - 1)\n\n\ndef to_cp932(values):\n    buf = io.StringIO()\n    w = csv.writer(buf, quoting=csv.QUOTE_ALL, lineterminator='\\r\\n')\n    for r in values:\n        w.writerow(['' if v is None else v for v in r])\n    return buf.getvalue().encode('cp932', errors='replace')\n\n\ndef daily_soldout(rows, export, events=None, current_event=None):\n    \"\"\"毎日の完売チェック（T-20）。\n    rows: load_instruction の結果 / export: 当日の「在庫と状態」エクスポート（dict）\n    current_event: いまイベントに入っている [イベントコード, 商品コード] の一覧（無ければ前回生成分）\n    返すもの\n      add     … 代表を在庫ありSKUへ付け替える行（イベントコード,商品コード,並び順）\n      remove  … 全サイズ完売のカラー（イベントから外す）\n      swap_out… 代表が在庫0になったので外す旧代表\n    \"\"\"\n    events = events or {'sale': 'sale', 'new': 'new', 'stan': 'stan', 'osusume': 'osusume'}\n\n    def stk(code):\n        e = export.get(code) or {}\n        try:\n            return int(float(e.get('在庫数') or 0))\n        except ValueError:\n            return 0\n\n    def ckey(code):\n        e = export.get(code) or {}\n        return (e.get('バリエーショングループ') or '?' + group_key(code)) + '|' + code.split('-')[3]\n\n    colors = collections.defaultdict(list)          # (event, color) -> [codes]\n    for r in rows:\n        if r['role'] in events:\n            colors[(events[r['role']], ckey(r['code']))].append(r['code'])\n    cur = collections.defaultdict(list)\n    for ev, code, *rest in (current_event or []):\n        cur[(ev, ckey(code))].append((code, rest[0] if rest else ''))\n\n    add, remove, swap_out = [], [], []\n    for k, codes in colors.items():\n        ev = k[0]\n        live = [c for c in codes if stk(c) > 0]\n        now = cur.get(k, [])\n        now_codes = [c for c, _ in now]\n        order = now[0][1] if now else ''\n        if not live:\n            for c in now_codes:\n                remove.append([ev, c, order])\n            continue\n        if any(stk(c) > 0 for c in now_codes):\n            continue                                   # 代表に在庫あり → 何もしない\n        best = max(live, key=stk)\n        add.append([ev, best, order])\n        for c in now_codes:\n            swap_out.append([ev, c, order])\n    return dict(add=add, remove=remove, swap_out=swap_out,\n                colors=len(colors), soldout=len({(r[0], ckey(r[1])) for r in remove}))\n\n\ndef price_rows(rows, export, start, end, extra_off=0, name=''):\n    \"\"\"商品価格インポート用（1商品1行。メルカートは1商品にセール期間を1つしか持てない＝stg実測 9/15）。\n    extra_off: タイムセールの追加割引率(%)。販価(税抜)×(1-割引)×(1-追加) を税抜で切り捨てず四捨五入。\"\"\"\n    out = [['商品コード', '会員ランク', '販売価格(税込)', '販売価格(税抜)', 'ポイント数', 'セール開始日', 'セール終了日',\n            'セール価格(税込)', 'セール価格(税抜)', 'セールポイント数', 'セール名']]\n    for r in rows:\n        e = export.get(r['code'])\n        if not e or r['role'] == 'hide' or not r['off']:\n            continue\n        pe = int(e['販売価格税抜']); pi = int(e['販売価格税込'])\n        se = round(pe * (100 - r['off']) / 100 * (100 - extra_off) / 100)\n        si = round(se * 1.1)\n        out.append([r['code'], 0, pi, pe, -(-pi // 100), start, end, si, se, -(-si // 100),\n                    name or '%d%%OFF' % r['off']])\n    return out\n\n\ndef read_price_export(text):\n    \"\"\"BO「商品価格」エクスポート → {商品コード: [行dict,...]}（会員ランク別の行もまとめて持つ）\"\"\"\n    out = collections.defaultdict(list)\n    for r in csv.DictReader(io.StringIO(text)):\n        out[r['商品コード']].append(r)\n    return out\n\n\ndef _dt(s):\n    import datetime\n    s = str(s or '').strip()\n    for f in ('%Y/%m/%d %H:%M:%S', '%Y/%m/%d %H:%M', '%Y/%m/%d'):\n        try:\n            return datetime.datetime.strptime(s, f)\n        except ValueError:\n            pass\n    return None\n\n\ndef split_price(price_rows_out, price_export, start, import_at=None):\n    \"\"\"price_rows() の出力を2本に分ける（見出し行つき）。\n    eve  … 取込時点でセール期間を持たない商品。前日に入れても今の表示は変わらない見込み（stg(a)で確認）\n    live … 取込時点でセール中、または未来のセール期間を持つ商品。開始時刻ちょうどに入れる\n    import_at: 前日取込の予定時刻（既定=開始の24時間前）。この時刻にセール中かで判定する\n    会員ランク別(0以外)の行を持つ商品は rank に出す（一括では消せない＝QA Q7-1。B-6で方針決め）\"\"\"\n    import datetime\n    st = _dt(start)\n    at = _dt(import_at) if import_at else (st - datetime.timedelta(days=1) if st else None)\n    head, body = price_rows_out[0], price_rows_out[1:]\n    eve, live, rank = [head], [head], [['商品コード', '会員ランク', 'セール開始日', 'セール終了日', 'セール価格(税込)']]\n    for r in body:\n        rows = price_export.get(r[0], [])\n        busy = False\n        for p in rows:\n            s0, s1 = _dt(p.get('セール開始日')), _dt(p.get('セール終了日'))\n            if p.get('セール価格(税込)') and s1 and (at is None or s1 > at):\n                busy = True   # 取込時点でセール中 or 未来のセールあり → 上書きで今のセールが消える\n            if str(p.get('会員ランク', '0')) not in ('0', ''):\n                rank.append([r[0], p.get('会員ランク'), p.get('セール開始日'), p.get('セール終了日'), p.get('セール価格(税込)')])\n        (live if busy else eve).append(r)\n    return dict(eve=eve, live=live, rank=rank)\n\n\n# ---------------------------------------------------------------- 2026-09-30 #SP-1S 追加: 関様の今の指示書（在庫更新型）\nPAGE_WORDS = [('ださない', 'hide'), ('出さない', 'hide'), ('新作', 'new'), ('定番', 'stan'), ('おすすめ', 'osusume'),\n              ('セール', 'sale'), ('スペシャル', 'sale'), ('フェア', 'sale'), ('感謝祭', 'sale'), ('バザー', 'sale'),\n              ('周年', 'sale'), ('記念', 'sale')]\n\n\ndef load_instruction_v2(path):\n    \"\"\"関様の指示書（BOの在庫と状態エクスポート＋「イベントページ」「プライス」列。例: 0928在庫更新(大感謝祭②).xlsx）\"\"\"\n    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)\n    ws = wb.worksheets[0]\n    rows = list(ws.iter_rows(values_only=True))\n    hi = next(i for i, r in enumerate(rows[:20]) if r and 'イベントページ' in [str(x).strip() for x in r if x])\n    head = [str(x).strip() if x is not None else '' for x in rows[hi]]\n    ix = {h: head.index(h) for h in head if h}\n    out = []\n    for n, r in enumerate(rows[hi + 1:], hi + 2):\n        if not r or not r[0] or str(r[0]).startswith('#'):\n            continue\n        page = str(r[ix['イベントページ']] or '').strip()\n        price = str(r[ix['プライス']] or '').strip()\n        role = '?'\n        for w, rl in PAGE_WORDS:\n            if w in page or (rl == 'hide' and w in price):\n                role = rl\n                break\n        m = re.match(r'(\\d+)%OFF', price)\n        out.append(dict(row=n, season=r[ix.get('品番2', 0)], code=str(r[0]).strip(), jan='', cat=r[ix.get('品番1', 0)],\n                        hinban='', color=r[ix.get('カラー', 0)], size=r[ix.get('サイズ', 0)], page=page, role=role,\n                        price_raw=price, off=int(m.group(1)) if m else (0 if price == 'P' else None),\n                        jodai=None, hanbai=None, stock=r[ix['在庫数']] if '在庫数' in ix else 0,\n                        group=r[ix['バリエーショングループ']] if 'バリエーショングループ' in ix else ''))\n    return out\n\n\ndef price_changes(rows, price_export, start, end, name_fmt='%d%%OFF', at=None):\n    \"\"\"指示書の各行を、いまの商品価格（BO商品価格エクスポート、会員ランク0の行）と比べ、変わる商品だけ出す。\n    返す: dict(eve=前日に入れてよい行, live=開始時刻に入れる行, same=変更不要の件数, missing=価格が引けない商品)\n      ・n%OFF で、いま同じ率のセールが開始より前から終了より後まで続く → 変更不要（same）\n      ・n%OFF で、いまセール期間を持たない → eve（未来開始の価格を前日に入れても今の表示は変わらない＝9/30 stg実証）\n      ・n%OFF で、いま別のセール期間を持つ → live（入れた瞬間に今のセールが終わる＝9/15・9/23・9/30 stg実証）\n      ・P で、いまセール期間を持たない → 変更不要。P で、いまセール中 → live（空欄で入れると即定価に戻るため）\n      back: live のうち、いまのセールがフェア終了より後まで続く商品（例 常設50%→フェア中70%→終了で50%に戻す）。\n            元の率・元の終了日で、フェア終了時刻に入れる（入れた瞬間にフェアのセールが終わる＝時刻ちょうどの取込）\"\"\"\n    import datetime\n    st, en = _dt(start), _dt(end)\n    at = _dt(at) if at else (st - datetime.timedelta(days=1) if st else None)\n    H = ['商品コード', '会員ランク', '販売価格(税込)', '販売価格(税抜)', 'ポイント数', 'セール開始日', 'セール終了日',\n         'セール価格(税込)', 'セール価格(税抜)', 'セールポイント数', 'セール名']\n    eve, live, same, missing, back = [H], [H], 0, [], [H]\n\n    def _back(p, pi, pe):\n        # いまの常設セールがフェア終了より後まで続く商品 → 終了時刻に「元の率・元の終了日」で入れ直す行\n        s1 = _dt(p.get('セール終了日'))\n        if p.get('セール価格(税込)') and s1 and en and s1 > en:\n            back.append([p['商品コード'], 0, pi, pe, -(-pi // 100), end, p.get('セール終了日'),\n                         p.get('セール価格(税込)'), p.get('セール価格(税抜)'), p.get('セールポイント数', ''),\n                         p.get('セール名', '')])\n    for r in rows:\n        if r['role'] in ('hide', '?') or r['off'] is None:\n            continue\n        ps = [p for p in price_export.get(r['code'], []) if str(p.get('会員ランク', '0')) in ('0', '')]\n        if not ps:\n            missing.append(r['code'])\n            continue\n        p = ps[0]\n        pi, pe = int(float(p['販売価格(税込)'])), int(float(p['販売価格(税抜)']))\n        s0, s1 = _dt(p.get('セール開始日')), _dt(p.get('セール終了日'))\n        has = bool(p.get('セール価格(税込)')) and s1 is not None and (at is None or s1 > at)\n        if r['off'] == 0:\n            if has:\n                live.append([r['code'], 0, pi, pe, -(-pi // 100), '', '', '', '', '', ''])\n                _back(p, pi, pe)\n            else:\n                same += 1\n            continue\n        se = round(pe * (100 - r['off']) / 100)\n        si = round(se * 1.1)\n        if has and str(p.get('セール価格(税込)')) == str(si) and s0 and s0 <= st and s1 >= en:\n            same += 1\n            continue\n        row = [r['code'], 0, pi, pe, -(-pi // 100), start, end, si, se, -(-si // 100), name_fmt % r['off']]\n        (live if has else eve).append(row)\n        if has:\n            _back(p, pi, pe)\n    return dict(eve=eve, live=live, same=same, missing=missing, back=back)\n", fair: "#!/usr/bin/env python3\n# -*- coding: utf-8 -*-\n\"\"\"\nsp1s_fair.py — フェアのセール「前日に全部仕込む」パック（#SP-1S 所有・2026-09-30）\n=================================================================\n関様の指示書1本（在庫更新型: 在庫と状態エクスポート＋「イベントページ」「プライス」列）と、\n前日に出した BO の「商品価格」エクスポートから、次を一度に作る。\n\n  10_前日_イベント商品.csv     フェア・セールアイテム・%OFF・おすすめ等（全サイズ／同じ色は同じ並び番号）\n  11_前日_商品価格.csv         いまセール期間を持たない商品だけ（前日に入れても表示は変わらない＝stg実証 9/30）\n  12_開始時刻_商品価格.csv     いまセール中で、率が変わる／定価に戻す商品だけ（0件なら開始時刻の作業なし）\n  13_終了時刻_商品価格.csv     フェア前から続く常設セールに戻す商品（例 50%→フェア70%→終了で50%）。元の率・元の終了日\n  ※ --mode gap（運用ルールA）: 12 を前日分に含め（常設セール品は前日から定価）、13 は翌朝の取込（終了〜翌朝は定価）\n  90_チェック表.csv            指示書の矛盾・価格が引けない商品など\n  99_やること.csv              前日／開始時刻／終了 の人の作業（押すだけ）\n\n終了: 常設セール品以外は作業なし（価格は期間で自動で戻る・注意書きはテンプレートが自動で出し分ける・\nイベントは期間で自動で閉じる）。常設セール品だけ 13 が要る。\n登場人物は 関様（指示書・OK）／SIS（取込ボタン）／自動化（Mercartの期間・テンプレート・予約取込ツール）。\n使い方:\n  python3 sp1s_fair.py --inst 指示書.xlsx --price-export 商品価格.csv --start \"2026/10/10 12:00\" \\\n      --end \"2026/10/12 23:59\" --fair-event 1010fair --out out_fair\n\"\"\"\nimport argparse, collections, csv, io, json, os, sys\nsys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))\nimport sw_sale as S\n\n\ndef wcsv(path, rows, human=False):\n    \"\"\"取込用はCP932（BOの仕様）。人が読む表はUTF-8(BOM付き)＝✅⚠を使うため。\"\"\"\n    s = io.StringIO()\n    csv.writer(s, lineterminator='\\r\\n').writerows(rows)\n    open(path, 'wb').write(('\\ufeff' + s.getvalue()).encode('utf-8') if human else s.getvalue().encode('cp932'))\n    return path\n\n\ndef main(a):\n    rows = S.load_instruction_v2(a.inst)\n    # 指示書そのものが在庫と状態のエクスポートなので、グループ・在庫・状態はここから引く\n    export = {r['code']: {'バリエーショングループ': r.get('group') or '', '在庫数': str(r.get('stock') or 0),\n                          '状態': '0'} for r in rows}\n    events = {'sale': a.fair_event or 'sale', 'new': 'new', 'stan': 'stan', 'osusume': 'osusume'}\n    b = S.build(rows, export, events=events, all_sizes=True, extra_events=True)\n    os.makedirs(a.out, exist_ok=True)\n    wcsv(os.path.join(a.out, '10_前日_イベント商品.csv'), b['event'])\n    pc = dict(eve=[[]], live=[[]], same=0, missing=[], back=[[]])\n    if a.price_export:\n        pe = S.read_price_export(open(a.price_export, 'rb').read().decode('cp932'))\n        pc = S.price_changes(rows, pe, a.start, a.end)\n        if a.mode == 'gap':  # 運用ルールA: 常設セール品は前日から定価→開始で自動でフェア価格。時刻作業なし\n            pc['eve'] = pc['eve'] + pc['live'][1:]\n            pc['live'] = pc['live'][:1]\n            nxt = (S._dt(a.end) + __import__('datetime').timedelta(days=1)).strftime('%Y/%m/%d 10:00')\n            for r in pc['back'][1:]:\n                r[5] = nxt\n        wcsv(os.path.join(a.out, '11_前日_商品価格.csv'), pc['eve'])\n        wcsv(os.path.join(a.out, '12_開始時刻_商品価格.csv'), pc['live'])\n        wcsv(os.path.join(a.out, '13_%s_商品価格.csv' % ('翌朝' if a.mode == 'gap' else '終了時刻')), pc['back'])\n    ck = [['#', '確認すること', '結果', '放置すると', '該当']] + b['checks']\n    ck.append(['P1', '商品価格エクスポートで価格が引けない商品（新作は定価のままなので通常は問題なし）',\n               '✅' if not pc['missing'] else '⚠ %d件' % len(pc['missing']), '値引き指定なら価格が入らない',\n               ', '.join(pc['missing'][:15])])\n    hide = [r['code'] for r in rows if r['role'] == 'hide']\n    ck.append(['H1', '「ださない」の行（在庫あり絞り込み＋一覧JSで見えなくなるなら作業不要）',\n               '✅' if not hide else '⚠ %d件' % len(hide), '在庫がある「ださない」はページに出る', ', '.join(hide[:15])])\n    wcsv(os.path.join(a.out, '90_チェック表.csv'), ck, human=True)\n    n_eve, n_live, n_back = len(pc['eve']) - 1, len(pc['live']) - 1, len(pc['back']) - 1\n    gap = a.mode == 'gap'\n    todo = [['いつ', 'だれ', 'やること', '画面', 'ファイル', '件数'],\n            ['前日', '関様', '指示書をDriveに置く（いつもの形式）', 'Drive', '指示書', ''],\n            ['前日', 'SIS', '指示書→このツール→stgに全部取込→フロント検品（T-25）', 'stg', '10〜13', ''],\n            ['前日', '関様', 'stgを見てOK', 'stg', '', ''],\n            ['前日', 'SIS', '本番に取込: イベント商品', 'データ管理＞イベントインポート＞イベント商品', '10', len(b['event']) - 1],\n            ['前日', 'SIS', '本番に取込: 商品価格（前日分）' + ('（常設セール品は定価に戻る＝ルールA）' if gap else ''),\n             'データ管理＞商品インポート＞商品価格', '11', n_eve],\n            ['前日', 'SIS', ('予約取込ツールに 12 を開始時刻でセット（Macは開けたまま）' if n_live else '作業なし（開始時刻に入れる価格が0件）'),\n             '同上＋予約取込ツール', '12', n_live],\n            ['前日', 'SIS', ('予約取込ツールに 13 を終了時刻でセット' if (n_back and not gap) else '—'), '同上', '13', '' if gap else n_back],\n            ['開始', '自動化', 'Mercartが期間で価格・イベントページ・SALEアイコンを切替／テンプレートが注意書き・アイコンを出す'\n             + ('／予約取込ツールが 12 を取込' if n_live else ''), '', '', ''],\n            ['終了', '自動化', 'Mercartが期間で価格を戻し・イベントを閉じる／テンプレートが注意書きを消す'\n             + ('／予約取込ツールが 13 を取込（常設セールの率に戻す）' if (n_back and not gap) else ''), '', '', ''],\n            ['翌朝', 'SIS', ('本番に取込: 13（常設セールの率に戻す＝ルールA）' if (gap and n_back) else '作業なし'), '商品価格', '13', n_back if gap else '']]\n    wcsv(os.path.join(a.out, '99_やること.csv'), todo, human=True)\n    print(json.dumps({'イベント商品': len(b['event']) - 1,\n                      'イベント別': collections.Counter(x[0] for x in b['event'][1:]),\n                      '前日_価格': n_eve, '開始時刻_価格': n_live, '終了で常設に戻す': n_back, 'mode': a.mode, '価格変更不要': pc['same'],\n                      '価格が引けない': len(pc['missing']), 'ださない': len(hide),\n                      '要確認': [c[0] for c in ck[1:] if not str(c[2]).startswith('✅')]}, ensure_ascii=False, indent=1))\n\n\nif __name__ == '__main__':\n    p = argparse.ArgumentParser()\n    p.add_argument('--inst', required=True)\n    p.add_argument('--price-export')\n    p.add_argument('--start', required=True)\n    p.add_argument('--end', required=True)\n    p.add_argument('--fair-event')\n    p.add_argument('--out', default='out_fair')\n    p.add_argument('--mode', choices=['timed', 'gap'], default='timed',\n                   help='timed=開始・終了の時刻に予約取込ツールで入れる／gap=運用ルールA（前日・翌朝は常設セール品を定価）')\n    main(p.parse_args())\n" };
  var PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
  var XLSXJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  var BO = location.pathname.split('/').slice(0, 2).join('/'); // 例 /opipwy
  var STG = window.__sis1Stg != null ? window.__sis1Stg : /mercart-stg|stg/.test(location.hostname);
  var KEY = 'sis1:' + location.hostname;
  var st = { files: null, summary: null, restore: null, timers: [], keep: null, lock: null, py: null, step: 0 };

  // ---------------------------------------------------------------- 画面
  var box = document.createElement('div');
  box.id = 'sis1';
  box.innerHTML =
    '<style>#sis1{position:fixed;right:12px;top:12px;z-index:2147483000;width:430px;max-height:92vh;overflow:auto;background:#fff;border:2px solid ' + (STG ? '#2b8a3e' : '#d9480f') + ';border-radius:10px;font:13px/1.5 sans-serif;color:#222;box-shadow:0 4px 16px rgba(0,0,0,.2)}' +
    '#sis1 .hd{padding:8px 12px;background:' + (STG ? '#ebfbee' : '#fff4e6') + ';font-weight:bold;display:flex;justify-content:space-between}' +
    '#sis1 .bd{padding:10px 12px}#sis1 label{display:block;margin:6px 0 2px;font-weight:bold}#sis1 input,#sis1 select{width:100%;box-sizing:border-box;padding:4px}' +
    '#sis1 .row{display:flex;gap:8px}#sis1 .row>div{flex:1;min-width:0}#sis1 button{padding:8px 12px;margin:8px 6px 0 0;border-radius:6px;border:1px solid #888;background:#f8f8f8;cursor:pointer}' +
    '#sis1 button.go{background:' + (STG ? '#2b8a3e' : '#d9480f') + ';color:#fff;border:none;font-weight:bold;font-size:14px}' +
    '#sis1 pre{white-space:pre-wrap;background:#f6f6f6;padding:6px;max-height:260px;overflow:auto;margin:8px 0 0;font-size:12px}' +
    '#sis1 .chk{display:flex;gap:6px;align-items:center;font-weight:normal;margin-top:6px}#sis1 .chk input{width:auto}</style>' +
    '<div class="hd"><span>SIS セール1ボタン（' + (STG ? 'stg 検証環境' : '本番') + '）</span><a href="#" class="x">×</a></div>' +
    '<div class="bd">' +
    '<label>関様の依頼シート（.xlsx）※今の指示書でも可</label><input type="file" class="inst" accept=".xlsx">' +
    '<div class="row"><div><label>開始</label><input type="datetime-local" class="start"></div><div><label>終了</label><input type="datetime-local" class="end"></div></div>' +
    '<div class="row"><div><label>フェアのイベントコード</label><input type="text" class="ev" placeholder="例 1010fair"></div>' +
    '<div><label>常設セールと重なるとき</label><select class="mode"><option value="timed">B 時刻ちょうどに入れる</option><option value="gap">A 前日・翌朝は定価</option></select></div></div>' +
    '<div class="row"><div><label>購入グループ</label><select class="grp"><option value="">変えない</option></select></div>' +
    '<div><label>購入グループを入れる時</label><select class="gwhen"><option value="now">前日（すぐ）</option><option value="start">開始時刻</option></select></div></div>' +
    (STG ? '<label class="chk"><input type="checkbox" class="now" checked> stgは開始を「今」にする（関様がすぐ確認できる）</label>' : '') +
    '<label class="chk"><input type="checkbox" class="dry"> 作るだけ（取り込まない・確認用）</label>' +
    '<button class="go">全部やる</button><button class="dl">ファイルを保存</button><button class="undo">元に戻す</button><button class="clean">フェア後の片付け</button>' +
    '<div class="state" style="margin-top:8px;font-weight:bold"></div><pre class="log"></pre></div>';
  document.body.appendChild(box);
  var $ = function (s) { return box.querySelector(s); };
  $('.x').onclick = function (e) { e.preventDefault(); box.style.display = 'none'; };
  try { var saved = JSON.parse(localStorage.getItem(KEY + ':form') || '{}');
    ['start', 'end', 'ev', 'mode', 'gwhen'].forEach(function (k) { if (saved[k]) $('.' + k).value = saved[k]; });
    var lastlog = localStorage.getItem(KEY + ':log'); if (lastlog) $('.log').textContent = '（前回）\n' + lastlog.split('\n').slice(0, 15).join('\n'); } catch (e) {}

  function log(m) {
    var t = new Date().toLocaleTimeString('ja-JP');
    $('.log').textContent = t + ' ' + m + '\n' + $('.log').textContent;
    try { localStorage.setItem(KEY + ':log', t + ' ' + m + '\n' + (localStorage.getItem(KEY + ':log') || '').slice(0, 20000)); } catch (e) {}
  }
  function state(m) { $('.state').textContent = m; }
  function jp(dtl) { return dtl ? dtl.replace(/-/g, '/').replace('T', ' ') : ''; } // 2026-10-10T12:00 → 2026/10/10 12:00
  function loadScript(src) { return new Promise(function (ok, ng) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { ng(new Error('読み込めない: ' + src)); }; document.head.appendChild(s); }); }

  // ---------------------------------------------------------------- BOとのやりとり（画面と同じフォームを送るだけ）
  async function exportTable(table, extra) {
    var fd = new FormData(), base = { table: table, rules: '', goods: '', gname: '', keyword: '', event: '', accessory_goods: '', status: '',
      format: 'CSV', header: '1', 'export.x': '10', 'export.y': '10' };
    Object.keys(extra || {}).forEach(function (k) { base[k] = extra[k]; });
    Object.keys(base).forEach(function (k) { fd.append(k, base[k]); });
    var r = await fetch(BO + '/import/exp_goods.aspx', { method: 'POST', body: fd, credentials: 'include' });
    var ct = r.headers.get('content-type') || '';
    var buf = new Uint8Array(await r.arrayBuffer());
    if (!/csv/.test(ct)) throw new Error('エクスポートができない（' + table + '。ログイン切れの可能性）');
    return buf;
  }
  function exportPrice() { return exportTable('tmpgoodsprice'); }
  async function loadGroups() { // 購入グループマスタ（エクスポート画面の選択肢から）
    st.groups = {};
    try {
      var h = await (await fetch(BO + '/import/exp_goods.aspx', { credentials: 'include' })).text();
      var d = new DOMParser().parseFromString(h, 'text/html'), sel = d.querySelector('select[name=rules]');
      [].forEach.call(sel ? sel.options : [], function (o) {
        if (!o.value) return; st.groups[o.value] = o.text.trim();
        var op = document.createElement('option'); op.value = o.value; op.textContent = o.value + ' ' + o.text.trim(); $('.grp').appendChild(op);
      });
    } catch (e) { log('⚠ 購入グループの一覧を読めない'); }
  }
  function groupCode(v) { // 名前でもコードでもよい。見つからなければ null
    v = String(v == null ? '' : v).trim(); if (!v) return '';
    if (st.groups[v]) return v;
    var k = Object.keys(st.groups).filter(function (c) { return st.groups[c] === v || st.groups[c].indexOf(v) >= 0 || v.indexOf(c) === 0; });
    return k.length === 1 ? k[0] : null;
  }
  async function importFile(page, table, name, bytes) {
    var h = await (await fetch(BO + page, { credentials: 'include', cache: 'no-store' })).text();
    if (/ログイン/.test((h.match(/<title>([^<]*)/) || [])[1] || '')) throw new Error('ログインが切れている');
    var opendt = (h.match(/name="opendt"\s+value="([^"]*)"/) || [])[1];
    var fd = new FormData();
    fd.append('table', table);
    fd.append('txtFile', new Blob([bytes], { type: 'text/csv' }), name);
    fd.append('header', '1'); fd.append('format', 'CSV');
    if (opendt) fd.append('opendt', opendt);
    fd.append('cmdUpload', '取込');
    var r = await fetch(BO + page, { method: 'POST', body: fd, credentials: 'include' });
    var t = await r.text();
    var d = new DOMParser().parseFromString(t, 'text/html');
    var main = d.querySelector('#content') || d.body;
    var msg = (main ? main.textContent : t).replace(/\s+/g, ' ').trim();
    var head = msg.slice(0, 300);
    var err = /エラー|失敗|できません|不正/.test(head) && !/エラー\s*[:：]?\s*0\s*件/.test(head);
    return { ok: r.ok && !err, status: r.status, msg: head };
  }
  function keepAlive() {
    fetch(BO + '/menu.aspx', { credentials: 'include', cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (h) {
      if (/ログイン/.test((h.match(/<title>([^<]*)/) || [])[1] || '')) { log('⚠ ログインが切れた。予約分は入らない。ログインし直して「全部やる」をもう一度'); stopTimers(); }
    }).catch(function () { log('⚠ BOにつながらない（回線）'); });
  }
  function wake() {
    if (!navigator.wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) { st.lock = l; }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (st.timers.length && document.visibilityState === 'visible') wake(); });
  function stopTimers() { st.timers.forEach(clearTimeout); st.timers = []; clearInterval(st.keep); st.keep = null; if (st.lock) { st.lock.release(); st.lock = null; } }

  // ---------------------------------------------------------------- フェアパック（Python）
  function sheetRows(ab) { var wb = XLSX.read(ab, { type: 'array', cellDates: true }); return wsRows(wb.Sheets[wb.SheetNames[0]]); }
  function wsRows(ws) {
    if (!ws || !ws['!ref']) return [];
    var rg = XLSX.utils.decode_range(ws['!ref']);
    var rows = [];
    for (var R = 0; R <= rg.e.r; R++) {
      var row = [];
      for (var C = 0; C <= rg.e.c; C++) {
        var c = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        var v = null;
        if (c) {
          if (c.t === 'e') v = c.w || '#N/A';
          else if (c.t === 'd') v = { __dt__: c.v.toISOString() };
          else if (c.t === 'z') v = null;
          else v = c.v;
        }
        row.push(v);
      }
      rows.push(row);
    }
    return rows;
  }
  var V2 = ['商品コード', '商品コード', '商品名', 'バリエーショングループ', 'サイズ', 'カラー', 'イベントページ', 'プライス', '店在庫', '在庫数',
            '状態(掲載フラグ)', '掲載開始日', '掲載終了日', '発売日', '品番1', '品番2'];
  function cellStr(v) { if (v == null) return ''; if (typeof v === 'object' && v.__dt__) return v.__dt__; return String(v).trim(); }
  function readSettings(wb) { // 依頼シートの「設定」タブ：A列=項目、B列=値
    var o = {}; wsRows(wb.Sheets['設定']).forEach(function (r) { if (r[0]) o[cellStr(r[0])] = r[1]; }); return o;
  }
  function toLocal(v) { // セルの日時 → datetime-local の値（日本時間）
    if (v == null || v === '') return '';
    if (typeof v === 'object' && v.__dt__) { var d = new Date(v.__dt__); d = new Date(d.getTime() + 9 * 3600000); return d.toISOString().slice(0, 16); }
    var m = String(v).match(/(\d{4})\D(\d{1,2})\D(\d{1,2})\D+(\d{1,2}):(\d{2})/);
    return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) + 'T' + ('0' + m[4]).slice(-2) + ':' + m[5] : '';
  }
  async function requestRows(wb) { // 依頼シート「商品」タブ → 指示書（v2）の形
    var rows = wsRows(wb.Sheets['商品']);
    var hi = rows.findIndex(function (r) { return r.some(function (v) { return cellStr(v) === '商品コード'; }); });
    if (hi < 0) throw new Error('依頼シートの「商品」タブに「商品コード」の見出しがない');
    var h = rows[hi].map(cellStr), ic = h.indexOf('商品コード'), ip = h.indexOf('イベントページ'), ipr = h.indexOf('プライス');
    var ig = h.findIndex(function (x) { return /購入グループ/.test(x); });
    if (ip < 0 || ipr < 0) throw new Error('依頼シートに「イベントページ」「プライス」の見出しがない');
    state('1/6 在庫と状態をエクスポート中…');
    var c2 = rowsOf(await exportTable('tmpgoodscustom2')), H = c2[0];
    var X = function (k) { return H.indexOf(k); };
    var map = {}; c2.slice(1).forEach(function (r) { if (r[0]) map[r[0].replace(/\D/g, '')] = r; });
    var out = [V2], missing = [], per = {}, seen = {};
    rows.slice(hi + 1).forEach(function (r) {
      var raw = cellStr(r[ic]); if (!raw || raw[0] === '#' || raw === '記入例') return;
      var key = raw.replace(/\D/g, ''), m = map[key];
      if (!m) { missing.push(raw); return; }
      if (seen[m[0]]) return; seen[m[0]] = 1;
      var g = ig >= 0 ? cellStr(r[ig]) : '';
      if (g) per[m[0]] = g;
      out.push([m[0], key, m[X('商品名')], m[X('バリエーショングループ')], m[X('サイズ')], m[X('カラー')], cellStr(r[ip]), cellStr(r[ipr]), null,
                Number(m[X('在庫数')] || 0), Number(m[X('状態(掲載フラグ)')] || 0), m[X('掲載開始日')] || null, m[X('掲載終了日')] || null,
                m[X('発売日')] || null, m[X('品番1')] || null, null]);
    });
    return { rows: out, missing: missing, per: per };
  }
  async function py() {
    if (st.py) return st.py;
    state('準備中（初回は30秒ほど）…');
    if (!window.loadPyodide) await loadScript(PYODIDE + 'pyodide.js');
    var p = await window.loadPyodide({ indexURL: PYODIDE });
    p.FS.mkdirTree('/w');
    p.FS.writeFile('/w/sw_sale.py', PY.sw);
    p.FS.writeFile('/w/sp1s_fair.py', PY.fair);
    p.runPython([
      'import sys, types, json, datetime',
      'sys.path.insert(0, "/w")',
      'm = types.ModuleType("openpyxl")',
      'class _WS:',
      '    def __init__(s, rows): s.rows = rows',
      '    def iter_rows(s, min_row=1, max_row=None, values_only=True):',
      '        for r in s.rows[min_row - 1:max_row]: yield tuple(r)',
      'class _WB:',
      '    def __init__(s, rows): s.worksheets = [_WS(rows)]',
      'def _cv(v):',
      '    if isinstance(v, dict) and "__dt__" in v: return datetime.datetime.fromisoformat(v["__dt__"].replace("Z", ""))',
      '    if isinstance(v, float) and v.is_integer(): return int(v)',
      '    return v',
      'def load_workbook(path, data_only=True, read_only=False):',
      '    return _WB([[_cv(x) for x in r] for r in json.load(open(path + ".json", encoding="utf-8"))])',
      'm.load_workbook = load_workbook',
      'sys.modules["openpyxl"] = m'].join('\n'));
    st.py = p;
    return p;
  }
  async function makePack(instRows, priceBytes, a) {
    var p = await py();
    p.FS.writeFile('/w/inst.xlsx.json', JSON.stringify(instRows));
    p.FS.writeFile('/w/price.csv', priceBytes);
    try { p.FS.readdir('/w/out').forEach(function (f) { if (f[0] !== '.') p.FS.unlink('/w/out/' + f); }); } catch (e) {}
    p.globals.set('ARGS', p.toPy(a));
    var out = p.runPython([
      'import io, contextlib, importlib, json, types',
      'import sw_sale, sp1s_fair',
      'importlib.reload(sw_sale); importlib.reload(sp1s_fair)',
      'A = ARGS.to_py() if hasattr(ARGS, "to_py") else ARGS',
      'ns = types.SimpleNamespace(inst="/w/inst.xlsx", price_export="/w/price.csv", start=A["start"], end=A["end"], fair_event=A["ev"], out="/w/out", mode=A["mode"])',
      'buf = io.StringIO()',
      'with contextlib.redirect_stdout(buf): sp1s_fair.main(ns)',
      'buf.getvalue()'].join('\n'));
    var files = {};
    p.FS.readdir('/w/out').forEach(function (f) { if (f[0] !== '.') files[f] = p.FS.readFile('/w/out/' + f); });
    return { summary: JSON.parse(out), files: files };
  }
  function rowsOf(bytes, enc) { // CSV(cp932 or utf-8) → 配列
    var t = new TextDecoder(enc || 'shift_jis').decode(bytes).replace(/^﻿/, '');
    var out = [], row = [], cell = '', q = false;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); out.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); out.push(row); }
    return out;
  }
  function file(prefix) { var k = Object.keys(st.files || {}).filter(function (f) { return f.indexOf(prefix) === 0; })[0]; return k ? { name: k, bytes: st.files[k] } : null; }
  function nrows(f) { return f ? Math.max(0, rowsOf(f.bytes).length - 1) : 0; }
  function makeRestore(priceBytes, codes) { // 取込前の価格（ランク0）を、入れる商品の分だけ
    var rows = rowsOf(priceBytes), head = rows[0], ix = head.indexOf('商品コード'), ir = head.indexOf('会員ランク');
    var keep = [head].concat(rows.slice(1).filter(function (r) { return codes[r[ix]] && String(r[ir]) === '0'; }));
    return keep;
  }
  async function toCp932(rows) { // BOの取込はCP932。Pythonの cp932 で作る（化ける文字があれば止まる）
    var p = await py(); p.globals.set('T', toCsvText(rows));
    return p.runPython('T.encode("cp932")').toJs();
  }
  function toCsvText(rows) {
    var s = rows.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n') + '\r\n';
    return s;
  }
  async function verify(expect) { // 入れた価格が反映されたか（開始・終了・セール価格）
    var now = rowsOf(await exportPrice()), h = now[0], ix = h.indexOf('商品コード'), ir = h.indexOf('会員ランク');
    var cur = {}; now.slice(1).forEach(function (r) { if (String(r[ir]) === '0') cur[r[ix]] = r; });
    var e = rowsOf(expect.bytes), eh = e[0], bad = [];
    var ci = ['セール開始日', 'セール終了日', 'セール価格(税込)'].map(function (k) { return [eh.indexOf(k), h.indexOf(k)]; });
    function norm(v) { var d = String(v || '').trim().replace(/(\d+:\d+):\d\d$/, '$1'); var m = d.match(/^(\d+)\/(\d+)\/(\d+)(.*)$/); return m ? +m[1] + '/' + +m[2] + '/' + +m[3] + m[4].replace(/ 0?(\d+):/, ' $1:') : d; }
    e.slice(1).forEach(function (r) {
      var c = cur[r[eh.indexOf('商品コード')]];
      if (!c) { bad.push(r[0] + '（商品が無い）'); return; }
      ci.forEach(function (p) { if (norm(r[p[0]]) !== norm(c[p[1]])) bad.push(r[0] + ' ' + eh[p[0]] + ' 期待[' + r[p[0]] + '] いま[' + c[p[1]] + ']'); });
    });
    return bad;
  }
  function scheduleAt(when, f, label, table, check) {
    table = table || 'tmpgoodsprice'; check = check || verify;
    var ms = new Date(when.replace(/\//g, '-').replace(' ', 'T') + ':00+09:00') - Date.now();
    if (ms < 0) { log('⚠ ' + label + ' の時刻が過ぎている（' + when + '）。今すぐは入れない'); return; }
    st.timers.push(setTimeout(async function () {
      try {
        var r = await importFile('/import/imp_goods.aspx', table, f.name, f.bytes);
        log((r.ok ? '✅ ' : '⚠ ') + label + ' を取込: ' + r.msg.slice(0, 120));
        setTimeout(async function () { var bad = await check(f); log(bad.length ? '⚠ ' + label + ' 反映されていない ' + bad.length + '件: ' + bad.slice(0, 5).join(' / ') : '✅ ' + label + ' 全件反映を確認'); }, window.__sis1Wait || 60000);
      } catch (e) { log('⚠ ' + label + ' 失敗: ' + e.message); }
      st.timers.shift(); if (!st.timers.length) { stopTimers(); state('予約分もすべて完了'); document.title = document.title.replace(/^⏰\S* /, ''); }
    }, ms));
    log('⏰ ' + label + ' を ' + when + ' に予約（' + nrows(f) + '行）');
  }

  // ---------------------------------------------------------------- イベント新設（無ければ、ひな形をコピーして期間つきで作る）
  async function exportEvents() {
    var fd = new FormData();
    [['table', 'tmpevent'], ['category_tree', ''], ['genre_tree', ''], ['event', ''], ['format', 'CSV'], ['header', '1'], ['export.x', '10'], ['export.y', '10']]
      .forEach(function (q) { fd.append(q[0], q[1]); });
    var r = await fetch(BO + '/import/exp_event.aspx', { method: 'POST', body: fd, credentials: 'include' });
    if (!/csv/.test(r.headers.get('content-type') || '')) throw new Error('イベントのエクスポートができない（ログイン切れの可能性）');
    return rowsOf(new Uint8Array(await r.arrayBuffer()));
  }
  var CLEAR_EV = /^(画像ファイル|コメント|フリースペース(?!2)|タイトル|メタ|カスタムURL|シークレットコード|イベント商品最終自動更新日)/;
  async function planEvent(a) { // 返す: {exists, row(新設の行), head, warn}
    var ev = await exportEvents(), H = ev[0], cur = ev.filter(function (r) { return r[0] === a.ev; })[0];
    var iS = H.indexOf('イベント開始日'), iE = H.indexOf('イベント終了日'), iN = H.indexOf('イベント名称');
    var norm = function (v) { return String(v || '').replace(/:\d\d$/, '').replace(/\/0?(\d)/g, '/$1').replace(/ 0?(\d):/, ' $1:'); };
    if (cur) {
      var w = (norm(cur[iS]) !== norm(a.start) || norm(cur[iE]) !== norm(a.end)) ? 'イベント ' + a.ev + ' の期間がBOでは ' + cur[iS] + '〜' + cur[iE] + '（ツールは変えない。直すならBOのイベント設定で）' : '';
      return { exists: true, warn: w };
    }
    var tc = cellStr((st.settings || {}).tpl) || '', tpl = ev.filter(function (r) { return r[0] === tc; })[0];
    if (!tpl) tpl = ev.slice(1).filter(function (r) { return /fair|sale|sp/i.test(r[0]) && r[iS]; }).sort(function (x, y) { return String(y[iS]).localeCompare(String(x[iS])); })[0];
    if (!tpl) throw new Error('イベント ' + a.ev + ' が無く、ひな形にするイベントも見つからない（設定タブの「ひな形イベント」に既存のコードを書く）');
    var n = tpl.slice();
    H.forEach(function (h, i) { if (CLEAR_EV.test(h)) n[i] = ''; });
    n[0] = a.ev; n[iN] = cellStr((st.settings || {}).name) || a.ev; n[iS] = a.start + ':00'; n[iE] = a.end + (/:59$/.test(a.end) ? ':59' : ':00');
    return { exists: false, head: H, row: n, tpl: tpl[0] };
  }

  // ---------------------------------------------------------------- 購入グループ（セールコメントのレイアウトにある列。その列だけ変えて同じ行を入れ直す）
  async function custom3For(ev, codes) {
    var rows = rowsOf(await exportTable('tmpgoodscustom3', { event: ev }));
    var head = rows[0], have = {};
    rows.slice(1).forEach(function (r) { if (r[0]) have[r[0]] = r; });
    var lack = codes.filter(function (c) { return !have[c]; }).slice(0, 80);
    for (var i = 0; i < lack.length; i++) { // イベントに入っていない商品は1つずつ
      var one = rowsOf(await exportTable('tmpgoodscustom3', { goods: lack[i] }));
      one.slice(1).forEach(function (r) { if (r[0] === lack[i]) have[r[0]] = r; });
    }
    return { head: head, have: have };
  }
  async function groupFile(ev, targets) { // targets: {商品コード: 購入グループコード}
    var codes = Object.keys(targets), c = await custom3For(ev, codes), gi = c.head.indexOf('購入グループ');
    if (gi < 0) throw new Error('セールコメントのエクスポートに「購入グループ」列がない');
    var after = [c.head], before = [c.head], miss = [];
    codes.forEach(function (k) {
      var r = c.have[k]; if (!r) { miss.push(k); return; }
      if (String(r[gi]) === String(targets[k])) return;
      var n = r.slice(); n[gi] = targets[k]; after.push(n); before.push(r.slice());
    });
    return { after: after, before: before, miss: miss, gi: gi };
  }
  function groupCheck(ev, targets) {
    return async function () {
      var c = await custom3For(ev, Object.keys(targets)), gi = c.head.indexOf('購入グループ'), bad = [];
      Object.keys(targets).forEach(function (k) { var r = c.have[k]; if (!r || String(r[gi]) !== String(targets[k])) bad.push(k + ' いま[' + (r ? r[gi] : '無し') + ']'); });
      return bad;
    };
  }

  // ---------------------------------------------------------------- 全部やる
  async function run(force) {
    var inst = $('.inst').files[0];
    var a = { start: jp($('.start').value), end: jp($('.end').value), ev: $('.ev').value.trim(), mode: $('.mode').value };
    try { localStorage.setItem(KEY + ':form', JSON.stringify({ start: $('.start').value, end: $('.end').value, ev: a.ev, mode: a.mode })); } catch (e) {}
    if (!inst || !a.start || !a.end || !a.ev) { alert('依頼シート・開始・終了・イベントコードを入れてください'); return; }
    var dry = $('.dry').checked;
    if (STG && $('.now') && $('.now').checked && !(force && st.a)) {
      var nn = new Date(Date.now() + 9 * 3600000 + 2 * 60000); a.start = nn.toISOString().slice(0, 16).replace(/-/g, '/').replace('T', ' ');
      if (a.end <= a.start) { alert('stgで開始を今にすると、終了が開始より前になります。終了を後ろにしてください'); return; }
      log('stg：開始を今（' + a.start + '）にして作る');
    }
    if (force && st.a) a = st.a; st.a = a;
    if (a.end <= a.start) { alert('終了が開始より前です'); return; }
    if (force) { $('.go').textContent = '全部やる'; $('.go').onclick = function () { run(false); }; }
    try {
      $('.go').disabled = true;
      if (!force || !st.files) {
        if (!window.XLSX) await loadScript(XLSXJS);
        var wb = XLSX.read(await inst.arrayBuffer(), { type: 'array', cellDates: true }), instRows, extraNeed = [];
        st.per = {};
        if (wb.Sheets['商品']) {
          var rq = await requestRows(wb); instRows = rq.rows; st.per = rq.per;
          log('依頼シート: ' + (instRows.length - 1) + '商品' + (rq.missing.length ? '／BOに無い商品コード ' + rq.missing.length + '件: ' + rq.missing.slice(0, 10).join(', ') : ''));
          if (rq.missing.length) extraNeed.push('・BOに無い商品コード ' + rq.missing.length + '件（この商品は入らない）: ' + rq.missing.slice(0, 15).join(', '));
        } else { instRows = wsRows(wb.Sheets[wb.SheetNames[0]]); log('指示書（今の形）を読み込み'); }
        // 購入グループ（全体＋行ごと）
        var g0 = $('.grp').value, targets = {}, badg = [];
        var hiI = instRows.findIndex(function (r) { return r && r.some(function (v) { return cellStr(v) === 'イベントページ'; }); });
        var ipI = hiI >= 0 ? instRows[hiI].map(cellStr).indexOf('イベントページ') : -1;
        var SALEW = /セール|スペシャル|フェア|感謝祭|バザー|記念/; // 全体の購入グループはフェア（セール側）の行だけ。新作・定番などには付けない
        instRows.slice(hiI + 1).forEach(function (r) {
          if (!r || !r[0]) return;
          var want = st.per[r[0]] != null ? groupCode(st.per[r[0]]) : (ipI >= 0 && SALEW.test(cellStr(r[ipI])) ? g0 : '');
          if (want === null) badg.push(r[0] + '（' + st.per[r[0]] + '）'); else if (want) targets[r[0]] = want;
        });
        if (badg.length) extraNeed.push('・購入グループが分からない ' + badg.length + '件: ' + badg.slice(0, 10).join(', '));
        st.targets = targets;
        if (Object.keys(targets).length) log('購入グループを付ける商品 ' + Object.keys(targets).length + '件（' + ($('.gwhen').value === 'start' ? '開始時刻' : '前日すぐ') + '）');
        state('1/6 いまの商品価格をエクスポート中…');
        var price = await exportPrice(); st.price = price;
        log('いまの商品価格 ' + (rowsOf(price).length - 1) + '行を取得');
        state('2/6 フェアパックを作成中…');
        st.evplan = await planEvent(a);
        if (st.evplan.warn) extraNeed.push('・' + st.evplan.warn);
        log(st.evplan.exists ? 'イベント ' + a.ev + ' はBOにある' : 'イベント ' + a.ev + ' は無いので作る（ひな形 ' + st.evplan.tpl + '・' + a.start + '〜' + a.end + '）');
        var pk = await makePack(instRows, price, a);
        st.files = pk.files; st.summary = pk.summary;
        log('フェアパック: ' + JSON.stringify(pk.summary));
        var codes = {};
        ['11_', '12_', '13_'].forEach(function (p) { var f = file(p); if (f) rowsOf(f.bytes).slice(1).forEach(function (r) { codes[r[0]] = 1; }); });
        st.restore = makeRestore(price, codes);
        log('戻し用CSV（取込前の価格）' + (st.restore.length - 1) + '行を用意');
        var need = pk.summary['要確認'] || [];
        if ((need.length || extraNeed.length) && !force) {
          var ck = rowsOf(file('90_').bytes, 'utf-8').filter(function (r) { return r[0] && need.indexOf(r[0]) >= 0; });
          state('3/6 要確認があるので止めた（下を読んで「このまま進める」）');
          log('要確認:\n' + extraNeed.concat(ck.map(function (r) { return '・' + r[0] + ' ' + r[1] + ' → ' + r[2] + '（放置すると: ' + r[3] + '）' + (r[4] ? ' 例: ' + String(r[4]).slice(0, 80) : ''); })).join('\n'));
          $('.go').textContent = 'このまま進める'; $('.go').onclick = function () { run(true); };
          return;
        }
      }
      if (dry) { state('作るだけ：ここまで（取り込んでいない）。「ファイルを保存」で中身を確認できる'); return; }
      var ng = Object.keys(st.targets || {}).length;
      if (!confirm((STG ? '【stg】' : '【本番】') + '取り込みます。\n' + (st.evplan && !st.evplan.exists ? 'イベント新設 ' + a.ev + '（' + a.start + '〜' + a.end + '）\n' : '') + 'イベント商品 ' + nrows(file('10_')) + '行 → 商品価格 ' + nrows(file('11_')) + '行' +
          (ng ? '\n購入グループ ' + ng + '商品（' + ($('.gwhen').value === 'start' ? '開始時刻' : 'すぐ') + '）' : '') + '\n予約 ' + nrows(file('12_')) + '行（開始）・' + nrows(file('13_')) + '行（' + (a.mode === 'gap' ? '翌朝' : '終了') + '）')) { state('取り消した'); return; }
      if (st.evplan && !st.evplan.exists) {
        state('4/6 イベントを新設中…');
        var r0 = await importFile('/import/imp_event.aspx', 'tmpevent', 'イベント新設_' + a.ev + '.csv', await toCp932([st.evplan.head, st.evplan.row]));
        log((r0.ok ? '✅' : '⚠') + ' イベント新設: ' + r0.msg.slice(0, 160));
        if (!r0.ok) { state('⚠ イベント新設で止めた（ログを確認）'); return; }
        st.evplan.exists = true;
      }
      state('4/6 イベント商品を取込中…');
      var r1 = await importFile('/import/imp_event.aspx', 'tmpeventgoods', file('10_').name, file('10_').bytes);
      log((r1.ok ? '✅' : '⚠') + ' イベント商品: ' + r1.msg.slice(0, 160));
      if (!r1.ok) { state('⚠ イベント商品の取込で止めた（ログを確認）'); return; }
      var f11 = file('11_');
      if (nrows(f11)) {
        state('4/6 商品価格（前日分）を取込中…');
        var r2 = await importFile('/import/imp_goods.aspx', 'tmpgoodsprice', f11.name, f11.bytes);
        log((r2.ok ? '✅' : '⚠') + ' 商品価格: ' + r2.msg.slice(0, 160));
        if (!r2.ok) { state('⚠ 商品価格の取込で止めた（ログを確認）'); return; }
        state('5/6 反映を照合中…（1分待つ）');
        await new Promise(function (ok) { setTimeout(ok, window.__sis1Wait || 60000); });
        var bad = await verify(f11);
        log(bad.length ? '⚠ 反映されていない ' + bad.length + '件: ' + bad.slice(0, 8).join(' / ') : '✅ 商品価格 ' + nrows(f11) + '行 全件反映を確認');
      } else log('商品価格（前日分）は0行');
      var gStart = false;
      if (ng) {
        state('5/6 購入グループを準備中…');
        var gf = await groupFile(a.ev, st.targets);
        if (gf.miss.length) log('⚠ 購入グループ：セールコメントに見つからない ' + gf.miss.length + '件: ' + gf.miss.slice(0, 8).join(', '));
        st.groupRestore = gf.before;
        if (gf.after.length > 1) {
          var gb = { name: '購入グループ_' + a.ev + '.csv', bytes: await toCp932(gf.after) };
          if ($('.gwhen').value === 'start') { scheduleAt(a.start, gb, '購入グループ（' + (gf.after.length - 1) + '商品）', 'tmpgoodscustom3', groupCheck(a.ev, st.targets)); gStart = true; }
          else {
            var r3 = await importFile('/import/imp_goods.aspx', 'tmpgoodscustom3', gb.name, gb.bytes);
            log((r3.ok ? '✅' : '⚠') + ' 購入グループ: ' + r3.msg.slice(0, 160));
            await new Promise(function (ok) { setTimeout(ok, window.__sis1Wait || 60000); });
            var bg = await groupCheck(a.ev, st.targets)();
            log(bg.length ? '⚠ 購入グループが反映されていない ' + bg.length + '件: ' + bg.slice(0, 6).join(' / ') : '✅ 購入グループ ' + (gf.after.length - 1) + '商品 反映を確認');
          }
        } else log('購入グループはすでに指定どおり（変更0件）');
      }
      var f12 = file('12_'), f13 = file('13_');
      if (nrows(f12) || nrows(f13) || gStart) {
        state('6/6 予約中：このタブを閉じない・Macを開けたまま');
        if (nrows(f12)) scheduleAt(a.start, f12, '開始分（12）');
        if (nrows(f13)) scheduleAt(rowsOf(f13.bytes)[1][5], f13, a.mode === 'gap' ? '翌朝分（13）' : '終了分（13）');
        st.keep = setInterval(keepAlive, 4 * 60 * 1000); wake();
        document.title = '⏰ ' + document.title;
      } else state('完了（予約なし。開始・終了は自動で切り替わる）');
    } catch (e) { log('⚠ ' + e.message); state('⚠ 止まった: ' + e.message); }
    finally { $('.go').disabled = false; }
  }
  $('.go').onclick = function () { run(false); };
  $('.dl').onclick = function () {
    if (!st.files) { alert('まだ作っていません'); return; }
    var all = Object.keys(st.files).map(function (k) { return [k, st.files[k]]; });
    var go = function () { all.forEach(function (kv, i) { setTimeout(function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([kv[1]])); a.download = kv[0]; a.click(); }, i * 400); }); };
    if (st.restore) toCp932(st.restore).then(function (b) { all.push(['戻し用_取込前の商品価格.csv', b]); go(); }); else go();
  };
  $('.undo').onclick = async function () {
    if (!st.restore) { alert('戻し用のデータがありません（このタブで「全部やる」を実行したあとに使えます）'); return; }
    if (!confirm('商品価格' + (st.groupRestore && st.groupRestore.length > 1 ? '・購入グループ' : '') + 'を取込前に戻します（' + (st.restore.length - 1) + '行）。予約も取り消します。')) return;
    stopTimers();
    var b = await toCp932(st.restore);
    var r = await importFile('/import/imp_goods.aspx', 'tmpgoodsprice', '戻し_取込前の商品価格.csv', b);
    log((r.ok ? '✅' : '⚠') + ' 元に戻す: ' + r.msg.slice(0, 160) + '（イベント商品は追加・更新のみのため、外す場合はイベント画面で）');
    if (st.groupRestore && st.groupRestore.length > 1) {
      var r4 = await importFile('/import/imp_goods.aspx', 'tmpgoodscustom3', '戻し_購入グループ.csv', await toCp932(st.groupRestore));
      log((r4.ok ? '✅' : '⚠') + ' 元に戻す（購入グループ）: ' + r4.msg.slice(0, 120));
    }
  };
  $('.clean').onclick = async function () { // フェア後：このフェアの商品で、指定の購入グループのものを「通常商品」に戻す
    var ev = $('.ev').value.trim(), g = $('.grp').value;
    if (!ev || !g) { alert('イベントコードと、戻したい購入グループを選んでください'); return; }
    try {
      state('片付け：セールコメントをエクスポート中…');
      var rows = rowsOf(await exportTable('tmpgoodscustom3', { event: ev })), head = rows[0], gi = head.indexOf('購入グループ');
      var NORMAL = Object.keys(st.groups).filter(function (c) { return /通常/.test(st.groups[c]); })[0] || '99999999';
      var after = [head], targets = {};
      rows.slice(1).forEach(function (r) { if (r[0] && String(r[gi]) === g) { var n = r.slice(); n[gi] = NORMAL; after.push(n); targets[r[0]] = NORMAL; } });
      if (after.length < 2) { state('片付け：戻す商品はありません'); return; }
      if (!confirm((STG ? '【stg】' : '【本番】') + 'イベント ' + ev + ' の商品のうち、購入グループ ' + g + ' の ' + (after.length - 1) + '商品を「' + NORMAL + ' ' + (st.groups[NORMAL] || '') + '」に戻します。')) return;
      var r = await importFile('/import/imp_goods.aspx', 'tmpgoodscustom3', '片付け_購入グループ_' + ev + '.csv', await toCp932(after));
      log((r.ok ? '✅' : '⚠') + ' 片付け（購入グループ）: ' + r.msg.slice(0, 160));
      await new Promise(function (ok) { setTimeout(ok, window.__sis1Wait || 60000); });
      var bad = await groupCheck(ev, targets)();
      log(bad.length ? '⚠ 戻っていない ' + bad.length + '件' : '✅ ' + (after.length - 1) + '商品を通常商品に戻したことを確認');
      state('片付け完了');
    } catch (e) { log('⚠ ' + e.message); state('⚠ 止まった: ' + e.message); }
  };
  $('.inst').onchange = async function () { // 依頼シートの「設定」タブから開始・終了などを入れる
    try {
      if (!window.XLSX) await loadScript(XLSXJS);
      var wb = XLSX.read(await this.files[0].arrayBuffer(), { type: 'array', cellDates: true });
      if (!wb.Sheets['設定']) return;
      var S = readSettings(wb); var pick = function (re) { var k = Object.keys(S).filter(function (x) { return re.test(x); })[0]; return k ? S[k] : ''; };
      var v;
      if ((v = toLocal(pick(/^開始/)))) $('.start').value = v;
      if ((v = toLocal(pick(/^終了/)))) $('.end').value = v;
      if ((v = cellStr(pick(/イベントコード/)))) $('.ev').value = v;
      st.settings = { name: pick(/フェア名|イベント名/), tpl: pick(/ひな形/) };
      v = cellStr(pick(/^購入グループ$/)); if (v) { var gc = groupCode(v); if (gc) $('.grp').value = gc; else log('⚠ 設定の購入グループ「' + v + '」がマスタに無い'); }
      v = cellStr(pick(/入れる時/)); if (/開始/.test(v)) $('.gwhen').value = 'start';
      log('依頼シートの「設定」を読み込んだ：' + Object.keys(S).map(function (k) { return k + '=' + cellStr(S[k]); }).join(' / '));
    } catch (e) { log('⚠ 依頼シートを読めない: ' + e.message); }
  };
  loadGroups();
  window.__sis1 = { show: function () { box.style.display = 'block'; }, st: st, run: run };
})();
