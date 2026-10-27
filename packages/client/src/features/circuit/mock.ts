/**
 * DEV ONLY (loaded with `?p3mock=1` on a Vite dev build; never part of a production bundle): a tiny in-browser stand-in
 * for the server's Circuit module, so the Board, casting, tutorial and spell rendering can be driven and screenshotted
 * before the real server module lands. It follows the protocol contract (MSG34) and the shared rules, not the server code.
 */
import {
  ABILITIES,
  CLASSES,
  MSG34,
  SPELL,
  TUTORIAL,
  TUTORIAL_DONE,
  TUTORIAL_REWARD,
  TUTORIAL_SKIP_GATES,
  attuneLocks,
  castLines,
  checkBoard,
  emptyGateCounts,
  evaluate,
  lineErrors,
  allowedAbilities,
  validBoard,
  ATTUNE_COOLDOWN_MS,
  RESOURCE_MAX,
  type AbilityId,
  type Board,
  type CastResultMsg,
  type ClassId,
  type GateId,
  type ProgressMsg,
} from '@eigenlands/shared';
import { lineGates } from './model';
import { starterBoard } from './state';
import type { SpellLike } from './spells';

export interface MockCtx {
  emit(type: string, msg: unknown): void;
  toast(text: string): void;
  now(): number;
  me(): { x: number; y: number } | null;
  myId(): string;
  others(): string[];
}

interface Live extends SpellLike {
  until: number;
  vx: number;
  vy: number;
}

export class MockServer {
  private p: Required<Omit<ProgressMsg, 'spec' | 'second'>> & { spec: string | null; second: ClassId | null };
  private res = 0;
  private live: Live[] = [];
  private seq = 0;

  constructor(private c: MockCtx) {
    this.p = {
      cls: 'wanderer',
      spec: null,
      second: null,
      board: starterBoard(),
      locks: {},
      gates: emptyGateCounts(),
      runes: 0,
      qubits: 1,
      codex: [],
      tutorial: { step: 0, count: 0, skipped: false },
      attuneReady: 0,
      cd: {},
    };
    setTimeout(() => this.c.emit(MSG34.PROGRESS, structuredClone(this.p)), 300);
  }

  private send(part: ProgressMsg): void {
    this.c.emit(MSG34.PROGRESS, structuredClone(part));
  }
  private grant(g: GateId[]): void {
    for (const x of g) this.p.gates[x] = (this.p.gates[x] ?? 0) + 1;
  }

  private advance(): void {
    const t = this.p.tutorial;
    const done = TUTORIAL[t.step];
    if (done?.codex) for (const id of done.codex) if (!this.p.codex.includes(id)) this.p.codex.push(id);
    t.step++;
    t.count = 0;
    const next = TUTORIAL[t.step];
    if (next?.grant?.gates) this.grant(next.grant.gates);
    if (next?.grant?.qubitBonus) this.p.qubits += next.grant.qubitBonus;
    if (t.step >= TUTORIAL_DONE) {
      this.grant(TUTORIAL_REWARD.gates);
      this.p.runes += TUTORIAL_REWARD.runes;
    }
    this.send({ tutorial: t, gates: this.p.gates, codex: this.p.codex, qubits: this.p.qubits, runes: this.p.runes });
  }

