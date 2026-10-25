import { DAYS_PER_SEASON } from './constants';
import type { RealmId } from './realms';

/**
 * Content of the six great kingdoms (world revision 5): history, rulers and courts, armies, culture, cuisine,
 * festivals, economies and diplomacy. Pure data plus a few pure rules (reputation tiers, the diplomatic calendar,
 * festival days). Settlement geometry lives in realms.ts, the people in realm-npcs.ts.
 *
 * Design touchstones: Skyrim's holds and civil politics, Mount & Blade's courts and tournaments, Civilization's
 * leaders with agendas, Dwarf Fortress' grudges, Zelda's regional cultures, Ghost of Tsushima's honour codes,
 * Stardew's festival calendar, Sea of Thieves' sea lanes and The Witcher's morally grey neighbours.
 */

export interface Person {
  id: string;
  name: string;
  title: string;
  /** one line of personality */
  trait: string;
  /** what they want, which drives their dialogue and quests */
  agenda: string;
  /** look index into the NPC outfit table */
  look: number;
}
export interface Unit {
  id: string;
  name: string;
  role: 'infantry' | 'cavalry' | 'ranged' | 'elite' | 'mage' | 'siege' | 'mythical';
  desc: string;
}
export interface Festival {
  id: string;
  name: string;
  /** 0 spring .. 3 winter, day within the season (1..7) */
  season: number;
  day: number;
  desc: string;
  /** dish and item the festival feasts on */
  feast: string;
}
export type KingdomStance = 'allied' | 'friendly' | 'neutral' | 'rival' | 'hostile';

export interface KingdomDef {
  id: RealmId;
  name: string;
  epithet: string;
  motto: string;
  government: string;
  capital: string;
  /** banner colours (palette names) */
  banner: { field: string; charge: string; emblem: string };
  /** building style index for the client (4..9) */
  style: number;
  climate: string;
  history: string;
  culture: string;
  architecture: string;
  traditions: string[];
  cuisine: string;
  ruler: Person;
  court: Person[];
  units: Unit[];
  economy: { exports: string[]; imports: string[]; trade: string };
  festivals: Festival[];
  /** five reputation titles from stranger to champion */
  ranks: [string, string, string, string, string];
  names: {
    towns: Record<'n' | 'e' | 's' | 'w', string>;
    villages: Record<'n' | 'e' | 's' | 'w', string>;
    seaward: Record<'n' | 'e' | 's' | 'w', string>;
    first: string[];
    last: string[];
  };
}

