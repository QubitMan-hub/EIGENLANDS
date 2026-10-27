/**
 * Settlement growth (master plan §16 "dynamic settlements"). A prosperous kingdom's settlements spread: new cottages
 * go up on their outskirts, one a day, as real building cells (the same floors, walls and roofs players build with),
 * owned by the kingdom (a fixed per-realm id, `civOwner`) so no traveller can take them apart. Each is furnished and a
 * family moves in. How many a settlement has earned follows from the kingdom's prosperity and the works finished there;
 * where they may stand is a fixed, seeded list of plots around the settlement, each checked on the ground before
 * anything is raised. Nothing is ever pulled down.
 */
import type { KingdomCiv } from './civ';
import type { BuildData } from './construction';
import type { RealmId, RealmSite } from './realms';
import { hash2 } from './rng';
import { REALM_SITES } from './realms';
import type { WildFolk } from './wildfolk';

export const COTTAGE_W = 5;
export const COTTAGE_H = 4;
export const GROWTH_MAX = 4;
/** plots tried around each settlement */
export const GROWTH_PLOTS = 14;
/** the crown's owner id: a fixed UUID per realm (building cells are stored against a UUID owner) */
const CIV_OWNER = '00000000-0000-4c1a-8000-0000000000';
const REALM_ORDER: RealmId[] = ['aurelion', 'sylvaris', 'khardum', 'raijin', 'thalassara', 'nethrakar'];
export const civOwner = (realm: RealmId) => `${CIV_OWNER}${String(REALM_ORDER.indexOf(realm) + 1).padStart(2, '0')}`;
export const isCivOwner = (owner: string | undefined) => !!owner && owner.startsWith(CIV_OWNER);

const STYLE: Record<RealmId, { wall: BuildData['wall']; roof: BuildData['roof']; floor: BuildData['floor'] }> = {
  aurelion: { wall: 'plaster_wall', roof: 'tile_roof', floor: 'oak_floor' },
  sylvaris: { wall: 'log_wall', roof: 'moss_roof', floor: 'timber_floor' },
  khardum: { wall: 'granite_wall', roof: 'slate_tile_roof', floor: 'granite_floor' },
  raijin: { wall: 'timber_wall', roof: 'tile_roof', floor: 'timber_floor' },
  thalassara: { wall: 'sandstone_wall', roof: 'reed_roof', floor: 'sandstone_floor' },
  nethrakar: { wall: 'brick_wall', roof: 'slate_tile_roof', floor: 'stone_floor' },
};

/** How many cottages a settlement has earned: works finished there, plus one per ten points of prosperity over 55. */
export function cottagesEarned(k: KingdomCiv, site: RealmSite): number {
  const works = k.built.filter((b) => b.site === site.id).length;
  return Math.max(0, Math.min(GROWTH_MAX, works + Math.floor((k.prosperity - 55) / 10)));
}

/** The seeded plots (top-left corners) where the settlement's cottages may stand, in the order they are tried. */
export function growthPlots(seed: number, site: RealmSite): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < GROWTH_PLOTS; i++) {
    const h1 = hash2(seed, site.cx, site.cy, 3100 + i),
      h2 = hash2(seed, site.cy, site.cx, 3200 + i),
      h3 = hash2(seed, site.cx + i, site.cy - i, 3300);
    const side = Math.floor(h1 * 4);
    const out_ = 3 + Math.floor(h3 * 8);
    const along = (h2 - 0.5) * 0.8;
    let x: number, y: number;
    if (side === 0 || side === 2) {
      x = Math.round(site.cx + along * site.w - COTTAGE_W / 2);
      y = side === 0 ? Math.round(site.cy - site.h / 2 - out_ - COTTAGE_H) : Math.round(site.cy + site.h / 2 + out_);
    } else {
      y = Math.round(site.cy + along * site.h - COTTAGE_H / 2);
      x = side === 3 ? Math.round(site.cx - site.w / 2 - out_ - COTTAGE_W) : Math.round(site.cx + site.w / 2 + out_);
    }
    out.push({ x, y });
  }
  return out;
}

/** Every plot (top-left corner) of every settlement whose outskirts reach within `r` tiles of (x, y). */
export function plotsNear(seed: number, x: number, y: number, r: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (const s of REALM_SITES)
    if (Math.abs(s.cx - x) < s.w / 2 + 16 + r && Math.abs(s.cy - y) < s.h / 2 + 16 + r)
      out.push(...growthPlots(seed, s));
  return out;
}

