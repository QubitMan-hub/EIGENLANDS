import {
  BIOMES, BIOME_NAMES, caveLanding, isCaveY, FARM_ANIMALS, ITEMS, MSG, QUBITMAN, RUIN_LORE, RUIN_NAMES, ruinLoot, type Biome, STATUE_REMARKS, STATION_SUBS, addStack, chunkOf, cloneStack, countItem, isRipe, removeItem, validInventory,
  type ChestMsg, type Inventory, type OpenMsg, type PanelMsg, type ShelterMsg, type WorldObj,
} from '@eigenlands/shared';
import type { ServerPlayer } from '../rooms/player';
import type { RoomApi } from './api';
import { cropOf, harvestCrop } from './farming';
import { addSkillXp, distToTile, giveStacks, isInt, validSlot } from './helpers';
import { forageAt } from './tools';
import { boardPanel, questEvent, recordDeed } from './quests';

/** The statue of QubitMan (and its plaque): inscription + legend, and a villager's remark. */
function lorePanel(room: RoomApi, o: WorldObj): PanelMsg {
  const r = STATUE_REMARKS[Math.floor(room.rand() * STATUE_REMARKS.length)]!;
  return {
    kind: 'lore', tx: o.x, ty: o.y, sub: o.sub,
    lore: { title: QUBITMAN.title, plaque: QUBITMAN.plaque, epitaph: QUBITMAN.epitaph, pages: [...QUBITMAN.legend], remark: { npc: r[0], text: r[1] } },
  };
}

const OPEN_REACH = 3.5;

const chestSlots = (o: WorldObj): Inventory => {
  const inv = validInventory((o.data as { slots?: unknown } | undefined)?.slots);
  while (inv.length < 30) inv.push(null);
  return inv;
};

function panelFor(o: WorldObj, p: ServerPlayer): PanelMsg | null {
  const base = { tx: o.x, ty: o.y, sub: o.sub };
  if (o.kind === 'station') return { kind: 'station', ...base, station: STATION_SUBS[o.sub] };
  if (o.kind === 'chest') return { kind: 'chest', ...base, chest: chestSlots(o) };
  if (o.kind === 'shelter') {
    const d = o.data as { animals: number; fed: boolean; ready: number };
    const f = FARM_ANIMALS[o.sub as 'coop' | 'barn'];
    return { kind: 'shelter', ...base, shelter: { type: o.sub as 'coop' | 'barn', animals: d.animals, max: f.max, fed: d.fed, ready: d.ready } };
  }
  if (o.kind === 'sign') return { kind: 'sign', ...base, sign: String((o.data as { text?: string } | undefined)?.text ?? '') };
  void p;
  return null;
}

function sendPanel(p: ServerPlayer, o: WorldObj): void {
  const m = panelFor(o, p);
  if (m) p.client.send(MSG.PANEL, m);
}

export async function handleOpen(room: RoomApi, p: ServerPlayer, msg: OpenMsg): Promise<void> {
  if (!msg || !isInt(msg.tx, -1e6, 1e6) || !isInt(msg.ty, -1e6, 1e6) || p.deadT > 0) return;
  if (distToTile(p, msg.tx, msg.ty) > OPEN_REACH) { p.toast('Too far away.'); return; }
  await room.ensureChunk(chunkOf(msg.tx), chunkOf(msg.ty));
  const o = room.store.objectAt(msg.tx, msg.ty);
  if (!o) { forageAt(room, p, msg.tx, msg.ty); return; }
  if (o.kind === 'crop') {
    const d = cropOf(o);
    if (!d.dead && isRipe(d)) harvestCrop(room, p, o);
    else p.toast(d.dead ? 'It has withered.' : 'It is still growing.');
    return;
  }
  if ((o.kind === 'chest' || o.kind === 'shelter') && o.owner !== p.accountId) { p.toast("That isn't yours."); return; }
  if (o.static && (o.sub === 'shrine_altar' || o.sub === 'shrine_pillar')) { room.shrineInteract?.(p, o); return; }
  if (o.static && (o.sub === 'statue' || o.sub === 'plaque')) {
    p.client.send(MSG.PANEL, lorePanel(room, o));
    questEvent(p, { type: 'read', target: 'statue', n: 1 });
    if (!p.data.deeds.statue) recordDeed(p, 'statue', 'the plaque', room.wclock.day());
    return;
  }
  if (o.static && o.sub === 'ruin_cache') { openRuinCache(room, p, o); return; }
  if (o.static && (o.sub === 'cave_mouth' || o.sub === 'cave_ladder')) { await climb(room, p, o); return; }
  if (o.static && RUIN_LORE[o.sub]) {
    const l = RUIN_LORE[o.sub]!;
    p.client.send(MSG.PANEL, { kind: 'lore', tx: o.x, ty: o.y, sub: o.sub, lore: { title: RUIN_NAMES[o.sub] ?? 'Ruin', plaque: l.plaque, epitaph: l.epitaph, pages: [...l.pages] } });
    return;
  }
  if (o.static && o.sub === 'board') { p.client.send(MSG.PANEL, boardPanel(p, room.wclock.day(), room.seed, { x: o.x, y: o.y })); return; }
  sendPanel(p, o);
}

