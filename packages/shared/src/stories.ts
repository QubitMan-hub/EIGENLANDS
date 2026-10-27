/**
 * Environmental storytelling (master plan §16): small scenes left in the wild that tell a story without a word of
 * quest text. An abandoned camp with its owner's journal, a lone grave, an overturned cart and its bill of lading, a
 * carved standing stone, a wayside shrine full of notes. Each is one or a few props and one thing to read; the text
 * is assembled from the seed, so every scene is different and nothing is stored. Reading one the first time pays a
 * little XP and files the page in the Journal.
 *
 * Crypts: a third of the ruins hide a sealed crypt. Breaking its seal wakes three waves of guardians; a traveller who
 * clears them opens the reliquary (features/crypts on the server).
 */
import { mulberry32, hash2 } from './rng';
import type { WorldGeneration } from './world-version';
import type { WorldObj } from './objects';
import { T, isSolid } from './tiles';
import { HOME_VALE, biomeAt, tileAt, type Biome } from './worldgen';
import { elevationAt } from './terrain3';
import { sanctuaryAt } from './sanctuary';
import { REALM_IDS, REALM_SITES, nearestRealm } from './realms';
import { KINGDOMS } from './kingdoms';
import { ruinOfCell, type RuinSite } from './ruins';
import { isCaveY } from './caves';
import { isUpperY } from './floors';
import { isDiveY } from './sanctuaries';
import { isCryptY } from './cryptplane';
import { isOtherworldY } from './otherworlds';

export type StoryKind = 'camp' | 'grave' | 'cart' | 'stone' | 'shrine' | 'wreck' | 'cairn';
export interface StorySite {
  id: string;
  x: number;
  y: number;
  kind: StoryKind;
  biome: Biome;
}
/** the prop a traveller reads at each kind of scene */
export const STORY_READ: Record<StoryKind, string> = {
  camp: 'story_journal',
  grave: 'story_grave',
  cart: 'story_cart',
  stone: 'story_stone',
  shrine: 'story_shrine',
  wreck: 'story_wreck',
  cairn: 'story_cairn',
};
export const STORY_SUBS = new Set([
  'story_journal',
  'story_bedroll',
  'story_firepit',
  'story_grave',
  'story_cart',
  'story_crate',
  'story_stone',
  'story_shrine',
  'story_wreck',
  'story_cairn',
  'ruin_crypt',
]);
/** story props that are read (the rest are scenery) */
export const STORY_READABLE = new Set([...Object.values(STORY_READ), 'ruin_crypt']);
export const STORY_XP = 40;

/** World revision that has story scenes and crypts (older worlds keep their ground untouched). */
export const STORY_GENERATION: WorldGeneration = 6;
const CELL = 72;
const KINDS: StoryKind[] = ['camp', 'grave', 'cart', 'stone', 'shrine'];

const cache = new Map<string, StorySite | null>();
function open(seed: number, x: number, y: number): boolean {
  for (let j = -2; j <= 2; j++)
    for (let i = -2; i <= 2; i++) {
      const t = tileAt(seed, x + i, y + j, STORY_GENERATION);
      if (isSolid(t) || t === T.PATH || t === T.WATER || t === T.DEEP_WATER) return false;
    }
  return true;
}

