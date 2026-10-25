// Dev-only sprite lab: every creature / character frame laid out with its drop shadow. Modes via ?lab=:
//   critters (default)  &kind=deer|rabbit|slime|hopper|wisp|brute|mite (&night=1) — rows = SE, SW, NE, NW; cols = anims
//   people              &look=0..7 | &npc=<id> — rows = 8 directions; cols = idle, walk, attack, hurt, death
//   lineup              one idle frame of everything on a grass strip (&scale=)
//   icons               item icons
import { Application, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { ANIMS, critter, critterFrames, critterShadow, type CritterKind } from '../art/foes';
import { softShadow } from '../art/sprite';
import { buildActorSheets, OUTFITS, PERSON_H, PERSON_W, WALK_FRAMES } from '../art/actors';
import { NPCS, packAppearance, APPEARANCE_COUNTS } from '@eigenlands/shared';

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
  const fw = PERSON_W,
    fh = PERSON_H;
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
