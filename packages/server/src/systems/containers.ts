import { ENEMY_DEFS, ENEMY_KEY_BY_KIND, WAY_SUBS } from '@eigenlands/shared';
import { guildPanel } from './guild';
import {
  isCryptY,
  RESTED_SECS,
  RESTED_XP_MULT,
  readHerd,
  advanceHerd,
  breedHerd,
  isLivestock,
  LIVESTOCK,
  HERD_CAPACITY,
  shelterAccepts,
} from '@eigenlands/shared';
import {
  catalogVaultDrops,
  isMineLine,
  mineLineKey,
  mineLinePosition,
  minePosition,
  BIOMES,
  BIOME_NAMES,
  hash2,
  caveLanding,
  isCaveY,
  FARM_ANIMALS,
  ITEMS,
  MSG,
  QUBITMAN,
  RUIN_LORE,
  STORY_READ,
  STORY_READABLE,
  STORY_XP,
  storySiteById,
  storyText,
  type StoryKind,
  RUIN_NAMES,
  ruinLoot,
  type Biome,
  STATUE_REMARKS,
  STATION_SUBS,
  addStack,
  chunkOf,
  cloneStack,
  countItem,
  isRipe,
  removeItem,
  validInventory,
  type ChestMsg,
  type Inventory,
  type OpenMsg,
  type PanelMsg,
  type ShelterMsg,
  type WorldObj,
} from '@eigenlands/shared';
import type { ServerPlayer } from '../rooms/player';
import type { RoomApi } from './api';
import { cropOf, harvestCrop } from './farming';
import { addSkillXp, distToTile, giveStacks, isInt, validSlot } from './helpers';
import { openConstruction } from './construction';
import { forageAt } from './tools';
import { boardPanel, questEvent, recordDeed } from './quests';

