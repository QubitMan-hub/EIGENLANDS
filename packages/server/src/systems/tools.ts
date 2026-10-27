import {
  otherworldOf,
  MOUNT_FEED,
  caveBiomeAt,
  dropAllowed,
  inRealmLand,
  isCaveY,
  pickForage,
  HEARTS_MAX,
  ITEMS,
  NODES,
  T,
  NOURISHED_SECS,
  balanced,
  foodGroup,
  recordMeal,
  chunkOf,
  isSolid,
  toolDamage,
  type Stack,
  type UseMsg,
  type WorldObj,
} from '@eigenlands/shared';
import { useConstruction } from './construction';
import { tuning } from '../rooms/runtime';
import { useCatalogItem } from './gear';
import type { ServerPlayer } from '../rooms/player';
import type { RoomApi } from './api';
import { inflict } from './travel-needs';
import { startCast } from './fishing';
import { catchBug } from './bugs';
import { fertilize, harvestCrop, plantSeed, uprootCrop, waterCrop, wetTile } from './farming';
import { addSkillXp, distToTile, fitsAll, giveStacks, isInt, skillLv, validSlot } from './helpers';
import { questEvent, syncQuests } from './quests';

const TILLABLE: number[] = [T.GRASS, T.GRASS_TALL, T.FLOWERS, T.STUMP];
const TOOL_NAME: Record<string, string> = { axe: 'an axe', pickaxe: 'a pickaxe' };

