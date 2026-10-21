import {
  ITEMS, addStack, cloneStack, moveSlot, type EquipMsg, type InvMoveMsg, type InvTrashMsg,
} from '@eigenlands/shared';
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

/** Rings go into one of two slots (the old ring returns to the pack); outfits set the look. */
export function handleEquip(p: ServerPlayer, msg: EquipMsg): void {
  if (!msg) return;
  const eq = p.data.equip;
  if (msg.as === 'unequip_ring1' || msg.as === 'unequip_ring2') {
    const key = msg.as === 'unequip_ring1' ? 'ring1' : 'ring2';
    const r = eq[key];
    if (!r) return;
    if (addStack(p.data.inv, cloneStack(r)) > 0) { p.toast('Your pack is full.', 'bad'); return; }
    eq[key] = null;
    p.dirty('inv', 'equip');
    return;
  }
  if (msg.as !== 'ring1' && msg.as !== 'ring2' && msg.as !== 'outfit') return;
  if (!validSlot(msg.slot)) return;
  const s = p.data.inv[msg.slot];
  if (!s) return;
  const def = ITEMS[s.id];
  if (msg.as === 'outfit') {
    if (def?.kind !== 'outfit' || def.outfit === undefined) return;
    eq.outfit = def.outfit;
    p.state.look = def.outfit;
    p.dirty('equip');
    return;
  }
  if (def?.kind !== 'ring') return;
  const old = eq[msg.as];
  eq[msg.as] = { id: s.id, n: 1, ...(s.p ? { p: s.p } : {}) };
  p.data.inv[msg.slot] = old; // swap: the previous ring lands in the freed slot
  p.dirty('inv', 'equip');
}

