import { hash2 } from './rng';
import { KINGDOMS, type KingdomDef, type Person } from './kingdoms';
import { ITEMS } from './items';
import { catalogShopStock } from './catalog';
import { REALM_IDS, REALM_SITES, type RealmId, type RealmSite } from './realms';
import type { NpcDef, ScheduleBlock } from './npcs';

/**
 * The people of the six kingdoms (world revision 5): a ruler and court in each capital, and for every settlement plot
 * a roster of guards, merchants, innkeepers, smiths, healers, elders and farmers. Generated deterministically from the
 * kingdom definitions, so ids are stable. They are not part of `NPCS`; the village system adds them at revision 5.
 */
export type Role =
  | 'ruler'
  | 'court'
  | 'commander'
  | 'guard'
  | 'archer'
  | 'innkeeper'
  | 'smith'
  | 'merchant'
  | 'herbalist'
  | 'scholar'
  | 'elder'
  | 'farmer'
  | 'hand'
  | 'soldier';
export type Place =
  | 'palace'
  | 'barracks'
  | 'inn'
  | 'store'
  | 'smithy'
  | 'herbalist'
  | 'library'
  | 'hall'
  | 'farmhouse'
  | 'house'
  | 'gate';

export interface ResidentPlan {
  id: string;
  realm: RealmId;
  site: RealmSite;
  role: Role;
  place: Place;
  name: string;
  title: string;
  person?: Person;
  /** index within the site, for deterministic variation */
  n: number;
}

const TITLES: Record<RealmId, Partial<Record<Role, string>>> = {
  aurelion: {
    commander: 'Captain of the Gate',
    guard: 'Shield-Pike',
    archer: 'Longbow Warden',
    innkeeper: 'Innkeeper',
    smith: 'Armourer',
    merchant: 'Grain Factor',
    herbalist: 'Apothecary',
    scholar: 'Chaplain',
    elder: 'Reeve',
    farmer: 'Tenant Farmer',
    hand: 'Farmhand',
    soldier: 'Man-at-Arms',
  },
  sylvaris: {
    commander: 'Warden-Captain',
    guard: 'Forest Guardian',
    archer: 'Thornbow',
    innkeeper: 'Tea-Keeper',
    smith: 'Wood-Shaper',
    merchant: 'Herb Trader',
    herbalist: 'Grove Healer',
    scholar: 'Lantern-Speaker',
    elder: 'Groveward',
    farmer: 'Orchard Tender',
    hand: 'Seed-Carrier',
    soldier: 'Spirit Scout',
  },
  khardum: {
    commander: 'Hold-Captain',
    guard: 'Ironguard',
    archer: 'Crossbow Sapper',
    innkeeper: 'Brewmaster',
    smith: 'Forge-Brother',
    merchant: 'Ledger-Factor',
    herbalist: 'Mushroom Medic',
    scholar: 'Runekeeper',
    elder: 'Clan-Elder',
    farmer: 'Terrace Farmer',
    hand: 'Goat-Herder',
    soldier: 'Axe-Brother',
  },
  raijin: {
    commander: 'Taisho',
    guard: 'Ashigaru',
    archer: 'Yumi Archer',
    innkeeper: 'Teahouse Keeper',
    smith: 'Swordsmith',
    merchant: 'Silk Merchant',
    herbalist: 'Herbalist',
    scholar: 'Shrine Keeper',
    elder: 'Village Headman',
    farmer: 'Rice Farmer',
    hand: 'Paddy Hand',
    soldier: 'Foot Retainer',
  },
  thalassara: {
    commander: 'Port Captain',
    guard: 'Sea Knight',
    archer: 'Harpooner',
    innkeeper: 'Tavern-Singer',
    smith: 'Shipwright',
    merchant: 'Spice Trader',
    herbalist: 'Reef Healer',
    scholar: 'Tide-Reader',
    elder: 'Quay-Elder',
    farmer: 'Kelp Farmer',
    hand: 'Net-Hand',
    soldier: 'Deckhand',
  },
  nethrakar: {
    commander: 'Ashen Captain',
    guard: 'Demon Knight',
    archer: 'Ember Gunner',
    innkeeper: 'Hearth-Host',
    smith: 'Fire-Wright',
    merchant: 'Pact-Broker',
    herbalist: 'Ash Healer',
    scholar: 'Shadow Scribe',
    elder: 'House-Elder',
    farmer: 'Fireblossom Grower',
    hand: 'Ash Hand',
    soldier: 'Ogre Guard',
  },
};

