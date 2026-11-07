"""Compare interior color transitions with the previous shipped boss art; no image mutation.

This is an art-QA signal, not a substitute for judging the silhouettes in gameplay.
"""
from pathlib import Path
from io import BytesIO
import json
import subprocess
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BASELINE = 'b009d7b'
manifest = json.loads((ROOT / 'packages/client/src/art/boss-manifest.json').read_text())

def detail(raw):
    a = np.asarray(Image.open(BytesIO(raw)).convert('RGBA'))
    rgb = a[:, :, :3].astype(int)
    mask = a[:, :, 3] == 255
    interior = mask[2:-2, 2:-2].copy()
    for dy, dx in [(0, 2), (0, -2), (2, 0), (-2, 0)]:
        interior &= mask[2+dy:mask.shape[0]-2+dy, 2+dx:mask.shape[1]-2+dx]
    centre = rgb[2:-2, 2:-2]
    changes = (np.abs(centre-rgb[2:-2, 4:]).sum(axis=2) > 40) | (np.abs(centre-rgb[4:, 2:-2]).sum(axis=2) > 40)
    return {'interiorTransitionFraction': round(float(changes[interior].mean()), 4),
            'colors': len(np.unique(rgb[mask], axis=0)), 'encodedBytes': len(raw)}

rows = []
for boss in manifest['atlases']:
    path = f'packages/client/public/art/bestiary/{boss}-day.png'
    before = detail(subprocess.check_output(['git', 'show', f'{BASELINE}:{path}'], cwd=ROOT))
    after = detail((ROOT / path).read_bytes())
    rows.append({'boss': boss, 'before': before, 'after': after,
                 'textureTransitionReductionPercent': round(100*(1-after['interiorTransitionFraction']/before['interiorTransitionFraction']), 1)})
report = {'baseline': BASELINE, 'metric': 'Fraction of opaque interior pixels with a neighboring two-pixel-grid color change >40 RGB Manhattan units. Excludes silhouette edges. Lower means quieter surfaces; it does not measure animation quality.', 'bosses': rows}
out = ROOT / 'docs/validation/cozy-boss-redraw/detail.json'
out.write_text(json.dumps(report, indent=2) + '\n')
print(f'Quieter interior textures: {sum(r["textureTransitionReductionPercent"]>0 for r in rows)}/{len(rows)} bosses')
print('Reduction range:', min(r['textureTransitionReductionPercent'] for r in rows), max(r['textureTransitionReductionPercent'] for r in rows))
