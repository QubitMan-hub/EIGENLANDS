import { chooseIntrigue, civState, festJoin } from '../game/civ-store';
import {
  ITEMS,
  MAX_HEARTS,
  MAX_SKILL,
  NPCS,
  NPC_BY_ID,
  POINTS_PER_HEART,
  QUESTS,
  RECIPES,
  SKILLS,
  DAY_MS,
  KINGDOMS,
  REALM_IDS,
  REALM_SITES,
  DECREES,
  PROJECTS,
  civSiteName,
  type RealmId,
  REP_TIERS,
  type KingdomStance,
  diplomacyAt,
  nextFestival,
  nextFestivalOf,
  nextTourney,
  festivalToday,
  tourneyOn,
  dayNumber,
  CHAMPION_TITLE,
  ROYAL_CELEBRATIONS,
  type FestHost,
  realmRankName,
  relationsOf,
  repTier,
  SKILL_NAMES,
  SKILL_PERKS,
  STATION_NAMES,
  hearts,
  hoursText,
  isRequestId,
  objectiveText,
  questComplete,
  questDef,
  skillLevel,
  xpForSkillLevel,
  type StationId,
} from '@eigenlands/shared';
import { ensureP2Styles } from './p2style';
import type { Profile } from '../game/profile';
import { clear, h, iconCell } from './dom';
import { ACTIONS, ACTION_LABELS, DEFAULT_KEYS, type KeyMap } from '../input/keymap';
import { binding } from './first-steps';
import { heartsRow } from './dialogue';

export type JournalTab = 'journey' | 'quests' | 'skills' | 'friends' | 'kingdoms' | 'recipes' | 'guide' | 'help';

