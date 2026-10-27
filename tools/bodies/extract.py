"""
Body references -> game-scale role maps.

The reference sheets (assets/reference/characters/base-*-walk.webp) are upscaled, slightly blurred drafts: 8 rows
(S, SW, W, NW, N, NE, E, SE) x 8 walk frames of a bald base body in underwear. This reduces each frame to the game's
calibrated height (an adult man ~1.78 m = 29 px, a woman ~1.68 m = 28 px; see docs/CHARACTERS.md) and sorts every
pixel into a *role* (outline, skin shade 1-4, underwear shade 1-3, eye white, iris), so the game can recolour skin
and draw clothes over the same shapes.

  python3 tools/bodies/extract.py ascii   # print every frame as a role map (for review and hand cleanup)
  python3 tools/bodies/extract.py png out # a zoomed preview sheet

The game's heads (packages/client/src/art/body/heads.ts) were traced from these maps and then cleaned by hand.

Role characters: '.' empty, 'o' outline, '1'..'4' skin (dark..light), 'a'..'c' underwear (dark..light),
'w' eye white, 'e' iris / pupil.
"""
import sys
import colorsys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
REF = ROOT / 'assets/reference/characters'
DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']
SHEETS = {
    'male': ('base-male-walk.webp', 29),
    'female': ('base-female-walk.webp', 28),
}


def bands(mask):
    out, s = [], None
    for i, v in enumerate(mask):
        if v and s is None:
            s = i
        if not v and s is not None:
            out.append((s, i))
            s = None
    if s is not None:
        out.append((s, len(mask)))
    return out


def cells(img):
    a = np.array(img)[:, :, 3] > 40
    rows = [b for b in bands(a.any(1)) if b[1] - b[0] > 60]
    cols = [b for b in bands(a.any(0)) if b[1] - b[0] > 40]
    return rows, cols


def role(rgb, alpha):
    if alpha < 110:
        return '.'
    r, g, b = [c / 255 for c in rgb]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    if lum < 0.2:
        return 'o'
    if v > 0.86 and s < 0.18:
        return 'w'
    if s < 0.22:  # greys: the underwear
        return 'a' if lum < 0.32 else 'b' if lum < 0.42 else 'c'
    # warm: skin, by brightness
    if lum < 0.38:
        return '1'
    if lum < 0.5:
        return '2'
    if lum < 0.6:
        return '3'
    return '4'


def frame_map(img, box, height):
    x0, y0, x1, y1 = box
    cell = img.crop((x0 - 8, y0, x1 + 8, y1))
    k = height / (y1 - y0)
    w = max(1, round(cell.width * k))
    small = cell.resize((w, height), Image.BOX)
    a = np.array(small)
    rows = []
    for y in range(height):
        rows.append(''.join(role(a[y, x, :3], a[y, x, 3]) for x in range(w)))
    # trim empty columns
    used = [x for x in range(w) if any(r[x] != '.' for r in rows)]
    lo, hi = min(used), max(used)
    return [r[lo:hi + 1] for r in rows]


def all_maps():
    out = {}
    for body, (name, height) in SHEETS.items():
        img = Image.open(REF / name).convert('RGBA')
        rows, cols = cells(img)
        assert len(rows) == 8 and len(cols) == 8, (body, len(rows), len(cols))
        out[body] = [[frame_map(img, (c[0], r[0], c[1], r[1]), height) for c in cols] for r in rows]
    return out


if __name__ == '__main__':
    maps = all_maps()
    if sys.argv[1] == 'ascii':
        for body, dirs in maps.items():
            for d, frames in enumerate(dirs):
                for f, m in enumerate(frames):
                    print(f'== {body} {DIRS[d]} f{f} ({len(m[0])}x{len(m)})')
                    print('\n'.join(m))
    else:
        COL = {'.': (0, 0, 0, 0), 'o': (40, 26, 30, 255), '1': (150, 80, 60, 255), '2': (196, 112, 78, 255),
               '3': (224, 146, 100, 255), '4': (240, 180, 130, 255), 'a': (50, 52, 60, 255),
               'b': (78, 80, 90, 255), 'c': (110, 112, 122, 255), 'w': (240, 240, 240, 255), 'e': (30, 30, 60, 255)}
        sheet = Image.new('RGBA', (8 * 26 * 2, 8 * 32), (90, 122, 74, 255))
        for bi, (body, dirs) in enumerate(maps.items()):
            for d, frames in enumerate(dirs):
                for f, m in enumerate(frames):
                    for y, row in enumerate(m):
                        for x, ch in enumerate(row):
                            if ch != '.':
                                sheet.putpixel((bi * 8 * 26 + f * 26 + x, d * 32 + y), COL[ch])
        sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(sys.argv[2])
