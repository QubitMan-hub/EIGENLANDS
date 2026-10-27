import { GUILD_QUESTS, GUILD_RANKS, ITEMS, contractDay, objectiveText, type PanelMsg } from '@eigenlands/shared';
import { h } from './dom';
import { ensureP2Styles } from './p2style';
import './homestead.css';
export function buildGuild(
  m: PanelMsg,
  act: (id: string, action: 'accept' | 'turnin' | 'abandon') => void,
  options: {
    track?: (id: string, map?: boolean) => void;
    classes?: () => void;
    party?: () => void;
    settlement?: () => void;
  } = {},
): HTMLElement {
  ensureP2Styles();
  const g = m.guild!,
    root = h('div', { class: 'guild-ledger' });
  root.append(
    h(
      'header',
      { class: 'guild-card' },
      h('div', { class: 'guild-seal', text: g.rank ?? '✦' }),
      h(
        'div',
        {},
        h('h2', { text: g.name }),
        h('div', { text: g.rank ? 'Chartered adventurer · ' + g.card : 'Adventurer Guild · New applicant' }),
      ),
    ),
  );
  root.append(
    h('p', {
      class: 'small',
      text: 'Accept work here, earn credit through your own actions, and report to any hall. Each promotion needs commissions and a practical trial. Classes: open Your Path; parties: open Social.',
    }),
  );
  const services = h('div', { class: 'dbtns' });
  if (options.classes) services.append(h('button', { text: 'Choose class & circuit', on: { click: options.classes } }));
  if (options.party) services.append(h('button', { text: 'Form an adventuring party', on: { click: options.party } }));
  if (g.owned && options.settlement)
    services.append(h('button', { text: 'Manage settlement', on: { click: options.settlement } }));
  root.append(services);
  if ((g.generation ?? 6) < 5)
    root.append(
      h('p', {
        class: 'small',
        text: 'The Sixfold Covenant requires the kingdoms and raids of world revision 5 or later. This saved world retains its original generation.',
      }),
    );
  if (g.hall) root.append(h('p', { class: 'small', text: `Reception · ${g.hall}` }));
  const active = g.contracts.filter((e) => e.state === 'active' || e.state === 'ready').length;
  root.append(
    h('p', {
      class: 'guild-workload',
      text: `${active}/3 commissions carried · verified work is paid at any guild board`,
    }),
  );
  const ladder = h('div', { class: 'guild-ladder' });
  ladder.setAttribute('aria-label', 'Guild ranks');
  for (const r of GUILD_RANKS) ladder.append(h('span', { class: r === g.rank ? 'current' : '', text: r }));
  root.append(ladder);
  const tabs = h('div', { class: 'dbtns' }),
    body = h('div');
  const render = (mode: 'current' | 'record' | 'future') => {
    body.replaceChildren();
    const order = { ready: 0, active: 1, open: 2, locked: 3, done: 4 };
    for (const entry of [...g.contracts].sort((a, b) => order[a.state] - order[b.state])) {
      const d = entry.definition ?? GUILD_QUESTS.find((d) => d.id === entry.id)!;
      if (!d) continue; // Older or unknown server content must not break the ledger.
      if (mode === 'current' && !['open', 'active', 'ready'].includes(entry.state)) continue;
      if (mode === 'record' && entry.state !== 'done') continue;
      if (mode === 'future' && entry.state !== 'locked') continue;
      const card = h('article', { class: 'guild-contract' }, h('h3', { text: d.title }), h('p', { text: d.summary }));
      card.append(
        h('p', {
          class: 'guild-entry-state',
          text:
            entry.state === 'ready'
              ? 'Ready to report'
              : entry.state === 'active'
                ? 'Accepted expedition'
                : entry.state === 'open'
                  ? 'Available commission'
                  : entry.state === 'done'
                    ? 'Verified deed'
                    : 'Promotion requirement',
        }),
      );
      const issued = contractDay(entry.id);
      if (issued >= 0 && g.day !== undefined && entry.state !== 'done')
        card.append(
          h('p', {
            class: 'small',
            text: `Daily commission · ${Math.max(0, issued + 3 - g.day)} dawns remaining. Report before day ${issued + 3}.`,
          }),
        );
      for (let i = 0; i < d.objectives.length; i++)
        card.append(h('div', { class: 'small', text: objectiveText(d.objectives[i]!, entry.progress[i] ?? 0) }));
      if (entry.journey && entry.state === 'active') {
        const j = entry.journey,
          point = j.kind === 'rescue' && j.released ? j.home : j.points[Math.min(2, j.stage)];
        card.append(
          h('p', {
            class: 'small',
            text: j.failed
              ? 'Journey failed · abandon to retry'
              : `Journey ${j.stage}/3 · traveller health ${Math.ceil(j.hp)} · rendezvous ${Math.floor(point!.x)}, ${Math.floor(point!.y)}`,
          }),
        );
      }
      if ((entry.state === 'active' || entry.state === 'ready') && options.track) {
        const actions = h('div', { class: 'dbtns' });
        actions.append(
          h('button', { text: 'Track commission', on: { click: () => options.track!(entry.id) } }),
          h('button', { text: 'Show on map', on: { click: () => options.track!(entry.id, true) } }),
        );
        card.append(actions);
      }
      if (entry.journey && entry.state === 'active')
        card.append(h('button', { text: 'Abandon journey', on: { click: () => act(entry.id, 'abandon') } }));
      if (entry.state === 'locked')
        card.append(
          h('p', {
            class: 'small dim',
            text:
              'Requires: ' +
              (d.requires ?? []).map((id) => GUILD_QUESTS.find((q) => q.id === id)?.title ?? id).join(', '),
          }),
        );
      if (entry.state === 'open' || entry.state === 'ready')
        card.append(
          h('button', {
            class: entry.state === 'ready' ? 'primary' : '',
            text:
              entry.state === 'ready'
                ? 'Verify & collect'
                : entry.id === 'guild:rank:F'
                  ? 'Sign the Wayfarer Oath'
                  : 'Accept commission',
            on: { click: () => act(entry.id, entry.state === 'ready' ? 'turnin' : 'accept') },
          }),
        );
      else
        card.append(
          h('span', {
            class: 'small',
            text: entry.state === 'active' ? 'In progress' : entry.state === 'done' ? 'Verified' : 'Not yet eligible',
          }),
        );
      const rewards = [
        d.rewards.coins ? `${d.rewards.coins} coins` : '',
        d.rewards.xp ? `${d.rewards.xp} XP` : '',
        ...(d.rewards.items ?? []).map((s) => `${s.n} ${ITEMS[s.id]?.name ?? s.id}`),
      ].filter(Boolean);
      if (rewards.length)
        card.append(h('p', { class: 'small guild-rewards', text: `Reward · ${rewards.join(' · ')}` }));
      body.append(card);
    }
    if (!body.childElementCount) body.append(h('p', { text: 'No entries on this page yet.' }));
    const scroller = root.closest<HTMLElement>('.win-body');
    if (scroller) scroller.scrollTop = 0;
    for (const button of tabs.querySelectorAll('button'))
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  };
  for (const [mode, label] of [
    ['current', 'My commissions'],
    ['record', 'Verified deeds'],
    ['future', 'Rank requirements'],
  ] as const) {
    const b = h('button', { text: label, on: { click: () => render(mode) } });
    b.dataset.mode = mode;
    tabs.append(b);
  }
  root.append(tabs, body);
  render('current');
  return root;
}
