import { guildHall } from './guild-halls';
import type { Objective, QuestDef, QuestLog } from './quests';
import type { Town } from './town';
import type { WorldObj } from './objects';
import { T } from './tiles';
import { REALM_IDS } from './realms';
import { KINGDOMS } from './kingdoms';

export const GUILD_RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as const;
export type GuildRank = (typeof GUILD_RANKS)[number];
const objective = (type: Objective['type'], target: string, n: number, label: string): Objective => ({
  type,
  target,
  n,
  label,
});
const O = objective;
const assignments: Array<[string, Objective[], string, Objective[]]> = [
  [
    'The eastern watch',
    [O('kill', 'slime', 3, 'Defeat 3 wild slimes')],
    'First provisions',
    [O('deliver', 'wood', 12, 'Supply 12 wood')],
  ],
  [
    'A steady hand',
    [O('craft', '@workbench', 2, 'Craft 2 items at a workbench')],
    'Tend the fields',
    [O('harvest', '*', 4, 'Harvest 4 crops')],
  ],
  [
    'A patient angler',
    [O('fish', '*', 4, 'Land 4 fish')],
    'An honest ledger',
    [O('sell', '*', 6, 'Sell 6 items to merchants')],
  ],
  [
    'The forgotten archive',
    [O('read', 'cave_archive', 1, 'Read a delver archive')],
    'Tempered steel',
    [O('smelt', '*', 6, 'Smelt 6 metal batches')],
  ],
  [
    'The living circuit',
    [O('discover', '#recipe', 2, 'Discover 2 recipes by experiment')],
    'A village supplied',
    [O('deliver', 'healing_potion', 6, 'Supply 6 healing potions')],
  ],
  [
    'The broken seal',
    [O('kill', 'bellkeeper', 1, 'Defeat the Bellkeeper')],
    'The first crown',
    [O('kill', 'slime_king', 1, 'Defeat the Slime King')],
  ],
  [
    'Stormglass',
    [O('kill', 'veyr', 1, 'Defeat Veyr')],
    'Winter crown',
    [O('kill', 'rime_sovereign', 1, 'Defeat the Rime Sovereign')],
  ],
  [
    'The deep accord',
    [O('kill', 'tide_leviathan', 1, 'Defeat the Tide Leviathan')],
    'Fire beneath stone',
    [O('kill', 'cinder_wyrm', 1, 'Defeat the Cinder Wyrm')],
  ],
];
export const GUILD_QUESTS: QuestDef[] = [
  {
    id: 'guild:rank:F',
    giver: 'guild',
    title: 'The Wayfarer Oath',
    summary: 'Register with the Adventurer Guild. Your identity and deeds follow you between halls.',
    objectives: [],
    rewards: { coins: 0 },
    where: 'Any Adventurer Guild board',
    lines: {
      offer: 'Protect travellers. Leave places better than you found them.',
      progress: 'Take the oath at a guild board.',
      done: 'Welcome, F-rank adventurer.',
    },
  },
];
for (let i = 0; i < 8; i++) {
  const rank = GUILD_RANKS[i]!,
    next = GUILD_RANKS[i + 1]!,
    row = assignments[i]!;
  for (const n of [0, 1]) {
    const title = row[n * 2] as string,
      objectives = row[n * 2 + 1] as Objective[];
    GUILD_QUESTS.push({
      id: `guild:${rank}:${n}`,
      giver: 'guild',
      title,
      summary: `${rank}-rank commission. Complete the work yourself and report to any hall.`,
      objectives,
      requires: [`guild:rank:${rank}`],
      rewards: { coins: 35 + 35 * i },
      where: 'Any Adventurer Guild board',
      lines: {
        offer: `Commission: ${title}.`,
        progress: 'The ledger records real work after acceptance.',
        done: 'Commission verified.',
      },
    });
  }
  const trials: Objective[] =
    i < 5
      ? [
          O(
            'kill',
            ['wolf', 'thornling', 'glasscrawler', 'wisp', 'warden'][i]!,
            i === 4 ? 1 : 3 + i,
            `Prove yourself against ${['wolves', 'thornlings', 'glasscrawlers', 'wisps', 'the Warden'][i]}`,
          ),
          O('craft', '*', 2 + i, 'Prepare equipment and supplies'),
        ]
      : i === 5
        ? [O('kill', 'geode_tyrant', 1, 'Defeat the Geode Tyrant'), O('kill', 'colossus', 1, 'Defeat the Colossus')]
        : i === 6
          ? [
              O('kill', 'rime_sovereign', 1, 'Defeat the Rime Sovereign'),
              O('kill', 'cinder_wyrm', 1, 'Defeat the Cinder Wyrm'),
              O('kill', 'veyr', 1, 'Defeat Veyr'),
            ]
          : [
              ...REALM_IDS.map((r) =>
                O('discover', `guild:defend:${r}`, 1, `Help repel an assault on ${KINGDOMS[r].name}`),
              ),
              O('kill', 'veyr', 1, 'Defeat Veyr after taking the final oath'),
              O('kill', 'tide_leviathan', 1, 'Defeat the Tide Leviathan after taking the final oath'),
            ];
  GUILD_QUESTS.push({
    id: `guild:rank:${next}`,
    giver: 'guild',
    title: next === 'SSS' ? 'The Sixfold Covenant' : `Promotion trial: ${next}`,
    summary:
      next === 'SSS'
        ? 'Defend all six kingdoms through real raid contributions and master two legendary encounters. Repeated farming cannot replace these distinct deeds.'
        : `A practical trial combining preparation and field mastery. Complete both ${rank}-rank commissions first.`,
    objectives: trials,
    requires: [`guild:${rank}:0`, `guild:${rank}:1`],
    rewards: { coins: 100 + 100 * i },
    where: 'Any Adventurer Guild board',
    lines: {
      offer: 'Rank follows responsibility, never the size of a kill counter.',
      progress: 'Complete every distinct proof.',
      done: `Certified ${next}-rank.`,
    },
  });
}
export function guildRank(log: QuestLog): GuildRank | null {
  let rank: GuildRank | null = null;
  for (const r of GUILD_RANKS) {
    if (log[`guild:rank:${r}`]?.state !== 'done') break;
    rank = r;
  }
  return rank;
}
const boardCache = new WeakMap<Town, WorldObj | null>();
/** Place a physical board in the existing civic hall without moving saved walls or furnishings. */
export function guildBoard(t: Town): WorldObj | null {
  if (boardCache.has(t)) return boardCache.get(t)!;
  const b = guildHall(t);
  if (!b) return null;
  const occupied = new Set([...t.objects, ...Object.values(t.spots)].map((o) => `${o.x},${o.y}`));
  for (let y = b.y + 1; y < b.y + b.h - 2; y++)
    for (let x = b.x + 1; x < b.x + b.w - 1; x++) {
      const tile = t.tiles.get(x - t.x0 + (y - t.y0) * (t.x1 - t.x0 + 1));
      if (tile !== T.FLOOR || occupied.has(`${x},${y}`) || Math.hypot(x - b.doorX, y - b.doorY) < 3) continue;
      if (t.objects.some((o) => o.sub.startsWith('stairs_') && Math.hypot(o.x - x, o.y - y) < 2)) continue;
      const board: WorldObj = { x, y, kind: 'deco', sub: 'guild_board', static: true, data: { town: t.name } };
      boardCache.set(t, board);
      return board;
    }
  boardCache.set(t, null);
  return null;
}

