import { Container, Sprite, Texture } from 'pixi.js';
import {
  CHUNK_SIZE,
  T,
  REALM_SITES,
  waystonesNear,
  warRaidSites,
  type CivWorld,
  type RealmSite,
  type Waystone,
} from '@eigenlands/shared';
import { buntingSprite, monumentSprite, scaffoldSprite } from '../../art/civic';
import { makeCanvas, put, C } from '../../art/shade';
import { civState, onCivChange } from '../../game/civ-store';
import { depth, isoX, isoY } from '../../game/iso';
import type { P34Deps } from '../types';

/** how near a settlement must be before its civic dressing is built */
const NEAR = 110;

type Plot = [number, number];
/** open ground a prop may stand on (never a house floor) */
const OUTDOOR = new Set<number>([T.GRASS, T.GRASS_TALL, T.FLOWERS, T.SAND, T.PATH]);
const TALL = new Set<number>([T.WALL, T.FACE, T.DOOR, T.TREE]);
/** footprints (tiles) of the civic props: scaffolds and monuments are 2×2, the bunting 3×1 */
const SIZES: ReadonlyArray<[number, number]> = [
  [2, 2],
  [2, 2],
  [2, 2],
  [3, 1],
];

interface SiteView {
  site: RealmSite;
  root: Container;
  bunting: Sprite | null;
  smoke: Array<{ s: Sprite; t: number; x: number; y: number }>;
}

let smokeTex: Texture | null = null;
function smokeTexture(): Texture {
  if (smokeTex) return smokeTex;
  const { canvas, ctx } = makeCanvas(9, 8);
  const rows = ['000111000', '011222110', '122333221', '123333321', '123333321', '122333221', '011222110', '000111000'];
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch !== '0') put(ctx, x, y, ch === '1' ? C.night : ch === '2' ? C.slate : C.steel);
    }),
  );
  smokeTex = Texture.from(canvas);
  smokeTex.source.scaleMode = 'nearest';
  return smokeTex;
}

/**
 * Living settlements (master plan §16): dresses the kingdom settlements near the player from the server's kingdom
 * state. A public work under way raises a scaffold in the waystone yard; each finished work there stands as a
 * monument; a prosperous or feasting realm strings pennants; a settlement raided in today's war smokes. Built only
 * when the state changes or a settlement comes into range, so it costs nothing per frame beyond the smoke puffs.
 */
export class SettlementViews {
  private views = new Map<string, SiteView>();
  private stones = new Map<string, Waystone | null>();
  private plots = new Map<string, Array<Plot | null>>();
  private at = 0;
  private dirty = true;

  constructor(private d: P34Deps) {
    onCivChange(() => (this.dirty = true));
  }

  frame(now: number, dt: number): void {
    if (now - this.at > 1000 || this.dirty) {
      this.at = now;
      this.refresh();
    }
    const reduced = this.d.settings().reducedMotion;
    for (const v of this.views.values()) {
      if (v.bunting) v.bunting.texture = buntingSprite(v.site.realm, Math.floor(now / 260) % 4).tex;
      for (const p of v.smoke) {
        p.t = (p.t + (dt / 1000) * 0.18) % 1;
        p.s.visible = !reduced;
        p.s.position.set(isoX(p.x, p.y) + p.t * 14, isoY(p.x, p.y) - 6 - p.t * 60);
        p.s.scale.set(1 + p.t * 2.2);
        p.s.alpha = Math.min(1, p.t * 6) * (1 - p.t) * 0.8;
      }
    }
  }

  private refresh(): void {
    const me = this.d.me();
    const civ = civState();
    const store = this.d.store();
    if (!me || !civ || store.generation < 5) {
      this.clear();
      return;
    }
    const want = new Set<string>();
    for (const s of REALM_SITES) if (Math.hypot(s.cx - me.x, s.cy - me.y) < NEAR) want.add(s.id);
    for (const [id, v] of this.views)
      if (this.dirty || !want.has(id)) {
        v.root.destroy({ children: true });
        this.views.delete(id);
      }
    this.dirty = false;
    if (!want.size) return;
    const raids = new Set(
      warRaidSites(store.seed, { ...civ, ledger: {} } as unknown as CivWorld, civ.day).map((r) => r.siteId),
    );
    for (const id of want) {
      if (this.views.has(id)) continue;
      const site = REALM_SITES.find((s) => s.id === id)!;
      const stone = this.stoneOf(store.seed, site);
      if (!stone) continue;
      const plots = this.plotsOf(site, stone);
      if (!plots) continue; // its chunks are still loading
      this.views.set(id, this.build(site, plots, raids.has(id)));
    }
  }

  /** the settlement's own waystone: the civic dressing gathers round it */
  private stoneOf(seed: number, site: RealmSite): Waystone | null {
    if (this.stones.has(site.id)) return this.stones.get(site.id)!;
    let best: Waystone | null = null,
      bd = Infinity;
    for (const w of waystonesNear(seed, site.cx, site.cy, Math.max(site.w, site.h) / 2)) {
      if (w.wild || w.net !== site.realm) continue;
      const d = Math.hypot(w.x - site.cx, w.y - site.cy);
      if (d < bd) {
        bd = d;
        best = w;
      }
    }
    this.stones.set(site.id, best);
    return best;
  }

