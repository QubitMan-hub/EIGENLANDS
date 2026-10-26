import { recordCiv } from '../features/civ/registry';
import { handleGuild } from './guild';
/**
 * Quests: story quests from villagers and the daily request board. Objective progress comes from real events reported by
 * every system (`questEvent`), deliveries track the pack, rewards are atomic. See shared/src/quests.ts for the data.
 */
import { gainRep } from './reputation';
import {
  type RealmId,
  ENEMY_DEFS,
  ITEMS,
  MSG,
  NPC_BY_ID,
  POINTS_PER_HEART,
  RECIPES,
  addStack,
  applyQuestEvent,
  countItem,
  dailyRequests,
  dayNumber,
  isRequestId,
  objectiveText,
  pruneRequests,
  questComplete,
  questDef,
  removeItem,
  requestDay,
  startQuest,
  syncDeliveries,
  townFor,
  type BoardRequest,
  type DeedKind,
  type PanelMsg,
  type QuestDef,
  type QuestEvent,
  type QuestMsg,
  type Stack,
} from '@eigenlands/shared';
import type { ServerPlayer } from '../rooms/player';
import type { RoomApi } from './api';
import { fitsAll } from './helpers';
import type { PlayerRef } from './types';

let SEED = 0;
/** The world seed (request-board jobs are generated from it). Set once by the world room. */
export const setQuestSeed = (s: number): void => {
  SEED = s;
};
export const questSeed = (): number => SEED;

const d0 = (): number => dayNumber(Date.now());
const giverName = (id: string) =>
  id === 'guild' ? 'any Adventurer Guild board' : (NPC_BY_ID[id]?.name.split(' ')[0] ?? 'the villager');

/** Something quest-relevant happened. Updates progress, tells the player about finished objectives/quests. */
export function questEvent(p: PlayerRef, ev: QuestEvent, seed = SEED): void {
  const log = p.data.quests;
  if (!log || !Object.keys(log).length) return;
  const before = snapshot(p, seed);
  const changed = applyQuestEvent(log, ev, seed);
  if (!changed.length) return;
  p.dirty('quests');
  announce(p, before, changed, seed);
}

/** Recompute delivery objectives from the pack (call after the inventory changed). */
export function syncQuests(p: PlayerRef, seed = SEED): void {
  const log = p.data.quests;
  if (!log || !Object.keys(log).length) return;
  const before = snapshot(p, seed);
  const changed = syncDeliveries(log, (id) => countItem(p.data.inv, id), seed);
  if (!changed.length) return;
  p.dirty('quests');
  announce(p, before, changed, seed);
}

function snapshot(p: PlayerRef, seed: number): Map<string, boolean[]> {
  const m = new Map<string, boolean[]>();
  for (const [id, st] of Object.entries(p.data.quests)) {
    if (st.state !== 'active') continue;
    const d = questDef(id, seed);
    if (d)
      m.set(
        id,
        d.objectives.map((o, i) => (st.progress[i] ?? 0) >= o.n),
      );
  }
  return m;
}

function announce(p: PlayerRef, before: Map<string, boolean[]>, changed: string[], seed: number): void {
  for (const id of changed) {
    const d = questDef(id, seed);
    const st = p.data.quests[id];
    if (!d || !st) continue;
    const was = before.get(id) ?? [];
    if (questComplete(d, st)) {
      if (!was.every(Boolean))
        p.toast(
          `Quest ready: ${d.title}. Return to ${d.daily ? 'the request board or ' : ''}${giverName(d.giver)}.`,
          'good',
        );
      continue;
    }
    d.objectives.forEach((o, i) => {
      if (!was[i] && (st.progress[i] ?? 0) >= o.n) p.toast(`✓ ${o.label}`, 'good');
    });
  }
}

/** Remember a deed for a few days so villagers can mention it. */
export function recordDeed(p: PlayerRef, kind: DeedKind, what: string, day: number): void {
  p.data.deeds[kind] = { day, what };
}

/** Kill credit (called by the world room). */
export function onKill(p: PlayerRef, def: unknown, day: number): void {
  const key = Object.entries(ENEMY_DEFS).find(([, d]) => d === def)?.[0];
  if (!key) return;
  questEvent(p, { type: 'kill', target: key, n: 1 });
  recordDeed(p, 'kill', (def as { name?: string }).name ?? key, day);
}

