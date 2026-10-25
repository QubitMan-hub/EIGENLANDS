import {
  ITEMS,
  MSG,
  STATION_SUBS,
  addStack,
  canCraft,
  countItem,
  matchExperiment,
  recipeById,
  recipesFor,
  removeItem,
  type CraftMsg,
  type ExperimentMsg,
  type Props,
  type Recipe,
  type Stack,
  type StationId,
} from '@eigenlands/shared';
import type { ServerPlayer } from '../rooms/player';
import type { RoomApi } from './api';
import { addSkillXp, cloneInv, isInt, skillLv, validSlot } from './helpers';
import { questEvent, recordDeed, syncQuests } from './quests';

/** Quest events, deeds and delivery sync after anything was made. */
function made(room: RoomApi, p: ServerPlayer, rec: Recipe, n: number, discovered: boolean): void {
  const id = rec.out.id,
    name = ITEMS[id]?.name ?? id,
    day = room.wclock.day();
  questEvent(p, { type: 'craft', target: id, n, station: rec.station });
  if (rec.station === 'furnace') {
    questEvent(p, { type: 'smelt', target: id, n });
    recordDeed(p, 'smelt', name, day);
  }
  if (rec.station === 'cooking_pot') recordDeed(p, 'cook', name.toLowerCase(), day);
  if (discovered) {
    questEvent(p, { type: 'discover', target: id, n: 1 });
    recordDeed(p, 'discover', name, day);
  }
  syncQuests(p);
}

const STATION_REACH = 3.5;
const STATION_IDS = new Set<string>([
  'hand',
  'workbench',
  'furnace',
  'forge',
  'cooking_pot',
  'alchemy',
  'loom',
  'jeweler',
  'carpenter',
]);

/** A station is in reach if `station` is 'hand' or there is a matching object at (tx,ty) near the player. */
export function stationNear(room: RoomApi, p: ServerPlayer, station: StationId, tx: number, ty: number): boolean {
  if (station === 'hand') return true;
  if (!isInt(tx, -1e6, 1e6) || !isInt(ty, -1e6, 1e6)) return false;
  const o = room.store.objectAt(tx, ty);
  if (!o || o.kind !== 'station' || STATION_SUBS[o.sub] !== station) return false;
  return Math.hypot(tx + 0.5 - p.sim.x, ty + 0.5 - p.sim.y) <= STATION_REACH;
}

const outStack = (rec: Recipe, n: number, extra?: Props): Stack => ({
  id: rec.out.id,
  n: rec.out.n * n,
  ...(rec.out.p || extra ? { p: { ...(rec.out.p as Props | undefined), ...extra } } : {}),
});

export function handleCraft(room: RoomApi, p: ServerPlayer, msg: CraftMsg): void {
  if (!msg || !STATION_IDS.has(msg.station) || typeof msg.recipe !== 'string' || !isInt(msg.n, 1, 20)) return;
  const rec = recipeById(msg.recipe);
  if (!rec || rec.station !== msg.station) return;
  if (!p.data.recipes.has(rec.id)) {
    p.toast("You haven't learned that recipe yet.", 'bad');
    return;
  }
  if (!stationNear(room, p, rec.station, msg.tx, msg.ty)) {
    p.toast('You need to be at the right station.', 'bad');
    return;
  }
  if (rec.inputs.some((i) => i.id.startsWith('*'))) {
    p.toast('Use the experiment slots for this one.');
    return;
  }
  if (!canCraft(rec, (id) => countItem(p.data.inv, id), msg.n)) {
    p.toast('You are missing ingredients.', 'bad');
    return;
  }

  const sim = cloneInv(p.data.inv);
  const lv = skillLv(p, 'crafting');
  let saved = 0;
  for (let k = 0; k < msg.n; k++) {
    for (const i of rec.inputs) removeItem(sim, i.id, i.n);
    // crafting skill: a small chance to save one unit of one ingredient
    if (room.rand() < 0.04 * lv) {
      const i = rec.inputs[Math.floor(room.rand() * rec.inputs.length)]!;
      addStack(sim, { id: i.id, n: 1 });
      saved++;
    }
  }
  const out = outStack(rec, msg.n);
  // stacks with props never merge: split them into singles
  const singles: Stack[] = out.p ? Array.from({ length: out.n }, () => ({ id: out.id, n: 1, p: { ...out.p } })) : [out];
  for (const s of singles)
    if (addStack(sim, s) > 0) {
      p.toast('Your pack is full.', 'bad');
      return;
    }
  p.data.inv.splice(0, p.data.inv.length, ...sim);
  p.dirty('inv');
  addSkillXp(p, 'crafting', rec.xp * msg.n);
  room.fx({ kind: 'craft', x: p.sim.x, y: p.sim.y, id: p.id });
  p.toast(`Crafted ${out.n} ${ITEMS[out.id]?.name ?? out.id}${saved ? ' (saved an ingredient!)' : ''}`, 'good', {
    id: out.id,
    n: out.n,
  });
  made(room, p, rec, out.n, false);
}

