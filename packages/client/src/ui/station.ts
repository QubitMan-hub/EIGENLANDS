import {
  CAT_GROUPS,
  DISC_BY_ID,
  EQUIP_SLOTS,
  GEAR_SLOT_NAMES,
  ITEMS,
  MAX_DISC,
  MAX_UPGRADE,
  RARITY_COLORS,
  RARITY_NAMES,
  STATION_BY_ID,
  STATION_NAMES,
  discLevel,
  durabilityOf,
  enchantBlock,
  gearClassOf,
  isBroken,
  itemName,
  matchExperiment,
  recipeBlock,
  recipesFor,
  recipesMaking,
  recipesUsing,
  repairCost,
  sourceLines,
  upgradeCost,
  upgradeNeed,
  xpForDiscLevel,
  type EquipSlotKey,
  type GearRef,
  type ItemDef,
  type Recipe,
  type Stack,
  type StationId,
} from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { clear, h, iconCell, tooltipFor, type Tooltip } from './dom';
import { Prefs } from './prefs';

export interface StationActions {
  craft(recipe: string, n: number): void;
  experiment?(items: Array<{ slot: number; n: number }>): void;
  /** repair, upgrade or enchant a piece of gear at this bench */
  gear?(action: 'repair' | 'upgrade' | 'enchant', ref: GearRef, rune?: number): void;
}

const have = (profile: Profile, id: string) => profile.count(id);
const PAGE = 30;
type Filter = 'all' | 'can' | 'fav' | `g:${string}`;
type Sort = 'level' | 'name' | 'rarity';

const rarityOf = (id: string): number => ITEMS[id]?.rarity ?? 0;
const nameOf = (id: string): string => ITEMS[id]?.name ?? id;
const colorOf = (id: string): string => (rarityOf(id) ? RARITY_COLORS[rarityOf(id)]! : '');
const groupOf = (r: Recipe): string => {
  const cat = ITEMS[r.out.id]?.cat;
  return CAT_GROUPS.find((g) => cat && g.cats.includes(cat))?.id ?? 'other';
};

/**
 * The crafting book for one station: every recipe the bench can make, searchable and filterable, with favourites,
 * ingredient tracking, a recipe tree for any item, the gear bench (repair, upgrade, enchant) and the experiment slots.
 */
