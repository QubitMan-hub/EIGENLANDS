"""Fit stable material palettes before mapping generated source colors into the game's palette.

Nearby RGB values in an otherwise flat material must not straddle unrelated master-palette
Voronoi cells and become grey/tan/pink speckles. One small palette covers every pose/facing.
Raw authored sheets remain intact. Requires Pillow and NumPy.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
records = {}
for source in sorted((ROOT / 'art-source/bosses').glob('*.png')):
    a = np.asarray(Image.open(source).convert('RGBA'))
    colors = a[a[:, :, 3] >= 220, :3]
    assert len(colors), source
    image = Image.fromarray(colors.reshape((1, -1, 3)))
    fitted = image.quantize(colors=16, method=Image.Quantize.MEDIANCUT, kmeans=6)
    palette = fitted.getpalette()
    counts = dict((index, count) for count, index in fitted.getcolors())
    clusters = [(np.array(palette[i*3:i*3+3], dtype=float), counts.get(i, 0)) for i in range(16) if counts.get(i, 0)]
    # A flat source tone can get several nearly identical median-cut centers. Merge those
    # before matching the master palette so +/- a few RGB units cannot switch materials.
    while len(clusters) > 1:
        distance, i, j = min((float(np.linalg.norm(a[0]-b[0])), i, j)
                             for i, a in enumerate(clusters) for j, b in enumerate(clusters) if i < j)
        if distance >= 24:
            break
        a, wa = clusters[i]
        b, wb = clusters[j]
        clusters[i] = ((a*wa+b*wb)/(wa+wb), wa+wb)
        del clusters[j]
    centers = [np.rint(color).astype(int).tolist() for color, weight in clusters]
    records[source.stem] = {'sourceHash': hashlib.sha256(source.read_bytes()).hexdigest(), 'colors': centers}
(ROOT / 'art-source/bosses/material-palettes.json').write_text(json.dumps(records, indent=2) + '\n')
print(f'Prepared shared material palettes for {len(records)} boss sheets')
