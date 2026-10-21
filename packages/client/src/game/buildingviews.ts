import { Sprite, type Container } from 'pixi.js';
import { TILE_SIZE, townFor, type Building } from '@eigenlands/shared';
import { buildBuildingArt, type BuildingArt } from '../art/buildings';
import type { Sun } from './objectviews';
import type { TileLight } from './worldobjviews';

interface BView {
  b: Building;
  art: BuildingArt;
  parts: Sprite[];
  roof: Sprite;
  shadow: Sprite | null;
  alpha: number;
  built: boolean;
}

/**
 * Hadamere's buildings: south-wall facades (y-sorted into `entityLayer`) and roofs (drawn above entities in `roofLayer`).
 *
 * Inside rule: a tile is "inside" building B when it lies in the interior rectangle (x+1..x+w-2, y+1..y+h-2) or on the
 * doorway tile itself. The roof of that building fades out (~0.25 s) while the player is inside, and `insideBuilding`
 * reports the id so the main agent can hide NPCs. The facade row (FACE) and the walls stay solid and always drawn;
 * the doorway is cut out of the facade so players and NPCs walking through it are never hidden by the wall.
 */
export class BuildingViews {
  private views: BView[] = [];
  private last = 0;
  private darkness = 0;

  constructor(seed: number, private shadowLayer: Container, private entityLayer: Container, private roofLayer: Container) {
    for (const b of townFor(seed).buildings) {
      this.views.push({ b, art: null as unknown as BuildingArt, parts: [], roof: null as unknown as Sprite, shadow: null, alpha: 1, built: false });
    }
  }

  /** 0 (day) .. 1 (night): lit windows. Call with `darkness(hour)` from shared if desired. */
  setDarkness(d: number): void { this.darkness = d; }

  private build(v: BView): void {
    const { b } = v;
    v.art = buildBuildingArt(b);
    const faceY = (b.y + b.h) * TILE_SIZE;                 // bottom of the FACE row in pixels
    const add = (t: import('pixi.js').Texture | null, x: number, y: number, z: number) => {
      if (!t) return;
      const s = new Sprite(t); s.x = x; s.y = y; s.anchor.set(0, 1); s.zIndex = z; this.entityLayer.addChild(s); v.parts.push(s);
    };
    const doorCol = b.doorX - b.x;
    add(v.art.left, b.x * TILE_SIZE, faceY, faceY - 1);
    add(v.art.right, (b.doorX + 1) * TILE_SIZE, faceY, faceY - 1);
    add(v.art.lintel, b.doorX * TILE_SIZE, faceY, b.doorY * TILE_SIZE + 1); // behind anyone standing on the doorway
    void doorCol;
    const roof = new Sprite(v.art.roof);
    roof.anchor.set(v.art.roofAx / v.art.roof.width, v.art.roofAy / v.art.roof.height);
    roof.x = b.x * TILE_SIZE;                                   // anchor carries the 5px side overhang
    roof.y = (b.y + b.h - 1) * TILE_SIZE + 3;                    // eave edge just overlaps the facade top
    this.roofLayer.addChild(roof);
    v.roof = roof;
    // soft ground shadow along the south wall
    const sh = new Sprite(v.art.roof);
    sh.anchor.copyFrom(roof.anchor); sh.tint = 0x2a1060; sh.visible = false;
    this.shadowLayer.addChild(sh);
    v.shadow = sh;
    v.built = true;
  }

  insideBuilding(tx: number, ty: number): string | null {
    for (const v of this.views) {
      const b = v.b;
      if (tx === b.doorX && ty === b.doorY) return b.id;
      if (tx >= b.x + 1 && tx <= b.x + b.w - 2 && ty >= b.y + 1 && ty <= b.y + b.h - 2) return b.id;
    }
    return null;
  }

  update(now: number, playerTx: number, playerTy: number, reduced: boolean, sun: Sun, minX: number, minY: number, maxX: number, maxY: number): void {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0.016;
    this.last = now;
    const inside = this.insideBuilding(playerTx, playerTy);
    for (const v of this.views) {
      const b = v.b;
      const vis = b.x + b.w >= minX && b.x <= maxX && b.y + b.h >= minY && b.y <= maxY;
      if (!vis) { if (v.built) { v.roof.visible = false; v.parts.forEach((p) => (p.visible = false)); if (v.shadow) v.shadow.visible = false; } continue; }
      if (!v.built) this.build(v);
      v.parts.forEach((p) => (p.visible = true));
      const target = inside === b.id ? 0 : 1;
      v.alpha += (target - v.alpha) * Math.min(1, dt / 0.25 * (reduced ? 4 : 1));
      if (Math.abs(target - v.alpha) < 0.01) v.alpha = target;
      v.roof.visible = v.alpha > 0.02;
      v.roof.alpha = v.alpha;
      const sh = v.shadow!;
      sh.visible = v.alpha > 0.1 && sun.alpha > 0.02;
      if (sh.visible) {
        sh.x = v.roof.x; sh.y = v.roof.y + 5;
        sh.alpha = sun.alpha * 0.55 * v.alpha;
        sh.scale.y = -(0.16 + 0.1 * sun.len);
        sh.skew.x = sun.dx * sun.len * 0.45;
      }
    }
  }

  /** Warm window light at night; x/y are tile-space centres. */
  lights(minX: number, minY: number, maxX: number, maxY: number): TileLight[] {
    if (this.darkness < 0.25) return [];
    const out: TileLight[] = [];
    for (const v of this.views) {
      const b = v.b;
      if (!v.built || b.x + b.w < minX || b.x > maxX || b.y + b.h < minY || b.y > maxY) continue;
      for (const w of v.art.windows) out.push({ x: b.x + w.x / TILE_SIZE, y: b.y + b.h - 1 + w.y / TILE_SIZE + 0.4, radius: 2.6, color: 0xf8a84a, intensity: Math.min(1, (this.darkness - 0.2) * 1.6) });
    }
    return out;
  }
}
