import { Sprite, Texture, type Container } from 'pixi.js';
import { townFor, type Building } from '@eigenlands/shared';
import { buildBuildingArt, type BuildingArt } from '../art/buildings';
import { makeCanvas, put, C } from '../art/shade';
import { depth } from './iso';
import type { Sun } from './objectviews';
import { setBuildingLights, type TileLight } from './worldobjviews';

interface Puff { s: Sprite; t: number }
interface BView {
  b: Building;
  art: BuildingArt | null;
  walls: Array<{ s: Sprite; front: boolean; piece: BuildingArt['walls'][number] }>;
  roof: Sprite | null;
  shadow: Sprite | null;
  sign: Sprite | null;
  puffs: Puff[];
  roofA: number;
  wallA: number;
  cut: boolean;
  night: boolean;
}

let puffTex: Texture | null = null;
function puffTexture(): Texture {
  if (puffTex) return puffTex;
  const { canvas, ctx } = makeCanvas(7, 6);
  const rows = ['0011100', '0122210', '1223321', '1233321', '0122210', '0011100'];
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '0') put(ctx, x, y, ch === '1' ? C.mist : ch === '2' ? C.fog : C.pale); }));
  puffTex = Texture.from(canvas); puffTex.source.scaleMode = 'nearest';
  return puffTex;
}

/**
 * Hadamere's buildings in isometric view (Project-Zomboid style):
 *  - one y-sorted sprite per wall tile (back walls show their inner faces, front walls their facades)
 *  - a roof sprite above all entities that lifts away (fades) while the player is inside, and turns translucent
 *    while the player stands behind the building; front walls drop to short stubs while inside
 *  - window glass glows after dusk and casts warm light pools; chimneys puff smoke; shops hang signs
 *
 * Inside rule: a tile is "inside" building B when it lies in the interior rectangle (x+1..x+w-2, y+1..y+h-2) or on the
 * doorway tile itself; `insideBuilding` reports the id so the main agent can hide NPCs.
 */
export class BuildingViews {
  private views: BView[] = [];
  private last = 0;
  private darkness = 0;
  private builtThisFrame = 0;

  constructor(seed: number, private shadowLayer: Container, private entityLayer: Container, private roofLayer: Container) {
    for (const b of townFor(seed).buildings) {
      this.views.push({ b, art: null, walls: [], roof: null, shadow: null, sign: null, puffs: [], roofA: 1, wallA: 1, cut: false, night: false });
    }
    setBuildingLights((a, b2, c, d) => this.lights(a, b2, c, d));
  }

  /** 0 (day) .. 1 (night): lit windows. */
  setDarkness(d: number): void { this.darkness = d; }

  private build(v: BView): void {
    const art = buildBuildingArt(v.b);
    v.art = art;
    for (const p of art.walls) {
      const s = new Sprite(p.day);
      s.x = p.x; s.y = p.y;
      s.zIndex = depth(p.tx + 0.5, p.ty + 0.5) - (p.door ? 2 : 0);
      this.entityLayer.addChild(s);
      v.walls.push({ s, front: p.front, piece: p });
    }
    const roof = new Sprite(art.roof.tex);
    roof.x = art.roof.x; roof.y = art.roof.y;
    this.roofLayer.addChild(roof);
    v.roof = roof;
    const sh = new Sprite(art.shadow.tex);
    sh.x = art.shadow.x; sh.y = art.shadow.y; sh.alpha = 0.3;
    this.shadowLayer.addChild(sh);
    v.shadow = sh;
    if (art.sign) {
      const s = new Sprite(art.sign.tex);
      s.x = Math.round(art.sign.x); s.y = Math.round(art.sign.y);
      s.zIndex = depth(art.sign.tx, art.sign.ty);
      this.entityLayer.addChild(s);
      v.sign = s;
    }
    if (art.chimney) for (let i = 0; i < 4; i++) {
      const s = new Sprite(puffTexture());
      s.anchor.set(0.5);
      this.roofLayer.addChild(s);
      v.puffs.push({ s, t: i / 4 });
    }
  }

  insideBuilding(tx: number, ty: number): string | null {
    for (const v of this.views) {
      const b = v.b;
      if (tx === b.doorX && ty === b.doorY) return b.id;
      if (tx >= b.x + 1 && tx <= b.x + b.w - 2 && ty >= b.y + 1 && ty <= b.y + b.h - 2) return b.id;
    }
    return null;
  }

