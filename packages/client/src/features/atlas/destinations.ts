import { NPC_BY_ID, questComplete, questDef, townsFor, type PartyStateMsg, type QuestLog } from '@eigenlands/shared';

export interface MapPoint {
  x: number;
  y: number;
}
export interface Destination {
  id: string;
  questId?: string;
  title: string;
  detail: string;
  point?: MapPoint;
}
const validPoint = (p: MapPoint): boolean =>
  Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) < 1e6 && Math.abs(p.y) < 1e6;

/** Discovery-gated directory; explicit tracking may use described homes. Homes never predict a live NPC position. */
export function questDestinations(
  seed: number,
  log: QuestLog,
  count: (item: string) => number,
  npcs: ReadonlyMap<string, MapPoint>,
  seen: (x: number, y: number) => boolean,
  knownHomes = false,
): Destination[] {
  const towns = townsFor(seed);
  const npc = (id: string): Pick<Destination, 'point' | 'detail'> => {
    const live = npcs.get(id);
    if (live && validPoint(live) && seen(live.x, live.y)) return { point: live, detail: 'Current villager position' };
    const home = NPC_BY_ID[id]?.home;
    const p = home ? towns.map((t) => t.spots[home]).find(Boolean) : undefined;
    return p && (knownHomes || seen(p.x, p.y))
      ? { point: p, detail: 'Known home · villager may be elsewhere' }
      : { detail: 'Location uncharted · consult the Journal' };
  };
  const result: Destination[] = [];
  for (const [id, state] of Object.entries(log)) {
    if (state.state !== 'active') continue;
    const q = questDef(id, seed);
    if (!q) continue;
    const progress = q.objectives.map((o, i) => (o.type === 'deliver' ? count(o.target) : (state.progress[i] ?? 0)));
    if (questComplete(q, { state: 'active', progress })) {
      result.push({
        id: `${id}:return`,
        questId: id,
        title: `${q.title} · Return to ${NPC_BY_ID[q.giver]?.name ?? q.giver}`,
        ...npc(q.giver),
      });
      continue;
    }
    q.objectives.forEach((o, i) => {
      if (progress[i]! >= o.n) return;
      let location: Pick<Destination, 'point' | 'detail'> = { detail: 'No fixed destination · consult the Journal' };
      if (o.type === 'talk' || o.type === 'gift') location = npc(o.target);
      if (o.type === 'read') {
        const p = towns.flatMap((t) => t.objects).find((p) => p.sub === o.target && (knownHomes || seen(p.x, p.y)));
        location = p
          ? { point: p, detail: seen(p.x, p.y) ? 'Discovered landmark' : 'Quest-described landmark' }
          : { detail: 'Landmark uncharted · consult the Journal' };
      }
      result.push({
        id: `${id}:${i}`,
        questId: id,
        title: `${q.title} · ${o.type === 'talk' || o.type === 'gift' ? (NPC_BY_ID[o.target]?.name ?? 'Villager') : o.type === 'read' ? 'Landmark' : 'Continue in Journal'}`,
        ...location,
      });
    });
  }
  return result;
}

/** Party messages already authorize these positions, including other shards. Never derive strangers' positions. */
export function partyDestinations(party: PartyStateMsg | null, account: string, session: string): Destination[] {
  if (!party?.id) return [];
  return (party.members ?? [])
    .filter((m) => m.accountId !== account && (!session || m.sid !== session))
    .map((m) => ({
      id: m.accountId,
      title: m.name,
      detail: !m.online
        ? 'Offline · position unavailable'
        : !m.shard || !validPoint(m)
          ? 'Position unavailable'
          : 'Last reported party position',
      point: m.online && !!m.shard && validPoint(m) ? { x: m.x, y: m.y } : undefined,
    }));
}