  handle(type: string, msg: any): void {
    const now = this.c.now();
    const t = this.p.tutorial;
    const step = TUTORIAL[t.step];
    switch (type) {
      case MSG34.TUTORIAL:
        if (msg?.action === 'board_open' && step?.goal.kind === 'open_board' && !t.skipped) this.advance();
        if (msg?.action === 'skip' && !t.skipped && t.step < TUTORIAL_DONE) {
          t.skipped = true;
          this.grant(TUTORIAL_SKIP_GATES.filter(() => true));
          if (this.p.qubits < 2) this.p.qubits = 2;
          this.send({ tutorial: t, gates: this.p.gates, qubits: this.p.qubits });
        }
        return;
      case MSG34.ATTUNE: {
        if (now < this.p.attuneReady) {
          this.c.toast('Your orbs are still settling.');
          return;
        }
        const b = validBoard(msg?.board);
        const err = checkBoard(b, {
          qubits: this.p.qubits,
          gates: this.p.gates,
          runes: this.p.runes,
          allowed: allowedAbilities(this.p.cls, this.p.second, this.p.spec),
        });
        if (err) {
          this.c.toast(err);
          return;
        }
        this.p.board = b;
        this.p.locks = attuneLocks(b, this.p.qubits, Math.random);
        this.p.attuneReady = now + ATTUNE_COOLDOWN_MS;
        this.send({ board: b, locks: this.p.locks, attuneReady: this.p.attuneReady });
        if (step?.goal.kind === 'lock' && b.lines.some((l) => l.some((x) => x?.g === 'm'))) this.advance();
        return;
      }
      case MSG34.CAST:
        this.cast(Number(msg?.line), msg?.aimX ?? 1, msg?.aimY ?? 0, now);
        return;
      case MSG34.ULT: {
        const r: CastResultMsg = { ok: false, line: -1, ult: true, results: [] };
        if (this.p.cls === 'wanderer') r.error = 'Choose a path first.';
        else if (this.res < RESOURCE_MAX) r.error = `Not enough ${CLASSES[this.p.cls].resource.name}.`;
        else if ((this.p.cd.ult ?? 0) > now) r.error = 'Not ready yet.';
        else {
          r.ok = true;
          this.res = 0;
          this.p.cd.ult = now + 20000;
          r.cd = { ult: this.p.cd.ult };
          const me = this.c.me();
          if (me)
            for (let i = 0; i < 3; i++) {
              const a = (i / 3) * Math.PI * 2;
              this.spawn(
                { kind: SPELL.ECHO, x: me.x + Math.cos(a) * 1.4, y: me.y + Math.sin(a) * 1.4, hue: 6, dx: 0, dy: 1 },
                6000,
              );
            }
          this.c.emit(MSG34.RES, { v: this.res, max: RESOURCE_MAX });
        }
        this.c.emit(MSG34.CAST_R, r);
        return;
      }
      case MSG34.CHOOSE:
        if (
          msg?.what === 'class' &&
          this.p.cls === 'wanderer' &&
          (msg.cls === 'superposer' || msg.cls === 'entangler')
        ) {
          this.p.cls = msg.cls;
          if (this.p.qubits < 2) this.p.qubits = 2;
          const b = this.p.board;
          b.abilities = b.abilities.map(() => null);
          CLASSES[this.p.cls].abilities.forEach((a, i) => {
            if (i < this.p.qubits) b.abilities[i] = a;
          });
          this.p.locks = {};
          this.send({ cls: this.p.cls, board: b, locks: {}, qubits: this.p.qubits });
          if (step?.goal.kind === 'choose_class') this.advance();
        } else if (msg?.what === 'spec') {
          this.p.spec = msg.spec;
          this.send({ spec: msg.spec });
        } else if (msg?.what === 'second') {
          this.p.second = msg.cls;
          this.send({ second: msg.cls });
        }
        return;
      case MSG34.BUY_RUNE:
        this.p.runes++;
        this.send({ runes: this.p.runes });
        return;
      case 'p3_dev':
        if (msg?.cmd === 'gates') {
          for (const g of Object.keys(this.p.gates) as GateId[]) this.p.gates[g] += 5;
          this.p.runes += 4;
          this.p.qubits = Math.max(this.p.qubits, 4);
          this.send({ gates: this.p.gates, runes: this.p.runes, qubits: this.p.qubits });
        }
        if (msg?.cmd === 'tutorial') {
          while (this.p.tutorial.step < Math.min(TUTORIAL_DONE, Number(msg.step) || 0)) this.advance();
        }
        if (msg?.cmd === 'class' && msg.cls in CLASSES) this.handle(MSG34.CHOOSE, { what: 'class', cls: msg.cls });
        if (msg?.cmd === 'res') {
          this.res = typeof msg.v === 'number' ? msg.v : RESOURCE_MAX;
          this.c.emit(MSG34.RES, { v: this.res, max: RESOURCE_MAX });
        }
        return;
    }
  }

  private cast(line: number, ax: number, ay: number, now: number): void {
    const b: Board = this.p.board;
    const a = b.abilities[line] as AbilityId | null;
    const r: CastResultMsg = { ok: false, line, results: [] };
    if (!a) {
      r.error = 'That orb has no ability.';
      this.c.emit(MSG34.CAST_R, r);
      return;
    }
    if ((this.p.cd[a] ?? 0) > now) {
      r.error = 'Not ready yet.';
      this.c.emit(MSG34.CAST_R, r);
      return;
    }
    const ev = evaluate(b, this.p.qubits, this.p.locks);
    const lines = castLines(b, ev, line, lineErrors(b, this.p.qubits), Math.random);
    r.ok = true;
    r.results = lines.map((l) => ({
      q: l.q,
      ability: b.abilities[l.q] ?? null,
      bit: l.bit,
      hue: l.hue,
      misfire: l.misfire,
      link: l.link,
      locked: l.locked,
    }));
    this.p.cd[a] = now + ABILITIES[a].cd * 1000;
    r.cd = { [a]: this.p.cd[a] };
    this.c.emit(MSG34.CAST_R, r);
    const l = Math.hypot(ax, ay) || 1;
    for (const x of r.results) if (x.ability) this.effect(x.ability, x.bit, x.hue, ax / l, ay / l);
    if (this.p.cls !== 'wanderer') {
      this.res = Math.min(RESOURCE_MAX, this.res + 12);
      this.c.emit(MSG34.RES, { v: this.res, max: RESOURCE_MAX });
    }
    // tutorial goals
    const st = TUTORIAL[this.p.tutorial.step];
    if (!st || this.p.tutorial.skipped) return;
    const g = st.goal;
    const tp = this.p.tutorial;
    if (g.kind === 'casts' && line === 0 && JSON.stringify(lineGates(b, 0)) === JSON.stringify(g.pattern)) {
      tp.count++;
      if (tp.count >= g.n) this.advance();
      else this.send({ tutorial: tp });
    }
    if (g.kind === 'kills') {
      tp.count++;
      if (tp.count >= g.n) this.advance();
      else this.send({ tutorial: tp });
    }
    if (g.kind === 'link_cast' && r.results.length >= 2) this.advance();
  }