/** "How do I…?" pages: everything Phase 2 adds, explained in-game. */
export const GUIDE: Array<[string, string]> = [
  [
    'Getting started',
    'Open Quests → First steps to Hadamere, then choose Track Hadamere. Follow its direction in the travel strip or its pin on the atlas. Talk to Mayor Orla (press E next to her): she gives you your first quest. Villagers with a yellow ! above their head have a task for you; a blue ? means they are waiting for your report; a pink ♥ means they want to share something because you are friends.',
  ],
  [
    'Quests and the request board',
    'Your quest objectives and progress live in this Journal (Quests tab). Track quest selects one objective for the travel strip and map; Show on map centers it. Known home markers guide you to a building, not an unseen villager’s exact position. "Bring" objectives count what is in your pack and are handed over when you report back. Every morning three new jobs are pinned to the request board on the plaza (press E at the notice board): accept up to three, deliver, and hand them in at the board or to whoever asked.',
  ],
  [
    'Sanctuaries and wilderness',
    'Settlement wards disperse hostile creatures and protect streets, homes and shops. You can rest in town; attacks from inside the wards do not harm monsters outside. Look for Sanctuary in the travel strip. Beyond the wards, encounters are spaced out: woods shelter thornlings and wolves, glades draw wisps and glasscrawlers, and the wastes and caves are more dangerous. Night brings greater pressure.',
  ],
  [
    'Building a home',
    'Open Field crafting and craft Timber or Flagstone Floors, Timber or Stone Walls, a Timber Door, Slate or Thatched Roofs, and Timber Stairs. Clear wilderness land outside towns, landmarks and the crossroads (within 10,000 tiles). Select a piece, aim at a nearby tile and press E / Use. Start with floors, then add walls, doors, furniture and roofs on the same foundation. Rotate appears only for walls, roofs and stairs; the four positions rebuild their isometric geometry. Adjacent roof panels form a shared gable. Roofs lift and front walls cut away when you enter a roofed room. Your account owns every piece, including after reload: other players can visit but cannot edit or operate your doors. Open a door with E and leave it open to welcome visitors. Stairs include an upper landing: stand on it, select an ordinary item, and Use to climb or descend. Extend upstairs floors over your own foundations below; the dark area beyond is solid. This release supports two floors. Keep stairs clear of furniture. To remodel, select a pickaxe and Use: reclaim roof first, then wall, then stairs, then floor. Reclaiming returns the piece only when your pack has room. Everyone must leave the upper floor before the last stairs can be removed; occupied floors and routes to stairs are protected. Remove upper floors before their foundations. An axe still reclaims your empty furniture and chests.',
  ],
  [
    'Gathering',
    'Select a tool in the quick-bar (1–0 or mouse wheel) and hold E facing the target. Axe: trees (wood, fiber), and tall grass for fiber. Pickaxe: boulders (stone, coal) and ore outcrops; better ores need a higher-tier pickaxe. Bright little plants in the grass are forage: press E to pick them. Everything grows back over time.',
  ],
  [
    'Farming',
    'Hoe on grass tills it. Plant seeds on tilled soil, then water them with the watering can every day (rain waters for you). Crops grow one stage per watered day and only in their seasons (the seed tooltip says which). Ripe crops look full: press E to harvest. The fenced garden by the farmhouse is free to use. Fertilizer shaves off a day. Sprinklers water their neighbours every morning; a Phase Lantern keeps crops within 2 tiles alive in any season (a greenhouse).',
  ],
  [
    'Animals',
    'Buy a Chicken Coop and chickens from Fenwick, or build a Barn, Sheepfold, Goat Shed, Pig Pen or Apiary at a carpenter bench and buy the animals at a farm supply. Place the shelter, open it with E, add animals and feed them hay each day (hay: 3 fiber in field crafting). Fed animals give their product the next morning: eggs, milk, wool, goat milk, truffles, honey. Collect wool with shears in your pack and goat milk with a milk pail.',
  ],
  [
    'Crafting and discovery',
    'C opens field crafting anywhere (workbench, chest, fences, hay...). Stations do more: Workbench (tools and the other benches), Furnace (ingots, glass, brick), Anvil & Forge (plate, weapons, armour), Cooking Pot and Stone Oven (meals), Brewing Barrels (beer, wine, spirits), Alchemy Table (potions), Loom (thread, cloth), Tanning Rack (leather), Jeweler (gems, rings, amulets), Stonecutter (blocks, tiles), Carpenter (planks, furniture), Engineer’s Bench (gears, lanterns), Rune Altar (runes, essences), Enchanting Table (binds runes into gear), Mill & Dairy (flour, cheese, oil). Hadamere has several to use for free. Each bench trains one or two crafting disciplines; as a discipline levels up it unlocks recipes and makes better quality. Small craft tools (chisel, saw, tongs, sewing kit, knife, loupe, mortar & pestle) must be in your pack for their trades. Recipes marked ??? are discovered by putting ingredients on the Experiment bench: nothing is used up if it fails. Some recipes come from a kingdom once it counts you a friend, from a villager at 4 hearts, or from a scroll found in a vault.',
  ],
  [
    'Gear: quality, repair, upgrades and enchanting',
    'Crafted gear has a quality (Crude to Masterwork) from your skill, and wears down as you fight: armour when you are hit, weapons when you strike, lanterns in the dark. At 0 it is broken and gives nothing until mended. Mend it at the bench that made it (a share of the original materials) or with a repair kit; upgrade it up to +5 at the same bench for more power; bind a rune into it at an Enchanting Table. Shields, cloaks and packs, amulets, belts, charms and lanterns each have their own slot.',
  ],
  [
    'Smelting and forging',
    "At a furnace, 2 ore + coal make an ingot. At the anvil (Brannoch's smithy) choose a template and 2–3 metals: metals with similar phase colours reinforce, opposite colours cancel flaws. Then strike when the markers hit the line: accuracy sets the quality (Rough to Perfect). Forged pickaxes get higher tiers; swords add attack.",
  ],
  [
    'Fishing and bugs',
    'Select the rod and press E facing water. Wait for the "!" and press E, then press E/Space on each beat of the tug. Deep water and rain bring bigger fish. The net catches bugs in flowers and tall grass: butterflies by day, fireflies and crickets at night, depending on the season.',
  ],
  [
    'Villagers and friendship',
    'Talk to each villager once a day and give one gift a day (Give a gift in the conversation). Loved gifts earn the most; their likes and dislikes appear in the Friends tab as you get closer. Villagers remember your gifts and what you have been up to, gossip about each other\'s news, and share heart scenes at 2, 5 and 8 hearts. Choose "Ask about…" to hear their stories, their view of the village and of QubitMan.',
  ],
  [
    'Shops and prices',
    "Shops open during the shopkeeper's working hours (shown in the conversation). Each shop buys certain kinds of things: Tobin crops and goods, Brannoch metal, Sedge fish and bugs, Maribel food, Wren herbs, Pippa cloth and flowers, Odo wood. Prices fall when the whole village sells the same thing, and recover over a few hours: spread your sales around.",
  ],
  [
    'Days, seasons and weather',
    'A day lasts 24 real minutes and starts at 6:00. Each season lasts 7 days. Rain waters crops; villagers shelter indoors in bad weather and keep to their schedules otherwise: working by day, at the inn in the evening, home at night.',
  ],
  [
    'The Statue of QubitMan',
    "In the middle of the plaza stands the statue of Hadamere's legendary founder. Walk up to it and press E to read the plaque and his legend. ALL HAIL QUBITMAN.",
  ],
];

