import {
  ITEMS,
  MSG,
  RECIPES,
  STATION_SUBS,
  CRAFT_QUALITY,
  DISC_BY_ID,
  addStack,
  canCraft,
  countItem,
  craftQuality,
  discLevel,
  isStationId,
  newGearProps,
  recipeBlock,
  recipeKnown,
  matchExperiment,
  recipeById,
  recipesFor,
  removeItem,
  type CraftMsg,
  type CraftProfile,
  type Discipline,
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
    questEvent(p, { type: 'discover', target: id, n: 1, kind: 'recipe' });
    recordDeed(p, 'discover', name, day);
  }
  syncQuests(p);
}

const STATION_REACH = 3.5;

const profileOf = (p: ServerPlayer): CraftProfile => ({ learned: p.data.recipes, disc: p.data.disc, rep: p.data.rep });

/** Discipline XP, with a toast on level-up. */
export function addDiscXp(p: ServerPlayer, disc: Discipline, amount: number): void {
  if (amount <= 0) return;
  const before = discLevel(p.data.disc[disc]);
  p.data.disc[disc] += Math.round(amount);
  p.dirty('disc');
  const after = discLevel(p.data.disc[disc]);
  if (after > before) {
    p.toast(`${DISC_BY_ID[disc].name} level ${after}!`, 'good');
    unlockedByLevel(p, disc, before, after);
  }
}

/** Announce recipes a new discipline level opens up. */
function unlockedByLevel(p: ServerPlayer, disc: Discipline, from: number, to: number): void {
  const n = RECIPES.filter(
    (r) => r.disc === disc && r.lvl > from && r.lvl <= to && (r.learn === 'level' || r.learn.startsWith('realm:')),
  ).length;
  if (n > 0) p.toast(`${n} new recipe${n > 1 ? 's' : ''} unlocked.`, 'info');
}

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
  if (!msg || !isStationId(msg.station) || typeof msg.recipe !== 'string' || !isInt(msg.n, 1, 20)) return;
  const rec = recipeById(msg.recipe);
  if (!rec || rec.station !== msg.station) return;
  if (!recipeKnown(rec, profileOf(p))) {
    p.toast("You haven't learned that recipe yet.", 'bad');
    return;
  }
  const block = recipeBlock(rec, profileOf(p));
  if (block) {
    p.toast(block + '.', 'bad');
    return;
  }
  if (!stationNear(room, p, rec.station, msg.tx, msg.ty)) {
    p.toast('You need to be at the right station.', 'bad');
    return;
  }
  if (rec.tool && countItem(p.data.inv, rec.tool) < 1) {
    p.toast(`You need ${ITEMS[rec.tool]?.name ?? rec.tool} in your pack.`, 'bad');
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
  const saveChance = 0.04 * lv + (p.stats.craft ?? 0) / 100;
  let saved = 0;
  for (let k = 0; k < msg.n; k++) {
    for (const i of rec.inputs) removeItem(sim, i.id, i.n);
    // crafting skill: a small chance to save one unit of one ingredient
    if (room.rand() < saveChance) {
      const i = rec.inputs[Math.floor(room.rand() * rec.inputs.length)]!;
      addStack(sim, { id: i.id, n: 1 });
      saved++;
    }
  }
  const out = outStack(rec, msg.n);
  const dlv = discLevel(p.data.disc[rec.disc]);
  const rarity = ITEMS[rec.out.id]?.rarity ?? 0;
  // stacks with props never merge: split them into singles; gear rolls its own quality
  const singles: Stack[] =
    rec.quality || rec.gear
      ? Array.from({ length: out.n }, () => ({
          id: out.id,
          n: 1,
          p: {
            ...out.p,
            ...newGearProps(out.id, rec.quality ? craftQuality(dlv, rec.lvl, rarity, p.stats.luck, room.rand()) : 1),
          },
        }))
      : out.p
        ? Array.from({ length: out.n }, () => ({ id: out.id, n: 1, p: { ...out.p } }))
        : [out];
  for (const s of singles)
    if (addStack(sim, s) > 0) {
      p.toast('Your pack is full.', 'bad');
      return;
    }
  p.data.inv.splice(0, p.data.inv.length, ...sim);
  p.dirty('inv');
  addSkillXp(p, 'crafting', rec.xp * msg.n);
  addDiscXp(p, rec.disc, rec.xp * msg.n);
  room.fx({
    kind: 'craft',
    station: rec.station,
    x: rec.station !== 'hand' && msg.tx !== undefined ? msg.tx + 0.5 : p.sim.x,
    y: rec.station !== 'hand' && msg.ty !== undefined ? msg.ty + 0.5 : p.sim.y,
    id: p.id,
  });
  const qt = singles[0]?.p?.qt;
  const qtext = qt !== undefined && qt !== 1 && singles.length === 1 ? `${CRAFT_QUALITY[qt]} ` : '';
  p.toast(
    `Crafted ${out.n} ${qtext}${ITEMS[out.id]?.name ?? out.id}${saved ? ' (saved an ingredient!)' : ''}`,
    'good',
    {
      id: out.id,
      n: out.n,
    },
  );
  made(room, p, rec, out.n, false);
}

export function handleExperiment(room: RoomApi, p: ServerPlayer, msg: ExperimentMsg): void {
  if (!msg || !isStationId(msg.station) || !Array.isArray(msg.items) || msg.items.length < 1 || msg.items.length > 4)
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

  const block = recipeBlock(rec, profileOf(p));
  if (block) {
    p.toast(`These belong together, but you are not skilled enough yet. ${block}. (Nothing was used up.)`, 'info');
    return;
  }
  if (rec.tool && countItem(p.data.inv, rec.tool) < 1) {
    p.toast(`You would need ${ITEMS[rec.tool]?.name ?? rec.tool} in your pack. (Nothing was used up.)`, 'info');
    return;
  }

  let extra: Props | undefined;
  if (rec.inputs.some((i) => i.id.startsWith('*'))) {
    const seeds = offered.filter((o) => ITEMS[o.id]?.kind === 'seed').map((o) => ITEMS[o.id]!.crop!);
    if (seeds.length !== 2) return;
    extra = { a: seeds[0]!, b: seeds[1]! };
  }
  const sim = cloneInv(p.data.inv);
  const discovered = !recipeKnown(rec, profileOf(p));
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
  if (discovered) {
    p.data.recipes.add(rec.id);
    p.dirty('recipes');
    p.toast(`You discovered ${ITEMS[rec.out.id]?.name ?? rec.id}!`, 'good');
  }
  addSkillXp(p, 'crafting', rec.xp);
  addDiscXp(p, rec.disc, rec.xp);
  room.fx({
    kind: 'craft',
    station: rec.station,
    x: rec.station !== 'hand' && msg.tx !== undefined ? msg.tx + 0.5 : p.sim.x,
    y: rec.station !== 'hand' && msg.ty !== undefined ? msg.ty + 0.5 : p.sim.y,
    id: p.id,
  });
  p.client.send(MSG.TOAST, { text: `Made ${ITEMS[out.id]?.name ?? out.id}`, kind: 'item', item: out });
  made(room, p, rec, 1, discovered);
}

/** Teach a recipe (a scroll, a quest, a teacher). False when it is unknown or already known. */
export function learnRecipe(p: ServerPlayer, id: string): boolean {
  if (!recipeById(id) || p.data.recipes.has(id)) return false;
  p.data.recipes.add(id);
  p.dirty('recipes');
  return true;
}
