"""Prepare measured catalog regions as binary-alpha, palette-indexed runtime assets."""
from pathlib import Path
import hashlib,json
import numpy as np
from scipy import ndimage
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'art-source/reference-pack/environment/rocks.png'
im=Image.open(source).convert('RGBA')
xs=[0,266,518,775,1032,1280,1536]; ys=[0,310,556,790,1024]
names=['stone','cluster','low_boulder','tall_boulder','granite','slate','moss','lichen','grass_rock','sandstone','red_strata','basalt','iron','copper','gold','coal','quartz','blue_gem','gravel','chipped','split','rubble','depleted','slab']
widths=[22,30,38,34,34,36,34,34,36,36,36,34,34,34,34,34,32,34,28,34,34,34,32,36]
frames={}; reviews=[Image.new('RGBA',(600,320),c) for c in [(202,207,198,255),(28,38,48,255)]]
out=ROOT/'packages/client/public/art/reference';out.mkdir(exist_ok=True,parents=True)
for i,name in enumerate(names):
 col,row=i%6,i//6; box=(xs[col],ys[row],xs[col+1],ys[row+1]);a=np.array(im.crop(box))
 mask=a[:,:,3]>=210
 labels,n=ndimage.label(mask);sizes=np.bincount(labels.ravel());sizes[0]=0
 main=labels==int(sizes.argmax())
 # Preserve the pebble apron, but remove detached export noise/adjacent catalog assets.
 mask &= (sizes[labels]>=6) & ndimage.binary_dilation(main,iterations=35)
 a[:,:,3]=np.where(mask,255,0);a[~mask,:3]=0
 clean=Image.fromarray(a);bounds=clean.getbbox();clean=clean.crop(bounds)
 w,h=clean.size;W=widths[i];H=round(h*W/w);clean=clean.resize((W,H),Image.Resampling.NEAREST)
 alpha=clean.getchannel('A');q=clean.convert('RGB').quantize(colors=48,method=Image.Quantize.MEDIANCUT)
 palette=q.getpalette();pixels=np.array(q).astype(int)+1;pixels[np.array(alpha)==0]=0
 colors=[0]+[(palette[k*3]<<16)|(palette[k*3+1]<<8)|palette[k*3+2] for k in range(48)]
 runs=[];last=None;count=0
 for px in pixels.ravel().tolist():
  if px==last:count+=1
  else:
   if count:runs.extend([count,last])
   last=px;count=1
 runs.extend([count,last])
 frames[name]={'w':W,'h':H,'ax':W//2,'ay':H-3,'palette':colors,'runs':runs,'sourceBounds':box,'visibleBounds':bounds}
 clean=q.convert('RGBA');clean.putalpha(alpha)
 clean_array=np.array(clean);clean_array[clean_array[:,:,3]==0]=0;clean=Image.fromarray(clean_array)
 clean.save(out/f'rock-{name}.png')
 for review in reviews:review.alpha_composite(clean,(col*100+(100-W)//2,row*80+70-H))
# Silver uses a prepared material variant of the same iron-veined source silhouette.
f=json.loads(json.dumps(frames['iron']));f['derivedFrom']='iron'
for i,c in enumerate(f['palette']):
 r,g,b=(c>>16)&255,(c>>8)&255,c&255
 if r>g*1.12 and r>b*1.1:
  t=round((r+g+b)/3);f['palette'][i]=(min(255,t+15)<<16)|(min(255,t+24)<<8)|min(255,t+34)
frames['silver']=f
silver=np.array(Image.open(out/'rock-iron.png'));original=silver.copy()
for old,new in zip(frames['iron']['palette'],f['palette']):
 mask=(original[:,:,0]==(old>>16&255))&(original[:,:,1]==(old>>8&255))&(original[:,:,2]==(old&255))&(silver[:,:,3]>0)
 silver[mask,:3]=[(new>>16)&255,(new>>8)&255,new&255]
Image.fromarray(silver).save(out/'rock-silver.png')
(ROOT/'packages/client/src/art/reference-rocks.json').write_text(json.dumps({'source':'environment/rocks.png','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'frames':frames},separators=(',',':'))+'\n')
for review,suffix in zip(reviews,['light','dark']):review.save(ROOT/f'docs/validation/reference-rocks-{suffix}.png')
