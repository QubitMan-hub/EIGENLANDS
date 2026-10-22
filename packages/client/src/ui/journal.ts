import { ITEMS, MAX_HEARTS, MAX_SKILL, NPCS, POINTS_PER_HEART, RECIPES, SKILLS, SKILL_NAMES, SKILL_PERKS, STATION_NAMES, hearts, skillLevel, xpForSkillLevel, type StationId } from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { clear, h, iconCell } from './dom';
import { heartsRow } from './dialogue';

export type JournalTab = 'skills' | 'friends' | 'recipes' | 'help';

export function buildJournal(profile: Profile, portrait: (npcId: string) => string, tab0: JournalTab = 'skills'): HTMLElement {
  const root = h('div', { class: 'journal' });
  const body = h('div', { class: 'jbody' });
  let tab: JournalTab = tab0;
  const tabs = h('div', { class: 'tabs' });

  const render = () => {
    clear(tabs); clear(body);
    for (const [id, label] of [['skills', 'Skills'], ['friends', 'Friends'], ['recipes', 'Recipes'], ['help', 'Controls']] as const) tabs.append(h('button', { class: id === tab ? 'primary' : '', text: label, on: { click: () => { tab = id; render(); } } }));
    if (tab === 'skills') {
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
          h('div', {}, h('b', { text: n.name }), h('div', { class: 'small dim', text: n.title }), heartsRow(hh),
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
        ['Move', 'WASD / arrows · left stick · touch stick'], ['Attack', 'J / Z · left click · A / RT'], ['Skill shot', 'K / X · right click (aims at cursor)'],
        ['Dash (dodge)', 'Space / Shift · B'],
        // combat 2.0
        ['Combo', 'tap Attack: slash, slash, lunging finisher (presses are buffered; dash cancels recovery)'],
        ['Heavy strike', 'hold Attack to charge (ring fills), release to cleave — breaks armour'],
        ['Phase Slip', 'dash through a red warning just before it fills: slow-mo + guaranteed critical counter'],
        ['Dash charges', '2 charges (pips under your feet), refill one at a time'],
        ['Reflect', 'swing at a Phase Wisp orb to bat it back'], ['Use item / talk / open', 'E · Y — acts on the tile you face (or the cursor if close)'],
        ['Quick-bar', '1–0 · mouse wheel · [ ] · tap'], ['Inventory', 'I'], ['Journal (skills, friends, recipes)', 'L'], ['Field crafting', 'C'], ['Settings', 'gear icon · F3 debug'],
      ];
      for (const [a, b] of rows) body.append(h('div', { class: 'keyrow' }, h('span', { text: a }), h('span', { class: 'dim', text: b })));
      body.append(h('div', { class: 'small dim', text: 'Tip: everything is explained as you go — the hint box tells you what to try next.' }));
    }
  };
  render();
  const unsub = profile.onChange(() => { if (!root.isConnected) { unsub(); return; } render(); });
  root.append(tabs, body);
  return root;
}
