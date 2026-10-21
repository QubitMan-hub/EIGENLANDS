import { HOTBAR, INV_SIZE, ITEMS, type Stack } from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { clear, h, iconCell, tooltipFor, type Tooltip } from './dom';

export interface InvActions {
  move(from: number, to: number): void;
  trash(slot: number, n: number): void;
  equip(slot: number, as: 'ring1' | 'ring2' | 'outfit' | 'unequip_ring1' | 'unequip_ring2'): void;
  use(slot: number): void;
}

/** 30-slot pack (row 1 = hotbar), equipment, wardrobe and trash. */
export function buildInventory(profile: Profile, tip: Tooltip, act: InvActions, portrait: () => HTMLElement): HTMLElement {
  const root = h('div', { class: 'inv-win' });
  const grid = h('div', { class: 'inv-grid' });
  const side = h('div', { class: 'inv-side' });

  const cellFor = (i: number): HTMLElement => {
    const st = profile.inv[i] ?? null;
    const slot = h('div', { class: `slot${i < HOTBAR ? ' hot' : ''}`, data: { i } });
    if (st) {
      const cell = iconCell(st);
      cell.draggable = true;
      cell.addEventListener('dragstart', (e) => { e.dataTransfer?.setData('text/plain', String(i)); tip.hide(); });
      slot.append(cell);
      tip.attach(slot, () => tooltipFor(st));
      slot.addEventListener('dblclick', () => quick(i, st));
      slot.addEventListener('contextmenu', (e) => { e.preventDefault(); quick(i, st); });
    }
    slot.addEventListener('dragover', (e) => e.preventDefault());
    slot.addEventListener('drop', (e) => { e.preventDefault(); const f = Number(e.dataTransfer?.getData('text/plain')); if (Number.isInteger(f)) act.move(f, i); });
    return slot;
  };

  const quick = (i: number, st: Stack) => {
    const d = ITEMS[st.id];
    if (d?.kind === 'ring') act.equip(i, profile.equip.ring1 ? (profile.equip.ring2 ? 'ring1' : 'ring2') : 'ring1');
    else if (d?.kind === 'outfit') act.equip(i, 'outfit');
    else act.use(i);
  };

  const render = () => {
    clear(grid); clear(side);
    for (let i = 0; i < INV_SIZE; i++) grid.append(cellFor(i));
    // equipment
    const eqSlot = (label: string, st: Stack | null, key: 'ring1' | 'ring2') => {
      const slot = h('div', { class: 'slot eq', title: label }, st ? iconCell(st) : h('span', { class: 'eqlabel', text: label }));
      if (st) { tip.attach(slot, () => tooltipFor(st)); slot.addEventListener('click', () => act.equip(0, key === 'ring1' ? 'unequip_ring1' : 'unequip_ring2')); }
      slot.addEventListener('dragover', (e) => e.preventDefault());
      slot.addEventListener('drop', (e) => { e.preventDefault(); const f = Number(e.dataTransfer?.getData('text/plain')); if (Number.isInteger(f) && ITEMS[profile.inv[f]?.id ?? '']?.kind === 'ring') act.equip(f, key); });
      return slot;
    };
    side.append(h('div', { class: 'side-title', text: 'Equipment' }));
    side.append(h('div', { class: 'eq-row' }, portrait(), h('div', { class: 'eq-col' }, eqSlot('Ring', profile.equip.ring1, 'ring1'), eqSlot('Ring', profile.equip.ring2, 'ring2'))));
    const st = profile.stats;
    side.append(h('div', { class: 'stats' },
      h('div', { text: `Max HP  +${st.hpBonus}` }), h('div', { text: `Attack  +${st.atkBonus}` }),
      h('div', { text: `Luck    +${st.luck}` }), h('div', { text: `Haste   +${Math.round(st.haste * 100)}%` })));
    // wardrobe
    const wardrobe = h('div', { class: 'ward' });
    profile.inv.forEach((s, i) => {
      if (s && ITEMS[s.id]?.kind === 'outfit') {
        const b = h('div', { class: `slot small${profile.equip.outfit === ITEMS[s.id]!.outfit ? ' on' : ''}`, title: ITEMS[s.id]!.name, on: { click: () => act.equip(i, 'outfit') } }, iconCell(s, { showCount: false }));
        tip.attach(b, () => tooltipFor(s));
        wardrobe.append(b);
      }
    });
    side.append(h('div', { class: 'side-title', text: 'Wardrobe' }), wardrobe.childElementCount ? wardrobe : h('div', { class: 'small dim', text: 'Weave outfits at a loom.' }));
    // trash
    const trash = h('div', { class: 'trash', text: '🗑 Drop here to discard' });
    trash.addEventListener('dragover', (e) => e.preventDefault());
    trash.addEventListener('drop', (e) => {
      e.preventDefault();
      const f = Number(e.dataTransfer?.getData('text/plain'));
      const stack = profile.inv[f];
      if (Number.isInteger(f) && stack && (ITEMS[stack.id]!.value * stack.n < 60 || confirm(`Discard ${stack.n} × ${ITEMS[stack.id]!.name}?`))) act.trash(f, stack.n);
    });
    side.append(trash);
  };
  render();
  root.append(h('div', { class: 'inv-main' }, h('div', { class: 'coins', text: `${profile.coins} coins` }), grid, h('div', { class: 'small dim', text: 'Double-click / right-click to equip or use. Drag to rearrange. Row 1 is your quick-bar (keys 1-0).' })), side);
  const unsub = profile.onChange(() => { if (!root.isConnected) { unsub(); return; } render(); (root.querySelector('.coins') as HTMLElement).textContent = `${profile.coins} coins`; });
  return root;
}
