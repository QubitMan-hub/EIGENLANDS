"""Prepare the authored sword-and-shield sculpture, preserving the existing plaza anchor."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
source = ROOT / 'art-source/directional-people/qubitman-statue.png'
image = np.array(Image.open(source).convert('RGBA'))
mask = image[:, :, 3] >= 220
labels, count = ndimage.label(mask)
sizes = np.bincount(labels.ravel()); sizes[0] = 0
mask = labels == int(sizes.argmax())
image[:, :, 3] = mask * 255
image[~mask, :3] = 0
crop = Image.fromarray(image)
bounds = crop.getbbox(); crop = crop.crop(bounds)
scale = 144 / crop.height
crop = crop.resize((round(crop.width * scale), 144), Image.Resampling.NEAREST)
alpha = np.array(crop.getchannel('A'))
foot_x = np.where(alpha[-12:] > 0)[1]
centre = round(float((foot_x.min() + foot_x.max()) / 2))
canvas = Image.new('RGBA', (108, 160))
canvas.alpha_composite(crop, (52 - centre, 6))
a = np.array(canvas)
q = canvas.convert('RGB').quantize(colors=128, method=Image.Quantize.MEDIANCUT)
pal = q.getpalette(); px = np.array(q).astype(int) + 1; px[a[:, :, 3] == 0] = 0
palette = [0] + [(pal[i*3]<<16)|(pal[i*3+1]<<8)|pal[i*3+2] for i in range(128)]
runs = []; last = None; n = 0
for value in px.ravel().tolist():
    if value == last: n += 1
    else:
        if n: runs.extend([n, last])
        last, n = value, 1
runs.extend([n, last])
data = {'w': 108, 'h': 160, 'ax': 52, 'ay': 144, 'palette': palette, 'runs': runs,
        'sourceHash': hashlib.sha256(source.read_bytes()).hexdigest(), 'sourceBounds': bounds}
(ROOT / 'packages/client/src/art/qubitman-statue.json').write_text(json.dumps(data, separators=(',', ':')) + '\n')
clean = q.convert('RGBA'); clean.putalpha(canvas.getchannel('A'))
out = ROOT / 'packages/client/public/art/people/qubitman-statue.png'; clean.save(out)
clean.resize((324,480),Image.Resampling.NEAREST).save(ROOT / 'docs/validation/directional-people/qubitman-statue.png')
print('Prepared grounded QubitMan: authored sword, shield, tricorn and scarf')