// ───────────────────────── accept / turn in ─────────────────────────

export function acceptQuest(
  p: PlayerRef,
  id: string,
  today: number,
  seed = SEED,
): { ok: boolean; text: string; def?: QuestDef } {
  const d = questDef(id, seed);
  if (!d) return { ok: false, text: 'There is no such task.' };
  const log = p.data.quests;
  if (log[id])
    return { ok: false, text: log[id]!.state === 'done' ? 'You already did that.' : 'You are already on it.', def: d };
  if (d.daily) {
    if (d.daily.day !== today) return { ok: false, text: 'That request has been taken down.', def: d };
    const active = Object.entries(log).filter(([k, s]) => isRequestId(k) && s.state === 'active').length;
    if (active >= 3) return { ok: false, text: 'You can only carry three board requests at a time.', def: d };
  } else if (!(d.requires ?? []).every((r) => log[r]?.state === 'done')) return { ok: false, text: 'Not yet.', def: d };
  startQuest(log, id, seed);
  syncDeliveries(log, (x) => countItem(p.data.inv, x), seed);
  p.dirty('quests');
  p.toast(`New quest: ${d.title}`, 'good');
  return { ok: true, text: d.title, def: d };
}

export function turnInQuest(
  p: PlayerRef,
  id: string,
  seed = SEED,
  today = d0(),
): { ok: boolean; text: string; def?: QuestDef } {
  const d = questDef(id, seed);
  const st = p.data.quests[id];
  if (!d || !st) return { ok: false, text: 'You are not on that task.' };
  if (st.state === 'done') return { ok: false, text: 'Already done. Thank you!', def: d };
  syncDeliveries(p.data.quests, (x) => countItem(p.data.inv, x), seed);
  if (!questComplete(d, st)) {
    const left = d.objectives
      .map((o, i) => ((st.progress[i] ?? 0) < o.n ? objectiveText(o, st.progress[i] ?? 0) : null))
      .filter(Boolean);
    return { ok: false, text: `Not finished yet: ${left.join('; ')}.`, def: d };
  }
  // simulate: hand over deliveries, then add rewards; refuse atomically if the rewards do not fit
  const inv = p.data.inv.map((s) => (s ? { ...s, ...(s.p ? { p: { ...s.p } } : {}) } : null));
  for (const o of d.objectives)
    if (o.type === 'deliver' && !removeItem(inv, o.target, o.n))
      return { ok: false, text: 'Something is missing from your pack.', def: d };
  const items: Stack[] = d.rewards.items ?? [];
  if (!fitsAll(inv, items)) return { ok: false, text: 'Make some room in your pack first.', def: d };
  for (const s of items) addStack(inv, s);
  p.data.inv.splice(0, p.data.inv.length, ...inv);
  p.data.coins += d.rewards.coins;
  st.state = 'done';
  st.progress = d.objectives.map((o) => o.n);
  if (d.rewards.friend) {
    const f = (p.data.friends[d.giver] ??= { pts: 0, talked: -1, gifted: -1 });
    f.pts = Math.min(POINTS_PER_HEART * 10, f.pts + d.rewards.friend);
  }
  const learned =
    d.rewards.recipe && RECIPES.some((r) => r.id === d.rewards.recipe) && !p.data.recipes.has(d.rewards.recipe)
      ? d.rewards.recipe
      : null;
  if (learned) p.data.recipes.add(learned);
  if (d.realm && d.rewards.rep) gainRep(p, d.realm as RealmId, d.rewards.rep);
  if (d.realm) recordCiv(seed, d.realm as RealmId, 'questsDone');
  p.dirty('quests', 'inv', 'coins', 'friends', ...(learned ? ['recipes' as const] : []));
  const rewardText = [
    `${d.rewards.coins} coins`,
    ...items.map((s) => `${s.n} ${ITEMS[s.id]?.name ?? s.id}`),
    ...(learned ? [`recipe: ${ITEMS[RECIPES.find((r) => r.id === learned)!.out.id]?.name}`] : []),
  ].join(', ');
  p.toast(`Quest complete: ${d.title}! (${rewardText})`, 'good');
  recordDeed(p, 'quest', d.daily ? `filled ${giverName(d.giver)}'s request` : `finished "${d.title}"`, today);
  return { ok: true, text: rewardText, def: d };
}

