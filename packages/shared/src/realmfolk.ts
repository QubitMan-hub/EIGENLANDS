/**
 * The peoples of the three realms (otherworlds.ts). Each realm has a people who live there and trade with travellers,
 * and a people at war with them:
 *
 *   Aetheria  — the Aerin, pale sky-folk of the floating isles; against them, the Gale Reavers, sky pirates.
 *   the Abyss — the Hollowfolk, lantern-keepers of the lit Hollow; against them, the Gloamkin, cultists of the Maw.
 *   Chronoria — the Archivists, who keep the hours; against them, the Sundered, raiders torn loose from time.
 *
 * Standing with a people is kept beside kingdom reputation (the same tiers, `repTier`): it rises as you bring down
 * their enemies and the realm's guardian, and as you turn in the tokens those enemies carry. Standing opens their
 * recipes (realm metals, plate, weapons, remedies, accessories: `learn: realm:<people>`) and their better wares.
 */
import { OTHERWORLDS, roomOf, HOLLOW_CELL, type OtherworldId } from './otherworlds';
import type { ItemKind } from './items';
import type { NpcDef, ScheduleBlock, ShopStock } from './npcs';
import { REP_TIERS, repTier } from './kingdoms';

export type RaceId = 'aerin' | 'hollowfolk' | 'archivists';
export const RACE_IDS: RaceId[] = ['aerin', 'hollowfolk', 'archivists'];

export interface Race {
  id: RaceId;
  realm: OtherworldId;
  name: string;
  /** the five ranks: stranger .. champion (repTier 0..4) */
  ranks: [string, string, string, string, string];
  /** their enemies: the hostile people's units (ENEMY_DEFS keys), the champion last */
  foes: string[];
  foeName: string;
  /** what those enemies carry, which the people will take off your hands */
  token: string;
  /** the room their settlement stands in */
  cell: [number, number];
}

export const RACES: Record<RaceId, Race> = {
  aerin: {
    id: 'aerin',
    realm: 'aetheria',
    name: 'the Aerin',
    ranks: ['Groundling', 'Wind-friend', 'Featherkin', 'Sky-sworn', 'Storm-crowned'],
    foes: ['gale_reaver', 'gale_gunner', 'gale_captain'],
    foeName: 'the Gale Reavers',
    token: 'storm_feather',
    cell: [0, 0],
  },
  hollowfolk: {
    id: 'hollowfolk',
    realm: 'umbra',
    name: 'the Hollowfolk',
    ranks: ['Outsider', 'Lamp-guest', 'Hollowkin', 'Lantern-bearer', 'Keeper of the Flame'],
    foes: ['gloam_zealot', 'gloam_hexer', 'gloam_hierophant'],
    foeName: 'the Gloamkin',
    token: 'gloam_sigil',
    cell: HOLLOW_CELL,
  },
  archivists: {
    id: 'archivists',
    realm: 'chronoria',
    name: 'the Archivists',
    ranks: ['Unrecorded', 'Noted', 'Catalogued', 'Chronicler', 'Keeper of Hours'],
    foes: ['sundered_blade', 'sundered_seer', 'sundered_warlord'],
    foeName: 'the Sundered',
    token: 'sundered_seal',
    cell: [0, 0],
  },
};
export const RACE_OF_REALM: Record<OtherworldId, RaceId> = {
  aetheria: 'aerin',
  umbra: 'hollowfolk',
  chronoria: 'archivists',
};
export const isRace = (id: string): id is RaceId => (RACE_IDS as string[]).includes(id);
export const raceRank = (race: RaceId, standing: number): string =>
  standing < -50 ? 'Shunned' : RACES[race].ranks[Math.max(0, repTier(standing)) as 0 | 1 | 2 | 3 | 4];

/** What raises standing with a people. */
export const STANDING = {
  /** one of their enemies brought down in their realm */
  foe: 6,
  /** their enemies' champion */
  champion: 40,
  /** any other creature of their realm */
  beast: 1,
  /** the realm's guardian */
  guardian: 80,
  /** each of their enemies' tokens turned in */
  token: 5,
};
/** Standing needed for a people's better wares: Trusted wares at tier 2, their finest at tier 3. */
export const STANDING_FOR = { known: REP_TIERS[1], trusted: REP_TIERS[2], honoured: REP_TIERS[3] };

/** Which people (if any) count `enemyKey` among their enemies. */
export function raceAgainst(enemyKey: string): RaceId | null {
  for (const r of RACE_IDS) if (RACES[r].foes.includes(enemyKey)) return r;
  return null;
}

// ───────────────────────── the people you can meet ─────────────────────────

