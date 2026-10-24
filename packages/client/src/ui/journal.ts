import {
  ITEMS, MAX_HEARTS, MAX_SKILL, NPCS, NPC_BY_ID, POINTS_PER_HEART, QUESTS, RECIPES, SKILLS, SKILL_NAMES, SKILL_PERKS, STATION_NAMES, hearts, hoursText,
  isRequestId, objectiveText, questComplete, questDef, skillLevel, xpForSkillLevel, type StationId,
} from '@eigenlands/shared';
import { ensureP2Styles } from './p2style';
import type { Profile } from '../game/profile';
import { clear, h, iconCell } from './dom';
import { ACTIONS, ACTION_LABELS, DEFAULT_KEYS, type KeyMap } from '../input/keymap';
import { binding } from './first-steps';
import { heartsRow } from './dialogue';

export type JournalTab = 'journey' | 'quests' | 'skills' | 'friends' | 'recipes' | 'guide' | 'help';

/** "How do I…?" pages: everything Phase 2 adds, explained in-game. */
export const GUIDE: Array<[string, string]> = [
  ['Getting started', 'Open Quests → First steps to Hadamere, then choose Track Hadamere. Follow its direction in the travel strip or its pin on the atlas. Talk to Mayor Orla (press E next to her): she gives you your first quest. Villagers with a yellow ! above their head have a task for you; a blue ? means they are waiting for your report; a pink ♥ means they want to share something because you are friends.'],
  ['Quests and the request board', 'Your quest objectives and progress live in this Journal (Quests tab). Track quest selects one objective for the travel strip and map; Show on map centers it. Known home markers guide you to a building, not an unseen villager’s exact position. "Bring" objectives count what is in your pack and are handed over when you report back. Every morning three new jobs are pinned to the request board on the plaza (press E at the notice board): accept up to three, deliver, and hand them in at the board or to whoever asked.'],
  ['Sanctuaries and wilderness', 'Settlement wards disperse hostile creatures and protect streets, homes and shops. You can rest in town; attacks from inside the wards do not harm monsters outside. Look for Sanctuary in the travel strip. Beyond the wards, encounters are spaced out: woods shelter thornlings and wolves, glades draw wisps and glasscrawlers, and the wastes and caves are more dangerous. Night brings greater pressure.'],
  ['Gathering', 'Select a tool in the quick-bar (1–0 or mouse wheel) and hold E facing the target. Axe: trees (wood, fiber), and tall grass for fiber. Pickaxe: boulders (stone, coal) and ore outcrops; better ores need a higher-tier pickaxe. Bright little plants in the grass are forage: press E to pick them. Everything grows back over time.'],
  ['Farming', 'Hoe on grass tills it. Plant seeds on tilled soil, then water them with the watering can every day (rain waters for you). Crops grow one stage per watered day and only in their seasons (the seed tooltip says which). Ripe crops look full: press E to harvest. The fenced garden by the farmhouse is free to use. Fertilizer shaves off a day. Sprinklers water their neighbours every morning; a Phase Lantern keeps crops within 2 tiles alive in any season (a greenhouse).'],
  ['Animals', 'Buy a Chicken Coop and chickens from Fenwick (Barns come later). Place the coop, open it with E, add animals and feed them hay each day (hay: 3 fiber in field crafting). Fed animals give eggs or milk the next morning.'],
  ['Crafting and discovery', 'C opens field crafting anywhere (workbench, chest, fences, hay...). Stations do more: Workbench (planks, tools, stations), Furnace (ingots), Cooking Pot (meals), Alchemy Table (potions, tonics, superposed seeds), Loom (cloth, outfits), Jeweler Bench (rings), Carpenter Bench (furniture, coops). Hadamere has one of each to use for free. Recipes marked ??? are discovered by putting ingredients on the Experiment bench: nothing is used up if it fails, and the game tells you when the ingredients are right but the amounts are off. Some recipes are taught by villagers at 4 hearts.'],
  ['Smelting and forging', 'At a furnace, 2 ore + coal make an ingot. At the anvil (Brannoch\'s smithy) choose a template and 2–3 metals: metals with similar phase colours reinforce, opposite colours cancel flaws. Then strike when the markers hit the line: accuracy sets the quality (Rough to Perfect). Forged pickaxes get higher tiers; swords add attack.'],
  ['Fishing and bugs', 'Select the rod and press E facing water. Wait for the "!" and press E, then press E/Space on each beat of the tug. Deep water and rain bring bigger fish. The net catches bugs in flowers and tall grass: butterflies by day, fireflies and crickets at night, depending on the season.'],
  ['Villagers and friendship', 'Talk to each villager once a day and give one gift a day (Give a gift in the conversation). Loved gifts earn the most; their likes and dislikes appear in the Friends tab as you get closer. Villagers remember your gifts and what you have been up to, gossip about each other\'s news, and share heart scenes at 2, 5 and 8 hearts. Choose "Ask about…" to hear their stories, their view of the village and of QubitMan.'],
  ['Shops and prices', 'Shops open during the shopkeeper\'s working hours (shown in the conversation). Each shop buys certain kinds of things: Tobin crops and goods, Brannoch metal, Sedge fish and bugs, Maribel food, Wren herbs, Pippa cloth and flowers, Odo wood. Prices fall when the whole village sells the same thing, and recover over a few hours: spread your sales around.'],
  ['Days, seasons and weather', 'A day lasts 24 real minutes and starts at 6:00. Each season lasts 7 days. Rain waters crops; villagers shelter indoors in bad weather and keep to their schedules otherwise: working by day, at the inn in the evening, home at night.'],
  ['The Statue of QubitMan', 'In the middle of the plaza stands the statue of Hadamere\'s legendary founder. Walk up to it and press E to read the plaque and his legend. ALL HAIL QUBITMAN.'],
];

