import { ITEMS, type Stack } from './items';
import { CROPS } from './crops';
import { FORAGE_BY_SEASON } from './nodes';
import { hash2 } from './rng';

/**
 * What the server counts toward a quest objective.
 * `deliver` objectives are not counted from events: progress is the number of the item in the pack, and the items are
 * handed over (consumed) when the quest is turned in. `read` is reading a sign/lore object (target = its sub, e.g. 'statue').
 */
export type ObjectiveType = 'gain' | 'craft' | 'plant' | 'harvest' | 'forge' | 'fish' | 'bug' | 'kill' | 'talk' | 'gift' | 'smelt' | 'discover' | 'place' | 'sell'
  | 'deliver' | 'read';
/**
 * `target` is an item id / npc id / enemy key / object sub. Patterns: '*' anything of that type, '#kind' any item of that
 * kind (e.g. '#forage', '#fish'), '@station' anything crafted at that station (e.g. '@cooking_pot').
 */
export interface Objective { type: ObjectiveType; target: string; n: number; label: string }
export interface QuestDef {
  id: string;
  giver: string;
  title: string;
  /** shown in the quest log */
  summary: string;
  objectives: Objective[];
  rewards: { coins: number; items?: Stack[]; friend?: number; xp?: number; /** recipe id taught on completion */ recipe?: string };
  /** quests that must be done first */
  requires?: string[];
  lines: { offer: string; progress: string; done: string };
  /** daily request-board job (procedurally generated, expires) */
  daily?: { day: number };
  /** where to hand it in, in words (journal) */
  where?: string;
}

/** A quest-relevant thing that happened. `kind`/`station` let pattern targets match. */
export interface QuestEvent { type: ObjectiveType; target: string; n: number; kind?: string; station?: string }

