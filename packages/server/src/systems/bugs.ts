import { T, sampleClimate, type Stack } from '@eigenlands/shared';
import type { ServerPlayer } from '../rooms/player';
import type { RoomApi } from './api';
import { addSkillXp, giveStacks } from './helpers';
import { questEvent, recordDeed } from './quests';

interface BugRule {
  id: string;
  seasons: number[];
  time: 'day' | 'night' | 'any';
  needsWater?: boolean;
  flux?: boolean;
}
const BUGS: BugRule[] = [
  { id: 'butterfly', seasons: [0, 1], time: 'day' },
  { id: 'ladybug', seasons: [0, 1, 2], time: 'day' },
  { id: 'beetle', seasons: [1, 2], time: 'any' },
  { id: 'dragonfly', seasons: [1], time: 'day', needsWater: true },
  { id: 'cricket', seasons: [1, 2], time: 'night' },
  { id: 'firefly', seasons: [1], time: 'night', flux: true },
];

function waterNear(room: RoomApi, x: number, y: number): boolean {
  for (let dy = -10; dy <= 10; dy += 2)
    for (let dx = -10; dx <= 10; dx += 2) {
      const t = room.store.getTile(x + dx, y + dy);
      if (t === T.WATER || t === T.DEEP_WATER) return true;
    }
  return false;
}

/** Net on flowers or tall grass: one roll per tile per day. */
export function catchBug(room: RoomApi, p: ServerPlayer, tx: number, ty: number, tile: number): void {
  if (tile !== T.FLOWERS && tile !== T.GRASS_TALL) {
    p.toast('Sweep your net over flowers or tall grass.');
    return;
  }
  const day = room.wclock.day();
  const key = `${tx},${ty},${day}`;
  if (room.bugCooldown.has(key)) {
    p.toast('The bugs here have scattered. Try again tomorrow.');
    return;
  }
  if (room.bugCooldown.size > 4000) room.bugCooldown.clear();
  room.bugCooldown.add(key);

  const hour = room.wclock.hour(),
    season = room.wclock.season();
  const night = hour >= 20 || hour < 5,
    daytime = hour >= 6 && hour < 18;
  const pool: BugRule[] = [];
  for (const b of BUGS) {
    if (!b.seasons.includes(season)) continue;
    if (b.time === 'day' && !daytime) continue;
    if (b.time === 'night' && !night) continue;
    if (b.needsWater && !waterNear(room, tx, ty)) continue;
    pool.push(b);
    if (b.flux && sampleClimate(room.seed, tx, ty).flux > 0.4) pool.push(b);
  }
  room.fx({ kind: 'dust', x: tx + 0.5, y: ty + 0.5, id: p.id, weapon: 'net' });
  if (!pool.length) {
    p.toast("Nothing's flying around right now.");
    return;
  }
  if (room.rand() >= 0.35 + p.stats.haste) {
    p.toast('The net comes up empty.');
    return;
  }
  const bug = pool[Math.floor(room.rand() * pool.length)]!;
  const item: Stack = { id: bug.id, n: 1 };
  if (!giveStacks(p, [item])) {
    p.toast('Your pack is full.', 'bad');
    return;
  }
  addSkillXp(p, 'foraging', 3);
  questEvent(p, { type: 'bug', target: bug.id, n: 1 });
  recordDeed(p, 'bug', bug.id, day);
}