const ROSTER: Record<RealmSite['kind'], Array<[Role, Place, number]>> = {
  capital: [
    ['commander', 'barracks', 1],
    ['guard', 'gate', 6],
    ['archer', 'gate', 3],
    ['innkeeper', 'inn', 1],
    ['smith', 'smithy', 1],
    ['merchant', 'store', 1],
    ['herbalist', 'herbalist', 1],
    ['scholar', 'library', 1],
  ],
  town: [
    ['elder', 'hall', 1],
    ['guard', 'gate', 3],
    ['innkeeper', 'inn', 1],
    ['smith', 'smithy', 1],
    ['merchant', 'store', 1],
    ['herbalist', 'herbalist', 1],
  ],
  village: [
    ['elder', 'house', 1],
    ['merchant', 'store', 1],
    ['farmer', 'farmhouse', 1],
  ],
  farm: [
    ['farmer', 'farmhouse', 1],
    ['hand', 'farmhouse', 1],
  ],
  outpost: [
    ['commander', 'barracks', 1],
    ['soldier', 'gate', 5],
  ],
};

const pick = <T>(a: T[], seed: number, x: number, y: number, salt: number): T =>
  a[Math.floor(hash2(seed, x, y, salt) * a.length) % a.length]!;

/** The residents planned for one settlement plot. Rulers and courts live in the capital's palace. */
export function residentsOfSite(site: RealmSite): ResidentPlan[] {
  const def = KINGDOMS[site.realm];
  const out: ResidentPlan[] = [];
  const idx = REALM_SITES.indexOf(site);
  let n = 0;
  const nameFor = (k: number) =>
    `${pick(def.names.first, idx + 1, k, 1, 7100)} ${pick(def.names.last, idx + 1, k, 2, 7101)}`;
  if (site.kind === 'capital') {
    out.push({
      id: `${site.realm}_${def.ruler.id}`,
      realm: site.realm,
      site,
      role: 'ruler',
      place: 'palace',
      name: def.ruler.name,
      title: def.ruler.title,
      person: def.ruler,
      n: n++,
    });
    for (const p of def.court)
      out.push({
        id: `${site.realm}_${p.id}`,
        realm: site.realm,
        site,
        role: 'court',
        place: 'palace',
        name: p.name,
        title: p.title,
        person: p,
        n: n++,
      });
  }
  for (const [role, place, count] of ROSTER[site.kind])
    for (let i = 0; i < count; i++) {
      out.push({
        id: `${site.id}_${role}${count > 1 ? i : ''}`,
        realm: site.realm,
        site,
        role,
        place,
        name: nameFor(n),
        title: TITLES[site.realm][role] ?? role,
        n: n++,
      });
    }
  return out;
}

// ───────────────────────── defs ─────────────────────────

const B = (h0: number, h1: number, spot: string, doing: string): ScheduleBlock => ({ h0, h1, spot, doing });
const DISHES: Record<RealmId, [string, string]> = {
  aurelion: ['knights_pie', 'honey_cake'],
  sylvaris: ['glowcap_broth', 'hazel_loaf'],
  khardum: ['forge_stew', 'cave_bread'],
  raijin: ['cherry_mochi', 'thunder_noodles'],
  thalassara: ['reef_ceviche', 'crab_chowder'],
  nethrakar: ['ember_stew', 'cinder_cake'],
};
export const realmDishes = (r: RealmId): [string, string] => DISHES[r];
const valid = (ids: string[]) => ids.filter((i) => !!ITEMS[i]);