const q = (d: QuestDef): QuestDef => d;
export const QUESTS: QuestDef[] = [
  q({ id: 'welcome', giver: 'orla', title: 'A Warm Welcome', summary: 'Meet the villagers of Hadamere: the carpenter, the smith, the storekeeper. Then come back to Mayor Orla.', where: 'Mayor Orla (Town Hall, north side of the plaza)',
    objectives: [{ type: 'talk', target: 'odo', n: 1, label: 'Talk to Odo the carpenter (north-east house)' }, { type: 'talk', target: 'brannoch', n: 1, label: 'Talk to Brannoch at the smithy (north-west)' }, { type: 'talk', target: 'tobin', n: 1, label: 'Talk to Tobin at the General Store (west)' }],
    rewards: { coins: 60, items: [{ id: 'fertilizer', n: 3 }], friend: 20 },
    lines: { offer: 'Welcome, welcome! Hadamere always has room for another pair of hands. Do introduce yourself around: Odo the carpenter, Brannoch at the smithy, and Tobin at the store. Then come back and tell me what you think of them. Honestly. I keep notes.', progress: 'Have you met everyone yet? Odo, Brannoch and Tobin. Follow the streets; every door has a path to it.', done: 'Splendid! A village is only as strong as its introductions. I have written you into the Ledger of Arrivals, in my best ink. Here, a little something for the road.' } }),
  q({ id: 'qubitman', giver: 'orla', title: 'The Hero in the Square', summary: 'Read the plaque on the Statue of QubitMan in the middle of the plaza, then tell Orla what you learned.', requires: ['welcome'], where: 'Mayor Orla',
    objectives: [{ type: 'read', target: 'statue', n: 1, label: 'Read the statue in the plaza (walk up to it and press E)' }],
    rewards: { coins: 40, items: [{ id: 'qubit_tea', n: 1 }], friend: 20 },
    lines: { offer: 'Every newcomer must pay their respects to QubitMan. Not a law. Well. A by-law. Go and read his plaque in the middle of the plaza, and then you will understand why everyone here says it with a straight face.', progress: 'The statue is right in the middle of the plaza. You can\'t miss him. Many have tried.', done: 'ALL HAIL QUBITMAN! There, you said it too, I saw your lips move. Have some qubit tea. It\'s what he would have wanted. Probably. Possibly. Both.' } }),
  q({ id: 'timber', giver: 'odo', title: 'Timber!', summary: 'Chop trees with your axe and bring Odo 12 wood.', requires: ['welcome'], where: 'Odo (carpenter\'s house, north-east)',
    objectives: [{ type: 'deliver', target: 'wood', n: 12, label: 'Bring 12 wood' }],
    rewards: { coins: 40, items: [{ id: 'plank', n: 6 }], friend: 20 },
    lines: { offer: 'You look like you\'ve got arms. I\'m short on timber. Twelve wood and I\'ll make it worth your while. Select your axe, face a tree and hold E. Trees grow back, before you start feeling guilty.', progress: 'Still need that wood. Axe, tree, hold E. The tree does the rest.', done: 'Good, clean timber. Here are some planks, and the friendship of a very grumpy carpenter. Don\'t spend it all at once.' } }),
  q({ id: 'stone', giver: 'brannoch', title: 'Rocks and Hard Places', summary: 'Mine stone and coal and bring them to Brannoch.', requires: ['welcome'], where: 'Brannoch (smithy, north-west)',
    objectives: [{ type: 'deliver', target: 'stone', n: 12, label: 'Bring 12 stone' }, { type: 'deliver', target: 'coal', n: 2, label: 'Bring 2 coal' }],
    rewards: { coins: 50, items: [{ id: 'copper_ore', n: 4 }], friend: 20 },
    lines: { offer: 'A forge eats stone and coal. Mine me a dozen stones and a pair of coal from the boulders around the village. Pickaxe. Hold E. Coal hides in the darker rocks.', progress: 'Stones and coal. Boulders, pickaxe. It\'s not complicated.', done: 'Hm. Decent haul. Take this ore. You\'ll learn to smelt it next.' } }),
  q({ id: 'smelt', giver: 'brannoch', title: 'Hot Metal', summary: 'Use a furnace (there is one in the smithy) to smelt a copper ingot.', requires: ['stone'], where: 'Brannoch',
    objectives: [{ type: 'smelt', target: 'copper_ingot', n: 1, label: 'Smelt a copper ingot at a furnace' }],
    rewards: { coins: 70, items: [{ id: 'copper_ore', n: 6 }, { id: 'coal', n: 3 }], friend: 20 },
    lines: { offer: 'Ore is nothing until it\'s metal. My furnace is free to use: walk up to it, press E. Two copper ore and a coal make an ingot. Try it.', progress: 'Furnace: two ore, one coal. Go on. It won\'t bite. The anvil bites.', done: 'Your first ingot! Feel how warm it is? That\'s pride. Keep the extra ore. Now for the real art: forging.' } }),
  q({ id: 'forged', giver: 'brannoch', title: 'Forged in Phase', summary: 'Forge your first item at an anvil, using two or three metals, and hit the beats.', requires: ['smelt'], where: 'Brannoch',
    objectives: [{ type: 'forge', target: '*', n: 1, label: 'Forge something at an anvil' }],
    rewards: { coins: 150, items: [{ id: 'iron_ingot', n: 2 }], friend: 30 },
    lines: { offer: 'Now the art. At the anvil, combine metals. Same phase colours reinforce each other, opposite colours cancel flaws. Then strike on the beat. Forge anything. A spoon. I won\'t judge. Much.', progress: 'The anvil is waiting. Two metals. Hit the beats. Listen to the metal, not your hands.', done: 'Heh! Not bad for a first strike. Here: iron for your next project. Come back when you\'ve made something that sings.' } }),
  q({ id: 'seeds', giver: 'fenwick', title: 'Greenthumb', summary: 'Till soil with the hoe, plant 4 seeds and water them.', requires: ['welcome'], where: 'Fenwick (the fields east of the plaza)',
    objectives: [{ type: 'plant', target: '*', n: 4, label: 'Plant 4 seeds' }],
    rewards: { coins: 40, items: [{ id: 'fertilizer', n: 4 }], friend: 20 },
    lines: { offer: 'Folks who farm never leave. Use your hoe on grass, plant seeds on the tilled soil, water every day. The community garden by my house is free to use, and already tilled.', progress: 'Four seeds in the ground. Hoe first, then seeds, then the watering can.', done: 'Look at that! Now water them every day, or pray for rain. I do both.' } }),
  q({ id: 'harvest', giver: 'fenwick', title: 'The First Harvest', summary: 'Grow and harvest 3 crops. Crops need a few days of watering.', requires: ['seeds'], where: 'Fenwick',
    objectives: [{ type: 'harvest', target: '*', n: 3, label: 'Harvest 3 crops' }],
    rewards: { coins: 90, items: [{ id: 'sprinkler_1', n: 1 }], friend: 30 },
    lines: { offer: 'Come back when something is ripe. Crops take a few days of watering. A day here is twenty-four minutes of your life, give or take a nap.', progress: 'Watered daily? Ripe crops look heavy and proud. Press E on them.', done: 'A farmer is born! Take this sprinkler. It waters the four tiles around it every morning. Your back will thank me.' } }),
  q({ id: 'fishing', giver: 'sedge', title: 'Something Fishy', summary: 'Catch a fish. Cast at water, wait for the "!", press E, then hit the beats.', requires: ['welcome'], where: 'Sedge (the pond south of the plaza)',
    objectives: [{ type: 'fish', target: '*', n: 1, label: 'Catch a fish' }],
    rewards: { coins: 45, friend: 25, items: [{ id: 'minnow', n: 3 }] },
    lines: { offer: 'The pond\'s full of them. Select your rod, face the water, press E. Wait for the bite. When you see the "!", press E again, then pull on the beats.', progress: 'Cast, wait for the "!", press E, then the beats. Patience. Fish can smell hurry.', done: 'You\'re a fisher now. Don\'t let it go to your head. We\'ll talk about the glowfin another day.' } }),
  q({ id: 'bigcatch', giver: 'sedge', title: 'Five on the Line', summary: 'Catch 5 more fish of any kind.', requires: ['fishing'], where: 'Sedge',
    objectives: [{ type: 'fish', target: '*', n: 5, label: 'Catch 5 fish' }],
    rewards: { coins: 110, items: [{ id: 'fish_fry', n: 2 }], friend: 30, recipe: 'fish_fry' },
    lines: { offer: 'One fish is luck. Five is a habit. Bring the habit and I\'ll show you how Maribel fries them.', progress: 'Rain brings the big ones. Night brings the strange ones.', done: 'Five. Good habit. Here, this is how you fry a perch: hot pot, a bit of wood, don\'t look away. Now you know.' } }),
  q({ id: 'bugs', giver: 'juniper', title: 'Bug Hunt', summary: 'Catch 3 bugs with your net in flowers and tall grass.', requires: ['welcome'], where: 'Juniper (usually playing in the plaza)',
    objectives: [{ type: 'bug', target: '*', n: 3, label: 'Catch 3 bugs' }],
    rewards: { coins: 35, friend: 30, items: [{ id: 'healing_herb', n: 3 }] },
    lines: { offer: 'Wanna catch bugs?! Select your net and press E on flowers or tall grass. Butterflies by day, fireflies at night! Three! Three is the official number!', progress: 'Three bugs! Flowers and tall grass. Net! Swoosh!', done: 'YAY! You\'re officially my favorite grown-up. Don\'t tell Odo. He thinks he is.' } }),
  q({ id: 'slimes', giver: 'juniper', title: 'Gerald\'s Cousins', summary: 'Defeat 3 Wisp Slimes on the roads around Hadamere.', requires: ['bugs'], where: 'Juniper',
    objectives: [{ type: 'kill', target: 'slime', n: 3, label: 'Defeat 3 Wisp Slimes' }],
    rewards: { coins: 80, friend: 30, items: [{ id: 'healing_potion', n: 2 }] },
    lines: { offer: 'Gerald is a nice slime. His cousins are NOT nice slimes. They keep wobbling at the travelers on the road. Can you bonk three of them? Not Gerald. Gerald is the one with the smile.', progress: 'Three cousins! Attack with J or click. Dodge the red circles with Space!', done: 'You did it! Gerald says thank you. He said it with a wobble. I speak wobble.' } }),
  q({ id: 'workbench', giver: 'odo', title: 'A Bench of Your Own', summary: 'Craft a workbench (press C: 10 wood + 4 stone) and place it.', requires: ['timber'], where: 'Odo',
    objectives: [{ type: 'craft', target: 'workbench', n: 1, label: 'Craft a workbench (press C)' }, { type: 'place', target: 'workbench', n: 1, label: 'Place it (select it, press E on open ground)' }],
    rewards: { coins: 60, items: [{ id: 'chest', n: 1 }], friend: 15 },
    lines: { offer: 'Every builder needs a bench. Press C for field crafting: ten wood and four stone. Then select it in your quick-bar and press E on open ground. Bench. Done. Easy.', progress: 'Wood and stone, press C. Then E to put it down somewhere flat.', done: 'There it is. A bench of your own. Here, a chest for all your junk. Everyone has junk. I have a whole shed.' } }),
  q({ id: 'supper', giver: 'maribel', title: 'Soup\'s On', summary: 'Cook any dish at a cooking pot (there is one in the inn kitchen).', requires: ['welcome'], where: 'Maribel (The Crooked Spoon inn, north of the plaza)',
    objectives: [{ type: 'craft', target: '@cooking_pot', n: 1, label: 'Cook something at a cooking pot' }],
    rewards: { coins: 50, items: [{ id: 'veggie_stew', n: 1 }], friend: 30 },
    lines: { offer: 'Everyone who stays in Hadamere learns to cook, or they learn to starve politely at my tables. Use my pot in the kitchen. A potato and a stick of wood make a roast potato. Start there, dear.', progress: 'The pot\'s in my kitchen, by the counter. Potato and wood. Or experiment! Throw things together and see what happens. That\'s how I invented stew. Allegedly.', done: 'Oh, it smells lovely! You\'ve got the knack. Take a bowl of my stew, for comparison. Not competition. Comparison.' } }),
  q({ id: 'threads', giver: 'pippa', title: 'Threads of Fate', summary: 'Weave 3 cloth at a loom (4 fiber each). Pippa has one in her house.', requires: ['welcome'], where: 'Pippa (tailor\'s house, east of the plaza)',
    objectives: [{ type: 'craft', target: 'cloth', n: 3, label: 'Weave 3 cloth at a loom' }],
    rewards: { coins: 60, items: [{ id: 'outfit_traveler', n: 1 }], friend: 30 },
    lines: { offer: 'Darling, that coat. We need to talk about that coat. But first: cloth. Fiber comes from tall grass and bushes. Four fiber on my loom make one cloth. Make me three and I\'ll make you presentable.', progress: 'Three cloth, darling. Cut tall grass for fiber, then the loom. It\'s meditative. Mostly.', done: 'Beautiful weave! Here, a Traveler\'s Garb. Open your pack and equip it. You\'ll thank me. Everyone always thanks me. Eventually.' } }),
  q({ id: 'forager', giver: 'wren', title: 'Roots and Starlight', summary: 'Gather 5 wild forage items (look for the bright plants growing in the meadows).', requires: ['welcome'], where: 'Wren (herbalist\'s house, south-west)',
    objectives: [{ type: 'gain', target: '#forage', n: 5, label: 'Forage 5 wild plants' }],
    rewards: { coins: 55, items: [{ id: 'healing_potion', n: 1 }], friend: 30 },
    lines: { offer: 'The meadows are full of things that want to be found. Little bright plants: leeks, flowers, berries, depending on the season. Walk up and press E. Bring me the habit of looking. Five finds.', progress: 'Look for the bright plants in the grass. They come back every morning. Like questions.', done: 'Five! You have the eye. A healing potion, from my own table. It tastes like a thunderstorm. That means it works.' } }),
  q({ id: 'experiment', giver: 'wren', title: 'Two Seeds, One Plant', summary: 'Discover how to make a Superposed Seed at an alchemy table: two different seeds and a qubit crystal.', requires: ['seeds', 'forager'], where: 'Wren',
    objectives: [{ type: 'craft', target: 'superposed_seed', n: 1, label: 'Make a Superposed Seed' }],
    rewards: { coins: 120, items: [{ id: 'phase_tonic_a', n: 1 }], friend: 30 },
    lines: { offer: 'A plant that is two plants until you pick it. At my alchemy table, open the Experiment bench and put two different seeds and a qubit crystal together. Crystals glitter in the deep rock, far from town.', progress: 'Two different seeds, one qubit crystal, an alchemy table. Then plant it and wait for the collapse.', done: 'It hums! Do you hear it? Take a tonic: it tilts the odds toward the first crop. Probability is just a suggestion with good manners.' } }),
  q({ id: 'market', giver: 'tobin', title: 'Supply and Demand', summary: 'Sell 10 things to any shopkeeper in Hadamere.', requires: ['welcome'], where: 'Tobin (General Store, west)',
    objectives: [{ type: 'sell', target: '*', n: 10, label: 'Sell 10 items at shops' }],
    rewards: { coins: 50, items: [{ id: 'chest', n: 1 }], friend: 25 },
    lines: { offer: 'Lesson one of commerce: everything is worth something to somebody. Talk to any shopkeeper, choose Shop, and sell from your pack. Sell ten things. Lesson two: if everyone sells turnips, turnips get cheap. Spread it around.', progress: 'Ten sales. Any shop. Watch the prices: when the village is drowning in something, it pays less.', done: 'A natural! Here\'s a chest. Profits need somewhere to sleep.' } }),
  q({ id: 'homestead', giver: 'odo', title: 'Home Sweet Plot', summary: 'Place a chest anywhere outside of town to start your homestead.', requires: ['workbench'], where: 'Odo',
    objectives: [{ type: 'place', target: 'chest', n: 1, label: 'Place a chest' }],
    rewards: { coins: 70, items: [{ id: 'plank', n: 10 }], friend: 25 },
    lines: { offer: 'A bench is a start. A chest is a promise. Put one down where you mean to come back to. That\'s how homes begin.', progress: 'Pick a spot. Put the chest down. It doesn\'t have to be perfect. Mine leans.', done: 'There. Now you\'ve got somewhere to come home to. Have some planks. You\'ll want a fence. Everyone wants a fence.' } }),
  q({ id: 'coop', giver: 'fenwick', title: 'Feathered Friends', summary: 'Gift Fenwick something he likes, to prove you will treat animals kindly.', requires: ['harvest'], where: 'Fenwick',
    objectives: [{ type: 'gift', target: 'fenwick', n: 1, label: 'Give Fenwick a gift' }],
    rewards: { coins: 40, items: [{ id: 'hay', n: 8 }], friend: 20, recipe: 'barn' },
    lines: { offer: 'You\'re ready for animals, I reckon. But animals are a promise, same as crops. Bring me a little something, so I know you\'re the giving kind. A corn, a potato, an egg. Whatever you can spare.', progress: 'A little gift. Choose "Give a gift" when we talk. Nothing fancy.', done: 'That settles it. I\'ll show you how a barn goes up. Here\'s hay for your first chickens. Coops are at my farm supply. Feed them hay every day.' } }),
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((x) => [x.id, x]));
export type QuestState = { state: 'active' | 'done'; progress: number[] };
export type QuestLog = Record<string, QuestState>;