export function buildJournal(
  profile: Profile,
  portrait: (npcId: string) => string,
  tab0: JournalTab = 'quests',
  seed = 0,
  guidance: () => string | null = () => null,
  journey?: HTMLElement,
  options: {
    keys?: () => KeyMap;
    firstSteps?: HTMLElement;
    track?: (id: string | null, map?: boolean) => void;
    tracked?: () => string | null;
    travelMode?: (mode: 'cozy' | 'adventure' | 'hardcore') => void;
  } = {},
): HTMLElement {
  ensureP2Styles();
  const root = h('div', { class: 'journal' });
  const body = h('div', { class: 'jbody' });
  body.tabIndex = 0;
  body.setAttribute('role', 'region');
  body.setAttribute('aria-label', 'Journal pages');
  let tab: JournalTab = tab0;
  const tabs = h('div', { class: 'tabs' });

  const render = () => {
    const focused = (document.activeElement as HTMLElement | null)?.dataset.focus;
    const scroll = body.scrollTop;
    const keys = options.keys?.() ?? DEFAULT_KEYS;
    const shortcutText = (text: string) =>
      text.replace(/\b[EJCIL]\b/g, (key) =>
        binding(
          keys,
          ({ E: 'interact', J: 'attack', C: 'craft', I: 'inventory', L: 'journal' } as const)[
            key as 'E' | 'J' | 'C' | 'I' | 'L'
          ],
        ),
      );
    clear(tabs);
    clear(body);
    for (const [id, label] of [
      ['quests', 'Quests'],
      ['journey', 'Journey'],
      ['skills', 'Skills'],
      ['friends', 'Friends'],
      ['kingdoms', 'Kingdoms'],
      ['recipes', 'Recipes'],
      ['guide', 'How to…'],
      ['help', 'Controls'],
    ] as const) {
      if (id === 'journey' && !journey) continue;
      tabs.append(
        h('button', {
          class: id === tab ? 'primary' : '',
          text: label,
          data: { tab: id },
          on: {
            click: () => {
              tab = id;
              render();
            },
          },
        }),
      );
    }
    if (tab === 'guide') {
      const n = profile.needs,
        mode = h('select', { data: { focus: 'travel-mode' } });
      mode.setAttribute('aria-label', 'Travel mode');
      mode.append(
        h('option', { value: 'cozy', text: 'Cozy · no depletion' }),
        h('option', { value: 'adventure', text: 'Adventure · food, water, weather, injuries' }),
        h('option', { value: 'hardcore', text: 'Hardcore · harsher drain, injuries and hits' }),
      );
      mode.value = n.mode;
      mode.disabled = !options.travelMode;
      mode.addEventListener('change', () => options.travelMode?.(mode.value as 'cozy' | 'adventure' | 'hardcore'));
      body.append(
        h(
          'section',
          { class: 'journal-guidance travel-guide' },
          h('h3', { text: 'Travel needs' }),
          mode,
          h('p', {
            text: `Food ${Math.ceil(n.food)}/100 · Water ${Math.ceil(n.water)}/100. ${n.mode === 'cozy' ? 'Cozy pauses depletion.' : n.mode === 'adventure' ? 'Adventure needs are enabled.' : 'Hardcore is on: faster drain, frequent injuries, harder hits.'}${n.mode === 'cozy' ? '' : ` Body warmth ${Math.round(n.temp)}.`}`,
          }),
          h('p', {
            text: 'Adventure uses food over about 30 minutes and water over 20 minutes at rest. Exertion costs more; desert thirst rises faster. Town wards, death and offline time pause depletion. At zero, exhaustion costs 1 HP every 10 seconds and stops at 1 HP. Switching modes never refills supplies.',
          }),
          h('p', {
            text: 'Warmth (Adventure and Hardcore): deserts scorch at noon and freeze at night, taiga and the Rime Cathedral are cold, Cinder Hollows are hot, winter and snow chill you. Stand near a campfire, forge or torch, or go indoors, to settle toward comfort; warming and cooling tonics resist the extremes. Freezing or scorching for several seconds costs health, and freezing causes frostbite.',
          }),
          h('p', {
            text: 'Injuries: wolves, boars and brutes can make you bleed (bandage), swamp and cave creatures poison (antidote), cinder creatures and lava burn (burn salve, or stand by water), frost creatures and freezing cause frostbite (burn salve or a fire). Bandages and antidotes are a start recipe at the alchemy bench; salves and tonics are discovered. Injuries never kill you outright; they stop at 1 HP.',
          }),
          h('p', {
            text: 'Food restores 25 nourishment, even at full health. Craft an empty waterskin from 1 hide + 2 fiber in Field crafting, select it in the quick-bar and Use it facing a town well. Each filled skin restores 35 water and keeps the empty container. Rivers and ocean water cannot fill it. The mode changes food and water needs only.',
          }),
        ),
      );
    }
    if ((tab === 'quests' || tab === 'guide') && options.firstSteps) body.append(options.firstSteps);
    if (tab === 'quests' || tab === 'guide') {
      const next = guidance();
      if (next)
        body.append(
          h('section', { class: 'journal-guidance' }, h('h3', { text: 'Next steps' }), h('p', { text: next })),
        );
    }
    if (tab === 'journey' && journey) {
      body.append(journey);
    } else if (tab === 'quests') {
      const log = profile.quests;
      const active = Object.entries(log).filter(([, s]) => s.state === 'active');
      if (!active.length)
        body.append(
          h('div', {
            class: 'small dim',
            text: log.welcome
              ? 'No active quests. Look for villagers with a yellow ! over their heads, or check the request board on the plaza.'
              : 'No quests yet. Track Hadamere above, then talk to Mayor Orla for A Warm Welcome.',
          }),
        );
      for (const [id, st] of active) {
        const d = questDef(id, seed);
        if (!d) continue;
        const prog = d.objectives.map((o, i) =>
          o.type === 'deliver' ? Math.min(o.n, profile.count(o.target)) : (st.progress[i] ?? 0),
        );
        const ready = questComplete(d, { state: 'active', progress: prog });
        body.append(
          h(
            'div',
            { class: `jq${ready ? ' ready' : ''}`, data: { quest: id } },
            h('b', { text: `${ready ? '★ ' : isRequestId(id) ? '📌 ' : ''}${d.title}` }),
            h('div', { class: 'small', text: shortcutText(d.summary) }),
            ...d.objectives.map((o, i) =>
              h('div', {
                class: `o small${prog[i]! >= o.n ? ' done' : ''}`,
                text: `${prog[i]! >= o.n ? '✓' : '•'} ${shortcutText(objectiveText(o, prog[i] ?? 0))}`,
              }),
            ),
            h('div', {
              class: 'where',
              text: `${ready ? 'Ready! Hand it in to' : 'From'}: ${d.where ?? NPC_BY_ID[d.giver]?.name ?? d.giver}${d.rewards.coins ? ` · Reward ${d.rewards.coins} coins${(d.rewards.items ?? []).map((s) => `, ${s.n} ${ITEMS[s.id]?.name}`).join('')}` : ''}`,
            }),
          ),
        );
      }
      if (options.track)
        for (const card of body.querySelectorAll<HTMLElement>('.jq')) {
          const id = card.dataset.quest!;
          const tracked = options.tracked?.() === id;
          card.append(
            h('button', {
              text: tracked ? 'Stop tracking' : 'Track quest',
              data: { focus: `track:${id}` },
              on: {
                click: () => {
                  options.track!(tracked ? null : id);
                  render();
                },
              },
            }),
            h('button', {
              text: 'Show on map',
              data: { focus: `map:${id}` },
              on: { click: () => options.track!(id, true) },
            }),
          );
        }
      const done = QUESTS.filter((q) => log[q.id]?.state === 'done');
      const boardDone = Object.entries(log).filter(([id, s]) => isRequestId(id) && s.state === 'done').length;
      body.append(
        h('div', {
          class: 'side-title',
          text: `Completed (${done.length} / ${QUESTS.length} story quests${boardDone ? `, ${boardDone} board jobs recently` : ''})`,
        }),
      );
      for (const q of done)
        body.append(h('div', { class: 'small dim', text: `✓ ${q.title} (${NPC_BY_ID[q.giver]?.name.split(' ')[0]})` }));
    } else if (tab === 'guide') {
      const box = h('div', { class: 'jhelp' });
      for (const [title, text] of GUIDE) box.append(h('h4', { text: title }), h('p', { text: shortcutText(text) }));
      body.append(box);
    } else if (tab === 'skills') {
      for (const s of SKILLS) {
        const xp = profile.skills[s],
          lv = skillLevel(xp);
        const lo = xpForSkillLevel(lv),
          hi = lv >= MAX_SKILL ? lo : xpForSkillLevel(lv + 1);
        const pct = lv >= MAX_SKILL ? 100 : ((xp - lo) / Math.max(1, hi - lo)) * 100;
        body.append(
          h(
            'div',
            { class: 'skill' },
            h('b', { text: `${SKILL_NAMES[s]}  Lv ${lv}` }),
            h('div', { class: 'bar xp' }, h('i', { style: `width:${pct}%` })),
            h('div', { class: 'small dim', text: SKILL_PERKS[s] }),
          ),
        );
      }
    } else if (tab === 'friends') {
      for (const n of NPCS) {
        const f = profile.friends[n.id];
        const hh = hearts(f?.pts ?? 0);
        const row = h(
          'div',
          { class: 'frow2' },
          h('img', { class: 'portrait sm', src: portrait(n.id) }),
          h(
            'div',
            {},
            h('b', { text: n.name }),
            h('div', {
              class: 'small dim',
              text: `${n.title}${n.shop?.hours ? ` · shop ${hoursText(n.shop.hours)}` : ''}`,
            }),
            heartsRow(hh),
            h('div', { class: 'small dim', text: hh >= 2 ? n.bio : 'Talk to them to get to know them.' }),
            h('div', {
              class: 'small',
              text:
                hh >= 3
                  ? `Likes: ${n.likes
                      .slice(0, 3)
                      .map((i) => ITEMS[i]?.name)
                      .join(', ')}`
                  : 'Talk and give gifts to learn their tastes.',
            }),
            hh >= 7
              ? h('div', { class: 'small', text: `Loves: ${n.loves.map((i) => ITEMS[i]?.name).join(', ')}` })
              : null,
            hh >= 5
              ? h('div', { class: 'small dim', text: `Dislikes: ${n.hates.map((i) => ITEMS[i]?.name).join(', ')}` })
              : null,
          ),
        );
        body.append(row);
      }
      body.append(
        h('div', {
          class: 'small dim',
          text: `${POINTS_PER_HEART} points per heart (max ${MAX_HEARTS}). Talk once a day, give one gift a day.`,
        }),
      );
    } else if (tab === 'kingdoms') {
      body.append(kingdomsPage(profile, seed));
    } else if (tab === 'recipes') {
      const by = new Map<StationId, (typeof RECIPES)[number][]>();
      for (const r of RECIPES)
        if (profile.recipes.has(r.id)) {
          const l = by.get(r.station) ?? [];
          l.push(r);
          by.set(r.station, l);
        }
      for (const [st, rs] of by) {
        body.append(h('div', { class: 'side-title', text: STATION_NAMES[st] }));
        for (const r of rs)
          body.append(
            h(
              'div',
              { class: 'jrec' },
              iconCell({ id: r.out.id, n: r.out.n }),
              h(
                'div',
                {},
                h('b', { text: ITEMS[r.out.id]!.name }),
                h('div', {
                  class: 'small dim',
                  text: r.inputs
                    .map((i) => (i.id.startsWith('*') ? `${i.n}× seed` : `${i.n}× ${ITEMS[i.id]?.name ?? i.id}`))
                    .join(' + '),
                }),
              ),
            ),
          );
      }
      body.append(
        h('div', {
          class: 'small dim',
          text: `${profile.recipes.size} / ${RECIPES.length} recipes known. Experiment at stations to discover more; villagers teach some once you are friends.`,
        }),
      );
    } else {
      const rows: Array<[string, string]> = [
        [
          'Mouse movement',
          'Settings → Controls → Movement controls: Mouse. Hold right button to move toward the ground cursor; release to stop. Your movement keys still work. Keyboard mode keeps right button as aim only.',
        ],
        [
          'Aim directional orbs',
          'Press an orb key, aim the direction preview, then left click to cast. Escape or the same key cancels. Selected enemies do not bypass aiming. Touch/gamepad cast directly; self abilities remain instant.',
        ],
        ['Combo', 'tap Attack: slash, slash, lunging finisher (presses are buffered; dash cancels recovery)'],
        ['Heavy strike', 'hold Attack to charge (ring fills), release to cleave — breaks armour'],
        ['Phase Slip', 'dash through a red warning just before it fills: slow-mo + guaranteed critical counter'],
        ['Dash charges', '2 charges (pips under your feet), refill one at a time'],
        ['Reflect', 'swing at a Phase Wisp orb to bat it back'],
        ['Quick-bar', `1–0 · mouse wheel · ${binding(keys, 'prev')} / ${binding(keys, 'next')} · tap`],
        [
          'In conversations',
          `click / ${binding(keys, 'interact')} / Space: skip text and turn pages · 1–9: pick an answer · Esc: leave`,
        ],
        ['Settings', 'Menu → Settings · F3 debug'],
      ];
      const devices: Record<string, string> = {
        up: 'left stick / touch stick',
        down: 'left stick / touch stick',
        left: 'left stick / touch stick',
        right: 'left stick / touch stick',
        attack: 'left click · gamepad A / RT',
        skill: 'gamepad X / LT',
        dash: 'Dodge button · gamepad B',
        interact: 'Use button · gamepad Y',
        prev: 'mouse wheel',
        next: 'mouse wheel',
      };
      rows.unshift(
        ...ACTIONS.map(
          (a) => [ACTION_LABELS[a], `${binding(keys, a)}${devices[a] ? ` · ${devices[a]}` : ''}`] as [string, string],
        ),
      );
      for (const [a, b] of rows)
        body.append(h('div', { class: 'keyrow' }, h('span', { text: a }), h('span', { class: 'dim', text: b })));
      body.append(
        h('div', {
          class: 'small dim',
          text: 'Your Quests tab keeps objectives and next steps together. The “How to…” tab explains each system. Open the Journal any time from its button or your Journal key.',
        }),
      );
    }
    body.scrollTop = scroll;
    if (focused)
      root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  };
  render();
  const unsub = profile.onChange(() => {
    if (!root.isConnected) {
      unsub();
      return;
    }
    render();
  });
  root.append(tabs, body);
  return root;
}

