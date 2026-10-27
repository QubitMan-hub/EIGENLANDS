import { railSprite, minecartSprite } from '../art/mining';
import { constructionCanvas } from '../art/construction';
import { BUILD_PIECES, type BuildPiece } from '@eigenlands/shared';
import { Critters } from '../art/critters';
import { buildFoeSheets } from '../art/foes';
// Dev-only art lab (no server). Modes via ?lab=:
//   (none)   world at ?x=&y=&season=&hour=&scale= with an actor line-up (+ &weather=rain|storm|snow|fog)
//   icons    grid of every item icon
//   objects  gallery of tile objects, crops, stations and furniture (&season=)
//   town     Hadamere with buildings, furnishing and NPC line-up (&hour=&season=)
//   actors   NPC / fauna / person sheets
//   ships    sloop and corsair hulls at every heading, the Brine Serpent
import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  isWorldGeneration,
  CROPS,
  ChunkStore,
  LEVEL_PX,
  ITEMS,
  NPCS,
  PALETTE,
  T,
  TILE_DEFS,
  TILE_SIZE,
  ambientColor,
  darkness,
  chunkOf,
  townFor,
  townsFor,
  scheduleAt,
  type WorldObj,
  type Weather,
} from '@eigenlands/shared';
import { buildObjectArt, buildTrees, FRAMES_PER_VARIANT, type SeasonIdx } from '../art/objects';
import {
  buildActorSheets,
  OUTFITS,
  PERSON_W,
  PERSON_H,
  WALK_FRAMES,
  DIR_LEFT,
  DIR_RIGHT,
  ATTACK_FRAME,
  ATTACK_FRAMES,
  RUN_FRAME,
  RUN_FRAMES,
} from '../art/actors';
import { itemIconUrl } from '../art/icons';
import { Ships, HEADINGS, SHIP_AX, SHIP_AY } from '../art/ships';
import { GALLERY_OBJECTS, worldObjDef } from '../art/worldobjs';
import { HeldWeapons } from '../art/weapons';
import { buildSceneryArt } from '../art/scenery';
import { WEAPONS } from '@eigenlands/shared';
import { PROPS } from '../art/props';
import { ObjectViews, sunFor } from '../game/objectviews';
import { WorldObjViews } from '../game/worldobjviews';
import { BuildingViews } from '../game/buildingviews';
import { WeatherFx } from '../game/weatherfx';
import { Terrain } from '../game/terrain';
import { Lighting, type Light } from '../game/lighting';
import { depth, isoX, isoY, setLift, softLevel, tileDiamond } from '../game/iso';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const mode = q.get('lab');
const cx = num('x', 0),
  cy = num('y', 0),
  S = num('scale', 4),
  hour = num('hour', 12),
  season = num('season', 1) as SeasonIdx;
const seed = num('seed', 20260101);
const weather = (q.get('weather') ?? 'clear') as Weather;
const noMotion = q.get('motion') === '0';
const playerTx = q.has('px') ? num('px', 0) : -9999,
  playerTy = num('py', 0);

const app = new Application();
await app.init({
  canvas: document.getElementById('c') as HTMLCanvasElement,
  resizeTo: window,
  background: 0x0b0c1a,
  antialias: false,
  roundPixels: true,
  resolution: 1,
  preference: 'webgl',
});

