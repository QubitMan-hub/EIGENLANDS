// Dev-only art lab (no server). Modes via ?lab=:
//   (none)   world at ?x=&y=&season=&hour=&scale= with an actor line-up (+ &weather=rain|storm|snow|fog)
//   icons    grid of every item icon
//   objects  gallery of tile objects, crops, stations and furniture (&season=)
//   town     Hadamere with buildings, furnishing and NPC line-up (&hour=&season=)
//   actors   NPC / fauna / person sheets
import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  CROPS, ChunkStore, ITEMS, NPCS, PALETTE, T, TILE_DEFS, TILE_SIZE, ambientColor, darkness, chunkOf, townFor, type WorldObj, type Weather,
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
import { Lighting, type Light } from './game/lighting';
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
} else if (mode === 'sprite') {
  // one world object (or a row of them) blown up: ?lab=sprite&kind=deco&subs=statue,bench&scale=4
  const bg = new Graphics().rect(0, 0, 4000, 4000).fill(0x4f9a3f);
  const root = new Container();
  app.stage.addChild(bg, root);
  root.scale.set(num('scale', 4));
  let x = 8;
  for (const sub of (q.get('subs') ?? 'statue').split(',')) {
    const d = worldObjDef({ x: 0, y: 0, kind: (q.get('kind') ?? 'deco') as WorldObj['kind'], sub, data: { watering: true } });
    for (const sp of d.frames.slice(0, num('frames', 1))) {
      const s = new Sprite(sp.tex); s.x = x; s.y = 4; root.addChild(s); x += sp.tex.width + 4;
    }
  }
  (window as unknown as { __lab: unknown }).__lab = { ready: true };
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
  // ───────── isometric scene: the same render path as the game (GPU terrain, views, lightmap, weather) ─────────
  const store = new ChunkStore(seed, 400);
  const world = new Container(), shadows = new Container(), ents = new Container(), roofs = new Container(), fxl = new Container();
  ents.sortableChildren = true;
  world.addChild(shadows, ents, roofs, fxl);
  const terrain = new Terrain(app.renderer, store);
  const lighting = new Lighting(app.renderer);
  const weatherLayer = new Container();
  app.stage.addChild(terrain.sprite, world, lighting.sprite, weatherLayer);
  const objects = new ObjectViews(store, shadows, ents);
  objects.setArt(buildObjectArt(season));
  const wobjs = new WorldObjViews(store, shadows, ents);
  wobjs.setSeason(season);
  const buildings = new BuildingViews(seed, shadows, ents, roofs);
  const wfx = new WeatherFx(weatherLayer);
  const W = window.innerWidth, H = window.innerHeight;
  world.scale.set(S); terrain.sprite.scale.set(S); lighting.sprite.scale.set(S);
  const vw = Math.ceil(W / S) + 2, vh = Math.ceil(H / S) + 2;
  terrain.resize(vw, vh); lighting.resize(vw, vh);

  const town = townFor(seed);
  const camTx = mode === 'town' ? town.cx + num('dx', 0) : cx, camTy = mode === 'town' ? town.cy + num('dy', 0) : cy;
  const c0x = chunkOf(Math.floor(camTx)), c0y = chunkOf(Math.floor(camTy));
  for (let yy = c0y - 2; yy <= c0y + 2; yy++) for (let xx = c0x - 2; xx <= c0x + 2; xx++) { store.get(xx, yy); terrain.build(xx, yy); objects.buildChunk(xx, yy); wobjs.buildChunk(xx, yy); }

  if (mode === 'town') {
    const f = town.spots.field!;
    const defs = Object.values(CROPS);
    const mk = (x: number, y: number, crop: string, growth: number, extra: Record<string, unknown> = {}) => {
      const o: WorldObj = { x, y, kind: 'crop', sub: crop, data: { crop, planted: 0, growth, watered: 0, lastDay: 0, owner: 'p', ...extra } };
      store.putObject(o); wobjs.upsert(o);
    };
    for (let j = 0; j < 8; j++) for (let i = 0; i < 6; i++) { const c = defs[(i + j) % defs.length]!; mk(f.x - 2 + i, f.y - 3 + j, c.id, j % 4 === 0 ? 0 : j % 4 === 1 ? Math.ceil(c.days * 0.4) : j % 4 === 2 ? Math.ceil(c.days * 0.75) : 20, i === 5 && j === 7 ? { alt: 'potato' } : {}); }
  }

  const sheets = buildActorSheets();
  const line: Sprite[] = [];
  const at = (s: Sprite, tx: number, ty: number) => { s.anchor.set(0.5, 1); s.x = isoX(tx, ty); s.y = isoY(tx, ty) + 1; s.zIndex = depth(tx, ty); ents.addChild(s); };
  const shadowOf = new Map<Sprite, Sprite>();
  const withShadow = (s: Sprite) => { const sh = new Sprite(s.texture); sh.anchor.set(0.5, 1); sh.tint = 0x2a1060; shadows.addChild(sh); shadowOf.set(s, sh); };
  if (mode === 'town') {
    if (!q.has('nonpc')) NPCS.forEach((n, i) => { const sp = town.spots.plaza_a!; const s = new Sprite(sheets.npc(n.id, i % 4, 0)); at(s, sp.x + (i % 5) * 1.3 - 2.5, sp.y + 2.5 + Math.floor(i / 5) * 1.6); line.push(s); withShadow(s); });
  } else if (!q.has('nonpc')) {
    OUTFITS.forEach((_, i) => { const s = new Sprite(sheets.person(i, i % 4, 0)); at(s, cx - 3 + i * 0.9, cy + 2 + (i % 2)); line.push(s); withShadow(s); });
    for (let i = 0; i < 6; i++) {
      const k = new Sprite(i < 2 ? sheets.slime(i === 1, 0) : i < 4 ? sheets.hopper(i === 3, 0) : i === 4 ? sheets.rabbit(0, DIR_RIGHT) : sheets.deer(0, DIR_RIGHT));
      at(k, cx - 3 + i * 1.5, cy + 4.5); withShadow(k);
    }
  }
  // the "player" used for inside/behind tests (?px=&py=)
  let me: Sprite | null = null;
  if (playerTx > -9999) { me = new Sprite(sheets.person(0, 0, 0)); at(me, playerTx + 0.5, playerTy + 0.5); withShadow(me); }

  const sun = sunFor(hour);
  let last = performance.now();
  const dark = darkness(hour);
  const t0 = performance.now();
  app.ticker.add(() => {
    const now = noMotion ? t0 : performance.now();
    const dt = (performance.now() - last) / 1000; last = performance.now();
    const camX = isoX(camTx, camTy), camY = isoY(camTx, camTy) - 6;
    world.x = Math.round(W / 2 - camX * S); world.y = Math.round(H / 2 - camY * S);
    const ow = Math.floor(camX - W / 2 / S), oh = Math.floor(camY - H / 2 / S);
    terrain.render(ow, oh, c0x, c0y, now / 1000, season, !noMotion);
    terrain.sprite.x = world.x + ow * S; terrain.sprite.y = world.y + oh * S;
    const b = [camTx - 30, camTy - 30, camTx + 30, camTy + 30] as const;
    objects.update(now, sun, noMotion, ...b);
    wobjs.update(now, sun, noMotion, ...b);
    buildings.setDarkness(dark);
    buildings.update(performance.now(), Math.floor(playerTx), Math.floor(playerTy), noMotion, sun, ...b);
    line.forEach((s, i) => { const f = q.has('idle') ? 0 : 1 + (Math.floor(now / 100) % (WALK_FRAMES - 1)); const d = Math.floor(now / 1500 + i) % 8; s.texture = mode === 'town' ? sheets.npc(NPCS[i]!.id, d, f) : sheets.person(i, d, f); });
    for (const [s, sh] of shadowOf) { sh.texture = s.texture; sh.position.set(s.x, s.y); sh.alpha = sun.alpha; sh.scale.y = -(0.26 + 0.18 * sun.len); sh.skew.x = sun.dx * sun.len * 0.55; }
    wfx.update(dt, weather, W, H, noMotion, hour);
    const amb = ambientColor(hour), wa = wfx.ambient(weather);
    // lights: tile lights + world objects + a lantern on the "player"
    const iso0 = { x: camX - W / 2 / S, y: camY - H / 2 / S };
    const toL = (tx: number, ty: number) => ({ x: isoX(tx, ty) - iso0.x, y: isoY(tx, ty) - iso0.y });
    const lights: Light[] = [];
    for (let ty = Math.floor(camTy - 26); ty < camTy + 26; ty++) for (let tx = Math.floor(camTx - 26); tx < camTx + 26; tx++) {
      const def = TILE_DEFS[store.getTile(tx, ty)];
      if (def && def.light > 0) lights.push({ ...toL(tx + 0.5, ty + 0.5), radius: def.light, color: parseInt(PALETTE[def.lightColor]!.slice(1), 16), intensity: 0.95 });
    }
    for (const l of wobjs.lights(...b)) lights.push({ ...toL(l.x, l.y), radius: l.radius, color: l.color, intensity: l.intensity });
    if (me) lights.push({ ...toL(playerTx + 0.5, playerTy + 0.5), y: toL(playerTx + 0.5, playerTy + 0.5).y - 10, radius: 4.5, color: parseInt(PALETTE[22]!.slice(1), 16), intensity: Math.min(1, dark * 1.1) });
    lighting.render([amb[0] * wa[0], amb[1] * wa[1], amb[2] * wa[2]], lights);
    (window as unknown as { __lab: unknown }).__lab = { ready: true, objects: objects.count, wobjs: wobjs.count };
  });
  void T; void TILE_SIZE; void Graphics; void tileDiamond;
}
