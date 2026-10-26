import {
  REALM_IDS,
  REALM_SITE_BY_ID,
  type RaidPlan,
  BASE_PLAYER_HP,
  ITEMS,
  RECIPES,
  chunkOf,
  maxHpForLevel,
  type DevMsg,
} from '@eigenlands/shared';
import { runtime } from '../rooms/runtime';
import type { ServerPlayer } from '../rooms/player';
import type { RoomApi } from './api';
import { giveStacks } from './helpers';
import { acceptQuest } from './quests';
import { QUEST_BY_ID } from '@eigenlands/shared';

/** E2E/test helpers. Does nothing unless the server was started with devCommands. */
export function handleDev(room: RoomApi, p: ServerPlayer, msg: DevMsg): void {
  if (!runtime().config.devCommands || !msg || typeof msg !== 'object') return;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  switch (msg.cmd) {
    case 'tp': {
      const x = num(msg.x),
        y = num(msg.y);
      if (x === null || y === null || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) return;
      p.sim.x = x;
      p.sim.y = y;
      p.queue.length = 0;
      void room.ensureChunk(chunkOf(Math.floor(x)), chunkOf(Math.floor(y)));
      return;
    }
    case 'give': {
      const n = num(msg.n);
      if (!ITEMS[msg.id] || n === null || n < 1 || n > 999) return;
      if (msg.p) {
        for (let i = 0; i < Math.min(n, 30); i++) giveStacks(p, [{ id: msg.id, n: 1, p: msg.p }], false);
        return;
      }
      let left = Math.floor(n);
      const max = ITEMS[msg.id]!.stack;
      while (left > 0) {
        const k = Math.min(max, left);
        if (!giveStacks(p, [{ id: msg.id, n: k }], false)) break;
        left -= k;
      }
      return;
    }
    case 'coins': {
      const n = num(msg.n);
      if (n === null) return;
      p.data.coins = Math.max(0, Math.floor(p.data.coins + n));
      p.dirty('coins');
      return;
    }
    case 'time': {
      const ms = num(msg.offsetMs);
      if (ms === null) return;
      room.wclock.setOffset(room.wclock.offset + ms); // the room tick notices the new day and runs the rollover
      return;
    }
    case 'learn': {
      const ids =
        msg.recipe === '*' ? RECIPES.map((r) => r.id) : RECIPES.some((r) => r.id === msg.recipe) ? [msg.recipe] : [];
      for (const id of ids) p.data.recipes.add(id);
      if (ids.length) p.dirty('recipes');
      return;
    }
    case 'raid': {
      const site = REALM_SITE_BY_ID[String(msg.site)];
      const attacker = REALM_IDS.find((r) => r === msg.attacker);
      const army = (room as unknown as { army?: { startNow(p: RaidPlan): boolean } }).army;
      if (!site || !attacker || attacker === site.realm || !army) return;
      const scale = msg.scale === 3 ? 3 : msg.scale === 2 ? 2 : 1;
      const n = scale === 1 ? 4 : scale === 2 ? 7 : 12;
      army.startNow({
        id: `raid:dev:${Date.now()}`,
        day: 0,
        hour: 0,
        attacker,
        defender: site.realm,
        siteId: site.id,
        scale,
        party: [
          Math.ceil(n * 0.45),
          Math.floor(n * 0.25),
          scale === 1 ? 0 : Math.floor(n * 0.2),
          scale === 3 ? 2 : scale === 2 ? 1 : 0,
        ],
        beast: scale >= 2,
      });
      return;
    }
    case 'friend': {
      const pts = num(msg.pts);
      if (typeof msg.npc !== 'string' || pts === null) return;
      const f = p.data.friends[msg.npc] ?? { pts: 0, talked: -1, gifted: -1 };
      f.pts = Math.max(0, Math.floor(pts));
      p.data.friends[msg.npc] = f;
      p.dirty('friends');
      return;
    }
    case 'quest': {
      if (typeof msg.id !== 'string' || !QUEST_BY_ID[msg.id]) return;
      const log = p.data.quests;
      if (msg.action === 'reset') delete log[msg.id];
      else if (msg.action === 'done')
        log[msg.id] = { state: 'done', progress: QUEST_BY_ID[msg.id]!.objectives.map((o) => o.n) };
      else {
        for (const r of QUEST_BY_ID[msg.id]!.requires ?? [])
          log[r] ??= { state: 'done', progress: QUEST_BY_ID[r]!.objectives.map((o) => o.n) };
        acceptQuest(p, msg.id, room.wclock.day(), room.seed);
      }
      p.dirty('quests');
      return;
    }
    case 'level': {
      const lv = num(msg.level);
      if (lv === null || lv < 1 || lv > 100) return;
      p.level = Math.floor(lv);
      p.xp = 0;
      p.maxHp = maxHpForLevel(p.level, BASE_PLAYER_HP) + p.stats.hpBonus;
      p.hp = p.maxHp;
      return;
    }
  }
}