function scheduleFor(p: ResidentPlan): ScheduleBlock[] {
  const id = p.id,
    work =
      p.role === 'guard' || p.role === 'archer'
        ? 'standing watch at the gate'
        : p.role === 'soldier'
          ? 'drilling at the post'
          : `working as ${p.title.toLowerCase()}`;
  if (p.role === 'guard' || p.role === 'archer' || p.role === 'soldier')
    return [
      B(0, 6, `${id}.home`, 'asleep in the barracks'),
      B(6, 14, `${id}.gate`, work),
      B(14, 18, `${id}.wall`, 'patrolling the walls'),
      B(18, 22, `${id}.square`, 'off duty in the square'),
      B(22, 24, `${id}.home`, 'asleep in the barracks'),
    ];
  if (p.role === 'ruler')
    return [
      B(0, 7, `${id}.home`, 'asleep'),
      B(7, 9, `${id}.work`, 'taking breakfast in the palace'),
      B(9, 15, `${id}.throne`, 'holding court'),
      B(15, 18, `${id}.square`, 'walking among the people'),
      B(18, 22, `${id}.work`, 'dining with the court'),
      B(22, 24, `${id}.home`, 'asleep'),
    ];
  return [
    B(0, 7, `${id}.home`, 'asleep'),
    B(7, 9, `${id}.square`, 'greeting the morning'),
    B(9, 18, `${id}.work`, work),
    B(18, 21, `${id}.square`, 'sharing the evening news'),
    B(21, 24, `${id}.home`, 'asleep'),
  ];
}

const SHOP_ROLE_OF: Partial<Record<Role, string>> = {
  merchant: 'merchant',
  innkeeper: 'inn',
  smith: 'smith',
  herbalist: 'herbalist',
  farmer: 'farm',
  scholar: 'scholar',
};
function shopFor(p: ResidentPlan, def: KingdomDef): NpcDef['shop'] | undefined {
  const shop = baseShopFor(p, def);
  const role = SHOP_ROLE_OF[p.role];
  if (!shop || !role) return shop;
  const have = new Set(shop.stock.map((s) => s.item));
  return { ...shop, stock: [...shop.stock, ...catalogShopStock(role, p.realm).filter((s) => !have.has(s.item))] };
}

function baseShopFor(p: ResidentPlan, def: KingdomDef): NpcDef['shop'] | undefined {
  const [d1, d2] = DISHES[p.realm];
  const mk = (items: string[], markup: number) => valid(items).map((item) => ({ item, markup }));
  switch (p.role) {
    case 'merchant':
      return {
        name: `${p.name.split(' ')[0]}'s ${def.name} Goods`,
        hours: [8, 20],
        buyBonus: 1.1,
        buys: ['all'],
        stock: mk([...def.economy.exports, 'hay'], 1.3),
      };
    case 'innkeeper':
      return {
        name: `The ${def.name} Table`,
        hours: [6, 23],
        buyBonus: 1,
        buys: ['food', 'fish', 'forage'],
        stock: mk([d1, d2, 'roast_potato', 'veggie_stew', 'healing_potion'], 1.35),
      };
    case 'smith':
      return {
        name: `${p.title}'s Works`,
        hours: [8, 19],
        buyBonus: 1.15,
        buys: ['resource'],
        stock: mk(['pickaxe', 'axe', 'hoe', 'sword', 'iron_ingot', 'copper_ingot', 'coal'], 1.3),
      };
    case 'herbalist':
      return {
        name: `${p.name.split(' ')[0]}'s Remedies`,
        hours: [8, 19],
        buyBonus: 1.1,
        buys: ['forage', 'potion'],
        stock: mk(
          [
            'healing_potion',
            'bandage',
            'antidote',
            'burn_salve',
            'warming_tonic',
            'cooling_tonic',
            'regen_potion',
            'willow_tea',
            'charcoal_draught',
            'ague_tonic',
          ],
          1.3,
        ),
      };
    default:
      return undefined;
  }
}

