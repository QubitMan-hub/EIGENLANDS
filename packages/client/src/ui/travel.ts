/** The waystone window: where the stone you stand at can take you, grouped by kingdom network. */
import {
  netName,
  WAYFARER_STEP,
  WAYFARER_MAX,
  type TravelDest,
  type TravelPanel,
  type WayKind,
} from '@eigenlands/shared';
import { h } from './dom';

const GLYPH: Record<WayKind, string> = { waystone: '◆', gate: '⛩', harbor: '⚓' };
const KIND: Record<WayKind, string> = { waystone: 'Waystone', gate: 'Realm Gate', harbor: 'Ferry' };

let styled = false;
function ensureStyles(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const el = document.createElement('style');
  el.id = 'travel-style';
  el.textContent = `
.travel { display: grid; gap: 12px; width: min(680px, 100%); }
.travel-here { display: grid; grid-template-columns: auto 1fr auto; gap: 4px 14px; align-items: center; padding: 10px 14px;
  background: linear-gradient(180deg, var(--leather-hi), var(--leather)); color: var(--parch-hi);
  box-shadow: 0 0 0 2px var(--walnut), inset 0 0 0 1px var(--brass-lo); }
.travel-here .glyph { grid-row: span 2; font-size: 30px; color: var(--verdigris-hi); text-shadow: 0 0 10px #6fd0bd88; }
.travel-here b { font-family: var(--pix); color: var(--brass-hi); font-size: 18px; }
.win-body .travel-here b { color: var(--brass-hi); }
.travel-here .sub { font-size: 14px; color: #e5d6ae; }
.travel-here button { grid-row: span 2; }
.travel-rank { font-size: 15px; color: var(--ink-soft); }
.travel-rank .bar { display: inline-block; vertical-align: middle; width: 120px; height: 8px; margin: 0 8px;
  background: var(--parch-lo); box-shadow: inset 0 0 0 1px #8a7143; }
.travel-rank .bar i { display: block; height: 100%; background: var(--verdigris); }
.travel-net { display: grid; gap: 4px; }
.travel-net h3 { margin: 6px 0 2px; font-size: 14px; letter-spacing: .08em; border-bottom: 2px solid #b79a5c; padding-bottom: 3px; }
.travel-row { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto auto; gap: 10px; align-items: center;
  padding: 6px 4px; border-bottom: 1px solid #b79a5c66; }
.travel-row .g { font-size: 18px; text-align: center; color: var(--ink-teal, #175a52); }
.travel-row .nm { min-width: 0; overflow-wrap: anywhere; }
.travel-row .nm small { display: block; color: var(--ink-soft); font-size: 14px; }
.travel-row .fare { font-family: var(--pix); color: #7a4d0a; white-space: nowrap; }
.travel-row.far .g, .travel-row.far .nm { opacity: .7; }
.travel-row button { min-height: 36px; padding: 4px 14px; }
.stable-row { grid-template-columns: 26px minmax(0, 1fr) auto auto; }
.stable-row input { width: min(220px, 100%); }
.travel-empty { padding: 10px 12px; background: var(--parch-hi); box-shadow: inset 0 0 0 1px #8a7143; }
@media (max-width: 560px) { .travel-row { grid-template-columns: 22px minmax(0, 1fr) auto; } .travel-row .fare { grid-column: 2; } }
`;
  document.head.append(el);
}

export interface TravelActions {
  go(to: string): void;
  bind(): void;
  rename?(kind: 'horse' | 'stag', name: string): void;
  feed?(kind: 'horse' | 'stag'): void;
}

