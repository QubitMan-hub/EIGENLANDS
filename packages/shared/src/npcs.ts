import { CAVE_RESIDENTS, CAVE_TOWNS } from './undercroft';
import { PORT_RESIDENTS, PORTS } from './settlements';
import type { Weather } from './weather';
import { ITEMS, type ItemKind } from './items';

export interface ScheduleBlock {
  h0: number;
  h1: number;
  spot: string;
  doing: string;
}
export interface ShopStock {
  item: string;
  markup: number;
  seasons?: number[];
}
export interface NpcDef {
  id: string;
  name: string;
  title: string;
  bio: string;
  /** index into the client outfit table (look) */
  look: number;
  home: string;
  settlement?: string;
  schedule: ScheduleBlock[];
  loves: string[];
  likes: string[];
  hates: string[];
  shop?: {
    name: string;
    stock: ShopStock[];
    buys: Array<ItemKind | 'all'>;
    buyBonus: number;
    /** opening hours [open, close) in game hours */ hours?: [number, number];
  };
  lines: {
    greet: [string[], string[], string[]]; // by friendship tier: acquaintance, friend, close
    work: string[];
    season: [string[], string[], string[], string[]];
    rain: string[];
    snow: string[];
    night: string[];
    gift: { love: string[]; like: string[]; neutral: string[]; hate: string[]; again: string[] };
    teach?: string;
  };
}

const B = (h0: number, h1: number, spot: string, doing: string): ScheduleBlock => ({ h0, h1, spot, doing });

