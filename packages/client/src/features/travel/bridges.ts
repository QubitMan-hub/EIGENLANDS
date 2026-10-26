import { Container, Sprite } from 'pixi.js';
import { CHUNK_SIZE, bridgeRailsIn, chunkKey } from '@eigenlands/shared';
import { railSprite } from '../../art/bridges';
import { depth, isoX, isoY } from '../../game/iso';
import type { P34Deps } from '../types';

const SIDE: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Railings and lantern posts on the bridges in the loaded chunks around the player (pure decoration). */
export class BridgeViews {
  private chunks = new Map<string, Container[]>();
  private at = 0;

  constructor(private d: P34Deps) {}

  frame(now: number): void {
    if (now - this.at < 500) return;
    this.at = now;
    const me = this.d.me();
    if (!me) return;
    const store = this.d.store();
    const pcx = Math.floor(me.x / CHUNK_SIZE),
      pcy = Math.floor(me.y / CHUNK_SIZE);
    const want = new Set<string>();
    for (let cy = pcy - 2; cy <= pcy + 2; cy++)
      for (let cx = pcx - 2; cx <= pcx + 2; cx++) {
        // every neighbour must be loaded too, or edges would read as missing water
        let ready = true;
        for (let j = -1; j <= 1 && ready; j++)
          for (let i = -1; i <= 1; i++) if (!store.has(cx + i, cy + j)) ready = false;
        if (!ready) continue;
        const k = chunkKey(cx, cy);
        want.add(k);
        if (this.chunks.has(k)) continue;
        const views: Container[] = [];
        for (const r of bridgeRailsIn(
          (x, y) => store.getTile(x, y),
          cx * CHUNK_SIZE,
          cy * CHUNK_SIZE,
          CHUNK_SIZE,
          CHUNK_SIZE,
        )) {
          const art = railSprite(r.side, r.end);
          const s = new Sprite(art.tex);
          s.anchor.set(art.ax / art.tex.width, art.ay / art.tex.height);
          const x = r.x + 0.5,
            y = r.y + 0.5;
          s.position.set(isoX(x, y), isoY(x, y));
          const [dx, dy] = SIDE[r.side]!;
          s.zIndex = depth(x + dx * 0.45, y + dy * 0.45);
          this.d.entityLayer().addChild(s);
          views.push(s);
        }
        this.chunks.set(k, views);
      }
    for (const [k, views] of this.chunks)
      if (!want.has(k)) {
        for (const v of views) v.destroy();
        this.chunks.delete(k);
      }
  }

  count(): number {
    let n = 0;
    for (const v of this.chunks.values()) n += v.length;
    return n;
  }
}