export const questsFrom = (npcId: string): QuestDef[] => QUESTS.filter((x) => x.giver === npcId);

/** Quests an NPC can offer right now (prerequisites met, not started). */
export function offerable(npcId: string, log: QuestLog): QuestDef[] {
  return questsFrom(npcId).filter((d) => !log[d.id] && (d.requires ?? []).every((r) => log[r]?.state === 'done'));
}

export const questComplete = (d: QuestDef, s: QuestState): boolean => d.objectives.every((o, i) => (s.progress[i] ?? 0) >= o.n);

/** Does an objective target match an event? */
export function targetMatches(target: string, ev: QuestEvent): boolean {
  if (target === '*' || target === ev.target) return true;
  if (target.startsWith('#')) return (ev.kind ?? ITEMS[ev.target]?.kind) === target.slice(1);
  if (target.startsWith('@')) return ev.station === target.slice(1);
  return false;
}

/** Story quests by id, request-board jobs regenerated from (seed, day, index). */
export function questDef(id: string, seed: number): QuestDef | undefined {
  return QUEST_BY_ID[id] ?? requestDef(seed, id);
}

/** Counts an event toward every active quest objective it matches. Returns the ids of quests that changed. */
export function applyQuestEvent(log: QuestLog, ev: QuestEvent, seed = 0): string[] {
  const changed: string[] = [];
  for (const [id, st] of Object.entries(log)) {
    if (st.state !== 'active') continue;
    const d = questDef(id, seed);
    if (!d) continue;
    let hit = false;
    d.objectives.forEach((o, i) => {
      if (o.type === 'deliver' || o.type !== ev.type || !targetMatches(o.target, ev)) return;
      const before = st.progress[i] ?? 0;
      if (before >= o.n) return;
      st.progress[i] = Math.min(o.n, before + ev.n);
      hit = true;
    });
    if (hit) changed.push(id);
  }
  return changed;
}