/** Where each realm resident stands: around their settlement's room (world tiles). */
export function realmfolkSpots(seed: number): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const n of REALMFOLK) {
    const race = RACES[n.race as RaceId],
      w = race.realm;
    const room = roomOf(seed, w, race.cell[0], race.cell[1])!;
    const k = REALMFOLK.filter((m) => m.race === n.race).indexOf(n);
    const a = Math.PI * (0.25 + k * 0.5);
    out[`${n.id}.home`] = {
      x: Math.round(room.x + Math.cos(a) * 6),
      y: Math.round(room.y + Math.sin(a) * 6) + OTHERWORLDS[w].oy,
    };
  }
  return out;
}

const stock = (item: string, markup = 1.4, standing?: number): ShopStock & { standing?: number } => ({
  item,
  markup,
  ...(standing ? { standing } : {}),
});

interface FolkSpec {
  id: string;
  race: RaceId;
  name: string;
  title: string;
  bio: string;
  line: string;
  shop?: { name: string; stock: Array<ShopStock & { standing?: number }>; buys: Array<ItemKind | 'all'> };
  loves: string[];
  likes: string[];
  hates: string[];
}

const SPECS: FolkSpec[] = [
  // ── the Aerin
  {
    id: 'aerin_lysa',
    race: 'aerin',
    name: 'Lysa Windmere',
    title: 'Aerin Provisioner',
    bio: 'Trades the isles’ honey, silk and remedies, and has never once looked down.',
    line: 'Welcome to the isles, groundling. Mind the edge: the cloud is softer than it looks, and much farther down.',
    shop: {
      name: 'Windmere’s Cloud Stores',
      stock: [
        stock('aerin_honeycake', 1.5),
        stock('healing_potion', 1.3),
        stock('cloud_silk', 1.6),
        stock('skyfeather_tonic', 1.5, STANDING_FOR.known),
        stock('sky_amber', 1.6, STANDING_FOR.known),
      ],
      buys: ['forage', 'resource', 'food'],
    },
    loves: ['sky_amber', 'honey'],
    likes: ['cloud_silk', 'feather'],
    hates: ['raw_meat'],
  },
  {
    id: 'aerin_corvane',
    race: 'aerin',
    name: 'Corvane Highwing',
    title: 'Skyguard Quartermaster',
    bio: 'Keeps the Aerin skyguard armed, and pays in good coin for every Reaver feather brought back.',
    line: 'Bring me the Reavers’ feathers and the isles will remember your name. The skyguard arms its friends.',
    shop: {
      name: 'Skyguard Armoury',
      stock: [
        stock('aetherium_ingot', 1.6, STANDING_FOR.known),
        stock('storm_buckler', 1.4, STANDING_FOR.trusted),
        stock('aerin_circlet', 1.4, STANDING_FOR.trusted),
        stock('windcaller_mantle', 1.5, STANDING_FOR.honoured),
      ],
      buys: ['material', 'monster' as ItemKind],
    },
    loves: ['storm_feather', 'captains_compass'],
    likes: ['zephyr_scale', 'sentinel_gilding'],
    hates: ['slime_gel'],
  },
  {
    id: 'aerin_elder',
    race: 'aerin',
    name: 'Old Seraph',
    title: 'Elder of the Isles',
    bio: 'Remembers when the islands were one land, and the day the Phoenix first burned.',
    line: 'The Phoenix burns and is reborn, and so do we. Ring the three chimes, if you would meet it.',
    loves: ['phoenix_plume'],
    likes: ['sky_amber'],
    hates: ['storm_feather'],
  },
  // ── the Hollowfolk
  {
    id: 'hollow_mirren',
    race: 'hollowfolk',
    name: 'Mirren Lampwright',
    title: 'Hollow Lampwright',
    bio: 'Keeps every lamp in the Hollow lit, and sells light to anyone mad enough to walk out of it.',
    line: 'Light, friend? Out there it is worth more than gold. In here it is merely priceless.',
    shop: {
      name: 'Lampwright’s Lights',
      stock: [
        stock('oil_lantern', 1.3),
        stock('lantern_potion', 1.3),
        stock('glowcap_stew', 1.5),
        stock('gloamward_draught', 1.5, STANDING_FOR.known),
        stock('umbral_spore', 1.6, STANDING_FOR.known),
      ],
      buys: ['forage', 'resource', 'food'],
    },
    loves: ['umbral_spore', 'void_pearl'],
    likes: ['coal', 'glass_pane'],
    hates: ['gloam_sigil'],
  },
  {
    id: 'hollow_brannoc',
    race: 'hollowfolk',
    name: 'Brannoc Deepward',
    title: 'Lantern-Guard Captain',
    bio: 'Holds the Hollow’s gates against the Gloamkin, and burns every sigil anyone brings him.',
    line: 'Every Gloam sigil you bring me is one less prayer to the Maw. The Hollow arms its friends.',
    shop: {
      name: 'Lantern-Guard Stores',
      stock: [
        stock('umbrite_ingot', 1.6, STANDING_FOR.known),
        stock('hollow_cloak', 1.4, STANDING_FOR.trusted),
        stock('serpentscale_buckler', 1.4, STANDING_FOR.trusted),
        stock('gloamward_charm', 1.5, STANDING_FOR.honoured),
      ],
      buys: ['material', 'monster' as ItemKind],
    },
    loves: ['gloam_sigil', 'hierophant_mask'],
    likes: ['shade_pelt', 'serpent_scale'],
    hates: ['umbral_spore'],
  },
  {
    id: 'hollow_elder',
    race: 'hollowfolk',
    name: 'Mother Wick',
    title: 'Keeper of the First Flame',
    bio: 'Tends the flame the Hollow was built around. She says it is older than the dark.',
    line: 'The dark came up from the pit, child. The Maw at the bottom of it is hungry still.',
    loves: ['abyss_heart'],
    likes: ['umbral_spore'],
    hates: ['gloam_sigil'],
  },
  // ── the Archivists
  {
    id: 'archive_quill',
    race: 'archivists',
    name: 'Brother Quill',
    title: 'Archivist of Provisions',
    bio: 'Records every cup of tea he has ever brewed, in order, including the ones he has not brewed yet.',
    line: 'You are noted. Tea? I have already poured it. You will want it in a moment.',
    shop: {
      name: 'The Archive Pantry',
      stock: [
        stock('chrono_tea', 1.5),
        stock('healing_potion', 1.3),
        stock('chrono_sand', 1.6),
        stock('rewind_elixir', 1.5, STANDING_FOR.known),
        stock('paradox_brew', 1.5, STANDING_FOR.known),
      ],
      buys: ['forage', 'resource', 'food'],
    },
    loves: ['chrono_sand', 'temporal_crystal'],
    likes: ['echo_shard', 'paper'],
    hates: ['sundered_seal'],
  },
  {
    id: 'archive_halden',
    race: 'archivists',
    name: 'Warden Halden',
    title: 'Keeper of the Sealed Hours',
    bio: 'Guards the Archive against the Sundered, and files every broken seal as proof they can be stopped.',
    line: 'Each Sundered seal returned is a moment saved. The Archive arms those who save them.',
    shop: {
      name: 'Hall of Sealed Hours',
      stock: [
        stock('chronium_ingot', 1.6, STANDING_FOR.known),
        stock('archivist_lenses', 1.4, STANDING_FOR.trusted),
        stock('clockwork_belt', 1.4, STANDING_FOR.trusted),
        stock('paradox_aegis', 1.5, STANDING_FOR.honoured),
      ],
      buys: ['material', 'monster' as ItemKind],
    },
    loves: ['sundered_seal', 'warlord_sigil'],
    likes: ['clockwork_spring', 'echo_shard'],
    hates: ['chrono_sand'],
  },
  {
    id: 'archive_prime',
    race: 'archivists',
    name: 'The Prime Archivist',
    title: 'Keeper of Hours',
    bio: 'Has read the last page of the Archive. Will not say what it says.',
    line: 'The Unwound was once the clock this city kept. Now it keeps nothing, and everything.',
    loves: ['unwound_gear'],
    likes: ['temporal_crystal'],
    hates: ['sundered_seal'],
  },
];