export const NPCS: NpcDef[] = [
  {
    id: 'orla',
    name: 'Orla Brightwater',
    title: 'Mayor of Hadamere',
    look: 4,
    bio: 'Keeps the village ledger and an even tighter grip on gossip. Believes every traveler is a future neighbor.',
    home: 'hall.in',
    schedule: [
      B(0, 8, 'hall.in', 'asleep'),
      B(8, 12, 'hall.work', 'working at her desk'),
      B(12, 14, 'plaza_d', 'greeting villagers'),
      B(14, 18, 'hall.work', 'working at her desk'),
      B(18, 21, 'inn.table', 'having supper'),
      B(21, 24, 'hall.in', 'asleep'),
    ],
    loves: ['fruit_pie', 'qubit_tea', 'koi'],
    likes: ['daffodil', 'blueberry', 'pumpkin_soup', 'sunpetal'],
    hates: ['slime_gel', 'raw_meat', 'hopper_tooth'],
    lines: {
      greet: [
        [
          'Welcome to Hadamere! Mind the cobbles, they were laid by optimists.',
          'Another new face. Good. We could use a few more hands.',
        ],
        ['Ah, you again! The village is better for it.', 'I put your name in the ledger, under "reliable".'],
        [
          'There you are! I was just saying your name. Fondly, I promise.',
          'Sit, sit. Tell me everything the road did to you.',
        ],
      ],
      work: [
        'The ledger never balances on its own, and I have tried asking nicely.',
        'Everyone thinks a mayor mostly makes speeches. I mostly make lists.',
      ],
      season: [
        ['Spring is when this village remembers it is a farming village. Plant something!'],
        ['Summer fairs are coming together. Well, a fair. In theory.'],
        ['Autumn! Harvest ledgers! My favorite kind of chaos.'],
        ['Winter makes the whole village hold its breath. I rather like it.'],
      ],
      rain: ['Rain on the roof, tea in the cup. A mayor can ask for little more.'],
      snow: ['Snow! The children will have the plaza by noon.'],
      night: ["Shouldn't you be asleep? So should I, but here we are."],
      gift: {
        love: ['This is wonderful! You have excellent taste, and I never say that lightly.'],
        like: ["How thoughtful. I'll enjoy this."],
        neutral: ['Oh, how kind. Thank you.'],
        hate: ["Ah. Well. It's the thought that counts. Mostly."],
        again: ["You're too generous — one gift a day, I insist!"],
      },
    },
  },
  {
    id: 'tobin',
    name: 'Tobin Greenbough',
    title: 'General Store',
    look: 1,
    bio: 'Sells seeds, string and second chances. Knows what everything is worth, and exactly when it was worth more.',
    home: 'store.in',
    schedule: [
      B(0, 8, 'store.in', 'asleep'),
      B(8, 18, 'store.work', 'minding the counter'),
      B(18, 20, 'plaza_b', 'taking the evening air'),
      B(20, 24, 'store.in', 'asleep'),
    ],
    loves: ['melon', 'strawberry', 'fish_fry', 'qubit_crystal'],
    likes: ['corn', 'tomato', 'omelet', 'blueberry'],
    hates: ['mushroom', 'raw_meat', 'cricket'],
    shop: {
      name: 'Greenbough General Store',
      hours: [8, 18],
      buys: ['crop', 'forage', 'resource', 'material', 'bug', 'seed', 'fertilizer', 'misc'],
      buyBonus: 1,
      stock: [
        { item: 'turnip_seed', markup: 1, seasons: [0] },
        { item: 'potato_seed', markup: 1, seasons: [0] },
        { item: 'strawberry_seed', markup: 1, seasons: [0] },
        { item: 'green_bean_seed', markup: 1, seasons: [0] },
        { item: 'tomato_seed', markup: 1, seasons: [1] },
        { item: 'melon_seed', markup: 1, seasons: [1] },
        { item: 'corn_seed', markup: 1, seasons: [1, 2] },
        { item: 'blueberry_seed', markup: 1, seasons: [1] },
        { item: 'pumpkin_seed', markup: 1, seasons: [2] },
        { item: 'cranberry_seed', markup: 1, seasons: [2] },
        { item: 'yam_seed', markup: 1, seasons: [2] },
        { item: 'eggplant_seed', markup: 1, seasons: [2] },
        { item: 'frostroot_seed', markup: 1, seasons: [3] },
        { item: 'fertilizer', markup: 1 },
        { item: 'hay', markup: 1.2 },
        { item: 'fiber', markup: 1.3 },
        { item: 'chest', markup: 1 },
        { item: 'fence', markup: 1 },
      ],
    },
    lines: {
      greet: [
        ['Seeds, string, second chances. Take a look around.', 'Prices are fair. Mostly because I wrote them.'],
        [
          'Back again! Let me guess — you need "just one more" of something.',
          "For you, I'll even dust the good shelf.",
        ],
        [
          "My favorite customer! Don't tell the others, they get jealous.",
          "You know, I'd run out of seeds before I ran out of reasons to like you.",
        ],
      ],
      work: [
        "If a price drops, it's because everyone sold the same thing. Spread your harvest around.",
        'The market is a living thing. Feed it variety.',
      ],
      season: [
        ['Spring stock is in. Turnips sell themselves.'],
        ['Summer seeds: melons are the long game, tomatoes the short.'],
        ['Autumn means pumpkins. Big seeds, bigger pride.'],
        ["Winter. Frostroot only, I'm afraid. Unless you own a greenhouse."],
      ],
      rain: ["Rain's good for crops and bad for business. I'll take it."],
      snow: ["Mind the doormat. It's wetter than it looks."],
      night: ['Closed? Never. Just quiet.'],
      gift: {
        love: ["For me?! I'll… put it somewhere safe. Somewhere very safe."],
        like: ["Well, that's good business — I mean, kindness."],
        neutral: ["Thank you! I'll find a use for it."],
        hate: ["Hm. I'll… resell it. Politely."],
        again: ["Already today! You'll put me out of balance."],
      },
    },
  },
  {
    id: 'brannoch',
    name: 'Brannoch Ironhand',
    title: 'Blacksmith',
    look: 6,
    bio: 'Talks to metal more than to people. Insists every alloy has a mood and a phase, and that the two are related.',
    home: 'smithy.in',
    schedule: [
      B(0, 7, 'smithy.in', 'asleep'),
      B(7, 12, 'smithy.work', 'working the forge'),
      B(12, 13, 'inn.table', 'eating lunch'),
      B(13, 18, 'smithy.work', 'working the forge'),
      B(18, 21, 'inn.table', 'with a mug at the inn'),
      B(21, 24, 'smithy.in', 'asleep'),
    ],
    loves: ['gold_ingot', 'grilled_meat', 'hearty_stew', 'iron_ingot'],
    likes: ['silver_ingot', 'copper_ingot', 'fish_fry', 'coal'],
    hates: ['daffodil', 'berry_jam', 'cloth'],
    shop: {
      name: 'Ironhand Smithy',
      hours: [7, 18],
      buys: ['resource', 'material'],
      buyBonus: 1.15,
      stock: [
        { item: 'spear', markup: 1.3 },
        { item: 'battle_axe', markup: 1.3 },
        { item: 'warhammer', markup: 1.3 },
        { item: 'coal', markup: 1.1 },
        { item: 'copper_ingot', markup: 1.1 },
        { item: 'iron_ingot', markup: 1.15 },
        { item: 'forge', markup: 1 },
        { item: 'furnace', markup: 1 },
      ],
    },
    lines: {
      greet: [
        ['Mm. You want something forged, or just warm hands?', "Don't touch the anvil. It bites."],
        ['Ah. The one who actually listens. Come, watch.', "You're getting a feel for the rhythm. Keep at it."],
        [
          "You're the only one who understands why I hum at the forge. Come here.",
          'A good blade, a good friend. Both take a long time to make.',
        ],
      ],
      work: [
        'Match the phases. Two metals that sing the same note make something stronger than either.',
        'Opposite phases cancel each other out. Use that to quiet a flaw.',
        'Hit on the beat, not near it. The metal knows.',
      ],
      season: [
        ['Spring: the forge wants less coal, more patience.'],
        ['Summer is brutal. I work at night when I can.'],
        ['Autumn is when the farmers remember they need new hoes.'],
        ['Winter! Finally, a season where the forge is not the hottest thing in the room.'],
      ],
      rain: ['Rain hisses on the roof. I call it applause.'],
      snow: ['Cold air makes a cleaner edge, I swear it.'],
      night: ["The forge doesn't care what time it is."],
      gift: {
        love: ["This… this is a fine thing. You've got an eye."],
        like: ['Hm. Useful. Thanks.'],
        neutral: ['Hm. Thanks.'],
        hate: ["Take it back. No. Fine. I'll hold it. Don't make it weird."],
        again: ['One a day. Even a smith has limits.'],
      },
    },
  },
  {
    id: 'maribel',
    name: 'Maribel Crumb',
    title: 'Innkeeper & Cook',
    look: 3,
    bio: 'The inn smells of bread and bay leaf, and Maribel knows the business of every guest who ever sat at her tables.',
    home: 'inn.in',
    schedule: [
      B(0, 6, 'inn.in', 'asleep'),
      B(6, 12, 'inn.work', 'cooking'),
      B(12, 13, 'plaza_c', 'shopping for supper'),
      B(13, 22, 'inn.work', 'cooking'),
      B(22, 24, 'inn.in', 'asleep'),
    ],
    loves: ['fruit_pie', 'strawberry', 'hearty_stew', 'milk'],
    likes: ['egg', 'wild_leek', 'mushroom', 'pumpkin'],
    hates: ['slime_gel', 'hopper_tooth', 'coal'],
    shop: {
      name: 'The Crooked Spoon',
      hours: [6, 22],
      buys: ['food', 'crop', 'forage', 'fish'],
      buyBonus: 1.1,
      stock: [
        { item: 'roast_potato', markup: 1.2 },
        { item: 'veggie_stew', markup: 1.2 },
        { item: 'omelet', markup: 1.2 },
        { item: 'berry_jam', markup: 1.2 },
        { item: 'milk', markup: 1.1 },
        { item: 'egg', markup: 1.1 },
      ],
    },
    lines: {
      greet: [
        ['Sit, sit! Soup or stew? Or just the gossip?', "The kettle's always on. So are my ears."],
        ["There's my favorite appetite! Pull up a chair.", 'I saved you the corner table.'],
        ["Oh, you're family now. Family eats first.", "I made your favorite. Don't ask how I knew."],
      ],
      work: [
        'A good stew is patience, a good pie is courage.',
        "Everyone tells their secrets to the soup. It's a good listener.",
      ],
      season: [
        ['Spring greens are in! Wild leeks, tender as anything.'],
        ['Summer fruit pies. I could bake until dawn.'],
        ['Autumn: pumpkin soup season. Say no more.'],
        ['Winter calls for stew. Lots of stew.'],
      ],
      rain: ['Rain brings the whole village indoors. My favorite kind of weather.'],
      snow: ['Snowed in again! The soup is thicker than ever.'],
      night: ["Late? Come in. There's always a bowl."],
      gift: {
        love: ["Oh my! You shouldn't have — you absolutely should have. Thank you!"],
        like: ["Lovely! I'll put it to good use."],
        neutral: ['Thank you, dear.'],
        hate: ["Oh. Oh my. Let's keep that one out of the kitchen."],
        again: ["Already today, dear! You'll spoil me."],
      },
      teach: "Come by the pot — I'll show you how I make my pies and stews.",
    },
  },
  {
    id: 'fenwick',
    name: 'Fenwick Hartley',
    title: 'Farmer',
    look: 3,
    bio: 'Third-generation farmer, first to admit that the crops are smarter than he is. Keeps the community garden going.',
    home: 'farmhouse.in',
    schedule: [
      B(0, 6, 'farmhouse.in', 'asleep'),
      B(6, 12, 'field', 'tending the fields'),
      B(12, 13, 'farmhouse.work', 'eating lunch'),
      B(13, 18, 'field', 'tending the fields'),
      B(18, 20, 'inn.table', 'at the inn'),
      B(20, 24, 'farmhouse.in', 'asleep'),
    ],
    loves: ['pumpkin', 'melon', 'omelet', 'hearty_stew'],
    likes: ['corn', 'potato', 'milk', 'egg'],
    hates: ['slime_gel', 'feather', 'qubit_tea'],
    shop: {
      name: 'Hartley Farm Supply',
      hours: [6, 18],
      buys: ['crop', 'animal', 'food'],
      buyBonus: 1.1,
      stock: [
        { item: 'chicken', markup: 1 },
        { item: 'cow', markup: 1 },
        { item: 'hay', markup: 1.1 },
        { item: 'fertilizer', markup: 1.1 },
        { item: 'coop', markup: 1.1 },
        { item: 'sprinkler_1', markup: 1.1 },
      ],
    },
    lines: {
      greet: [
        [
          "Fields are open to anyone. Water what you plant, and it'll water you back.",
          "You planting? Good. The soil's been lonely.",
        ],
        [
          "Morning! Your turnips are looking good. Don't tell the others I peeked.",
          "Folks who farm always come back. Soil's sticky that way.",
        ],
        ["You've got the touch, friend. Not everybody does.", 'Come help me with the barn gate? …Joking. Mostly.'],
      ],
      work: [
        'Water every day, or pray for rain. I do both.',
        'Crops are fussy about seasons. A turnip in summer is just sadness.',
        'Sprinklers are worth every copper. Trust me, my back says so.',
      ],
      season: [
        ['Spring! Plant it all, and then plant some more.'],
        ["Summer's hot, but the melons love it."],
        ['Autumn: harvest, harvest, harvest.'],
        ["Winter. Nothing grows outside but frostroot, and it doesn't care about our opinion."],
      ],
      rain: ['Free watering! Best kind of day.'],
      snow: ['Fields rest. So do I. Mostly.'],
      night: ['Ought to be in bed, same as I should be.'],
      gift: {
        love: ["Well I'll be! That's mighty kind of you."],
        like: ['Thank you kindly.'],
        neutral: ['Much obliged.'],
        hate: ['Er… thank you? I think the chickens might want it.'],
        again: ["Only the one per day, friend. My manners can't keep up."],
      },
      teach: "If you're serious about livestock, I can show you how a barn goes up.",
    },
  },
  {
    id: 'sedge',
    name: 'Sedge Marlow',
    title: 'Fisher',
    look: 2,
    bio: 'Spends more time with the pond than with people, and says the pond is better company. Has a theory about the glowfin.',
    home: 'fisher.bed',
    schedule: [
      B(0, 6, 'fisher.bed', 'asleep'),
      B(6, 12, 'pond_south', 'fishing'),
      B(12, 13, 'plaza_a', 'selling the morning catch'),
      B(13, 18, 'pond_south', 'fishing'),
      B(18, 21, 'inn.table', 'at the inn'),
      B(21, 24, 'fisher.bed', 'asleep'),
    ],
    loves: ['koi', 'glowfin', 'fish_fry', 'eel'],
    likes: ['trout', 'pike', 'perch', 'blackberry'],
    hates: ['mushroom', 'slime_gel', 'egg'],
    shop: {
      name: "Marlow's Tackle",
      hours: [6, 18],
      buys: ['fish', 'bug'],
      buyBonus: 1.2,
      stock: [
        { item: 'rod', markup: 1 },
        { item: 'minnow', markup: 1.3 },
      ],
    },
    lines: {
      greet: [
        ["Shh — you'll scare the fish. And me.", 'Fishing takes patience. Standing next to me takes more.'],
        ["You're learning the tugs, aren't you? I can tell by how you stand.", 'Catch anything worth lying about yet?'],
        [
          "You're the only one who doesn't talk during a bite. I appreciate that.",
          "Stay. The pond's better with two of us.",
        ],
      ],
      work: [
        'When the line twitches, wait for the tug. Then pull on the beat.',
        'Rain brings the big ones. Eels, catfish. Bring a coat.',
        "At night, something glows down there. I've never gotten it.",
      ],
      season: [
        ['Spring: the koi come up shallow. Early morning.'],
        ['Summer: warm water, lazy fish. My favorite excuse to nap.'],
        ['Autumn: the pike get hungry. So do I.'],
        ['Winter: the pond is quiet. So am I, which is saying something.'],
      ],
      rain: ["Rain's the best time! Don't tell anyone."],
      snow: ['Cold fingers, warm heart, slow bites.'],
      night: ["Night fishing. Don't tell Maribel I skipped supper."],
      gift: {
        love: ["A fish like that?! I'll mount it. Over the bed. Forever."],
        like: ['Mm, nice. Thanks.'],
        neutral: ['Thanks.'],
        hate: ['Ugh. Fine. Thanks.'],
        again: ["Easy! One a day, or I'll start expecting them."],
      },
    },
  },
  {
    id: 'wren',
    name: 'Wren Thistle',
    title: 'Herbalist & Alchemist',
    look: 7,
    bio: 'Brews potions from roots and leftover starlight. Insists the best tonics bend probability, and that she can prove it, eventually.',
    home: 'herbalist.bed',
    schedule: [
      B(0, 7, 'herbalist.bed', 'asleep'),
      B(7, 10, 'herbalist.work', 'brewing'),
      B(10, 13, 'field_gate', 'gathering herbs'),
      B(13, 18, 'herbalist.work', 'brewing'),
      B(18, 20, 'plaza_a', 'stargazing'),
      B(20, 24, 'herbalist.bed', 'asleep'),
    ],
    loves: ['qubit_crystal', 'crocus', 'qubit_tea', 'healing_herb'],
    likes: ['daffodil', 'sunpetal', 'blackberry', 'firefly'],
    hates: ['raw_meat', 'coal', 'hopper_tooth'],
    shop: {
      name: 'Thistle & Thyme',
      hours: [7, 18],
      buys: ['forage', 'bug', 'fertilizer'],
      buyBonus: 1.15,
      stock: [
        { item: 'healing_potion', markup: 1.1 },
        { item: 'regen_potion', markup: 1.1 },
        { item: 'healing_herb', markup: 1.2 },
        { item: 'alchemy_table', markup: 1 },
      ],
    },
    lines: {
      greet: [
        ["Don't mind the fumes. They're mostly harmless.", "You smell like fresh air. That's rare around here."],
        [
          "A crop that's two crops until you look at it. I've been working on that.",
          "You're the kind who asks good questions. Ask me one.",
        ],
        [
          "You noticed it too: a plant can be two plants until it's picked. We should talk about this more.",
          "You're a friend of the experiment. Welcome.",
        ],
      ],
      work: [
        'Mix two seeds with a qubit crystal. At harvest the plant picks which one it was. Tonics tilt the odds.',
        'A good potion is just a patient question.',
      ],
      season: [
        ['Spring pollen is a gift. Or a curse. Depends on the hour.'],
        ['Summer nights are for firefly hunting.'],
        ['Autumn mushrooms are very talkative, if you know how to listen.'],
        ['Winter crocus is rare. Treasure it.'],
      ],
      rain: ["The best brews are made in the rain. Don't ask why."],
      snow: ['Frostroot tea. Try it.'],
      night: ['The stars are out. You can see the whole circuit of them.'],
      gift: {
        love: ['Oh! It hums! Where did you find this?'],
        like: ["How lovely. I'll use it."],
        neutral: ['Oh. Thank you.'],
        hate: ['That… will go straight to the compost. Thank you for the thought.'],
        again: ['One a day — the universe prefers it that way.'],
      },
      teach: "Come to my table. I'll show you how to tilt a superposed crop.",
    },
  },
  {
    id: 'pippa',
    name: 'Pippa Loomis',
    title: 'Tailor',
    look: 0,
    bio: 'Wears a different outfit every day and has opinions about yours. Says clothes are the first thing people remember.',
    home: 'tailor.bed',
    schedule: [
      B(0, 8, 'tailor.bed', 'asleep'),
      B(8, 17, 'tailor.work', 'at the loom'),
      B(17, 19, 'plaza_d', 'people-watching'),
      B(19, 22, 'inn.table', 'at the inn'),
      B(22, 24, 'tailor.bed', 'asleep'),
    ],
    loves: ['crocus', 'sunpetal', 'cloth', 'fruit_pie'],
    likes: ['daffodil', 'feather', 'blackberry', 'berry_jam'],
    hates: ['coal', 'slime_gel', 'raw_meat'],
    shop: {
      name: 'Loomis & Daughter',
      hours: [8, 17],
      buys: ['material', 'outfit', 'forage'],
      buyBonus: 1.1,
      stock: [
        { item: 'cloth', markup: 1.1 },
        { item: 'outfit_traveler', markup: 1 },
        { item: 'loom', markup: 1 },
      ],
    },
    lines: {
      greet: [
        ["Oh, that coat. We'll fix that. Gently.", "Everything's better with a little color."],
        ["You've got an eye for colors now, I can tell.", 'Come by the loom later, I have an idea for you.'],
        ["You wear everything well. It's infuriating.", 'My best work was always for friends.'],
      ],
      work: [
        "A dye is just a plant's secret, told on cloth.",
        "I've got some threads that shift when you're not looking.",
      ],
      season: [
        ['Spring pastels! The whole village looks like a bakery window.'],
        ['Summer linen. Everyone suddenly has legs.'],
        ['Autumn colors are my favorites. Pure rust and gold.'],
        ['Winter wool. Layers, my darling, layers.'],
      ],
      rain: ["Never wear your good cloak in the rain. I'd know."],
      snow: ['Snow is the only thing that makes white look good on everyone.'],
      night: ['Candlelit sewing is the best sewing.'],
      gift: {
        love: ["This is gorgeous! I'm framing it. Or wearing it. Or both."],
        like: ['Mm, lovely!'],
        neutral: ['How kind.'],
        hate: ['Oh. Well. Not my color.'],
        again: ['Too much! One a day, darling.'],
      },
      teach: "I'll teach you the sky-weave, if you'll sit still long enough.",
    },
  },
  {
    id: 'odo',
    name: 'Odo Plank',
    title: 'Carpenter',
    look: 4,
    bio: 'Gruff, kind, and always sawdust-dusted. Builds things quickly and then renovates them out of spite.',
    home: 'carpenter.bed',
    schedule: [
      B(0, 7, 'carpenter.bed', 'asleep'),
      B(7, 12, 'carpenter.work', 'building'),
      B(12, 13, 'plaza_b', 'on a lunch break'),
      B(13, 17, 'carpenter.work', 'building'),
      B(17, 20, 'pond_west', 'by the pond'),
      B(20, 24, 'carpenter.bed', 'asleep'),
    ],
    loves: ['plank', 'heartwood', 'grilled_meat', 'hearty_stew'],
    likes: ['wood', 'iron_ingot', 'omelet', 'fish_fry'],
    hates: ['cloth', 'daffodil', 'berry_jam'],
    shop: {
      name: 'Plank & Peg',
      hours: [7, 17],
      buys: ['material', 'resource'],
      buyBonus: 1.1,
      stock: [
        { item: 'plank', markup: 1.2 },
        { item: 'wood', markup: 1.2 },
        { item: 'chair', markup: 1.2 },
        { item: 'table', markup: 1.2 },
        { item: 'bed', markup: 1.2 },
        { item: 'shelf', markup: 1.2 },
        { item: 'carpenter_bench', markup: 1 },
      ],
    },
    lines: {
      greet: [
        ['Mind the sawdust. And the saw.', 'You need something built, or just ambling?'],
        ["Back for more wood, eh? Good. I've got a surplus.", "You've got hands. Good. Not everyone does."],
        [
          "You'd make a decent carpenter. Don't let it go to your head.",
          "Come on, hold this beam. I'll tell you a story about it.",
        ],
      ],
      work: ['Measure twice, cut once, swear thrice.', "A coop needs planks and hay. Don't skimp on the roof."],
      season: [
        ['Spring: everybody wants a new fence. Every year.'],
        ['Summer: sawdust and sweat. A perfect combo.'],
        ['Autumn, the building season. Cold hands, warm work.'],
        ['Winter, I build indoors. And I build a lot of chairs.'],
      ],
      rain: ["Rain's the only time I stop. Wood and water, never friends."],
      snow: ['Snow on the beams. Pretty, but heavy.'],
      night: ['Quiet shop, quiet mind.'],
      gift: {
        love: ["That's fine work. Fine. I'll keep it."],
        like: ['Hm. Good. Thank you.'],
        neutral: ['Hm. Thanks.'],
        hate: ['Oh for— no. Take it. No, keep it. Whatever.'],
        again: ["One a day, I said. Weren't you listening?"],
      },
    },
  },
  {
    id: 'juniper',
    name: 'Juniper Vale',
    title: 'Young Scout',
    look: 6,
    bio: 'Eleven, fearless, and convinced the wilds are full of secrets. Is usually right, and usually wet from something.',
    home: 'scout.bed',
    schedule: [
      B(0, 8, 'scout.bed', 'asleep'),
      B(8, 11, 'plaza_a', 'playing in the plaza'),
      B(11, 14, 'field_gate', 'watching the farm'),
      B(14, 18, 'plaza_c', 'playing in the plaza'),
      B(18, 22, 'plaza_d', 'telling rumors'),
      B(22, 24, 'scout.bed', 'asleep'),
    ],
    loves: ['butterfly', 'dragonfly', 'strawberry', 'fruit_pie'],
    likes: ['firefly', 'ladybug', 'blackberry', 'berry_jam'],
    hates: ['coal', 'raw_meat', 'mushroom'],
    lines: {
      greet: [
        [
          'Hi! Are you an adventurer? You look like an adventurer.',
          'Did you see the slimes by the road? I named one Gerald.',
        ],
        [
          "You're my friend, right? Friends tell each other secrets.",
          "I found a spot with the BEST flowers. Maybe I'll show you.",
        ],
        ["You're the coolest. Don't tell Mayor Orla I said that.", 'You want to hear a rumor? I have so many!'],
      ],
      work: [
        'Nobody believes me about the glowing fish. I saw it. It was glowing.',
        'Wanna catch bugs? I know where the butterflies hang out.',
      ],
      season: [
        ["Spring! Butterflies everywhere. I'm a butterfly expert now."],
        ['Summer is the best. Fireflies. Dragonflies. Everything-flies.'],
        ['Autumn! The leaves are all crunchy. I tested.'],
        ['Winter! SNOW. Every day. Forever.'],
      ],
      rain: ['Puddles! Puddles are the best.'],
      snow: ['SNOW! Snowball? Snowball!'],
      night: ["I'm not tired. You're tired."],
      gift: {
        love: ['WOW! This is the best present ever! EVER!'],
        like: ['Cool! Thanks!'],
        neutral: ['Thanks, I guess!'],
        hate: ['Ew. Why would you…?'],
        again: ["One per day! That's the rule! I made it up!"],
      },
    },
  },
];

