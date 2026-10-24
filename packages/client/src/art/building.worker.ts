import { DOMAdapter, WebWorkerAdapter, type Texture } from 'pixi.js';
import type {Building} from '@eigenlands/shared';
import {buildBuildingArt} from './buildings';
import type {PackedBuildingArt} from './building-transfer';
DOMAdapter.set(WebWorkerAdapter);
const scope=globalThis as unknown as {onmessage:(e:MessageEvent<{id:number;building:Building}>)=>void;postMessage:(m:unknown,t:Transferable[])=>void};
scope.onmessage=({data:{id,building}})=>{
 try{
  const art=buildBuildingArt(building),transfer:Transferable[]=[];
  const pack=(t:Texture):ImageBitmap=>{const image=(t.source.resource as OffscreenCanvas).transferToImageBitmap();transfer.push(image);t.destroy(true);return image;};
  const packed:PackedBuildingArt={...art,
   walls:art.walls.map(p=>({...p,day:pack(p.day),night:pack(p.night),cut:p.cut?pack(p.cut):null})),
   roof:{...art.roof,tex:pack(art.roof.tex),night:art.roof.night?pack(art.roof.night):null},
   shadow:{...art.shadow,tex:pack(art.shadow.tex)},sign:art.sign?{...art.sign,tex:pack(art.sign.tex)}:null,
  };
  scope.postMessage({id,art:packed},transfer);
 }catch(e){scope.postMessage({id,error:String(e)},[]);}
};
