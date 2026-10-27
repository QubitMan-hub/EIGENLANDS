import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cottageFamily,
  cottagerOf,
  armorId,
  countItem,
  MSG,
  MSG34,
  COTTAGE_H,
  COTTAGE_W,
  MSG_TRAVEL,
  REALM_SITES,
  STABLE_FEE,
  T,
  arrivalOf,
  civOwner,
  cottageFurniture,
  cottagesEarned,
  growthPlots,
  realmNpcs,
  recruitFee,
  waystonesNear,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { civEntry } from '../src/features/civ/registry';
import { clean } from '../src/features/shadows';
import { cottageDialogue } from '../src/systems/cottages';
import { boot3, clearEnemies, dev, setLevel, sleep, spawn3, tp, until, type P3 } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await sleep(300);
  await app?.close();
});

/** a stone near the spawn, attuned by walking up to it */
async function attuneNear(p: P3) {
  const s = waystonesNear(p.room.seed, 0, 0, 300).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0]!;
  const a = arrivalOf(s);
  await tp(p, a.x, a.y);
  await until(() => (p.sp.data.prog.ways ?? []).includes(s.id), 4000);
  return s;
}

function fell(p: P3) {
  const e = p.room.spawnEnemy('brute', p.sp.sim.x + 1, p.sp.sim.y, false);
  p.sp.invuln = 0;
  (p.room as unknown as { hurtPlayer: (...a: unknown[]) => boolean }).hurtPlayer(p.sp, 99999, e, 1, 0, 0);
}

describe('death, by difficulty', () => {
  it('Hardcore leaves your pack in a satchel where you fell; you wake at your home stone and can recover it', async () => {
    const p = await spawn3(app, 'Hardy');
    await setLevel(p, 5);
    const stone = await attuneNear(p);
    p.sp.data.prog.home = stone.id;
    p.sp.data.needs.mode = 'hardcore';
    p.sp.data.coins = 400;
    await tp(p, 4.5, 9.5); // out in the open, beyond any settlement ward
    clearEnemies(p.room);
    const at = { x: Math.floor(p.sp.sim.x), y: Math.floor(p.sp.sim.y) };
    const carried = p.sp.data.inv.filter(Boolean).length;
    expect(carried).toBeGreaterThan(0);
    fell(p);
    expect(p.sp.deadT).toBeGreaterThan(0);
    expect(p.sp.data.coins).toBe(300);
    expect(p.sp.data.inv.some(Boolean)).toBe(false);
    let satchel: { x: number; y: number } | null = null;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const o = p.room.store.objectAt(at.x + dx, at.y + dy);
        if (o?.sub === 'lost_satchel') satchel = { x: o.x, y: o.y };
      }
    expect(satchel).toBeTruthy();
    // back on your feet at home
    const home = arrivalOf(stone);
    await until(() => p.sp.deadT <= 0, 15000);
    expect(Math.hypot(p.sp.sim.x - home.x, p.sp.sim.y - home.y)).toBeLessThan(0.6);
    // walk back and take everything: the satchel is gone once empty
    clearEnemies(p.room);
    await tp(p, satchel!.x + 0.5, satchel!.y + 1.5);
    for (let i = 0; i < 30; i++) {
      const o = p.room.store.objectAt(satchel!.x, satchel!.y);
      const slots = (o?.data as { slots?: Array<unknown> } | undefined)?.slots ?? [];
      const k = slots.findIndex(Boolean);
      if (k < 0) break;
      p.r.send(MSG.CHEST, { tx: satchel!.x, ty: satchel!.y, action: 'take', slot: k, n: 99 });
      await sleep(80);
    }
    await until(() => !p.room.store.objectAt(satchel!.x, satchel!.y), 4000);
    expect(p.sp.data.inv.filter(Boolean).length).toBe(carried);
    await p.r.leave();
  }, 60_000);

  it('Adventure costs a tenth of your coins; Cozy costs nothing', async () => {
    const p = await spawn3(app, 'Wary');
    await setLevel(p, 5);
    clearEnemies(p.room);
    p.sp.data.needs.mode = 'adventure';
    p.sp.data.coins = 200;
    fell(p);
    expect(p.sp.data.coins).toBe(180);
    expect(p.sp.data.inv.some(Boolean)).toBe(true);
    await until(() => p.sp.deadT <= 0, 15000);
    p.sp.data.needs.mode = 'cozy';
    fell(p);
    expect(p.sp.data.coins).toBe(180);
    await p.r.leave();
  }, 40_000);
});

