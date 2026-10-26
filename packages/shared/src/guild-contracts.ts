import { hash2 } from './rng';
import type { QuestDef } from './quests';
import { GUILD_RANKS, type GuildRank } from './guild';
export type GuildMissionKind = 'escort' | 'rescue' | 'investigate' | 'diplomacy';
export interface GuildJourney {
  kind: GuildMissionKind;
  home: { x: number; y: number };
  points: Array<{ x: number; y: number }>;
  stage: number;
  x: number;
  y: number;
  hp: number;
  released: boolean;
  failed: boolean;
  choice?: string;
}
const TYPES: GuildMissionKind[] = ['escort', 'rescue', 'investigate', 'diplomacy'];
const TITLES = {
  escort: ['A Scholar on the Road', 'The Last Caravan'],
  rescue: ['A Light in the Ravine', 'The Missing Surveyor'],
  investigate: ['The Forged Seal', 'Bootprints at Dawn'],
  diplomacy: ['Bread Before Blades', 'An Accord of Small Things'],
};
export function guildContract(seed: number, id: string): QuestDef | undefined {
  const m = /^guild:job:(0|[1-9]\d{0,7}):([0-3]):(F|E|D|C|B|A|S|SS|SSS)$/.exec(id);
  if (!m) return;
  const day = Number(m[1]),
    slot = Number(m[2]),
    rank = m[3] as GuildRank,
    kind = TYPES[slot]!;
  return {
    id,
    giver: 'guild',
    title: TITLES[kind][Math.floor(hash2(seed, day, slot, 971) * 2)]!,
    summary:
      kind === 'escort'
        ? 'Guide a real traveller along a surveyed route. Stay close, keep danger away, and bring them safely to the final rendezvous.'
        : kind === 'rescue'
          ? 'Find the missing traveller, secure their camp, and guide them back to this hall.'
          : kind === 'investigate'
            ? 'Inspect three physical clues, compare their evidence, and identify the forged seal. Your final choice decides how justice is served.'
            : 'Carry an overture to an envoy. A generous offer, a paid compromise, or intimidation produces different kingdom standing.',
    objectives: [
      {
        type: 'discover',
        target: id,
        n: 1,
        label:
          kind === 'investigate'
            ? 'Resolve the evidence'
            : kind === 'diplomacy'
              ? 'Conclude the negotiation'
              : 'Bring the traveller safely home',
      },
    ],
    requires: [`guild:rank:${rank}`],
    rewards: { coins: 60 + GUILD_RANKS.indexOf(rank) * 35 },
    where: 'Accept at a guild board, then follow the marked journey',
    lines: {
      offer: 'A local commission. The hall verifies what actually happens on the road.',
      progress: 'Open your guild ledger for the current rendezvous and evidence.',
      done: 'The journey is entered into the guild record.',
    },
  };
}
export const rotatingGuildContracts = (seed: number, day: number, rank: GuildRank): QuestDef[] =>
  TYPES.map((_, slot) => guildContract(seed, `guild:job:${day}:${slot}:${rank}`)!);
export const contractKind = (id: string): GuildMissionKind | undefined =>
  TYPES[Number(/^guild:job:\d+:([0-3]):/.exec(id)?.[1] ?? -1)];
export const contractDay = (id: string): number => Number(/^guild:job:(\d+):/.exec(id)?.[1] ?? -1);
export function validGuildJourney(raw: unknown): GuildJourney | undefined {
  if (!raw || typeof raw !== 'object') return;
  const r = raw as GuildJourney;
  const point = (p: unknown): p is { x: number; y: number } =>
    !!p &&
    typeof p === 'object' &&
    ['x', 'y'].every(
      (k) => typeof (p as any)[k] === 'number' && Number.isFinite((p as any)[k]) && Math.abs((p as any)[k]) < 1e6,
    );
  if (
    !TYPES.includes(r.kind) ||
    !point(r.home) ||
    !Array.isArray(r.points) ||
    r.points.length !== 3 ||
    !r.points.every(point) ||
    !point(r) ||
    !Number.isInteger(r.stage) ||
    r.stage < 0 ||
    r.stage > 3 ||
    !Number.isFinite(r.hp)
  )
    return;
  return {
    kind: r.kind,
    home: { ...r.home },
    points: r.points.map((p) => ({ ...p })),
    stage: r.stage,
    x: r.x,
    y: r.y,
    hp: Math.max(0, Math.min(100, r.hp)),
    released: r.released === true,
    failed: r.failed === true,
    ...(typeof r.choice === 'string' ? { choice: r.choice.slice(0, 40) } : {}),
  };
}