const STANCE_LABEL: Record<KingdomStance, string> = {
  allied: 'Allied',
  friendly: 'Friendly',
  neutral: 'Neutral',
  rival: 'Rivals',
  hostile: 'Hostile',
};

/** The living state of a kingdom (§16): its fortunes, the decree, the works under way, wars and court intrigue. */
function realmState(id: RealmId): HTMLElement | null {
  const k = civState()?.kingdoms[id];
  if (!k) return null;
  const meter = (label: string, v: number) =>
    h(
      'div',
      { class: 'civ-meter' },
      h('span', { text: label }),
      h('i', {}, h('b', { style: `width:${Math.round(v)}%` })),
      h('span', { class: 'small', text: `${Math.round(v)}` }),
    );
  const box = h(
    'div',
    { class: 'civ-state' },
    meter('Prosperity', k.prosperity),
    meter('Might', k.might),
    meter('Stability', k.stability),
    h('div', {
      class: 'small',
      text: `Treasury ${k.treasury.toLocaleString()} crowns · Decree: ${DECREES[k.decree.id].name}. ${DECREES[k.decree.id].text}`,
    }),
  );
  if (k.monarch) box.append(h('div', { class: 'small', text: `Reigning: ${k.monarch}` }));
  if (k.royal && (civState()?.day ?? 0) <= k.royal.until)
    box.append(
      h('div', {
        class: k.royal.kind === 'plague' ? 'small bad' : 'small',
        text: `${k.royal.title}${ROYAL_CELEBRATIONS.has(k.royal.kind) ? ': the realm is celebrating' : ''} (until day ${k.royal.until}).`,
      }),
    );
  if (k.project) {
    const site = REALM_SITES.find((s) => s.id === k.project!.site);
    box.append(
      h('div', {
        class: 'small',
        text: `Building: a ${PROJECTS[k.project.kind].name.toLowerCase()} at ${site ? civSiteName(site) : '?'} (${Math.round(k.project.progress * 100)}%). ${PROJECTS[k.project.kind].desc}`,
      }),
    );
  }
  if (k.built.length)
    box.append(
      h('div', {
        class: 'small dim',
        text: `Works completed: ${k.built
          .slice(-5)
          .map((b) => PROJECTS[b.kind].name.toLowerCase())
          .join(', ')}`,
      }),
    );
  for (const w of k.wars)
    box.append(h('div', { class: 'small bad', text: `At war with ${KINGDOMS[w.with].name} since day ${w.since}.` }));
  if (k.intrigue) {
    const i = k.intrigue;
    box.append(
      h(
        'div',
        { class: 'civ-intrigue' },
        h('b', { text: `Court intrigue: ${i.title}` }),
        h('div', { class: 'small', text: i.text }),
        h(
          'div',
          { class: 'civ-choices' },
          ...i.choices.map((c) =>
            h('button', { text: c.label, title: c.outcome, on: { click: () => chooseIntrigue(id, c.id) } }),
          ),
        ),
        h('div', {
          class: 'small dim',
          text: `Decided by the first traveller who acts, in ${KINGDOMS[id].name} itself; left alone it festers after day ${i.expires}.`,
        }),
      ),
    );
  }
  if (k.chronicle.length)
    box.append(
      h(
        'div',
        { class: 'small dim' },
        ...k.chronicle.slice(0, 4).map((c) => h('div', { text: `Day ${c.day}: ${c.text}` })),
      ),
    );
  return box;
}

