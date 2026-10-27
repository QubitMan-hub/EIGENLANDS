/**
 * The ferry voyage (master plan §14): while a harbour-to-harbour crossing gathers, a parchment sea chart shows the two
 * ports and a little pixel sloop sailing the dotted route between them. Purely a presentation of the server's channel;
 * moving or being struck still cancels the crossing.
 */
import { h } from './dom';

const W = 360,
  H = 150,
  S = 2; // canvas pixels per chart pixel

let styled = false;
function ensureStyles(): void {
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.textContent = `
#voyage{position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:31;display:grid;gap:6px;padding:10px 12px 12px;
  background:var(--leather);color:var(--parch-hi);font-family:var(--pix);text-align:center;
  box-shadow:0 0 0 2px var(--walnut),inset 0 0 0 1px var(--brass-lo),0 6px 0 #0a0705aa}
#voyage canvas{width:${W}px;max-width:80vw;height:auto;image-rendering:pixelated;box-shadow:inset 0 0 0 1px #8a7143}
#voyage b{color:var(--brass-hi);font-size:15px;letter-spacing:.04em}
#voyage span{font-family:var(--prose);font-size:15px;color:#e5d6ae}`;
  document.head.append(el);
}

export class VoyageCard {
  private root: HTMLElement;
  private title: HTMLElement;
  private note: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private run: { from: string; to: string; t0: number; ms: number; east: boolean } | null = null;
  private raf = 0;

  constructor(private reduced: () => boolean) {
    ensureStyles();
    this.canvas = document.createElement('canvas');
    this.canvas.width = W / S;
    this.canvas.height = H / S;
    this.ctx = this.canvas.getContext('2d')!;
    this.title = h('b');
    this.note = h('span', { text: 'Hold still on deck: moving or a blow breaks the crossing.' });
    this.root = h('div', { id: 'voyage' }, this.title, this.canvas, this.note);
    this.root.hidden = true;
    this.root.setAttribute('role', 'status');
    document.body.append(this.root);
  }

  show(from: { name: string; x: number }, to: { name: string; x: number }, seconds: number): void {
    this.run = { from: from.name, to: to.name, t0: performance.now(), ms: seconds * 1000, east: to.x >= from.x };
    this.title.textContent = `Ferry · ${from.name} → ${to.name}`;
    this.root.hidden = false;
    cancelAnimationFrame(this.raf);
    const tick = () => {
      if (!this.run) return;
      this.draw(performance.now());
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }
  hide(): void {
    this.run = null;
    cancelAnimationFrame(this.raf);
    this.root.hidden = true;
  }

  private draw(now: number): void {
    const r = this.run!;
    const c = this.ctx,
      w = W / S,
      hh = H / S;
    const k = Math.min(1, (now - r.t0) / r.ms);
    const reduced = this.reduced();
    // sea with drifting wave marks, the parchment showing at the edges like an old chart
    c.fillStyle = '#cdb985';
    c.fillRect(0, 0, w, hh);
    c.fillStyle = '#3f7f8f';
    c.fillRect(4, 4, w - 8, hh - 8);
    c.fillStyle = '#6fb4b8';
    const drift = reduced ? 0 : Math.floor(now / 160);
    for (let y = 10; y < hh - 8; y += 9)
      for (let x = ((y * 7 + drift) % 14) + 6; x < w - 8; x += 14) {
        c.fillRect(x, y, 3, 1);
        c.fillRect(x + 1, y - 1, 1, 1);
      }
    // the two harbours: a spit of sand, a quay and a light
    const left = 22,
      right = w - 22,
      y0 = hh / 2 + 6;
    for (const x of [left, right]) {
      c.fillStyle = '#e7d39a';
      c.beginPath();
      c.ellipse(x, y0 + 4, 16, 9, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#4b7a3a';
      c.beginPath();
      c.ellipse(x, y0 + 2, 10, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#7a5a22';
      c.fillRect(x - 1, y0 - 8, 2, 8);
      c.fillStyle = '#ffe9a6';
      c.fillRect(x - 1, y0 - 10, 2, 2);
    }
    // the dotted course, an arc over the open sea
    const at = (t: number) => {
      const p = r.east ? t : 1 - t;
      return { x: left + (right - left) * p, y: y0 - 6 - Math.sin(Math.PI * p) * (hh / 2 - 16) };
    };
    c.fillStyle = '#f0e2bd';
    for (let i = 0; i <= 40; i += 2) {
      const p = at(i / 40);
      c.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    // the sloop: hull, mast and a sail, bobbing on the swell, with a little wake
    const p = at(k),
      bob = reduced ? 0 : Math.round(Math.sin(now / 220));
    const sx = Math.round(p.x),
      sy = Math.round(p.y) + bob,
      dir = r.east ? 1 : -1;
    c.fillStyle = '#d6eef0';
    for (let i = 1; i <= 3; i++) c.fillRect(sx - dir * (4 + i * 3), sy + 2, 2, 1);
    c.fillStyle = '#5a3a1e';
    c.fillRect(sx - 5, sy, 10, 2);
    c.fillRect(sx - 4, sy + 2, 8, 1);
    c.fillStyle = '#3a2412';
    c.fillRect(sx, sy - 9, 1, 9);
    c.fillStyle = '#f4ead0';
    for (let i = 0; i < 7; i++)
      c.fillRect(sx + (dir > 0 ? 1 : -1 - Math.max(0, 6 - i)), sy - 8 + i, Math.max(1, 6 - i), 1);
    c.fillStyle = '#2f6fa8';
    c.fillRect(sx, sy - 11, dir * 3, 2);
  }
}