export function buildJournal(profile: Profile, portrait: (npcId: string) => string, tab0: JournalTab = 'quests', seed = 0, guidance: () => string | null = () => null, journey?: HTMLElement, options: { keys?: () => KeyMap; firstSteps?: HTMLElement; track?: (id: string | null, map?: boolean) => void; tracked?: () => string | null; travelMode?: (mode:'cozy'|'adventure')=>void } = {}): HTMLElement {
  ensureP2Styles();
  const root = h('div', { class: 'journal' });
  const body = h('div', { class: 'jbody' });
  body.tabIndex = 0; body.setAttribute('role', 'region'); body.setAttribute('aria-label', 'Journal pages');
  let tab: JournalTab = tab0;
  const tabs = h('div', { class: 'tabs' });

  const render = () => {
    const focused = (document.activeElement as HTMLElement | null)?.dataset.focus;
    const scroll = body.scrollTop;
    const keys = options.keys?.() ?? DEFAULT_KEYS;
    const shortcutText = (text: string) => text.replace(/\b[EJCIL]\b/g, key => binding(keys, ({ E:'interact', J:'attack', C:'craft', I:'inventory', L:'journal' } as const)[key as 'E'|'J'|'C'|'I'|'L']));
    clear(tabs); clear(body);
    for (const [id, label] of [['quests', 'Quests'], ['journey', 'Journey'], ['skills', 'Skills'], ['friends', 'Friends'], ['recipes', 'Recipes'], ['guide', 'How to…'], ['help', 'Controls']] as const) { if (id === 'journey' && !journey) continue; tabs.append(h('button', { class: id === tab ? 'primary' : '', text: label, data: { tab: id }, on: { click: () => { tab = id; render(); } } })); }
    if(tab==='guide') {
      const n=profile.needs, mode=h('select',{data:{focus:'travel-mode'}});mode.setAttribute('aria-label','Travel mode');
      mode.append(h('option',{value:'cozy',text:'Cozy · no depletion'}),h('option',{value:'adventure',text:'Adventure · food and water'}));mode.value=n.mode;mode.disabled=!options.travelMode;
      mode.addEventListener('change',()=>options.travelMode?.(mode.value as 'cozy'|'adventure'));
      body.append(h('section',{class:'journal-guidance travel-guide'},h('h3',{text:'Travel needs'}),mode,h('p',{text:`Food ${Math.ceil(n.food)}/100 · Water ${Math.ceil(n.water)}/100. ${n.mode==='cozy'?'Cozy pauses depletion.':'Adventure needs are enabled.'}`}),h('p',{text:'Adventure uses food over about 30 minutes and water over 20 minutes at rest. Exertion costs more; desert thirst rises faster. Town wards, death and offline time pause depletion. At zero, exhaustion costs 1 HP every 10 seconds and stops at 1 HP. Switching modes never refills supplies.'}),h('p',{text:'Food restores 25 nourishment, even at full health. Craft an empty waterskin from 1 hide + 2 fiber in Field crafting, select it in the quick-bar and Use it facing a town well. Each filled skin restores 35 water and keeps the empty container. Rivers and ocean water cannot fill it. The mode changes food and water needs only.'})));
    }
    if ((tab === 'quests' || tab === 'guide') && options.firstSteps) body.append(options.firstSteps);
    if (tab === 'quests' || tab === 'guide') {
      const next = guidance();
      if (next) body.append(h('section', { class: 'journal-guidance' }, h('h3', { text: 'Next steps' }), h('p', { text: next })));
    }
    if (tab === 'journey' && journey) { body.append(journey); }
    else if (tab === 'quests') {
      const log = profile.quests;
      const active = Object.entries(log).filter(([, s]) => s.state === 'active');
      if (!active.length) body.append(h('div', { class: 'small dim', text: log.welcome ? 'No active quests. Look for villagers with a yellow ! over their heads, or check the request board on the plaza.' : 'No quests yet. Track Hadamere above, then talk to Mayor Orla for A Warm Welcome.' }));
      for (const [id, st] of active) {
        const d = questDef(id, seed);
        if (!d) continue;
        const prog = d.objectives.map((o, i) => (o.type === 'deliver' ? Math.min(o.n, profile.count(o.target)) : st.progress[i] ?? 0));
        const ready = questComplete(d, { state: 'active', progress: prog });
        body.append(h('div', { class: `jq${ready ? ' ready' : ''}`, data: { quest: id } },
          h('b', { text: `${ready ? '★ ' : isRequestId(id) ? '📌 ' : ''}${d.title}` }), h('div', { class: 'small', text: shortcutText(d.summary) }),
          ...d.objectives.map((o, i) => h('div', { class: `o small${prog[i]! >= o.n ? ' done' : ''}`, text: `${prog[i]! >= o.n ? '✓' : '•'} ${shortcutText(objectiveText(o, prog[i] ?? 0))}` })),
          h('div', { class: 'where', text: `${ready ? 'Ready! Hand it in to' : 'From'}: ${d.where ?? NPC_BY_ID[d.giver]?.name ?? d.giver}${d.rewards.coins ? ` · Reward ${d.rewards.coins} coins${(d.rewards.items ?? []).map((s) => `, ${s.n} ${ITEMS[s.id]?.name}`).join('')}` : ''}` })));
      }
      if (options.track) for (const card of body.querySelectorAll<HTMLElement>('.jq')) {
        const id = card.dataset.quest!;
        const tracked = options.tracked?.() === id;
        card.append(h('button', { text: tracked ? 'Stop tracking' : 'Track quest', data:{focus:`track:${id}`}, on: { click: () => { options.track!(tracked ? null : id); render(); } } }),
          h('button', { text: 'Show on map', data:{focus:`map:${id}`}, on: { click: () => options.track!(id, true) } }));
      }
      const done = QUESTS.filter((q) => log[q.id]?.state === 'done');
      const boardDone = Object.entries(log).filter(([id, s]) => isRequestId(id) && s.state === 'done').length;
      body.append(h('div', { class: 'side-title', text: `Completed (${done.length} / ${QUESTS.length} story quests${boardDone ? `, ${boardDone} board jobs recently` : ''})` }));
      for (const q of done) body.append(h('div', { class: 'small dim', text: `✓ ${q.title} (${NPC_BY_ID[q.giver]?.name.split(' ')[0]})` }));
    } else if (tab === 'guide') {
      const box = h('div', { class: 'jhelp' });
      for (const [title, text] of GUIDE) box.append(h('h4', { text: title }), h('p', { text: shortcutText(text) }));
      body.append(box);
    } else if (tab === 'skills') {
      for (const s of SKILLS) {
        const xp = profile.skills[s], lv = skillLevel(xp);
        const lo = xpForSkillLevel(lv), hi = lv >= MAX_SKILL ? lo : xpForSkillLevel(lv + 1);
        const pct = lv >= MAX_SKILL ? 100 : ((xp - lo) / Math.max(1, hi - lo)) * 100;
        body.append(h('div', { class: 'skill' }, h('b', { text: `${SKILL_NAMES[s]}  Lv ${lv}` }), h('div', { class: 'bar xp' }, h('i', { style: `width:${pct}%` })), h('div', { class: 'small dim', text: SKILL_PERKS[s] })));
      }
    } else if (tab === 'friends') {
      for (const n of NPCS) {
        const f = profile.friends[n.id];
        const hh = hearts(f?.pts ?? 0);
        const row = h('div', { class: 'frow2' }, h('img', { class: 'portrait sm', src: portrait(n.id) }),
          h('div', {}, h('b', { text: n.name }), h('div', { class: 'small dim', text: `${n.title}${n.shop?.hours ? ` · shop ${hoursText(n.shop.hours)}` : ''}` }), heartsRow(hh),
            h('div', { class: 'small dim', text: hh >= 2 ? n.bio : 'Talk to them to get to know them.' }),
            h('div', { class: 'small', text: hh >= 3 ? `Likes: ${n.likes.slice(0, 3).map((i) => ITEMS[i]?.name).join(', ')}` : 'Talk and give gifts to learn their tastes.' }),
            hh >= 7 ? h('div', { class: 'small', text: `Loves: ${n.loves.map((i) => ITEMS[i]?.name).join(', ')}` }) : null,
            hh >= 5 ? h('div', { class: 'small dim', text: `Dislikes: ${n.hates.map((i) => ITEMS[i]?.name).join(', ')}` }) : null));
        body.append(row);
      }
      body.append(h('div', { class: 'small dim', text: `${POINTS_PER_HEART} points per heart (max ${MAX_HEARTS}). Talk once a day, give one gift a day.` }));
    } else if (tab === 'recipes') {
      const by = new Map<StationId, typeof RECIPES[number][]>();
      for (const r of RECIPES) if (profile.recipes.has(r.id)) { const l = by.get(r.station) ?? []; l.push(r); by.set(r.station, l); }
      for (const [st, rs] of by) {
        body.append(h('div', { class: 'side-title', text: STATION_NAMES[st] }));
        for (const r of rs) body.append(h('div', { class: 'jrec' }, iconCell({ id: r.out.id, n: r.out.n }), h('div', {}, h('b', { text: ITEMS[r.out.id]!.name }), h('div', { class: 'small dim', text: r.inputs.map((i) => (i.id.startsWith('*') ? `${i.n}× seed` : `${i.n}× ${ITEMS[i.id]?.name ?? i.id}`)).join(' + ') }))));
      }
      body.append(h('div', { class: 'small dim', text: `${profile.recipes.size} / ${RECIPES.length} recipes known. Experiment at stations to discover more; villagers teach some once you are friends.` }));
    } else {
      const rows: Array<[string, string]> = [
        ['Combo', 'tap Attack: slash, slash, lunging finisher (presses are buffered; dash cancels recovery)'],
        ['Heavy strike', 'hold Attack to charge (ring fills), release to cleave — breaks armour'],
        ['Phase Slip', 'dash through a red warning just before it fills: slow-mo + guaranteed critical counter'],
        ['Dash charges', '2 charges (pips under your feet), refill one at a time'],
        ['Reflect', 'swing at a Phase Wisp orb to bat it back'],
        ['Quick-bar', `1–0 · mouse wheel · ${binding(keys,'prev')} / ${binding(keys,'next')} · tap`],
        ['In conversations', `click / ${binding(keys,'interact')} / Space: skip text and turn pages · 1–9: pick an answer · Esc: leave`], ['Settings', 'Menu → Settings · F3 debug'],
      ];
      const devices: Record<string,string> = { up:'left stick / touch stick', down:'left stick / touch stick', left:'left stick / touch stick', right:'left stick / touch stick', attack:'left click · gamepad A / RT', skill:'right click · gamepad X', dash:'Dodge button · gamepad B', interact:'Use button · gamepad Y', prev:'mouse wheel', next:'mouse wheel' };
      rows.unshift(...ACTIONS.map(a => [ACTION_LABELS[a], `${binding(keys, a)}${devices[a] ? ` · ${devices[a]}` : ''}`] as [string,string]));
      for (const [a, b] of rows) body.append(h('div', { class: 'keyrow' }, h('span', { text: a }), h('span', { class: 'dim', text: b })));
      body.append(h('div', { class: 'small dim', text: 'Your Quests tab keeps objectives and next steps together. The “How to…” tab explains each system. Open the Journal any time from its button or your Journal key.' }));
    }
    body.scrollTop = scroll;
    if (focused) root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  };
  render();
  const unsub = profile.onChange(() => { if (!root.isConnected) { unsub(); return; } render(); });
  root.append(tabs, body);
  return root;
}
