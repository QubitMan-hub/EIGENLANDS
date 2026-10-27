// Dev-only sprite lab: every creature / character frame laid out with its drop shadow. Modes via ?lab=:
//   critters (default)  &kind=deer|rabbit|slime|hopper|wisp|brute|mite (&night=1) — rows = SE, SW, NE, NW; cols = anims
//   people              &look=0..7 | &npc=<id> — rows = 8 directions; cols = idle, walk, attack, hurt, death
//   lineup              one idle frame of everything on a grass strip (&scale=)
//   icons               item icons
//   review              the character system's review board: scale by a door and furniture, outfits in 8 facings,
//                       work and combat clips with their tools, statues beside a person
import { Application, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { ANIMS, critter, critterFrames, critterShadow, type CritterKind } from '../art/foes';
import { softShadow } from '../art/sprite';
import { buildActorSheets, OUTFITS, PERSON_H, NPC_W, NPC_H, PERSON_W, WALK_FRAMES } from '../art/actors';
import { drawWorldBar } from '../game/worldbar';
import { NPCS, packAppearance, APPEARANCE_COUNTS, townFor } from '@eigenlands/shared';
import { buildBuildingArt } from '../art/buildings';
import { PROPS } from '../art/props';
import '../art/catalog-props';
import { TOWN_DECO } from '../art/town';
import { STORY_ART } from '../art/stories';
import { HeldWeapons, HELD_W, HELD_H } from '../art/weapons';
import { actionKeys, type PersonAction } from '../art/person-actions';
import { isoX, isoY } from '../game/iso';

const q = new URLSearchParams(location.search);
const S = Number(q.get('scale') ?? 4);
const mode = q.get('lab') ?? 'critters';
const bg = q.get('bg') ?? '262838';

const app = new Application();
await app.init({
  canvas: document.getElementById('c') as HTMLCanvasElement,
  resizeTo: window,
  background: parseInt(bg, 16),
  antialias: false,
  roundPixels: true,
  resolution: 1,
  preference: 'webgl',
});
const root = new Container();
root.scale.set(S);
app.stage.addChild(root);
const label = (t: string, x: number, y: number) => {
  const tx = new Text({ text: t, style: { fontFamily: 'monospace', fontSize: 9, fill: 0xcfd3e0 } });
  tx.x = x;
  tx.y = y;
  tx.scale.set(1 / S);
  tx.resolution = S;
  root.addChild(tx);
};
const place = (tex: Texture, x: number, y: number, sh: [number, number] | null, oy = 0) => {
  if (sh) {
    const s = new Sprite(softShadow(sh[0], sh[1]));
    s.anchor.set(0.5);
    s.x = x;
    s.y = y;
    root.addChild(s);
  }
  const sp = new Sprite(tex);
  sp.anchor.set(0.5, 1);
  sp.x = x;
  sp.y = y + 1 + oy;
  root.addChild(sp);
  return sp;
};

if (mode === 'critters') {
  // fixed grid: cell (c, r) has its top-left at (8 + c*fw, 12 + r*fh) art px; the sprite stands at the cell's bottom centre - 3
  const kind = (q.get('kind') ?? 'deer') as CritterKind,
    night = q.get('night') === '1';
  const only = q.get('anim');
  const tex0 = critter(kind, night, 0, 'idle', 0);
  const fw = tex0.frame.width + 2,
    fh = tex0.frame.height + 2;
  let c = 0;
  for (const a of ANIMS) {
    if (only && a !== only) continue;
    label(a, 8 + c * fw, 2);
    for (let k = 0; k < critterFrames(kind, a); k++, c++) {
      for (let d = 0; d < 4; d++)
        place(critter(kind, night, d, a, k), 8 + c * fw + fw / 2, 12 + (d + 1) * fh - 3, critterShadow(kind));
    }
  }
}
if (mode === 'people') {
  // rows = 8 directions; cols = idle, walk 1..8, attack 0..2, hurt, death 0..3
  const sheets = buildActorSheets();
  const npc = q.get('npc');
  const looks = npc ? npc.split(',') : (q.get('look') ?? '0').split(',').map(Number);
  const fw = npc ? NPC_W : PERSON_W,
    fh = npc ? NPC_H : PERSON_H;
  looks.forEach((lk, li) => {
    const oy = li * (fh * 8 + 10);
    for (let d = 0; d < 8; d++) {
      const frames: Texture[] = [];
      for (let f = 0; f < WALK_FRAMES; f++)
        frames.push(typeof lk === 'string' ? sheets.npc(lk, d, f) : sheets.person(lk, d, f));
      frames.forEach((t, c) => place(t, 8 + c * fw + fw / 2, 12 + oy + (d + 1) * fh - 3, [6, 2]));
    }
  });
}
if (mode === 'creator') {
  // rows = dress styles; cols = hair styles (colours cycle so every swatch shows up); &dir= facing, &frame=
  const sheets = buildActorSheets();
  const d = Number(q.get('dir') ?? 0),
    f = Number(q.get('frame') ?? 0);
  const g = new Graphics().rect(0, 0, 4000, 4000).fill(0x3f5a34);
  root.addChild(g);
  for (let r = 0; r < APPEARANCE_COUNTS.dress; r++)
    for (let c = 0; c < Number(q.get('cols') ?? 10); c++) {
      const n = r * 17 + c * 5;
      const app = packAppearance({
        skin: (r + c) % APPEARANCE_COUNTS.skin,
        hairStyle: c,
        hairColor: n % APPEARANCE_COUNTS.hairColor,
        eyes: (n + 1) % APPEARANCE_COUNTS.eyes,
        dress: r,
        dressColor: (n + r) % APPEARANCE_COUNTS.dressColor,
        trim: (n + 2) % APPEARANCE_COUNTS.trim,
        body: (r + c) % 2,
        cut: (n % (APPEARANCE_COUNTS.cut - 1)) + 1,
      });
      place(sheets.styled(0, app, d, f), 16 + c * 22, 36 + r * 36, [6, 2]);
    }
}
if (mode === 'npcs') {
  // every NPC, idle, in rows of 12 (&dir= facing)
  const sheets = buildActorSheets();
  const d = Number(q.get('dir') ?? 0);
  root.addChild(new Graphics().rect(0, 0, 4000, 4000).fill(0x3f5a34));
  NPCS.forEach((n, i) => place(sheets.npc(n.id, d, 0), 16 + (i % 12) * 22, 36 + Math.floor(i / 12) * 36, [6, 2]));
}
if (mode === 'bars') {
  // world-space creature bars: camp colours, elite pips, armour slab, trail (&scale=)
  root.addChild(new Graphics().rect(0, 0, 4000, 4000).fill(0x3f5a34));
  (['hostile', 'neutral', 'passive', 'ally', 'elite'] as const).forEach((faction, i) => {
    for (const [j, hp] of [1, 0.6, 0.25].entries()) {
      const g = new Graphics();
      g.x = 20 + i * 28;
      g.y = 16 + j * 22;
      drawWorldBar(g, {
        top: 0,
        hp,
        trail: Math.min(1, hp + 0.2),
        faction,
        pips: faction === 'elite' ? j + 1 : 0,
        armor: j === 1 ? 0.6 : null,
        staggered: j === 2,
        t: 0,
      });
      root.addChild(g);
    }
  });
}
if (mode === 'lineup') {
  // everyone standing on a strip of ground, idle, facing the camera (or &dir=)
  const sheets = buildActorSheets();
  const d = Number(q.get('dir') ?? 0);
  const g = new Graphics().rect(0, 20, 2000, 60).fill(0x3f5a34);
  root.addChild(g);
  let x = 14;
  OUTFITS.forEach((_, i) => {
    place(sheets.person(i, d, 0), x, 60, [6, 2]);
    x += 20;
  });
  x += 6;
  for (const n of NPCS) {
    place(sheets.npc(n.id, d, 0), x, 60, [6, 2]);
    x += 20;
  }
  x = 14;
  const kinds: CritterKind[] = ['slime', 'hopper', 'rabbit', 'deer', 'wisp', 'brute', 'mite'];
  for (const k of kinds) {
    const t = critter(k, false, d % 4, 'idle', 0);
    place(t, x + t.frame.width / 2, 120, critterShadow(k));
    x += t.frame.width + 4;
  }
  for (const k of kinds) {
    const t = critter(k, true, d % 4, 'idle', 0);
    place(t, x + t.frame.width / 2, 120, critterShadow(k));
    x += t.frame.width + 4;
  }
}
void Graphics;
(window as unknown as { __lab: unknown }).__lab = { ready: true };

if (mode === 'review') {
  const sheets = buildActorSheets();
  const g = new Graphics().rect(0, 0, 4000, 4000).fill(0x4f7240);
  root.addChild(g);
  const man = packAppearance({
      skin: 1,
      hairStyle: 0,
      hairColor: 0,
      eyes: 2,
      dress: 3,
      dressColor: 3,
      trim: 0,
      body: 0,
      cut: 2,
    }),
    woman = packAppearance({
      skin: 3,
      hairStyle: 0,
      hairColor: 3,
      eyes: 1,
      dress: 0,
      dressColor: 1,
      trim: 2,
      body: 1,
      cut: 16,
    });
  const person = (app: number, d: number, f: number, x: number, y: number) =>
    place(sheets.styled(0, app, d, f), x, y, [6, 2]);
  // 1) scale: a real cottage from the home town, both bodies at its door, and furniture beside them
  const b = townFor(20260101).buildings.find((t) => t.kind === 'house') ?? townFor(20260101).buildings[0]!;
  const art = buildBuildingArt(b);
  const door = art.walls.find((w) => w.door) ?? art.walls[0]!;
  const ox = 120 - isoX(door.tx, door.ty),
    oy = 150 - isoY(door.tx, door.ty);
  const house = new Container();
  house.x = ox;
  house.y = oy;
  for (const w of art.walls) {
    const sp = new Sprite(w.day);
    sp.x = w.x;
    sp.y = w.y;
    house.addChild(sp);
  }
  root.addChild(house);
  label('scale: 1.78 m man / 1.68 m woman at a 2.1 m door', 6, 4);
  const dx = isoX(door.tx + 0.5, door.ty + 1.3) + ox,
    dy = isoY(door.tx + 0.5, door.ty + 1.3) + oy;
  person(man, 0, 0, dx - 9, dy);
  person(woman, 0, 0, dx + 9, dy + 2);
  let fx = 230;
  for (const k of ['chair', 'table', 'workbench', 'bed', 'barrel', 'well']) {
    const mk = PROPS[k];
    if (!mk) continue;
    const def = mk('sw');
    const fr = def.frames[0]!;
    const sp = new Sprite(fr.tex);
    sp.anchor.set(fr.ax / fr.tex.width, fr.ay / fr.tex.height);
    sp.x = fx;
    sp.y = 150;
    root.addChild(sp);
    person(k === 'table' ? woman : man, 5, 0, fx + 16, 158);
    label(k, fx - 10, 166);
    fx += 62;
  }
  // 2) outfits in all eight facings: the player presets and some residents
  const dirs = [0, 5, 3, 7, 1, 6, 2, 4];
  label('outfits x 8 facings (S, SE, E, NE, N, NW, W, SW)', 6, 190);
  [0, 3, 6, 9, 10].forEach((o, r) =>
    dirs.forEach((d, c) => place(sheets.person(o, d, 0), 20 + c * 26, 240 + r * 40, [6, 2])),
  );
  ['orla', 'tobin', NPCS[3]!.id, NPCS[7]!.id, NPCS[12]!.id].forEach((id, r) =>
    dirs.forEach((d, c) => place(sheets.npc(id, d, 0), 250 + c * 26, 240 + r * 40, [6, 2])),
  );
  // 3) work and combat: each clip's eight keys with the tool the game puts in the hand
  const held = new HeldWeapons();
  const clips: Array<[PersonAction, string | null]> = [
    ['mine', 'pickaxe'],
    ['chop', 'axe'],
    ['dig', 'hoe'],
    ['water', 'can'],
    ['fish', 'rod'],
    ['gather', null],
    ['craft', null],
    ['slash', 'sword'],
    ['thrust', 'spear'],
    ['dodge', null],
    ['hit', null],
    ['death', null],
  ];
  label('clips: 8 keys each, contact on the 5th; tools from the same skeleton', 480, 190);
  clips.forEach(([a, tool], r) => {
    label(a, 470, 222 + r * 34);
    actionKeys(a).forEach((f, c) => {
      const x = 520 + c * 28,
        y = 236 + r * 34;
      if (tool) {
        const t = held.texture(tool as never, 5, f);
        const sp = new Sprite(t);
        sp.anchor.set(0.5, 0.75);
        sp.x = x;
        sp.y = y + 1;
        void HELD_W;
        void HELD_H;
        root.addChild(sp);
      }
      place(sheets.styled(0, r % 2 ? woman : man, 5, f), x, y, [6, 2]);
    });
  });
  // 4) statues beside a living person
  label('statues beside a person', 6, 450);
  const statue = TOWN_DECO.statue!().frames[0]!;
  const st = new Sprite(statue.tex);
  st.anchor.set(statue.ax / statue.tex.width, statue.ay / statue.tex.height);
  st.x = 100;
  st.y = 700;
  root.addChild(st);
  person(man, 5, 0, 190, 704);
  const crypt = STORY_ART.crypt_statue!('sw');
  const cs = new Sprite(crypt.tex);
  cs.anchor.set(crypt.ax / crypt.tex.width, crypt.ay / crypt.tex.height);
  cs.x = 250;
  cs.y = 700;
  root.addChild(cs);
  person(woman, 4, 0, 276, 704);
  const garden = PROPS.statue_marble?.('se').frames[0];
  if (garden) {
    const gs = new Sprite(garden.tex);
    gs.anchor.set(garden.ax / garden.tex.width, garden.ay / garden.tex.height);
    gs.x = 330;
    gs.y = 700;
    root.addChild(gs);
    person(man, 4, 0, 356, 704);
  }
}
