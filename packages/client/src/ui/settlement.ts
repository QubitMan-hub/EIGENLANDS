import type { PanelMsg } from '@eigenlands/shared';
import { h } from './dom';
import { ensureP2Styles } from './p2style';
import './homestead.css';
export function buildSettlement(
  m: PanelMsg,
  send: (action: string, extra?: Record<string, unknown>) => void,
): HTMLElement {
  ensureP2Styles();
  const c = m.settlement!;
  const body = h(
    'div',
    { class: 'guild-ledger' },
    h('h2', { text: c.name }),
    h('p', {
      text: `Treasury ${c.bank} coins · ${c.residents.length}/${(c.tier + 1) * 2} residents · upkeep 3 coins per resident per observed dawn`,
    }),
    h('button', { text: 'Deposit 100 coins', on: { click: () => send('deposit') } }),
  );
  if (c.tier < 3)
    body.append(
      h('button', {
        text: `Upgrade charter · ${250 * (c.tier + 1)} treasury coins, ${30 * (c.tier + 1)} wood, ${20 * (c.tier + 1)} stone`,
        on: { click: () => send('upgrade') },
      }),
    );
  body.append(
    h('p', {
      text: 'Residents need separate enclosed, roofed rooms with a bed, table and light. Gardeners water crops within 8 tiles at a paid dawn. Content wardens reduce incoming damage within 20 tiles of this board by 8%. Artisans repair your equipped weapon for 15 coins. Unpaid or damaged housing lowers happiness.',
    }),
  );
  for (const r of c.residents)
    body.append(
      h(
        'article',
        { class: 'guild-contract' },
        h('h3', { text: `${r.name} · ${r.role}` }),
        h('p', { text: `Happiness ${r.happy}/100 · home ${r.x}, ${r.y}` }),
        h('button', { text: 'Dismiss resident', on: { click: () => send('dismiss', { id: r.id }) } }),
      ),
    );
  for (const home of c.homes) {
    const row = h(
      'article',
      { class: 'guild-contract' },
      h('h3', { text: `Home ${home.x}, ${home.y}` }),
      h('p', { text: home.reason }),
    );
    if (home.valid)
      for (const role of ['gardener', 'artisan', 'warden'])
        row.append(
          h('button', {
            text: `Invite ${role} · 50 treasury coins`,
            on: { click: () => send('invite', { x: home.x, y: home.y, role }) },
          }),
        );
    body.append(row);
  }
  if (!c.homes.length) body.append(h('p', { text: 'Place an owned bed in a home within 24 tiles of this board.' }));
  body.append(h('button', { text: 'Artisan repair · 15 coins', on: { click: () => send('repair') } }));

  return body;
}