  /**
   * Open ground near the stone for each civic prop: every tile of the footprint and a one-tile margin round it is
   * loaded, outdoor ground, empty (no object or structure) and level with the stone; on paving it must be a square, not a street, and the stone's own
   * approach stays clear. Found once per settlement; null while its chunks are still loading.
   */
  private plotsOf(site: RealmSite, stone: Waystone): Array<Plot | null> | null {
    const have = this.plots.get(site.id);
    if (have) return have;
    const store = this.d.store();
    const R = 14;
    for (let cy = Math.floor((stone.y - R - 2) / CHUNK_SIZE); cy <= Math.floor((stone.y + R + 2) / CHUNK_SIZE); cy++)
      for (let cx = Math.floor((stone.x - R - 2) / CHUNK_SIZE); cx <= Math.floor((stone.x + R + 2) / CHUNK_SIZE); cx++)
        if (!store.has(cx, cy)) return null;
    const lvl = store.levelAt(stone.x, stone.y);
    const used = new Set<string>();
    const open = (x: number, y: number): boolean =>
      !used.has(`${x},${y}`) &&
      Math.max(Math.abs(x - stone.x), Math.abs(y - stone.y)) > 2 &&
      !store.solidAt(x, y) &&
      !store.objectAt(x, y) &&
      !store.structureAt(x, y) &&
      OUTDOOR.has(store.getTile(x, y)) &&
      store.levelAt(x, y) === lvl;
    const paved = (x: number, y: number): boolean => store.getTile(x, y) === T.PATH;
    // candidate origins nearest the stone first
    const cands: Plot[] = [];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) cands.push([stone.x + dx, stone.y + dy]);
    cands.sort((a, b) => Math.hypot(a[0] - stone.x, a[1] - stone.y) - Math.hypot(b[0] - stone.x, b[1] - stone.y));
    const out = SIZES.map(([w, h]) => {
      const hit = cands.find(([ox, oy]) => {
        let road = false;
        for (let y = oy - 1; y <= oy + h; y++)
          for (let x = ox - 1; x <= ox + w; x++) {
            if (!open(x, y)) return false;
            road ||= paved(x, y);
          }
        // on paving, only in a square: paved and open two tiles all round, so no street is narrowed
        if (road)
          for (let y = oy - 2; y <= oy + h + 1; y++)
            for (let x = ox - 2; x <= ox + w + 1; x++) if (!open(x, y) || !paved(x, y)) return false;
        // nothing tall just in front of it (toward the viewer), or a wall or tree would hide it
        for (let k = 1; k <= 3; k++)
          for (let i = -1; i <= Math.max(w, h); i++)
            if (TALL.has(store.getTile(ox + w + k, oy + i)) || TALL.has(store.getTile(ox + i, oy + h + k)))
              return false;
        return true;
      });
      if (hit)
        for (let y = hit[1] - 1; y <= hit[1] + h; y++)
          for (let x = hit[0] - 1; x <= hit[0] + w; x++) used.add(`${x},${y}`);
      return hit ?? null;
    });
    this.plots.set(site.id, out);
    return out;
  }

  private build(site: RealmSite, plots: Array<Plot | null>, raided: boolean): SiteView {
    const k = civState()!.kingdoms[site.realm];
    const root = new Container();
    this.d.entityLayer().addChild(root);
    const v: SiteView = { site, root, bunting: null, smoke: [] };
    const place = (art: { tex: Texture; ax: number; ay: number }, ox: number, oy: number, w = 2, h = 2): Sprite => {
      const s = new Sprite(art.tex);
      s.anchor.set(art.ax / art.tex.width, art.ay / art.tex.height);
      s.position.set(isoX(ox, oy), isoY(ox, oy));
      s.zIndex = depth(ox + w / 2, oy + h / 2);
      // the entity layer sorts its direct children, so the props go there rather than inside `root`
      this.d.entityLayer().addChild(s);
      root.on('destroyed', () => s.destroy());
      return s;
    };
    // the first three plots hold the scaffold and the newest monuments, the last the bunting
    const slots = plots.slice(0, 3).filter((p): p is Plot => !!p);
    let slot = 0;
    if (k.project && k.project.site === site.id && slots[slot]) {
      const stage = Math.min(3, Math.floor(k.project.progress * 4));
      const [x, y] = slots[slot++]!;
      place(scaffoldSprite(stage), x, y);
    }
    for (const b of [...k.built].reverse()) {
      if (slot >= slots.length) break;
      if (b.site !== site.id) continue;
      const [x, y] = slots[slot++]!;
      place(monumentSprite(b.kind, site.realm), x, y);
    }
    const flags = plots[3];
    if (flags && (k.prosperity >= 65 || k.decree.id === 'feast'))
      v.bunting = place(buntingSprite(site.realm, 0), flags[0], flags[1], 3, 1);
    if (raided || (k.wars.length && site.kind === 'outpost')) {
      const tex = smokeTexture();
      for (let i = 0; i < 4; i++) {
        const s = new Sprite(tex);
        s.anchor.set(0.5);
        s.zIndex = 9e7;
        this.d.fxLayer().addChild(s);
        root.on('destroyed', () => s.destroy());
        const a = (i / 4) * Math.PI * 2 + site.cx;
        v.smoke.push({
          s,
          t: i / 4,
          x: site.cx + Math.cos(a) * site.w * 0.18,
          y: site.cy + Math.sin(a) * site.h * 0.18,
        });
      }
    }
    return v;
  }

  private clear(): void {
    for (const v of this.views.values()) v.root.destroy({ children: true });
    this.views.clear();
  }

  count(): number {
    return this.views.size;
  }
}