export function buildStation(station: StationId, profile: Profile, tip: Tooltip, act: StationActions): HTMLElement {
  const root = h('div', { class: 'craftbook' });
  const def = STATION_BY_ID[station];
  const prefs = new Prefs();
  const offered: Array<{ slot: number; n: number }> = [];
  let tab: 'recipes' | 'gear' | 'experiment' = 'recipes';
  let query = '';
  let filter: Filter = 'all';
  let sort: Sort = 'level';
  let page = 0;
  let selected: string | null = null;

  const allRecipes = recipesFor(station);
  const groups = [...new Set(allRecipes.map(groupOf))];
  const knows = (r: Recipe) => profile.knows(r);
  const canMake = (r: Recipe, n = 1) =>
    !r.inputs.some((i) => i.id.startsWith('*')) &&
    r.inputs.every((i) => have(profile, i.id) >= i.n * n) &&
    !recipeBlock(r, profile.craftProfile()) &&
    (!r.tool || have(profile, r.tool) > 0);

  // ── header: the disciplines this bench trains
  const header = h('div', { class: 'cb-head' });
  const renderHeader = () => {
    clear(header);
    for (const d of def.disc) {
      const xp = profile.disc[d],
        lv = discLevel(xp),
        lo = xpForDiscLevel(lv),
        hi = lv >= MAX_DISC ? lo : xpForDiscLevel(lv + 1);
      const frac = hi > lo ? (xp - lo) / (hi - lo) : 1;
      header.append(
        h(
          'div',
          { class: 'disc', title: DISC_BY_ID[d].perk },
          h('b', { text: `${DISC_BY_ID[d].name} ${lv}` }),
          h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(frac * 100)}%` })),
          h('span', { class: 'small dim', text: lv >= MAX_DISC ? 'Master' : `${xp - lo}/${hi - lo} xp` }),
        ),
      );
    }
  };

  const tabs = h('div', { class: 'cb-tabs' });
  const body = h('div', { class: 'cb-body' });
  const setTab = (t: typeof tab) => {
    tab = t;
    render();
  };
  const renderTabs = () => {
    clear(tabs);
    const mk = (id: typeof tab, label: string) =>
      tabs.append(
        h('button', { class: `tab${tab === id ? ' on' : ''}`, text: label, on: { click: () => setTab(id) } }),
      );
    mk('recipes', `Recipes (${allRecipes.filter(knows).length}/${allRecipes.length})`);
    if (act.gear) mk('gear', 'Gear');
    if (act.experiment) mk('experiment', 'Experiment');
  };

  // ── a recipe's ingredient chips
  const chips = (r: Recipe, n: number) =>
    r.inputs.map((i) => {
      const wild = i.id.startsWith('*');
      const hv = wild ? 0 : have(profile, i.id);
      const ok = !wild && hv >= i.n * n;
      const el = h(
        'span',
        { class: `ing ${ok ? 'ok' : 'no'}`, title: wild ? 'Any two different seeds' : nameOf(i.id) },
        iconCell({ id: wild ? 'turnip_seed' : i.id, n: 1 }, { showCount: false }),
        h('span', { text: wild ? `${i.n}× seed` : `${Math.min(hv, 999)}/${i.n * n}` }),
      );
      return el;
    });

  const learnText = (r: Recipe): string => {
    if (r.learn === 'discover') return 'Discovered by experimenting at this bench.';
    if (r.learn === 'scroll') return 'Taught by a recipe scroll found in a vault, a ruin or as a reward.';
    if (r.learn.startsWith('npc:')) return `Taught by a villager (${r.learn.slice(4)}).`;
    if (r.learn.startsWith('realm:')) return `Learned from ${r.learn.slice(6)}, once they count you a friend.`;
    if (r.learn === 'level') return `Learned at ${DISC_BY_ID[r.disc].name} level ${r.lvl}.`;
    return 'Known from the start.';
  };

  // ───────── recipes tab ─────────
  const list = h('div', { class: 'recipes' });
  const detail = h('div', { class: 'cb-detail' });
  const pager = h('div', { class: 'cb-pager' });

  const visible = (): Recipe[] => {
    const q = query.trim().toLowerCase();
    let rs = allRecipes.filter((r) => {
      const known = knows(r);
      // hidden recipes stay hidden until found; levelled and kingdom recipes are shown locked so there is something to aim at
      // scroll recipes stay secret until read; discoverable and taught ones show a hint so there is something to find
      if (!known && r.learn === 'scroll') return false;
      if (q) {
        const d = ITEMS[r.out.id];
        const hay = `${d?.name ?? ''} ${d?.cat ?? ''} ${r.inputs.map((i) => nameOf(i.id)).join(' ')}`.toLowerCase();
        if (!hay.includes(q) || (!known && r.learn === 'discover')) return false;
      }
      if (filter === 'can') return known && canMake(r);
      if (filter === 'fav') return prefs.isFav(r.id);
      if (filter.startsWith('g:')) return groupOf(r) === filter.slice(2);
      return true;
    });
    rs = rs.sort((a, b) => {
      const ka = knows(a) ? 0 : 1,
        kb = knows(b) ? 0 : 1;
      if (ka !== kb) return ka - kb;
      if (sort === 'name') return nameOf(a.out.id).localeCompare(nameOf(b.out.id));
      if (sort === 'rarity') return rarityOf(b.out.id) - rarityOf(a.out.id) || a.lvl - b.lvl;
      return a.disc.localeCompare(b.disc) || a.lvl - b.lvl || nameOf(a.out.id).localeCompare(nameOf(b.out.id));
    });
    return rs;
  };

  const row = (r: Recipe): HTMLElement => {
    const d = ITEMS[r.out.id]!;
    const known = knows(r);
    const block = known ? recipeBlock(r, profile.craftProfile()) : null;
    const can = known && canMake(r);
    const out: Stack = { id: r.out.id, n: r.out.n };
    const wild = r.inputs.some((i) => i.id.startsWith('*'));
    const star = h('button', {
      class: `star${prefs.isFav(r.id) ? ' on' : ''}`,
      text: prefs.isFav(r.id) ? '★' : '☆',
      title: 'Favourite',
      on: {
        click: (e) => {
          e.stopPropagation();
          prefs.toggleFav(r.id);
          renderBody();
        },
      },
    });
    const el = h(
      'div',
      {
        class: `recipe${can ? ' can' : ''}${known ? '' : ' locked'}${selected === r.id ? ' sel' : ''}`,
        on: { click: () => select(r.id) },
      },
      h(
        'div',
        { class: 'rout' },
        iconCell(out),
        h(
          'div',
          { class: 'rname' },
          h('b', {
            text: known || r.learn === 'level' || r.learn.startsWith('realm:') ? d.name : '???',
            style: colorOf(r.out.id) ? `color:${colorOf(r.out.id)}` : '',
          }),
          h('div', {
            class: `small ${block ? 'bad' : 'dim'}`,
            text: known
              ? (block ?? `${DISC_BY_ID[r.disc].name} ${r.lvl}${r.stage ? ` · stage ${r.stage}` : ''}`)
              : learnText(r),
          }),
        ),
        star,
      ),
      known ? h('div', { class: 'rin' }, ...chips(r, 1)) : h('div', { class: 'small dim', text: r.hint }),
      known && !wild
        ? h(
            'div',
            { class: 'rbtns' },
            h('button', {
              text: '×1',
              disabled: !can,
              on: { click: (e) => (e.stopPropagation(), act.craft(r.id, 1)) },
            }),
            h('button', {
              text: '×5',
              disabled: !canMake(r, 5),
              on: { click: (e) => (e.stopPropagation(), act.craft(r.id, 5)) },
            }),
          )
        : h('span'),
    );
    if (known) tip.attach(el.querySelector('.cell') as HTMLElement, () => tooltipFor(out));
    return el;
  };

  const select = (id: string) => {
    selected = selected === id ? null : id;
    renderBody();
  };

  const treeRow = (id: string, n: number, depth: number, seen: Set<string>): HTMLElement => {
    const wrap = h('div', { class: 'tree' });
    const hv = have(profile, id);
    const rec = recipesMaking(id)[0];
    const sub = rec && depth < 3 && !seen.has(id) ? rec : null;
    wrap.append(
      h(
        'div',
        { class: `tnode ${hv >= n ? 'ok' : 'no'}` },
        iconCell({ id, n: 1 }, { showCount: false }),
        h('b', { text: `${nameOf(id)}`, style: colorOf(id) ? `color:${colorOf(id)}` : '' }),
        h('span', { class: 'small', text: ` ${Math.min(hv, 999)}/${n}` }),
        h('span', { class: 'small dim', text: hv >= n ? '' : ` — ${sourceLines(id).slice(0, 2).join('; ')}` }),
      ),
    );
    if (sub && hv < n) {
      const next = new Set(seen).add(id);
      const kids = h('div', { class: 'tkids' });
      const times = Math.ceil((n - hv) / sub.out.n);
      for (const i of sub.inputs) if (!i.id.startsWith('*')) kids.append(treeRow(i.id, i.n * times, depth + 1, next));
      wrap.append(kids);
    }
    return wrap;
  };

  const renderDetail = () => {
    clear(detail);
    const r = selected ? allRecipes.find((x) => x.id === selected) : null;
    if (!r) {
      detail.append(
        h('div', {
          class: 'small dim',
          text: 'Pick a recipe to see what it needs, where to find it and what it is used for.',
        }),
      );
      return;
    }
    const d: ItemDef = ITEMS[r.out.id]!;
    const known = knows(r);
    const out: Stack = { id: r.out.id, n: r.out.n };
    detail.append(
      h(
        'div',
        { class: 'cb-title' },
        iconCell(out),
        h(
          'div',
          {},
          h('b', {
            text: known || r.learn === 'level' ? d.name : '???',
            style: colorOf(r.out.id) ? `color:${colorOf(r.out.id)}` : '',
          }),
          h('div', { class: 'small dim', text: `${RARITY_NAMES[rarityOf(r.out.id)]}${d.cat ? ` · ${d.cat}` : ''}` }),
        ),
      ),
      h('div', { class: 'small', text: known || r.learn === 'level' ? d.desc : r.hint }),
      h('div', { class: 'small dim', text: learnText(r) }),
    );
    const tr = tracked();
    detail.append(
      h(
        'div',
        { class: 'cb-actions' },
        h('button', {
          text: prefs.isFav(r.id) ? '★ Favourite' : '☆ Favourite',
          on: { click: () => (prefs.toggleFav(r.id), renderBody()) },
        }),
        h('button', {
          text: tr.has(r.id) ? 'Stop tracking' : 'Track ingredients',
          on: {
            click: () => {
              prefs.toggleTrack(r.id);
              renderBody();
            },
          },
        }),
      ),
    );
    if (r.tool) {
      const ok = have(profile, r.tool) > 0;
      detail.append(
        h('div', {
          class: `small ${ok ? 'good' : 'bad'}`,
          text: `${ok ? '✓' : '✗'} Needs ${nameOf(r.tool)} in your pack`,
        }),
      );
    }
    const block = recipeBlock(r, profile.craftProfile());
    if (block) detail.append(h('div', { class: 'small bad', text: block }));
    if (r.quality)
      detail.append(h('div', { class: 'small dim', text: 'Quality depends on your skill: Crude to Masterwork.' }));
    detail.append(h('div', { class: 'side-title', text: 'Ingredients' }));
    for (const i of r.inputs) {
      if (i.id.startsWith('*'))
        detail.append(h('div', { class: 'small dim', text: `${i.n}× any seeds (experiment bench)` }));
      else detail.append(treeRow(i.id, i.n, 0, new Set([r.out.id])));
    }
    const uses = recipesUsing(r.out.id).slice(0, 6);
    if (uses.length) {
      detail.append(
        h('div', { class: 'side-title', text: 'Used in' }),
        h('div', { class: 'small dim', text: uses.map((u) => nameOf(u.out.id)).join(', ') }),
      );
    }
  };

  const tracked = (): Set<string> => new Set(prefs.tracked());

  const renderRecipes = () => {
    const rs = visible();
    const pages = Math.max(1, Math.ceil(rs.length / PAGE));
    page = Math.min(page, pages - 1);
    clear(list);
    if (!rs.length)
      list.append(h('div', { class: 'small dim', text: query ? 'Nothing matches that search.' : 'Nothing here yet.' }));
    for (const r of rs.slice(page * PAGE, page * PAGE + PAGE)) list.append(row(r));
    clear(pager);
    if (pages > 1)
      pager.append(
        h('button', {
          text: '‹',
          disabled: page === 0,
          on: { click: () => ((page = Math.max(0, page - 1)), renderBody()) },
        }),
        h('span', { class: 'small', text: `Page ${page + 1} of ${pages} · ${rs.length} recipes` }),
        h('button', {
          text: '›',
          disabled: page >= pages - 1,
          on: { click: () => ((page = Math.min(pages - 1, page + 1)), renderBody()) },
        }),
      );
    else pager.append(h('span', { class: 'small dim', text: `${rs.length} recipe${rs.length === 1 ? '' : 's'}` }));
    renderDetail();
  };

  const controls = h('div', { class: 'cb-controls' });
  const search = h('input', {
    type: 'text',
    placeholder: 'Search by item, category or ingredient',
    value: query,
    on: {
      input: (e) => {
        query = (e.target as HTMLInputElement).value;
        page = 0;
        renderRecipes();
      },
    },
  });
  const renderControls = () => {
    clear(controls);
    const chip = (id: Filter, label: string) =>
      h('button', {
        class: `chip${filter === id ? ' on' : ''}`,
        text: label,
        on: { click: () => ((filter = id), (page = 0), renderBody()) },
      });
    controls.append(
      search,
      h(
        'div',
        { class: 'chips' },
        chip('all', 'All'),
        chip('can', 'Can make'),
        chip('fav', '★'),
        ...groups.map((g) => chip(`g:${g}`, CAT_GROUPS.find((x) => x.id === g)?.name ?? 'Other')),
      ),
      h(
        'select',
        { on: { change: (e) => ((sort = (e.target as HTMLSelectElement).value as Sort), renderBody()) } },
        ...(['level', 'name', 'rarity'] as const).map((s) => {
          const o = h('option', { text: `Sort: ${s}`, value: s });
          o.selected = s === sort;
          return o;
        }),
      ),
    );
  };

  // ───────── gear tab ─────────
  const gearTab = () => {
    const wrap = h('div', { class: 'cb-gear' });
    const items: Array<{ ref: GearRef; stack: Stack; where: string }> = [];
    for (const k of EQUIP_SLOTS) {
      const s = profile.equip[k as EquipSlotKey] as Stack | null | undefined;
      if (s && gearClassOf(s.id))
        items.push({
          ref: { where: 'equip', slot: k },
          stack: s,
          where: k === 'weapon' ? 'Wielded' : ((GEAR_SLOT_NAMES as Record<string, string>)[k] ?? `Worn: ${k}`),
        });
    }
    profile.inv.forEach((s, i) => {
      if (s && gearClassOf(s.id) && s.p?.maxDur !== undefined)
        items.push({ ref: { where: 'inv', slot: i }, stack: s, where: 'Pack' });
    });
    const runes = profile.inv.map((s, i) => ({ s, i })).filter((x) => x.s && ITEMS[x.s.id]?.use?.t === 'rune');
    let any = false;
    wrap.append(
      h('div', {
        class: 'small dim',
        text:
          station === 'enchanting'
            ? 'Bind a rune from your pack into a piece of gear. A new rune replaces the old one.'
            : 'Mend worn gear with a share of what it was made from, or improve it (+6% stats per level).',
      }),
    );
    for (const { ref, stack, where } of items) {
      const makes = recipesMaking(stack.id)[0];
      const here = station === 'enchanting' || makes?.station === station;
      if (!here) continue;
      any = true;
      const du = durabilityOf(stack.p);
      const broken = isBroken(stack.p);
      const rep = repairCost(stack.id, stack.p);
      const upc = upgradeCost(stack.id, stack.p);
      const need = upgradeNeed(stack.id, stack.p);
      const lv = need ? discLevel(profile.disc[need.disc]) : 0;
      const el = h(
        'div',
        { class: 'recipe gear' },
        h(
          'div',
          { class: 'rout' },
          iconCell({ ...stack, n: 1 }),
          h(
            'div',
            { class: 'rname' },
            h('b', { text: itemName(stack), style: colorOf(stack.id) ? `color:${colorOf(stack.id)}` : '' }),
            h('div', {
              class: `small ${broken ? 'bad' : 'dim'}`,
              text: `${where}${du ? ` · ${broken ? 'Broken' : `${du.dur}/${du.max}`}` : ''}${stack.p?.up ? ` · +${stack.p.up}` : ''}${stack.p?.ench ? ` · ${stack.p.ench}` : ''}`,
            }),
          ),
        ),
        h('div', { class: 'rin' }, ...(station === 'enchanting' ? [] : rep.map(([id, n]) => costChip(id, n)))),
        h(
          'div',
          { class: 'rbtns' },
          ...(station === 'enchanting'
            ? [
                h(
                  'select',
                  { class: 'runepick' },
                  ...runes.map(({ s, i }) => {
                    const why = enchantBlock(stack.id, (ITEMS[s!.id]!.use as { key: string }).key);
                    return h('option', { text: `${nameOf(s!.id)}${why ? ' ✗' : ''}`, value: String(i) });
                  }),
                ),
                h('button', {
                  text: 'Enchant',
                  disabled: !runes.length,
                  on: {
                    click: (e) => {
                      const sel = (e.target as HTMLElement).parentElement!.querySelector('select') as HTMLSelectElement;
                      act.gear?.('enchant', ref, Number(sel.value));
                    },
                  },
                }),
              ]
            : [
                h('button', {
                  text: 'Repair',
                  disabled: !du || du.dur >= du.max || !rep.every(([id, n]) => have(profile, id) >= n),
                  on: { click: () => act.gear?.('repair', ref) },
                }),
                h('button', {
                  text: `Upgrade ${(stack.p?.up ?? 0) + 1}`,
                  disabled:
                    (stack.p?.up ?? 0) >= MAX_UPGRADE ||
                    !upc.every(([id, n]) => have(profile, id) >= n) ||
                    lv < (need?.lvl ?? 0),
                  title: need
                    ? `Needs ${need.disc} ${need.lvl}; costs ${upc.map(([id, n]) => `${n} ${nameOf(id)}`).join(', ')}`
                    : '',
                  on: { click: () => act.gear?.('upgrade', ref) },
                }),
              ]),
        ),
      );
      tip.attach(el.querySelector('.cell') as HTMLElement, () => tooltipFor(stack));
      wrap.append(el);
    }
    if (!any)
      wrap.append(h('div', { class: 'small dim', text: 'Nothing you carry or wear can be worked at this bench.' }));
    return wrap;
  };
  const costChip = (id: string, n: number) =>
    h(
      'span',
      { class: `ing ${have(profile, id) >= n ? 'ok' : 'no'}`, title: nameOf(id) },
      iconCell({ id, n: 1 }, { showCount: false }),
      h('span', { text: `${Math.min(have(profile, id), 999)}/${n}` }),
    );

  // ───────── experiment tab ─────────
  const expTab = () => {
    const exp = h('div', { class: 'experiment' });
    exp.append(
      h('div', { class: 'side-title', text: 'Experiment' }),
      h('div', {
        class: 'small dim',
        text: 'Click items in your pack to add them. If they combine into something, you will discover it.',
      }),
    );
    const slots = h('div', { class: 'exp-slots' });
    for (let i = 0; i < 4; i++) {
      const o = offered[i];
      const st = o ? profile.inv[o.slot] : null;
      slots.append(
        h(
          'div',
          {
            class: 'slot',
            title: 'click to remove',
            on: {
              click: () => {
                offered.splice(i, 1);
                renderBody();
              },
            },
          },
          st ? iconCell({ id: st.id, n: o!.n, ...(st.p ? { p: st.p } : {}) }) : null,
        ),
      );
    }
    exp.append(slots);
    const ids = offered.map((o) => ({ id: profile.inv[o.slot]?.id ?? '', n: o.n }));
    const m = offered.length ? matchExperiment(station, ids) : null;
    exp.append(
      h('button', {
        class: 'primary',
        text: 'Try it',
        disabled: !offered.length,
        on: {
          click: () => {
            act.experiment?.(offered.map((o) => ({ ...o })));
            offered.length = 0;
            renderBody();
          },
        },
      }),
    );
    if (m && knows(m)) exp.append(h('div', { class: 'small good', text: `Known: ${nameOf(m.out.id)}` }));
    const pack = h('div', { class: 'pack-pick' });
    profile.inv.forEach((st, i) => {
      if (!st) return;
      const used = offered.find((o) => o.slot === i)?.n ?? 0;
      if (used >= st.n) return;
      const slot = h(
        'div',
        {
          class: 'slot small',
          on: {
            click: () => {
              if (offered.length >= 4 && !offered.find((o) => o.slot === i)) return;
              const o = offered.find((x) => x.slot === i);
              if (o) o.n++;
              else offered.push({ slot: i, n: 1 });
              renderBody();
            },
          },
        },
        iconCell({ ...st, n: st.n - used }, { showCount: true }),
      );
      tip.attach(slot, () => tooltipFor(st));
      pack.append(slot);
    });
    exp.append(h('div', { class: 'side-title', text: 'Your pack' }), pack);
    return exp;
  };

  // ───────── assembly ─────────
  const tracker = h('div', { class: 'cb-track' });
  const renderTracker = () => {
    clear(tracker);
    const ids = prefs.tracked();
    tracker.hidden = !ids.length;
    if (!ids.length) return;
    tracker.append(h('div', { class: 'side-title', text: 'Tracking' }));
    for (const id of ids) {
      const r = allRecipes.find((x) => x.id === id) ?? recipesFor('hand').find((x) => x.id === id);
      if (!r) continue;
      tracker.append(
        h(
          'div',
          { class: 'tr-row' },
          h('b', { text: nameOf(r.out.id) }),
          ...chips(r, 1),
          h('button', {
            text: '×',
            title: 'Stop tracking',
            on: { click: () => (prefs.toggleTrack(id), renderBody()) },
          }),
        ),
      );
    }
  };

  const renderBody = () => {
    renderHeader();
    renderTabs();
    renderTracker();
    clear(body);
    if (tab === 'recipes') {
      renderControls();
      renderRecipes();
      body.append(
        controls,
        h('div', { class: 'cb-split' }, h('div', { class: 'col' }, list, pager), h('div', { class: 'col' }, detail)),
      );
    } else if (tab === 'gear') body.append(gearTab());
    else body.append(expTab());
  };

  const render = renderBody;
  render();
  root.append(h('div', { class: 'side-title', text: `${STATION_NAMES[station]}` }), header, tabs, tracker, body);
  const unsub = profile.onChange(() => {
    if (!root.isConnected) {
      unsub();
      return;
    }
    // keep typing focus: only refresh what the change can affect
    const focus = document.activeElement === search;
    const pos = search.selectionStart;
    render();
    if (focus) {
      search.focus();
      if (pos !== null) search.setSelectionRange(pos, pos);
    }
  });
  return root;
}
