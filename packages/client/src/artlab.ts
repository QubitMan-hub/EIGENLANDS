// Dev-only art lab (no server). Modes via ?lab=:
//   (none)   world at ?x=&y=&season=&hour=&scale= with an actor line-up (+ &weather=rain|storm|snow|fog)
//   icons    grid of every item icon
//   objects  gallery of tile objects, crops, stations and furniture (&season=)
//   town     Hadamere with buildings, furnishing and NPC line-up (&hour=&season=)
//   actors   NPC / fauna / person sheets
import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  CROPS, ChunkStore, ITEMS, NPCS, T, TILE_DEFS, TILE_SIZE, ambientColor, darkness, chunkOf, townFor, type WorldObj, type Weather,
} from '@eigenlands/shared';
import { buildObjectArt, FRAMES_PER_VARIANT, type SeasonIdx } from './art/objects';
import { buildActorSheets, OUTFITS, WALK_FRAMES, DIR_LEFT, DIR_RIGHT } from './art/actors';
import { itemIconUrl } from './art/icons';
import { GALLERY_OBJECTS, worldObjDef } from './art/worldobjs';
import { ObjectViews, sunFor } from './game/objectviews';
import { WorldObjViews } from './game/worldobjviews';
import { BuildingViews } from './game/buildingviews';
import { WeatherFx } from './game/weatherfx';
import { depth, isoX, isoY, tileDiamond } from './game/iso';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const mode = q.get('lab');
const cx = num('x', 0), cy = num('y', 0), S = num('scale', 4), hour = num('hour', 12), season = num('season', 1) as SeasonIdx;
const seed = num('seed', 20260101);
const weather = (q.get('weather') ?? 'clear') as Weather;
const noMotion = q.get('motion') === '0';
const playerTx = q.has('px') ? num('px', 0) : -9999, playerTy = num('py', 0);

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
  // ───────── isometric scene (flat-colour diamond ground until the iso Terrain lands) ─────────
  const store = new ChunkStore(seed);
  const world = new Container(), ground = new Graphics(), shadows = new Container(), ents = new Container(), roofs = new Container();
  ents.sortableChildren = true;
  world.addChild(ground, shadows, ents, roofs);
  const objects = new ObjectViews(store, shadows, ents);
  objects.setArt(buildObjectArt(season));
  const wobjs = new WorldObjViews(store, shadows, ents);
  wobjs.setSeason(season);
  const buildings = new BuildingViews(seed, shadows, ents, roofs);
  const wfx = new WeatherFx(app.stage);
  const night = new Graphics();
  app.stage.addChildAt(world, 0);
  const W = window.innerWidth, H = window.innerHeight;
  world.scale.set(S);

  const town = townFor(seed);
  const camTx = mode === 'town' ? town.cx + num('dx', 0) : cx, camTy = mode === 'town' ? town.cy + num('dy', 0) : cy;
  const R2 = num('r', 22);
  const c0x = chunkOf(Math.floor(camTx)), c0y = chunkOf(Math.floor(camTy));
  for (let yy = c0y - 2; yy <= c0y + 2; yy++) for (let xx = c0x - 2; xx <= c0x + 2; xx++) { store.get(xx, yy); objects.buildChunk(xx, yy); wobjs.buildChunk(xx, yy); }

  // ground diamonds
  const GROUND_COL = [0x0f2f66, 0x2a7ad0, 0xecd08e, 0x4da64a, 0xb57f4a, 0x6b3f26, 0x45281a, 0xb57f4a, 0x6d7194];
  const hex = (n: number) => n;
  for (let ty = Math.floor(camTy - R2); ty <= camTy + R2; ty++) for (let tx = Math.floor(camTx - R2); tx <= camTx + R2; tx++) {
    const g = TILE_DEFS[store.getTile(tx, ty)]?.ground ?? 3;
    let col = GROUND_COL[g] ?? 0x4da64a;
    if (g === 3 && ((tx * 7 + ty * 13) & 3) === 0) col = 0x2f8040;
    if (g === 3 && ((tx + ty) & 1) === 0 && (tx * 3 + ty) % 5 === 0) col = 0x7bc95a;
    const pts = tileDiamond(tx, ty);
    ground.poly(pts).fill(hex(col));
  }
  if (mode === 'town') {
    const f = town.spots.field!;
    const defs = Object.values(CROPS);
    const mk = (x: number, y: number, crop: string, growth: number, extra: Record<string, unknown> = {}) => {
      const o: WorldObj = { x, y, kind: 'crop', sub: crop, data: { crop, planted: 0, growth, watered: 0, lastDay: 0, owner: 'p', ...extra } };
      store.putObject(o); wobjs.upsert(o);
    };
    for (let j = 0; j < 8; j++) for (let i = 0; i < 6; i++) { const c = defs[(i + j) % defs.length]!; mk(f.x - 2 + i, f.y - 3 + j, c.id, j % 4 === 0 ? 0 : j % 4 === 1 ? Math.ceil(c.days * 0.4) : j % 4 === 2 ? Math.ceil(c.days * 0.75) : 20); }
  }

  const sheets = buildActorSheets();
  const line: Sprite[] = [];
  const at = (s: Sprite, tx: number, ty: number) => { s.anchor.set(0.5, 1); s.x = isoX(tx, ty); s.y = isoY(tx, ty); s.zIndex = depth(tx, ty); ents.addChild(s); };
  if (mode === 'town') {
    NPCS.forEach((n, i) => { const sp = town.spots.plaza_a!; const s = new Sprite(sheets.npc(n.id, i % 4, 0)); at(s, sp.x + (i % 5) * 1.2 - 2, sp.y + 1.5 + Math.floor(i / 5) * 1.5); line.push(s); });
  } else {
    OUTFITS.forEach((_, i) => { const s = new Sprite(sheets.person(i, i % 4, 0)); at(s, cx - 3 + i * 0.9, cy + 2 + (i % 2)); line.push(s); });
    for (let i = 0; i < 4; i++) { const k = new Sprite(i < 2 ? sheets.slime(i === 1, 0) : sheets.hopper(i === 3, 0)); at(k, cx - 2 + i * 1.4, cy + 4); }
  }

  const sun = sunFor(hour);
  let last = performance.now();
  const dark = darkness(hour);
  app.ticker.add(() => {
    const now = performance.now();
    const dt = (now - last) / 1000; last = now;
    world.x = Math.round(W / 2 - isoX(camTx, camTy) * S); world.y = Math.round(H / 2 - isoY(camTx, camTy) * S);
    const b = [camTx - 30, camTy - 30, camTx + 30, camTy + 30] as const;
    objects.update(now, sun, noMotion, ...b);
    wobjs.update(now, sun, noMotion, ...b);
    buildings.setDarkness(dark);
    buildings.update(now, playerTx, playerTy, noMotion, sun, ...b);
    line.forEach((s, i) => { const f = 1 + (Math.floor(now / 100) % (WALK_FRAMES - 1)); s.texture = mode === 'town' ? sheets.npc(NPCS[i]!.id, Math.floor(now / 1500 + i) % 4, f) : sheets.person(i, Math.floor(now / 1500 + i) % 4, f); });
    wfx.update(dt, weather, W, H, noMotion, hour);
    // crude ambient multiply for time of day / weather (the real lightmap lives in the game)
    const amb = ambientColor(hour), wa = wfx.ambient(weather);
    night.clear().rect(0, 0, W, H).fill((Math.round(amb[0] * wa[0] * 255) << 16) | (Math.round(amb[1] * wa[1] * 255) << 8) | Math.round(amb[2] * wa[2] * 255));
    night.blendMode = 'multiply';
    if (!night.parent) app.stage.addChildAt(night, 1);
    (window as unknown as { __lab: unknown }).__lab = { ready: true, objects: objects.count, wobjs: wobjs.count };
  });
  void T; void TILE_SIZE;
}