// ───────────────────────── request board ─────────────────────────

export function boardPos(seed = SEED): { x: number; y: number } | null {
  const b = townFor(seed).objects.find((o) => o.sub === 'board');
  return b ? { x: b.x, y: b.y } : null;
}

export function boardPanel(p: PlayerRef, today: number, seed = SEED, at = boardPos(seed)): PanelMsg {
  syncDeliveries(p.data.quests, (x) => countItem(p.data.inv, x), seed);
  const reqs: BoardRequest[] = [];
  const view = (d: QuestDef): BoardRequest => {
    const st = p.data.quests[d.id];
    const day = d.daily!.day;
    let state: BoardRequest['state'] = 'open';
    if (st) state = st.state === 'done' ? 'done' : questComplete(d, st) ? 'ready' : 'active';
    else if (day !== today) state = 'expired';
    return {
      id: d.id,
      giver: d.giver,
      title: d.title,
      summary: d.summary,
      objectives: d.objectives,
      progress: st?.progress ?? d.objectives.map(() => 0),
      coins: d.rewards.coins,
      state,
      day,
    };
  };
  for (const d of dailyRequests(seed, today)) reqs.push(view(d));
  // jobs taken yesterday are still on the player's list until the end of today
  for (const id of Object.keys(p.data.quests)) {
    if (!isRequestId(id) || requestDay(id) === today) continue;
    const d = questDef(id, seed);
    if (d && p.data.quests[id]!.state === 'active') reqs.push(view(d));
  }
  const town = townFor(seed);
  const notice = String(town.objects.find((o) => o.sub === 'board')?.data?.text ?? '');
  return {
    kind: 'board',
    tx: at?.x ?? 0,
    ty: at?.y ?? 0,
    sub: 'board',
    sign: notice,
    board: { day: today, requests: reqs },
  };
}

/** QUEST message: at the board (npcId 'board') or with a villager (handled by the village for dialogue). */
export function handleQuestMsg(room: RoomApi, p: ServerPlayer, m: QuestMsg): void {
  if (
    !m ||
    typeof m.quest !== 'string' ||
    (m.action !== 'accept' && m.action !== 'turnin') ||
    typeof m.npcId !== 'string'
  )
    return;
  if (m.npcId === 'guild') {
    handleGuild(room, p, m);
    return;
  }
  if (m.npcId === 'board') {
    const b = boardPos(room.seed);
    if (!b || Math.hypot(b.x + 0.5 - p.sim.x, b.y + 0.5 - p.sim.y) > 4) {
      p.toast('Too far from the request board.');
      return;
    }
    if (!isRequestId(m.quest)) return;
    const today = room.wclock.day();
    const r =
      m.action === 'accept' ? acceptQuest(p, m.quest, today, room.seed) : turnInQuest(p, m.quest, room.seed, today);
    if (!r.ok) p.toast(r.text, 'bad');
    p.client.send(MSG.PANEL, boardPanel(p, today, room.seed, b));
    return;
  }
  const n = room.village.npc(m.npcId);
  if (!n || Math.hypot(n.x - p.sim.x, n.y - p.sim.y) > 7) return;
  const d = room.village.quest?.(p, m);
  if (d) p.client.send(MSG.DIALOGUE, d);
}

/** Day rollover / login: drop request-board jobs whose time ran out. */
export function expireRequests(p: PlayerRef, today: number): void {
  const active = Object.entries(p.data.quests)
    .filter(([id, s]) => isRequestId(id) && s.state === 'active')
    .map(([id]) => id);
  const gone = pruneRequests(p.data.quests, today);
  if (!gone.length) return;
  p.dirty('quests');
  if (gone.some((id) => active.includes(id))) p.toast('A request-board job expired.', 'info');
}

/** Wire the QUEST message into the room (rate-limited like other social messages). */
export function registerQuests(
  room: RoomApi,
  on: <M>(type: string, bucket: 'socialBucket', fn: (p: ServerPlayer, msg: M) => void) => void,
): void {
  setQuestSeed(room.seed);
  on<QuestMsg>(MSG.QUEST, 'socialBucket', (p, m) => handleQuestMsg(room, p, m));
}

export const todayOf = (nowMs: number): number => dayNumber(nowMs);