/** USE: the selected pack item applied to a tile. */
export async function handleUse(room: RoomApi, p: ServerPlayer, msg: UseMsg): Promise<void> {
  if (!msg || !validSlot(msg.slot) || !isInt(msg.tx, -1e6, 1e6) || !isInt(msg.ty, -1e6, 1e6)) return;
  if (p.deadT > 0) return;
  const t0 = Date.now();
  if (t0 < p.toolReadyAt) return;
  const first = p.data.inv[msg.slot];
  if (!first) return;
  const def = ITEMS[first.id];
  if (!def) return;
  const { tx, ty } = msg;
  const kind = def.kind;

  // special items: Heart Crystals and boss summons
  if (def.special === 'heart') {
    p.toolReadyAt = t0 + tuning.toolCooldownMs;
    if (p.data.prog.hearts >= HEARTS_MAX) {
      p.toast('You cannot hold any more Heart Crystals.');
      return;
    }
    const s0 = p.data.inv[msg.slot]!;
    s0.n--;
    if (s0.n <= 0) p.data.inv[msg.slot] = null;
    p.data.prog.hearts++;
    p.dirty('inv');
    p.toast(`Your heart grows: +10 maximum health (${p.data.prog.hearts}/${HEARTS_MAX}).`, 'good');
    room.fx({ kind: 'levelup', x: p.sim.x, y: p.sim.y, v: 0, id: p.id });
    return;
  }
  if (def.special === 'ship') {
    p.toolReadyAt = t0 + tuning.toolCooldownMs;
    room.toggleShip?.(p);
    return;
  }
  if (def.special === 'recall') {
    p.toolReadyAt = t0 + tuning.toolCooldownMs;
    room.recall?.(p, msg.slot);
    return;
  }
  if (def.special === 'mount') {
    p.toolReadyAt = t0 + tuning.toolCooldownMs;
    room.toggleMount?.(p, def.mount ?? 'horse');
    return;
  }
  // feed held while riding goes to the mount
  if (p.sim.mount && (MOUNT_FEED as readonly string[]).includes(first.id)) {
    p.toolReadyAt = t0 + tuning.toolCooldownMs;
    room.feedMount?.(p, msg.slot);
    return;
  }
  // tools and seeds are used on foot: step down from the saddle first
  if (p.sim.mount) p.sim.mount = 0;
  if (def.special === 'summon') {
    p.toolReadyAt = t0 + tuning.toolCooldownMs;
    if (room.summonBoss?.(p, first.id, p.sim.x + p.sim.faceX * 4, p.sim.y + p.sim.faceY * 4)) {
      const s0 = p.data.inv[msg.slot]!;
      s0.n--;
      if (s0.n <= 0) p.data.inv[msg.slot] = null;
      p.dirty('inv');
    }
    return;
  }

  if (first.id === 'waterskin_murky') {
    p.toolReadyAt = t0 + tuning.toolCooldownMs;
    if (p.data.needs.water >= 100) {
      p.toast('You are not thirsty.');
      return;
    }
    p.data.needs.water = Math.min(100, p.data.needs.water + 30);
    p.data.inv[msg.slot] = { id: 'waterskin_empty', n: 1 };
    p.dirty('needs', 'inv');
    room.fx({ kind: 'water', x: p.sim.x, y: p.sim.y });
    // unboiled water: a fair chance of a sick stomach for those who live by the survival rules
    const mode = p.data.needs.mode;
    if (mode !== 'cozy' && room.rand() < (mode === 'hardcore' ? 0.5 : 0.3)) inflict(room, p, 'poison');
    return;
  }

  if (first.id === 'waterskin_full') {
    p.toolReadyAt = t0 + tuning.toolCooldownMs;
    if (p.data.needs.water >= 100) {
      p.toast('You are not thirsty.');
      return;
    }
    p.data.needs.water = Math.min(100, p.data.needs.water + 35);
    p.data.inv[msg.slot] = { id: 'waterskin_empty', n: 1 };
    p.dirty('needs', 'inv');
    room.fx({ kind: 'water', x: p.sim.x, y: p.sim.y });
    return;
  }

  // items with a special use: recipe scrolls, repair kits, lamp oil, whetstones
  if (def.use) {
    p.toolReadyAt = t0 + tuning.toolCooldownMs;
    useCatalogItem(room, p, msg.slot);
    return;
  }

  // items that do not need a target
  if (kind === 'food' || kind === 'potion') {
    p.toolReadyAt = t0 + tuning.toolCooldownMs;
    eat(room, p, msg.slot);
    return;
  }

  const reach = def.tool?.type === 'rod' ? 5 : 2.2;
  if (distToTile(p, tx, ty) > reach) {
    p.toast('Too far away.');
    return;
  }
  await room.ensureChunk(chunkOf(tx), chunkOf(ty));
  // the world may have moved on while the chunk loaded
  const stack = p.data.inv[msg.slot];
  if (p.deadT > 0 || !stack || stack.id !== first.id) return;
  p.toolReadyAt = Date.now() + tuning.toolCooldownMs;

  const slot = msg.slot;
  const obj = room.store.objectAt(tx, ty);
  const tool = def.tool?.type;
  if (await useConstruction(room, p, msg, stack.id, tool === 'pickaxe')) return;
  const built = room.store.structureAt(tx, ty);
  if (built && (built.owner !== p.accountId || built.data.stairs)) {
    p.toast(built.data.stairs ? 'Keep the stair landing clear.' : 'This building belongs to another player.');
    return;
  }
  if (stack.id === 'waterskin_empty') {
    if (obj?.sub !== 'well') {
      const t = room.store.getTile(tx, ty);
      if (t === T.WATER || t === T.DEEP_WATER) {
        p.data.inv[slot] = { id: 'waterskin_murky', n: 1 };
        p.dirty('inv');
        room.fx({ kind: 'water', x: tx + 0.5, y: ty + 0.5 });
        p.toast('Murky river water. Boil it in a cooking pot before you drink, or risk a sick stomach.', 'info');
        return;
      }
      p.toast('Fill an empty waterskin at a town well, or at a river or lake.');
      return;
    }
    p.data.inv[slot] = { id: 'waterskin_full', n: 1 };
    p.dirty('inv');
    room.fx({ kind: 'water', x: tx + 0.5, y: ty + 0.5 });
    return;
  }

  if (obj && !obj.static) {
    if (obj.kind === 'crop') {
      if (tool === 'can') return waterCrop(room, p, obj);
      if (tool === 'hoe') return uprootCrop(room, p, obj);
      if (kind === 'fertilizer') return fertilize(room, p, slot, obj);
      return harvestCrop(room, p, obj);
    }
    if (tool === 'axe') return dismantle(room, p, obj);
    p.toast('Press the interact key to open it.');
    return;
  }
  if (obj) {
    p.toast('Press the interact key to use it.');
    return;
  }

  const tile = room.store.getTile(tx, ty);
  const node = NODES[tile];
  if (tile === T.FORAGE && kind !== 'seed' && kind !== 'placeable') return gatherForage(room, p, tx, ty);
  if (tile === T.GRASS_TALL && tool === 'axe') return cutGrass(room, p, tx, ty);
  if (node && (tool === 'axe' || tool === 'pickaxe')) return hitNode(room, p, stack, tx, ty, tile);
  if (node && tool) {
    p.toast(`${node.label} needs ${TOOL_NAME[node.tool ?? 'axe']}.`);
    return;
  }

  switch (true) {
    case tool === 'hoe':
      return till(room, p, tx, ty, tile);
    case tool === 'can':
      if (tile === T.TILLED || tile === T.TILLED_WET) {
        wetTile(room, tx, ty);
        room.fx({ kind: 'water', x: tx + 0.5, y: ty + 0.5, id: p.id, weapon: 'can' });
        return;
      }
      p.toast('Nothing to water here.');
      return;
    case tool === 'rod':
      return startCast(room, p, tx, ty);
    case tool === 'net':
      return catchBug(room, p, tx, ty, tile);
    case kind === 'seed':
      return plantSeed(room, p, slot, tx, ty);
    case kind === 'placeable':
      return place(room, p, slot, tx, ty, tile);
    case kind === 'fertilizer':
      p.toast('Use it on a growing crop.');
      return;
    case kind === 'animal':
      p.toast('Put it in a coop or barn (open the shelter).');
      return;
    case kind === 'ring' || kind === 'outfit':
      p.toast('Equip it from your pack.');
      return;
    default:
      return;
  }
}