describe('water and mounts', () => {
  it('a waterskin filled at a river is murky; drinking it can make you sick', async () => {
    const p = await spawn3(app, 'Drinker');
    // the nearest open water to the spawn
    let spot: { x: number; y: number } | null = null;
    for (let r = 8; r < 200 && !spot; r += 2)
      for (let a = 0; a < 6.28 && !spot; a += 0.1) {
        const x = Math.floor(Math.cos(a) * r),
          y = Math.floor(Math.sin(a) * r);
        await p.room.ensureChunk(Math.floor(x / 32), Math.floor(y / 32));
        const t = p.room.store.getTile(x, y);
        if ((t === T.WATER || t === T.DEEP_WATER) && !p.room.store.solidAt(x, y + 1)) spot = { x, y };
      }
    expect(spot).toBeTruthy();
    await tp(p, spot!.x + 0.5, spot!.y + 1.5);
    p.sp.data.inv[0] = { id: 'waterskin_empty', n: 1 };
    p.r.send(MSG.USE, { slot: 0, tx: spot!.x, ty: spot!.y });
    await until(() => p.sp.data.inv[0]?.id === 'waterskin_murky', 3000);
    p.sp.data.needs.mode = 'hardcore';
    p.sp.data.needs.water = 40;
    p.r.send(MSG.USE, { slot: 0, tx: 0, ty: 0 });
    await until(() => p.sp.data.inv[0]?.id === 'waterskin_empty', 3000);
    expect(p.sp.data.needs.water).toBeGreaterThan(60);
    await p.r.leave();
  });

  it('riding tires a mount; an exhausted mount sets you down and refuses; a stable rests it for a fee', async () => {
    const p = await spawn3(app, 'Rider');
    const stone = await attuneNear(p);
    clearEnemies(p.room);
    dev(p, { cmd: 'give', id: 'horse_whistle', n: 1 });
    await until(() => p.sp.data.inv.some((s) => s?.id === 'horse_whistle'), 3000);
    const slot = () => p.sp.data.inv.findIndex((s) => s?.id === 'horse_whistle');
    const a = arrivalOf(stone);
    await tp(p, a.x + 3, a.y + 3);
    p.r.send(MSG.USE, { slot: slot(), tx: 0, ty: 0 });
    await until(() => p.sp.sim.mount === 1, 3000);
    // a long ride: nearly spent, then a few more tiles
    p.sp.data.prog.mountWorn = { horse: 98 };
    await sleep(1200);
    await tp(p, a.x + 12, a.y + 3);
    await until(() => p.sp.sim.mount === 0, 4000);
    await until(() => p.toasts.some((t) => /exhausted/.test(t.text)), 3000);
    expect(p.toasts.some((t) => /exhausted/.test(t.text))).toBe(true);
    p.r.send(MSG.USE, { slot: slot(), tx: 0, ty: 0 });
    await until(() => p.toasts.some((t) => /worn out/.test(t.text)), 3000);
    expect(p.sp.sim.mount).toBe(0);
    // the hitching post's stable
    await tp(p, a.x, a.y);
    p.sp.data.coins = 50;
    p.r.send(MSG_TRAVEL.GO, { from: stone.id, stable: 'horse' });
    await until(() => !(p.sp.data.prog.mountWorn?.horse ?? 0), 3000);
    expect(p.sp.data.coins).toBe(50 - STABLE_FEE);
    p.r.send(MSG.USE, { slot: slot(), tx: 0, ty: 0 });
    await until(() => p.sp.sim.mount !== 0, 3000);
    await p.r.leave();
  }, 40_000);

  it('produce, protein and something hearty within half an hour leave you nourished', async () => {
    const p = await spawn3(app, 'Gourmet');
    p.sp.data.inv.fill(null);
    p.sp.data.inv[0] = { id: 'berry_jam', n: 1 };
    p.sp.data.inv[1] = { id: 'fish_fry', n: 1 };
    p.sp.data.inv[2] = { id: 'veggie_stew', n: 1 };
    p.sp.hp = Math.max(1, p.sp.maxHp - 20);
    p.sp.data.needs.food = 10;
    for (const slot of [0, 1, 2]) {
      p.r.send(MSG.USE, { slot, tx: 0, ty: 0 });
      await until(() => !p.sp.data.inv[slot], 3000);
      await sleep(450);
    }
    await until(() => p.toasts.some((t) => /balanced diet/.test(t.text)), 3000);
    expect(p.sp.data.buffs.regen?.until ?? 0).toBeGreaterThan(p.room.wclock.now() + 500_000);
    await p.r.leave();
  });
});