// Original coastal residents use the same schedules, friendship, gifts, shops and persistence as Hadamere.
NPCS.push(
  ...PORT_RESIDENTS.map((n): NpcDef => {
    const port = PORTS.find((p) => p.id === n.port)!;
    const keepsake = ['daffodil', 'fish_fry', 'healing_herb', 'cloth', 'qubit_crystal', 'fruit_pie'][n.index % 6]!;
    const habits = [
      'collects old sea charts',
      'repairs things rather than replacing them',
      'writes letters by lantern light',
      'keeps a rooftop herb garden',
      'knows every local bird call',
      'brews very strong tea',
      'carves tiny wooden boats',
      'keeps the harbour weather log',
    ][n.index % 8]!;
    const greet = `I'm ${n.name}. I work as ${n.title.toLowerCase()} here in ${port.name}.`;
    return {
      id: n.id,
      name: n.name,
      title: n.title,
      look: n.index % 8,
      settlement: port.id,
      bio: `${n.name}, ${port.name}'s ${n.title.toLowerCase()}, ${habits}.`,
      home: `${n.id}.home`,
      schedule: [
        B(0, 7, `${n.id}.home`, 'asleep'),
        B(7, 9, `${n.id}.quay`, 'watching the harbour'),
        B(9, 18, `${n.id}.work`, `working as ${n.title.toLowerCase()}`),
        B(18, 21, `${n.id}.quay`, 'sharing harbour stories'),
        B(21, 24, `${n.id}.home`, 'asleep'),
      ],
      loves: [keepsake],
      likes: ['fish_fry', 'cloth', 'blueberry'],
      hates: ['slime_gel', 'raw_meat'],
      ...(n.local % 3 === 0
        ? {
            shop: {
              name: `${n.name.split(' ')[0]}'s Harbour Goods`,
              hours: [9, 18] as [number, number],
              buyBonus: 1,
              buys: ['fish', 'forage', 'resource'] as ItemKind[],
              stock: [
                { item: 'cloth', markup: 1.25 },
                { item: 'healing_potion', markup: 1.4 },
                { item: 'plank', markup: 1.2 },
                { item: n.local % 2 ? 'rod' : 'hay', markup: 1.1 },
              ],
            },
          }
        : {}),
      lines: {
        greet: [
          [greet],
          [`Good to see you again. ${port.name} is starting to know your footsteps.`],
          [`There you are, my friend. Stay for a cup before you sail.`],
        ],
        work: [
          `A ${n.title.toLowerCase()}'s work is never quite done.`,
          `When the work is finished, I ${habits.replace(/^(\w+)s /, '$1 ')}.`,
        ],
        season: [
          [`Spring brings fresh sails to ${port.name}.`],
          ['The long light makes the sea look endless.'],
          ['We mend the quay before the autumn storms.'],
          ['Ice on the ropes this morning. Watch your step.'],
        ],
        rain: ['The harbour smells different before a storm.'],
        snow: ['Keep your hands warm. Cold knots are stubborn knots.'],
        night: ['Lanterns mark the safe way home.'],
        gift: {
          love: [`${keepsake.replaceAll('_', ' ')}! You remembered. Thank you.`],
          like: ['A thoughtful gift. You have a place at my table.'],
          neutral: ['Thank you for thinking of me.'],
          hate: ['Please keep this away from the clean nets.'],
          again: ['One gift is plenty for today, friend.'],
        },
      },
    };
  }),
);