/** Recompute `deliver` progress from what is in the pack right now. Returns the ids that changed. */
export function syncDeliveries(log: QuestLog, count: (itemId: string) => number, seed = 0): string[] {
  const changed: string[] = [];
  for (const [id, st] of Object.entries(log)) {
    if (st.state !== 'active') continue;
    const d = questDef(id, seed);
    if (!d) continue;
    let hit = false;
    d.objectives.forEach((o, i) => {
      if (o.type !== 'deliver') return;
      const v = Math.min(o.n, count(o.target));
      if ((st.progress[i] ?? 0) !== v) { st.progress[i] = v; hit = true; }
    });
    if (hit) changed.push(id);
  }
  return changed;
}

export function startQuest(log: QuestLog, id: string, seed = 0): boolean {
  const d = questDef(id, seed);
  if (!d || log[id]) return false;
  log[id] = { state: 'active', progress: d.objectives.map(() => 0) };
  return true;
}

/** Human-readable progress for one objective, e.g. "Bring 12 wood (5/12)". */
export const objectiveText = (o: Objective, have: number): string => (o.n > 1 ? `${o.label} (${Math.min(have, o.n)}/${o.n})` : `${o.label}${have >= o.n ? ' ✓' : ''}`);

// ───────────────────────── daily request board ─────────────────────────