function till(room: RoomApi, p: ServerPlayer, tx: number, ty: number, tile: number): void {
  if (tile === T.TILLED || tile === T.TILLED_WET) {
    p.toast('Already tilled.');
    return;
  }
  if (!TILLABLE.includes(tile)) {
    p.toast("You can't till that.");
    return;
  }
  room.setTile(tx, ty, T.TILLED);
  room.fx({ kind: 'till', x: tx + 0.5, y: ty + 0.5, id: p.id, weapon: 'hoe' });
  addSkillXp(p, 'farming', 1);
}

function hitNode(room: RoomApi, p: ServerPlayer, tool: Stack, tx: number, ty: number, tile: number): void {
  const node = NODES[tile]!;
  const tier = tool.p?.tier ?? 1;
  const toolType = ITEMS[tool.id]!.tool!.type;
  if (toolType !== node.tool) {
    p.toast(`${node.label} needs ${TOOL_NAME[node.tool ?? 'axe']}.`);
    return;
  }
  if (tier < node.minTier) {
    p.toast(`${node.label} needs a Tier ${node.minTier} ${node.tool}.`, 'bad');
    return;
  }
  const key = `${tx},${ty}`;
  const now = Date.now();
  let st = room.nodeHp.get(key);
  if (!st || now - st.last > 90_000) st = { hp: node.hp, last: now };
  const lv = skillLv(p, node.skill);
  st.hp -= toolDamage(tier, lv, p.stats.haste);
  st.last = now;
  room.nodeHp.set(key, st);
  const cx = tx + 0.5,
    cy = ty + 0.5;
  room.fx({ kind: node.tool === 'axe' ? 'chop' : 'mine', x: cx, y: cy, id: p.id, weapon: node.tool });
  if (st.hp > 0) return;

  const drops: Stack[] = [];
  const realm = otherworldOf(ty) ?? (isCaveY(ty) ? null : (inRealmLand(room.seed, tx, ty) ?? null)),
    cave = isCaveY(ty) ? caveBiomeAt(room.seed, tx, ty, room.store.generation) : null;
  for (const d of node.drops) {
    if (d.minTier && tier < d.minTier) continue;
    if (!dropAllowed(d, realm, cave)) continue;
    const chance = d.chance >= 1 ? 1 : d.chance * (1 + 0.15 * p.stats.luck);
    if (room.rand() >= chance) continue;
    let n = d.min + Math.floor(room.rand() * (d.max - d.min + 1));
    if (room.rand() < 0.05 * lv + 0.04 * p.stats.luck) n += 1; // skill double-drop
    drops.push({ id: d.item, n });
  }
  if (!fitsAll(p.data.inv, drops)) {
    st.hp = 1;
    p.toast('Your pack is full.', 'bad');
    return;
  }
  giveStacks(p, drops);
  room.nodeHp.delete(key);
  addSkillXp(p, node.skill, node.xp);
  room.setTile(tx, ty, isCaveY(ty) && node.to === T.GRASS ? T.CAVE_FLOOR : node.to); // nothing grows back underground
  if (node.respawnSec > 0)
    room.scheduleRespawn(tx, ty, tile === T.STUMP ? T.TREE : tile, room.wclock.now() + node.respawnSec * 1000);
  room.fx({ kind: 'break', x: cx, y: cy });
}