/** The family living in the cottage at plot (x, y): they potter about in front of their door by day. */
export function cottagerOf(x: number, y: number): WildFolk {
  return {
    id: `ct${x}_${y}`,
    x: x + 2.5,
    y: y + COTTAGE_H + 1.2,
    kind: 'cottager',
    look: Math.floor(hash2(0x77, x, y, 1) * 1e6),
    r: 2,
  };
}

/** The furniture inside a cottage at (x, y): a bed, a table and chair, a shelf and a lamp, with the doorway clear. */
export function cottageFurniture(x: number, y: number): Array<{ x: number; y: number; sub: string }> {
  return [
    { x: x + 1, y: y + 1, sub: 'bed' },
    { x: x + 3, y: y + 1, sub: 'shelf' },
    { x: x + 3, y: y + 2, sub: 'table' },
    { x: x + 1, y: y + 2, sub: 'lamp' },
    { x: x + 2, y: y + 1, sub: 'rug' },
  ];
}

/** The building cells of one cottage at (x, y): walls round the edge, a door and windows, a floor and roof over all. */
export function cottageCells(realm: RealmId, x: number, y: number): Array<{ x: number; y: number; data: BuildData }> {
  const s = STYLE[realm];
  const cells: Array<{ x: number; y: number; data: BuildData }> = [];
  for (let dy = 0; dy < COTTAGE_H; dy++)
    for (let dx = 0; dx < COTTAGE_W; dx++) {
      const edge = dx === 0 || dy === 0 || dx === COTTAGE_W - 1 || dy === COTTAGE_H - 1;
      const data: BuildData = { floor: s.floor, roof: s.roof, roofTurn: 0 };
      if (edge) {
        const door = dy === COTTAGE_H - 1 && dx === 2;
        const window =
          !door && ((dy === 0 && (dx === 1 || dx === 3)) || (dx === 0 && dy === 1) || (dx === 4 && dy === 1));
        data.wall = door ? 'oak_door' : window ? 'window_wall' : s.wall;
        data.wallTurn = dx === 0 || dx === COTTAGE_W - 1 ? (dy === 0 || dy === COTTAGE_H - 1 ? 0 : 1) : 0;
        data.open = false;
      }
      cells.push({ x: x + dx, y: y + dy, data });
    }
  return cells;
}

// ───────────────────────── the families in the cottages ─────────────────────────

const SURNAMES = [
  'Thatcher',
  'Millward',
  'Brookes',
  'Hedgerow',
  'Ashby',
  'Fairweather',
  'Pennyroyal',
  'Oakes',
  'Tumbledown',
  'Hollis',
  'Underhill',
  'Wren',
  'Quill',
  'Barleycorn',
  'Cobb',
  'Larkspur',
];
const GIVEN = [
  'Edda',
  'Tom',
  'Mira',
  'Bram',
  'Isolde',
  'Pell',
  'Wynn',
  'Hal',
  'Rosa',
  'Corin',
  'Liesl',
  'Aldo',
  'Nell',
  'Fenn',
  'Ivy',
  'Jory',
];
/** what each household does, and what they press on a visitor once a day */
const TRADES: Array<{ trade: string; gift: string; n: number; work: string }> = [
  { trade: 'weavers', gift: 'cloth', n: 2, work: 'The loom has not stopped since we moved in.' },
  {
    trade: 'beekeepers',
    gift: 'honey',
    n: 1,
    work: 'The bees found the clover by the road before we had the shutters up.',
  },
  { trade: 'carpenters', gift: 'plank', n: 3, work: 'Half the fences round here are ours now.' },
  { trade: 'cowherds', gift: 'milk', n: 2, work: 'Old Dumpling gives more milk than the three of us can drink.' },
  { trade: 'bakers', gift: 'country_loaf', n: 1, work: 'We are up before the cock every morning for the ovens.' },
  { trade: 'shepherds', gift: 'wool', n: 2, work: 'Shearing is next week. You will hear the bleating from the road.' },
  { trade: 'cheesemakers', gift: 'cheese', n: 1, work: 'The cellar is cool enough for a good hard cheese.' },
  { trade: 'orchard keepers', gift: 'apple', n: 3, work: 'The saplings are small, but give them three summers.' },
  { trade: 'hen keepers', gift: 'egg', n: 3, work: 'The hens lay under the bed if you leave the door open.' },
  { trade: 'charcoal burners', gift: 'charcoal', n: 2, work: 'Forgive the smoke: the kiln is out back.' },
  { trade: 'smallholders', gift: 'carrot', n: 3, work: 'Carrots, turnips, a row of beans. It feeds us.' },
  { trade: 'fisherfolk', gift: 'herring', n: 2, work: 'We are out on the water at first light.' },
];

