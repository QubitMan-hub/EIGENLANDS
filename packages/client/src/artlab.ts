// Dev-only art lab (no server). Modes via ?lab=:
//   (none)   world at ?x=&y=&season=&hour=&scale= with an actor line-up (+ &weather=rain|storm|snow|fog)
//   icons    grid of every item icon
//   objects  gallery of tile objects, crops, stations and furniture (&season=)
//   town     Hadamere with buildings, furnishing and NPC line-up (&hour=&season=)
//   actors   NPC / fauna / person sheets
import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  CROPS, ChunkStore, ITEMS, NPCS, T, TILE_SIZE, ambientColor, darkness, chunkOf, townFor, type WorldObj, type Weather,
} from '@eigenlands/shared';
import { buildObjectArt, FRAMES_PER_VARIANT, type SeasonIdx } from './art/objects';
import { buildActorSheets, OUTFITS, WALK_FRAMES, DIR_LEFT, DIR_RIGHT } from './art/actors';
import { itemIconUrl } from './art/icons';
import { GALLERY_OBJECTS, worldObjDef } from './art/worldobjs';
import { ObjectViews, sunFor } from './game/objectviews';
import { WorldObjViews } from './game/worldobjviews';
import { BuildingViews } from './game/buildingviews';
import { WeatherFx } from './game/weatherfx';
import { Terrain } from './game/terrain';
import { Lighting } from './game/lighting';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const mode = q.get('lab');
const cx = num('x', 0), cy = num('y', 0), S = num('scale', 4), hour = num('hour', 12), season = num('season', 1) as SeasonIdx;
const seed = num('seed', 20260101);
const weather = (q.get('weather') ?? 'clear') as Weather;
const noMotion = q.get('motion') === '0';

const app = new Application();
await app.init({ canvas: document.getElementById('c') as HTMLCanvasElement, resizeTo: window, background: 0x0b0c1a, antialias: false, roundPixels: true, resolution: 1, preference: 'webgl' });