/** Axe on tall grass: cut it for fiber (it grows back the next morning). */
function cutGrass(room: RoomApi, p: ServerPlayer, tx: number, ty: number): void {
  const n = 1 + (room.rand() < 0.4 + 0.05 * skillLv(p, 'foraging') ? 1 : 0);
  if (!giveStacks(p, [{ id: 'fiber', n }])) {
    p.toast('Your pack is full.', 'bad');
    return;
  }
  addSkillXp(p, 'foraging', 1);
  room.setTile(tx, ty, T.GRASS);
  room.scheduleRespawn(tx, ty, T.GRASS_TALL, room.wclock.dayStart(room.wclock.day() + 1));
  room.fx({ kind: 'chop', x: tx + 0.5, y: ty + 0.5, id: p.id, weapon: 'axe' });
}

function gatherForage(room: RoomApi, p: ServerPlayer, tx: number, ty: number): void {
  const id = pickForage(
    room.wclock.season(),
    () => room.rand(),
    isCaveY(ty) ? null : (inRealmLand(room.seed, tx, ty) ?? null),
  );
  const n = room.rand() < 0.05 * skillLv(p, 'foraging') + 0.04 * p.stats.luck ? 2 : 1;
  if (!giveStacks(p, [{ id, n }])) {
    p.toast('Your pack is full.', 'bad');
    return;
  }
  addSkillXp(p, 'foraging', 4);
  room.setTile(tx, ty, T.GRASS);
  room.scheduleRespawn(tx, ty, T.FORAGE, room.wclock.dayStart(room.wclock.day() + 1));
  room.fx({ kind: 'harvest', x: tx + 0.5, y: ty + 0.5, id: p.id });
}

/** OPEN on a forage tile reaches here too. */
export function forageAt(room: RoomApi, p: ServerPlayer, tx: number, ty: number): boolean {
  if (room.store.getTile(tx, ty) !== T.FORAGE) return false;
  gatherForage(room, p, tx, ty);
  return true;
}

