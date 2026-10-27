import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DOMAIN_COOLDOWN,
  DOMAIN_POWER,
  DOMAIN_RADIUS,
  ENEMY_DEFS,
  EXCHANGE_COOLDOWN,
  LEGEND_LEVEL,
  MSG34,
  newShadow,
  shadowStats,
  type ShadowEvent,
  type ShadowRec,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, clearEnemies, dummy, flatten, setLevel, spawn3, sleep, tp, until, type P3 } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3();
});
afterAll(async () => {
  await sleep(300);
  await app?.close();
});

type Unit = { rec: ShadowRec; en: { x: number; y: number; hp: number; maxHp: number }; downUntil: number };
type Live = { data: { roster: ShadowRec[] }; units: Map<string, Unit> };
const live = (p: P3) => (p.room.shadows as unknown as { stateOf: (s: string) => Live }).stateOf(p.sp.id);
const events = (p: P3): ShadowEvent[] => {
  const out: ShadowEvent[] = [];
  p.r.onMessage(MSG34.SHADOW_EV, (m: ShadowEvent) => out.push(m));
  return out;
};
/** put shadows of the given kinds in the roster and summon them all */
async function army(p: P3, kinds: string[]): Promise<Unit[]> {
  const L = live(p);
  for (const [i, k] of kinds.entries()) {
    const rec = newShadow(`t${i}${k.slice(0, 6)}`, ENEMY_DEFS[k as keyof typeof ENEMY_DEFS].kind, 10);
    L.data.roster.push(rec);
    p.r.send(MSG34.SHADOW_CMD, { act: 'summon', id: rec.id });
  }
  await until(() => L.units.size === kinds.length, 3000);
  return [...L.units.values()];
}

describe('shadow powers', () => {
  it('Shadow Exchange: you and your farthest shadow trade places, then it must gather itself', async () => {
    const p = await spawn3(app, 'Swapper');
    const ev = events(p);
    await tp(p, 700.5, 700.5);
    flatten(p.room, 700, 700, 20);
    clearEnemies(p.room);
    await setLevel(p, 12);
    const [u] = await army(p, ['wolf']);
    // send the shadow off to stand some way from you
    u!.en.x = 712.5;
    u!.en.y = 704.5;
    const before = { x: p.sp.sim.x, y: p.sp.sim.y };
    p.r.send(MSG34.SHADOW_CMD, { act: 'exchange' });
    await until(() => ev.some((e) => e.kind === 'exchanged'), 2000);
    expect(Math.hypot(p.sp.sim.x - 712.5, p.sp.sim.y - 704.5)).toBeLessThan(1.5);
    expect(Math.hypot(u!.en.x - before.x, u!.en.y - before.y)).toBeLessThan(1.5);
    // on cooldown now
    p.r.send(MSG34.SHADOW_CMD, { act: 'exchange' });
    await until(() => ev.some((e) => e.kind === 'refused'), 2000);
    expect((ev.find((e) => e.kind === 'refused') as { text: string }).text).toMatch(/gathers itself/);
    expect(EXCHANGE_COOLDOWN).toBeGreaterThan(5);
    await p.r.leave();
  });

  it("Monarch's Domain: needs an army; heals it, sharpens it and slows every foe inside", async () => {
    const p = await spawn3(app, 'Monarch');
    const ev = events(p);
    await tp(p, 760.5, 700.5);
    flatten(p.room, 760, 700, 20);
    clearEnemies(p.room);
    await setLevel(p, 16);
    const [a] = await army(p, ['wolf']);
    p.r.send(MSG34.SHADOW_CMD, { act: 'domain' });
    await until(() => ev.some((e) => e.kind === 'refused'), 2000);
    expect((ev.find((e) => e.kind === 'refused') as { text: string }).text).toMatch(/needs an army/);
    const both = [a!, ...(await army(p, ['brute']))];
    for (const u of both) u.en.hp = Math.round(u.en.maxHp / 2);
    const foe = dummy(p.room, p.sp.sim.x + 3, p.sp.sim.y);
    p.r.send(MSG34.SHADOW_CMD, { act: 'domain' });
    await until(() => ev.some((e) => e.kind === 'domain'), 2000);
    for (const u of both) expect(u.en.hp).toBeGreaterThan(u.en.maxHp / 2);
    await until(() => (foe as unknown as { slowT: number }).slowT > 0, 2000);
    // a shadow inside the domain hits harder
    const mod = p.room.shadows as unknown as { power: (L: Live, u: Unit) => number };
    expect(mod.power(live(p), both[0]!)).toBeCloseTo(DOMAIN_POWER, 5);
    both[0]!.en.x = p.sp.sim.x + DOMAIN_RADIUS + 3;
    expect(mod.power(live(p), both[0]!)).toBe(1);
    expect(DOMAIN_COOLDOWN).toBeGreaterThan(60);
    await p.r.leave();
  });

  it('a guardian rises named, with its trait; the Phoenix’s shadow is reborn once when it falls', async () => {
    const p = await spawn3(app, 'Arise');
    const ev = events(p);
    await tp(p, 820.5, 700.5);
    flatten(p.room, 820, 700, 20);
    clearEnemies(p.room);
    await setLevel(p, 16);
    const ignis = newShadow('ig', ENEMY_DEFS.eyrie_phoenix.kind, 2);
    expect(ignis.name).toBe('Ignis');
    expect(ignis.trait).toBe('rebirth');
    expect(ignis.level).toBeGreaterThanOrEqual(LEGEND_LEVEL);
    // a boss's shadow keeps only a fraction of its bulk
    expect(shadowStats(ENEMY_DEFS.eyrie_phoenix.kind, 6).hp).toBeLessThan(ENEMY_DEFS.eyrie_phoenix.hp);
    expect(newShadow('gl', ENEMY_DEFS.umbral_maw.kind, 6).trait).toBe('devour');
    expect(newShadow('tk', ENEMY_DEFS.the_unwound.kind, 6).trait).toBe('rewind');
    const [u] = await army(p, ['eyrie_phoenix']);
    expect(u!.rec.trait).toBe('rebirth');
    // a killing blow: it bursts back to full instead of falling
    const mod = p.room.shadows as unknown as { strikeShadows: (e: unknown, shape: unknown, dmg: number) => void };
    const shape = { kind: 'circle', x: u!.en.x, y: u!.en.y, r: 2 };
    mod.strikeShadows({}, shape, u!.en.maxHp * 5);
    expect(u!.downUntil).toBe(0);
    expect(u!.en.hp).toBe(u!.en.maxHp);
    await until(() => ev.some((e) => e.kind === 'trait'), 2000);
    // the second time, within the cooldown, it falls like any other
    mod.strikeShadows({}, { ...shape, x: u!.en.x, y: u!.en.y }, u!.en.maxHp * 5);
    expect(u!.downUntil).toBeGreaterThan(0);
    await p.r.leave();
  });

  it('a saved trait is the one its kind rises with, never a forged one', async () => {
    const { clean } = await import('../src/features/shadows');
    const wolf = newShadow('wf', ENEMY_DEFS.wolf.kind, 5);
    const maw = newShadow('mw', ENEMY_DEFS.umbral_maw.kind, 8);
    const saved = clean({
      roster: [
        { ...wolf, trait: 'rebirth' },
        { ...maw, trait: 'rebirth' },
      ],
      active: [],
    });
    expect(saved.roster.find((r) => r.id === 'wf')!.trait).toBeUndefined();
    expect(saved.roster.find((r) => r.id === 'mw')!.trait).toBe('devour');
  });
});