export function buildTravel(t: TravelPanel, act: TravelActions): HTMLElement {
  ensureStyles();
  const root = h('div', { class: 'travel' });
  const isHome = t.home === t.here.id;
  root.append(
    h(
      'div',
      { class: 'travel-here' },
      h('span', { class: 'glyph', text: GLYPH[t.here.kind] }),
      h('b', { text: t.here.name }),
      isHome
        ? h('span', { class: 'sub', text: '⌂ Your Recall home' })
        : h('button', {
            text: '⌂ Bind as home',
            title: 'Recall Shards return you here',
            on: { click: () => act.bind() },
          }),
      h('span', { class: 'sub', text: `${KIND[t.here.kind]} · ${netName(t.here.net)}` }),
    ),
  );
  const next = t.rank >= WAYFARER_MAX ? null : (t.rank + 1) * WAYFARER_STEP;
  const pct = next ? Math.round((100 * (t.attuned - t.rank * WAYFARER_STEP)) / WAYFARER_STEP) : 100;
  root.append(
    h(
      'div',
      { class: 'travel-rank' },
      `Wayfarer rank ${t.rank}`,
      h('span', { class: 'bar' }, h('i', { style: `width:${pct}%` })),
      next
        ? `${t.attuned} stones attuned · ${next - t.attuned} more for rank ${t.rank + 1}`
        : `${t.attuned} stones attuned · highest rank`,
      t.rank ? ` · fares ${t.rank * 12}% cheaper` : '',
    ),
  );
  if (t.stable?.length) root.append(stable(t, act));
  if (!t.dests.length) {
    root.append(
      h('div', {
        class: 'travel-empty',
        text: 'This stone knows no other yet. Walk up to waystones in towns and out in the wilds to attune them; then any attuned stone can carry you to the rest of its kingdom. Realm Gates and Ferries link the kingdoms.',
      }),
    );
    return root;
  }
  // this network first, then the others; nearest first within each
  const nets = [...new Set(t.dests.map((d) => d.net))].sort((a, b) =>
    a === t.here.net ? -1 : b === t.here.net ? 1 : netName(a).localeCompare(netName(b)),
  );
  for (const net of nets) {
    const list = t.dests
      .filter((d) => d.net === net)
      .sort((a, b) => Number(b.reachable) - Number(a.reachable) || a.cost - b.cost);
    const box = h('div', { class: 'travel-net' }, h('h3', { text: netName(net) }));
    for (const d of list) box.append(row(d, t.coins, act));
    root.append(box);
  }
  root.append(
    h('div', {
      class: 'small dim',
      text: 'Travel takes a few quiet seconds: moving or being struck breaks the spell. Nothing may be hunting you when you start.',
    }),
  );
  return root;
}

/** Every waystone keeps a hitching post: name your mounts and give them a feed here. */
function stable(t: TravelPanel, act: TravelActions): HTMLElement {
  const box = h('div', { class: 'travel-net travel-stable' }, h('h3', { text: 'Hitching post' }));
  for (const m of t.stable ?? []) {
    const input = h('input', { type: 'text', value: m.name, maxLength: 18 }) as HTMLInputElement;
    input.setAttribute('aria-label', `Name of your ${m.kind === 'stag' ? 'Moonlit Stag' : 'horse'}`);
    const mins = Math.ceil(m.fedMs / 60000);
    box.append(
      h(
        'div',
        { class: 'travel-row stable-row' },
        h('span', { class: 'g', text: m.kind === 'stag' ? '✧' : '♞' }),
        h(
          'div',
          { class: 'nm' },
          input,
          h('small', {
            text: `${m.kind === 'stag' ? 'Moonlit Stag' : 'Riding horse'} · ${mins > 0 ? `well fed for ${mins} min (10% swifter)` : 'hungry for hay, carrots, apples or oats'}`,
          }),
        ),
        h('button', { text: 'Rename', on: { click: () => act.rename?.(m.kind, input.value) } }),
        h('button', {
          text: `Feed${t.feed ? ` (${t.feed})` : ''}`,
          disabled: !t.feed,
          on: { click: () => act.feed?.(m.kind) },
        }),
      ),
    );
  }
  return box;
}

function row(d: TravelDest, coins: number, act: TravelActions): HTMLElement {
  const short = coins < d.cost;
  return h(
    'div',
    { class: `travel-row${d.reachable ? '' : ' far'}` },
    h('span', { class: 'g', text: GLYPH[d.kind] }),
    h(
      'div',
      { class: 'nm' },
      d.name,
      h('small', {
        text: d.reachable
          ? `${KIND[d.kind]} · ${Math.round(d.x)}, ${Math.round(d.y)}`
          : 'Another kingdom: leave from a Realm Gate or Ferry, and arrive at one',
      }),
    ),
    h('span', { class: 'fare', text: `${d.cost}c` }),
    h('button', {
      class: d.reachable && !short ? 'primary' : '',
      text: short ? 'Too dear' : 'Travel',
      disabled: !d.reachable || short,
      on: { click: () => act.go(d.id) },
    }),
  );
}
