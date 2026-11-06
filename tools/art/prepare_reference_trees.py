"""Slice measured catalog bounds, remove matte fringe, preserve anchors; no inferred uniform atlas cells."""
from pathlib import Path
import hashlib, json
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT = Path(__file__).resolve().parents[2]
source = ROOT / 'art-source/reference-pack/environment/trees.png'
im = Image.open(source).convert('RGBA')
# Measured catalog regions; the first row is taller, and broad crowns exceed nominal 4x4 cells.
xs = [0, 350, 625, 925, 1233]
ys = [0, 365, 675, 1005, 1275]
names = ['oak','birch','spruce','pine','apple','pear','cherry','willow','maple','red_oak','bare','snow_spruce','sapling','pine_sapling','stump','log']
heights = [96,104,100,98,82,84,88,92,94,94,96,100,45,46,18,30]
frames = {}
review = Image.new('RGBA', (640, 480), (202,207,198,255))
for i, name in enumerate(names):
    col, row = i % 4, i // 4
    box = (xs[col], ys[row], xs[col+1], ys[row+1])
    a = np.array(im.crop(box))
    mask = a[:,:,3] >= 220
    # Drop disconnected catalog dust without eroding legitimate silhouette details.
    labels, n = ndimage.label(mask)
    sizes = np.bincount(labels.ravel()); sizes[0] = 0
    main = labels == int(sizes.argmax())
    mask &= (sizes[labels] >= 12) & ndimage.binary_dilation(main, iterations=5)
    boundary = mask & ~ndimage.binary_erosion(mask)
    rgb = a[:,:,:3].astype(float)
    bright = rgb.max(axis=2); low = rgb.min(axis=2)
    spill = boundary & (bright > 110) & ((bright-low) > 100) & (low < 35)
    # Only remove saturated chroma along the exterior; preserve apples and foliage inside the crown.
    mask &= ~spill
    a[:,:,3] = np.where(mask,255,0)
    a[~mask,:3] = 0
    clean = Image.fromarray(a)
    bounds = clean.getbbox()
    if not bounds: raise ValueError(name)
    clean = clean.crop(bounds)
    w,h = clean.size
    H=heights[i]; W=round(w*H/h)
    clean = clean.resize((W,H), Image.Resampling.NEAREST)
    # Ground-contact root at centre of the bottom trunk band, not canopy midpoint.
    arr = np.array(clean); bottom = arr[-max(2,H//25):,:,3] > 0
    contacts = np.where(bottom)[1]
    ax = int(np.median(contacts)) if len(contacts) else W//2
    # Palette quantization is deterministic and keeps each sprite's original material colours.
    quant = clean.convert('RGB').quantize(colors=48, method=Image.Quantize.MEDIANCUT)
    palette = quant.getpalette(); pixels=np.array(quant).astype(int)+1; pixels[arr[:,:,3]==0]=0
    colors = [0] + [(palette[k*3]<<16)|(palette[k*3+1]<<8)|palette[k*3+2] for k in range(48)]
    runs=[]; last=None; count=0
    for p in pixels.ravel().tolist():
        if p==last: count+=1
        else:
            if count: runs.extend([count,last])
            last=p; count=1
    runs.extend([count,last])
    frames[name]={'w':W,'h':H,'ax':ax,'ay':H-1,'palette':colors,'runs':runs,'sourceBounds':box,'visibleBounds':bounds}
    clean = quant.convert('RGBA')
    clean.putalpha(Image.fromarray(arr[:,:,3]))
    clean.save(ROOT / f'packages/client/public/art/reference/{name}.png')
    review.alpha_composite(clean, (col*160+(160-W)//2,row*120+115-H))
manifest={'source':'environment/trees.png','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'frames':frames}
(ROOT/'packages/client/src/art/reference-trees.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
review.save(ROOT/'docs/validation/reference-tree-review.png')