export interface CottageFamily {
  /** the cottager's id (cottagerOf) */
  id: string;
  surname: string;
  /** the two grown-ups and a child */
  members: [string, string, string];
  trade: string;
  work: string;
  gift: { id: string; n: number };
  realm: RealmId;
}

/** The cottage plot (top-left) whose family is `id`, if it is one of a settlement's plots. */
export function cottagePlot(seed: number, id: string): { x: number; y: number; site: RealmSite } | null {
  const m = /^ct(-?\d+)_(-?\d+)$/.exec(id);
  if (!m) return null;
  const x = Number(m[1]),
    y = Number(m[2]);
  for (const s of REALM_SITES)
    if (Math.abs(s.cx - x) < s.w / 2 + 40 && Math.abs(s.cy - y) < s.h / 2 + 40)
      if (growthPlots(seed, s).some((p) => p.x === x && p.y === y)) return { x, y, site: s };
  return null;
}

/** Who lives in the cottage at plot (x, y) of `realm`'s settlement. */
export function cottageFamily(x: number, y: number, realm: RealmId): CottageFamily {
  const h = (k: number) => hash2(0x5ea7, x, y, 40 + k);
  const pick = <T>(a: readonly T[], k: number) => a[Math.floor(h(k) * a.length)]!;
  const t = pick(TRADES, 0);
  const a = Math.floor(h(1) * GIVEN.length);
  return {
    id: `ct${x}_${y}`,
    surname: pick(SURNAMES, 2),
    members: [GIVEN[a]!, GIVEN[(a + 5) % GIVEN.length]!, GIVEN[(a + 11) % GIVEN.length]!],
    trade: t.trade,
    work: t.work,
    gift: { id: t.gift, n: t.n },
    realm,
  };
}

/** What the family has to say today: who they are, their work, the weather, and how the kingdom is faring. */
export function cottageTalk(
  f: CottageFamily,
  day: number,
  c: { weather: string; prosperity: number; atWar: boolean; first: boolean },
): string[] {
  const [a, b, kid] = f.members;
  const h = (k: number) => hash2(0x5ea8, day, f.id.length + k, Math.floor(hash2(0x11, day, k, 7) * 1e4));
  const lines: string[] = [];
  lines.push(
    c.first
      ? `"Oh! A visitor. I'm ${a} ${f.surname}, and this is ${b}. We're ${f.trade}. The crown raised this house for us when the town grew."`
      : `"Back again! ${b}, put the kettle on."`,
  );
  const topics = [
    f.work,
    c.weather === 'rain' || c.weather === 'storm'
      ? 'Listen to that rain on the roof. A good roof is worth more than gold, my mother used to say.'
      : c.weather === 'snow'
        ? `${kid} wants to build a snow-knight by the door. I said only after the woodpile is in.`
        : `${kid} has been out in the meadow since breakfast. Have you seen a small person covered in burrs?`,
    c.atWar
      ? `${b}'s brother marched with the levy. We pray the war ends before the harvest.`
      : c.prosperity >= 70
        ? 'Times are good. The market is full and the granary too. That is why there are new houses, they say.'
        : c.prosperity < 40
          ? 'Times are lean. We make do, and we are glad of a roof of our own.'
          : 'Quiet times. We like it that way.',
    `${kid} says there are lights in the old ruins at night. Children's stories, surely.`,
  ];
  const i = Math.floor(h(1) * topics.length);
  lines.push(`"${topics[i]!.replace(/^"|"$/g, '')}"`);
  if (h(2) < 0.5) lines.push(`"${topics[(i + 1) % topics.length]!.replace(/^"|"$/g, '')}"`);
  return lines;
}