describe('hiring residents', () => {
  it('a guard who is a friend signs on for an hour, with one employer at a time and a refund for ending early', async () => {
    const a = await spawn3(app, 'Captain');
    const b = await spawn3(app, 'Rival');
    await setLevel(a, 6);
    await setLevel(b, 6);
    const guard = realmNpcs().find((n) => n.role === 'guard')!;
    // strangers are turned away
    expect(a.room.shadows.hire(a.sp, guard.id)).toMatch(/Get to know me/);
    a.sp.data.friends[guard.id] = { pts: 2000 } as never;
    b.sp.data.friends[guard.id] = { pts: 2000 } as never;
    a.sp.data.coins = b.sp.data.coins = 2000;
    const fee = recruitFee(guard.role, a.sp.level);
    expect(a.room.shadows.hire(a.sp, guard.id)).toMatch(/coins it is/);
    expect(a.sp.data.coins).toBe(2000 - fee);
    await until(() => !!a.room.shadows.stateOf(a.sid)?.data.roster.some((r) => r.npc === guard.id), 3000);
    expect(a.room.shadows.employerOf(guard.id)).toBe(a.sp);
    // nobody else can hire them meanwhile
    expect(b.room.shadows.hire(b.sp, guard.id)).toMatch(/sworn to Captain/);
    // ending at once refunds half of the unused hour
    const rec = a.room.shadows.stateOf(a.sid)!.data.roster.find((r) => r.npc === guard.id)!;
    a.r.send(MSG34.SHADOW_CMD, { act: 'release', id: rec.id });
    await until(() => !a.room.shadows.employerOf(guard.id), 3000);
    expect(a.sp.data.coins).toBeGreaterThanOrEqual(2000 - fee + Math.floor(fee * 0.49));
    // and now they are free for someone else
    expect(b.room.shadows.hire(b.sp, guard.id)).toMatch(/coins it is/);
    await a.r.leave();
    await b.r.leave();
  });
});

describe('hireling gear', () => {
  it('a hired resident fights harder with a lent blade, wears lent armour, and hands it all back', async () => {
    const a = await spawn3(app, 'Outfitter');
    await setLevel(a, 6);
    const guard = realmNpcs().filter((n) => n.role === 'guard')[1]!;
    a.sp.data.friends[guard.id] = { pts: 2000 } as never;
    a.sp.data.coins = 2000;
    expect(a.room.shadows.hire(a.sp, guard.id)).toMatch(/coins it is/);
    const L = () => a.room.shadows.stateOf(a.sid)!;
    await until(() => !!L()?.data.roster.some((r) => r.npc === guard.id), 3000);
    const rec = L().data.roster.find((r) => r.npc === guard.id)!;
    const unit = () => L().units.get(rec.id)!;
    await until(() => !!unit(), 3000);
    const before = { dmg: unit().en.dmgMult, hp: unit().en.maxHp };
    const vest = armorId('iron', 'chest');
    a.sp.data.inv[20] = { id: 'sword', n: 1, p: { atk: 4 } };
    a.sp.data.inv[21] = { id: vest, n: 1 };
    a.sp.data.inv[22] = { id: 'wood', n: 5 };
    // only arms and armour
    a.r.send(MSG34.SHADOW_CMD, { act: 'give_gear', id: rec.id, slot: 22 });
    a.r.send(MSG34.SHADOW_CMD, { act: 'give_gear', id: rec.id, slot: 20 });
    a.r.send(MSG34.SHADOW_CMD, { act: 'give_gear', id: rec.id, slot: 21 });
    await until(() => !!rec.gear?.weapon && !!rec.gear?.chest, 3000);
    expect(a.sp.data.inv[22]).toEqual({ id: 'wood', n: 5 });
    expect(a.sp.data.inv[20]).toBeNull();
    expect(unit().en.dmgMult).toBeGreaterThan(before.dmg);
    expect(unit().en.maxHp).toBeGreaterThan(before.hp);
    expect(unit().st.held).toBe('sword');
    // taken back on request
    a.r.send(MSG34.SHADOW_CMD, { act: 'take_gear', id: rec.id });
    await until(() => !rec.gear, 3000);
    expect(countItem(a.sp.data.inv, 'sword')).toBeGreaterThanOrEqual(1);
    expect(countItem(a.sp.data.inv, vest)).toBe(1);
    expect(unit().en.maxHp).toBe(before.hp);
    // lent again, then the contract ends: it all comes home
    const slot = a.sp.data.inv.findIndex((s) => s?.id === vest);
    a.r.send(MSG34.SHADOW_CMD, { act: 'give_gear', id: rec.id, slot });
    await until(() => !!rec.gear?.chest, 3000);
    rec.contractUntil = Date.now() - 1;
    await until(() => countItem(a.sp.data.inv, vest) === 1, 4000);
    // a lease that ran out while away hands its kit back on the next login
    const saved = clean({
      roster: [{ id: 'x1', kind: 21, npc: guard.id, contractUntil: Date.now() - 5, gear: { chest: { id: vest, n: 1 } } }],
    });
    expect(saved.roster.length).toBe(0);
    expect(saved.pending).toEqual([{ id: vest, n: 1 }]);
    await a.r.leave();
  });
});

