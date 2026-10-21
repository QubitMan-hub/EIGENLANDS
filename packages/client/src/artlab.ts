// Dev-only art lab: renders the world at ?x=&y=&season=&hour=&scale= with no server, plus an actor line-up.
import { Application, Container, Sprite } from 'pixi.js';
import { ChunkStore, TILE_SIZE, ambientColor, chunkOf, CHUNK_SIZE } from '@eigenlands/shared';
import { buildObjectArt, type SeasonIdx } from './art/objects';
import { buildActorSheets, OUTFITS, WALK_FRAMES } from './art/actors';
import { ObjectViews, sunFor } from './game/objectviews';
import { Terrain } from './game/terrain';
import { Lighting } from './game/lighting';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const cx = num('x', 0), cy = num('y', 0), S = num('scale', 4), hour = num('hour', 12), season = num('season', 1) as SeasonIdx;
const seed = num('seed', 20260101);

const app = new Application();
await app.init({ canvas: document.getElementById('c') as HTMLCanvasElement, resizeTo: window, background: 0x0b0c1a, antialias: false, roundPixels: true, resolution: 1, preference: 'webgl' });
const store = new ChunkStore(seed);
const terrain = new Terrain(app.renderer, store);
const world = new Container(), shadows = new Container(), ents = new Container();
ents.sortableChildren = true;
world.addChild(shadows, ents);
const objects = new ObjectViews(store, shadows, ents);
objects.setArt(buildObjectArt(season));
const lighting = new Lighting(app.renderer);
app.stage.addChild(terrain.sprite, world, lighting.sprite);
const W = window.innerWidth, H = window.innerHeight;
terrain.resize(Math.ceil(W / S) + 2, Math.ceil(H / S) + 2);
lighting.resize(Math.ceil(W / S) + 2, Math.ceil(H / S) + 2);
terrain.sprite.scale.set(S); world.scale.set(S); lighting.sprite.scale.set(S);

const c0x = chunkOf(Math.floor(cx)), c0y = chunkOf(Math.floor(cy));
for (let y = c0y - 2; y <= c0y + 2; y++) for (let x = c0x - 2; x <= c0x + 2; x++) { terrain.build(x, y); objects.buildChunk(x, y); }

const sheets = buildActorSheets();
const line: Sprite[] = [];
OUTFITS.forEach((_, i) => {
  const s = new Sprite(sheets.person(i, i % 4, 0)); s.anchor.set(0.5, 1); s.x = (cx - 4 + i) * TILE_SIZE; s.y = (cy + 2) * TILE_SIZE; s.zIndex = s.y; ents.addChild(s); line.push(s);
});
for (let i = 0; i < 4; i++) {
  const k = new Sprite(i < 2 ? sheets.slime(i === 1, 0) : sheets.hopper(i === 3, 0)); k.anchor.set(0.5, 1);
  k.x = (cx - 3 + i * 2) * TILE_SIZE; k.y = (cy + 4) * TILE_SIZE; k.zIndex = k.y; ents.addChild(k);
}

const sun = sunFor(hour);
let t0 = performance.now();
app.ticker.add(() => {
  const now = performance.now();
  const camX = Math.round(cx * TILE_SIZE * S) / S, camY = Math.round(cy * TILE_SIZE * S) / S;
  world.x = Math.round(W / 2 - camX * S); world.y = Math.round(H / 2 - camY * S);
  const ow = Math.floor(camX - W / 2 / S), oh = Math.floor(camY - H / 2 / S);
  terrain.render(ow, oh, (now - t0) / 1000, season, q.get('motion') !== '0');
  terrain.sprite.x = world.x + ow * S; terrain.sprite.y = world.y + oh * S;
  objects.update(now, sun, false, cx - 30, cy - 20, cx + 30, cy + 20);
  line.forEach((s, i) => { s.texture = sheets.person(i, Math.floor(now / 1500 + i) % 4, 1 + (Math.floor(now / 100) % (WALK_FRAMES - 1))); });
  lighting.render(ambientColor(hour), []);
  (window as any).__lab = { ready: true, chunks: terrain.count, objects: objects.count };
});
void CHUNK_SIZE;
