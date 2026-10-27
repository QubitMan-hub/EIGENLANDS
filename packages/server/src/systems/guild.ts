import { rotatingGuildContracts, guildContract, contractDay } from '@eigenlands/shared';
import {
  GUILD_QUESTS,
  guildRank,
  hash2,
  MSG,
  questComplete,
  type PanelMsg,
  type QuestMsg,
  type WorldObj,
} from '@eigenlands/shared';
import type { RoomApi } from './api';
import type { ServerPlayer } from '../rooms/player';
import { acceptQuest, turnInQuest, syncQuests } from './quests';

export function guildPanel(room: RoomApi, p: ServerPlayer, board: WorldObj): PanelMsg {
  syncQuests(p, room.seed);
  return {
    kind: 'guild',
    tx: board.x,
    ty: board.y,
    sub: 'guild_board',
    guild: {
      day: room.wclock.day(),
      hall: typeof board.data?.town === 'string' ? board.data.town : undefined,
      generation: room.store.generation,
      owned: board.owner === p.accountId,
      name: p.name,
      rank: guildRank(p.data.quests),
      card: `WAY-${Math.floor(
        hash2(
          room.seed,
          [...p.accountId].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) | 0, 0),
          917,
        ) * 1e8,
      )
        .toString()
        .padStart(8, '0')}`,
      contracts: [
        ...GUILD_QUESTS,
        ...(guildRank(p.data.quests)
          ? rotatingGuildContracts(room.seed, room.wclock.day(), guildRank(p.data.quests)!)
          : []),
        ...Object.keys(p.data.quests)
          .map((id) => guildContract(room.seed, id))
          .filter(
            (d): d is NonNullable<typeof d> =>
              !!d &&
              !rotatingGuildContracts(room.seed, room.wclock.day(), guildRank(p.data.quests) ?? 'F').some(
                (q) => q.id === d.id,
              ),
          ),
      ].map((d) => {
        const st = p.data.quests[d.id];
        return {
          id: d.id,
          definition: d,
          journey: st?.journey,
          progress: st?.progress ?? d.objectives.map(() => 0),
          state: st
            ? st.state === 'done'
              ? 'done'
              : questComplete(d, st)
                ? 'ready'
                : 'active'
            : (d.requires ?? []).every((id) => p.data.quests[id]?.state === 'done')
              ? 'open'
              : 'locked',
        };
      }),
    },
  };
}
const pending = new WeakSet<ServerPlayer>();
export async function handleGuild(room: RoomApi, p: ServerPlayer, m: QuestMsg): Promise<void> {
  if (!m || !['accept', 'turnin', 'abandon'].includes(m.action)) return;
  if (!Number.isInteger(m.tx) || !Number.isInteger(m.ty) || p.deadT > 0) return;
  const board = room.store.objectAt(m.tx!, m.ty!);
  if (
    !board ||
    !((board.static && board.sub === 'guild_board') || board.sub === 'guild_noticeboard') ||
    Math.hypot(p.sim.x - board.x - 0.5, p.sim.y - board.y - 0.5) > 3.5
  )
    return;
  const d = GUILD_QUESTS.find((q) => q.id === m.quest) ?? guildContract(room.seed, m.quest);
  if (!d) return;
  if (
    m.action === 'accept' &&
    Object.entries(p.data.quests).filter(([id, st]) => id.startsWith('guild:') && st.state === 'active').length >= 3
  ) {
    p.toast('Finish a commission first. Carry up to three guild tasks.');
    return;
  }
  if (guildContract(room.seed, d.id)) {
    if (m.action === 'abandon' && p.data.quests[d.id]?.state === 'active' && !p.data.quests[d.id]?.progress[0]) {
      room.guildClear?.(p, d.id);
      delete p.data.quests[d.id];
      p.dirty('quests');
      p.client.send(MSG.PANEL, guildPanel(room, p, board));
      return;
    }
    if (m.action === 'abandon') return;
    if (contractDay(d.id) < room.wclock.day() - 2 || contractDay(d.id) > room.wclock.day()) return;
    if (m.action === 'accept' && !p.data.quests[d.id]) {
      if (pending.has(p) || !(d.requires ?? []).every((id) => p.data.quests[id]?.state === 'done')) return;
      pending.add(p);
      let journey;
      try {
        journey = await room.guildStart?.(p, d.id, board);
      } finally {
        pending.delete(p);
      }
      if (!journey) {
        p.toast('No safe local route is available from this hall. Try another hall.');
        return;
      }
      if (
        !room.players.has(p.id) ||
        room.store.objectAt(board.x, board.y) !== board ||
        Object.entries(p.data.quests).filter(([id, st]) => id.startsWith('guild:') && st.state === 'active').length >=
          3 ||
        p.deadT > 0 ||
        Math.hypot(p.sim.x - board.x - 0.5, p.sim.y - board.y - 0.5) > 3.5
      )
        return;
      const result = acceptQuest(p, d.id, room.wclock.day(), room.seed);
      if (result.ok) {
        p.data.quests[d.id]!.journey = journey;
        p.dirty('quests');
      }
      p.client.send(MSG.PANEL, guildPanel(room, p, board));
      return;
    }
  }
  if (m.action === 'abandon') return;
  const r =
    m.action === 'accept'
      ? acceptQuest(p, d.id, room.wclock.day(), room.seed)
      : turnInQuest(p, d.id, room.seed, room.wclock.day());
  if (!r.ok) p.toast(r.text, 'bad');
  if (r.ok && d.id === 'guild:rank:F' && m.action === 'accept') turnInQuest(p, d.id, room.seed, room.wclock.day());
  p.client.send(MSG.PANEL, guildPanel(room, p, board));
}
