import {
  ITEMS,
  MAX_UPGRADE,
  EQUIP_SLOTS,
  countItem,
  discLevel,
  durabilityOf,
  enchantBlock,
  gearClassOf,
  isBroken,
  maxDurability,
  recipesMaking,
  removeItem,
  repairCost,
  upgradeCost,
  upgradeNeed,
  type EquipSlotKey,
  type GearMsg,
  type GearRef,
  type Props,
  type Stack,
} from '@eigenlands/shared';
import type { ServerPlayer } from '../rooms/player';
import type { RoomApi } from './api';
import { addDiscXp, learnRecipe, stationNear } from './crafting';
import { isInt, validSlot } from './helpers';

/** The stack a reference points at (worn or in the pack), with a way to put it back. */
function resolve(p: ServerPlayer, ref: GearRef): { stack: Stack; save(): void } | null {
  if (!ref || typeof ref !== 'object') return null;
  if (ref.where === 'equip') {
    if (!EQUIP_SLOTS.includes(ref.slot)) return null;
    const s = p.data.equip[ref.slot as EquipSlotKey];
    return s && typeof s === 'object' ? { stack: s as Stack, save: () => p.dirty('equip', 'stats') } : null;
  }
  if (ref.where === 'inv' && validSlot(ref.slot)) {
    const s = p.data.inv[ref.slot];
    return s ? { stack: s, save: () => p.dirty('inv', 'stats') } : null;
  }
  return null;
}

const hasAll = (p: ServerPlayer, cost: Array<[string, number]>): string | null => {
  for (const [id, n] of cost) if (countItem(p.data.inv, id) < n) return `${n} ${ITEMS[id]?.name ?? id}`;
  return null;
};
const spend = (p: ServerPlayer, cost: Array<[string, number]>): void => {
  for (const [id, n] of cost) removeItem(p.data.inv, id, n);
};

/** Repair, upgrade or enchant a piece at its bench. */
export function handleGear(room: RoomApi, p: ServerPlayer, msg: GearMsg): void {
  if (!msg || !isInt(msg.tx, -1e6, 1e6) || !isInt(msg.ty, -1e6, 1e6)) return;
  const at = resolve(p, msg.ref);
  if (!at) return;
  const { stack } = at;
  const def = ITEMS[stack.id];
  const cls = gearClassOf(stack.id);
  if (!def || !cls) {
    p.toast('That is not gear.', 'bad');
    return;
  }
  const props: Props = { ...(stack.p ?? {}) };

  if (msg.action === 'enchant') {
    if (!stationNear(room, p, 'enchanting', msg.tx, msg.ty)) {
      p.toast('You need an Enchanting Table.', 'bad');
      return;
    }
    if (!validSlot(msg.rune)) return;
    const rune = p.data.inv[msg.rune!];
    if (!rune || ITEMS[rune.id]?.use?.t !== 'rune') {
      p.toast('Pick a rune from your pack.', 'bad');
      return;
    }
    const key = (ITEMS[rune.id]!.use as { t: 'rune'; key: string }).key;
    const why = enchantBlock(stack.id, key);
    if (why) {
      p.toast(why, 'bad');
      return;
    }
    if (discLevel(p.data.disc.enchanting) < 1 + (def.rarity ?? 0) * 2) {
      p.toast(`Needs enchanting level ${1 + (def.rarity ?? 0) * 2} for this rarity.`, 'bad');
      return;
    }
    props.ench = key;
    stack.p = props;
    removeItem(p.data.inv, rune.id, 1);
    p.dirty('inv', 'equip', 'stats');
    addDiscXp(p, 'enchanting', 30 + (def.rarity ?? 0) * 12);
    p.toast(`${def.name} is bound with the rune of ${key}.`, 'good');
    room.fx({ kind: 'craft', x: p.sim.x, y: p.sim.y, id: p.id });
    return;
  }

  const rec = recipesMaking(stack.id)[0];
  if (!rec) {
    p.toast('That cannot be mended or improved here.', 'bad');
    return;
  }
  if (!stationNear(room, p, rec.station, msg.tx, msg.ty)) {
    p.toast('You need to be at the right station.', 'bad');
    return;
  }

  if (msg.action === 'repair') {
    const du = durabilityOf(props);
    if (!du || du.dur >= du.max) {
      p.toast('It is not damaged.');
      return;
    }
    const cost = repairCost(stack.id, props);
    const miss = hasAll(p, cost);
    if (miss) {
      p.toast(`You need ${miss}.`, 'bad');
      return;
    }
    spend(p, cost);
    props.dur = du.max;
    stack.p = props;
    p.dirty('inv', 'equip', 'stats');
    addDiscXp(p, rec.disc, Math.round(rec.xp * 0.4));
    p.toast(`${def.name} is as good as new.`, 'good');
    room.fx({ kind: 'craft', x: p.sim.x, y: p.sim.y, id: p.id });
    return;
  }

  // upgrade
  if ((props.up ?? 0) >= MAX_UPGRADE) {
    p.toast('It cannot be improved further.');
    return;
  }
  const need = upgradeNeed(stack.id, props)!;
  if (discLevel(p.data.disc[need.disc]) < need.lvl) {
    p.toast(`Needs ${need.disc} level ${need.lvl} to improve this.`, 'bad');
    return;
  }
  const cost = upgradeCost(stack.id, props);
  const miss = hasAll(p, cost);
  if (miss) {
    p.toast(`You need ${miss}.`, 'bad');
    return;
  }
  spend(p, cost);
  props.up = (props.up ?? 0) + 1;
  props.maxDur = maxDurability(stack.id, props);
  props.dur = props.maxDur;
  stack.p = props;
  p.dirty('inv', 'equip', 'stats');
  addDiscXp(p, rec.disc, Math.round(rec.xp * 0.8));
  p.toast(`${def.name} +${props.up}`, 'good');
  room.fx({ kind: 'craft', x: p.sim.x, y: p.sim.y, id: p.id });
}

