"""Дочищає фото виробів у images/g після build-garments.py:
- фон, звʼязаний з краєм кадру, вирівнюється до рівного STUDIO (прибирає теплі/світлі плями й ореоли);
- у шопера заливається фоном просвіт між ручками (у мокапі там лишилась сіра пляма).
Запуск: python3 tools/clean-photos.py"""
import glob
import os
from collections import deque

import numpy as np
from PIL import Image

STUDIO = 243
ROOT = os.path.join(os.path.dirname(__file__), '..', 'images', 'g')


def flood(mask, seeds):
    """Звʼязна область mask, досяжна з seeds (4-сусідство)."""
    h, w = mask.shape
    out = np.zeros_like(mask)
    q = deque()
    for y, x in seeds:
        if mask[y, x] and not out[y, x]:
            out[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((ny, nx))
    return out


def soften(a, region):
    """Заливає region фоном, край на 1 px змішується з виробом."""
    a[region] = STUDIO
    pad = np.pad(region, 1)
    ring = (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]) & ~region
    a[ring] = (a[ring] + STUDIO) / 2


def clean(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(float)
    h, w, _ = a.shape
    sat = a.max(axis=2) - a.min(axis=2)
    lum = a.mean(axis=2)
    # Світлий нейтральний фон (включно з ореолами світліше за STUDIO) від краю кадру.
    bgish = (sat < 10) & (lum > STUDIO - 9)
    border = [(y, x) for y in (0, h - 1) for x in range(w)] + [(y, x) for x in (0, w - 1) for y in range(h)]
    bg = flood(bgish, border)
    soften(a, bg)
    if os.path.basename(path).startswith('tote-'):
        # Просвіт між ручками: над корпусом сумки, по центру.
        rows = np.where((np.abs(a - STUDIO).max(axis=2) > 14).sum(axis=1) > w * 0.35)[0]
        top = rows[0] if len(rows) else h // 2
        cx = w // 2
        y0 = max(1, top - 12)
        seed = a[y0, cx]
        near = (np.abs(a - seed).max(axis=2) < 14) & (sat < 16)
        near[top:, :] = False
        gap = flood(near, [(y0, cx)])
        if gap.sum() < h * w * 0.08:
            soften(a, gap)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(path, 'WEBP', quality=86, method=6)


def light_colors():
    """Світлі вироби (білий, молочний…) зливаються з фоном — їх не чіпаємо."""
    import json, re
    src = open(os.path.join(ROOT, '..', '..', 'garments.js'), encoding='utf-8').read()
    g = json.loads(re.search(r'window.GARMENTS = (\{.*\});', src, re.S).group(1))
    out = set()
    for prod, d in g.items():
        for c in d['colors']:
            h = c['hex'].lstrip('#')
            if min(int(h[i:i + 2], 16) for i in (0, 2, 4)) > 200:
                out.add(prod + '-' + c['id'] + '-')
    return out


if __name__ == '__main__':
    light = light_colors()
    for p in sorted(glob.glob(os.path.join(ROOT, '*.webp'))):
        if not any(os.path.basename(p).startswith(k) for k in light):
            clean(p)
    print('ok')
