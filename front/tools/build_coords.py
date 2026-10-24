"""スタッフコーデ索引を作る（コーデまとめ買い用）
本番の「スタッフおすすめコーデ一覧」（/shop/pages/0903code-top.aspx）から、
公開中（コメントアウトされていない）コーデページを集め、各ページに載っている商品コードを抜き出して
front/data/coords.json に書く。商品名・価格・在庫は表示時にその場で店舗から読むので、ここには持たない。
使い方: python3 front/tools/build_coords.py
"""
import json, re, sys, urllib.request, datetime, os
BASE = 'https://drugstores-shop.com'
def get(u):
    req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0 sis-coords'})
    return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'ignore')
top = get(BASE + '/shop/pages/0903code-top.aspx')
top = re.sub(r'<!--.*?-->', '', top, flags=re.S)  # 非公開（コメントアウト）分を除く
coords = []
for m in re.finditer(r'<div class="coord-item">\s*<a href="([^"]+)">\s*<img src="([^"]+)">\s*</a>\s*<p class="coord-name">([^<]*)</p>', top):
    page, img, label = m.group(1), m.group(2), m.group(3).strip()
    try:
        h = get(page)
    except Exception as e:
        print('skip', page, e, file=sys.stderr); continue
    h = re.sub(r'<!--.*?-->', '', h, flags=re.S)
    main = h[h.find('<main'):] if '<main' in h else h
    codes = []
    for c in re.findall(r'/shop/g/g([0-9A-Za-z-]+)/', main):
        if c not in codes: codes.append(c)
    if len(codes) < 2: continue
    coords.append({'page': page.replace(BASE, ''), 'img': img, 'label': label, 'goods': codes})
out = {'built': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'), 'source': BASE + '/shop/pages/0903code-top.aspx', 'coords': coords}
p = os.path.join(os.path.dirname(__file__), '..', 'data', 'coords.json')
json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(coords), 'coords')
