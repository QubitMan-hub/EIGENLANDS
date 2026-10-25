import {
  EQUIP_SLOTS,
  ITEMS,
  equipmentLevel,
  addStack,
  armorTotals,
  cloneStack,
  moveSlot,
  type EquipMsg,
  type EquipSlotKey,
  type InvMoveMsg,
  type InvTrashMsg,
} from '@eigenlands/shared';
import { fitsSlot } from './profile';
import type { ServerPlayer } from '../rooms/player';
import { isInt, validSlot } from './helpers';

export function handleInvMove(p: ServerPlayer, msg: InvMoveMsg): void {
  if (!msg || !validSlot(msg.from) || !validSlot(msg.to)) return;
  if (moveSlot(p.data.inv, msg.from, msg.to)) p.dirty('inv');
}

export function handleInvTrash(p: ServerPlayer, msg: InvTrashMsg): void {
  if (!msg || !validSlot(msg.slot) || !isInt(msg.n, 1, 99)) return;
  const s = p.data.inv[msg.slot];
  if (!s) return;
  s.n -= Math.min(msg.n, s.n);
  if (s.n <= 0) p.data.inv[msg.slot] = null;
  p.dirty('inv');
}

/** The look a character shows: a worn armour set (3+ pieces) or the chosen outfit. */
export function lookOf(p: ServerPlayer): number {
  const e = p.data.equip;
  const a = armorTotals({
    head: e.head?.id ?? null,
    chest: e.chest?.id ?? null,
    legs: e.legs?.id ?? null,
    feet: e.feet?.id ?? null,
  });
  return a.look !== null ? 8 + a.look : e.outfit;
}

/** Rings, armour and the main-hand Focus swap with the pack; outfits set the cosmetic look. */
export function handleEquip(p: ServerPlayer, msg: EquipMsg): void {
  if (!msg || typeof msg.as !== 'string') return;
  const eq = p.data.equip;
  if (msg.as.startsWith('unequip_')) {
    const key = msg.as.slice(8) as EquipSlotKey;
    if (!EQUIP_SLOTS.includes(key)) return;
    const r = eq[key];
    if (!r) return;
    if (addStack(p.data.inv, cloneStack(r)) > 0) {
      p.toast('Your pack is full.', 'bad');
      return;
    }
    eq[key] = null;
    p.state.look = lookOf(p);
    p.dirty('inv', 'equip', 'stats');
    return;
  }
  if (!validSlot(msg.slot)) return;
  const s = p.data.inv[msg.slot];
  if (!s) return;
  const def = ITEMS[s.id];
  if (msg.as === 'outfit') {
    if (def?.kind !== 'outfit' || def.outfit === undefined) return;
    eq.outfit = def.outfit;
    p.state.look = lookOf(p);
    p.dirty('equip');
    return;
  }
  const slot = msg.as as EquipSlotKey;
  if (!EQUIP_SLOTS.includes(slot) || !fitsSlot(slot, s)) return;
  const need = equipmentLevel(s.id);
  if (p.level < need) {
    p.toast(`${def?.name ?? 'That'} needs level ${need}.`, 'bad');
    return;
  }
  const old = eq[slot];
  eq[slot] = { id: s.id, n: 1, ...(s.p ? { p: s.p } : {}) };
  p.data.inv[msg.slot] = old; // swap: the previous piece lands in the freed slot
  p.state.look = lookOf(p);
  p.dirty('inv', 'equip', 'stats');
}