const always = (spot: string, doing: string): ScheduleBlock[] => [{ h0: 0, h1: 24, spot, doing }];

/** The realm residents as village NPCs (registered in revision-6 worlds). */
export const REALMFOLK: NpcDef[] = SPECS.map((m, i): NpcDef => {
  const first = m.name.split(' ')[0]!;
  return {
    id: m.id,
    name: m.name,
    title: m.title,
    bio: m.bio,
    look: i % 8,
    race: m.race,
    home: `${m.id}.home`,
    schedule: always(`${m.id}.home`, m.shop ? 'keeping shop' : 'keeping watch'),
    loves: m.loves,
    likes: m.likes,
    hates: m.hates,
    ...(m.shop
      ? {
          shop: {
            name: m.shop.name,
            hours: [0, 24] as [number, number],
            buyBonus: 1.1,
            buys: m.shop.buys,
            stock: m.shop.stock,
          },
        }
      : {}),
    lines: {
      greet: [
        [m.line, `${first}, of ${RACES[m.race].name}. Travellers are rare here. Welcome ones rarer.`],
        [`Back again. ${RACES[m.race].name.replace(/^the /, 'The ')} have started to speak of you.`],
        [`There you are. You are one of us now, near enough.`],
      ],
      work: ['Every day here is the same day, and never the same.', `Have you met ${RACES[m.race].foeName}? Do not.`],
      season: [['The seasons do not reach us here.'], ['No summer here.'], ['No autumn here.'], ['No winter here.']],
      rain: ['Rain? Not here.'],
      snow: ['Snow? Not here.'],
      night: ['We do not sleep much here.'],
      gift: {
        love: [`For me? ${first} will remember this.`],
        like: ['A kind thought. Thank you.'],
        neutral: ['Thank you.'],
        hate: ['Please take that away.'],
        again: ['One gift a day is plenty.'],
      },
    },
  };
});