// ───────────────────────── wear ─────────────────────────

const ARMOR_SLOTS: EquipSlotKey[] = ['head', 'chest', 'legs', 'feet', 'shield', 'back', 'belt'];

function wear(p: ServerPlayer, slot: EquipSlotKey, by = 1): void {
  const s = p.data.equip[slot] as Stack | null | undefined;
  if (!s?.p || s.p.maxDur === undefined) return;
  const max = s.p.maxDur;
  const before = s.p.dur ?? max;
  if (before <= 0) return;
  const next = Math.max(0, before - by);
  s.p = { ...s.p, dur: next };
  if (next <= 0) {
    p.toast(`Your ${ITEMS[s.id]?.name ?? 'gear'} broke! Repair it at its bench.`, 'bad');
    p.dirty('equip', 'stats');
  } else if (next === Math.ceil(max * 0.2) && before > next) {
    p.toast(`${ITEMS[s.id]?.name ?? 'Gear'} is badly worn.`, 'info');
    p.dirty('equip');
  } else if (next % 5 === 0) p.dirty('equip');
}
/** A hit landed on the player: some worn piece takes the knock. */
export function wearOnHit(p: ServerPlayer, rand: () => number): void {
  const worn = ARMOR_SLOTS.filter((k) => {
    const s = p.data.equip[k] as Stack | null | undefined;
    return s?.p?.maxDur !== undefined && !isBroken(s.p);
  });
  if (worn.length) wear(p, worn[Math.floor(rand() * worn.length)]!);
}
/** The player's weapon struck something. */
export function wearWeapon(p: ServerPlayer): void {
  wear(p, 'weapon');
}
/** A minute of carrying a lit lantern. */
export function wearLight(p: ServerPlayer): void {
  wear(p, 'light');
}

// ───────────────────────── using items ─────────────────────────

/** Items with a special use: recipe scrolls, repair kits, lamp oil, whetstones. Returns true when it handled the item. */
export function useCatalogItem(room: RoomApi, p: ServerPlayer, slot: number): boolean {
  const stack = p.data.inv[slot];
  const use = stack ? ITEMS[stack.id]?.use : undefined;
  if (!stack || !use) return false;
  const consume = (): void => {
    stack.n -= 1;
    if (stack.n <= 0) p.data.inv[slot] = null;
    p.dirty('inv');
  };
  switch (use.t) {
    case 'recipe': {
      if (!learnRecipe(p, use.id)) {
        p.toast('You already know that.', 'info');
        return true;
      }
      consume();
      p.toast(
        `You learn to make ${ITEMS[recipesMaking(use.id)[0]?.out.id ?? use.id]?.name ?? 'something new'}.`,
        'good',
      );
      room.fx({ kind: 'levelup', x: p.sim.x, y: p.sim.y, v: 0, id: p.id });
      return true;
    }
    case 'whetstone': {
      p.data.buffs.fury = { until: room.wclock.now() + use.secs * 1000, power: use.atk };
      p.dirty('buffs');
      consume();
      p.toast(`Your blade is honed: +${use.atk} attack.`, 'good');
      return true;
    }
    case 'repair': {
      // mend the most damaged worn or packed piece of a kind this item serves
      let best: { stack: Stack; frac: number } | null = null;
      const consider = (s: Stack | null | undefined): void => {
        if (!s) return;
        const du = durabilityOf(s.p);
        const cls = gearClassOf(s.id);
        const light = ITEMS[s.id]?.gear?.slot === 'light';
        if (!du || du.dur >= du.max || !cls) return;
        const ok = light
          ? use.kinds.includes('light')
          : use.kinds.includes(cls) || (cls === 'gear' && use.kinds.includes('gear'));
        if (!ok) return;
        const frac = du.dur / du.max;
        if (!best || frac < best.frac) best = { stack: s, frac };
      };
      for (const k of EQUIP_SLOTS) consider(p.data.equip[k] as Stack | null | undefined);
      for (const s of p.data.inv) consider(s);
      const hit = best as { stack: Stack; frac: number } | null;
      if (!hit) {
        p.toast('Nothing needs mending.', 'info');
        return true;
      }
      const du = durabilityOf(hit.stack.p)!;
      hit.stack.p = { ...hit.stack.p, dur: Math.min(du.max, du.dur + Math.round((du.max * use.pct) / 100)) };
      consume();
      p.dirty('inv', 'equip', 'stats');
      p.toast(`${ITEMS[hit.stack.id]?.name ?? 'Gear'} mended.`, 'good');
      return true;
    }
    default:
      return false;
  }
}