  /** The player stands where the building hides them (north/west of it, within its screen shadow). */
  private behind(b: Building, tx: number, ty: number): boolean {
    return tx >= b.x - 3 && ty >= b.y - 3 && tx < b.x + b.w && ty < b.y + b.h && (tx < b.x + 1 || ty < b.y + 1) && tx + ty < b.x + b.y + b.w + b.h - 2;
  }

  update(now: number, playerTx: number, playerTy: number, reduced: boolean, sun: Sun, minX: number, minY: number, maxX: number, maxY: number): void {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0.016;
    this.last = now;
    this.builtThisFrame = 0;
    const inside = this.insideBuilding(playerTx, playerTy);
    if (sun.dark !== undefined) this.darkness = sun.dark;
    const dark = this.darkness;
    const k = Math.min(1, (dt / 0.25) * (reduced ? 4 : 1));
    for (const v of this.views) {
      const b = v.b;
      const vis = b.x + b.w + 4 >= minX && b.x - 4 <= maxX && b.y + b.h + 4 >= minY && b.y - 4 <= maxY;
      // pre-build one building per frame while it is still off screen (within ~40 tiles), so walking into town never hitches
      if (!v.art && !vis && this.builtThisFrame === 0 && b.x + b.w + 40 >= minX && b.x - 40 <= maxX && b.y + b.h + 40 >= minY && b.y - 40 <= maxY) { this.build(v); this.builtThisFrame++; }
      if (!vis) {
        if (v.art) { v.walls.forEach((w) => (w.s.visible = false)); v.roof!.visible = false; v.shadow!.visible = false; if (v.sign) v.sign.visible = false; v.puffs.forEach((p) => (p.s.visible = false)); }
        continue;
      }
      if (!v.art) {
        if (this.builtThisFrame >= 2) continue;   // spread the (tens of ms) builds over frames
        this.build(v); this.builtThisFrame++;
      }
      const isIn = inside === b.id;
      const isBehind = !isIn && this.behind(b, playerTx, playerTy);
      const roofT = isIn ? 0 : isBehind ? 0.28 : 1;
      const wallT = isBehind ? 0.55 : 1;
      v.roofA += (roofT - v.roofA) * k; if (Math.abs(roofT - v.roofA) < 0.01) v.roofA = roofT;
      v.wallA += (wallT - v.wallA) * k; if (Math.abs(wallT - v.wallA) < 0.01) v.wallA = wallT;
      const night = dark > 0.32;
      const cut = isIn;
      for (const w of v.walls) {
        w.s.visible = true;
        w.s.alpha = w.front ? v.wallA : 1;
        const tex = w.front && cut && w.piece.cut ? w.piece.cut : night ? w.piece.night : w.piece.day;
        if (w.s.texture !== tex) w.s.texture = tex;
      }
      v.cut = cut; v.night = night;
      const roof = v.roof!;
      roof.visible = v.roofA > 0.02;
      roof.alpha = v.roofA;
      if (v.sign) { v.sign.visible = !cut; v.sign.alpha = v.wallA; }
      v.shadow!.visible = sun.alpha > 0.02;
      v.shadow!.alpha = Math.min(0.42, sun.alpha * 1.1);
      // chimney smoke: puffs rise, drift with the wind and fade
      const ch = v.art!.chimney;
      v.puffs.forEach((p, i) => {
        if (!ch || reduced) { p.s.visible = false; return; }
        p.t = (p.t + dt * 0.22) % 1;
        p.s.visible = v.roofA > 0.5;
        p.s.x = Math.round(ch.x + p.t * 10 + Math.sin(now / 700 + i * 2) * 1.5);
        p.s.y = Math.round(ch.y - 3 - p.t * 26);
        p.s.scale.set(0.7 + p.t * 1.3);
        p.s.alpha = (1 - p.t) * 0.75 * v.roofA;
      });
    }
  }

  /** Warm window light at night (tile-space positions). */
  lights(minX: number, minY: number, maxX: number, maxY: number): TileLight[] {
    const dark = this.darkness;
    if (dark < 0.25) return [];
    const out: TileLight[] = [];
    for (const v of this.views) {
      const b = v.b;
      if (!v.art || b.x + b.w < minX || b.x > maxX || b.y + b.h < minY || b.y > maxY) continue;
      for (const w of v.art.windows) out.push({ x: w.x, y: w.y, radius: 2.4, color: 0xf5a654, intensity: Math.min(0.95, (dark - 0.2) * 1.6) });
      // the interior glows too, so a lifted roof reveals a lamplit room
      out.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, radius: Math.max(b.w, b.h) * 0.55, color: 0xfad26a, intensity: Math.min(0.8, (dark - 0.2) * 1.2) });
    }
    return out;
  }
}