export const KINGDOMS: Record<RealmId, KingdomDef> = {
  aurelion: {
    id: 'aurelion',
    name: 'Aurelion',
    epithet: 'The Golden Kingdom',
    motto: 'Honour is the only crown that does not tarnish.',
    government:
      'An elective-hereditary monarchy: the crown passes by blood, but the Court of Lances must ratify each heir.',
    capital: 'Goldspire',
    banner: { field: 'e5', charge: 'w3', emblem: 'lance' },
    style: 4,
    climate: 'Temperate and fertile. Rolling wheat plains, orchard country, long golden summers and mild winters.',
    history:
      'Aurelion rose from the Granary Wars, when seven rival barons were shamed into one banner by a famine they had caused. Queen Isolde’s great-grandmother crowned herself in a wheat field and swore that no Aurelian would hunger while a lord feasted. The oath is carved over every cathedral door and, rumour says, quietly resented by every baron since.',
    culture:
      'A culture of vows, tournaments and ledgers. Every knight keeps a written oath; every farmer a written lease. Quarrels are settled by trial of arms or by the Chancellery’s long, patient forms, and nobody agrees which is crueller.',
    architecture:
      'Honey-coloured stone with blue-slate roofs, gilded finials on every spire, cathedral-high halls and heraldic banners hung from every balcony. Towns are walled in tiers, with a keep at the top.',
    traditions: [
      'Every child plants a sapling on their naming day; the orchard of Goldspire is older than its walls.',
      'Oaths are sworn on bread and salt, and a broken oath is "spoiled" rather than "broken".',
      'The first sheaf of every harvest goes to the Granary of Mercy, free to any hungry traveller.',
    ],
    cuisine:
      'Honey cakes, knight’s pie with wild herbs, roast goose at feasts, cider from the orchard country. Bread comes first at every table.',
    ruler: {
      id: 'isolde',
      name: 'Queen Isolde Valmarch',
      title: 'The Gilded Queen',
      trait: 'Theatrical, shrewd, generous in public and exacting in private.',
      agenda:
        'She wants an heir the Court of Lances will ratify, and a tournament so magnificent that the barons forget to plot.',
      look: 4,
    },
    court: [
      {
        id: 'edmund',
        name: 'Lord Chancellor Edmund Hale',
        title: 'Keeper of the Great Seal',
        trait: 'Courteous, bloodless and always three clauses ahead of you.',
        agenda: 'Quietly steering the crown toward tariffs on Khar-Dum iron, and away from Nethrakar’s old war.',
        look: 2,
      },
      {
        id: 'brienne',
        name: 'Dame Brienne Aldoran',
        title: 'Marshal of the Gilded Lance',
        trait: 'Blunt, loyal, allergic to ceremony.',
        agenda: 'Wants the border outposts reinforced before the tournament draws every knight to the capital.',
        look: 6,
      },
      {
        id: 'anselm',
        name: 'Father Anselm Wren',
        title: 'High Chaplain of the Sun Hall',
        trait: 'Gentle, patient, unexpectedly funny.',
        agenda: 'Believes the Granary of Mercy is the kingdom’s real strength and wants it protected from the barons.',
        look: 1,
      },
      {
        id: 'pip',
        name: 'Pip Merriweather',
        title: 'Royal Jester',
        trait: 'Says out loud what the court only thinks.',
        agenda: 'Knows who is poisoning the Queen’s wine and cannot work out how to say so as a joke.',
        look: 7,
      },
    ],
    units: [
      {
        id: 'knight',
        name: 'Knights of the Gilded Lance',
        role: 'elite',
        desc: 'Plate and lance; oath-bound, vain and very good.',
      },
      {
        id: 'pikeman',
        name: 'Shield-Pikes',
        role: 'infantry',
        desc: 'Disciplined pike lines who hold gates and bridges.',
      },
      { id: 'lancer', name: 'Charger Lancers', role: 'cavalry', desc: 'Heavy horse that breaks any line it meets.' },
      { id: 'archer', name: 'Longbow Wardens', role: 'ranged', desc: 'Yeoman archers from the orchard country.' },
      {
        id: 'royalguard',
        name: 'The Royal Guard',
        role: 'elite',
        desc: 'Gold-cloaked bodyguards who never leave the Queen.',
      },
      {
        id: 'griffin',
        name: 'Griffin Riders',
        role: 'mythical',
        desc: 'Sky-knights who bonded with wild griffins on the Sunreach cliffs.',
      },
    ],
    economy: {
      exports: ['milk', 'egg', 'melon', 'corn', 'hay', 'cloth'],
      imports: ['iron_ingot', 'silver_ingot', 'plank', 'coal'],
      trade:
        'The breadbasket of the continent: grain, wool, honey and cloth, sold up the royal roads and across the sea for iron and silver.',
    },
    festivals: [
      {
        id: 'tourney',
        name: 'Tournament of the Golden Lance',
        season: 1,
        day: 4,
        desc: 'Three days of jousting, archery and feasting; the realm’s greatest knights fight for the Queen’s favour.',
        feast: 'knights_pie',
      },
      {
        id: 'harvest',
        name: 'Harvest Crown',
        season: 2,
        day: 6,
        desc: 'The first sheaf is crowned and carried through every town to the Granary of Mercy.',
        feast: 'honey_cake',
      },
    ],
    ranks: ['Stranger', 'Guest of the Crown', 'Squire', 'Knight-Companion', 'Champion of Aurelion'],
    names: {
      towns: { n: 'Harrowgate', e: 'Larkmere', s: 'Brightwater', w: 'Stagford' },
      villages: { n: 'Applecross', e: 'Wheatley', s: 'Millbrook', w: 'Hollin' },
      seaward: { n: 'Grainwatch', e: 'Cliffhold Post', s: 'Bramblefold', w: 'Lancer’s Rest' },
      first: [
        'Alden',
        'Beatrix',
        'Cedric',
        'Dorothea',
        'Edric',
        'Fenella',
        'Godric',
        'Hilda',
        'Ivo',
        'Joan',
        'Lorcan',
        'Maud',
        'Osric',
        'Petra',
        'Ranulf',
        'Sibyl',
        'Tobias',
        'Ursula',
        'Wystan',
        'Yvaine',
      ],
      last: [
        'Ashdown',
        'Barleycorn',
        'Carter',
        'Dunmore',
        'Everard',
        'Fairweather',
        'Goodwin',
        'Haywood',
        'Ironsides',
        'Kettering',
        'Lovell',
        'Marchbank',
        'Northcote',
        'Oakes',
        'Pennywhistle',
        'Rooke',
        'Stanhope',
        'Thatcher',
        'Underhill',
        'Wheeler',
      ],
    },
  },

  sylvaris: {
    id: 'sylvaris',
    name: 'Sylvaris',
    epithet: 'The Verdant Kingdom',
    motto: 'The wood remembers.',
    government:
      'A druidic regency: the Greenmother rules for as long as the Heartroot accepts her, and the spirits of the wood have a vote.',
    capital: 'Heartroot',
    banner: { field: 'g3', charge: 'e6', emblem: 'tree' },
    style: 5,
    climate: 'Humid and green. Ancient forests, mirror-still lakes, hanging mist and fireflies from spring to autumn.',
    history:
      'Sylvaris was never founded: it grew. The first elves woke in the hollow of a tree older than the sea, and the tree has been teaching them ever since. Their one great war was against the logging barons of the east, ended when the forest itself walked to the border. Aurelion’s treaty with the wood is the only treaty the trees have ever signed.',
    culture:
      'Slow, ritual and deeply musical. Decisions wait for a full moon and a rainfall; arguments are sung. The dead are planted, not buried, and every grove is named for someone loved.',
    architecture:
      'Living tree-halls shaped over centuries, rope bridges between canopy villages, lantern-hung boardwalks, roofs of moss and shingled bark. Nothing is built that a tree has not agreed to.',
    traditions: [
      'Spirit-lanterns are floated on the lakes for the dead; a lantern that sinks is a message.',
      'Guests are offered tea before names. A guest who refuses is assumed to have bad news.',
      'Felling a tree requires an apology and a replanting, witnessed by a druid.',
    ],
    cuisine:
      'Glowcap broth, hazelnut loaf, wild-honey flatbread, moonpetal tea. Meat is rare and always eaten with thanks.',
    ruler: {
      id: 'ysolde',
      name: 'The Greenmother Ysolde Mossbloom',
      title: 'Warden of the Wyld',
      trait: 'Ancient, patient, unnervingly kind; her anger arrives like weather.',
      agenda:
        'The Heartroot is ailing, and she will not say so. She needs outsiders who can do what a proud kingdom cannot ask its own children to do.',
      look: 3,
    },
    court: [
      {
        id: 'thalion',
        name: 'Ranger-General Thalion Swiftbough',
        title: 'Captain of the Thornbows',
        trait: 'Laconic, dry, never seen to hurry.',
        agenda:
          'Thinks Khar-Dum’s deep mines are poisoning the eastern streams and wants proof before the Greenmother forgives it.',
        look: 6,
      },
      {
        id: 'wren',
        name: 'Spiritspeaker Wren Fernhollow',
        title: 'Voice of the Lanterns',
        trait: 'Dreamy, precise about the dead, vague about the living.',
        agenda: 'Hears the Heartroot’s dreams and has started to dread them.',
        look: 1,
      },
      {
        id: 'feyra',
        name: 'Loremaster Feyra Ashgrove',
        title: 'Keeper of the Rings',
        trait: 'Reads trees like ledgers and treats everyone like a pupil.',
        agenda: 'Counting the Heartroot’s rings to prove a theory no one wants to hear.',
        look: 5,
      },
    ],
    units: [
      {
        id: 'thornbow',
        name: 'Thornbow Archers',
        role: 'ranged',
        desc: 'Elven archers who shoot from the canopy and are rarely seen.',
      },
      {
        id: 'warden',
        name: 'Forest Guardians',
        role: 'infantry',
        desc: 'Bark-armoured wardens who fight shoulder to shoulder with treants.',
      },
      {
        id: 'spiritrider',
        name: 'Spirit Cavalry',
        role: 'cavalry',
        desc: 'Riders of pale spirit stags that cross a lake without wetting a hoof.',
      },
      {
        id: 'druid',
        name: 'Druids of the Rings',
        role: 'mage',
        desc: 'Weather-callers who can turn a clearing into a thicket.',
      },
      {
        id: 'beastkin',
        name: 'Woodland Kin',
        role: 'elite',
        desc: 'Bears, owls and stags who fight when the wood is threatened.',
      },
      {
        id: 'stag',
        name: 'The Antlered Spirits',
        role: 'mythical',
        desc: 'Glowing stag-spirits that walk the old paths at dusk.',
      },
    ],
    economy: {
      exports: ['plank', 'wood', 'hazelnut', 'mushroom', 'healing_herb', 'blueberry'],
      imports: ['iron_ingot', 'copper_ingot', 'cloth', 'silver_ingot'],
      trade:
        'Timber (felled only by apology), herbs, tea and fungus; sold for tools and metal, which the forest does not make.',
    },
    festivals: [
      {
        id: 'dawnbloom',
        name: 'Dawnbloom',
        season: 0,
        day: 2,
        desc: 'Every grove blossoms at once and the whole realm sings from dawn to noon.',
        feast: 'glowcap_broth',
      },
      {
        id: 'lanterns',
        name: 'Night of Lanterns',
        season: 2,
        day: 5,
        desc: 'Spirit-lanterns drift over the lakes for those who have passed into the wood.',
        feast: 'hazel_loaf',
      },
    ],
    ranks: ['Stranger', 'Guest of the Grove', 'Friend of the Wood', 'Kin of the Rings', 'Voice of the Heartroot'],
    names: {
      towns: { n: 'Mossgate', e: 'Silverbough', s: 'Lanternwick', w: 'Dewfall' },
      villages: { n: 'Fernmere', e: 'Owlroost', s: 'Willowbend', w: 'Thistledown' },
      seaward: { n: 'Mistwatch', e: 'Tanglewood Farm', s: 'Rootbridge Post', w: 'Berrydell' },
      first: [
        'Aeris',
        'Belen',
        'Caelen',
        'Daeris',
        'Elwin',
        'Faelan',
        'Galen',
        'Hesper',
        'Ilaria',
        'Jorin',
        'Kaelith',
        'Lirael',
        'Myrren',
        'Nyssa',
        'Orlen',
        'Perrin',
        'Quilla',
        'Rowan',
        'Sylas',
        'Tamsin',
      ],
      last: [
        'Amberleaf',
        'Brightbark',
        'Cloudfern',
        'Dewdrop',
        'Evenshade',
        'Fawnstep',
        'Greenwhisper',
        'Hollowtree',
        'Ivywind',
        'Juniper',
        'Larkspur',
        'Mossfoot',
        'Nightbloom',
        'Oakenshield',
        'Petalfall',
        'Quickwater',
        'Reedsong',
        'Starling',
        'Thornwood',
        'Willowmere',
      ],
    },
  },

  khardum: {
    id: 'khardum',
    name: 'Khar-Dum',
    epithet: 'The Iron Kingdom',
    motto: 'What is forged in fire is owed in full.',
    government:
      'A moot of clan-kings under a High King, who rules by the Grudgebook: every debt and insult since the founding, written in stone.',
    capital: 'Anvilhold',
    banner: { field: 'r1', charge: 'e5', emblem: 'anvil' },
    style: 6,
    climate:
      'Cold, high and windswept. Snowfields, terraced mountainsides, geothermal valleys and endless winter in the peaks.',
    history:
      'Khar-Dum is a mountain that decided to become a nation. The first clans dug in during the Long Winter and found veins of iron so pure they rang. They have been hammering ever since. Their one unforgivable shame, the Collapse of Deepgate, is the reason no dwarf will build a bridge without a second bridge beneath it.',
    culture:
      'Obsessive about craft, debt and memory. A dwarf’s word is a contract; a dwarf’s grudge is an heirloom. Humour is dry, beer is strong, and honesty is considered a basic courtesy.',
    architecture:
      'Terraced fortress-cities of dark stone and iron, enormous gates with mechanical locks, forge-chimneys venting steam, and hidden stairways down into the underground city.',
    traditions: [
      'A maker stamps every piece with a rune; selling a flawed piece under your rune is the worst crime in the kingdom.',
      'Debts are inherited and ceremonially read aloud at every Moot.',
      'The Forge of Ages is never allowed to go out. Its keepers are the most honoured clan.',
    ],
    cuisine:
      'Forge-fire stew, cave-cheese bread, smoked mountain goat, hearty stout. Food is plain, hot and plentiful.',
    ruler: {
      id: 'brokk',
      name: 'High King Brokk Ironvein',
      title: 'Keeper of the Grudgebook',
      trait: 'Stubborn, scrupulously fair, and capable of holding a grudge through three funerals.',
      agenda:
        'He wants the Deepgate debt finally paid, and a smith worthy of the unfinished Great Gate, and he trusts no one with either.',
      look: 6,
    },
    court: [
      {
        id: 'dagna',
        name: 'Forgemaster Dagna Coalbeard',
        title: 'Warden of the Forge of Ages',
        trait: 'Loud, warm and exacting; will hug you and then fail your blade.',
        agenda: 'Wants to teach one outsider the old forging, and has not yet found one patient enough.',
        look: 2,
      },
      {
        id: 'thorgrim',
        name: 'Runesmith Thorgrim Stoneward',
        title: 'Master of Runes',
        trait: 'Quiet, brooding, brilliant.',
        agenda: 'The runes on the Great Gate are failing and he suspects sabotage.',
        look: 0,
      },
      {
        id: 'bofri',
        name: 'Siege-Engineer Bofri Gearwright',
        title: 'Master of Engines',
        trait: 'Talks with his hands, usually in the middle of a controlled explosion.',
        agenda: 'Needs qubit crystals for a gate-engine that opens by resonance rather than rope.',
        look: 5,
      },
    ],
    units: [
      {
        id: 'ironguard',
        name: 'Ironguard',
        role: 'infantry',
        desc: 'Heavy infantry in full plate who never retreat and rarely speak.',
      },
      {
        id: 'runewarrior',
        name: 'Runic Warriors',
        role: 'elite',
        desc: 'Dwarves whose armour is carved with living runes.',
      },
      {
        id: 'engineer',
        name: 'Siege Engineers',
        role: 'siege',
        desc: 'Crossbow-wagons, ballistae and mechanical rams.',
      },
      {
        id: 'ramrider',
        name: 'Mountain Ram Riders',
        role: 'cavalry',
        desc: 'Armoured goats that charge uphill into anything.',
      },
      { id: 'thane', name: 'Thanes of the Moot', role: 'elite', desc: 'Veteran clan-lords with grudges to settle.' },
      {
        id: 'golem',
        name: 'Anvil Golems',
        role: 'mythical',
        desc: 'Ancient constructs of iron and runes, woken only by the High King’s horn.',
      },
    ],
    economy: {
      exports: ['iron_ingot', 'copper_ingot', 'silver_ingot', 'coal', 'stone'],
      imports: ['milk', 'egg', 'cloth', 'melon', 'healing_herb'],
      trade:
        'Metal, tools, weapons and mechanisms in exchange for the food and cloth the mountains cannot grow. Their ledgers are said to be perfect.',
    },
    festivals: [
      {
        id: 'firstflame',
        name: 'Day of the First Flame',
        season: 3,
        day: 1,
        desc: 'The Forge of Ages is relit from a single coal. Smiths exchange gifts, grudges are read, and a few are forgiven.',
        feast: 'forge_stew',
      },
      {
        id: 'moot',
        name: 'The Great Moot',
        season: 2,
        day: 3,
        desc: 'Every clan-king gathers at Anvilhold to settle debts, swap oaths and argue about beer.',
        feast: 'cave_bread',
      },
    ],
    ranks: ['Stranger', 'Guest of the Hall', 'Friend of the Forge', 'Clan-Ally', 'Thane of Khar-Dum'],
    names: {
      towns: { n: 'Frostanvil', e: 'Deepgate', s: 'Emberfall', w: 'Stonehearth' },
      villages: { n: 'Ironroot', e: 'Copperhill', s: 'Cinderwick', w: 'Goatsbeard' },
      seaward: { n: 'Cairn Watch', e: 'Slate Farm', s: 'Gritstone Post', w: 'Mossvein Terraces' },
      first: [
        'Bofur',
        'Dagna',
        'Eitri',
        'Fili',
        'Gimra',
        'Hrolf',
        'Ingrid',
        'Jorund',
        'Kilda',
        'Loki',
        'Magni',
        'Nora',
        'Orsik',
        'Pebbra',
        'Ragna',
        'Sigrun',
        'Thrain',
        'Ulfa',
        'Vigdis',
        'Yngva',
      ],
      last: [
        'Anvilsong',
        'Boulderfist',
        'Coalbeard',
        'Deepdelver',
        'Emberhand',
        'Flintlock',
        'Goldgrip',
        'Hammerfall',
        'Ironvein',
        'Kettlehelm',
        'Longbeard',
        'Mithrilbrow',
        'Ore-Eater',
        'Pickaxe',
        'Quartzback',
        'Runehewer',
        'Stoneward',
        'Tinkerbolt',
        'Undermountain',
        'Wyrmbane',
      ],
    },
  },

  raijin: {
    id: 'raijin',
    name: 'Raijin Shogunate',
    epithet: 'The Storm Kingdom',
    motto: 'Be the calm the lightning chooses.',
    government:
      'A shogunate: the Shogun rules in the name of the storm-spirit, advised by council-lords (daimyo) who each keep a private army and a private opinion.',
    capital: 'Raikyo',
    banner: { field: 'night', charge: 'w6', emblem: 'bolt' },
    style: 7,
    climate:
      'Misty, mountainous and wet. Cherry orchards in the lowlands, bamboo slopes, thunderheads that gather every afternoon and break at dusk.',
    history:
      'Raijin was forged by a thunderstorm that lasted a generation. When the clouds finally broke, the first Shogun stood on a mountain and declared the lightning his ally. Since then, six dynasties have ruled by the Code of the Calm Blade, and the storm has never struck the capital. Everyone is careful not to ask why.',
    culture:
      'Disciplined, poetic and honour-bound. Duels are formal, apologies are ritual, and a well-placed silence is more eloquent than a speech. Beneath the order runs a current of shinobi, spirits and rivalries.',
    architecture:
      'Red-lacquered pagodas with curved eaves, paper-screened halls, stone lanterns, cherry blossoms and wooden bridges over koi ponds. Fortresses perch on misty peaks with white plastered walls.',
    traditions: [
      'Swords are drawn only after a bow; a duel declined with grace carries no shame.',
      'Each autumn, wooden thunder-drums are beaten for a night to remind the storm who invited it.',
      'A guest’s shoes are left at the door and their name is written, never spoken, in the house ledger.',
    ],
    cuisine:
      'Thunder noodles in smoky broth, cherry mochi, pickled bamboo, grilled river fish. Tea is served with silence.',
    ruler: {
      id: 'raimei',
      name: 'Shogun Takeda Raimei',
      title: 'The Stormborn',
      trait: 'Composed, poetic, with a hairline crack of weariness under the discipline.',
      agenda:
        'The storm has begun to answer someone else. He needs to learn who without letting his daimyo guess that he does not already know.',
      look: 5,
    },
    court: [
      {
        id: 'sayo',
        name: 'Lady Sayo Mizuki',
        title: 'Chief Retainer (Karo)',
        trait: 'Elegant, politely lethal, always writing something.',
        agenda: 'Wants the Shogun to name an heir before the daimyo name one for him.',
        look: 4,
      },
      {
        id: 'kenzo',
        name: 'Commander Kenzo Ogawa',
        title: 'General of the Thunder Banner',
        trait: 'A scarred veteran who speaks as if every word cost a coin.',
        agenda: 'Believes the rivalry with Thalassara over the sea lanes will end in blood unless someone yields.',
        look: 6,
      },
      {
        id: 'hinata',
        name: 'Shrine Maiden Hinata',
        title: 'Priestess of the Storm Shrine',
        trait: 'Young, serene, and starting to hear thunder in her sleep.',
        agenda: 'She is the one the storm is answering, and she is frightened of what it wants.',
        look: 1,
      },
      {
        id: 'kage',
        name: 'Kage',
        title: 'Master of the Hidden Leaves',
        trait: 'Nobody has seen his face; everybody has seen his work.',
        agenda: 'Quietly protects the Shogun from plots the Shogun would rather not know about.',
        look: 0,
      },
    ],
    units: [
      {
        id: 'samurai',
        name: 'Samurai of the Calm Blade',
        role: 'elite',
        desc: 'Armoured swordsmen who duel with ritual restraint and fight with none.',
      },
      {
        id: 'shinobi',
        name: 'Shinobi of the Hidden Leaves',
        role: 'elite',
        desc: 'Spies and assassins who work in rain and silence.',
      },
      {
        id: 'yabusame',
        name: 'Yabusame Riders',
        role: 'cavalry',
        desc: 'Mounted archers who loose three arrows per breath.',
      },
      {
        id: 'ashigaru',
        name: 'Ashigaru Spearmen',
        role: 'infantry',
        desc: 'Disciplined spear lines under lacquered helms.',
      },
      {
        id: 'spiritblade',
        name: 'Spirit Swordsmen',
        role: 'mage',
        desc: 'Duellists whose blades are half cut by the dead.',
      },
      {
        id: 'raiju',
        name: 'Raiju Thunder Beasts',
        role: 'mythical',
        desc: 'Lightning-wreathed beasts that follow the storm and the Shogun’s drum.',
      },
    ],
    economy: {
      exports: ['fish_fry', 'moonray', 'koi', 'mushroom', 'cloth', 'plank'],
      imports: ['iron_ingot', 'copper_ingot', 'milk', 'corn'],
      trade:
        'Silk, tea, lacquer, river fish and bamboo craftwork; buys iron from Khar-Dum for the swords the world pretends not to envy.',
    },
    festivals: [
      {
        id: 'hanami',
        name: 'Hanami',
        season: 0,
        day: 5,
        desc: 'Cherry blossoms are at their height. Every town picnics beneath the trees and exchanges poems.',
        feast: 'cherry_mochi',
      },
      {
        id: 'thunderdrum',
        name: 'Thunder Drum Night',
        season: 1,
        day: 7,
        desc: 'A night of great drums beaten to honour the storm. Duels are staged for the crowd, and swords are blessed.',
        feast: 'thunder_noodles',
      },
    ],
    ranks: ['Stranger', 'Guest of the House', 'Retainer', 'Sworn Blade', 'Hatamoto of the Storm'],
    names: {
      towns: { n: 'Kiritani', e: 'Sakuramori', s: 'Takegawa', w: 'Shiokaze' },
      villages: { n: 'Asahigaoka', e: 'Hanazono', s: 'Momiji-no-Sato', w: 'Kawadori' },
      seaward: { n: 'Mizukiri Watch', e: 'Tsubaki Farm', s: 'Wave-Gate Post', w: 'Inari Paddies' },
      first: [
        'Akira',
        'Botan',
        'Chiyo',
        'Daiki',
        'Emi',
        'Fumio',
        'Goro',
        'Haruka',
        'Isamu',
        'Jun',
        'Kaede',
        'Londo',
        'Mei',
        'Natsu',
        'Osamu',
        'Rin',
        'Satoshi',
        'Takumi',
        'Umeko',
        'Yuki',
      ],
      last: [
        'Akagawa',
        'Fujiwara',
        'Hayashi',
        'Ishikawa',
        'Kobayashi',
        'Matsuda',
        'Nakamura',
        'Okamoto',
        'Saito',
        'Tanabe',
        'Uchida',
        'Yamazaki',
        'Aoki',
        'Date',
        'Endo',
        'Goto',
        'Hori',
        'Kuroda',
        'Mori',
        'Sugiyama',
      ],
    },
  },

  thalassara: {
    id: 'thalassara',
    name: 'Thalassara',
    epithet: 'The Ocean Kingdom',
    motto: 'The tide takes, the tide gives, the tide remembers.',
    government:
      'A maritime queendom: the Admiral-Queen rules the surface and shares the deeps with a Reef Council of merfolk and sirens.',
    capital: 'Nacrehall',
    banner: { field: 'w2', charge: 'e6', emblem: 'shell' },
    style: 8,
    climate: 'Warm, bright and windy. Coral lagoons, white sand, palms, trade-wind squalls and calm green water.',
    history:
      'Thalassara began as a fleet that refused to come ashore. The first captains lashed their ships into a ring and, over three centuries, grew an island in the middle out of coral and wreckage. Their alliance with the merfolk is younger and more fragile than the songs admit, and sealed by a debt that no one on land is allowed to ask about.',
    culture:
      'Mercantile, musical and restless. Contracts are sung, goods are weighed in shells, and everyone is a little in love with the sea. Wanderlust is a virtue; staying put is a mild vice.',
    architecture:
      'Coral palaces and mother-of-pearl domes, stilt-harbours, white-sail awnings, tide-gates and glass-floored halls over living reefs. Streets are canals, and every roof catches rainwater.',
    traditions: [
      'A newborn’s name is whispered to the sea at the first low tide.',
      'No ship leaves harbour without a gift left on the quay for the ones who did not come back.',
      'Debts are paid in pearls, favours or songs, and songs are the dearest.',
    ],
    cuisine:
      'Reef ceviche, pearl-crab chowder, grilled sailfin with lime, kelp-wrapped sweet yam. Everything is cold, bright and sharp.',
    ruler: {
      id: 'nerissa',
      name: 'Admiral-Queen Nerissa Tidecaller',
      title: 'Mistress of the Lanes',
      trait: 'Witty, sun-weathered and merciless over contracts.',
      agenda:
        'Raijin’s navy is tightening on the eastern lanes. She wants a diplomat she can disown, and she thinks she may have found one.',
      look: 3,
    },
    court: [
      {
        id: 'corwin',
        name: 'Harbormaster Corwin Saltmere',
        title: 'Warden of the Quays',
        trait: 'Weathered, jovial, knows every ship by its smell.',
        agenda: 'A ship has docked that is on no ledger, and he would like to know who is paying for the silence.',
        look: 2,
      },
      {
        id: 'lyra',
        name: 'Lyra of the Reef',
        title: 'Siren-Singer of the Reef Council',
        trait: 'Lilting, ambiguous, honest only in song.',
        agenda: 'Wants the surface folk to understand the debt without having to say what it is.',
        look: 4,
      },
      {
        id: 'maro',
        name: 'Reefwarden Maro Brine',
        title: 'Guardian of the Coral',
        trait: 'Brusque, protective, smells of kelp.',
        agenda: 'Something is bleaching the reef from below and he suspects the Nethrakar traders.',
        look: 0,
      },
    ],
    units: [
      {
        id: 'seaknight',
        name: 'Sea Knights',
        role: 'elite',
        desc: 'Shell-plated knights who fight best on a rolling deck.',
      },
      {
        id: 'merfolk',
        name: 'Merfolk Spearhosts',
        role: 'infantry',
        desc: 'Amphibious spear-fighters who ambush from the shallows.',
      },
      {
        id: 'siren',
        name: 'Reef Sirens',
        role: 'mage',
        desc: 'Singers whose voices confuse sailors and pacify crowds.',
      },
      {
        id: 'seahorse',
        name: 'Tide Riders',
        role: 'cavalry',
        desc: 'Riders of giant seahorses that sprint along the surf.',
      },
      {
        id: 'fleet',
        name: 'The Royal Fleet',
        role: 'siege',
        desc: 'Corvettes, galleons and fire-ships, the finest in the sea.',
      },
      {
        id: 'leviathan',
        name: 'Leviathan Allies',
        role: 'mythical',
        desc: 'Ancient sea-beasts bound to the Admiral-Queen by a song only she knows.',
      },
    ],
    economy: {
      exports: ['sailfin', 'prism_nautilus', 'glowfin', 'yam', 'doubloon', 'cloth'],
      imports: ['iron_ingot', 'plank', 'milk', 'coal'],
      trade:
        'Spices, pearls, fish and shipping. Thalassara carries everyone else’s goods and takes a tenth, and sings about the tenth.',
    },
    festivals: [
      {
        id: 'tideturning',
        name: 'The Tide-Turning',
        season: 1,
        day: 2,
        desc: 'A water-festival: processions of lit boats, shell-music and the great regatta around the Pearl Isle.',
        feast: 'reef_ceviche',
      },
      {
        id: 'lanternfloat',
        name: 'Lantern Float',
        season: 3,
        day: 6,
        desc: 'Every ship releases a lantern on the water for the sailors who never returned.',
        feast: 'crab_chowder',
      },
    ],
    ranks: ['Landlubber', 'Guest of the Quay', 'Deckhand', 'Reef-Friend', 'Pearl of Thalassara'],
    names: {
      towns: { n: 'Saltmere', e: 'Driftwater', s: 'Coralgate', w: 'Mariner’s Rest' },
      villages: { n: 'Gullcrest', e: 'Pearlbed', s: 'Tidewash', w: 'Netmender’s Cove' },
      seaward: { n: 'Beacon Isle', e: 'Kelp Garden', s: 'Skerry Post', w: 'Oyster Rows' },
      first: [
        'Amara',
        'Brine',
        'Coral',
        'Dune',
        'Echo',
        'Finn',
        'Gale',
        'Halia',
        'Isla',
        'Jory',
        'Kai',
        'Lagoon',
        'Marlin',
        'Nerida',
        'Ondine',
        'Pearl',
        'Rip',
        'Shelly',
        'Tide',
        'Wren',
      ],
      last: [
        'Anchorwell',
        'Barnacle',
        'Corsair',
        'Driftwood',
        'Eelstrider',
        'Fathom',
        'Greywave',
        'Harpoon',
        'Inkwell',
        'Jibsheet',
        'Kelpweaver',
        'Lighthouse',
        'Mainsail',
        'Nautilus',
        'Oysterbed',
        'Pearldiver',
        'Quayside',
        'Reefcomber',
        'Seabourne',
        'Windward',
      ],
    },
  },

  nethrakar: {
    id: 'nethrakar',
    name: 'Nethrakar',
    epithet: 'The Demon Kingdom',
    motto: 'A pact is the only fire that does not burn the one who keeps it.',
    government:
      'A pact-oligarchy: nine great houses bound by the Infernal Compact, with an elected Archon who may break any law except a promise.',
    capital: 'Obsidia',
    banner: { field: 'r1', charge: 'q4', emblem: 'flame' },
    style: 9,
    climate:
      'Hot, dry and volcanic. Ashfields, crimson forests that glow at night, rivers of slow lava and perpetual dusk under smoke.',
    history:
      'Nethrakar was a prison for something the world feared. Its first inhabitants were the jailers, who found over centuries that the thing in the deep was not a monster but a debtor. They remade themselves into a society of pacts, and the supposed demons of the continent are its lawyers, smiths and diplomats. Most of the old stories about them were written by people who lost a negotiation.',
    culture:
      'Proud, theatrical, scrupulously honest in the letter and endlessly inventive in the spirit. Hospitality is sacred, insults are an art, and a broken promise is the only unforgivable thing.',
    architecture:
      'Black obsidian fortresses veined with ember-light, crimson timber halls, glowing runic bridges over lava rivers and gardens of fire-blossoms. Cities rise in jagged tiers with open braziers on every corner.',
    traditions: [
      'On the Night of Open Doors, every house leaves its door open and sets a place for an outsider.',
      'Names have weight: you give a true name only to those you will not betray.',
      'Contracts are sealed in wax with a drop of the signer’s blood. The wax remembers.',
    ],
    cuisine:
      'Ember-pepper stew, cinder cake, smoked ash-boar, crimson-berry wine tea. Everything is spiced to the edge of pain.',
    ruler: {
      id: 'vael',
      name: 'Archon Vael Nysa Dravenholt',
      title: 'First Signatory of the Compact',
      trait: 'Wry, dignified and tired of being feared.',
      agenda:
        'She wants one honest visitor to leave Nethrakar and tell the other kingdoms the truth, and will pay almost any price to arrange it.',
      look: 7,
    },
    court: [
      {
        id: 'mordecai',
        name: 'Mordecai Gloam',
        title: 'Spymaster of the Ninth House',
        trait: 'Soft-spoken, amused, always already knows.',
        agenda: 'Wants to prove that the rumour of a Nethrakar plot against Thalassara’s reef is a Raijin forgery.',
        look: 0,
      },
      {
        id: 'seraphine',
        name: 'High Magister Seraphine Ashveil',
        title: 'Warden of the Deep Seal',
        trait: 'Severe, fair, beautifully dressed.',
        agenda: 'The seal over the deep is weakening, and she cannot tell the Archon why.',
        look: 4,
      },
      {
        id: 'gorrak',
        name: 'War-Chief Gorrak Hellmane',
        title: 'Captain of the Ashen Host',
        trait: 'Enormous, jovial, secretly a poet.',
        agenda: 'Wants peace badly enough to fight for it, and a friend among the surface folk.',
        look: 6,
      },
    ],
    units: [
      {
        id: 'demonknight',
        name: 'Demon Knights',
        role: 'elite',
        desc: 'Horned knights in obsidian plate, bound by oaths they keep to the letter.',
      },
      {
        id: 'shadowmage',
        name: 'Shadow Mages',
        role: 'mage',
        desc: 'Scholars of the pact-magic who cast from their own shadows.',
      },
      {
        id: 'hellhound',
        name: 'Hellhound Cavalry',
        role: 'cavalry',
        desc: 'Riders on ember-furred hounds that run on lava crust.',
      },
      {
        id: 'ogre',
        name: 'Monstrous Infantry',
        role: 'infantry',
        desc: 'Ogres and trolls in armoured ranks, loyal and surprisingly gentle.',
      },
      { id: 'embergunner', name: 'Ember Gunners', role: 'ranged', desc: 'Imp-gunners with flame-tipped bolts.' },
      {
        id: 'wyrmling',
        name: 'Draconic Allies',
        role: 'mythical',
        desc: 'Old wyrms who chose to stay and guard the fortresses of Nethrakar.',
      },
    ],
    economy: {
      exports: ['coal', 'gold_ingot', 'silver_ingot', 'qubit_crystal', 'healing_potion', 'cloth'],
      imports: ['milk', 'egg', 'corn', 'plank', 'melon'],
      trade:
        'Contracts, pact-magic, rare minerals and fire-craft, sold on credit and kept to the letter. The only kingdom that has never defaulted on a debt.',
    },
    festivals: [
      {
        id: 'opendoors',
        name: 'Night of Open Doors',
        season: 3,
        day: 4,
        desc: 'Every door stays open and every house sets a place for a stranger. An invitation honoured is a friend made.',
        feast: 'ember_stew',
      },
      {
        id: 'embermarket',
        name: 'The Ember Market',
        season: 1,
        day: 3,
        desc: 'The streets turn to bazaars lit by a thousand braziers. Pacts of trade are signed for the year.',
        feast: 'cinder_cake',
      },
    ],
    ranks: ['Outsider', 'Guest of the House', 'Bound Friend', 'Signatory', 'Ally of the Compact'],
    names: {
      towns: { n: 'Ashreach', e: 'Cindermoor', s: 'Brimstone Gate', w: 'Hollow Flame' },
      villages: { n: 'Ember Hollow', e: 'Crimson Wood', s: 'Smokestead', w: 'Ashfall' },
      seaward: { n: 'Obsidian Watch', e: 'Fireblossom Farm', s: 'Sulphur Post', w: 'Cinder Terraces' },
      first: [
        'Azrael',
        'Belial',
        'Cassiel',
        'Dahlia',
        'Eligor',
        'Fenris',
        'Gaelith',
        'Hextor',
        'Ilsa',
        'Jarek',
        'Kaelen',
        'Lilith',
        'Malphas',
        'Nyx',
        'Orias',
        'Phaedra',
        'Raum',
        'Sable',
        'Thessaly',
        'Vorn',
      ],
      last: [
        'Ashveil',
        'Blackthorn',
        'Cinderfell',
        'Duskmantle',
        'Emberwake',
        'Flamecrest',
        'Gloam',
        'Hellmane',
        'Ironhorn',
        'Jetblood',
        'Kindle',
        'Lavaborn',
        'Mournbright',
        'Nightfire',
        'Obsidian',
        'Pyrewright',
        'Quenchwater',
        'Redhollow',
        'Smolder',
        'Vantablack',
      ],
    },
  },
};

