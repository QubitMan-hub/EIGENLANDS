import{expect,it}from'vitest';
import{caveRegion,caveRoutes,CAVE_OY,caveTileAt,caveObjectsIn,T,TILE_DEFS,isSolid,ChunkStore,objLight,objSolid,findPath}from'../src';
it('places impassable luminous magma in volcanic chambers while preserving every survey connection',()=>{
 let pools=0;for(const seed of[7,1337,20260101])for(let gy=-3;gy<4;gy++)for(let gx=-3;gx<4;gx++){
  const r=caveRegion(seed,gx,gy);if(r.biome!=='basalt')continue;
  for(const p of caveRoutes(seed,gx,gy).flat())expect(isSolid(caveTileAt(seed,Math.round(p.x),Math.round(p.y)))).toBe(false);
  for(let dy=-8;dy<=10;dy++)for(let dx=-8;dx<=18;dx++)if(caveTileAt(seed,r.x+dx,r.y+dy)===T.LAVA)pools++;
 }
 expect(pools).toBeGreaterThan(80);expect(TILE_DEFS[T.LAVA]!.solid).toBe(true);expect(TILE_DEFS[T.LAVA]!.light).toBeGreaterThan(0);
});
it('keeps the ritual seal walkable and dresses arenas without sealing their roads',()=>{
 const store=new ChunkStore(1337);let arenas=0;
 for(let gy=-3;gy<3;gy++)for(let gx=-3;gx<3;gx++){
  const r=caveRegion(1337,gx,gy);if(r.feature!=='arena')continue;
  const objects=[];for(let y=Math.floor((r.y-20)/32);y<=Math.floor((r.y+20)/32);y++)for(let x=Math.floor((r.x-20)/32);x<=Math.floor((r.x+20)/32);x++)objects.push(...caveObjectsIn(1337,x,y));
  if(!objects.some(o=>o.sub==='cave_seal'&&o.x===r.x&&o.y===r.y))continue;
  arenas++;expect([T.VAULT_FLOOR,T.CAVE_FLOOR]).toContain(store.getTile(r.x,r.y));expect(store.solidAt(r.x,r.y)).toBe(false);
  expect(objects.filter(o=>o.sub==='bell_pylon'&&Math.hypot(o.x-r.x,o.y-r.y)<20)).toHaveLength(4);
  for(const p of caveRoutes(1337,gx,gy))expect(findPath(r.x,r.y,Math.round(p[2]!.x),Math.round(p[2]!.y),store.solidAt,8000)).not.toBeNull();
 }
 expect(arenas).toBeGreaterThan(0);expect(objSolid('deco','cave_seal')).toBe(false);
});
it('uses bounded luminous mushroom clusters and native water/magma set pieces',()=>{
 const kinds=new Set<string>();for(let gy=-3;gy<3;gy++)for(let gx=-3;gx<3;gx++){const r=caveRegion(1337,gx,gy);for(let y=Math.floor((r.y-20)/32);y<=Math.floor((r.y+20)/32);y++)for(let x=Math.floor((r.x-20)/32);x<=Math.floor((r.x+20)/32);x++)for(const o of caveObjectsIn(1337,x,y)){kinds.add(o.sub);if(['cave_waterfall','magma_fall'].includes(o.sub)){expect(caveTileAt(1337,o.x,o.y)).toBe(o.sub==='magma_fall'?T.LAVA:T.WATER);expect(caveTileAt(1337,o.x,o.y-1)).toBe(T.CAVE_WALL);}if(o.sub==='glow_mushrooms')expect(isSolid(caveTileAt(1337,o.x,o.y))).toBe(false);}}
 for(const sub of['glow_mushrooms','bell_pylon'])expect(kinds.has(sub)).toBe(true);
 expect(objLight('deco','glow_mushrooms')?.radius).toBeGreaterThan(3);expect(CAVE_OY).toBe(40000);
});
