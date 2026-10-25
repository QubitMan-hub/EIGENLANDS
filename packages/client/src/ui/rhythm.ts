import { beatTimes, type RhythmResultMsg, type RhythmStartMsg } from '@eigenlands/shared';
import type { Audio } from '../audio';
import type { ServerClock } from '../net/interp';
import { h } from './dom';

/**
 * Timing minigame overlay for forging and fishing. The server owns the schedule (server epoch ms);
 * we render beats scrolling toward a target, record press times in the same domain and send them back.
 */
export class RhythmOverlay {
  private root = h('div', { class: 'overlay rhythm' });
  private canvas = h('canvas', { class: 'rcanvas' });
  private title = h('div', { class: 'rtitle' });
  private hint = h('div', { class: 'rhint', text: 'Press Space / E / click / tap on the beat' });
  private raf = 0;
  private active: {
    msg: RhythmStartMsg;
    hits: number[];
    flashes: Array<{ at: number; text: string; color: string }>;
    sent: boolean;
    beats: number[];
  } | null = null;
  private resultBox = h('div', { class: 'rresult' });

  constructor(
    private clock: () => ServerClock,
    private audio: Audio,
    private send: (id: string, hits: number[]) => void,
  ) {
    this.canvas.width = 640;
    this.canvas.height = 200;
    this.root.append(h('div', { class: 'card rcard' }, this.title, this.canvas, this.hint, this.resultBox));
    this.root.hidden = true;
    document.body.append(this.root);
    const press = (e: Event) => {
      if (this.active && !this.root.hidden) {
        e.preventDefault();
        this.press();
      }
    };
    window.addEventListener('keydown', (e) => {
      if (this.active && !e.repeat && (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter')) press(e);
    });
    this.root.addEventListener('pointerdown', press);
  }

  get open(): boolean {
    return !this.root.hidden;
  }
  /** test hook: beat times (server epoch ms) of the running round */
  debugBeats(): number[] | null {
    return this.active && !this.active.sent ? this.active.beats : null;
  }
  /** test hook: press as if the player hit the key now */
  debugPress(): void {
    this.press();
  }

  start(msg: RhythmStartMsg): void {
    this.active = { msg, hits: [], flashes: [], sent: false, beats: beatTimes(msg.plan) };
    this.title.textContent = msg.label;
    this.resultBox.textContent = '';
    this.hint.hidden = false;
    this.root.hidden = false;
    this.root.classList.toggle('fish', msg.kind === 'fish');
    cancelAnimationFrame(this.raf);
    this.loop();
  }

  private now(): number {
    return this.clock().serverNow(performance.now());
  }

  private press(): void {
    const a = this.active;
    if (!a || a.sent) return;
    const t = this.now();
    a.hits.push(t);
    let best = Infinity;
    for (const b of a.beats) best = Math.min(best, Math.abs(t - b));
    const w = a.msg.plan.windowMs;
    const [text, color] =
      best < w * 0.25
        ? ['PERFECT', '#fcd45a']
        : best < w * 0.6
          ? ['Good', '#7bc95a']
          : best < w
            ? ['Ok', '#7cd0ff']
            : ['Miss', '#d44a4a'];
    a.flashes.push({ at: performance.now(), text, color });
    this.audio.play(best < w ? 'hit' : 'swing');
  }

  private loop = (): void => {
    const a = this.active;
    if (!a) return;
    const ctx = this.canvas.getContext('2d')!;
    const W = this.canvas.width,
      H = this.canvas.height;
    const t = this.now(),
      plan = a.msg.plan;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b0c1a';
    ctx.fillRect(0, 0, W, H);
    const lane = H / 2,
      tx = 110,
      speed = 0.32;
    ctx.fillStyle = '#2c2f4a';
    ctx.fillRect(0, lane - 4, W, 8);
    const fish = a.msg.kind === 'fish';
    // hit zone
    ctx.fillStyle = 'rgba(90,240,208,.14)';
    ctx.fillRect(tx - plan.windowMs * speed, lane - 46, plan.windowMs * speed * 2, 92);
    ctx.strokeStyle = '#5af0d0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tx, lane, 30, 0, Math.PI * 2);
    ctx.stroke();
    let judged = 0;
    a.beats.forEach((b, i) => {
      const x = tx + (b - t) * speed;
      if (b - t < -plan.windowMs) {
        judged++;
        return;
      }
      if (x > W + 30) return;
      const pulse = 1 - Math.min(1, Math.abs(b - t) / 300);
      ctx.fillStyle = fish ? '#7cd0ff' : '#f8a84a';
      ctx.beginPath();
      ctx.arc(x, lane, 18 + 6 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f4ff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), x, lane + 6);
    });
    if (t < plan.startAt) {
      ctx.fillStyle = '#f4f4ff';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Get ready… ${Math.max(1, Math.ceil((plan.startAt - t) / 1000))}`, W / 2, 40);
    }
    const nowL = performance.now();
    a.flashes = a.flashes.filter((f) => nowL - f.at < 700);
    a.flashes.forEach((f) => {
      ctx.globalAlpha = 1 - (nowL - f.at) / 700;
      ctx.fillStyle = f.color;
      ctx.font = 'bold 26px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, tx, lane - 56 - (nowL - f.at) / 25);
      ctx.globalAlpha = 1;
    });
    // beat tick sound when a beat crosses the target
    if (judged === a.beats.length && !a.sent && t > a.beats[a.beats.length - 1]! + plan.windowMs + 250) {
      a.sent = true;
      this.send(a.msg.id, a.hits);
      this.resultBox.textContent = 'Judging…';
      this.hint.hidden = true;
    }
    if (a.sent && t > a.beats[a.beats.length - 1]! + 9000) {
      this.close();
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  result(m: RhythmResultMsg): void {
    if (!this.active || this.active.msg.id !== m.id) return;
    cancelAnimationFrame(this.raf);
    this.resultBox.textContent = '';
    this.resultBox.append(
      h('div', { class: m.ok ? 'good big' : 'bad big', text: m.text }),
      h('div', { class: 'small', text: `Accuracy ${Math.round(m.accuracy * 100)}%` }),
      h('button', { class: 'primary', text: 'Continue', on: { click: () => this.close() } }),
    );
    this.audio.play(m.ok ? 'levelup' : 'hurt');
    this.active = null;
  }

  close(): void {
    cancelAnimationFrame(this.raf);
    this.active = null;
    this.root.hidden = true;
  }
}