// ───────────────────────── diplomacy ─────────────────────────

const PAIRS: Array<[RealmId, RealmId, KingdomStance, string]> = [
  [
    'aurelion',
    'sylvaris',
    'allied',
    'The Treaty of the Standing Oak: Aurelion keeps its axes out of the wood; Sylvaris keeps its arrows out of the wheat.',
  ],
  [
    'aurelion',
    'khardum',
    'rival',
    'Tariffs on iron, a bridge neither will pay for and three centuries of mutual condescension.',
  ],
  [
    'aurelion',
    'raijin',
    'neutral',
    'Polite envoys, polite spies and a lively trade in silk that both courts pretend not to depend on.',
  ],
  [
    'aurelion',
    'thalassara',
    'friendly',
    'Grain for spice: the oldest trade lane on the sea, and nobody has ever cheated it twice.',
  ],
  [
    'aurelion',
    'nethrakar',
    'hostile',
    'The Ashen War ended a century ago on paper. The border garrisons have never been told.',
  ],
  [
    'sylvaris',
    'khardum',
    'rival',
    'The forest accuses the mines of poisoning its streams. The mountain accuses the forest of ingratitude.',
  ],
  [
    'sylvaris',
    'raijin',
    'friendly',
    'Raijin’s shrine-keepers and Sylvaris’ druids exchange students and recipes for bamboo tea.',
  ],
  ['sylvaris', 'thalassara', 'friendly', 'Timber for ships, and a shared horror of anyone who lets a coast die.'],
  ['sylvaris', 'nethrakar', 'rival', 'The wood remembers old burnings. Nethrakar remembers who started them.'],
  [
    'khardum',
    'raijin',
    'friendly',
    'Iron for swords: the Raijin smiths and the Khar-Dum smiths trade lessons and insults at every Moot.',
  ],
  ['khardum', 'thalassara', 'neutral', 'Mutual indifference, joint fondness for hard bargains.'],
  [
    'khardum',
    'nethrakar',
    'allied',
    'The Pact of the Deep Forge: Khar-Dum steel and Nethrakar fire-craft, the finest weapons in the world and the one secret both keep.',
  ],
  [
    'raijin',
    'thalassara',
    'rival',
    'Raijin’s navy and Thalassara’s fleet circle the eastern sea lanes like two cats on a wall.',
  ],
  [
    'raijin',
    'nethrakar',
    'neutral',
    'A wary mutual respect between two honour cultures that suspect each other of lying about it.',
  ],
  ['thalassara', 'nethrakar', 'neutral', 'Business, strictly: Nethrakar pays well and Thalassara asks no questions.'],
];

