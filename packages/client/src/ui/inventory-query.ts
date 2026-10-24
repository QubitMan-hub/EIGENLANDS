import { HOTBAR, ITEMS, type Inventory } from '@eigenlands/shared';
export type InventoryCategory = 'all' | 'equipment' | 'supplies' | 'materials';
export type InventorySort = 'slot' | 'name' | 'value';
const categories = {
  equipment: new Set(['tool', 'weapon', 'armor', 'ring', 'outfit']),
  supplies: new Set(['food', 'potion', 'seed', 'fertilizer']),
  materials: new Set(['resource', 'material', 'crop', 'forage', 'fish', 'bug']),
};
/** View indices only: sorting must never rearrange the server's inventory or hotbar. */
export function inventorySlots(inv: Inventory, query: string, category: InventoryCategory, sort: InventorySort): number[] {
  const q = query.trim().toLocaleLowerCase();
  return inv.map((_, i) => i).filter(i => {
    const st = inv[i], d = st && ITEMS[st.id];
    return (!q || !!d && `${d.name} ${st?.id} ${st?.p?.qname ?? ''}`.toLocaleLowerCase().includes(q)) && (category === 'all' || !!d && (categories[category].has(d.kind) || category==='supplies' && !!d.tags?.includes('supplies')));
  }).sort((a, b) => {
    if (a < HOTBAR || b < HOTBAR || sort === 'slot') return a - b;
    const sa = inv[a], sb = inv[b];
    if (!sa || !sb) return Number(!sa) - Number(!sb) || a - b;
    const da = ITEMS[sa.id], db = ITEMS[sb.id];
    return (sort === 'name' ? (da?.name ?? sa.id).localeCompare(db?.name ?? sb.id) : (db?.value ?? 0) * sb.n - (da?.value ?? 0) * sa.n) || a - b;
  });
}
