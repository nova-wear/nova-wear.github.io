"""Збирає garments.js з мокапів виробника.

Запуск: python3 tools/build-garments.py <шлях до Vyshyvka/images> <шлях до Vyshyvka/catalog-base.js>
Кладе оброблені фото в images/g/ (білий фон, ширина ≤ 720px) і пише garments.js:
для кожного виробу — кольори (назва, hex) і межі виробу на кожному фото (у %),
від яких конструктор рахує, де стоїть дизайн.
"""
import sys, os, glob, json, re
from PIL import Image, ImageDraw
import numpy as np

SRC, CATALOG = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(ROOT, 'images', 'g')
os.makedirs(DST, exist_ok=True)

VIEWS = {'teeover': ['front', 'back'], 'tee': ['front', 'back'], 'hoodieover': ['front', 'back'],
         'hoodieoverfleece': ['front', 'back'], 'hoodie': ['front', 'back'], 'hoodiezip': ['front', 'back'],
         'sweat': ['front', 'back'], 'cap': ['front', 'left'], 'tote': ['front']}
# У мокапах виробника для цих позицій «зад» — копія «переду» або інша модель, тому їх не беремо.
VIEWS['hoodiezip'] = ['front']
STUDIO = 243
SKIP = {('tee', 'orange'), ('tee', 'plum'), ('tee', 'wine'), ('tee', 'yellow'), ('hoodie', 'chocolate')}

src = open(CATALOG, encoding='utf-8').read()
base = json.loads(src[src.index('{'):src.rindex('}') + 1])
names = {g['id']: g['name'] for g in base['garments']}
colors = base['colors']

out = {}
for prod, views in VIEWS.items():
    cols = []
    for c in colors.get(prod, []):
        if (prod, c['id']) in SKIP:
            continue
        shots = {}
        for v in views:
            f = f'{SRC}/{prod}-{c["id"]}-{v}.webp'
            if not os.path.exists(f):
                break
            im = Image.open(f).convert('RGB')
            if im.width > 720:
                im = im.resize((720, round(im.height * 720 / im.width)), Image.LANCZOS)
            # Фон до білого «рівнями»: колір фону → 255, тіні лишаються мʼякими.
            # (Заливка з кутів зʼїдала білі вироби разом із фоном.)
            a = np.asarray(im).astype(float)
            corners = np.array([a[2, 2], a[2, -3], a[-3, 2], a[-3, -3]])
            bg = np.median(corners, axis=0)
            # Фон стає рівним світло-сірим STUDIO (такий самий фон у .garment у CSS),
            # щоб білі вироби не зливались зі сторінкою.
            if bg.min() > 200:
                a = np.clip(a * (STUDIO / bg), 0, 255)
                im = Image.fromarray(a.astype('uint8'))
            a = np.asarray(im).astype(int)
            ys, xs = np.where(np.abs(a - STUDIO).max(axis=2) > 14)
            x0, x1 = np.percentile(xs, [0.3, 99.7]); y0, y1 = np.percentile(ys, [0.3, 99.7])
            im.save(f'{DST}/{prod}-{c["id"]}-{v}.webp', 'WEBP', quality=82, method=6)
            shots[v] = [im.width, im.height, round(x0 / im.width * 100, 2), round(y0 / im.height * 100, 2),
                        round((x1 - x0) / im.width * 100, 2), round((y1 - y0) / im.height * 100, 2)]
            if v == 'front':
                # Справжній колір виробу — з фото (у каталозі hex місцями інший).
                h, w = a.shape[:2]
                patch = a[int(h * .42):int(h * .58), int(w * .42):int(w * .58)].reshape(-1, 3)
                hexv = '#%02x%02x%02x' % tuple(int(x) for x in np.median(patch, axis=0))
        if len(shots) == len(views):
            cols.append({'id': c['id'], 'name': c['name'], 'hex': hexv, 'shots': shots})
    # Світлий виріб на білому фоні дає неточні межі — беремо межі з темного кольору того ж мокапа.
    def lum(hx):
        return sum(int(hx[i:i + 2], 16) for i in (1, 3, 5)) / 765
    for c in cols:
        if lum(c['hex']) < 0.8:
            continue
        for v, sh in c['shots'].items():
            ref = [d for d in cols if lum(d['hex']) < 0.5 and d['shots'][v][:2] == sh[:2]]
            if ref:
                c['shots'][v] = sh[:2] + ref[0]['shots'][v][2:]
    out[prod] = {'name': names[prod], 'colors': cols}

with open(os.path.join(ROOT, 'garments.js'), 'w', encoding='utf-8') as fh:
    fh.write('/* Створено tools/build-garments.py. Руками не правити. */\n')
    fh.write('window.GARMENTS = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
print({k: len(v['colors']) for k, v in out.items()})
