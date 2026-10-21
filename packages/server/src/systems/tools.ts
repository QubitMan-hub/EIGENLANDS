import {
  FORAGE_BY_SEASON, ITEMS, NODES, T, chunkOf, isSolid, toolDamage, type Stack, type UseMsg, type WorldObj,
} from '@eigenlands/shared';
import { tuning } from '../rooms/runtime';
import type { ServerPlayer } from '../rooms/player';
import type { RoomApi } from './api';
import { startCast } from './fishing';
import { catchBug } from './bugs';
import { fertilize, harvestCrop, plantSeed, uprootCrop, waterCrop, wetTile } from './farming';
import { addSkillXp, distToTile, fitsAll, giveStacks, isInt, skillLv, validSlot } from './helpers';

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

  // items that do not need a target
  if (kind === 'food' || kind === 'potion') { p.toolReadyAt = t0 + tuning.toolCooldownMs; eat(room, p, msg.slot); return; }

  const reach = def.tool?.type === 'rod' ? 5 : 2.2;
  if (distToTile(p, tx, ty) > reach) { p.toast('Too far away.'); return; }
  await room.ensureChunk(chunkOf(tx), chunkOf(ty));
  // the world may have moved on while the chunk loaded
  const stack = p.data.inv[msg.slot];
  if (p.deadT > 0 || !stack || stack.id !== first.id) return;
  p.toolReadyAt = Date.now() + tuning.toolCooldownMs;

  const slot = msg.slot;
  const obj = room.store.objectAt(tx, ty);
  const tool = def.tool?.type;

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
  if (obj) { p.toast('Press the interact key to use it.'); return; }

  const tile = room.store.getTile(tx, ty);
  const node = NODES[tile];
  if (tile === T.FORAGE && kind !== 'seed' && kind !== 'placeable') return gatherForage(room, p, tx, ty);
  if (node && (tool === 'axe' || tool === 'pickaxe')) return hitNode(room, p, stack, tx, ty, tile);
  if (node && tool) { p.toast(`${node.label} needs ${TOOL_NAME[node.tool ?? 'axe']}.`); return; }

  switch (true) {
    case tool === 'hoe': return till(room, p, tx, ty, tile);
    case tool === 'can':
      if (tile === T.TILLED || tile === T.TILLED_WET) { wetTile(room, tx, ty); room.fx({ kind: 'water', x: tx + 0.5, y: ty + 0.5 }); return; }
      p.toast('Nothing to water here.');
      return;
    case tool === 'rod': return startCast(room, p, tx, ty);
    case tool === 'net': return catchBug(room, p, tx, ty, tile);
    case kind === 'seed': return plantSeed(room, p, slot, tx, ty);
    case kind === 'placeable': return place(room, p, slot, tx, ty, tile);
    case kind === 'fertilizer': p.toast('Use it on a growing crop.'); return;
    case kind === 'animal': p.toast('Put it in a coop or barn (open the shelter).'); return;
    case kind === 'ring' || kind === 'outfit': p.toast('Equip it from your pack.'); return;
    default: return;
  }
}

function till(room: RoomApi, p: ServerPlayer, tx: number, ty: number, tile: number): void {
  if (tile === T.TILLED || tile === T.TILLED_WET) { p.toast('Already tilled.'); return; }
  if (!TILLABLE.includes(tile)) { p.toast("You can't till that."); return; }
  room.setTile(tx, ty, T.TILLED);
  room.fx({ kind: 'till', x: tx + 0.5, y: ty + 0.5 });
  addSkillXp(p, 'farming', 1);
}

