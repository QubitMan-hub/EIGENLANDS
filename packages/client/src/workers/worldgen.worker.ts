import {prepareWorldChunk} from '@eigenlands/shared';
const scope=globalThis as unknown as {onmessage:(e:MessageEvent<{id:number;seed:number;cx:number;cy:number}>)=>void;postMessage:(m:unknown,t:Transferable[])=>void};
scope.onmessage=({data:{id,seed,cx,cy}})=>{
 try{const chunk=prepareWorldChunk(seed,cx,cy);scope.postMessage({id,chunk},[chunk.tiles.buffer,chunk.climate.buffer,chunk.biomes.buffer]);}
 catch(e){scope.postMessage({id,error:String(e)},[]);}
};