/** The statue of QubitMan (and its plaque): inscription + legend, and a villager's remark. */
function lorePanel(room: RoomApi, o: WorldObj): PanelMsg {
  const r = STATUE_REMARKS[Math.floor(room.rand() * STATUE_REMARKS.length)]!;
  return {
    kind: 'lore',
    tx: o.x,
    ty: o.y,
    sub: o.sub,
    lore: {
      title: QUBITMAN.title,
      plaque: QUBITMAN.plaque,
      epitaph: QUBITMAN.epitaph,
      pages: [...QUBITMAN.legend],
      remark: { npc: r[0], text: r[1] },
    },
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
  if (o.kind === 'shelter' && o.sub === 'apiary') {
    const d = o.data as { animals: number; fed: boolean; ready: number },
      f = FARM_ANIMALS.apiary!;
    return {
      kind: 'shelter',
      ...base,
      shelter: {
        type: o.sub,
        name: f.name,
        animal: f.animalName,
        product: f.productName,
        animals: d.animals,
        max: f.max,
        fed: d.fed,
        ready: d.ready,
      },
    };
  }
  if (o.kind === 'shelter') {
    const d = readHerd(o.data, o.sub, Number(o.data?.lastDay ?? 0));
    return {
      kind: 'shelter',
      ...base,
      shelter: {
        type: o.sub,
        name: FARM_ANIMALS[o.sub]?.name,
        animals: d.animals,
        max: HERD_CAPACITY,
        fed: d.fed,
        ready: d.ready,
        herd: d.herd,
        stock: d.stock,
        day: d.lastDay,
        cared: d.cared === d.lastDay,
      },
    };
  }
  if (o.kind === 'sign')
    return { kind: 'sign', ...base, sign: String((o.data as { text?: string } | undefined)?.text ?? '') };
  void p;
  return null;
}

function sendPanel(p: ServerPlayer, o: WorldObj): void {
  const m = panelFor(o, p);
  if (m) p.client.send(MSG.PANEL, m);
}

/** the realm props handled by features/otherworlds */
const REALM_SUBS = new Set([
  'realm_portal',
  'realm_return',
  'realm_lore',
  'realm_altar',
  'updraft',
  'wind_chime',
  'chrono_dial',
  'chrono_gate',
  'chrono_rift',
  'sky_bloom',
  'umbral_cap',
  'time_sand',
]);

export async function handleOpen(room: RoomApi, p: ServerPlayer, msg: OpenMsg): Promise<void> {
  if (!msg || !isInt(msg.tx, -1e6, 1e6) || !isInt(msg.ty, -1e6, 1e6) || p.deadT > 0) return;
  if (distToTile(p, msg.tx, msg.ty) > OPEN_REACH) {
    p.toast('Too far away.');
    return;
  }
  await room.ensureChunk(chunkOf(msg.tx), chunkOf(msg.ty));
  if (p.deadT > 0 || distToTile(p, msg.tx, msg.ty) > OPEN_REACH) return;
  if (p.sim.cart > 0) {
    // A rider can always get out onto a dry track. Prefer the adjacent shoulder.
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]) {
      const x = Math.floor(p.sim.x) + dx!,
        y = Math.floor(p.sim.y) + dy!;
      if (!room.store.solidAt(x, y)) {
        p.sim.x = x + 0.5;
        p.sim.y = y + 0.5;
        break;
      }
    }
    p.sim.cart = 0;
    p.queue.length = 0;
    p.toast('You step off the minecart.');
    return;
  }
  if (await openConstruction(room, p, msg.tx, msg.ty)) return;
  const o = room.store.objectAt(msg.tx, msg.ty);
  if (!o) {
    forageAt(room, p, msg.tx, msg.ty);
    return;
  }
  if (o.static && ['stairs_up', 'stairs_down', 'dive_gate', 'dive_exit'].includes(o.sub)) {
    const to = o.data?.to as { x?: unknown; y?: unknown } | undefined;
    if (!to || typeof to.x !== 'number' || typeof to.y !== 'number' || !Number.isFinite(to.x) || !Number.isFinite(to.y))
      return;
    await room.ensureChunk(chunkOf(to.x), chunkOf(to.y));
    if (o.sub === 'dive_gate' && countItem(p.data.inv, 'sloop') < 1) {
      p.toast('Bring a Sloop Charter so you can surface safely.', 'bad');
      return;
    }
    if (o.sub !== 'dive_exit' && room.store.solidAt(Math.floor(to.x), Math.floor(to.y))) {
      p.toast('The landing is blocked. Clear it before using the stairs.', 'bad');
      return;
    }
    const hasShip = countItem(p.data.inv, 'sloop') > 0;
    p.sim.x = o.sub === 'dive_exit' && !hasShip ? 0.5 : to.x;
    p.sim.y = o.sub === 'dive_exit' && !hasShip ? 4.5 : to.y;
    p.sim.boat = o.sub === 'dive_exit' && hasShip ? 1 : 0;
    p.sim.dashT = 0;
    p.queue.length = 0;
    p.toast(
      o.sub === 'stairs_up'
        ? 'You climb to the upper floor.'
        : o.sub === 'stairs_down'
          ? 'You return downstairs.'
          : o.sub === 'dive_gate'
            ? 'You descend into a dry chamber beneath the sea.'
            : 'You surface beside your sloop.',
    );
    return;
  }
  if (o.static && o.sub === 'minecart') {
    const track = room.store.solidAt.mine?.(o.x, o.y);
    if (!track || room.store.solidAt(o.x, o.y)) return;
    let start = 0;
    if (isMineLine(track)) {
      start = track.index.get(mineLineKey(o.x, o.y)) ?? -1;
      if (start < 0) return;
    } else if (track.x !== o.x || track.y !== o.y) return;
    const pos = isMineLine(track) ? mineLinePosition(track, start) : minePosition(track, 0);
    p.sim.x = pos.x;
    p.sim.y = pos.y;
    p.sim.faceX = pos.fx;
    p.sim.faceY = pos.fy;
    p.sim.cart = start + 1;
    p.sim.boat = 0;
    p.sim.dashT = 0;
    p.sim.charge = 0;
    p.sim.hold = 0;
    p.queue.length = 0;
    p.toast('Minecart: push along the rails to roll, against them to reverse; the buffers stop you. Use steps off.');
    return;
  }
  if (o.static && REALM_SUBS.has(o.sub) && (await room.otherworldInteract?.(p, o))) return;
  if (o.sub === 'fallen_star') {
    room.openStar?.(p, o);
    return;
  }
  if (['bed', 'double_bed', 'canopy_bed', 'hammock', 'camp_tent'].includes(o.sub)) {
    if (o.owner && o.owner !== p.accountId) {
      p.toast('Ask the owner before using their bed.');
      return;
    }
    if (
      [...room.state.enemies.values()].some(
        (e) =>
          !e.ally &&
          !ENEMY_DEFS[ENEMY_KEY_BY_KIND[e.kind] as keyof typeof ENEMY_DEFS]?.passive &&
          Math.hypot(e.x - p.sim.x, e.y - p.sim.y) < 12,
      )
    ) {
      p.toast('It is not safe to rest with enemies nearby.');
      return;
    }
    const now = room.wclock.now();
    if ((p.data.buffs.bed_rest?.until ?? 0) > now) {
      p.toast('You are already rested. Food and medicine help between rests.');
      return;
    }
    p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.3));
    p.sim.stamina = 100;
    p.data.buffs.bed_rest = { until: now + 24 * 60 * 1000, power: 1 };
    p.dirty('buffs');
    room.fx({ kind: 'heal', x: p.sim.x, y: p.sim.y, id: p.id });
    if (o.sub === 'camp_tent') {
      p.data.prog.camp = { x: o.x, y: o.y };
      p.dirty('stats');
      p.toast('You rest in your tent. If you fall, you will wake here.', 'good');
      return;
    }
    // your own bed under your own roof: you wake well rested
    const home = room.store.structureAt(o.x, o.y);
    if (o.owner === p.accountId && home?.owner === p.accountId && home.data.roof) {
      p.data.buffs.rested = { until: now + RESTED_SECS * 1000, power: RESTED_XP_MULT };
      p.toast('You sleep soundly in your own bed, under your own roof, and wake well rested.', 'good');
      return;
    }
    p.toast('You rest and recover health and stamina. The shared world clock keeps running.', 'good');
    return;
  }
  if (room.guildInteract?.(p, o)) return;
  if (o.kind === 'crop') {
    const d = cropOf(o);
    if (!d.dead && isRipe(d)) harvestCrop(room, p, o);
    else p.toast(d.dead ? 'It has withered.' : 'It is still growing.');
    return;
  }
  if ((o.kind === 'chest' || o.kind === 'shelter') && o.owner !== p.accountId) {
    p.toast("That isn't yours.");
    return;
  }
  if (o.static && WAY_SUBS.has(o.sub)) {
    room.travelInteract?.(p, o);
    return;
  }
  if (o.static && (o.sub === 'shrine_altar' || o.sub === 'shrine_pillar')) {
    room.shrineInteract?.(p, o);
    return;
  }
  if (o.static && (o.sub === 'statue' || o.sub === 'plaque')) {
    p.client.send(MSG.PANEL, lorePanel(room, o));
    questEvent(p, { type: 'read', target: 'statue', n: 1 });
    if (!p.data.deeds.statue) recordDeed(p, 'statue', 'the plaque', room.wclock.day());
    return;
  }
  if (o.static && o.sub === 'cave_altar') {
    if (countItem(p.data.inv, 'deep_sigil') < 1) {
      p.toast('A resonant arena. Craft a Deep Sigil at a workbench, then return at level 12.');
      return;
    }
    if (room.summonBoss?.(p, 'deep_sigil', o.x - 7, o.y + 6)) {
      removeItem(p.data.inv, 'deep_sigil', 1);
      p.dirty('inv');
    }
    return;
  }
  if (o.static && (o.sub === 'ruin_cache' || o.sub === 'sea_cache')) {
    openRuinCache(room, p, o);
    return;
  }
  if (o.static && (o.sub === 'cave_mouth' || o.sub === 'cave_ladder' || o.sub === 'cave_lift')) {
    await climb(room, p, o);
    return;
  }
  if (
    o.static &&
    ['ruin_crypt', 'crypt_exit', 'crypt_reliquary', 'crypt_plaque', 'trial_brazier'].includes(o.sub) &&
    (o.sub !== 'trial_brazier' || isCryptY(o.y))
  ) {
    await room.cryptInteract?.(p, o);
    return;
  }
  if (o.static && STORY_READABLE.has(o.sub)) {
    readStory(room, p, o);
    return;
  }
  if (o.static && RUIN_LORE[o.sub]) {
    const l = RUIN_LORE[o.sub]!;
    p.client.send(MSG.PANEL, {
      kind: 'lore',
      tx: o.x,
      ty: o.y,
      sub: o.sub,
      lore: { title: RUIN_NAMES[o.sub] ?? 'Ruin', plaque: l.plaque, epitaph: l.epitaph, pages: [...l.pages] },
    });
    return;
  }
  if ((o.static && o.sub === 'guild_board') || o.sub === 'guild_noticeboard') {
    p.client.send(MSG.PANEL, guildPanel(room, p, o));
    return;
  }
  if (o.static && o.sub === 'board') {
    p.client.send(MSG.PANEL, boardPanel(p, room.wclock.day(), room.seed, { x: o.x, y: o.y }));
    return;
  }
  if (o.kind === 'sign' && ['cave_archive', 'cave_waymark'].includes(o.sub))
    questEvent(p, { type: 'read', target: o.sub, n: 1 });
  if (o.kind === 'chest') room.fx({ kind: 'chest', x: o.x + 0.5, y: o.y + 0.5 });
  sendPanel(p, o);
}