function hitNode(room: RoomApi, p: ServerPlayer, tool: Stack, tx: number, ty: number, tile: number): void {
  const node = NODES[tile]!;
  const tier = tool.p?.tier ?? 1;
  const toolType = ITEMS[tool.id]!.tool!.type;
  if (toolType !== node.tool) { p.toast(`${node.label} needs ${TOOL_NAME[node.tool ?? 'axe']}.`); return; }
  if (tier < node.minTier) { p.toast(`${node.label} needs a Tier ${node.minTier} ${node.tool}.`, 'bad'); return; }
  const key = `${tx},${ty}`;
  const now = Date.now();
  let st = room.nodeHp.get(key);
  if (!st || now - st.last > 90_000) st = { hp: node.hp, last: now };
  const lv = skillLv(p, node.skill);
  st.hp -= toolDamage(tier, lv, p.stats.haste);
  st.last = now;
  room.nodeHp.set(key, st);
  const cx = tx + 0.5, cy = ty + 0.5;
  room.fx({ kind: node.tool === 'axe' ? 'chop' : 'mine', x: cx, y: cy });
  if (st.hp > 0) return;

  const drops: Stack[] = [];
  for (const d of node.drops) {
    if (d.minTier && tier < d.minTier) continue;
    const chance = d.chance >= 1 ? 1 : d.chance * (1 + 0.15 * p.stats.luck);
    if (room.rand() >= chance) continue;
    let n = d.min + Math.floor(room.rand() * (d.max - d.min + 1));
    if (room.rand() < 0.05 * lv + 0.04 * p.stats.luck) n += 1; // skill double-drop
    drops.push({ id: d.item, n });
  }
  if (!fitsAll(p.data.inv, drops)) { st.hp = 1; p.toast('Your pack is full.', 'bad'); return; }
  giveStacks(p, drops);
  room.nodeHp.delete(key);
  addSkillXp(p, node.skill, node.xp);
  room.setTile(tx, ty, node.to);
  if (node.respawnSec > 0) room.scheduleRespawn(tx, ty, tile === T.STUMP ? T.TREE : tile, room.wclock.now() + node.respawnSec * 1000);
  room.fx({ kind: 'break', x: cx, y: cy });
}

function gatherForage(room: RoomApi, p: ServerPlayer, tx: number, ty: number): void {
  const list = FORAGE_BY_SEASON[room.wclock.season()]!;
  const id = list[Math.floor(room.rand() * list.length)]!;
  const n = room.rand() < 0.05 * skillLv(p, 'foraging') + 0.04 * p.stats.luck ? 2 : 1;
  if (!giveStacks(p, [{ id, n }])) { p.toast('Your pack is full.', 'bad'); return; }
  addSkillXp(p, 'foraging', 4);
  room.setTile(tx, ty, T.GRASS);
  room.scheduleRespawn(tx, ty, T.FORAGE, room.wclock.dayStart(room.wclock.day() + 1));
  room.fx({ kind: 'harvest', x: tx + 0.5, y: ty + 0.5 });
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
  if (def.heal && !def.buff && p.hp >= p.maxHp) { p.toast("You're already at full health."); return; }
  if (def.heal) p.hp = Math.min(p.maxHp, p.hp + def.heal);
  if (def.buff) {
    p.data.buffs[def.buff.kind] = { until: room.wclock.now() + def.buff.secs * 1000, power: def.buff.power };
    p.dirty('buffs');
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
  if (isSolid(tile) || tile === T.DOOR || tile === T.FACE) { p.toast("You can't build there."); return; }
  if (room.store.objectAt(tx, ty)) { p.toast('Something is already there.'); return; }
  const solidKind = pl.kind !== 'sprinkler' && pl.sub !== 'rug';
  if (solidKind && Math.floor(p.sim.x) === tx && Math.floor(p.sim.y) === ty) { p.toast("You're standing there."); return; }
  if (pl.kind === 'fence') room.setTile(tx, ty, T.FENCE);
  else {
    let data: Record<string, unknown> | undefined;
    if (pl.kind === 'chest') data = { slots: Array.from({ length: 30 }, () => null) };
    else if (pl.kind === 'shelter') data = { type: pl.sub, animals: 0, fed: false, ready: 0, lastDay: room.wclock.day() };
    else if (pl.kind === 'sign') data = { text: '' };
    const o: WorldObj = { x: tx, y: ty, kind: pl.kind, sub: pl.sub, owner: p.accountId, ...(data ? { data } : {}) };
    room.objects.put(o);
  }
  stack.n -= 1;
  if (stack.n <= 0) p.data.inv[slot] = null;
  p.dirty('inv');
  room.fx({ kind: 'place', x: tx + 0.5, y: ty + 0.5 });
}

/** Axe on a placed object you own: take it back (containers must be empty). */
function dismantle(room: RoomApi, p: ServerPlayer, o: WorldObj): void {
  if (o.owner !== p.accountId) { p.toast("That isn't yours."); return; }
  if (o.kind === 'chest' && (o.data?.slots as Array<unknown> | undefined)?.some(Boolean)) { p.toast('Empty the chest first.'); return; }
  if (o.kind === 'shelter' && ((o.data?.animals as number) ?? 0) > 0) { p.toast('Move the animals out first.'); return; }
  const item = Object.values(ITEMS).find((d) => d.place && d.place.sub === o.sub);
  if (!item) return;
  if (!giveStacks(p, [{ id: item.id, n: 1 }])) { p.toast('Your pack is full.', 'bad'); return; }
  room.objects.remove(o.x, o.y);
}