if (mode === 'icons') {
  app.canvas.style.display = 'none';
  document.body.style.overflow = 'auto';
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,88px);gap:6px;padding:10px;background:#3b4a3a;color:#fff;font:9px monospace';
  for (const d of Object.values(ITEMS)) {
    const cell = document.createElement('div');
    cell.style.cssText = 'text-align:center;background:#2a3a2c;padding:4px;border-radius:4px';
    const img = document.createElement('img');
    img.src = itemIconUrl(d.id); img.style.cssText = 'width:64px;height:64px;image-rendering:pixelated';
    const label = document.createElement('div'); label.textContent = d.id;
    cell.append(img, label); grid.append(cell);
  }
  document.body.append(grid);
  (window as unknown as { __lab: unknown }).__lab = { ready: true, icons: Object.keys(ITEMS).length };
} else if (mode === 'objects' || mode === 'actors') {
  const bg = new Graphics().rect(0, 0, 4000, 4000).fill(0x3b6a3a);
  const root = new Container();
  app.stage.addChild(bg, root);
  const label = (t: string, x: number, y: number) => { const tx = new Text({ text: t, style: { fontFamily: 'monospace', fontSize: 9, fill: 0xffffff } }); tx.x = x; tx.y = y; root.addChild(tx); };
  const SC = num('scale', 3);
  root.scale.set(SC);
  root.y = -num('shift', 0) * SC;
  const place = (tex: Sprite['texture'], ax: number, ay: number, x: number, y: number) => { const s = new Sprite(tex); s.anchor.set(ax / tex.width, ay / tex.height); s.x = x; s.y = y; root.addChild(s); return s; };
  if (mode === 'objects') {
    const art = buildObjectArt(season);
    let y = 8;
    label(`tile objects (season ${season})`, 4, y); y += 14;
    let x = 14;
    for (const kind of ['tree', 'rock', 'ore_copper', 'ore_iron', 'ore_silver', 'ore_gold', 'crystal', 'forage', 'stump', 'torch', 'bloom', 'flowers', 'tallgrass'] as const) {
      const list = art[kind]; const fr = FRAMES_PER_VARIANT[kind] ?? 1;
      for (let v = 0; v < list.length / fr && v < 3; v++) { const sp = list[v * fr]!; place(sp.tex, sp.ax, sp.ay, x, y + 30); x += sp.tex.width + 2; }
      label(kind, x - 20, y + 34); x += 14;
      if (x > 480) { x = 14; y += 50; }
    }
    y += 50; x = 14;
    label('fence masks 0..15', 4, y); y += 14;
    art.fence.forEach((sp, i) => { place(sp.tex, sp.ax, sp.ay, x + i * 20, y + 22); });
    y += 40;
    label('crops: stages 0-3 (superposed last row)', 4, y); y += 14;
    const { cropStage } = await import('@eigenlands/shared');
    void cropStage;
    for (const c of Object.values(CROPS)) {
      for (let st = 0; st < 4; st++) {
        const growth = [0, 1, 2, 9][st]!;
        const o: WorldObj = { x: 0, y: 0, kind: 'crop', sub: c.id, data: { crop: c.id, planted: 0, growth: st === 3 ? 20 : st === 0 ? 0 : st === 1 ? Math.ceil(c.days * 0.4) : Math.ceil(c.days * 0.75), watered: 0, lastDay: 0, owner: 'x' } };
        void growth;
        const d = worldObjDef(o); const sp = d.frames[0]!;
        place(sp.tex, sp.ax, sp.ay, 16 + st * 20 + Object.keys(CROPS).indexOf(c.id) % 5 * 90, y + 24 + Math.floor(Object.keys(CROPS).indexOf(c.id) / 5) * 30);
      }
      label(c.id, 8 + Object.keys(CROPS).indexOf(c.id) % 5 * 90, y + 26 + Math.floor(Object.keys(CROPS).indexOf(c.id) / 5) * 30);
    }
    y += 100;
    for (let i = 0; i < 2; i++) {
      const dead = i === 1;
      const o: WorldObj = { x: 0, y: 0, kind: 'crop', sub: '*turnip+potato', data: { crop: 'turnip', alt: 'potato', planted: 0, growth: 9, watered: 0, lastDay: 0, owner: 'x', dead } };
      const d = worldObjDef(o); d.frames.forEach((sp, f) => place(sp.tex, sp.ax, sp.ay, 20 + f * 26 + i * 70, y));
    }
    label('superposed / dead', 4, y + 4);
    y += 20;
    label('objects', 4, y); y += 8;
    x = 20; let rowY = y;
    for (const g of GALLERY_OBJECTS) {
      const d = worldObjDef({ x: 0, y: 0, kind: g.kind, sub: g.sub, data: { watering: true } });
      let w = 0;
      d.frames.slice(0, 3).forEach((sp, f) => { place(sp.tex, sp.ax, sp.ay, x + w, rowY + 44); w += sp.tex.width + 2; void f; });
      label(g.sub, x - 6, rowY + 48);
      x += Math.max(w, 30) + 16;
      if (x > 500) { x = 20; rowY += 62; }
    }
  } else {
    const sheets = buildActorSheets();
    label('NPCs (down, up, left, right + walk)', 4, 6);
    NPCS.forEach((n, i) => {
      for (let d = 0; d < 4; d++) place(sheets.npc(n.id, d, 0), 8, 24, 14 + i * 40 + (d % 2) * 14, 42 + Math.floor(d / 2) * 30);
      const w = place(sheets.npc(n.id, 3, 0), 8, 24, 14 + i * 40, 100);
      w.texture = sheets.npc(n.id, 0, 3);
      label(n.id, 6 + i * 40, 104);
    });
    label('players', 4, 120);
    OUTFITS.forEach((_, i) => { for (let f = 0; f < WALK_FRAMES; f++) if (f % 2 === 0) place(sheets.person(i, 3, f), 8, 24, 14 + (i % 4) * 70 + (f / 2) * 14, 150 + Math.floor(i / 4) * 30); });
    label('fauna: rabbit + deer, 4 frames, both directions', 4, 222);
    for (let f = 0; f < 4; f++) for (const [d, ox] of [[DIR_RIGHT, 0], [DIR_LEFT, 120]] as const) {
      const r = sheets.rabbit(f, d), de = sheets.deer(f, d);
      place(r, r.width / 2, r.height, 20 + ox + f * 20, 252); place(de, de.width / 2, de.height, 20 + ox + f * 28, 290);
    }
  }
  (window as unknown as { __lab: unknown }).__lab = { ready: true };
} else {
  const store = new ChunkStore(seed);
  const terrain = new Terrain(app.renderer, store);
  const world = new Container(), shadows = new Container(), ents = new Container(), roofs = new Container();
  ents.sortableChildren = true;
  world.addChild(shadows, ents, roofs);
  const objects = new ObjectViews(store, shadows, ents);
  objects.setArt(buildObjectArt(season));
  const wobjs = new WorldObjViews(store, shadows, ents);
  wobjs.setSeason(season);
  const buildings = new BuildingViews(seed, shadows, ents, roofs);
  const lighting = new Lighting(app.renderer);
  const wfx = new WeatherFx(app.stage);
  app.stage.addChildAt(terrain.sprite, 0);
  app.stage.addChildAt(world, 1);
  app.stage.addChildAt(lighting.sprite, 2);
  const W = window.innerWidth, H = window.innerHeight;
  terrain.resize(Math.ceil(W / S) + 2, Math.ceil(H / S) + 2);
  lighting.resize(Math.ceil(W / S) + 2, Math.ceil(H / S) + 2);
  terrain.sprite.scale.set(S); world.scale.set(S); lighting.sprite.scale.set(S);

  const town = townFor(seed);
  const camTx = mode === 'town' ? town.cx + num('dx', 0) : cx, camTy = mode === 'town' ? town.cy + num('dy', 0) : cy;
  const c0x = chunkOf(Math.floor(camTx)), c0y = chunkOf(Math.floor(camTy));
  for (let yy = c0y - 2; yy <= c0y + 2; yy++) for (let xx = c0x - 2; xx <= c0x + 2; xx++) { terrain.build(xx, yy); objects.buildChunk(xx, yy); wobjs.buildChunk(xx, yy); }

  // a few demo player-made objects near the camera
  if (mode === 'town') {
    const f = town.spots.field!;
    const mk = (x: number, y: number, crop: string, growth: number, extra: Partial<WorldObj['data']> = {}) => {
      const o: WorldObj = { x, y, kind: 'crop', sub: crop, data: { crop, planted: 0, growth, watered: 0, lastDay: 0, owner: 'p', ...extra } };
      store.putObject(o); wobjs.upsert(o);
    };
    const defs = Object.values(CROPS);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 6; i++) { const c = defs[(i + j) % defs.length]!; mk(f.x - 2 + i, f.y - 3 + j, c.id, j % 4 === 0 ? 0 : j % 4 === 1 ? Math.ceil(c.days * 0.4) : j % 4 === 2 ? Math.ceil(c.days * 0.75) : 20); }
  }

  const sheets = buildActorSheets();
  const line: Sprite[] = [];
  if (mode === 'town') {
    NPCS.forEach((n, i) => {
      const sp = town.spots.plaza_a!;
      const s = new Sprite(sheets.npc(n.id, i % 4, 0)); s.anchor.set(0.5, 1); s.x = (sp.x + (i - 5) * 1.3) * TILE_SIZE; s.y = (sp.y + 1.5) * TILE_SIZE; s.zIndex = s.y; ents.addChild(s); line.push(s);
    });
  } else {
    OUTFITS.forEach((_, i) => {
      const s = new Sprite(sheets.person(i, i % 4, 0)); s.anchor.set(0.5, 1); s.x = (cx - 4 + i) * TILE_SIZE; s.y = (cy + 2) * TILE_SIZE; s.zIndex = s.y; ents.addChild(s); line.push(s);
    });
    for (let i = 0; i < 4; i++) {
      const k = new Sprite(i < 2 ? sheets.slime(i === 1, 0) : sheets.hopper(i === 3, 0)); k.anchor.set(0.5, 1);
      k.x = (cx - 3 + i * 2) * TILE_SIZE; k.y = (cy + 4) * TILE_SIZE; k.zIndex = k.y; ents.addChild(k);
    }
  }

  const sun = sunFor(hour);
  const t0 = performance.now();
  const playerTx = q.has('px') ? num('px', 0) : -9999, playerTy = num('py', 0);
  let last = performance.now();
  app.ticker.add(() => {
    const now = performance.now();
    const dt = (now - last) / 1000; last = now;
    const camX = Math.round(camTx * TILE_SIZE * S) / S, camY = Math.round(camTy * TILE_SIZE * S) / S;
    world.x = Math.round(W / 2 - camX * S); world.y = Math.round(H / 2 - camY * S);
    const ow = Math.floor(camX - W / 2 / S), oh = Math.floor(camY - H / 2 / S);
    terrain.render(ow, oh, (now - t0) / 1000, season, !noMotion);
    terrain.sprite.x = world.x + ow * S; terrain.sprite.y = world.y + oh * S;
    const b = [camTx - 40, camTy - 24, camTx + 40, camTy + 24] as const;
    objects.update(now, sun, noMotion, ...b);
    wobjs.update(now, sun, noMotion, ...b);
    buildings.update(now, playerTx, playerTy, noMotion, sun, ...b);
    line.forEach((s, i) => { s.texture = mode === 'town' ? sheets.npc(NPCS[i]!.id, Math.floor(now / 1500 + i) % 4, 1 + (Math.floor(now / 100) % (WALK_FRAMES - 1))) : sheets.person(i, Math.floor(now / 1500 + i) % 4, 1 + (Math.floor(now / 100) % (WALK_FRAMES - 1))); });
    wfx.update(dt, weather, W, H, noMotion, hour);
    const amb = ambientColor(hour), wa = wfx.ambient(weather);
    buildings.setDarkness(darkness(hour));
    const ls = [...wobjs.lights(b[0], b[1], b[2], b[3]), ...buildings.lights(b[0], b[1], b[2], b[3])];
    const lights = ls.map((l) => ({ x: (l.x - (camX - W / 2 / S) / TILE_SIZE) * TILE_SIZE, y: (l.y - (camY - H / 2 / S) / TILE_SIZE) * TILE_SIZE, radius: l.radius, color: l.color, intensity: l.intensity }));
    lighting.render([amb[0] * wa[0], amb[1] * wa[1], amb[2] * wa[2]], lights);
    (window as unknown as { __lab: unknown }).__lab = { ready: true, chunks: terrain.count, objects: objects.count, wobjs: wobjs.count };
  });
  void T;
}