function linesFor(p: ResidentPlan, def: KingdomDef, shopName: string | undefined): NpcDef['lines'] {
  const first = p.name.split(' ')[0]!;
  const person = p.person;
  const ruler = p.role === 'ruler';
  const greet0 = ruler
    ? [`${def.name} welcomes you. ${person!.trait}`, `You stand before ${p.name}, ${p.title}. Speak plainly.`]
    : person
      ? [`I am ${p.name}, ${p.title}. ${person.trait}`]
      : [`${first}, ${p.title.toLowerCase()} of ${def.capital === p.site.id ? def.capital : def.name}. ${def.motto}`];
  const tradition = def.traditions[p.n % def.traditions.length]!;
  const likes = DISHES[p.realm];
  return {
    greet: [
      greet0,
      person ? [`Ah, ${first === 'Pip' ? 'friend' : 'traveller'}. ${person.agenda}`] : [`Back again. ${tradition}`],
      [
        person
          ? `You have earned my trust. ${person.agenda}`
          : `You are one of ours now, ${'friend'}. Sit, and ${shopName ? 'browse' : 'rest'}.`,
      ],
    ],
    work: [`${def.motto}`, tradition, `${def.economy.trade}`],
    season: [
      [`Spring in ${def.name}: ${def.climate.split('.')[0]!.toLowerCase()}.`],
      [`Summer brings the festival crowds to ${def.name}.`],
      [`Autumn is for harvests, oaths and long evenings in ${def.name}.`],
      [`Winter keeps us indoors and honest.`],
    ],
    rain: [`The rain suits ${def.name} well enough.`],
    snow: [`Snow in ${def.name}: ${def.climate.includes('cold') ? 'we are used to it.' : 'a rare treat.'}`],
    night: [`Quiet night. ${def.motto}`],
    gift: {
      love: [`${ITEMS[likes[0]]?.name ?? 'This'}! You know our tastes, friend.`],
      like: [`A kind gift. ${def.name} remembers.`],
      neutral: ['Thank you. I will find a use for it.'],
      hate: ['I will pretend I did not see that.'],
      again: ['One gift is plenty for today.'],
    },
  };
}

function build(p: ResidentPlan): NpcDef {
  const def = KINGDOMS[p.realm];
  const shop = shopFor(p, def);
  const [d1, d2] = DISHES[p.realm];
  const person = p.person;
  const bio = person
    ? `${person.trait} ${person.agenda}`
    : `${p.title} of ${p.site.kind === 'capital' ? def.capital : (def.names.towns[p.site.ring as 'n'] ?? def.name)}, living by the old custom: ${def.traditions[p.n % def.traditions.length]!}`;
  return {
    id: p.id,
    name: p.name,
    title: p.title,
    bio,
    look: person ? person.look : (p.n + 3) % 8,
    home: `${p.id}.home`,
    settlement: p.site.id,
    realm: p.realm,
    role: p.role,
    site: p.site.id,
    schedule: scheduleFor(p),
    loves: valid([d1, p.n % 2 ? d2 : d1, def.economy.exports[p.n % def.economy.exports.length]!]),
    likes: valid([d2, 'healing_herb', ...def.economy.exports.slice(0, 2)]),
    hates: valid(['slime_gel', 'raw_meat']),
    shop,
    lines: linesFor(p, def, shop?.name),
  };
}

let cached: NpcDef[] | null = null;
/** Every kingdom resident (about 360), built once. */
export function realmNpcs(): NpcDef[] {
  if (!cached) cached = REALM_SITES.flatMap((s) => residentsOfSite(s)).map(build);
  return cached;
}
export const REALM_NPC_COUNT = REALM_IDS.length;
