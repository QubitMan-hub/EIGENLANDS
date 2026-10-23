import {
  ITEMS, MSG, T, biteDelaySec, rollFish, scoreHits, sanitizeHits, type FishHookMsg, type RhythmDoneMsg, type RhythmPlan,
} from '@eigenlands/shared';
import { tuning } from '../rooms/runtime';
import type { ServerPlayer } from '../rooms/player';
import type { RoomApi } from './api';
import { addSkillXp, distToTile, giveStacks, skillLv } from './helpers';
import { questEvent, recordDeed } from './quests';

const BITE_WINDOW_MS = 1200;
const BITE_GRACE_MS = 300;
const MAX_CAST_RANGE = 6;
const RARE = 0.7;
let seq = 0;

export function fishPlan(room: RoomApi, difficulty: number): RhythmPlan {
  const pace = tuning.pace;
  return {
    startAt: room.wclock.now() + 900 * pace,
    intervalMs: Math.max(120, 700 * pace),
    count: 3,
    windowMs: Math.max(120, Math.round(260 - 140 * difficulty)),
  };
}

/** Rod on a water tile: the line is out; a bite follows after a delay. */
export function startCast(room: RoomApi, p: ServerPlayer, tx: number, ty: number): void {
  const tile = room.store.getTile(tx, ty);
  if (tile !== T.WATER && tile !== T.DEEP_WATER) { p.toast('Cast your rod at open water.'); return; }
  if (distToTile(p, tx, ty) > 5) { p.toast('Too far away.'); return; }
  let deepCount = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (room.store.getTile(tx + dx, ty + dy) === T.DEEP_WATER) deepCount++;
  const deep = tile === T.DEEP_WATER || deepCount > 2;
  const delay = biteDelaySec(room.rand, skillLv(p, 'fishing')) * 1000 * tuning.pace;
  const now = Date.now();
  p.rhythm = null;
  p.cast = { id: `f${++seq}`, tx, ty, deep, ocean: deep && deepCount >= 18 && Math.hypot(tx, ty) > 230, state: 'wait', biteAt: now + delay, deadline: 0 };
  p.client.send(MSG.FISH_CAST, { tx, ty, id: p.cast.id });
  room.fx({ kind: 'cast', x: tx + 0.5, y: ty + 0.5 });
  p.toast('You cast your line…');
}

/** Per-tick bookkeeping: cancel stale casts, ring the bite, drop expired sessions. */
export function tickFishing(room: RoomApi, now: number): void {
  for (const p of room.players.values()) {
    const c = p.cast;
    if (c) {
      if (p.deadT > 0 || distToTile(p, c.tx, c.ty) > MAX_CAST_RANGE) { p.cast = null; p.toast('You reel in.'); continue; }
      if (c.state === 'wait' && now >= c.biteAt) {
        c.state = 'bite';
        c.deadline = now + BITE_WINDOW_MS + BITE_GRACE_MS;
        p.client.send(MSG.FISH_BITE, { id: c.id, windowMs: BITE_WINDOW_MS });
        room.fx({ kind: 'splash', x: c.tx + 0.5, y: c.ty + 0.5 });
      } else if (c.state === 'bite' && now > c.deadline) {
        p.cast = null;
        p.toast('It got away…', 'bad');
      }
    }
    if (p.rhythm && now > p.rhythm.expires) {
      const kind = p.rhythm.kind;
      p.rhythm = null;
      p.toast(kind === 'forge' ? 'The metal cooled. Nothing was lost.' : 'The line went slack.', 'bad');
    }
  }
}

export function handleHook(room: RoomApi, p: ServerPlayer, msg: FishHookMsg): void {
  const c = p.cast;
  if (!c || !msg || msg.id !== c.id) return;
  const now = Date.now();
  if (c.state === 'wait') { p.cast = null; p.toast('Too early! The fish got spooked.', 'bad'); return; }
  if (now > c.deadline) { p.cast = null; return; }
  p.cast = null;
  const level = skillLv(p, 'fishing');
  const fish = rollFish(room.rand, { season: room.wclock.season(), hour: room.wclock.hour(), deep: c.deep, ocean: c.ocean, weather: room.wclock.weather(), level, luck: p.stats.luck });
  const plan = fishPlan(room, Math.max(0, fish.difficulty - level * 0.03));
  p.rhythm = { id: c.id, kind: 'fish', plan, expires: Date.now() + 20_000, fish: { id: fish.id, difficulty: fish.difficulty } };
  p.client.send(MSG.RHYTHM_START, { id: c.id, kind: 'fish', plan, label: c.ocean ? 'A deep-sea catch! Pull with the tugs.' : 'A fish is on the line. Pull with the tugs.' });
}

export function finishFish(room: RoomApi, p: ServerPlayer, msg: RhythmDoneMsg): void {
  const s = p.rhythm!;
  const hits = sanitizeHits(msg.hits, s.plan, s.plan.count * 2 + 2);
  const accuracy = scoreHits(Array.from({ length: s.plan.count }, (_, i) => s.plan.startAt + (i + 1) * s.plan.intervalMs), hits, s.plan.windowMs);
  p.rhythm = null;
  const fishId = s.fish!.id;
  if (accuracy < 0.35) {
    p.client.send(MSG.RHYTHM_RESULT, { id: s.id, kind: 'fish', accuracy, ok: false, text: 'It got away…' });
    return;
  }
  const n = accuracy >= 0.9 ? 2 : 1;
  const item = { id: fishId, n };
  if (!giveStacks(p, [item], false)) {
    p.client.send(MSG.RHYTHM_RESULT, { id: s.id, kind: 'fish', accuracy, ok: false, text: 'Your pack is full, so it swam off.' });
    return;
  }
  addSkillXp(p, 'fishing', Math.round(6 + s.fish!.difficulty * 20));
  if (s.fish!.difficulty >= RARE) room.village.rumor('rare_fish', p.name, ITEMS[fishId]?.name ?? fishId);
  questEvent(p, { type: 'fish', target: fishId, n: 1 });
  recordDeed(p, s.fish!.difficulty >= RARE ? 'rare_fish' : 'fish', (ITEMS[fishId]?.name ?? fishId).toLowerCase(), room.wclock.day());
  room.fx({ kind: 'catch', x: p.sim.x, y: p.sim.y, id: p.id });
  p.client.send(MSG.RHYTHM_RESULT, { id: s.id, kind: 'fish', accuracy, ok: true, text: `You caught ${n > 1 ? 'two ' : 'a '}${ITEMS[fishId]?.name ?? fishId}!`, item });
}
