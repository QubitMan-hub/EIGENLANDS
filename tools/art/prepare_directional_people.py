"""Normalize the cohesive authored turnarounds; never rotate a completed front sprite.

Pillow + NumPy + SciPy. One scale per character, binary alpha, fixed foot anchor.
Original generated sheets remain under art-source/directional-people.
"""
from pathlib import Path
import hashlib
import json

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'packages/client/public/art/people'
OUT.mkdir(parents=True, exist_ok=True)
REVIEW = ROOT / 'docs/validation/directional-people'
REVIEW.mkdir(parents=True, exist_ok=True)
CW, CH, AX, AY = 64, 64, 32, 61
frames = {}
sources = []
board = Image.new('RGBA', (8 * CW * 3, 6 * CH * 3), (64, 80, 80, 255))

for family_index, family in enumerate(['heroes', 'commoners', 'robes']):
    source = ROOT / f'art-source/directional-people/{family}.png'
    image = Image.open(source).convert('RGBA')
    sources.append({'file': str(source.relative_to(ROOT)), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
    for body_index, body in enumerate(['male', 'female']):
        crops = []
        for direction in range(8):
            row = body_index * 2 + direction // 4
            col = direction % 4
            region = (round(col * image.width / 4), round(row * image.height / 4),
                      round((col + 1) * image.width / 4), round((row + 1) * image.height / 4))
            pixels = np.array(image.crop(region))
            mask = pixels[:, :, 3] >= 220
            r, g, b = [pixels[:, :, n].astype(int) for n in range(3)]
            # Discard saturated export fringes, never internal fabric/hair details.
            boundary = mask & ~ndimage.binary_erosion(mask)
            mask &= ~(boundary & (((r > 230) & (g < 55) & (b < 75)) | ((g > 160) & (r < 100) & (b < 80))))
            labels, count = ndimage.label(mask)
            sizes = np.bincount(labels.ravel()); sizes[0] = 0
            main = labels == int(sizes.argmax())
            mask &= ndimage.binary_dilation(main, iterations=2)
            pixels[:, :, 3] = mask * 255
            pixels[~mask, :3] = 0
            clean = Image.fromarray(pixels)
            bounds = clean.getbbox()
            assert bounds and bounds[1] > 0 and bounds[3] < clean.height, (family, body, direction, bounds)
            crops.append((clean.crop(bounds), region, bounds))
        # Shared scale: rotations never change the actor's pixel density.
        scale = 44 / crops[0][0].height
        key = f'{family}-{body}'
        frames[key] = []
        for direction, (crop, region, bounds) in enumerate(crops):
            w, h = round(crop.width * scale), round(crop.height * scale)
            assert w < CW - 4 and h < CH - 4, (key, direction, w, h)
            crop = crop.resize((w, h), Image.Resampling.NEAREST)
            canvas = Image.new('RGBA', (CW, CH))
            # Foot centres in the lowest third, avoiding a ponytail's visual centre.
            alpha = np.array(crop.getchannel('A'))
            foot_x = np.where(alpha[-8:] > 0)[1]
            centre = round(float((foot_x.min() + foot_x.max()) / 2)) if len(foot_x) else w // 2
            canvas.alpha_composite(crop, (AX - centre, AY + 2 - h))
            a = np.array(canvas)
            q = canvas.convert('RGB').quantize(colors=96, method=Image.Quantize.MEDIANCUT)
            palette = q.getpalette()
            indices = np.array(q).astype(int) + 1
            indices[a[:, :, 3] == 0] = 0
            colors = [0] + [(palette[k * 3] << 16) | (palette[k * 3 + 1] << 8) | palette[k * 3 + 2] for k in range(96)]
            runs = []
            last, length = None, 0
            for value in indices.ravel().tolist():
                if value == last:
                    length += 1
                else:
                    if length: runs.extend([length, last])
                    last, length = value, 1
            runs.extend([length, last])
            frame = {'w': CW, 'h': CH, 'ax': AX, 'ay': AY, 'palette': colors, 'runs': runs,
                     'sourceRegion': region, 'sourceBounds': bounds}
            frames[key].append(frame)
            clean = q.convert('RGBA'); clean.putalpha(canvas.getchannel('A'))
            a = np.array(clean); a[a[:, :, 3] == 0] = 0; clean = Image.fromarray(a)
            clean.save(OUT / f'{key}-{direction}.png')
            board.alpha_composite(clean.resize((CW * 3, CH * 3), Image.Resampling.NEAREST), (direction * CW * 3, (family_index * 2 + body_index) * CH * 3))

(ROOT / 'packages/client/src/art/directional-people.json').write_text(json.dumps({'sources': sources, 'frames': frames}, separators=(',', ':')) + '\n')
board.save(REVIEW / 'turnarounds.png')
(REVIEW / 'source-manifest.json').write_text(json.dumps(sources, indent=2) + '\n')
print(f'Prepared {sum(map(len, frames.values()))} distinct directional source frames')
