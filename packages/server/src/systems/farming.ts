import { readHerd, advanceHerd } from '@eigenlands/shared';
import {
  CROPS,
  FARM_ANIMALS,
  ITEMS,
  LANTERN_RADIUS,
  T,
  afterHarvest,
  catchUp,
  collapseCrop,
  cropSeasonOk,
  daysToRipe,
  harvestYield,
  sprinklerReach,
  CROP_ROWS,
  countItem,
  isRipe,
  seasonOfDay,
  sprinklerCovers,
  waters,
  weatherForDay,
  type CropData,
  type Stack,
  type WorldObj,
} from '@eigenlands/shared';
import type { ServerPlayer } from '../rooms/player';
import type { RoomApi } from './api';
import { addSkillXp, giveStacks, skillLv } from './helpers';
import { expireRequests, questEvent, recordDeed } from './quests';

export const lanternNear = (room: RoomApi, x: number, y: number): boolean => {
  for (let dy = -LANTERN_RADIUS; dy <= LANTERN_RADIUS; dy++) {
    for (let dx = -LANTERN_RADIUS; dx <= LANTERN_RADIUS; dx++) {
      const o = room.store.objectAt(x + dx, y + dy);
      if (o && o.sub === 'phase_lantern') return true;
    }
  }
  return false;
};