NPCS.push(
  ...CAVE_RESIDENTS.map((n): NpcDef => {
    const port = CAVE_TOWNS.find((p) => p.id === n.town)!;
    const keepsake = ['daffodil', 'fish_fry', 'healing_herb', 'cloth', 'qubit_crystal', 'fruit_pie'][n.index % 6]!;
    const habits = [
      'collects old survey maps',
      'repairs things rather than replacing them',
      'writes letters by lantern light',
      'keeps a glowcap nursery',
      'knows every echo in the galleries',
      'brews very strong tea',
      'carves little stone lanterns',
      'keeps the lift maintenance log',
    ][(n.index + 3) % 8]!;
    const greet = `I'm ${n.name}. I work as ${n.title.toLowerCase()} here in ${port.name}. ${n.culture}`;
    return {
      id: n.id,
      name: n.name,
      title: n.title,
      look: (n.index + 3) % 8,
      settlement: port.id,
      bio: `${n.name}, ${port.name}'s ${n.title.toLowerCase()}, ${habits}.`,
      home: `${n.id}.home`,
      schedule: [
        B(0, 7, `${n.id}.home`, 'asleep'),
        B(7, 9, `${n.id}.square`, 'watching the cavern'),
        B(9, 18, `${n.id}.work`, `working as ${n.title.toLowerCase()}`),
        B(18, 21, `${n.id}.square`, 'sharing cavern stories'),
        B(21, 24, `${n.id}.home`, 'asleep'),
      ],
      loves: [keepsake],
      likes: ['fish_fry', 'cloth', 'blueberry'],
      hates: ['slime_gel', 'raw_meat'],
      ...([1, 2, 5].includes(n.local)
        ? {
            shop: {
              name: `${n.name.split(' ')[0]}'s Cavern Provisions`,
              hours: [0, 24] as [number, number],
              buyBonus: 1,
              buys: ['fish', 'forage', 'resource'] as ItemKind[],
              stock: (n.local === 2
                ? ['healing_potion', 'healing_herb', 'fruit_pie']
                : n.local === 5
                  ? ['iron_ingot', 'copper_ingot', 'coal']
                  : ['cloth', 'plank', 'rod']
              ).map((item) => ({ item, markup: 1.3 })),
            },
          }
        : {}),
      lines: {
        greet: [
          [greet],
          [`Good to see you again. ${port.name} is starting to know your footsteps.`],
          [`There you are, my friend. Stay for a cup before you explore.`],
        ],
        work: [
          `A ${n.title.toLowerCase()}'s work is never quite done.`,
          `When the work is finished, I ${habits.replace(/^(\w+)s /, '$1 ')}.`,
        ],
        season: [
          [`Spring brings new travellers to ${port.name}.`],
          ['The crystals keep their own season.'],
          ['We inspect every lift before the autumn rains.'],
          ['Cold seeps down the shafts. Share a warm meal.'],
        ],
        rain: ['Rain above means rising water below. Keep to the survey roads.'],
        snow: ['Keep your hands warm. Cold tools are stubborn tools.'],
        night: ['Lanterns mark the safe way home.'],
        gift: {
          love: [`${keepsake.replaceAll('_', ' ')}! You remembered. Thank you.`],
          like: ['A thoughtful gift. You have a place at my table.'],
          neutral: ['Thank you for thinking of me.'],
          hate: ['Please keep this away from the archive.'],
          again: ['One gift is plenty for today, friend.'],
        },
      },
    };
  }),
);

