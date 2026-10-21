import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CROPS, T, cropStage, daysToRipe, type CropData } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot, count, flatten, give, hasToast, nextDay, setDay, sleep, slotOf, spawn, tp, until, use, type Probe } from './p2';

let app: App;
let p: Probe;
let other: Probe;
const X = 200, Y = 200;
const crop = (x: number, y: number) => p.room.store.objectAt(x, y);
const data = (x: number, y: number) => crop(x, y)!.data as unknown as CropData;

beforeAll(async () => {
  app = await boot();
  p = await spawn(app, 'Farmer');
  other = await spawn(app, 'Neighbour');
  setDay(p.room, 0, 8); // first spring day, morning
  await tp(p, X + 0.5, Y + 0.5);
  await tp(other, X + 3.5, Y + 0.5);
  flatten(p.room, X, Y, 8);
});
afterAll(async () => { await app.close(); });

describe('the crop lifecycle', () => {
  it('till, plant, water, grow over watered days and harvest', async () => {
    await use(p, 'hoe', X + 1, Y);
    expect(p.room.store.getTile(X + 1, Y)).toBe(T.TILLED);
    const seeds = count(p, 'turnip_seed');
    await use(p, 'turnip_seed', X + 1, Y);
    const o = crop(X + 1, Y)!;
    expect(o.kind).toBe('crop');
    expect(o.sub).toBe('turnip');
    expect(o.owner).toBe(p.accountId);
    expect(count(p, 'turnip_seed')).toBe(seeds - 1);
    expect(p.objs.some((m) => m.x === X + 1 && m.y === Y && m.obj?.sub === 'turnip')).toBe(true);

    // an unwatered day does not grow it
    await nextDay(p.room);
    expect(data(X + 1, Y).growth).toBe(0);

    // water -> grows; soil is wet until the next dawn
    await use(p, 'can', X + 1, Y);
    expect(data(X + 1, Y).watered).toBe(p.room.wclock.day());
    expect(p.room.store.getTile(X + 1, Y)).toBe(T.TILLED_WET);
    await nextDay(p.room);
    expect(data(X + 1, Y).growth).toBe(1);
    expect(p.room.store.getTile(X + 1, Y)).toBe(T.TILLED); // dried overnight
    expect(p.objs.filter((m) => m.x === X + 1 && m.y === Y).length).toBeGreaterThan(1); // updates were broadcast

    // not ripe yet; harvesting early says so
    const from = p.toasts.length;
    await use(p, 'axe', X + 1, Y, 120);
    expect(hasToast(p, /isn't ripe/, from)).toBe(true);
    await use(p, 'can', X + 1, Y);
    await nextDay(p.room);
    expect(data(X + 1, Y).growth).toBe(daysToRipe(data(X + 1, Y)));
    expect(cropStage(data(X + 1, Y))).toBe(3);

    // owner only
    const fromOther = other.toasts.length;
    other.r.send('use', { slot: slotOf(other, 'axe'), tx: X + 1, ty: Y });
    await sleep(150);
    expect(hasToast(other, /isn't yours/, fromOther)).toBe(true);
    expect(crop(X + 1, Y)).toBeTruthy();

    // harvest
    const xp0 = p.sp.data.skills.farming;
    await use(p, 'axe', X + 1, Y, 120);
    expect(count(p, 'turnip')).toBeGreaterThanOrEqual(1);
    expect(crop(X + 1, Y)).toBeUndefined();
    expect(p.sp.data.skills.farming).toBeGreaterThan(xp0);
  });

  it('regrowing crops come back; withered crops can be uprooted with a hoe', async () => {
    p.room.setTile(X, Y + 1, T.TILLED);
    await give(p, 'strawberry_seed', 1);
    await use(p, 'strawberry_seed', X, Y + 1);
    const o = crop(X, Y + 1)!;
    (o.data as unknown as CropData).growth = 4; // ripe
    p.room.objects.update(o);
    await use(p, 'axe', X, Y + 1, 120);
    expect(count(p, 'strawberry')).toBeGreaterThanOrEqual(1);
    expect(crop(X, Y + 1)).toBeTruthy(); // regrows
    expect(data(X, Y + 1).growth).toBe(CROPS.strawberry!.days - CROPS.strawberry!.regrow);
    // wither it, then uproot
    (crop(X, Y + 1)!.data as unknown as CropData).dead = true;
    await use(p, 'hoe', X, Y + 1);
    expect(crop(X, Y + 1)).toBeUndefined();
  });
});

describe('seasons, lanterns, sprinklers', () => {
  it('refuses crops that would not survive the coming season, unless a Phase Lantern protects them', async () => {
    setDay(p.room, 6, 10); // last day of spring
    p.room.setTile(X + 1, Y - 1, T.TILLED);
    p.room.setTile(X - 1, Y - 1, T.TILLED);
    const from = p.toasts.length;
    await use(p, 'turnip_seed', X + 1, Y - 1, 120);
    expect(crop(X + 1, Y - 1)).toBeUndefined();
    expect(hasToast(p, /survive|season/i, from)).toBe(true);
    // a lantern within two tiles lets it grow
    p.room.objects.put({ x: X - 2, y: Y - 2, kind: 'furniture', sub: 'phase_lantern', owner: p.accountId });
    await use(p, 'turnip_seed', X - 1, Y - 1);
    expect(crop(X - 1, Y - 1)).toBeTruthy();
    // and it survives the turn of the season (watered by hand) while an unprotected crop would wither
    await use(p, 'can', X - 1, Y - 1);
    await nextDay(p.room); // day 7: summer
    expect(p.room.wclock.season()).toBe(1);
    expect(data(X - 1, Y - 1).dead).toBeFalsy();
    expect(data(X - 1, Y - 1).growth).toBe(1);
  });

  it('crops wither when the season turns against them', async () => {
    setDay(p.room, 20, 10); // autumn day 6, a day before winter
    p.room.setTile(X + 2, Y + 2, T.TILLED);
    // plant directly: a pumpkin (autumn) is fine today but dies when winter arrives unripe
    p.room.objects.put({ x: X + 2, y: Y + 2, kind: 'crop', sub: 'pumpkin', owner: p.accountId, data: { crop: 'pumpkin', planted: 20, growth: 0, watered: -1, lastDay: 19, owner: p.accountId } });
    await nextDay(p.room);
    expect(p.room.wclock.season()).toBe(3);
    expect(data(X + 2, Y + 2).dead).toBe(true);
  });

  it('sprinklers water neighbours at dawn without anyone lifting a can', async () => {
    setDay(p.room, 1, 10); // spring
    p.room.setTile(X + 4, Y + 4, T.TILLED);
    await tp(p, X + 4.5, Y + 3.5);
    await give(p, 'sprinkler_1', 1);
    await give(p, 'turnip_seed', 2);
    await use(p, 'turnip_seed', X + 4, Y + 4);
    p.room.setTile(X + 5, Y + 4, T.TILLED);
    await use(p, 'sprinkler_1', X + 5, Y + 4);
    expect(crop(X + 5, Y + 4)?.kind).toBe('sprinkler');
    await nextDay(p.room);
    expect(data(X + 4, Y + 4).growth).toBe(1);
    await nextDay(p.room);
    expect(data(X + 4, Y + 4).growth).toBe(2);
    expect(cropStage(data(X + 4, Y + 4))).toBe(3);
  });
});

describe('superposition', () => {
  it('a superposed seed collapses into either crop; tonics bias the odds', async () => {
    setDay(p.room, 2, 10);
    await tp(p, X + 0.5, Y + 6.5);
    p.room.setTile(X, Y + 7, T.TILLED);
    p.room.setTile(X + 1, Y + 7, T.TILLED);
    await give(p, 'superposed_seed', 2, { a: 'turnip', b: 'potato' }); // unique stacks
    await use(p, 'superposed_seed', X, Y + 7);
    await use(p, 'superposed_seed', X + 1, Y + 7);
    const a = crop(X, Y + 7)!, b = crop(X + 1, Y + 7)!;
    expect(a.sub).toBe('*turnip+potato');
    expect(daysToRipe(data(X, Y + 7))).toBe(3); // slower of the two
    // tonic A biases the second crop toward its first crop
    await give(p, 'phase_tonic_a', 1);
    await use(p, 'phase_tonic_a', X + 1, Y + 7);
    expect(data(X + 1, Y + 7).bias).toBe('a');
    for (const o of [a, b]) { (o.data as unknown as CropData).growth = 3; p.room.objects.update(o); }
    p.room.rand = () => 0.6; // 0.6 >= 0.5 -> the second crop when unbiased, but < 0.75 -> the first when biased
    await use(p, 'axe', X, Y + 7, 120);
    await use(p, 'axe', X + 1, Y + 7, 120);
    p.room.rand = Math.random;
    expect(count(p, 'potato')).toBeGreaterThanOrEqual(1);
    expect(count(p, 'turnip')).toBeGreaterThanOrEqual(1);
    expect(hasToast(p, /collapses into/)).toBe(true);
  });

  it('tonics refuse ordinary crops', async () => {
    p.room.setTile(X + 2, Y + 6, T.TILLED);
    await use(p, 'turnip_seed', X + 2, Y + 6);
    await give(p, 'phase_tonic_b', 1);
    const from = p.toasts.length;
    await use(p, 'phase_tonic_b', X + 2, Y + 6, 120);
    expect(hasToast(p, /superposed/, from)).toBe(true);
    expect(count(p, 'phase_tonic_b')).toBe(1);
    // fertilizer shaves a day off
    await give(p, 'fertilizer', 1);
    await use(p, 'fertilizer', X + 2, Y + 6);
    expect(data(X + 2, Y + 6).fert).toBe(true);
  });
});
