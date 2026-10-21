import type { Stack } from './items';

/** What the server counts toward a quest objective. */
export type ObjectiveType = 'gain' | 'craft' | 'plant' | 'harvest' | 'forge' | 'fish' | 'bug' | 'kill' | 'talk' | 'gift' | 'smelt' | 'discover' | 'place' | 'sell';
export interface Objective { type: ObjectiveType; /** item id / npc id / enemy name; '*' = anything of that type */ target: string; n: number; label: string }
export interface QuestDef {
  id: string;
  giver: string;
  title: string;
  /** shown in the quest log */
  summary: string;
  objectives: Objective[];
  rewards: { coins: number; items?: Stack[]; friend?: number; xp?: number };
  /** quests that must be done first */
  requires?: string[];
  lines: { offer: string; progress: string; done: string };
}

const q = (d: QuestDef): QuestDef => d;
export const QUESTS: QuestDef[] = [
  q({ id: 'welcome', giver: 'orla', title: 'A Warm Welcome', summary: 'Meet the villagers of Hadamere: the carpenter, the smith, the storekeeper.',
    objectives: [{ type: 'talk', target: 'odo', n: 1, label: 'Talk to Odo the carpenter' }, { type: 'talk', target: 'brannoch', n: 1, label: 'Talk to Brannoch the smith' }, { type: 'talk', target: 'tobin', n: 1, label: 'Talk to Tobin at the General Store' }],
    rewards: { coins: 60, items: [{ id: 'fertilizer', n: 3 }], friend: 20 },
    lines: { offer: 'Welcome, traveler! Hadamere always has room for another pair of hands. Do introduce yourself around: Odo the carpenter, Brannoch at the smithy, and Tobin at the store.', progress: 'Have you met everyone yet? The carpenter, the smith, and Tobin at the store.', done: 'Splendid! A village is only as strong as its introductions. Here, a little something for the road.' } }),
  q({ id: 'timber', giver: 'odo', title: 'Timber!', summary: 'Chop trees and bring Odo 12 wood.', requires: ['welcome'],
    objectives: [{ type: 'gain', target: 'wood', n: 12, label: 'Collect 12 wood' }],
    rewards: { coins: 40, items: [{ id: 'plank', n: 6 }], friend: 20 },
    lines: { offer: 'You look capable. I\'m short on timber — twelve wood and I\'ll make it worth your while. Chop trees with your axe: select it and hold E.', progress: 'Still need that wood. Face a tree with the axe selected and hold E.', done: 'Good, clean timber. Here are some planks, and the friendship of a very grumpy carpenter.' } }),
  q({ id: 'stone', giver: 'brannoch', title: 'Rocks and Hard Places', summary: 'Mine stone and coal for the smithy.', requires: ['welcome'],
    objectives: [{ type: 'gain', target: 'stone', n: 12, label: 'Mine 12 stone' }, { type: 'gain', target: 'coal', n: 2, label: 'Find 2 coal' }],
    rewards: { coins: 50, items: [{ id: 'copper_ore', n: 4 }], friend: 20 },
    lines: { offer: 'A forge eats stone and coal. Mine me a dozen stones and a pair of coal from the boulders around the village. Pickaxe, hold E.', progress: 'Stones and coal. Boulders, pickaxe. It\'s not complicated.', done: 'Hm. Decent haul. Take this ore — you\'ll learn to smelt it next.' } }),
  q({ id: 'smelt', giver: 'brannoch', title: 'Hot Metal', summary: 'Build or find a furnace and smelt a copper ingot.', requires: ['stone'],
    objectives: [{ type: 'smelt', target: 'copper_ingot', n: 1, label: 'Smelt a copper ingot' }],
    rewards: { coins: 70, items: [{ id: 'copper_ore', n: 6 }, { id: 'coal', n: 3 }], friend: 20 },
    lines: { offer: 'Ore is nothing until it\'s metal. My furnace is free to use: two copper ore and a coal make an ingot. Try it.', progress: 'Furnace: two ore, one coal. Go on.', done: 'Your first ingot! Keep the extra ore. Now for the real art: forging.' } }),
  q({ id: 'forged', giver: 'brannoch', title: 'Forged in Phase', summary: 'Forge your first item at the anvil, using two metals.', requires: ['smelt'],
    objectives: [{ type: 'forge', target: '*', n: 1, label: 'Forge something at an anvil' }],
    rewards: { coins: 150, items: [{ id: 'iron_ingot', n: 2 }], friend: 30 },
    lines: { offer: 'Now the art. At the anvil, combine two ingots — metals of the same phase reinforce, opposite phases cancel flaws — then hit the beat. Forge anything.', progress: 'The anvil is waiting. Two metals. Hit the beats.', done: 'Heh! Not bad for a first strike. Here: iron for your next project.' } }),
  q({ id: 'seeds', giver: 'fenwick', title: 'Greenthumb', summary: 'Till soil, plant 4 seeds and water them.', requires: ['welcome'],
    objectives: [{ type: 'plant', target: '*', n: 4, label: 'Plant 4 seeds' }],
    rewards: { coins: 40, items: [{ id: 'fertilizer', n: 4 }], friend: 20 },
    lines: { offer: 'Folks who farm never leave. Use your hoe on grass, plant seeds on the tilled soil, water daily. The fields by my house are free to use.', progress: 'Four seeds in the ground. Hoe first, then seeds, then the watering can.', done: 'Look at that! Now water them every day — or pray for rain.' } }),
  q({ id: 'harvest', giver: 'fenwick', title: 'The First Harvest', summary: 'Harvest 3 crops.', requires: ['seeds'],
    objectives: [{ type: 'harvest', target: '*', n: 3, label: 'Harvest 3 crops' }],
    rewards: { coins: 90, items: [{ id: 'sprinkler_1', n: 1 }], friend: 30 },
    lines: { offer: 'Come back when something is ripe. Crops take a few days of watering — a game day is 24 real minutes.', progress: 'Watered daily? Ripe crops shimmer. Press E on them.', done: 'A farmer is born. Take this sprinkler. Your back will thank me.' } }),
  q({ id: 'fishing', giver: 'sedge', title: 'Something Fishy', summary: 'Catch a fish at the pond.', requires: ['welcome'],
    objectives: [{ type: 'fish', target: '*', n: 1, label: 'Catch a fish' }],
    rewards: { coins: 45, friend: 25, items: [{ id: 'minnow', n: 3 }] },
    lines: { offer: 'The pond south of the plaza is full of them. Cast with the rod, wait for the bite, then hit the beats of the tug.', progress: 'Cast, wait for the "!", press E, then hit the beats. Patience.', done: 'You\'re a fisher now. We\'ll talk glowfin another day.' } }),
  q({ id: 'bugs', giver: 'juniper', title: 'Bug Hunt', summary: 'Catch 3 bugs with your net in flowers and tall grass.', requires: ['welcome'],
    objectives: [{ type: 'bug', target: '*', n: 3, label: 'Catch 3 bugs' }],
    rewards: { coins: 35, friend: 30, items: [{ id: 'healing_herb', n: 3 }] },
    lines: { offer: 'Wanna catch bugs?! Use your net on flowers and tall grass. Butterflies by day, fireflies at night!', progress: 'Three bugs! Flowers and tall grass. Net! Swoosh!', done: 'Yay! You\'re officially my favorite grown-up.' } }),
  q({ id: 'workbench', giver: 'odo', title: 'A Bench of Your Own', summary: 'Craft a workbench (press C: 10 wood + 4 stone).', requires: ['timber'],
    objectives: [{ type: 'craft', target: 'workbench', n: 1, label: 'Craft a workbench' }],
    rewards: { coins: 60, items: [{ id: 'chest', n: 1 }], friend: 15 },
    lines: { offer: 'Every builder needs a bench. Press C for field crafting: ten wood and four stone. Then place it with E and make planks.', progress: 'Wood and stone, press C. Then E to place it.', done: 'There it is. Here, a chest for all your junk.' } }),
  q({ id: 'experiment', giver: 'wren', title: 'Two Seeds, One Plant', summary: 'Discover how to make a Superposed Seed at an alchemy table.', requires: ['seeds'],
    objectives: [{ type: 'craft', target: 'superposed_seed', n: 1, label: 'Make a Superposed Seed' }],
    rewards: { coins: 120, items: [{ id: 'phase_tonic_a', n: 1 }], friend: 30 },
    lines: { offer: 'A plant that is two plants until you pick it. At my alchemy table, put two different seeds and a qubit crystal together. Experiment!', progress: 'Two different seeds, one qubit crystal, an alchemy table. You\'ll find one in my shop.', done: 'It hums! Take a tonic — it tilts the odds toward the first crop.' } }),
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

/** Counts an event toward every active quest objective it matches. Returns the ids of quests that changed. */
export function applyQuestEvent(log: QuestLog, ev: { type: ObjectiveType; target: string; n: number }): string[] {
  const changed: string[] = [];
  for (const [id, st] of Object.entries(log)) {
    if (st.state !== 'active') continue;
    const d = QUEST_BY_ID[id];
    if (!d) continue;
    let hit = false;
    d.objectives.forEach((o, i) => {
      if (o.type !== ev.type || (o.target !== '*' && o.target !== ev.target)) return;
      const before = st.progress[i] ?? 0;
      if (before >= o.n) return;
      st.progress[i] = Math.min(o.n, before + ev.n);
      hit = true;
    });
    if (hit) changed.push(id);
  }
  return changed;
}

export function startQuest(log: QuestLog, id: string): boolean {
  const d = QUEST_BY_ID[id];
  if (!d || log[id]) return false;
  log[id] = { state: 'active', progress: d.objectives.map(() => 0) };
  return true;
}