export const NPC_BY_ID: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));

/**
 * The travelling merchants of Undercroft 2 (world revision 4). They are deliberately not part of `NPCS` (revisions 2
 * and 3 have no delver camps); the village system adds them to a revision-4 world, giving each a round of three camps
 * (spots `<id>.c0..c2` stalls and `<id>.r2` the bedroll) so the stall moves through the day.
 */
export const DELVER_MERCHANTS: NpcDef[] = (
  [
    {
      id: 'delver_odo',
      name: 'Odo Peddlewick',
      title: 'Ore Peddler',
      look: 5,
      bio: 'Pushes a hand-cart of picks, coal and ingots from camp to camp, and swears he has never once taken the same tunnel twice.',
      shop: {
        name: "Peddlewick's Ore Cart",
        stock: ['pickaxe', 'coal', 'copper_ingot', 'iron_ingot', 'plank'],
        buys: ['resource'] as Array<ItemKind | 'all'>,
        bonus: 1.15,
      },
      loves: ['iron_ingot', 'gold_ore'],
      likes: ['coal', 'copper_ore', 'silver_ore'],
      hates: ['slime_gel', 'raw_meat'],
      line: 'Fresh from the lower galleries. Mind the cart, it bites.',
    },
    {
      id: 'delver_marla',
      name: 'Marla Quillon',
      title: 'Delver Apothecary',
      look: 6,
      bio: 'A field apothecary who follows the delvers down and trades poultices for stories, preferably gory ones.',
      shop: {
        name: "Quillon's Cave Remedies",
        stock: ['healing_potion', 'regen_potion', 'might_potion', 'ward_potion', 'cloth'],
        buys: ['forage', 'resource'] as Array<ItemKind | 'all'>,
        bonus: 1.1,
      },
      loves: ['healing_herb', 'qubit_crystal'],
      likes: ['fiber', 'slime_gel', 'cloth'],
      hates: ['raw_meat'],
      line: 'Bleeding? Bruised? Burning? I have a bottle for each and a lecture for all three.',
    },
    {
      id: 'delver_tobin',
      name: 'Tobin Gleamfoot',
      title: 'Lamp Trader',
      look: 7,
      bio: 'Sells light by the bottle. Swears the caves get darker every season and that his lanterns are the only honest answer.',
      shop: {
        name: "Gleamfoot's Lamps & Lights",
        stock: ['lantern_potion', 'plank', 'cloth', 'coal'],
        buys: ['resource', 'forage'] as Array<ItemKind | 'all'>,
        bonus: 1.1,
      },
      loves: ['qubit_crystal', 'lantern_potion'],
      likes: ['coal', 'fiber'],
      hates: ['slime_gel'],
      line: 'Mind the dark. It minds you back. A light, friend?',
    },
    {
      id: 'delver_sable',
      name: 'Sable Rook',
      title: 'Gem Broker',
      look: 2,
      bio: 'Buys anything that glitters and sells almost nothing, which is how she has stayed alive so long in the deep.',
      shop: {
        name: "Rook's Assay Table",
        stock: ['silver_ingot', 'gold_ingot'],
        buys: ['all'] as Array<ItemKind | 'all'>,
        bonus: 1.3,
      },
      loves: ['qubit_crystal', 'gold_ore'],
      likes: ['silver_ore', 'gold_ingot', 'silver_ingot'],
      hates: ['slime_gel', 'raw_meat', 'fiber'],
      line: 'Show me something that glitters, and try not to haggle. I enjoy it too much.',
    },
  ] as const
).map((m): NpcDef => {
  const first = m.name.split(' ')[0]!;
  return {
    id: m.id,
    name: m.name,
    title: m.title,
    bio: m.bio,
    look: m.look,
    home: `${m.id}.r2`,
    schedule: [
      B(0, 6, `${m.id}.r2`, 'asleep by the fire'),
      B(6, 12, `${m.id}.c0`, 'trading at the first camp'),
      B(12, 18, `${m.id}.c1`, 'trading at the second camp'),
      B(18, 22, `${m.id}.c2`, 'trading at the third camp'),
      B(22, 24, `${m.id}.r2`, 'asleep by the fire'),
    ],
    loves: [...m.loves],
    likes: [...m.likes],
    hates: [...m.hates],
    shop: {
      name: m.shop.name,
      hours: [6, 22],
      buyBonus: m.shop.bonus,
      buys: [...m.shop.buys],
      stock: m.shop.stock.map((item) => ({ item, markup: 1.35 })),
    },
    lines: {
      greet: [
        [m.line, `${first}, travelling trader. I will be at the next camp by midday, if you miss me.`],
        [`Back again! You are the sort who knows where the good tunnels are.`],
        [`There you are, friend. I kept something back for you, under the cart.`],
      ],
      work: ['Prices are fixed. Tempers are not.', 'A trader who stops walking stops eating.'],
      season: [
        ['Spring thaw means rising water on the low roads.'],
        ['Summer is slow underground. The cold keeps the dust down.'],
        ['Autumn brings the crowds. Everyone wants one last find before winter.'],
        ['Winter is the best trade there is: everyone below, everyone bored.'],
      ],
      rain: ['Rain above, drips below. Keep your matches dry.'],
      snow: ['Snow topside means company in the camps. Good for business.'],
      night: ['The camp fires are kept low at night. Whisper, friend.'],
      gift: {
        love: [`For me? ${first} does not blush. It is the firelight.`],
        like: ['That is kind. I will find a place for it on the cart.'],
        neutral: ['Thank you. Everything finds a buyer eventually.'],
        hate: ['Ah. I will not say what I think of that.'],
        again: ['One gift a day keeps the books balanced.'],
      },
    },
  };
});
for (const m of DELVER_MERCHANTS) NPC_BY_ID[m.id] = m;