function eat(room: RoomApi, p: ServerPlayer, slot: number): void {
  const stack = p.data.inv[slot]!;
  const def = ITEMS[stack.id]!;
  const hurt = (def.cure ?? []).some((c) => p.data.buffs[c]);
  if (def.heal && !def.buff && !hurt && p.hp >= p.maxHp && (!def.nourishment || p.data.needs.food >= 100)) {
    p.toast("You're already at full health.");
    return;
  }
  if (def.nourishment) {
    p.data.needs.food = Math.min(100, p.data.needs.food + def.nourishment);
    p.dirty('needs');
  }
  if (def.heal) p.hp = Math.min(p.maxHp, p.hp + def.heal);
  if (def.cure?.length) {
    for (const c of def.cure) delete p.data.buffs[c];
    p.dirty('buffs');
    p.toast(`${def.name} used.`, 'good');
  }
  if (def.buff) {
    p.data.buffs[def.buff.kind] = { until: room.wclock.now() + def.buff.secs * 1000, power: def.buff.power };
    p.dirty('buffs');
  }
  // a balanced diet: produce, protein and something hearty within half an hour leaves you nourished
  const group = foodGroup(stack.id, def.kind);
  if (group) {
    const now = room.wclock.now();
    const meals = recordMeal(p.data.prog.meals ?? [], group, now);
    p.data.prog.meals = meals;
    p.dirty('stats');
    if (balanced(meals)) {
      p.data.prog.meals = [];
      const cur = p.data.buffs.regen;
      p.data.buffs.regen = {
        until: Math.max(cur?.until ?? 0, now + NOURISHED_SECS * 1000),
        power: Math.max(cur?.power ?? 0, 0.6),
      };
      p.dirty('buffs');
      p.toast('A balanced diet: you feel nourished (slow healing for ten minutes).', 'good');
    }
  }
  stack.n -= 1;
  if (stack.n <= 0) p.data.inv[slot] = null;
  p.dirty('inv');
  room.fx({ kind: 'heal', x: p.sim.x, y: p.sim.y, id: p.id });
}

function place(room: RoomApi, p: ServerPlayer, slot: number, tx: number, ty: number, tile: number): void {
  const stack = p.data.inv[slot]!;
  const def = ITEMS[stack.id]!;
  const pl = def.place!;
  if (isSolid(tile) || tile === T.DOOR || tile === T.FACE) {
    p.toast("You can't build there.");
    return;
  }
  if (room.store.objectAt(tx, ty)) {
    p.toast('Something is already there.');
    return;
  }
  const solidKind = pl.kind !== 'sprinkler' && pl.sub !== 'rug';
  if (solidKind && Math.floor(p.sim.x) === tx && Math.floor(p.sim.y) === ty) {
    p.toast("You're standing there.");
    return;
  }
  if (pl.kind === 'fence') room.setTile(tx, ty, T.FENCE);
  else {
    let data: Record<string, unknown> | undefined;
    if (pl.kind === 'chest') data = { slots: Array.from({ length: 30 }, () => null) };
    else if (pl.kind === 'shelter')
      data = { type: pl.sub, animals: 0, fed: false, ready: 0, lastDay: room.wclock.day() };
    else if (pl.kind === 'sign') data = { text: '' };
    const o: WorldObj = { x: tx, y: ty, kind: pl.kind, sub: pl.sub, owner: p.accountId, ...(data ? { data } : {}) };
    room.objects.put(o);
  }
  stack.n -= 1;
  if (stack.n <= 0) p.data.inv[slot] = null;
  p.dirty('inv');
  room.fx({ kind: 'place', x: tx + 0.5, y: ty + 0.5, id: p.id });
  questEvent(p, { type: 'place', target: def.id, n: 1 });
  syncQuests(p);
}

/** Axe on a placed object you own: take it back (containers must be empty). */
function dismantle(room: RoomApi, p: ServerPlayer, o: WorldObj): void {
  if (o.owner !== p.accountId) {
    p.toast("That isn't yours.");
    return;
  }
  if (o.kind === 'chest' && (o.data?.slots as Array<unknown> | undefined)?.some(Boolean)) {
    p.toast('Empty the chest first.');
    return;
  }
  if (o.kind === 'shelter' && ((o.data?.animals as number) ?? 0) > 0) {
    p.toast('Move the animals out first.');
    return;
  }
  const item = Object.values(ITEMS).find((d) => d.place && d.place.sub === o.sub);
  if (!item) return;
  if (!giveStacks(p, [{ id: item.id, n: 1 }])) {
    p.toast('Your pack is full.', 'bad');
    return;
  }
  room.objects.remove(o.x, o.y);
  const camp = p.data.prog.camp;
  if (camp && camp.x === o.x && camp.y === o.y) p.data.prog.camp = null;
}
