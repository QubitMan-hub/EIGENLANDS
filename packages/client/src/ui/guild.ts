import { GUILD_QUESTS, GUILD_RANKS, objectiveText, type PanelMsg } from '@eigenlands/shared';
import { h } from './dom';
import { ensureP2Styles } from './p2style';
import './homestead.css';
export function buildGuild(
  m: PanelMsg,
  act: (id: string, action: 'accept' | 'turnin' | 'abandon') => void,
  options: { classes?: () => void; party?: () => void; settlement?: () => void } = {},
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
  const ladder = h('div', { class: 'guild-ladder' });
  ladder.setAttribute('aria-label', 'Guild ranks');
  for (const r of GUILD_RANKS) ladder.append(h('span', { class: r === g.rank ? 'current' : '', text: r }));
  root.append(ladder);
  const tabs = h('div', { class: 'dbtns' }),
    body = h('div');
  const render = (mode: 'current' | 'record' | 'future') => {
    body.replaceChildren();
    for (const entry of g.contracts) {
      const d = entry.definition ?? GUILD_QUESTS.find((d) => d.id === entry.id)!;
      if (mode === 'current' && !['open', 'active', 'ready'].includes(entry.state)) continue;
      if (mode === 'record' && entry.state !== 'done') continue;
      if (mode === 'future' && entry.state !== 'locked') continue;
      const card = h('article', { class: 'guild-contract' }, h('h3', { text: d.title }), h('p', { text: d.summary }));
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
      if (d.rewards.coins) card.append(h('span', { class: 'small dim', text: ` · ${d.rewards.coins} coins` }));
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