// ── friendship
export const POINTS_PER_HEART = 40;
export const MAX_HEARTS = 10;
export const hearts = (pts: number): number => Math.min(MAX_HEARTS, Math.floor(pts / POINTS_PER_HEART));
export const tierOf = (pts: number): 0 | 1 | 2 => {
  const h = hearts(pts);
  return h >= 7 ? 2 : h >= 3 ? 1 : 0;
};

export type GiftTaste = 'love' | 'like' | 'neutral' | 'hate';
export function giftTaste(npc: NpcDef, itemId: string): GiftTaste {
  if (npc.loves.includes(itemId)) return 'love';
  if (npc.hates.includes(itemId)) return 'hate';
  if (npc.likes.includes(itemId)) return 'like';
  return 'neutral';
}
export const GIFT_POINTS: Record<GiftTaste, number> = { love: 40, like: 20, neutral: 6, hate: -20 };
export const TALK_POINTS = 8;

// ── schedule
const OUTDOOR = /^(plaza|pond|field)/;
export function scheduleAt(npc: NpcDef, hour: number, weather: Weather): ScheduleBlock {
  const b = npc.schedule.find((s) => hour >= s.h0 && hour < s.h1) ?? npc.schedule[0]!;
  const bad = weather === 'rain' || weather === 'storm' || weather === 'snow';
  if (bad && OUTDOOR.test(b.spot)) {
    const shelter = b.spot.startsWith('field')
      ? 'farmhouse.work'
      : npc.id === 'sedge'
        ? 'inn.table'
        : npc.home.startsWith('inn') || npc.home.startsWith('store')
          ? npc.home.replace('.in', '.work')
          : 'inn.table';
    return { ...b, spot: shelter, doing: 'sheltering from the weather' };
  }
  return b;
}