describe('settlement growth', () => {
  it('a prosperous kingdom raises real cottages on a settlement’s outskirts, one a day, owned by the crown', async () => {
    const p = await spawn3(app, 'Surveyor');
    const room = p.room;
    await room.civ.ready();
    const w = civEntry(room.seed).w!;
    const site = REALM_SITES.find((s) => s.kind === 'village' && room.owns(Math.floor(s.cx), Math.floor(s.cy)))!;
    expect(site).toBeTruthy();
    const k = w.kingdoms[site.realm];
    k.prosperity = 90;
    const want = cottagesEarned(k, site);
    expect(want).toBeGreaterThanOrEqual(3);
    const owner = civOwner(site.realm);
    const standing = () =>
      growthPlots(room.seed, site).filter((pl) => room.store.structureAt(pl.x, pl.y)?.owner === owner);
    const before = standing().length;
    for (let i = 0; i < want + 2; i++) await room.civ.grow(true);
    const now = standing();
    // one per growth step, never more than earned (some seeded plots may be on a slope or a road and are skipped)
    expect(now.length).toBeGreaterThan(before);
    expect(now.length).toBeLessThanOrEqual(want);
    // each cottage is a whole little house: 20 cells with floor and roof, walls round the edge and a door
    const pl = now[0]!;
    let walls = 0,
      doors = 0;
    for (let dy = 0; dy < COTTAGE_H; dy++)
      for (let dx = 0; dx < COTTAGE_W; dx++) {
        const c = room.store.structureAt(pl.x + dx, pl.y + dy)!;
        expect(c.owner).toBe(owner);
        expect(c.data.floor && c.data.roof).toBeTruthy();
        if (c.data.wall) walls++;
        if (c.data.wall === 'oak_door') doors++;
      }
    expect(walls).toBe(14);
    expect(doors).toBe(1);
    // furnished inside, owned by the crown too
    for (const f of cottageFurniture(pl.x, pl.y)) {
      const o = room.store.objectAt(f.x, f.y);
      expect(o?.sub).toBe(f.sub);
      expect(o?.owner).toBe(owner);
    }
    expect(k.chronicle.some((c) => /new cottage/.test(c.text))).toBe(true);
    // the family at the door can be talked to, and gives a little of their work once a day
    const folk = cottagerOf(pl.x, pl.y);
    await tp(p, folk.x, folk.y + 1);
    const fam = cottageFamily(pl.x, pl.y, site.realm);
    const have = countItem(p.sp.data.inv, fam.gift.id);
    const d = cottageDialogue(room, p.sp, folk.id)!;
    expect(d.name).toBe(`The ${fam.surname} family`);
    expect([d.text, ...(d.pages ?? [])].join(' ')).toContain(fam.members[0]);
    expect(countItem(p.sp.data.inv, fam.gift.id)).toBe(have + fam.gift.n);
    cottageDialogue(room, p.sp, folk.id);
    expect(countItem(p.sp.data.inv, fam.gift.id)).toBe(have + fam.gift.n);
    // only in person, and only at a real cottage
    expect(cottageDialogue(room, p.sp, 'ct1_1')).toBeNull();
    await tp(p, folk.x + 30, folk.y);
    expect(cottageDialogue(room, p.sp, folk.id)).toBeNull();
    // and growth never pulls anything down when times turn hard
    k.prosperity = 20;
    await room.civ.grow(true);
    expect(standing().length).toBe(now.length);
    await p.r.leave();
  });
});