/** Three requests are pinned to the board every world day. They can be accepted that day and handed in until the end of the next. */
export const REQUESTS_PER_DAY = 3;
export const REQUEST_DAYS = 2;
export const isRequestId = (id: string): boolean => id.startsWith('req:');
export const requestDay = (id: string): number => Number(id.split(':')[1]);

interface Want { items: (season: number) => string[]; n: [number, number]; why: string[] }
const BUG_SEASONS: Record<string, number[]> = { butterfly: [0, 1], ladybug: [0, 1, 2], beetle: [1, 2], dragonfly: [1], cricket: [1, 2], firefly: [1] };
const cropsIn = (s: number) => Object.values(CROPS).filter((c) => c.seasons.includes(s)).map((c) => c.id);
const forageIn = (s: number) => FORAGE_BY_SEASON[s] ?? [];
const bugsIn = (s: number) => Object.entries(BUG_SEASONS).filter(([, ss]) => ss.includes(s)).map(([id]) => id);

/** Who asks for what on the board, and why (flavour text in their voice). */
const WANTS: Record<string, Want> = {
  odo: { items: () => ['wood', 'wood', 'plank', 'fiber'], n: [8, 20], why: ['A fence fell over. Again. Not my fence. Somebody\'s fence.', 'Juniper wants a treehouse. I said no. I\'m building it anyway.', 'Renovating the inn\'s shutters. Out of spite.'] },
  brannoch: { items: () => ['stone', 'coal', 'copper_ore', 'copper_ingot', 'iron_ore'], n: [3, 12], why: ['The forge is hungry.', 'Farmers want hoes. Hoes want metal.', 'An order came in from the road. Big one.'] },
  maribel: { items: (s) => [...cropsIn(s), ...forageIn(s), 'egg', 'minnow'], n: [2, 6], why: ['Tonight\'s special needs fresh ingredients.', 'A troupe of travelers booked every table!', 'I promised Orla a pie and forgot to buy the filling.'] },
  sedge: { items: () => ['minnow', 'carp', 'perch', 'minnow'], n: [2, 5], why: ['Bait for the glowfin. Don\'t ask.', 'Maribel wants a fish fry night.', 'Counting the pond. For science.'] },
  wren: { items: (s) => [...forageIn(s), 'slime_gel', 'healing_herb'], n: [2, 6], why: ['My potions are running low.', 'An experiment requires… volume.', 'The tea needs something earthy.'] },
  pippa: { items: (s) => ['fiber', 'cloth', ...forageIn(s).filter((f) => ['daffodil', 'sunpetal', 'crocus', 'blackberry'].includes(f))], n: [3, 10], why: ['New season, new collection!', 'Dyes, darling. I need dyes.', 'Orla wants a new sash for Measurement Day.'] },
  juniper: { items: (s) => (bugsIn(s).length ? bugsIn(s) : forageIn(s)), n: [1, 3], why: ['For my collection! It\'s VERY scientific.', 'I bet Gerald a bug that I could get one. Gerald is a slime. He bet nothing.', 'I\'m building a bug hotel!'] },
  tobin: { items: (s) => [...cropsIn(s), ...forageIn(s)], n: [3, 8], why: ['A trader from the road wants a crate. Good margin.', 'Shelves are looking thin.', 'Somebody bought everything. Who does that?'] },
  fenwick: { items: (s) => ['hay', 'fertilizer', ...cropsIn(s)], n: [3, 8], why: ['The chickens are judging me. They want hay.', 'Seed stock for next season.', 'The community garden needs feeding.'] },
};
const KILL_WHY = ['The road to the shrine is crawling with slimes again.', 'Travelers say the hoppers are bold this week.'];