// ── dialogue selection (scripted; the optional AI layer wraps this and always falls back to it)
export function pickLine(
  npc: NpcDef,
  ctx: { pts: number; hour: number; season: number; weather: Weather; talkedToday: boolean; rand: () => number },
): string {
  const pick = (a: string[]) => a[Math.floor(ctx.rand() * a.length)]!;
  const L = npc.lines;
  if (ctx.hour >= 21 || ctx.hour < 5) return pick(L.night);
  const r = ctx.rand();
  if (ctx.weather === 'rain' || ctx.weather === 'storm') {
    if (r < 0.35) return pick(L.rain);
  } else if (ctx.weather === 'snow') {
    if (r < 0.35) return pick(L.snow);
  }
  if (r < 0.55) return pick(L.work);
  if (r < 0.75) return pick(L.season[ctx.season]!);
  return pick(L.greet[tierOf(ctx.pts)]);
}

export const RUMOR_TEMPLATES: Record<string, string> = {
  harvest: '{who} brought in a fine harvest of {what}.',
  rare_fish: '{who} landed a {what}! At the pond!',
  perfect_forge: "{who} forged a Perfect {what} at Brannoch's anvil.",
  gift_love: '{who} gave {npc} exactly what they wanted.',
  boss_slain: '{who} defeated something terrible out in the wilds.',
  level: '{who} is becoming quite the adventurer.',
};

/** Is this villager's shop open at `hour`? (Shops without hours are always open.) */
export const shopOpen = (npc: NpcDef, hour: number): boolean =>
  !npc.shop?.hours || (hour >= npc.shop.hours[0] && hour < npc.shop.hours[1]);
/** Is the villager at work right now (for dialogue colour and ambient chatter)? */
export const isWorking = (doing: string): boolean =>
  /work|forge|cook|counter|field|fishing|brewing|loom|building|desk|tending|minding/.test(doing);
export const hoursText = (h: [number, number]): string =>
  `${String(h[0]).padStart(2, '0')}:00-${String(h[1] % 24).padStart(2, '0')}:00`;

export const SHOP_NPCS = [...NPCS, ...DELVER_MERCHANTS].filter((n) => n.shop).map((n) => n.id);
export const itemExists = (id: string): boolean => !!ITEMS[id];
