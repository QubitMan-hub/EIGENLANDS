// Dev-only UI lab: renders each panel with mock data (?panel=inventory|station|forge|dialogue|shop|journal|chest|shelter|rhythm).
import './style.css';
import { ITEMS, NPC_BY_ID, RECIPES, type DialogueMsg, type PanelMsg } from '@eigenlands/shared';
import { Audio } from './audio';
import { ServerClock } from './net/interp';
import { Profile } from './game/profile';
import { Tooltip, h } from './ui/dom';
import { Windows } from './ui/windows';
import { Hotbar } from './ui/hotbar';
import { buildInventory } from './ui/inventory';
import { buildStation } from './ui/station';
import { buildForge } from './ui/forge';
import { buildDialogue } from './ui/dialogue';
import { buildShop } from './ui/shop';
import { buildChest, buildShelter } from './ui/containers';
import { buildJournal } from './ui/journal';
import { RhythmOverlay } from './ui/rhythm';
import { Toasts } from './ui/toast';

const panel = new URLSearchParams(location.search).get('panel') ?? 'inventory';
const profile = new Profile();
const inv = Array.from({ length: 30 }, () => null) as ReturnType<typeof Array.prototype.fill>;
const put = (i: number, id: string, n = 1, p?: object) => { inv[i] = { id, n, ...(p ? { p } : {}) }; };
put(0, 'axe', 1, { tier: 2 }); put(1, 'pickaxe', 1, { tier: 1 }); put(2, 'hoe', 1, { tier: 1 }); put(3, 'can', 1, { tier: 1 }); put(4, 'rod', 1, { tier: 1 });
put(5, 'net', 1, { tier: 1 }); put(6, 'sword', 1, { atk: 11, tier: 3, qname: 'Superior', phase: 4.5, stats: { atk: 8, dur: 3, spd: 4 }, note: 'In phase: the metals sing together.' }); put(7, 'turnip_seed', 12); put(8, 'potato_seed', 4);
put(10, 'wood', 64); put(11, 'stone', 40); put(12, 'copper_ingot', 6); put(13, 'iron_ingot', 3); put(14, 'silver_ingot', 2); put(15, 'qubit_crystal', 2); put(16, 'slime_gel', 3);
put(17, 'turnip', 5); put(18, 'minnow', 3); put(19, 'ring_atk', 1, { stat: 'atk', val: 4 }); put(20, 'outfit_red', 1); put(21, 'healing_potion', 2); put(22, 'coal', 8); put(23, 'fiber', 20);
profile.apply({ inv, coins: 482, recipes: RECIPES.filter((r) => r.learn === 'start').map((r) => r.id), skills: { farming: 130, mining: 40, foraging: 12, fishing: 0, crafting: 70 }, friends: { orla: { pts: 150, talked: 0, gifted: 0 }, tobin: { pts: 330, talked: 0, gifted: 0 } }, equip: { ring1: { id: 'ring_hp', n: 1, p: { stat: 'hp', val: 12 } }, ring2: null, outfit: 0 }, stats: { hpBonus: 12, atkBonus: 4, luck: 0, haste: 0.1 } });

const tip = new Tooltip();
const wins = new Windows();
const audio = new Audio();
const clock = new ServerClock();
new Toasts().add('Welcome to the UI lab', 'good');
const hotbar = new Hotbar(profile, tip);
document.body.append(hotbar.el);
const noop = () => {};
const portrait = () => h('div', { class: 'portrait-box' });
const portraitUrl = (id: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='48'><rect width='32' height='48' fill='#2c2f4a'/><circle cx='16' cy='14' r='8' fill='#d6a566'/><text x='16' y='42' font-size='8' fill='white' text-anchor='middle'>${id.slice(0, 5)}</text></svg>`)}`;

const dlg: DialogueMsg = { npcId: 'tobin', name: NPC_BY_ID.tobin!.name, title: NPC_BY_ID.tobin!.title, text: NPC_BY_ID.tobin!.lines.greet[1][0]!, hearts: 8, pts: 330, doing: 'minding the counter', canShop: true, canGift: true, canChat: true, teaches: ['fruit_pie'] };
const chestPanel: PanelMsg = { kind: 'chest', tx: 0, ty: 0, sub: 'chest', chest: [{ id: 'wood', n: 20 }, null, { id: 'stone', n: 8 }, ...Array(27).fill(null)] };
const shelterPanel: PanelMsg = { kind: 'shelter', tx: 0, ty: 0, sub: 'coop', shelter: { type: 'coop', animals: 2, max: 4, fed: false, ready: 3 } };

switch (panel) {
  case 'inventory': wins.show('inv', 'Pack', buildInventory(profile, tip, { move: noop, trash: noop, equip: noop, use: noop }, portrait), { wide: true }); break;
  case 'station': wins.show('st', 'Workbench', buildStation('workbench', profile, tip, { craft: noop, experiment: noop }), { wide: true }); break;
  case 'alchemy': wins.show('st', 'Alchemy Table', buildStation('alchemy', profile, tip, { craft: noop, experiment: noop }), { wide: true }); break;
  case 'forge': wins.show('f', 'Anvil & Forge', buildForge(profile, tip, { start: noop }), { wide: true }); break;
  case 'dialogue': wins.show('d', NPC_BY_ID.tobin!.name, buildDialogue(dlg, portraitUrl('tobin'), profile, tip, { shop: noop, gift: noop, learn: noop, chat: noop, close: noop })); break;
  case 'shop': wins.show('s', 'Greenbough General Store', buildShop({ npcId: 'tobin', name: 'Store', coins: 482, stock: [{ item: 'turnip_seed', price: 10 }, { item: 'potato_seed', price: 14 }, { item: 'fertilizer', price: 20 }, { item: 'chest', price: 50 }], sell: { 17: 18, 18: 6, 10: 2, 12: 13 } }, profile, tip, { buy: noop, sell: noop }), { wide: true }); break;
  case 'journal': wins.show('j', 'Journal', buildJournal(profile, portraitUrl), { wide: true }); break;
  case 'friends': wins.show('j', 'Journal', buildJournal(profile, portraitUrl, 'friends'), { wide: true }); break;
  case 'chest': wins.show('c', 'Chest', buildChest(chestPanel, profile, tip, { put: noop, take: noop }).el, { wide: true }); break;
  case 'shelter': wins.show('c', 'Coop', buildShelter(shelterPanel, profile, { add: noop, feed: noop, collect: noop })); break;
  case 'rhythm': {
    clock.observe(Date.now(), 1, performance.now());
    const r = new RhythmOverlay(() => clock, audio, () => {});
    r.start({ id: 'x', kind: 'forge', label: 'Strike the anvil on the beat!', plan: { startAt: clock.serverNow(performance.now()) + 1500, intervalMs: 650, count: 5, windowMs: 200 } });
    break;
  }
}
(window as unknown as { __uilab: boolean }).__uilab = true;
void ITEMS;