/** Short connected channels carry real water; isolated/deeply extended channels stay dry. */
export function channelWatered(room: RoomApi, x: number, y: number): boolean {
  const first = room.store.structureAt(x, y);
  if (first?.data.floor !== 'irrigation_channel') return false;
  const queue: Array<[number, number]> = [[x, y]],
    seen = new Set<string>(),
    level = room.store.levelAt(x, y);
  for (let i = 0; i < queue.length && i < 64; i++) {
    const [cx, cy] = queue[i]!,
      key = `${cx},${cy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx!,
        ny = cy + dy!,
        tile = room.store.getTile(nx, ny);
      if (room.store.levelAt(nx, ny) !== level) continue;
      if (tile === T.WATER || tile === T.DEEP_WATER) return true;
      const next = room.store.structureAt(nx, ny);
      if (next?.owner === first.owner && next.data.floor === 'irrigation_channel' && !seen.has(`${nx},${ny}`))
        queue.push([nx, ny]);
    }
  }
  return false;
}

export const sprinklerNear = (room: RoomApi, x: number, y: number): boolean => {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (!dx && !dy) continue;
      if (Math.abs(dx) + Math.abs(dy) === 1 && channelWatered(room, x + dx, y + dy)) return true;
      const o = room.store.objectAt(x + dx, y + dy);
      if (o && o.kind === 'sprinkler' && sprinklerCovers(o.sub, -dx, -dy)) return true;
    }
  }
  return false;
};

/** Crops cut with a sickle. */
const GRAINS = new Set(CROP_ROWS.filter((r) => r.glyph === 'wheat').map((r) => r.def.id));

export const cropOf = (o: WorldObj): CropData => o.data as unknown as CropData;
const cropName = (id: string) => ITEMS[id]?.name ?? id;
const objName = (d: CropData) => (d.alt ? `${cropName(d.crop)}/${cropName(d.alt)} (superposed)` : cropName(d.crop));

/** Tell the world a tile is wet (cosmetic soil state, dried at the next dawn). */
export function wetTile(room: RoomApi, x: number, y: number): void {
  if (room.store.getTile(x, y) === T.TILLED) room.setTile(x, y, T.TILLED_WET);
  if (room.store.getTile(x, y) === T.TILLED_WET) room.wet.add(`${x},${y}`);
}

/** Bring one crop up to date with `today` (offline days, lazy chunk load). Returns true if it changed. */
export function refreshCrop(room: RoomApi, o: WorldObj, today: number): boolean {
  const d = cropOf(o);
  if (!d || (d.dead && d.lastDay >= today - 1)) return false;
  const next = catchUp(d, today, room.seed, sprinklerNear(room, o.x, o.y), lanternNear(room, o.x, o.y));
  if (
    next === d ||
    (next.growth === d.growth &&
      next.dead === d.dead &&
      next.lastDay === d.lastDay &&
      next.dormant === d.dormant &&
      next.established === d.established)
  )
    return false;
  o.data = next as unknown as Record<string, unknown>;
  return true;
}

/** Shelters produce once per day when fed. */
export function rollShelter(o: WorldObj, day: number): boolean {
  if (o.sub === 'apiary') {
    const d = o.data as { animals: number; fed: boolean; ready: number; lastDay?: number };
    if (!d || day <= (d.lastDay ?? day - 1)) return false;
    d.lastDay = day;
    if (d.fed) {
      d.ready = Math.min(99, d.ready + d.animals);
      d.fed = false;
    }
    return true;
  }
  const d = readHerd({ ...o.data, lastDay: o.data?.lastDay ?? day - 1 }, o.sub, day);
  const n = advanceHerd(d, day);
  if (n === d && o.data?.herd) return false;
  o.data = n;
  return true;
}

/** World day `day` has just begun: grow crops, dry soil, run sprinklers and rain, produce eggs and milk. */
export function dailyRollover(room: RoomApi, day: number): void {
  // 1. yesterday's wet soil dries
  for (const k of [...room.wet]) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    if (room.store.getTile(x, y) === T.TILLED_WET) room.setTile(x, y, T.TILLED);
  }
  room.wet.clear();
  const raining = waters(weatherForDay(room.seed, day));
  // 2. crops and shelters
  const objs = [...room.objects.all()];
  for (const o of objs) {
    if (o.static) continue;
    if (o.kind === 'crop') {
      if (refreshCrop(room, o, day)) room.objects.update(o);
      const d = cropOf(o);
      if (!d.dead && (sprinklerNear(room, o.x, o.y) || (raining && !lanternNear(room, o.x, o.y))))
        wetTile(room, o.x, o.y);
    } else if (o.kind === 'shelter') {
      if (rollShelter(o, day)) room.objects.update(o);
    }
  }
  // 3. request-board jobs whose time ran out
  for (const p of room.players.values()) expireRequests(p, day);
  // 4. sprinklers wet the tilled soil they cover (even without crops)
  for (const o of objs) {
    if (o.kind !== 'sprinkler') continue;
    const reach = sprinklerReach(o.sub);
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++)
        if ((dx || dy) && sprinklerCovers(o.sub, dx, dy)) wetTile(room, o.x + dx, o.y + dy);
  }
}

// ───────────────────────── player actions ─────────────────────────

export function plantSeed(room: RoomApi, p: ServerPlayer, slot: number, tx: number, ty: number): void {
  const stack = p.data.inv[slot]!;
  const def = ITEMS[stack.id]!;
  const tile = room.store.getTile(tx, ty);
  if (tile !== T.TILLED && tile !== T.TILLED_WET) {
    p.toast('Seeds need tilled soil. Use a hoe on grass first.');
    return;
  }
  if (room.store.objectAt(tx, ty)) {
    p.toast('Something is already here.');
    return;
  }
  let crop = def.crop!,
    alt: string | undefined;
  if (stack.id === 'superposed_seed') {
    crop = String(stack.p?.a ?? '');
    alt = String(stack.p?.b ?? '');
    if (!CROPS[crop] || !CROPS[alt] || crop === alt) {
      p.toast('This seed has lost its superposition.', 'bad');
      return;
    }
  }
  if (!CROPS[crop]) return;
  if (
    alt &&
    (!!CROPS[crop]?.perennial !== !!CROPS[alt]?.perennial ||
      (CROPS[crop]?.perennial && !CROPS[crop]!.seasons.some((s) => CROPS[alt]!.seasons.includes(s))))
  ) {
    p.toast('Perennial superpositions need two perennial crops with a shared fruiting season.');
    return;
  }
  const day = room.wclock.day();
  const gh = lanternNear(room, tx, ty);
  const next = seasonOfDay(day + 1);
  if (
    (!CROPS[crop]?.perennial && !cropSeasonOk(crop, next, gh)) ||
    (alt && !CROPS[alt]?.perennial && !cropSeasonOk(alt, next, gh))
  ) {
    p.toast("It won't survive the coming season. Wait for the right one, or shield it with a Phase Lantern.", 'bad');
    return;
  }
  const data: CropData = {
    crop,
    planted: day,
    growth: 0,
    watered: tile === T.TILLED_WET ? day : -1,
    lastDay: day - 1,
    owner: p.accountId,
    ...(CROPS[crop]?.perennial ? { dormant: !cropSeasonOk(crop, room.wclock.season(), gh) } : {}),
    ...(alt ? { alt } : {}),
  };
  p.data.inv.forEach((s, i) => {
    if (i === slot && s) {
      s.n -= 1;
      if (s.n <= 0) p.data.inv[i] = null;
    }
  });
  p.dirty('inv');
  room.objects.put({
    x: tx,
    y: ty,
    kind: 'crop',
    sub: alt ? `*${crop}+${alt}` : crop,
    owner: p.accountId,
    data: data as unknown as Record<string, unknown>,
  });
  addSkillXp(p, 'farming', 2);
  room.fx({ kind: 'plant', x: tx + 0.5, y: ty + 0.5 });
  questEvent(p, { type: 'plant', target: crop, n: 1 });
  recordDeed(p, 'plant', cropName(crop), day);
}

export function waterCrop(room: RoomApi, p: ServerPlayer, o: WorldObj): void {
  const d = cropOf(o);
  if (d.dead) {
    p.toast('It has withered.');
    return;
  }
  d.watered = room.wclock.day();
  room.objects.update(o);
  wetTile(room, o.x, o.y);
  room.fx({ kind: 'water', x: o.x + 0.5, y: o.y + 0.5, id: p.id, weapon: 'can' });
  addSkillXp(p, 'farming', 1);
}

export function uprootCrop(room: RoomApi, p: ServerPlayer, o: WorldObj): void {
  if (o.owner !== p.accountId) {
    p.toast("That isn't yours.");
    return;
  }
  const d = cropOf(o);
  room.objects.remove(o.x, o.y);
  // a trowel lifts it whole: the seed comes back with the roots
  const seed = `${d.crop}_seed`;
  if (!d.dead && ITEMS[seed] && countItem(p.data.inv, 'trowel') > 0 && giveStacks(p, [{ id: seed, n: 1 }]))
    p.toast('You lift the plant carefully and keep its seed.');
  else p.toast('You uproot the plant.');
}

export function fertilize(room: RoomApi, p: ServerPlayer, slot: number, o: WorldObj): void {
  const stack = p.data.inv[slot]!;
  const d = cropOf(o);
  if (o.owner !== p.accountId) {
    p.toast("That isn't yours.");
    return;
  }
  if (d.dead || isRipe(d)) {
    p.toast("It doesn't need that now.");
    return;
  }
  const fert = ITEMS[stack.id]?.fert ?? (stack.id === 'fertilizer' ? { days: 1, yield: 0 } : null);
  if (fert) {
    const have = d.fert === true ? 1 : Number(d.fert) || 0;
    if (have >= fert.days && (d.yb ?? 0) >= fert.yield) {
      p.toast('Already fertilized as well as that.');
      return;
    }
    d.fert = Math.max(have, fert.days);
    d.yb = Math.max(d.yb ?? 0, fert.yield);
  } else {
    if (!d.alt) {
      p.toast('Phase tonics only work on superposed crops.');
      return;
    }
    if (d.bias) {
      p.toast('This crop is already biased.');
      return;
    }
    d.bias = stack.id === 'phase_tonic_a' ? 'a' : 'b';
  }
  stack.n -= 1;
  if (stack.n <= 0) p.data.inv[slot] = null;
  p.dirty('inv');
  room.objects.update(o);
  room.fx({ kind: 'heal', x: o.x + 0.5, y: o.y + 0.5 });
}

export function harvestCrop(room: RoomApi, p: ServerPlayer, o: WorldObj): void {
  const d = cropOf(o);
  if (o.owner !== p.accountId) {
    p.toast("That isn't yours.");
    return;
  }
  if (d.dead) {
    p.toast('It has withered. Uproot it with a hoe.', 'bad');
    return;
  }
  if (d.dormant) {
    p.toast('Dormant for the season. The roots will survive; fruit returns in season.');
    return;
  }
  if (!isRipe(d)) {
    p.toast(`${objName(d)} isn't ripe yet (${d.growth}/${daysToRipe(d)} days).`);
    return;
  }
  const crop = collapseCrop(d, room.rand);
  // a sickle in the pack cuts grain cleanly: one more per harvest
  const sickle = GRAINS.has(crop) && countItem(p.data.inv, 'sickle') > 0 ? 1 : 0;
  const n = harvestYield(crop, room.rand, skillLv(p, 'farming'), p.stats.luck, (d.yb ?? 0) + sickle);
  const out: Stack = { id: crop, n };
  if (!giveStacks(p, [out])) {
    p.toast('Your pack is full.', 'bad');
    return;
  }
  const next = afterHarvest(d);
  if (next) {
    o.data = next as unknown as Record<string, unknown>;
    room.objects.update(o);
  } else room.objects.remove(o.x, o.y);
  addSkillXp(p, 'farming', CROPS[crop]!.xp);
  room.fx({ kind: 'harvest', x: o.x + 0.5, y: o.y + 0.5 });
  if (d.alt) p.toast(`The superposition collapses into ${cropName(crop)}!`, 'good');
  questEvent(p, { type: 'harvest', target: crop, n: 1 });
  recordDeed(p, 'harvest', cropName(crop).toLowerCase(), room.wclock.day());
  if (n >= 3) room.village.rumor('harvest', p.name, cropName(crop));
}

export function describeShelter(sub: string): { max: number; animal: string; product: string } {
  const f = FARM_ANIMALS[sub]!;
  return { max: f.max, animal: f.animal, product: f.product };
}