function ownedAt(room: RoomApi, p: ServerPlayer, tx: unknown, ty: unknown, kind: 'chest' | 'shelter'): WorldObj | null {
  if (!isInt(tx, -1e6, 1e6) || !isInt(ty, -1e6, 1e6)) return null;
  const o = room.store.objectAt(tx, ty);
  if (!o || o.kind !== kind || o.static) return null;
  if (o.owner !== p.accountId) {
    p.toast("That isn't yours.");
    return null;
  }
  if (distToTile(p, tx, ty) > OPEN_REACH) {
    p.toast('Too far away.');
    return null;
  }
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
  if (moved <= 0) {
    p.toast(msg.action === 'put' ? 'The chest is full.' : 'Your pack is full.', 'bad');
    return;
  }
  s.n -= moved;
  if (s.n <= 0) from[msg.slot] = null;
  o.data = { ...(o.data ?? {}), slots: slots.slice(0, 30) };
  p.dirty('inv');
  // a recovered satchel, once emptied, is simply gone
  if (o.sub === 'lost_satchel' && !slots.some(Boolean)) {
    room.objects.remove(o.x, o.y);
    p.toast('You have recovered everything from your satchel.', 'good');
    return;
  }
  room.objects.update(o);
  sendPanel(p, o);
}

/** What a keeper carries to collect from a pen: shears for wool, a pail for goat milk. */

