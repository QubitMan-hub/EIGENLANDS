"""Catalog alpha cleanup, measured content bounds and body-space colour/pattern recipes."""
from pathlib import Path
import json,re,hashlib
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
colors=re.findall(r"'(#\w{6})'",(ROOT/'packages/shared/src/palette.ts').read_text())
pal=np.array([[int(c[i:i+2],16) for i in (1,3,5)] for c in colors])
counts={'hair':50,'eyes':50,'mouths':50,'tops':50,'pants':55,'shorts':50,'boots':50}
out=ROOT/'packages/client/public/art/wardrobe';out.mkdir(parents=True,exist_ok=True)
result={}
for category,count in counts.items():
 source=ROOT/f'art-source/reference-pack/customization/{category}.png';im=Image.open(source).convert('RGBA');W,H=im.size;cols=count//5;records=[]
 for i in range(count):
  col,row=i%cols,i//cols;box=(round(col*W/cols),round(row*H/5),round((col+1)*W/cols),round((row+1)*H/5))
  a=np.array(im.crop(box));mask=a[:,:,3]>=210
  a[:,:,3]=np.where(mask,255,0);a[~mask]=0
  clean=Image.fromarray(a);bounds=clean.getbbox()
  if not bounds:raise ValueError((category,i))
  clean=clean.crop(bounds)
  # Transparent neck holes do not become peach fabric on a fitted top.
  a=np.array(clean)
  if category=='tops':
   y,x=np.indices(a.shape[:2]);skin=(a[:,:,0]>140)&(a[:,:,0]>a[:,:,1]*1.12)&(a[:,:,1]>a[:,:,2]*1.07)&(y<a.shape[0]*.28)&(x>a.shape[1]*.22)&(x<a.shape[1]*.78)
   a[skin]=0;clean=Image.fromarray(a)
  clean.save(out/f'{category}-{i+1:02}.png')
  pixels=a[a[:,:,3]>0,:3].astype(float)
  dist=((pixels[:,None,:]-pal[None,:,:])**2*np.array([2,4,1])).sum(2)
  mapped=dist.argmin(1);hist=np.bincount(mapped,minlength=len(pal));rank=np.argsort(hist)[::-1]
  useful=[int(c) for c in rank if hist[c]>0 and c not in [0,1]] or [3]
  shades=sorted(useful[:8],key=lambda c:pal[c].sum())
  ramp=[shades[min(len(shades)-1,round(t*(len(shades)-1)))] for t in [0,.33,.66,1]]
  # Fitted torso material is sampled from the centre, not the catalog sleeves/background.
  bw,bh=clean.size;region=clean.crop((round(bw*.23),round(bh*.22),round(bw*.77),round(bh*.92))).resize((8,8),Image.Resampling.NEAREST)
  m=np.array(region);d=((m[:,:,:3,None].transpose(0,1,3,2)-pal[None,None,:,:])**2*np.array([2,4,1])).sum(3);indices=d.argmin(2);indices[m[:,:,3]==0]=-1
  records.append({'id':i+1,'sourceBounds':box,'contentBounds':bounds,'ramp':ramp,'color':useful[0],'pattern':indices.ravel().tolist(),'aspect':round(bw/bh,3)})
 result[category]={'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'items':records}
(ROOT/'packages/client/src/art/wardrobe-catalog.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print('Prepared',sum(counts.values()),'catalog assets')