const fittingCache = new WeakMap<Town, WorldObj[]>();
/** Add one original registration desk only on free hall floor, away from stairs, doors and the board. */
export function guildFurnishings(t: Town): WorldObj[] {
  const cached = fittingCache.get(t);
  if (cached) return cached;
  const board = guildBoard(t),
    result: WorldObj[] = [];
  const b =
    board && t.buildings.find((b) => board.x > b.x && board.y > b.y && board.x < b.x + b.w && board.y < b.y + b.h);
  if (board && b)
    for (let y = b.y + 1; y < b.y + b.h - 2 && !result.length; y++)
      for (let x = b.x + 1; x < b.x + b.w - 1; x++) {
        const floor = (x: number, y: number) => t.tiles.get(x - t.x0 + (y - t.y0) * (t.x1 - t.x0 + 1)) === T.FLOOR;
        if (
          !floor(x, y) ||
          Math.hypot(x - board.x, y - board.y) < 2 ||
          Math.hypot(x - b.doorX, y - b.doorY) < 3 ||
          t.objects.some((o) => Math.hypot(o.x - x, o.y - y) < 1.5)
        )
          continue;
        if (
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].filter(([dx, dy]) => floor(x + dx!, y + dy!)).length < 3
        )
          continue;
        result.push({ x, y, kind: 'deco', sub: 'guild_desk', static: true });
        break;
      }
  fittingCache.set(t, result);
  return result;
}