export function handleShelter(room: RoomApi, p: ServerPlayer, msg: ShelterMsg): void {
  if (!msg || !['add', 'feed', 'collect', 'buy', 'care', 'breed'].includes(msg.action) || p.deadT > 0) return;
  const o = ownedAt(room, p, msg.tx, msg.ty, 'shelter');
  if (!o) return;
  if (o.sub === 'apiary') {
    handleApiary(room, p, o, msg);
    return;
  }
  const day = room.wclock.day();
  let d = advanceHerd(readHerd(o.data, o.sub, day), day);
  const base = FARM_ANIMALS[o.sub];
  if (!base) return;
  if (msg.action === 'add' || msg.action === 'buy') {
    const species = msg.action === 'add' ? base.animal : msg.species;
    if (!isLivestock(species) || !shelterAccepts(species, o.sub)) return;
    if (d.herd.length >= HERD_CAPACITY) {
      p.toast('This shelter is full. Build another for a larger ranch.');
      return;
    }
    if (msg.action === 'add') {
      if (!removeItem(p.data.inv, species, 1)) {
        p.toast(`Bring a ${species} from the farmer, or adopt one here.`);
        return;
      }
      p.dirty('inv');
    } else {
      if (p.data.coins < LIVESTOCK[species].price) {
        p.toast('Not enough coins.', 'bad');
        return;
      }
      p.data.coins -= LIVESTOCK[species].price;
      p.dirty('coins');
    }
    d.herd.push({ id: d.serial++, species, born: day - (msg.action === 'add' ? 8 : 0), happy: 60, bred: -1e9 });
    d.animals = d.herd.length;
  } else if (msg.action === 'feed') {
    if (d.fed || !d.herd.length) {
      p.toast(d.fed ? 'Already fed today.' : 'There is nobody to feed.');
      return;
    }
    if (!removeItem(p.data.inv, 'hay', d.herd.length)) {
      p.toast(`You need ${d.herd.length} hay.`, 'bad');
      return;
    }
    d.fed = true;
    p.dirty('inv');
  } else if (msg.action === 'care') {
    if (d.cared === day || !d.herd.length) {
      p.toast('Care for them again tomorrow.');
      return;
    }
    d.cared = day;
    d.herd.forEach((a) => (a.happy = Math.min(100, a.happy + 6)));
  } else if (msg.action === 'breed') {
    if (!isLivestock(msg.species)) return;
    const next = breedHerd(d, msg.species, day);
    if (!next) {
      p.toast('Need two fed, happy adults of the same species, a free stall, and four days between births.');
      return;
    }
    if (!removeItem(p.data.inv, 'hay', 2)) {
      p.toast('Breeding needs 2 extra hay.');
      return;
    }
    d = next;
    p.dirty('inv');
    p.toast('A new arrival! Young animals grow over several days.', 'good');
  } else {
    const products = Object.entries(d.stock)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ id, n }));
    if (!products.length) {
      p.toast('No products ready yet. Feed and care for your adults.');
      return;
    }
    for (const [product, tool] of [
      ['wool', 'shears'],
      ['goat_milk', 'milk_pail'],
    ])
      if ((d.stock[product!] ?? 0) > 0 && countItem(p.data.inv, tool!) < 1) {
        p.toast(`Bring ${ITEMS[tool!]?.name ?? tool} to collect ${ITEMS[product!]?.name ?? product}.`, 'bad');
        return;
      }
    if (!giveStacks(p, products)) {
      p.toast('Make room for the whole collection.', 'bad');
      return;
    }
    d.stock = {};
    d.ready = 0;
    addSkillXp(p, 'farming', 3);
  }
  o.data = d;
  room.objects.update(o);
  sendPanel(p, o);
}