  private effect(a: AbilityId, bit: 0 | 1, hue: number, dx: number, dy: number): void {
    const me = this.c.me();
    if (!me) return;
    const f = ABILITIES[a].forms[bit];
    switch (f.kind) {
      case 'bolt':
      case 'link_enemy':
      case 'link_ally': {
        const n = f.count ?? 1,
          spread = ((f.spread ?? 0) * Math.PI) / 180;
        for (let i = 0; i < n; i++) {
          const ang = Math.atan2(dy, dx) + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
          const sp = f.speed ?? 12;
          this.spawn(
            {
              kind: SPELL.BOLT,
              x: me.x + Math.cos(ang) * 0.5,
              y: me.y + Math.sin(ang) * 0.5,
              hue,
              dx: Math.cos(ang),
              dy: Math.sin(ang),
            },
            ((f.range ?? 9) / sp) * 1000,
            Math.cos(ang) * sp,
            Math.sin(ang) * sp,
          );
        }
        if (f.kind !== 'bolt') {
          const t = this.c.others()[0];
          if (t) this.spawn({ kind: SPELL.TETHER, x: me.x, y: me.y, hue, target: t, dx: 0, dy: 0 }, 8000);
        }
        break;
      }
      case 'strike':
        this.spawn({ kind: SPELL.STRIKE, x: me.x, y: me.y, hue, r: f.radius ?? 2.5, dx, dy }, 400);
        break;
      case 'party_heal':
      case 'party_ward':
      case 'summon':
      case 'ring':
      case 'pulse_dmg':
      case 'pulse_heal':
        this.spawn(
          { kind: SPELL.RING, x: me.x, y: me.y, hue, r: f.radius && f.radius < 5 ? f.radius : 2.5, dx: 0, dy: 0 },
          600,
        );
        break;
      case 'blink':
      case 'blink_back':
        this.spawn({ kind: SPELL.BLINK, x: me.x, y: me.y, hue, dx, dy }, 400);
        this.spawn({ kind: SPELL.ECHO, x: me.x, y: me.y, hue, dx, dy }, (f.secs ?? 4) * 1000);
        break;
      case 'shield':
        this.spawn({ kind: SPELL.SHIELD, x: me.x, y: me.y, hue, r: 0.9, dx: 0, dy: 0 }, (f.secs ?? 5) * 1000);
        break;
      case 'mirror':
        this.spawn({ kind: SPELL.MIRROR, x: me.x, y: me.y, hue, r: 0.9, dx: 0, dy: 0 }, (f.secs ?? 5) * 1000);
        break;
      case 'ward':
        this.spawn({ kind: SPELL.WARD, x: me.x, y: me.y, hue, r: 0.9, dx: 0, dy: 0 }, (f.secs ?? 6) * 1000);
        break;
      default:
        this.spawn({ kind: SPELL.RING, x: me.x, y: me.y, hue, r: 1.2, dx: 0, dy: 0 }, 500);
    }
  }

  private spawn(
    s: Partial<SpellLike> & { kind: number; x: number; y: number; hue: number },
    ms: number,
    vx = 0,
    vy = 0,
  ): void {
    this.live.push({
      id: `mock${++this.seq}`,
      owner: this.c.myId(),
      target: '',
      r: 0,
      dx: 0,
      dy: 0,
      ...s,
      until: performance.now() + ms,
      vx,
      vy,
    });
  }

  /** Advance the fake spells (20 Hz is plenty; the renderer interpolates). */
  tick(dtMs: number): SpellLike[] {
    const now = performance.now();
    this.live = this.live.filter((s) => s.until > now);
    for (const s of this.live) {
      s.x += (s.vx * dtMs) / 1000;
      s.y += (s.vy * dtMs) / 1000;
    }
    return this.live;
  }
}
