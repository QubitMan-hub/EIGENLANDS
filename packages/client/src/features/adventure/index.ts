import { Graphics } from 'pixi.js';
import {
  BOSSES, BOSS_BY_KIND, ENEMY_BY_KIND, MSG34, SHRINE_REACH, shrinesNear, trapSafe,
  type BossEvent, type SeaEvent, type Shrine, type ShrineEvent,
} from '@eigenlands/shared';
import { keyLabel } from '../../input/keymap';
import { isoX, isoY } from '../../game/iso';
import { h } from '../../ui/dom';
import type { ClientModule, P34Deps } from '../types';

const CSS = `
#boss-bar{position:fixed;top:56px;left:50%;transform:translateX(-50%);width:min(520px,80vw);z-index:29;pointer-events:none;text-align:center;
  font:700 14px system-ui,sans-serif;color:#f4e8ff;text-shadow:0 1px 0 #000,0 0 8px #7a3ad0;opacity:0;transition:opacity .25s}
#boss-bar.on{opacity:1}
#boss-bar .bb-track{position:relative;height:16px;margin-top:4px;background:#0b0c1acc;border:2px solid #a46aff;border-radius:4px;overflow:hidden}
#boss-bar .bb-ghost,#boss-bar .bb-fill{position:absolute;left:0;top:0;bottom:0}
#boss-bar .bb-ghost{background:#fff;opacity:.75;transition:width .6s ease .3s}
#boss-bar .bb-fill{background:linear-gradient(#ff7a9a,#b02050);transition:width .15s}
#boss-bar .bb-tick{position:absolute;top:0;bottom:0;width:2px;background:#000a}
#boss-bar .bb-sub{font-size:11px;font-weight:500;opacity:.8;margin-top:2px}
#adv-banner{position:fixed;top:24%;left:50%;transform:translateX(-50%);z-index:40;pointer-events:none;text-align:center;font:700 28px/1.2 'Silkscreen',system-ui,sans-serif;color:#fff;
  text-shadow:0 2px 0 #000,0 0 18px #a46aff;opacity:0;transition:opacity .4s;letter-spacing:2px;padding:0 16px}
#adv-banner small{display:block;font:500 14px system-ui,sans-serif;letter-spacing:0;margin-top:6px;color:#e8dcff}
#adv-banner.on{opacity:1}
`;

const PILLAR_COLORS = [0x5af0d0, 0xff7ad0, 0xffd36a, 0x7ab4ff];

interface Flash { idx: number; at: number; until: number; ok?: boolean }

/** Bosses (health bar, banners, roars) and Resonance Shrines (beams, puzzle flashes, prompts, the compass). */
export class AdventureClient implements ClientModule {
  private bar: HTMLElement;
  private name: HTMLElement;
  private sub: HTMLElement;
  private fill: HTMLElement;
  private ghost: HTMLElement;
  private ticks: HTMLElement;
  private banner: HTMLElement;
  private bannerT = 0;
  private boss: { id: string; kind: number; hp: number; maxHp: number; x: number; y: number } | null = null;
  private solved = new Set<string>();
  private lanterns = new Map<string, number>();
  private trails = new Map<string, { pattern: number[]; stage: number; until: number }>();
  private gfx = new Graphics();
  private flashes = new Map<string, Flash[]>();
  private barrier = new Map<string, { until: number; wave: number; waves: number }>();
  private near: Shrine[] = [];
  private nearAt = 0;
  private prompt: string | null = null;
  private compassUntil = 0;
  private compassAt = -1e9;
  
