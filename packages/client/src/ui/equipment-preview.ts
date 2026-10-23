import { ITEMS, WEAPONS, armorTotals, type EquipSlotKey, type EquipState } from '@eigenlands/shared';
import type { Profile } from '../game/profile';

/** Preview the server's equipment swap, retaining progression and quick-bar bonuses. */
export function equipmentPreview(profile: Pick<Profile, 'equip' | 'inv' | 'stats'>, index: number, slot: EquipSlotKey): Profile['stats'] {
  const item = profile.inv[index], def = item && ITEMS[item.id];
  const valid = def && (slot === 'weapon' ? !!def.weapon : slot === 'ring1' || slot === 'ring2' ? def.kind === 'ring' : def.armor?.slot === slot);
  if (!valid || !item) return { ...profile.stats };
  const bonuses = (e: EquipState): Profile['stats'] => {
    const a = armorTotals({ head: e.head?.id ?? null, chest: e.chest?.id ?? null, legs: e.legs?.id ?? null, feet: e.feet?.id ?? null }).bonus;
    const s = { hpBonus: a.hp, atkBonus: a.atk, luck: a.luck, haste: a.haste, def: a.def, phase: a.phase };
    for (const r of [e.ring1, e.ring2]) {
      if (!r?.p?.stat || !Number.isFinite(r.p.val)) continue;
      const key = r.p.stat === 'hp' ? 'hpBonus' : r.p.stat === 'atk' ? 'atkBonus' : r.p.stat;
      s[key] += r.p.val!;
    }
    const w = e.weapon && ITEMS[e.weapon.id]?.weapon;
    if (w) {
      const b = WEAPONS[w].bonus;
      s.hpBonus += b.hp ?? 0; s.atkBonus += b.atk ?? 0;
      s.luck += b.luck ?? 0; s.haste += b.haste ?? 0; s.def += b.def ?? 0;
    }
    return s;
  };
  const before = bonuses(profile.equip), after = bonuses({ ...profile.equip, [slot]: item });
  const next = { ...profile.stats };
  for (const key of ['hpBonus', 'atkBonus', 'luck', 'haste', 'phase'] as const) next[key] += after[key] - before[key];
  next.def = Math.min(.6, after.def);
  return next;
}