export function handleExperiment(room: RoomApi, p: ServerPlayer, msg: ExperimentMsg): void {
  if (
    !msg ||
    !STATION_IDS.has(msg.station) ||
    !Array.isArray(msg.items) ||
    msg.items.length < 1 ||
    msg.items.length > 4
  )
    return;
  if (!stationNear(room, p, msg.station, msg.tx, msg.ty)) {
    p.toast('You need to be at the right station.', 'bad');
    return;
  }
  const picks: Array<{ slot: number; n: number }> = [];
  const seen = new Set<number>();
  for (const it of msg.items) {
    if (!it || !validSlot(it.slot) || !isInt(it.n, 1, 99) || seen.has(it.slot)) return;
    const st = p.data.inv[it.slot];
    if (!st || st.n < it.n || st.p) return;
    seen.add(it.slot);
    picks.push({ slot: it.slot, n: it.n });
  }
  const offered = picks.map((x) => ({ id: p.data.inv[x.slot]!.id, n: x.n }));
  const rec = matchExperiment(msg.station, offered);
  if (!rec) {
    // right ingredients, wrong amounts: give the player a nudge instead of a dead end
    const ids = new Set(offered.map((o) => o.id));
    const near = recipesFor(msg.station).find(
      (r) =>
        !r.inputs.some((i) => i.id.startsWith('*')) &&
        r.inputs.length === ids.size &&
        r.inputs.every((i) => ids.has(i.id)),
    );
    if (near) p.toast('So close! These belong together, but the amounts are off. Try different quantities.', 'info');
    else p.toast('Nothing happens… but the ingredients hum faintly. (Nothing was used up.)');
    return;
  }

  let extra: Props | undefined;
  if (rec.inputs.some((i) => i.id.startsWith('*'))) {
    const seeds = offered.filter((o) => ITEMS[o.id]?.kind === 'seed').map((o) => ITEMS[o.id]!.crop!);
    if (seeds.length !== 2) return;
    extra = { a: seeds[0]!, b: seeds[1]! };
  }
  const sim = cloneInv(p.data.inv);
  const discovered = !p.data.recipes.has(rec.id);
  for (const x of picks) {
    const s = sim[x.slot]!;
    s.n -= x.n;
    if (s.n <= 0) sim[x.slot] = null;
  }
  const out = outStack(rec, 1, extra);
  if (addStack(sim, out) > 0) {
    p.toast('Your pack is full.', 'bad');
    return;
  }
  p.data.inv.splice(0, p.data.inv.length, ...sim);
  p.dirty('inv');
  if (!p.data.recipes.has(rec.id)) {
    p.data.recipes.add(rec.id);
    p.dirty('recipes');
    p.toast(`You discovered ${ITEMS[rec.out.id]?.name ?? rec.id}!`, 'good');
  }
  addSkillXp(p, 'crafting', rec.xp);
  room.fx({ kind: 'craft', x: p.sim.x, y: p.sim.y, id: p.id });
  p.client.send(MSG.TOAST, { text: `Made ${ITEMS[out.id]?.name ?? out.id}`, kind: 'item', item: out });
  made(room, p, rec, 1, discovered);
}