function ownedAt(room: RoomApi, p: ServerPlayer, tx: unknown, ty: unknown, kind: 'chest' | 'shelter'): WorldObj | null {
  if (!isInt(tx, -1e6, 1e6) || !isInt(ty, -1e6, 1e6)) return null;
  const o = room.store.objectAt(tx, ty);
  if (!o || o.kind !== kind || o.static) return null;
  if (o.owner !== p.accountId) { p.toast("That isn't yours."); return null; }
  if (distToTile(p, tx, ty) > OPEN_REACH) { p.toast('Too far away.'); return null; }
  return o;
}

export function handleChest(room: RoomApi, p: ServerPlayer, msg: ChestMsg): void {
  if (!msg || (msg.action !== 'put' && msg.action !== 'take') || !validSlot(msg.slot) || !isInt(msg.n, 1, 99)) return;
  const o = ownedAt(room, p, msg.tx, msg.ty, 'chest');
  if (!o) return;
  const slots = chestSlots(o);
  const from = msg.action === 'put' ? p.data.inv : slots;
  const to = msg.action === 'put' ? slots : p.data.inv;
  const s = from[msg.slot];
  if (!s) return;
  const n = Math.min(msg.n, s.n);
  const moving = { ...cloneStack(s), n };
  const left = addStack(to, moving);
  const moved = n - left;
  if (moved <= 0) { p.toast(msg.action === 'put' ? 'The chest is full.' : 'Your pack is full.', 'bad'); return; }
  s.n -= moved;
  if (s.n <= 0) from[msg.slot] = null;
  o.data = { ...(o.data ?? {}), slots: slots.slice(0, 30) };
  room.objects.update(o);
  p.dirty('inv');
  sendPanel(p, o);
}

export function handleShelter(room: RoomApi, p: ServerPlayer, msg: ShelterMsg): void {
  if (!msg || (msg.action !== 'add' && msg.action !== 'feed' && msg.action !== 'collect')) return;
  const o = ownedAt(room, p, msg.tx, msg.ty, 'shelter');
  if (!o) return;
  const d = o.data as { animals: number; fed: boolean; ready: number };
  const f = FARM_ANIMALS[o.sub as 'coop' | 'barn'];
  if (msg.action === 'add') {
    if (d.animals >= f.max) { p.toast('It is full.'); return; }
    if (!removeItem(p.data.inv, f.animal, 1)) { p.toast(`You need a ${ITEMS[f.animal]?.name.toLowerCase()}.`); return; }
    d.animals += 1;
    p.dirty('inv');
  } else if (msg.action === 'feed') {
    if (d.animals <= 0) { p.toast('There is nobody to feed.'); return; }
    if (d.fed) { p.toast('They are already fed today.'); return; }
    if (countItem(p.data.inv, 'hay') < d.animals) { p.toast(`You need ${d.animals} hay.`, 'bad'); return; }
    removeItem(p.data.inv, 'hay', d.animals);
    d.fed = true;
    p.dirty('inv');
  } else {
    if (d.ready <= 0) { p.toast(`No ${f.product} yet.`); return; }
    if (!giveStacks(p, [{ id: f.product, n: d.ready }])) { p.toast('Your pack is full.', 'bad'); return; }
    d.ready = 0;
    addSkillXp(p, 'farming', 3);
  }
  room.objects.update(o);
  sendPanel(p, o);
}


/** A ruin's treasure cache: every traveller may open each one once. */
function openRuinCache(room: RoomApi, p: ServerPlayer, o: WorldObj): void {
  const d = (o.data ?? {}) as { ruin?: string; biome?: string };
  const id = typeof d.ruin === 'string' ? d.ruin : `${o.x},${o.y}`;
  if (p.data.prog.ruins.includes(id)) { p.toast('Only dust and old wax left. You have already searched this cache.'); return; }
  const biome = (BIOMES as readonly string[]).includes(d.biome ?? '') ? (d.biome as Biome) : 'meadow';
  const loot = ruinLoot(room.seed, id, biome, room.rand);
  if (!giveStacks(p, loot)) { p.toast('Your pack is too full to carry the cache\'s contents.', 'bad'); return; }
  p.data.prog.ruins.push(id);
  p.dirty('inv');
  p.toast(isCaveY(o.y) ? 'You found a forgotten miner\'s cache in the Undercroft!' : `You found a forgotten cache in the ${BIOME_NAMES[biome]}!`, 'good');
  room.fx({ kind: 'craft', x: o.x + 0.5, y: o.y + 0.5 });
}

/** Climb down a cave mouth into the Undercroft, or up its ladder back to daylight. */
async function climb(room: RoomApi, p: ServerPlayer, o: WorldObj): Promise<void> {
  const id = (o.data as { cave?: unknown } | undefined)?.cave;
  const down = o.sub === 'cave_mouth';
  const to = typeof id === 'string' ? caveLanding(room.seed, id, down) : null;
  if (!to) return;
  await room.ensureChunk(chunkOf(Math.floor(to.x)), chunkOf(Math.floor(to.y)));
  p.sim.x = to.x; p.sim.y = to.y;
  p.queue.length = 0;
  p.toast(down ? 'You climb down into the Undercroft. Mind the dark.' : 'You climb back up into the daylight.');
  room.fx({ kind: 'craft', x: to.x, y: to.y });
}