/** Festivals and tournaments: what is on today, with the actions to join in, and what comes next. */
function pageantry(day: number): HTMLElement {
  const box = h('div', { class: 'civ-news' }, h('b', { text: 'Festivals & tournaments' }));
  const hosts: FestHost[] = ['home', ...REALM_IDS];
  const where = (host: FestHost) => (host === 'home' ? 'Hadamere and the home towns' : KINGDOMS[host].name);
  for (const host of hosts) {
    const f = festivalToday(host, day);
    if (!f) continue;
    box.append(
      h(
        'div',
        { class: 'civ-intrigue' },
        h('b', { text: `Today: the ${f.name} in ${where(host)}` }),
        h('div', {
          class: 'small',
          text: `${f.desc} Bring ${ITEMS[f.feast]?.name ?? 'a dish'} to the feast (any cooked food is welcome).`,
        }),
        h(
          'div',
          { class: 'civ-choices' },
          h('button', { text: 'Share a dish', on: { click: () => festJoin(host, 'feast') } }),
        ),
      ),
    );
  }
  for (const r of REALM_IDS) {
    if (!tourneyOn(r, day)) continue;
    box.append(
      h(
        'div',
        { class: 'civ-intrigue' },
        h('b', { text: `Today: a royal tournament in ${KINGDOMS[r].capital}` }),
        h('div', {
          class: 'small',
          text: `Noon to six in the ${r === 'aurelion' ? 'lists by the moat' : 'palace square'}: three bouts against ${KINGDOMS[r].name}'s soldiers for the purse and the title ${CHAMPION_TITLE[r]}.`,
        }),
        h(
          'div',
          { class: 'civ-choices' },
          h('button', { text: 'Enter the lists', on: { click: () => festJoin(r, 'tourney') } }),
        ),
      ),
    );
  }
  const home = nextFestivalOf('home', day);
  if (home.in > 0)
    box.append(
      h('div', {
        class: 'small dim',
        text: `Next at home: ${home.festival.name} in ${home.in} day${home.in === 1 ? '' : 's'}.`,
      }),
    );
  if (box.children.length === 1) box.append(h('div', { class: 'small dim', text: 'Nothing today.' }));
  return box;
}