  constructor(private d: P34Deps) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);
    this.name = h('div', { class: 'bb-name' });
    this.sub = h('div', { class: 'bb-sub' });
    this.fill = h('div', { class: 'bb-fill' });
    this.ghost = h('div', { class: 'bb-ghost' });
    this.ticks = h('div', {});
    this.bar = h('div', { id: 'boss-bar' }, this.name, h('div', { class: 'bb-track' }, this.ghost, this.fill, this.ticks), this.sub);
    this.banner = h('div', { id: 'adv-banner' });
    document.body.append(this.bar, this.banner);
    this.gfx.zIndex = 9e8;
    this.d.fxLayer().addChild(this.gfx);
  }

  handlers(): Record<string, (m: any) => void> {
    return {
      [MSG34.BOSS_EV]: (m: BossEvent) => this.onBoss(m),
      [MSG34.SHRINE_EV]: (m: ShrineEvent) => this.onShrine(m),
      [MSG34.SEA_EV]: (m: SeaEvent) => { this.d.sfx(m.kind === 'board' ? 'splash' : 'pickup'); },
    };
  }

  /** H: board your sloop at the water's edge, or step ashore (needs a Sloop Charter). */
  action(a: string): boolean {
    if (a !== 'sail') return false;
    if (!this.d.wins.open && !this.d.dead()) try { this.d.net().send(MSG34.BOARD, {}); } catch { /* offline */ }
    return true;
  }

  // ───────────────────────── bosses ─────────────────────────

  private say(title: string, sub: string, ms = 3600): void {
    this.banner.innerHTML = '';
    this.banner.append(title, h('small', { text: sub }));
    this.banner.classList.add('on');
    window.clearTimeout(this.bannerT);
    this.bannerT = window.setTimeout(() => this.banner.classList.remove('on'), ms);
  }

  private onBoss(m: BossEvent): void {
    this.d.sfx('die');
    if (m.kind === 'start') { this.say(m.name.toUpperCase(), m.intro); this.d.fx().shake = Math.max(this.d.fx().shake, 1.2); }
    else if (m.kind === 'phase') { this.say(BOSSES[m.boss].name, m.text, 2600); this.d.sfx('heavy'); }
    else { this.say('VICTORY', m.first ? `${m.name} falls. First victory!` : `${m.name} falls.`, 4200); this.d.sfx('levelup'); }
  }

  onState(s: any): void {
    let best: AdventureClient['boss'] = null;
    s?.enemies?.forEach?.((e: { kind: number; hp: number; maxHp: number; x: number; y: number }, id: string) => {
      if (!ENEMY_BY_KIND[e.kind]?.boss || e.hp <= 0) return;
      if (!best || e.maxHp > best.maxHp) best = { id, kind: e.kind, hp: e.hp, maxHp: e.maxHp, x: e.x, y: e.y };
    });
    this.boss = best;
  }

  // ───────────────────────── shrines ─────────────────────────

  private onShrine(m: ShrineEvent): void {
    const now = performance.now();
    switch (m.kind) {
      case 'state': this.solved = new Set(m.solved); break;
      case 'balance': this.lanterns.set(m.shrine, m.mask); break;
      case 'trail': this.trails.set(m.shrine, { pattern: m.pattern, stage: m.stage, until: now + m.seconds * 1000 }); break;
      case 'show': {
        const list: Flash[] = [];
        m.pattern.forEach((idx, i) => list.push({ idx, at: now + 700 + i * m.stepMs, until: now + 700 + i * m.stepMs + m.stepMs * 0.8 }));
        this.flashes.set(m.shrine, list);
        break;
      }
      case 'hit': {
        const l = this.flashes.get(m.shrine) ?? [];
        l.push({ idx: m.idx, at: now, until: now + 450, ok: m.ok });
        this.flashes.set(m.shrine, l);
        this.d.sfx(m.ok ? 'levelup' : 'hurt');
        break;
      }
      case 'fail': this.d.fx().shake = Math.max(this.d.fx().shake, 0.7); break;
      case 'barrier':
        if (m.on) this.barrier.set(m.shrine, { until: now + 1e9, wave: m.wave ?? 1, waves: m.waves ?? 3 }); else { this.barrier.delete(m.shrine); this.lanterns.delete(m.shrine); this.trails.delete(m.shrine); }
        if (m.on && m.wave) this.say(`WAVE ${m.wave} / ${m.waves}`, 'Hold the seal.', 1800);
        break;
      case 'solved': this.say('RESONANCE', m.text, 3600); this.d.sfx('levelup'); break;
    }
  }

  private shrineScreen(sh: Shrine, dx: number, dy: number): { x: number; y: number } { return { x: isoX(sh.x + dx + 0.5, sh.y + dy + 0.5), y: isoY(sh.x + dx + 0.5, sh.y + dy + 0.5) }; }

  frame(now: number): void {
    const me = this.d.me();
    // boss bar
    const b = this.boss && me && Math.hypot(this.boss.x - me.x, this.boss.y - me.y) < 40 ? this.boss : null;
    this.bar.classList.toggle('on', !!b);
    if (b) {
      const def = BOSS_BY_KIND[b.kind]!;
      const pct = Math.max(0, Math.min(100, (b.hp / b.maxHp) * 100));
      this.name.textContent = def.name;
      this.fill.style.width = `${pct}%`; this.ghost.style.width = `${pct}%`;
      this.sub.textContent = `${Math.round(b.hp)} / ${Math.round(b.maxHp)}`;
      if (!this.ticks.childElementCount) for (const ph of def.phases) this.ticks.append(h('i', { class: 'bb-tick', style: `left:${ph * 100}%` }));
    } else if (this.ticks.childElementCount) this.ticks.replaceChildren();
    if (!me) return;
    // nearby shrines (recomputed twice a second)
    if (now - this.nearAt > 500) { this.d.shrineProgress?.([...this.solved]); this.nearAt = now; this.near = shrinesNear(this.d.store().seed, me.x, me.y, 160); }
    const g = this.gfx;
    g.clear();
    const reduced = this.d.settings().reducedMotion;
    this.prompt = null;
    for (const sh of this.near) {
      const done = this.solved.has(sh.id);
      if (done) continue; // completed projections disappear for their solver
      const dist = Math.hypot(sh.x - me.x, sh.y - me.y);
      const c = this.shrineScreen(sh, 0, 0);
      // a faint beam of light marks every shrine you can still solve (and a calm ring on solved ones)
      const pulse = reduced ? 0.7 : 0.6 + 0.4 * Math.sin(now / 500 + sh.x);
      if (!done) {
        const fade = Math.min(1, Math.max(0.25, 1 - dist / 200));
        g.rect(c.x - 1, c.y - 140, 2, 140).fill({ color: 0xa46aff, alpha: 0.18 * fade * pulse });
        g.rect(c.x - 3, c.y - 140, 6, 140).fill({ color: 0xa46aff, alpha: 0.06 * fade });
      } else g.ellipse(c.x, c.y, 18, 9).stroke({ color: 0x5af0d0, width: 1, alpha: 0.4 });
      if (dist > 30) continue;
      // pillars: dormant glow, flashes for the puzzle, solved shimmer
      const fl = this.flashes.get(sh.id) ?? [];
      sh.pillars.forEach(([dx, dy], i) => {
        const p = this.shrineScreen(sh, dx, dy);
        const course = sh.type === 'traps' || sh.type === 'platform';
        const safe = trapSafe(this.d.clock.serverNow(now), i);
        const col = course ? safe ? 0x71dca7 : 0xe88764 : PILLAR_COLORS[i]!;
        if (course) {
          g.ellipse(p.x, p.y + 1, 15, 7.5).stroke({ color: col, width: 2, alpha: .8 });
          if (!safe) for (let k = -2; k <= 2; k++) g.moveTo(p.x + k * 4 - 2, p.y).lineTo(p.x + k * 4, p.y - 5).lineTo(p.x + k * 4 + 2, p.y).stroke({ color: col, width: 1 });
        }
        const lantern = this.lanterns.get(sh.id), trail = this.trails.get(sh.id);
        let lit = lantern !== undefined && (lantern & (1 << i)) ? 0.8 : trail?.pattern[trail.stage] === i ? 1 : 0;
        for (const f of fl) if (f.idx === i && now >= f.at && now < f.until) lit = 1;
        const okFlash = fl.find((f) => f.idx === i && f.ok !== undefined && now < f.until);
        if (okFlash) { g.ellipse(p.x, p.y + 1, 14, 7).stroke({ color: okFlash.ok ? 0x7dffa0 : 0xff5a5a, width: 2, alpha: 0.9 }); }
        g.ellipse(p.x, p.y + 1, 9, 4.5).fill({ color: col, alpha: 0.12 + 0.55 * lit });
        if (lit > 0.5) g.rect(p.x - 1.5, p.y - 46, 3, 44).fill({ color: col, alpha: 0.7 });
        g.circle(p.x, p.y - 44, 2.5 + 3 * lit).fill({ color: col, alpha: 0.35 + 0.65 * lit });
      });
      for (const [k, f] of [...this.flashes]) { const keep = f.filter((x) => x.until > now - 200); if (keep.length) this.flashes.set(k, keep); else this.flashes.delete(k); }
      const bar = this.barrier.get(sh.id);
      if (bar) { // the seal: a dome ring around the altar
        g.ellipse(c.x, c.y, 120, 60).stroke({ color: 0xff7ad0, width: 2, alpha: 0.5 + 0.3 * pulse });
        g.ellipse(c.x, c.y, 126, 63).stroke({ color: 0xffffff, width: 1, alpha: 0.25 });
      }
      if (dist < SHRINE_REACH + 1.5) this.prompt = done ? 'The shrine is quiet. Its shard is yours.' : sh.type === 'sequence'
        ? `${this.key()}: touch the altar. Watch the pillars, then strike them in order (${this.key()} on each).`
        : sh.type === 'balance' ? `${this.key()}: wake the altar, then light all four lanterns. Each toggles its clockwise neighbour.`
        : sh.type === 'platform' ? this.trails.has(sh.id) ? `${this.key()} on your pad: jump when the next pad is green. ${this.trails.get(sh.id)!.stage} / 4 jumps.` : `${this.key()}: begin the phase-platform circuit.`
        : sh.type === 'trail' || sh.type === 'traps' ? this.trails.has(sh.id) ? `${sh.type === 'traps' ? 'Tide traps: green is safe, red spikes hurt.' : 'Rune trail:'} ${this.trails.get(sh.id)!.stage} / 4 seals · ${Math.max(0, Math.ceil((this.trails.get(sh.id)!.until - now) / 1000))}s.` : `${this.key()}: wake the altar for a timed ${sh.type === 'traps' ? 'trap course' : 'rune trail'}.`
        : `${this.key()}: touch the altar to begin the gauntlet (three waves).`;
    }
  }

  private key(): string { const k = this.d.keys().interact?.[0]; return k ? keyLabel(k) : 'E'; }

  hint(): string | null {
    if (this.boss && this.bar.classList.contains('on')) return null;
    if (this.prompt) return this.prompt;
    // compass: the closest unsolved shrine within reach of your senses
    const me = this.d.me();
    if (!me) return null;
    let best: Shrine | null = null, bd = 90;
    for (const sh of this.near) { if (this.solved.has(sh.id)) continue; const dd = Math.hypot(sh.x - me.x, sh.y - me.y); if (dd < bd && dd > 12) { bd = dd; best = sh; } }
    if (!best || this.d.wins.open) return null;
    // the compass whispers once a minute, not constantly
    const t = performance.now();
    if (t > this.compassUntil) { if (t - this.compassAt < 60000) return null; this.compassAt = t; this.compassUntil = t + 7000; }
    const dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
    // world axes -> screen compass: iso x right = (+x,-y), screen down = (+x,+y)
    const sx = (best.x - me.x) - (best.y - me.y), sy = (best.x - me.x) + (best.y - me.y);
    const a = (Math.atan2(sy, sx) + Math.PI * 2) % (Math.PI * 2);
    return `A shrine hums to the ${dirs[Math.round(a / (Math.PI / 4)) % 8]}, about ${Math.round(bd)} tiles away.`;
  }

  debug(): Record<string, unknown> { return { boss: this.boss?.kind ?? null, shrinesNear: this.near.length, solved: this.solved.size }; }
}
