import {CHUNK_SIZE,buildTile,chunkOf,decodeDiff,type ChunkMsg,type ChunkStore,type WorldObj} from '@eigenlands/shared';
/** Reconcile authority immediately; return only the artwork that actually needs refreshing. */
export function applyChunkSnapshot(store:ChunkStore,m:ChunkMsg){
 const chunk=store.get(m.cx,m.cy),diff=decodeDiff(m.diff),tiles=new Map<string,{x:number;y:number}>();
 const mark=(x:number,y:number)=>tiles.set(`${x},${y}`,{x,y});
 for(const[i,t]of diff)if(chunk.tiles[i]!==t)mark(m.cx*CHUNK_SIZE+i%CHUNK_SIZE,m.cy*CHUNK_SIZE+Math.floor(i/CHUNK_SIZE));
 store.applyDiff(m.cx,m.cy,diff);
 if(!m.objs)return{tiles:[...tiles.values()],objects:[] as WorldObj[],removed:[] as Array<{x:number;y:number}>};
 const normal=new Map<string,WorldObj>(),built=new Map<string,WorldObj>();
 for(const o of m.objs??[])(o.kind==='structure'?built:normal).set(`${o.x},${o.y}`,o);
 const removed:Array<{x:number;y:number}>=[];
 for(const[k,o]of store.objects)if(!o.static&&chunkOf(o.x)===m.cx&&chunkOf(o.y)===m.cy&&!normal.has(k)){store.removeObject(o.x,o.y);removed.push({x:o.x,y:o.y});}
 for(const[k,o]of store.structures)if(chunkOf(o.x)===m.cx&&chunkOf(o.y)===m.cy&&!built.has(k)){store.removeStructure(o.x,o.y);mark(o.x,o.y);}
 for(const o of built.values()){
  const old=store.structureAt(o.x,o.y);
  if(old&&old.owner===o.owner&&JSON.stringify(old.data)===JSON.stringify(o.data))continue;
  const before=buildTile(old);store.putObject(o);if(before!==buildTile(o))mark(o.x,o.y);
 }
 for(const o of normal.values())store.putObject(o);
 return{tiles:[...tiles.values()],objects:[...normal.values()],removed};
}