/** Apiaries keep the catalog's colony model; mammals and poultry use individuals. */
function handleApiary(room: RoomApi, p: ServerPlayer, o: WorldObj, msg: ShelterMsg): void {
  const d = o.data as { animals: number; fed: boolean; ready: number },
    f = FARM_ANIMALS.apiary!;
  if (msg.action === 'add') {
    if (d.animals >= f.max || !removeItem(p.data.inv, f.animal, 1)) return;
    d.animals++;
    p.dirty('inv');
  } else if (msg.action === 'feed') {
    if (d.fed || d.animals < 1 || !removeItem(p.data.inv, 'hay', d.animals)) return;
    d.fed = true;
    p.dirty('inv');
  } else if (msg.action === 'collect') {
    if (d.ready < 1 || !giveStacks(p, [{ id: f.product, n: d.ready }])) return;
    d.ready = 0;
  } else return;
  room.objects.update(o);
  sendPanel(p, o);
}

/** A ruin's treasure cache: every traveller may open each one once. */
/** Themed vault rewards: the biome's own metals and finds, deeper vaults pay more, and a rare heart crystal. */
function vaultLoot(theme: string, depth: number, rand: () => number): Array<{ id: string; n: number }> {
  const r = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1)) + Math.min(3, depth - 1);
  const table: Record<string, Array<{ id: string; n: number }>> = {
    limestone: [
      { id: 'coal', n: r(4, 6) },
      { id: 'copper_ore', n: r(3, 5) },
      { id: 'healing_potion', n: 2 },
    ],
    glowmoss: [
      { id: 'healing_herb', n: r(4, 6) },
      { id: 'healing_potion', n: 2 },
      { id: 'fiber', n: r(3, 5) },
    ],
    crystal: [
      { id: 'qubit_crystal', n: r(2, 3) },
      { id: 'silver_ore', n: r(2, 3) },
      { id: 'healing_potion', n: 1 },
    ],
    basalt: [
      { id: 'iron_ore', n: r(4, 6) },
      { id: 'coal', n: r(4, 6) },
      { id: 'gold_ore', n: r(1, 2) },
    ],
    frost: [
      { id: 'silver_ore', n: r(3, 4) },
      { id: 'iron_ore', n: r(3, 4) },
      { id: 'qubit_crystal', n: 1 },
    ],
    drowned: [
      { id: 'copper_ore', n: r(4, 5) },
      { id: 'silver_ore', n: r(2, 3) },
      { id: 'healing_potion', n: 2 },
    ],
  };
  const out = [...(table[theme] ?? table.limestone!)];
  // scrolls, collectibles and gems the catalog places in this kind of vault (deeper vaults pay a little more often)
  for (const d of catalogVaultDrops(theme))
    if (rand() < d.weight * (0.7 + 0.15 * depth)) out.push({ id: d.item, n: 1 });
  if (rand() < 0.05) out.push({ id: 'heart_crystal', n: 1 });
  return out;
}