/** The story scene of a 72×72 cell, if it has one. */
export function storyOfCell(seed: number, gx: number, gy: number): StorySite | null {
  const key = `${seed}:${gx},${gy}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let out: StorySite | null = null;
  if (hash2(seed, gx, gy, 1301) < 0.42) {
    for (let k = 0; k < 10 && !out; k++) {
      const x = gx * CELL + 10 + Math.floor(hash2(seed, gx * 17 + k, gy, 1302) * (CELL - 20));
      const y = gy * CELL + 10 + Math.floor(hash2(seed, gx, gy * 17 + k, 1303) * (CELL - 20));
      if (Math.hypot(x, y) < HOME_VALE + 10 || isCaveY(y) || isUpperY(y) || isDiveY(y) || isCryptY(y) || isOtherworldY(y)) continue;
      if (sanctuaryAt(seed, x, y)) continue;
      if (REALM_SITES.some((s) => Math.abs(x - s.cx) < s.w / 2 + 12 && Math.abs(y - s.cy) < s.h / 2 + 12)) continue;
      if (!open(seed, x, y)) continue;
      // keep clear of a ruin in the same stretch of land
      const rg = (v: number) => Math.floor(v / 96);
      const ru = ruinOfCell(seed, rg(x), rg(y));
      if (ru && Math.hypot(ru.x - x, ru.y - y) < 14) continue;
      const kind = KINDS[Math.floor(hash2(seed, gx, gy, 1304) * KINDS.length)]!;
      out = { id: `st${gx}_${gy}`, x, y, kind, biome: biomeAt(seed, x, y) };
    }
  }
  if (cache.size > 4000) cache.clear();
  cache.set(key, out);
  return out;
}

// ── shores and summits: wrecks washed up on the beaches, cairns on the high tops (their own grids and ids)
const SHORE_CELL = 88,
  SUMMIT_CELL = 96;
const wild = (seed: number, x: number, y: number) =>
  !(Math.hypot(x, y) < HOME_VALE + 10 || isCaveY(y) || isUpperY(y) || isDiveY(y) || isCryptY(y) || isOtherworldY(y)) &&
  !sanctuaryAt(seed, x, y) &&
  !REALM_SITES.some((s) => Math.abs(x - s.cx) < s.w / 2 + 12 && Math.abs(y - s.cy) < s.h / 2 + 12);
const landTile = (seed: number, x: number, y: number) => {
  const t = tileAt(seed, x, y, STORY_GENERATION);
  return !isSolid(t) && t !== T.WATER && t !== T.DEEP_WATER && t !== T.PATH;
};
/** A shipwreck on a sandy shore, if this cell's coast has one. */
export function wreckOfCell(seed: number, gx: number, gy: number): StorySite | null {
  const key = `w${seed}:${gx},${gy}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let out: StorySite | null = null;
  if (hash2(seed, gx, gy, 1341) < 0.5)
    for (let k = 0; k < 14 && !out; k++) {
      const x = gx * SHORE_CELL + 6 + Math.floor(hash2(seed, gx * 19 + k, gy, 1342) * (SHORE_CELL - 12));
      const y = gy * SHORE_CELL + 6 + Math.floor(hash2(seed, gx, gy * 19 + k, 1343) * (SHORE_CELL - 12));
      if (tileAt(seed, x, y, STORY_GENERATION) !== T.SAND || !wild(seed, x, y)) continue;
      let water = false,
        land = true;
      for (let j = -3; j <= 3; j++)
        for (let i = -3; i <= 3; i++) {
          const t = tileAt(seed, x + i, y + j, STORY_GENERATION);
          if (t === T.WATER || t === T.DEEP_WATER) water = true;
        }
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 2; i++) if (!landTile(seed, x + i, y + j)) land = false;
      if (water && land) out = { id: `sw${gx}_${gy}`, x, y, kind: 'wreck', biome: biomeAt(seed, x, y) };
    }
  cache.set(key, out);
  return out;
}
/** A cairn on a high top (a local summit at elevation level 2 or more), if this cell's hills have one. */
export function cairnOfCell(seed: number, gx: number, gy: number): StorySite | null {
  const key = `c${seed}:${gx},${gy}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let out: StorySite | null = null;
  if (hash2(seed, gx, gy, 1351) < 0.45)
    for (let k = 0; k < 16 && !out; k++) {
      const x = gx * SUMMIT_CELL + 8 + Math.floor(hash2(seed, gx * 23 + k, gy, 1352) * (SUMMIT_CELL - 16));
      const y = gy * SUMMIT_CELL + 8 + Math.floor(hash2(seed, gx, gy * 23 + k, 1353) * (SUMMIT_CELL - 16));
      const top = elevationAt(seed, x, y);
      if (!wild(seed, x, y) || top < 2) continue;
      let ok = true;
      // the highest ground for a few tiles round
      for (let j = -4; j <= 4 && ok; j += 2)
        for (let i = -4; i <= 4 && ok; i += 2) if (elevationAt(seed, x + i, y + j) > top) ok = false;
      for (let j = -1; j <= 1 && ok; j++)
        for (let i = -1; i <= 1 && ok; i++)
          if (!landTile(seed, x + i, y + j) || elevationAt(seed, x + i, y + j) !== elevationAt(seed, x, y)) ok = false;
      if (ok) out = { id: `sc${gx}_${gy}`, x, y, kind: 'cairn', biome: biomeAt(seed, x, y) };
    }
  cache.set(key, out);
  return out;
}

export function storyObjects(s: StorySite): WorldObj[] {
  const o = (dx: number, dy: number, sub: string): WorldObj => ({
    x: s.x + dx,
    y: s.y + dy,
    kind: 'deco',
    sub,
    static: true,
    data: { story: s.id, biome: s.biome },
  });
  switch (s.kind) {
    case 'camp':
      return [o(0, 0, 'story_firepit'), o(-1, -1, 'story_bedroll'), o(1, -1, 'story_journal')];
    case 'grave':
      return [o(0, 0, 'story_grave')];
    case 'cart':
      return [o(0, 0, 'story_cart'), o(2, 1, 'story_crate'), o(-1, 2, 'story_crate')];
    case 'stone':
      return [o(0, 0, 'story_stone')];
    case 'shrine':
      return [o(0, 0, 'story_shrine')];
    case 'wreck':
      return [o(0, 0, 'story_wreck'), o(2, 1, 'story_crate')];
    case 'cairn':
      return [o(0, 0, 'story_cairn')];
  }
}

/** Whether a ruin hides a crypt, and where its sealed door stands. */
export function ruinCrypt(seed: number, r: RuinSite): { x: number; y: number } | null {
  if (hash2(seed, r.x, r.y, 1311) >= 0.34) return null;
  return { x: r.x - 1, y: r.y + 2 };
}

/** Story props and crypt doors in chunk (cx, cy). */
export function storyObjectsIn(seed: number, cx: number, cy: number, generation: number): WorldObj[] {
  if (generation < STORY_GENERATION) return [];
  const out: WorldObj[] = [];
  const x0 = cx * 32,
    y0 = cy * 32;
  const inChunk = (o: WorldObj) => Math.floor(o.x / 32) === cx && Math.floor(o.y / 32) === cy;
  for (let gy = Math.floor((y0 - 4) / CELL); gy <= Math.floor((y0 + 36) / CELL); gy++)
    for (let gx = Math.floor((x0 - 4) / CELL); gx <= Math.floor((x0 + 36) / CELL); gx++) {
      const s = storyOfCell(seed, gx, gy);
      if (s) for (const o of storyObjects(s)) if (inChunk(o)) out.push(o);
    }
  for (const [cell, of] of [
    [SHORE_CELL, wreckOfCell],
    [SUMMIT_CELL, cairnOfCell],
  ] as const)
    for (let gy = Math.floor((y0 - 4) / cell); gy <= Math.floor((y0 + 36) / cell); gy++)
      for (let gx = Math.floor((x0 - 4) / cell); gx <= Math.floor((x0 + 36) / cell); gx++) {
        const s = of(seed, gx, gy);
        if (s) for (const o of storyObjects(s)) if (inChunk(o)) out.push(o);
      }
  for (let gy = Math.floor((y0 - 8) / 96); gy <= Math.floor((y0 + 40) / 96); gy++)
    for (let gx = Math.floor((x0 - 8) / 96); gx <= Math.floor((x0 + 40) / 96); gx++) {
      const r = ruinOfCell(seed, gx, gy);
      const c = r && ruinCrypt(seed, r);
      if (!r || !c) continue;
      const o: WorldObj = {
        x: c.x,
        y: c.y,
        kind: 'deco',
        sub: 'ruin_crypt',
        static: true,
        data: { ruin: r.id, biome: r.biome },
      };
      if (inChunk(o) && !isSolid(tileAt(seed, c.x, c.y, STORY_GENERATION))) out.push(o);
    }
  return out;
}

// ───────────────────────── the words ─────────────────────────

const GIVEN = [
  'Aldric',
  'Mirelle',
  'Tomas',
  'Wren',
  'Isolde',
  'Bram',
  'Ysolt',
  'Corin',
  'Hale',
  'Neve',
  'Oswin',
  'Pell',
  'Rosamund',
  'Sefa',
  'Tamsin',
  'Ulric',
];
const FAMILY = [
  'Ashford',
  'Brightwater',
  'Coldbrook',
  'Dunmore',
  'Everhart',
  'Fallow',
  'Greaves',
  'Holloway',
  'Ironside',
  'Larkspur',
  'Marsh',
  'Thorne',
];
const GOODS = [
  'salt',
  'wool bales',
  'copper nails',
  'dried figs',
  'lamp oil',
  'pickled herring',
  'bolts of linen',
  'river clay',
];
const BIOME_WORD: Record<Biome, string> = {
  meadow: 'the long grass',
  forest: 'the deep wood',
  autumn: 'the red woods',
  taiga: 'the snow pines',
  swamp: 'the fen',
  desert: 'the dunes',
  enchanted: 'the glade',
  corrupted: 'the grey waste',
};

export interface StoryText {
  title: string;
  plaque: string;
  epitaph: string;
  pages: string[];
}

/** The words of a story scene (or a crypt door), from its id. */
export function storyText(
  seed: number,
  id: string,
  kind: StoryKind | 'crypt',
  biome: Biome,
  x: number,
  y: number,
): StoryText {
  const R = mulberry32((hash2(seed, x, y, 1320) * 4294967296) >>> 0);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(R() * a.length)]!;
  const who = `${pick(GIVEN)} ${pick(FAMILY)}`;
  const kin = pick(GIVEN);
  const land = BIOME_WORD[biome];
  const realm = nearestRealm(x, y)?.id ?? pick(REALM_IDS);
  const K = KINGDOMS[realm];
  const year = 100 + Math.floor(R() * 300);
  void id;
  switch (kind) {
    case 'camp':
      return {
        title: `${who}'s journal`,
        plaque: 'A WATER-STAINED JOURNAL',
        epitaph: 'Left open beside a cold fire. The bedroll has not been slept in for a long time.',
        pages: [
          `Day 1. Set out from ${K.capital} for ${land} to map the old roads. ${kin} said I was mad to go alone. ${kin} is usually right.`,
          `Day 9. Found stones cut by hands older than any kingdom. Something hums in them at night. I have stopped sleeping well.`,
          `Day 14. The humming has a rhythm now: on, off, both at once. If anyone finds this, tell ${kin} I went to see what it was. Tell ${kin} I was not afraid.`,
        ],
      };
    case 'grave':
      return {
        title: `The grave of ${who}`,
        plaque: `${who.toUpperCase()} · YEAR ${year}`,
        epitaph: pick([
          'A sword driven into the mound, rusted to the hilt. Someone still leaves flowers.',
          'A plain mound under a cairn of river stones. Fresh wildflowers lie on top.',
          'A helm set on a wooden post above the grave, its plume long since rotted away.',
        ]),
        pages: [
          `Here lies ${who}, ${pick(['shield-bearer of', 'a caravan guard of', 'a scout of', 'a healer of'])} ${K.name}, who held this road so others could pass.`,
          `"${pick(['We walked out together; I walked home alone.', 'The wolves came at dusk. You did not run.', 'You promised to see the sea. I will see it for you.'])}" — ${kin}`,
        ],
      };
    case 'cart': {
      const g1 = pick(GOODS),
        g2 = pick(GOODS.filter((g) => g !== g1));
      return {
        title: 'A bill of lading',
        plaque: `${K.name.toUpperCase()} TRADING COMPANY`,
        epitaph:
          'The cart lies on its side, one wheel snapped. Whatever pulled it is long gone; claw marks score the boards.',
        pages: [
          `Consigned by ${who} of ${K.capital}: twelve crates of ${g1}, four of ${g2}, one sealed box (DO NOT OPEN — for the treasurer's hand only).`,
          `Scrawled on the back: "Driver says the road through ${land} is quicker. Driver is an idiot. Paying him anyway."`,
          `The sealed box is here, broken open and empty.`,
        ],
      };
    }
    case 'stone':
      return {
        title: 'A carved standing stone',
        plaque: 'WORN CARVINGS',
        epitaph: `A lone stone over ${land}. Older marks have been carved over by newer ones, layer on layer.`,
        pages: [
          `The oldest marks are the waystone runes, the same as on every stone of the network, but here they run backwards.`,
          `Over them, cut later: "${who} + ${kin}, year ${year}", inside a lopsided heart.`,
          `Over that, freshest of all and very small: "QubitMan was here. Both of them."`,
        ],
      };
    case 'shrine':
      return {
        title: 'A wayside shrine',
        plaque: 'FOR SAFE ROADS',
        epitaph: 'A little roofed shrine stuffed with folded notes, ribbons and the odd copper coin.',
        pages: [
          `"For ${kin}, gone to the ${K.name} wars. Bring them home." — ${who}`,
          `"Thank you for the rain." "Please, no more rain." (two notes, pinned together)`,
          `"To whoever keeps leaving the bread: the foxes thank you. So do I." — the shrine-keeper`,
        ],
      };
    case 'wreck': {
      const ship = pick(['Gull', 'Merry Wren', 'Saltwhistle', 'Dawn Treader', 'Brave Kestrel', 'Lady Isolde']);
      return {
        title: `The wreck of the ${ship}`,
        plaque: `${ship.toUpperCase()} · OUT OF ${K.capital.toUpperCase()}`,
        epitaph: 'Ribs of a ship stand out of the sand like a whale’s bones. Gulls nest in what is left of the hold.',
        pages: [
          `Captain's log. Fair wind out of ${K.capital}, holds full of ${pick(GOODS)}. ${kin} swears the sky smells of a storm. ${kin} always says that.`,
          `The storm came after all. We lost the mast at dusk and the rudder before midnight. Breakers ahead. God keep us. — ${who}`,
          `(On a scrap nailed to the ribs, in another hand:) All hands came ashore alive. We walked to the nearest town. Whoever finds this: the cargo is yours.`,
        ],
      };
    }
    case 'cairn':
      return {
        title: 'A summit cairn',
        plaque: 'YOU HAVE CLIMBED HIGH',
        epitaph:
          'A pile of stones on the very top, each one carried up by somebody. A tin box is wedged in among them.',
        pages: [
          `Inside the tin, a climbers' register. The oldest entry: "Year ${year}. ${who} was here first. The view is worth the knees."`,
          `"${kin}, with the ${K.name} survey: the whole of ${land} laid out below like a map. Added a stone."`,
          `The last page is blank. You write your name, and add a stone to the cairn before you go down.`,
        ],
      };
    case 'crypt':
      return {
        title: 'A sealed crypt',
        plaque: 'THE HONOURED DEAD KEEP THEIR WATCH',
        epitaph: `Steps under the ruin lead down to a door of fitted stone. Behind it something stirs whenever a living foot touches the threshold.`,
        pages: [
          `The builders of this place buried their wardens beneath it, with their treasures, sworn to guard both for ever.`,
          `Break the seal and the wardens rise: three times they come. Outlast them and the reliquary is yours.`,
        ],
      };
  }
}

/** The story site an id names: "st…" scenes, "sw…" wrecks, "sc…" cairns. */
export function storySiteById(seed: number, id: string): StorySite | null {
  const m = /^s([twc])(-?\d+)_(-?\d+)$/.exec(id);
  if (!m) return null;
  const gx = Number(m[2]),
    gy = Number(m[3]);
  return m[1] === 't'
    ? storyOfCell(seed, gx, gy)
    : m[1] === 'w'
      ? wreckOfCell(seed, gx, gy)
      : cairnOfCell(seed, gx, gy);
}
