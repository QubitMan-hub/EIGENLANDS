import {
  MATERIALS, MSG, TEMPLATES, preview, forge, scoreHits, sanitizeHits, beatTimes, qualityName,
  type ForgePreviewMsg, type ForgeStartMsg, type Props, type RhythmDoneMsg, type RhythmPlan, type Stack,
} from '@eigenlands/shared';
import { tuning } from '../rooms/runtime';
import type { ServerPlayer } from '../rooms/player';
import type { RoomApi } from './api';
import { stationNear } from './crafting';
import { cloneInv, validSlot, addSkillXp } from './helpers';
import { addStack, countItem, removeItem } from '@eigenlands/shared';
import { finishFish } from './fishing';

let seq = 0;

export function forgePlan(room: RoomApi): RhythmPlan {
  const pace = tuning.pace;
  return { startAt: room.wclock.now() + 1800 * pace, intervalMs: Math.max(120, 650 * pace), count: 5, windowMs: 200 };
}

export function handleForgePreview(p: ServerPlayer, msg: ForgePreviewMsg): void {
  const ids = msg && Array.isArray(msg.materials) ? msg.materials : [];
  const ok = ids.length >= 2 && ids.length <= 3 && ids.every((i) => typeof i === 'string' && MATERIALS[i]);
  const pv = ok ? preview(ids, 0.5) : null;
  p.client.send(MSG.FORGE_PREVIEW_R, pv ? { ok: true, preview: pv } : { ok: false, error: 'Pick 2 or 3 forgeable materials.' });
}

/** Validate the offer and start the rhythm; nothing is consumed until the hammering is done. */
export function handleForgeStart(room: RoomApi, p: ServerPlayer, msg: ForgeStartMsg): void {
  if (!msg || !TEMPLATES.includes(msg.template) || !Array.isArray(msg.slots) || msg.slots.length < 2 || msg.slots.length > 3) return;
  if (!stationNear(room, p, 'forge', msg.tx, msg.ty)) { p.toast('You need to stand at a forge.', 'bad'); return; }
  const need = new Map<number, number>();
  const ids: string[] = [];
  for (const s of msg.slots) {
    if (!validSlot(s)) return;
    const st = p.data.inv[s];
    if (!st || st.p || !MATERIALS[st.id]) { p.toast("That can't be forged.", 'bad'); return; }
    need.set(s, (need.get(s) ?? 0) + 1);
    ids.push(st.id);
  }
  for (const [s, n] of need) if (p.data.inv[s]!.n < n) { p.toast('Not enough of that material.', 'bad'); return; }
  p.cast = null;
  const plan = forgePlan(room);
  const id = `g${++seq}`;
  p.rhythm = { id, kind: 'forge', plan, expires: Date.now() + 20_000 + 2000 * tuning.pace, template: msg.template, ids };
  p.client.send(MSG.RHYTHM_START, { id, kind: 'forge', plan, label: 'Strike on the beat to tune the metal!' });
}

export function handleRhythmDone(room: RoomApi, p: ServerPlayer, msg: RhythmDoneMsg): void {
  const s = p.rhythm;
  if (!s || !msg || msg.id !== s.id) return;
  // cannot finish before the last beat has happened
  if (room.wclock.now() < s.plan.startAt + s.plan.intervalMs * s.plan.count - 150) { p.toast('Too soon! Wait for the last beat.'); return; }
  if (s.kind === 'fish') { finishFish(room, p, msg); return; }
  finishForge(room, p, msg);
}

function finishForge(room: RoomApi, p: ServerPlayer, msg: RhythmDoneMsg): void {
  const s = p.rhythm!;
  p.rhythm = null;
  const hits = sanitizeHits(msg.hits, s.plan, s.plan.count * 2 + 2);
  const accuracy = scoreHits(beatTimes(s.plan), hits, s.plan.windowMs);
  const ids = s.ids!;
  // the materials must still be in the pack
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of counts) if (countItem(p.data.inv, id) < n) { p.client.send(MSG.RHYTHM_RESULT, { id: s.id, kind: 'forge', accuracy, ok: false, text: 'The materials are gone.' }); return; }
  const res = forge(s.template!, ids, accuracy);
  if (!res) { p.client.send(MSG.RHYTHM_RESULT, { id: s.id, kind: 'forge', accuracy, ok: false, text: 'The metals refuse to bond.' }); return; }
  const sim = cloneInv(p.data.inv);
  for (const [id, n] of counts) removeItem(sim, id, n);
  const item: Stack = { id: res.item.id, n: 1, p: res.item.props as unknown as Props };
  if (addStack(sim, item) > 0) { p.client.send(MSG.RHYTHM_RESULT, { id: s.id, kind: 'forge', accuracy, ok: false, text: 'Your pack is full.' }); return; }
  p.data.inv.splice(0, p.data.inv.length, ...sim);
  p.dirty('inv');
  addSkillXp(p, 'crafting', Math.round(10 + 15 * accuracy));
  if (qualityName(accuracy) === 'Perfect') room.village.rumor('perfect_forge', p.name, s.template!);
  room.fx({ kind: 'craft', x: p.sim.x, y: p.sim.y, id: p.id });
  p.client.send(MSG.RHYTHM_RESULT, { id: s.id, kind: 'forge', accuracy, ok: true, text: `${res.qname} ${s.template}! ${res.note}`, item });
}