/** The six great kingdoms: lore, your standing, relations and the next festival. */
function kingdomsPage(profile: Profile, seed: number): HTMLElement {
  const day = dayNumber(Date.now());
  const root = h('div', { class: 'kingdoms' });
  root.append(
    h('div', {
      class: 'small dim',
      text: 'Six kingdoms lie across the sea. Trade, quests and kindness raise your standing; standing lowers prices and opens doors. Allies of a kingdom warm to you a little, its rivals cool.',
    }),
  );
  for (const id of REALM_IDS) {
    const k = KINGDOMS[id];
    const rep = profile.rep[id] ?? 0;
    const tier = repTier(rep);
    const next = tier >= 4 ? null : REP_TIERS[(Math.max(0, tier) + 1) as 1 | 2 | 3 | 4];
    const prev = tier <= 0 ? 0 : REP_TIERS[tier as 1 | 2 | 3 | 4];
    const pct = next ? Math.max(0, Math.min(100, ((rep - prev) / (next - prev)) * 100)) : 100;
    const nf = nextFestival(id, day);
    root.append(
      h(
        'details',
        { class: 'kingdom' },
        h(
          'summary',
          {},
          h('b', { text: `${k.name} · ${k.epithet}` }),
          h('span', { class: 'small dim', text: `  ${realmRankName(id, rep)} (${rep})` }),
        ),
        h('div', { class: 'bar xp' }, h('i', { style: `width:${pct}%` })),
        h('div', { class: 'small', text: `${k.ruler.title}: ${k.ruler.name}, in ${k.capital}. ${k.ruler.trait}` }),
        h('div', { class: 'small dim', text: k.culture }),
        h('div', { class: 'small dim', text: `Cuisine: ${k.cuisine}` }),
        h('div', { class: 'small dim', text: `Trade: ${k.economy.trade}` }),
        h('div', {
          class: 'small',
          text: `Next festival: ${nf.festival.name}${nf.in === 0 ? ' (today!)' : ` in ${nf.in} day${nf.in === 1 ? '' : 's'}`}. Next tournament in ${k.capital}: ${nextTourney(id, day) === 0 ? 'today' : `in ${nextTourney(id, day)} days`}.`,
        }),
        realmState(id),
        ...relationsOf(id).map((r) =>
          h('div', { class: 'small dim', text: `${STANCE_LABEL[r.stance]} with ${KINGDOMS[r.other].name}: ${r.note}` }),
        ),
      ),
    );
  }
  root.insertBefore(pageantry(day), root.children[1] ?? null);
  const civ = civState();
  if (civ) {
    const news = REALM_IDS.flatMap((r) => civ.kingdoms[r].chronicle.map((c) => ({ ...c, r })))
      .sort((a, b) => b.day - a.day)
      .slice(0, 8);
    if (news.length)
      root.insertBefore(
        h(
          'div',
          { class: 'civ-news' },
          h('b', { text: 'News from the kingdoms' }),
          ...news.map((n) => h('div', { class: 'small', text: `Day ${n.day} · ${n.text}` })),
        ),
        root.children[1] ?? null,
      );
  }
  const rumors = diplomacyAt(seed, day).filter((d) => d.event);
  if (rumors.length)
    root.append(
      h('div', { class: 'small' }, h('b', { text: 'Court rumours this season' })),
      ...rumors.map((d) => h('div', { class: 'small dim', text: d.rumor })),
    );
  return root;
}