/** Procedurally generated request-board jobs for a world day (identical on server and client). */
export function dailyRequests(seed: number, day: number): QuestDef[] {
  const out: QuestDef[] = [];
  const used = new Set<string>();
  for (let i = 0; i < REQUESTS_PER_DAY; i++) {
    const def = requestDef(seed, `req:${day}:${i}`, used);
    if (def) { out.push(def); used.add(def.giver); }
  }
  return out;
}

function requestDef(seed: number, id: string, used?: Set<string>): QuestDef | undefined {
  const m = /^req:(-?\d+):(\d)$/.exec(id);
  if (!m) return undefined;
  const day = Number(m[1]), i = Number(m[2]);
  if (i >= REQUESTS_PER_DAY) return undefined;
  const r = (salt: number) => hash2(seed, day, i, 900 + salt);
  const season = Math.floor(day / 7) % 4;
  // the third job of every other day is a monster-clearing job for the mayor
  if (i === 2 && day % 2 === 0) {
    const slime = r(1) < 0.6;
    const n = 3 + Math.floor(r(2) * 3);
    return {
      id, giver: 'orla', title: slime ? 'Clear the Road' : 'Hopper Trouble', daily: { day },
      summary: `${KILL_WHY[slime ? 0 : 1]} Defeat ${n} ${slime ? 'Wisp Slimes' : 'Glint Hoppers'}.`,
      objectives: [{ type: 'kill', target: slime ? 'slime' : 'hopper', n, label: `Defeat ${n} ${slime ? 'Wisp Slimes' : 'Glint Hoppers'}` }],
      rewards: { coins: 25 + n * (slime ? 14 : 18), friend: 15 },
      lines: { offer: '', progress: '', done: 'The Mayor\'s office thanks you. In triplicate.' }, where: 'the request board or Mayor Orla',
    };
  }
  // pick a giver (stable per day), avoiding repeats on the same day when called through dailyRequests
  const givers = Object.keys(WANTS);
  let gi = Math.floor(r(3) * givers.length);
  // make the choice independent of `used` for single lookups: recompute the same order dailyRequests used
  if (!used) {
    const prev = new Set<string>();
    for (let k = 0; k < i; k++) { const d = requestDef(seed, `req:${day}:${k}`, prev); if (d) prev.add(d.giver); }
    used = prev;
  }
  for (let k = 0; k < givers.length && used.has(givers[gi]!); k++) gi = (gi + 1) % givers.length;
  const giver = givers[gi]!;
  const want = WANTS[giver]!;
  const pool = want.items(season).filter((x) => ITEMS[x]);
  if (!pool.length) return undefined;
  const item = pool[Math.floor(r(4) * pool.length)]!;
  const def = ITEMS[item]!;
  const [lo, hi] = want.n;
  const scale = def.value > 60 ? 0.4 : def.value > 25 ? 0.7 : 1;
  const n = Math.max(1, Math.round((lo + Math.floor(r(5) * (hi - lo + 1))) * scale));
  const coins = Math.round(def.value * n * 1.6 + 20);
  const why = want.why[Math.floor(r(6) * want.why.length)]!;
  return {
    id, giver, title: `${n} × ${def.name}`, daily: { day },
    summary: `${why} Bring ${n} ${def.name}.`,
    objectives: [{ type: 'deliver', target: item, n, label: `Bring ${n} ${def.name}` }],
    rewards: { coins, friend: 15 },
    lines: { offer: '', progress: '', done: '' }, where: 'the request board or the person who asked',
  };
}

/** Requests that are past their hand-in window are dropped (active ones simply expire). */
export function pruneRequests(log: QuestLog, today: number): string[] {
  const gone: string[] = [];
  for (const id of Object.keys(log)) {
    if (!isRequestId(id)) continue;
    const d = requestDay(id);
    if (!Number.isFinite(d) || d < today - (REQUEST_DAYS - 1) || d > today + 1) { gone.push(id); delete log[id]; }
  }
  return gone;
}