/** Read a story scene's journal, grave, bill of lading, carving or shrine notes; the first reading pays a little XP. */
function readStory(room: RoomApi, p: ServerPlayer, o: WorldObj): void {
  const d = (o.data ?? {}) as { story?: string; biome?: string };
  const id = typeof d.story === 'string' ? d.story : `${o.x},${o.y}`;
  const kind = (Object.keys(STORY_READ) as StoryKind[]).find((k) => STORY_READ[k] === o.sub);
  if (!kind) return;
  const biome = (BIOMES as readonly string[]).includes(d.biome ?? '') ? (d.biome as Biome) : 'meadow';
  // the scene's anchor is the story site, whichever of its props is read
  const site = storyText(room.seed, id, kind, biome, ...storyAnchor(room.seed, id, o));
  p.client.send(MSG.PANEL, {
    kind: 'lore',
    tx: o.x,
    ty: o.y,
    sub: o.sub,
    lore: { title: site.title, plaque: site.plaque, epitaph: site.epitaph, pages: site.pages },
  });
  const read = (p.data.prog.lore ??= []);
  if (!read.includes(id)) {
    read.push(id);
    p.dirty('stats');
    room.grantXp?.(p, STORY_XP);
    p.toast(`A story found: ${site.title}. (${read.length} so far)`, 'good');
  }
}

/** a story's site coordinates, from its id */
function storyAnchor(seed: number, id: string, o: WorldObj): [number, number] {
  const s = storySiteById(seed, id);
  return s ? [s.x, s.y] : [o.x, o.y];
}

function openRuinCache(room: RoomApi, p: ServerPlayer, o: WorldObj): void {
  const d = (o.data ?? {}) as {
    ruin?: string;
    biome?: string;
    cave?: boolean;
    depth?: number;
    secret?: boolean;
    vault?: string;
    theme?: string;
  };
  const id = typeof d.ruin === 'string' ? d.ruin : `${o.x},${o.y}`;
  if (p.data.prog.ruins.includes(id)) {
    p.toast('Only dust and old wax left. You have already searched this cache.');
    return;
  }
  if (d.vault && room.vaultGuard?.(p, o)) return;
  const biome = (BIOMES as readonly string[]).includes(d.biome ?? '') ? (d.biome as Biome) : 'meadow';
  const ocean = o.sub === 'sea_cache';
  const loot = d.vault
    ? vaultLoot(d.theme ?? 'limestone', d.depth ?? 1, room.rand)
    : d.cave
      ? [
          { id: 'iron_ore', n: 2 + Math.min(4, d.depth ?? 1) },
          { id: d.secret ? 'qubit_crystal' : 'healing_potion', n: d.secret ? 1 : 2 },
          { id: 'coal', n: 3 },
        ]
      : ocean
        ? [
            { id: 'doubloon', n: 2 + Math.floor(hash2(room.seed, o.x, o.y, 1703) * 4) },
            { id: 'cloth', n: 2 },
            { id: hash2(room.seed, o.x, o.y, 1704) < 0.15 ? 'qubit_crystal' : 'plank', n: 1 },
          ]
        : ruinLoot(room.seed, id, biome, room.rand);
  if (!giveStacks(p, loot)) {
    p.toast("Your pack is too full to carry the cache's contents.", 'bad');
    return;
  }
  p.data.prog.ruins.push(id);
  p.dirty('inv');
  p.toast(
    ocean
      ? 'You recovered a sealed voyager’s cache from the deep sea!'
      : isCaveY(o.y)
        ? "You found a forgotten miner's cache in the Undercroft!"
        : `You found a forgotten cache in the ${BIOME_NAMES[biome]}!`,
    'good',
  );
  room.fx({ kind: 'chest', x: o.x + 0.5, y: o.y + 0.5 });
}

/** Climb down a cave mouth into the Undercroft, or up its ladder back to daylight. */
async function climb(room: RoomApi, p: ServerPlayer, o: WorldObj): Promise<void> {
  const id = (o.data as { cave?: unknown } | undefined)?.cave;
  const down = o.sub === 'cave_mouth';
  const to = typeof id === 'string' ? caveLanding(room.seed, id, down) : null;
  if (!to) return;
  await room.ensureChunk(chunkOf(Math.floor(to.x)), chunkOf(Math.floor(to.y)));
  p.sim.x = to.x;
  p.sim.y = to.y;
  p.sim.dashT = 0;
  p.queue.length = 0;
  p.toast(down ? 'You climb down into the Undercroft. Mind the dark.' : 'You climb back up into the daylight.');
  room.fx({ kind: 'craft', x: to.x, y: to.y });
}
