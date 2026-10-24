import {Texture} from 'pixi.js';
import type {Building} from '@eigenlands/shared';
import type {BuildingArt} from './buildings';
import type {PackedBuildingArt} from './building-transfer';
/** One cold building at a time. Unsupported/CSP-blocked workers retain the ordinary painter. */
export class BuildingArtWorker {
 private worker:Worker|null=null;
 private pending:((art:BuildingArt|null)=>void)|null=null;
 private id=0;
 private timer:ReturnType<typeof setTimeout>|null=null;
 constructor(){
  if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined')return;
  try{
   this.worker=new Worker(new URL('./building.worker.ts',import.meta.url),{type:'module'});
   this.worker.onmessage=({data}:{data:{id:number;art?:PackedBuildingArt;error?:string}})=>{
    if(data.id!==this.id)return;
    if(this.timer)clearTimeout(this.timer);this.timer=null;
    const resolve=this.pending;this.pending=null;
    if(!data.art){this.disable();resolve?.(null);return;}
    const texture=(bitmap:ImageBitmap)=>{const t=Texture.from(bitmap);t.source.scaleMode='nearest';return t;},a=data.art;
    resolve?.({...a,walls:a.walls.map(p=>({...p,day:texture(p.day),night:texture(p.night),cut:p.cut?texture(p.cut):null})),roof:{...a.roof,tex:texture(a.roof.tex),night:a.roof.night?texture(a.roof.night):null},shadow:{...a.shadow,tex:texture(a.shadow.tex)},sign:a.sign?{...a.sign,tex:texture(a.sign.tex)}:null});
   };
   this.worker.onerror=e=>{e.preventDefault();this.disable();};
  }catch{this.disable();}
 }
 get available():boolean{return!!this.worker;}
 private disable():void{if(this.timer)clearTimeout(this.timer);this.timer=null;this.worker?.terminate();this.worker=null;const resolve=this.pending;this.pending=null;resolve?.(null);}
 request(building:Building):Promise<BuildingArt|null>|null{
  if(!this.worker||this.pending)return null;
  return new Promise(resolve=>{this.pending=resolve;this.timer=setTimeout(()=>this.disable(),10000);try{this.worker!.postMessage({id:++this.id,building});}catch{this.disable();}});
 }
}
let sharedWorker:BuildingArtWorker|undefined;
export const buildingArtWorker=()=>sharedWorker??(sharedWorker=new BuildingArtWorker());
