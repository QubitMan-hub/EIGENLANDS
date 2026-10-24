import { HOTBAR, INV_SIZE, ITEMS, SET_BY_ID, WEAPONS, armorTotals, equipmentLevel, type EquipMsg, type EquipSlotKey, type Stack } from '@eigenlands/shared';
import type { Profile } from '../game/profile';
import { clear, h, iconCell, tooltipFor, type Tooltip } from './dom';
import { buildWeaponGuide } from './weapon-guide';
import { equipmentPreview, weaponComparison } from './equipment-preview';
import { inventorySlots, type InventoryCategory, type InventorySort } from './inventory-query';

export interface InvActions {
  move(from: number, to: number): void;
  trash(slot: number, n: number): void;
  equip(slot: number, as: EquipMsg['as']): void;
  use(slot: number): void;
}

/** 30-slot pack (row 1 = hotbar), equipment, wardrobe and trash. */
export function buildInventory(profile: Profile, tip: Tooltip, act: InvActions, portrait: () => HTMLElement, level: () => number = () => profile.level): HTMLElement {
  const root = h('div', { class: 'inv-win' });
  const grid = h('div', { class: 'inv-grid' });
  const quickGrid = h('div', { class: 'inv-grid' });
  const side = h('div', { class: 'inv-side' });
  const details = h('div', { class: 'inv-detail' });
  let selected = -1;
  const search = h('input', { type: 'search', placeholder: 'Search your pack…' });
  search.setAttribute('aria-label', 'Search inventory');
  const category = h('select'); category.setAttribute('aria-label', 'Item category');
  for (const [value, text] of [['all', 'All items'], ['equipment', 'Equipment'], ['supplies', 'Supplies'], ['materials', 'Materials']]) category.append(h('option', { value, text }));
  const sort = h('select'); sort.setAttribute('aria-label', 'Inventory order');
  for (const [value, text] of [['slot', 'Slot order'], ['name', 'Name'], ['value', 'Stack value']]) sort.append(h('option', { value, text }));
  const count = h('span', { class: 'small inv-count' }); count.setAttribute('aria-live', 'polite');
  const showDetails = () => {
    clear(details);
    const st = profile.inv[selected];
    if (!st) { details.append(h('p', { class: 'small', text: 'Select an item to inspect it. Your quick-bar stays in slot order.' })); return; }
    const d = ITEMS[st.id]!;
    details.append(tooltipFor(st));
    let destination: EquipSlotKey | null = d.kind === 'ring' ? (!profile.equip.ring1 ? 'ring1' : !profile.equip.ring2 ? 'ring2' : 'ring1') : d.armor?.slot ?? (d.weapon ? 'weapon' : null);
    const comparison = h('div', { class: 'inv-comparison' });
    const compare = () => {
      clear(comparison);
      if (!destination) return;
      const old = profile.equip[destination], after = equipmentPreview(profile, selected, destination);
      comparison.append(h('p', { class: 'small dim', text: `If equipped · replaces ${old ? ITEMS[old.id]?.name ?? old.id : 'empty slot'}. Set bonuses included.` }));
      const table = h('table');
      table.append(h('caption', { text: 'Equipment comparison' }), h('thead', {}, h('tr', {}, ...['Stat', 'Now', 'After', 'Change'].map(text => h('th', { text })))));
      const rows = h('tbody');
      for (const [key, label] of [['hpBonus', 'HP bonus'], ['atkBonus', 'Attack bonus'], ['def', 'Defence'], ['phase', 'Phase'], ['luck', 'Luck'], ['haste', 'Haste']] as const) {
        const before = profile.stats[key], value = after[key], delta = value - before;
        if (Math.abs(delta) < .000001) continue;
        const percent = key === 'def' || key === 'phase' || key === 'haste';
        const format = (v: number) => `${Number((v * (percent ? 100 : 1)).toFixed(2))}${percent ? '%' : ''}`;
        rows.append(h('tr', {}, h('th', { text: label }), h('td', { text: format(before) }), h('td', { text: format(value) }), h('td', { class: delta > 0 ? 'gain' : 'loss', text: `${delta > 0 ? '+' : '−'}${format(Math.abs(delta))}` })));
      }
      if (rows.childElementCount) { table.append(rows); comparison.append(table); }
      else comparison.append(h('p', { class: 'small', text: 'No change to passive stats. Attacks and appearance may differ.' }));
    };
    if (d.kind === 'ring') {
      const ring = h('select'); ring.setAttribute('aria-label', 'Replace ring slot');
      for (const value of ['ring1', 'ring2'] as const) ring.append(h('option', { value, text: `Ring ${value === 'ring1' ? 1 : 2} · ${profile.equip[value] ? ITEMS[profile.equip[value]!.id]?.name : 'empty'}` }));
      ring.value = destination!;
      ring.addEventListener('change', () => { destination = ring.value as 'ring1' | 'ring2'; compare(); });
      details.append(ring);
    }
    compare(); details.append(comparison);
    const weapon = weaponComparison(profile, selected);
    if (weapon) details.append(buildWeaponGuide(weapon));
    const required = equipmentLevel(st.id), locked = level() < required;
    if (d.weapon || d.armor) details.append(h('p', {class:locked ? 'equip-lock' : 'small dim', text:locked ? `Requires level ${required} · your level ${level()}.` : `Requires level ${required}.`}));
    const equippable = !!destination || d.kind === 'outfit';
    if (equippable || d.heal || d.buff || d.kind === 'potion') details.append(h('button', { class: 'primary', text: equippable ? 'Equip item' : 'Use item', disabled: equippable && locked, data:{focus:'item-action'}, on: { click: () => destination ? act.equip(selected, destination) : quick(selected, st) } }));
    const empty = profile.inv.slice(0, HOTBAR).findIndex(s => !s);
    const held = h('button', { data:{focus:'quickbar-action'}, text: empty >= 0 ? 'Place in quick-bar' : 'Swap with quick-bar slot 1', on: { click: () => act.move(selected, empty >= 0 ? empty : 0) } });
    if (selected >= HOTBAR) details.append(held);
  };

  const cellFor = (i: number): HTMLElement => {
    const st = profile.inv[i] ?? null;
    const slot = h('button', { class: `slot${i < HOTBAR ? ' hot' : ''}${selected === i ? ' selected' : ''}`, type: 'button', data: { i } });
    slot.setAttribute('aria-label', `${st ? `${ITEMS[st.id]?.name ?? st.id}, ${st.n}` : 'Empty slot'} · ${i < HOTBAR ? 'quick-bar' : 'pack'} slot ${i + 1}`);
    slot.addEventListener('click', () => { selected = i; root.querySelector('.slot.selected')?.classList.remove('selected'); slot.classList.add('selected'); showDetails(); });
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
    if (level() < equipmentLevel(st.id)) return;
    if (d?.kind === 'ring') act.equip(i, profile.equip.ring1 ? (profile.equip.ring2 ? 'ring1' : 'ring2') : 'ring1');
    else if (d?.kind === 'outfit') act.equip(i, 'outfit');
    else if (d?.kind === 'armor' && d.armor) act.equip(i, d.armor.slot);
    else if (d?.kind === 'weapon' && d.weapon) act.equip(i, 'weapon');
    else act.use(i);
  };

  const render = () => {
    const scroll = root.closest<HTMLElement>('.window');
    const top = scroll?.scrollTop ?? 0;
    const focused = document.activeElement as HTMLElement | null;
    const focusKey = focused && root.contains(focused) ? focused.dataset.focus : null;
    const timingOpen = root.querySelector<HTMLDetailsElement>('.weapon-guide details')?.open;
    const focusLabel = focused && root.contains(focused) ? focused.getAttribute('aria-label') : null;
    clear(grid); clear(quickGrid); clear(side);
    const indices = inventorySlots(profile.inv, search.value, category.value as InventoryCategory, sort.value as InventorySort);
    if (!indices.includes(selected)) selected = -1;
    for (const i of indices) (i < HOTBAR ? quickGrid : grid).append(cellFor(i));
    count.textContent = `${profile.inv.filter(Boolean).length} / ${INV_SIZE} slots · ${indices.filter(i => profile.inv[i]).length} shown`;
    if (!indices.length) grid.append(h('p', { class: 'small', text: 'No items match. Try another name or category.' }));
    showDetails();
    // equipment: a paper-doll with armour, the main-hand Focus and two rings
    const slotKind = (key: EquipSlotKey, id: string): boolean => {
      const d = ITEMS[id];
      if (!d) return false;
      if (key === 'ring1' || key === 'ring2') return d.kind === 'ring';
      if (key === 'weapon') return d.kind === 'weapon' && !!d.weapon;
      return d.kind === 'armor' && d.armor?.slot === key;
    };
    const eqSlot = (label: string, st: Stack | null, key: EquipSlotKey) => {
      const slot = h('button', { class: 'slot eq', type: 'button', title: label }, st ? iconCell(st) : h('span', { class: 'eqlabel', text: label }));
      slot.setAttribute('aria-label', `${label}: ${st ? `${ITEMS[st.id]?.name ?? st.id}, unequip` : 'empty'}`);
      if (st) { tip.attach(slot, () => tooltipFor(st)); slot.addEventListener('click', () => act.equip(0, `unequip_${key}`)); }
      slot.addEventListener('dragover', (e) => e.preventDefault());
      slot.addEventListener('drop', (e) => { e.preventDefault(); const f = Number(e.dataTransfer?.getData('text/plain')); if (Number.isInteger(f) && level() >= equipmentLevel(profile.inv[f]?.id ?? '') && slotKind(key, profile.inv[f]?.id ?? '')) act.equip(f, key); });
      return slot;
    };
    const E = profile.equip;
    side.append(h('div', { class: 'side-title', text: 'Equipment' }));
    side.append(h('div', { class: 'eq-row' }, portrait(),
      h('div', { class: 'eq-col' }, eqSlot('Head', E.head, 'head'), eqSlot('Body', E.chest, 'chest'), eqSlot('Legs', E.legs, 'legs'), eqSlot('Feet', E.feet, 'feet')),
      h('div', { class: 'eq-col' }, eqSlot('Weapon', E.weapon, 'weapon'), eqSlot('Ring', E.ring1, 'ring1'), eqSlot('Ring', E.ring2, 'ring2'))));
    const worn = armorTotals({ head: E.head?.id ?? null, chest: E.chest?.id ?? null, legs: E.legs?.id ?? null, feet: E.feet?.id ?? null });
    const setLines = Object.entries(worn.sets).map(([id, n]) => { const set = SET_BY_ID[id]!; return h('div', { class: 'small', text: `${set.name} ${n}/4${n >= 4 ? ' · full set' : n >= 2 ? ' · 2-piece bonus' : ''}` }); });
    const focus = E.weapon ? ITEMS[E.weapon.id]?.weapon : undefined;
    const st = profile.stats;
    side.append(h('div', { class: 'stats' },
      h('div', { text: `Max HP  +${st.hpBonus}` }), h('div', { text: `Attack  +${st.atkBonus}` }),
      h('div', { text: `Defence  ${Math.round(st.def * 100)}%` }), h('div', { text: `Phase  ${Math.round(st.phase * 100)}%` }),
      h('div', { text: `Luck    +${st.luck}` }), h('div', { text: `Haste   +${Math.round(st.haste * 100)}%` })));
    if (focus) side.append(h('div', { class: 'small dim', text: `${WEAPONS[focus].name}: ${WEAPONS[focus].quantum}` }));
    for (const l of setLines) side.append(l);
    
    // wardrobe
    const wardrobe = h('div', { class: 'ward' });
    profile.inv.forEach((s, i) => {
      if (s && ITEMS[s.id]?.kind === 'outfit') {
        const b = h('button', { class: `slot small${profile.equip.outfit === ITEMS[s.id]!.outfit ? ' on' : ''}`, type: 'button', title: ITEMS[s.id]!.name, on: { click: () => act.equip(i, 'outfit') } }, iconCell(s, { showCount: false }));
        b.setAttribute('aria-label', `Wear ${ITEMS[s.id]!.name}`);
        tip.attach(b, () => tooltipFor(s));
        wardrobe.append(b);
      }
    });
    side.append(h('div', { class: 'side-title', text: 'Wardrobe' }), wardrobe.childElementCount ? wardrobe : h('div', { class: 'small dim', text: 'Weave outfits at a loom.' }));
    // trash
    const trash = h('div', { class: 'trash', text: 'Drop here to discard' });
    trash.addEventListener('dragover', (e) => e.preventDefault());
    trash.addEventListener('drop', (e) => {
      e.preventDefault();
      const f = Number(e.dataTransfer?.getData('text/plain'));
      const stack = profile.inv[f];
      if (Number.isInteger(f) && stack && (ITEMS[stack.id]!.value * stack.n < 60 || confirm(`Discard ${stack.n} × ${ITEMS[stack.id]!.name}?`))) act.trash(f, stack.n);
    });
    side.append(trash);
    const timing = root.querySelector<HTMLDetailsElement>('.weapon-guide details');
    if (timing && timingOpen) timing.open = true;
    if (scroll) scroll.scrollTop = top;
    if (focusKey) root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focusKey)}"]`)?.focus({preventScroll:true});
    if (focusLabel) root.querySelector<HTMLElement>(`[aria-label="${CSS.escape(focusLabel)}"]`)?.focus({preventScroll:true});
  };
  render();
  const controls = h('div', { class: 'inv-controls' }, search, category, sort);
  search.addEventListener('input', render); category.addEventListener('change', render); sort.addEventListener('change', render);
  root.append(h('div', { class: 'inv-main' }, h('div', { class: 'inv-summary' }, h('div', { class: 'coins', text: `${profile.coins} coins` }), count), controls, h('div', { class: 'side-title', text: 'Quick-bar · 1–0' }), quickGrid, h('div', { class: 'side-title', text: 'Backpack' }), grid, h('div', { class: 'small dim', text: 'Select to inspect. Double-click / right-click to equip or use. Drag to rearrange.' })), side, details);
  const unsub = profile.onChange(() => { if (!root.isConnected) { unsub(); return; } render(); (root.querySelector('.coins') as HTMLElement).textContent = `${profile.coins} coins`; });
  return root;
}