export const stanceOf = (a: RealmId, b: RealmId): KingdomStance | null => {
  if (a === b) return null;
  const p = PAIRS.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return p ? p[2] : null;
};
export const stanceNote = (a: RealmId, b: RealmId): string => {
  const p = PAIRS.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return p ? p[3] : '';
};
export const relationsOf = (a: RealmId): Array<{ other: RealmId; stance: KingdomStance; note: string }> =>
  PAIRS.filter(([x, y]) => x === a || y === a).map(([x, y, stance, note]) => ({
    other: x === a ? y : x,
    stance,
    note,
  }));

export type DiplomaticEvent = 'trade_pact' | 'embargo' | 'border_skirmish' | 'royal_wedding' | 'summit' | 'ceasefire';
export interface DiplomacyState {
  a: RealmId;
  b: RealmId;
  stance: KingdomStance;
  event: DiplomaticEvent | null;
  /** a line of rumour for taverns and rulers */
  rumor: string;
}
const EVENT_TEXT: Record<DiplomaticEvent, (a: string, b: string) => string> = {
  trade_pact: (a, b) => `${a} and ${b} have signed a trade pact this season. Merchants are smiling.`,
  embargo: (a, b) => `${a} has embargoed ${b}. Prices on their goods have jumped.`,
  border_skirmish: (a, b) =>
    `Patrols from ${a} and ${b} clashed on the sea lanes. Nobody has admitted who fired first.`,
  royal_wedding: (a, b) => `A betrothal between the houses of ${a} and ${b} is announced. The courts are in a flutter.`,
  summit: (a, b) => `Envoys of ${a} and ${b} meet in secret. Both courts deny it.`,
  ceasefire: (a, b) => `${a} and ${b} have agreed to a season of quiet. Everyone is holding their breath.`,
};
const EVENTS_BY_STANCE: Record<KingdomStance, DiplomaticEvent[]> = {
  allied: ['royal_wedding', 'trade_pact', 'summit'],
  friendly: ['trade_pact', 'summit', 'royal_wedding'],
  neutral: ['trade_pact', 'embargo', 'summit'],
  rival: ['embargo', 'border_skirmish', 'summit'],
  hostile: ['border_skirmish', 'ceasefire', 'embargo'],
};
/** The diplomatic calendar: each season every pair may have one event, chosen deterministically from the season index. */
export function diplomacyAt(seed: number, day: number): DiplomacyState[] {
  const season = Math.floor(day / DAYS_PER_SEASON); // one calendar per season
  return PAIRS.map(([a, b, stance], i) => {
    const h = hashUnit(seed, season, i);
    const event = h < 0.55 ? EVENTS_BY_STANCE[stance][Math.floor(hashUnit(seed, season, i + 100) * 3) % 3]! : null;
    return {
      a,
      b,
      stance,
      event,
      rumor: event ? EVENT_TEXT[event](KINGDOMS[a].name, KINGDOMS[b].name) : stanceNote(a, b),
    };
  });
}
function hashUnit(seed: number, a: number, b: number): number {
  let h = (seed ^ (a * 374761393) ^ (b * 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Price multiplier on goods flowing from `from` into a shop of kingdom `into`, given the season's diplomacy. */
export function tradeModifier(seed: number, day: number, from: RealmId, into: RealmId): number {
  if (from === into) return 1;
  const s = diplomacyAt(seed, day).find((d) => (d.a === from && d.b === into) || (d.a === into && d.b === from));
  if (!s) return 1;
  const base =
    s.stance === 'allied'
      ? 0.94
      : s.stance === 'friendly'
        ? 0.97
        : s.stance === 'rival'
          ? 1.08
          : s.stance === 'hostile'
            ? 1.18
            : 1;
  const ev = s.event === 'trade_pact' ? 0.9 : s.event === 'embargo' ? 1.2 : s.event === 'border_skirmish' ? 1.1 : 1;
  return base * ev;
}

// ───────────────────────── reputation ─────────────────────────

export const REP_TIERS = [0, 100, 300, 700, 1500] as const;
export const REP_MIN = -300;
export const REP_MAX = 3000;
/** 0 stranger .. 4 champion; negative reputation is `-1` (wary). */
export const repTier = (rep: number): -1 | 0 | 1 | 2 | 3 | 4 =>
  rep < -50
    ? -1
    : rep >= REP_TIERS[4]
      ? 4
      : rep >= REP_TIERS[3]
        ? 3
        : rep >= REP_TIERS[2]
          ? 2
          : rep >= REP_TIERS[1]
            ? 1
            : 0;
export const realmRankName = (realm: RealmId, rep: number): string => {
  const t = repTier(rep);
  return t < 0 ? 'Distrusted' : KINGDOMS[realm].ranks[t as 0 | 1 | 2 | 3 | 4];
};
/** Shop discount from standing: up to 20% for a champion, a 15% surcharge for the distrusted. */
export const repPriceMultiplier = (rep: number): number => {
  const t = repTier(rep);
  return t < 0 ? 1.15 : [1, 0.98, 0.95, 0.9, 0.8][t as 0 | 1 | 2 | 3 | 4]!;
};
/** Reputation changes spill over: allies of the host warm to you a little, enemies cool. */
export function repSpill(realm: RealmId, gained: number): Array<{ realm: RealmId; delta: number }> {
  const out: Array<{ realm: RealmId; delta: number }> = [];
  for (const r of relationsOf(realm)) {
    const k =
      r.stance === 'allied'
        ? 0.15
        : r.stance === 'friendly'
          ? 0.06
          : r.stance === 'rival'
            ? -0.05
            : r.stance === 'hostile'
              ? -0.12
              : 0;
    const d = Math.trunc(gained * k);
    if (d) out.push({ realm: r.other, delta: d });
  }
  return out;
}

// ───────────────────────── calendar ─────────────────────────

/** Days per season in the world clock (a year is four seasons). */
export const SEASON_DAYS = DAYS_PER_SEASON;
export function festivalOn(realm: RealmId, day: number): Festival | null {
  const season = Math.floor(day / SEASON_DAYS) % 4,
    d = (day % SEASON_DAYS) + 1;
  return KINGDOMS[realm].festivals.find((f) => f.season === season && f.day === d) ?? null;
}
/** The next festival of a kingdom at or after `day`, and how many days away it is. */
export function nextFestival(realm: RealmId, day: number): { festival: Festival; in: number } {
  let best: { festival: Festival; in: number } | null = null;
  for (const f of KINGDOMS[realm].festivals) {
    const target = f.season * SEASON_DAYS + (f.day - 1);
    const cur = day % (SEASON_DAYS * 4);
    const wait = (target - cur + SEASON_DAYS * 4) % (SEASON_DAYS * 4);
    if (!best || wait < best.in) best = { festival: f, in: wait };
  }
  return best!;
}