if (mode === 'construction') {
  document.documentElement.style.overflow = 'auto';
  document.documentElement.style.height = 'auto';
  document.body.style.height = 'auto';
  app.canvas.style.display = 'none';
  document.body.style.overflow = 'auto';
  const gallery = document.createElement('div');
  gallery.style.cssText =
    'display:flex;flex-wrap:wrap;gap:16px;padding:24px;background:#263b35;color:#f2e4c5;font:14px sans-serif';
  for (const [id, piece] of Object.entries(BUILD_PIECES))
    for (const turn of piece.layer === 'floor' ? [0] : [0, 1, 2, 3]) {
      const panel = document.createElement('figure'),
        canvas = constructionCanvas(id as BuildPiece, turn),
        label = document.createElement('figcaption');
      panel.style.margin = '0';
      canvas.style.cssText = 'width:144px;height:288px;image-rendering:pixelated';
      label.textContent = `${piece.name} · ${turn + 1}`;
      panel.append(canvas, label);
      gallery.append(panel);
    }
  document.body.append(gallery);
  (window as unknown as { __lab: unknown }).__lab = { ready: true };
} else if (mode === 'icons') {
  app.canvas.style.display = 'none';
  document.body.style.overflow = 'auto';
  const grid = document.createElement('div');
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fill,88px);gap:6px;padding:10px;background:#3b4a3a;color:#fff;font:9px monospace';
  for (const d of Object.values(ITEMS)) {
    const cell = document.createElement('div');
    cell.style.cssText = 'text-align:center;background:#2a3a2c;padding:4px;border-radius:4px';
    const img = document.createElement('img');
    img.src = itemIconUrl(d.id);
    img.style.cssText = 'width:64px;height:64px;image-rendering:pixelated';
    const label = document.createElement('div');
    label.textContent = d.id;
    cell.append(img, label);
    grid.append(cell);
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
    const d = worldObjDef({
      x: 0,
      y: 0,
      kind: (q.get('kind') ?? 'deco') as WorldObj['kind'],
      sub,
      data: { watering: true },
    });
    for (const sp of d.frames.slice(0, num('frames', 1))) {
      const s = new Sprite(sp.tex);
      s.x = x;
      s.y = 4;
      root.addChild(s);
      x += sp.tex.width + 4;
    }
  }
  (window as unknown as { __lab: unknown }).__lab = { ready: true };
} else if (mode === 'ships') {
  const bg = new Graphics().rect(0, 0, 4000, 4000).fill(0x2a70b0);
  const root = new Container();
  app.stage.addChild(bg, root);
  root.scale.set(num('scale', 2));
  const ships = new Ships();
  const place = (tex: Sprite['texture'], ax: number, ay: number, x: number, y: number) => {
    const s = new Sprite(tex);
    s.anchor.set(ax, ay);
    s.x = x;
    s.y = y;
    root.addChild(s);
  };
  for (const [row, kind] of (['sloop', 'pirate'] as const).entries()) {
    for (let h = 0; h < HEADINGS; h++)
      place(ships.ship(kind, h, h % 3), SHIP_AX, SHIP_AY, 40 + (h % 8) * 80, 60 + row * 150 + Math.floor(h / 8) * 70);
  }
  for (let i = 0; i < 2; i++) place(ships.serpent('head', i), 0.5, 0.95, 60 + i * 50, 370);
  (window as unknown as { __lab: unknown }).__lab = { ready: true };
} else if (
  mode === 'objects' ||
  mode === 'actors' ||
  mode === 'person' ||
  mode === 'actions' ||
  mode === 'equipment' ||
  mode === 'wilderness' ||
  mode === 'resources' ||
  mode === 'caveores' ||
  mode === 'rails' ||
  mode === 'foliage' ||
  mode === 'fauna' ||
  mode === 'portfolks'
) {
  const bg = new Graphics().rect(0, 0, 4000, 4000).fill(0x3b6a3a);
  const root = new Container();
  app.stage.addChild(bg, root);
  const label = (t: string, x: number, y: number) => {
    const tx = new Text({ text: t, style: { fontFamily: 'monospace', fontSize: 9, fill: 0xffffff } });
    tx.x = x;
    tx.y = y;
    root.addChild(tx);
  };
  const SC = num('scale', 3);
  root.scale.set(SC);
  root.y = -num('shift', 0) * SC;
  const place = (tex: Sprite['texture'], ax: number, ay: number, x: number, y: number) => {
    const s = new Sprite(tex);
    s.anchor.set(ax / tex.width, ay / tex.height);
    s.x = x;
    s.y = y;
    root.addChild(s);
    return s;
  };
  if (mode === 'portfolks') {
    const sheets = buildActorSheets();
    NPCS.filter((n) => n.settlement).forEach((n, i) => {
      const x = 28 + (i % 8) * 56,
        y = 42 + Math.floor(i / 8) * 60;
      place(sheets.npc(n.id, 0, -1), PERSON_W / 2, PERSON_H, x, y);
      label(n.name.split(' ')[0]!, x - 20, y + 3);
      label(n.settlement!, x - 20, y + 14);
    });
  } else if (mode === 'fauna') {
    const pack = await Critters.load(),
      native = buildFoeSheets();
    const records: Array<() => void> = [];
    ['stag', 'boar', 'badger', 'wolf', 'fox', 'otter', 'tortoise', 'owl', 'thornling', 'glasscrawler'].forEach(
      (kind, i) => {
        const x0 = 8 + Math.floor(i / 5) * 270,
          y = 70 + (i % 5) * 76;
        label(kind, x0, y - 46);
        for (let dir = 0; dir < 4; dir++) {
          const x = x0 + 30 + dir * 54;
          if (i < 4) {
            const id = kind as 'stag' | 'boar' | 'badger' | 'wolf',
              d = (['SE', 'SW', 'NE', 'NW'] as const)[dir]!,
              a = pack.anchor(id);
            const anim = id === 'stag' || id === 'badger' ? 'walk' : 'run';
            const sp = place(
              pack.frame(id, anim, d, 0),
              a.x * pack.frame(id, anim, d, 0).width,
              a.y * pack.frame(id, anim, d, 0).height,
              x,
              y,
            );
            records.push(() => {
              sp.texture = pack.frame(id, anim, d, noMotion ? 0 : (performance.now() / 1000) * pack.fps(id, anim));
            });
          } else {
            const idx = 15 + i - 4,
              tex = native.frame(idx, false, dir, 'move', 0);
            const sp = place(tex, tex.width / 2, native.anchor(idx) * tex.height, x, y);
            records.push(() => {
              sp.texture = native.frame(
                idx,
                false,
                dir,
                'move',
                noMotion ? 0 : Math.floor(performance.now() / 130) % 8,
              );
            });
          }
        }
      },
    );
    app.ticker.add(() => records.forEach((f) => f()));
  } else if (mode === 'foliage') {
    for (let s = 0; s < 4; s++) {
      label(['spring', 'summer', 'autumn', 'winter'][s]!, 4, 8 + s * 72);
      buildTrees(s as SeasonIdx).forEach((sp, v) => place(sp.tex, sp.ax, sp.ay, 65 + v * 58, 70 + s * 72));
    }
  } else if (mode === 'resources') {
    const art = buildObjectArt(season);
    label('surface outcrops | underground geological blocks', 4, 8);
    for (const [r, kind] of ['ore_copper', 'ore_iron', 'ore_silver', 'ore_gold', 'rock'].entries()) {
      label(kind, 4, 45 + r * 47);
      for (let side = 0; side < 2; side++)
        for (let v = 0; v < 3; v++) {
          const list = side ? art.cave[kind]! : art[kind as 'rock'];
          const sp = list[v * (FRAMES_PER_VARIANT[kind] ?? 1)]!,
            x = 95 + v * 42 + side * 150,
            y = 49 + r * 47;
          root.addChild(
            new Graphics().poly([x, y - 8, x + 16, y, x, y + 8, x - 16, y]).fill(side ? 0x343740 : 0x45644c),
          );
          place(sp.tex, sp.ax, sp.ay, x, y);
        }
    }
  } else if (mode === 'rails') {
    label('Undercroft 2: rails (straight, curves, junction, buffers) and the cart', 4, 8);
    const cases: Array<[string, number, number]> = [
      ['EW', 5, 0],
      ['NS', 10, 0],
      ['E-S', 3, 0],
      ['S-W', 6, 0],
      ['W-N', 12, 0],
      ['N-E', 9, 0],
      ['T', 7, 0],
      ['end E', 1, 1],
      ['end N', 8, 2],
    ];
    cases.forEach(([name, mask, end], i) => {
      const x = 50 + (i % 5) * 80,
        y = 70 + Math.floor(i / 5) * 90;
      root.addChild(new Graphics().poly([x, y - 8, x + 16, y, x, y + 8, x - 16, y]).fill(0x4a3a30));
      const sp = railSprite(mask, end);
      place(sp.tex, sp.ax, sp.ay, x, y);
      label(name, x - 14, y + 14);
    });
    const cart = minecartSprite(0, true, 5);
    place(cart.tex, cart.ax, cart.ay, 130, 260);
    // a short L-shaped line laid out tile by tile
    const line: Array<[number, number, number, number]> = [
      [0, 0, 1, 1],
      [1, 0, 5, 0],
      [2, 0, 5, 0],
      [3, 0, 3, 0],
      [3, 1, 10, 0],
      [3, 2, 10, 0],
      [3, 3, 8, 2],
    ];
    for (const [i, j, mask, end] of line) {
      const x = 330 + (i - j) * 16,
        y = 230 + (i + j) * 8;
      const sp = railSprite(mask, end);
      place(sp.tex, sp.ax, sp.ay, x, y);
    }
  } else if (mode === 'caveores') {
    const art = buildObjectArt(season);
    const kinds = Object.keys(art.cave).filter((k) => k.startsWith('cave_') || k === 'stalagmite' || k === 'glowcap');
    label('Undercroft 2: veins embedded in rock, floor finds', 4, 8);
    kinds.forEach((kind, r) => {
      label(kind, 4, 50 + r * 44);
      const fr = FRAMES_PER_VARIANT[kind] ?? 1,
        n = art.cave[kind]!.length;
      for (let i = 0; i < n; i++) {
        const sp = art.cave[kind]![i]!,
          x = 110 + (i % (3 * fr)) * 40 + Math.floor(i / (3 * fr)) * 0,
          y = 56 + r * 44;
        root.addChild(new Graphics().poly([x, y - 8, x + 16, y, x, y + 8, x - 16, y]).fill(0x343740));
        place(sp.tex, sp.ax, sp.ay, x, y);
      }
    });
  } else if (mode === 'wilderness') {
    Object.entries(buildSceneryArt()).forEach(([kind, list], row) => {
      label(kind.replace('wild_', ''), 4, 24 + row * 40);
      list.forEach((sp, v) => {
        const x = 115 + v * 55,
          y = 26 + row * 40;
        root.addChild(new Graphics().poly([x, y - 8, x + 16, y, x, y + 8, x - 16, y]).fill(0x45644c));
        place(sp.tex, sp.ax, sp.ay, x, y);
      });
    });
    for (const [i, face] of (['sw', 'se'] as const).entries()) {
      for (const sub of ['shrine_altar', 'shrine_pillar']) {
        const sp = PROPS[sub]!(face).frames[0]!;
        place(sp.tex, sp.ax, sp.ay, 335 + i * 70, sub === 'shrine_altar' ? 85 : 165);
      }
    }
    const crop = worldObjDef({
      x: 0,
      y: 0,
      kind: 'crop',
      sub: '*turnip+potato',
      data: { crop: 'turnip', alt: 'potato', growth: 3 },
    });
    crop.frames.forEach((sp, i) => place(sp.tex, sp.ax, sp.ay, 315 + i * 40, 250));
  } else if (mode === 'equipment') {
    const sheets = buildActorSheets(),
      weapons = new HeldWeapons();
    Object.values(WEAPONS)
      .filter((w) => !q.has('weapons') || q.get('weapons')!.split(',').includes(w.id))
      .forEach((w, row) => {
        label(w.name, 4, 18 + row * 56);
        for (let d = 0; d < 8; d++) {
          const f = num('frame', w.cls === 'crossbow' ? 23 : w.cls === 'staff' ? 27 : 11);
          const x = 140 + d * 40,
            y = 45 + row * 56;
          if (d === 1 || d >= 6) place(weapons.texture(w.id, d, f), 28, 48, x, y);
          place(sheets.person(num('outfit', 0), d, f), PERSON_W / 2, PERSON_H, x, y);
          if (d !== 1 && d < 6) place(weapons.texture(w.id, d, f), 28, 48, x, y);
        }
      });
  } else if (mode === 'actions') {
    const sheets = buildActorSheets(),
      outfit = Math.max(0, Math.min(OUTFITS.length - 1, num('outfit', 0)));
    label('four strike/recovery poses | eight running poses; eight directions', 4, 4);
    for (let d = 0; d < 8; d++) {
      label(String(d), 4, 48 + d * 52);
      for (let f = 0; f < ATTACK_FRAMES + RUN_FRAMES; f++) {
        const frame = f < ATTACK_FRAMES ? ATTACK_FRAME + f : RUN_FRAME + f - ATTACK_FRAMES;
        place(sheets.person(outfit, d, frame), PERSON_W / 2, PERSON_H, 26 + f * 29, 60 + d * 52);
      }
    }
  } else if (q.has('props')) {
    // every isometric prop on a floor diamond with a wall behind it, both orientations
    const keys = Object.keys(PROPS).filter((k) => !q.get('props') || q.get('props')!.split(',').includes(k));
    keys.forEach((k, i) => {
      for (const [j, face] of [
        [0, 'sw'],
        [1, 'se'],
      ] as const) {
        const x = 30 + (i % 6) * 84 + j * 40,
          y = 60 + Math.floor(i / 6) * 70;
        const g = new Graphics()
          .poly([x, y - 8, x + 16, y, x, y + 8, x - 16, y])
          .fill(0x8a5a3a)
          .stroke({ color: 0x5a3a2a, width: 0.5 });
        if (face === 'sw') g.poly([x, y - 8, x + 16, y, x + 16, y - 40, x, y - 48]).fill(0x4a5a6a);
        else g.poly([x, y - 8, x - 16, y, x - 16, y - 40, x, y - 48]).fill(0x5a6a7a);
        root.addChild(g);
        const d = PROPS[k]!(face);
        const sp = d.frames[0]!;
        place(sp.tex, sp.ax, sp.ay, x, y);
      }
      label(k, 20 + (i % 6) * 84, 66 + Math.floor(i / 6) * 70);
    });
  } else if (mode === 'person') {
    const sheets = buildActorSheets();
    label('8 directions (idle) for 4 looks, then a walk cycle facing down / right / up-left', 4, 2);
    for (let o = 0; o < Math.min(4, OUTFITS.length); o++) {
      for (let d = 0; d < 8; d++) place(sheets.person(o, d, 0), 12, 31, 14 + d * 26, 46 + o * 38);
    }
    for (const [row, d] of [
      [0, 0],
      [1, 3],
      [2, 6],
    ] as const)
      for (let f = 1; f < WALK_FRAMES; f++) place(sheets.person(0, d, f), 12, 31, 14 + (f - 1) * 26, 214 + row * 38);
    for (let n = 0; n < 6; n++) place(sheets.npc(NPCS[n]!.id, 0, 0), 12, 31, 240 + n * 26, 46 + 38 * 4 + 0);
  } else if (mode === 'objects') {
    const art = buildObjectArt(season);
    let y = 8;
    label(`tile objects (season ${season})`, 4, y);
    y += 14;
    let x = 14;
    for (const kind of [
      'tree',
      'rock',
      'ore_copper',
      'ore_iron',
      'ore_silver',
      'ore_gold',
      'crystal',
      'forage',
      'stump',
      'torch',
      'bloom',
      'flowers',
      'tallgrass',
    ] as const) {
      const list = art[kind];
      const fr = FRAMES_PER_VARIANT[kind] ?? 1;
      for (let v = 0; v < list.length / fr && v < 3; v++) {
        const sp = list[v * fr]!;
        place(sp.tex, sp.ax, sp.ay, x, y + 30);
        x += sp.tex.width + 2;
      }
      label(kind, x - 20, y + 34);
      x += 14;
      if (x > 480) {
        x = 14;
        y += 50;
      }
    }
    y += 50;
    x = 14;
    label('fence masks 0..15', 4, y);
    y += 14;
    art.fence.forEach((sp, i) => {
      place(sp.tex, sp.ax, sp.ay, x + i * 20, y + 22);
    });
    y += 40;
    label('crops: stages 0-3 (superposed last row)', 4, y);
    y += 14;
    const { cropStage } = await import('@eigenlands/shared');
    void cropStage;
    for (const c of Object.values(CROPS)) {
      for (let st = 0; st < 4; st++) {
        const growth = [0, 1, 2, 9][st]!;
        const o: WorldObj = {
          x: 0,
          y: 0,
          kind: 'crop',
          sub: c.id,
          data: {
            crop: c.id,
            planted: 0,
            growth: st === 3 ? 20 : st === 0 ? 0 : st === 1 ? Math.ceil(c.days * 0.4) : Math.ceil(c.days * 0.75),
            watered: 0,
            lastDay: 0,
            owner: 'x',
          },
        };
        void growth;
        const d = worldObjDef(o);
        const sp = d.frames[0]!;
        place(
          sp.tex,
          sp.ax,
          sp.ay,
          16 + st * 20 + (Object.keys(CROPS).indexOf(c.id) % 5) * 90,
          y + 24 + Math.floor(Object.keys(CROPS).indexOf(c.id) / 5) * 30,
        );
      }
      label(
        c.id,
        8 + (Object.keys(CROPS).indexOf(c.id) % 5) * 90,
        y + 26 + Math.floor(Object.keys(CROPS).indexOf(c.id) / 5) * 30,
      );
    }
    y += 100;
    for (let i = 0; i < 2; i++) {
      const dead = i === 1;
      const o: WorldObj = {
        x: 0,
        y: 0,
        kind: 'crop',
        sub: '*turnip+potato',
        data: { crop: 'turnip', alt: 'potato', planted: 0, growth: 9, watered: 0, lastDay: 0, owner: 'x', dead },
      };
      const d = worldObjDef(o);
      d.frames.forEach((sp, f) => place(sp.tex, sp.ax, sp.ay, 20 + f * 26 + i * 70, y));
    }
    label('superposed / dead', 4, y + 4);
    y += 20;
    label('objects', 4, y);
    y += 8;
    x = 20;
    let rowY = y;
    for (const g of GALLERY_OBJECTS) {
      const d = worldObjDef({ x: 0, y: 0, kind: g.kind, sub: g.sub, data: { watering: true } });
      let w = 0;
      d.frames.slice(0, 3).forEach((sp, f) => {
        place(sp.tex, sp.ax, sp.ay, x + w, rowY + 44);
        w += sp.tex.width + 2;
        void f;
      });
      label(g.sub, x - 6, rowY + 48);
      x += Math.max(w, 30) + 16;
      if (x > 500) {
        x = 20;
        rowY += 62;
      }
    }
  } else {
    const sheets = buildActorSheets();
    label('NPCs (down, up, left, right + walk)', 4, 6);
    NPCS.forEach((n, i) => {
      for (let d = 0; d < 4; d++)
        place(sheets.npc(n.id, d, 0), 8, 24, 14 + i * 40 + (d % 2) * 14, 42 + Math.floor(d / 2) * 30);
      const w = place(sheets.npc(n.id, 3, 0), 8, 24, 14 + i * 40, 100);
      w.texture = sheets.npc(n.id, 0, 3);
      label(n.id, 6 + i * 40, 104);
    });
    label('players', 4, 120);
    OUTFITS.forEach((_, i) => {
      for (let f = 0; f < WALK_FRAMES; f++)
        if (f % 2 === 0)
          place(sheets.person(i, 3, f), 8, 24, 14 + (i % 4) * 70 + (f / 2) * 14, 150 + Math.floor(i / 4) * 30);
    });
    const pack = await Critters.load();
    label('fauna: rabbit + stag (game sheets)', 4, 222);
    for (let f = 0; f < 4; f++)
      for (const [d, ox] of [
        [DIR_RIGHT, 0],
        [DIR_LEFT, 120],
      ] as const) {
        const r = sheets.rabbit(f, d),
          de = sheets.deer(f, d);
        place(r, r.width / 2, r.height, 20 + ox + f * 20, 252);
        const facing = d === DIR_RIGHT ? 'SE' : 'SW',
          tex = pack.frame('stag', 'walk', facing, f),
          a = pack.anchor('stag');
        place(tex, a.x * tex.width, a.y * tex.height, 20 + ox + f * 28, 290);
        void de;
      }
  }
  (window as unknown as { __lab: unknown }).__lab = { ready: true };
} else {
  // ───────── isometric scene: the same render path as the game (GPU terrain, views, lightmap, weather) ─────────
  const requestedGeneration = num('generation', 2);
  const store = new ChunkStore(seed, 400, isWorldGeneration(requestedGeneration) ? requestedGeneration : 2);
  setLift(store.generation >= 3 ? (x, y) => softLevel(store.levelAt, x, y) * LEVEL_PX : null);
  const world = new Container(),
    shadows = new Container(),
    ents = new Container(),
    roofs = new Container(),
    fxl = new Container();
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
  const W = window.innerWidth,
    H = window.innerHeight;
  world.scale.set(S);
  terrain.sprite.scale.set(S);
  lighting.sprite.scale.set(S);
  const vw = Math.ceil(W / S) + 2,
    vh = Math.ceil(H / S) + 2;
  terrain.resize(vw, vh);
  lighting.resize(vw, vh);

  const town = townsFor(seed).find((t) => t.name.toLowerCase() === q.get('port')) ?? townFor(seed);
  const camTx = mode === 'town' ? town.cx + num('dx', 0) : cx,
    camTy = mode === 'town' ? town.cy + num('dy', 0) : cy;
  const c0x = chunkOf(Math.floor(camTx)),
    c0y = chunkOf(Math.floor(camTy));
  for (let yy = c0y - 2; yy <= c0y + 2; yy++)
    for (let xx = c0x - 2; xx <= c0x + 2; xx++) {
      store.get(xx, yy);
      terrain.build(xx, yy);
      objects.buildChunk(xx, yy);
      wobjs.buildChunk(xx, yy);
    }

  if (mode === 'town' && town.spots.field) {
    const f = town.spots.field!;
    const defs = Object.values(CROPS);
    const mk = (x: number, y: number, crop: string, growth: number, extra: Record<string, unknown> = {}) => {
      const o: WorldObj = {
        x,
        y,
        kind: 'crop',
        sub: crop,
        data: { crop, planted: 0, growth, watered: 0, lastDay: 0, owner: 'p', ...extra },
      };
      store.putObject(o);
      wobjs.upsert(o);
    };
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 6; i++) {
        const c = defs[(i + j) % defs.length]!;
        mk(
          f.x - 2 + i,
          f.y - 3 + j,
          c.id,
          j % 4 === 0 ? 0 : j % 4 === 1 ? Math.ceil(c.days * 0.4) : j % 4 === 2 ? Math.ceil(c.days * 0.75) : 20,
          i === 5 && j === 7 ? { alt: 'potato' } : {},
        );
      }
  }

  const sheets = buildActorSheets(),
    pack = await Critters.load();
  const line: Sprite[] = [],
    lineIds: string[] = [];
  const at = (s: Sprite, tx: number, ty: number) => {
    s.anchor.set(0.5, 1);
    s.x = isoX(tx, ty);
    s.y = isoY(tx, ty) + 1;
    s.zIndex = depth(tx, ty);
    ents.addChild(s);
  };
  const shadowOf = new Map<Sprite, Sprite>();
  const withShadow = (s: Sprite) => {
    const sh = new Sprite(s.texture);
    sh.anchor.set(0.5, 1);
    sh.tint = 0x2a1060;
    shadows.addChild(sh);
    shadowOf.set(s, sh);
  };
  if (mode === 'town') {
    if (!q.has('nonpc'))
      NPCS.filter((n) => (q.has('port') ? n.settlement === q.get('port') : !n.settlement)).forEach((n, i) => {
        const sp = q.has('port') ? town.spots[scheduleAt(n, hour, weather).spot]! : town.spots.plaza_a!;
        const s = new Sprite(sheets.npc(n.id, i % 4, 0));
        at(
          s,
          q.has('port') ? sp.x + 0.5 : sp.x + (i % 5) * 1.3 - 2.5,
          q.has('port') ? sp.y + 0.5 : sp.y + 2.5 + Math.floor(i / 5) * 1.6,
        );
        line.push(s);
        lineIds.push(n.id);
        withShadow(s);
      });
  } else if (!q.has('nonpc')) {
    OUTFITS.forEach((_, i) => {
      const s = new Sprite(sheets.person(i, i % 4, 0));
      at(s, cx - 3 + i * 0.9, cy + 2 + (i % 2));
      line.push(s);
      withShadow(s);
    });
    for (let i = 0; i < 6; i++) {
      const k = new Sprite(
        i < 2
          ? sheets.slime(i === 1, 0)
          : i < 4
            ? sheets.hopper(i === 3, 0)
            : i === 4
              ? sheets.rabbit(0, DIR_RIGHT)
              : pack.frame('stag', 'idle', 'SE', 0),
      );
      at(k, cx - 3 + i * 1.5, cy + 4.5);
      if (i === 5) {
        const a = pack.anchor('stag');
        k.anchor.set(a.x, a.y);
      }
      withShadow(k);
    }
  }
  // the "player" used for inside/behind tests (?px=&py=)
  let me: Sprite | null = null;
  if (playerTx > -9999) {
    me = new Sprite(sheets.person(0, 0, 0));
    at(me, playerTx + 0.5, playerTy + 0.5);
    withShadow(me);
  }

  const sun = sunFor(hour);
  let last = performance.now();
  const dark = darkness(hour);
  const t0 = performance.now();
  app.ticker.add(() => {
    const now = noMotion ? t0 : performance.now();
    const dt = (performance.now() - last) / 1000;
    last = performance.now();
    const camX = isoX(camTx, camTy),
      camY = isoY(camTx, camTy) - 6;
    world.x = Math.round(W / 2 - camX * S);
    world.y = Math.round(H / 2 - camY * S);
    const ow = Math.floor(camX - W / 2 / S),
      oh = Math.floor(camY - H / 2 / S);
    terrain.render(ow, oh, c0x, c0y, now / 1000, season, !noMotion);
    terrain.sprite.x = world.x + terrain.originX * S;
    terrain.sprite.y = world.y + terrain.originY * S;
    const b = [camTx - 30, camTy - 30, camTx + 30, camTy + 30] as const;
    objects.update(now, sun, noMotion, ...b);
    wobjs.update(now, sun, noMotion, ...b);
    buildings.setDarkness(dark);
    buildings.update(performance.now(), Math.floor(playerTx), Math.floor(playerTy), noMotion, sun, ...b);
    line.forEach((s, i) => {
      const f = q.has('idle') ? 0 : 1 + (Math.floor(now / 100) % (WALK_FRAMES - 1));
      const d = Math.floor(now / 1500 + i) % 8;
      s.texture = mode === 'town' ? sheets.npc(lineIds[i]!, d, f) : sheets.person(i, d, f);
    });
    for (const [s, sh] of shadowOf) {
      sh.texture = s.texture;
      sh.position.set(s.x, s.y);
      sh.alpha = sun.alpha;
      sh.scale.y = -(0.22 + 0.14 * sun.len);
      sh.skew.x = sun.dx * sun.len * 0.55;
    }
    wfx.update(dt, weather, W, H, noMotion, hour);
    const amb = ambientColor(hour),
      wa = wfx.ambient(weather);
    // lights: tile lights + world objects + a lantern on the "player"
    const iso0 = { x: camX - W / 2 / S, y: camY - H / 2 / S };
    const toL = (tx: number, ty: number) => ({ x: isoX(tx, ty) - iso0.x, y: isoY(tx, ty) - iso0.y });
    const lights: Light[] = [];
    for (let ty = Math.floor(camTy - 26); ty < camTy + 26; ty++)
      for (let tx = Math.floor(camTx - 26); tx < camTx + 26; tx++) {
        const def = TILE_DEFS[store.getTile(tx, ty)];
        if (def && def.light > 0)
          lights.push({
            ...toL(tx + 0.5, ty + 0.5),
            radius: def.light * (def.id === T.LAVA ? 0.85 : 1),
            color: parseInt(PALETTE[def.lightColor]!.slice(1), 16),
            intensity: def.id === T.LAVA ? 0.48 : 0.95,
          });
      }
    for (const l of wobjs.lights(...b))
      lights.push({ ...toL(l.x, l.y), radius: l.radius, color: l.color, intensity: l.intensity });
    if (me)
      lights.push({
        ...toL(playerTx + 0.5, playerTy + 0.5),
        y: toL(playerTx + 0.5, playerTy + 0.5).y - 10,
        radius: 4.5,
        color: parseInt(PALETTE[22]!.slice(1), 16),
        intensity: Math.min(1, dark * 1.1),
      });
    lighting.render([amb[0] * wa[0], amb[1] * wa[1], amb[2] * wa[2]], lights);
    (window as unknown as { __lab: unknown }).__lab = {
      ready: true,
      objects: objects.count,
      wobjs: wobjs.count,
      buildings,
      bounds: b,
    };
  });
  void T;
  void TILE_SIZE;
  void Graphics;
  void tileDiamond;
}
