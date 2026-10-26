import {
  COMBO,
  MELEE_COMBOS,
  meleeFamily,
  meleeHeavy,
  HOTBAR,
  ITEMS,
  MORPH_FORMS,
  WEAPONS,
  attackDamage,
  equipmentStats,
  cloneStack,
  equipmentLevel,
  heavyHit,
  moveSlot,
  quickbarAttack,
  weaponRecovery,
  weaponShotPower,
  type EquipSlotKey,
  type EquipState,
  type WeaponDef,
  type WeaponShot,
} from '@eigenlands/shared';
import type { Profile } from '../game/profile';

/** Preview the server's equipment swap, retaining progression and quick-bar bonuses. */
export function equipmentPreview(
  profile: Pick<Profile, 'equip' | 'inv' | 'stats'>,
  index: number,
  slot: EquipSlotKey,
): Profile['stats'] {
  const item = profile.inv[index],
    def = item && ITEMS[item.id];
  const valid =
    def &&
    (slot === 'weapon'
      ? !!def.weapon
      : slot === 'ring1' || slot === 'ring2'
        ? def.kind === 'ring'
        : def.armor
          ? def.armor.slot === slot
          : def.gear?.slot === slot);
  if (!valid || !item) return { ...profile.stats };
  const before = equipmentStats(profile.equip),
    after = equipmentStats({ ...profile.equip, [slot]: item });
  const next = { ...profile.stats };
  for (const key of [
    'hpBonus',
    'atkBonus',
    'luck',
    'haste',
    'phase',
    'warm',
    'cool',
    'drain',
    'craft',
    'stamina',
  ] as const)
    next[key] = (next[key] ?? 0) + after[key] - before[key];
  next.light = Math.max(next.light ?? 0, after.light);
  next.def = Math.min(0.6, profile.stats.def + after.def - before.def);
  return next;
}

export interface AttackGuide {
  name: string;
  damage: number[];
  healing: number[];
  reach: number[];
  recovery: number[];
  cooldown: number;
  count: number;
  radius: boolean;
  details: string[];
}
interface WeaponGuide {
  name: string;
  tap: AttackGuide[];
  heavy: AttackGuide;
}

/** Field-guide values before conditional combat effects; never aggregate volleys into promised DPS. */
function weaponGuide(w: WeaponDef, stats: Profile['stats']): WeaponGuide {
  const hits = MELEE_COMBOS[meleeFamily(w.id)];
  const melee = (form?: (typeof MORPH_FORMS)[number]): AttackGuide => ({
    name:
      form?.name ??
      ((w.fam ?? w.id) === 'spear'
        ? 'Thrust combo'
        : (w.fam ?? w.id) === 'battle_axe'
          ? 'Sweeping combo'
          : (w.fam ?? w.id) === 'warhammer'
            ? 'Crushing combo'
            : 'Three-hit combo'),
    damage: hits.map((h) => attackDamage(form ? Math.round(h.damage * form.dmg) : h.damage, stats.atkBonus)),
    healing: [],
    reach: hits.map((h) => h.range),
    recovery: hits.map((h) => h.recovery),
    cooldown: 0,
    count: 1,
    radius: false,
    details: form
      ? ['Each tap chooses one form at random; the two forms do not hit together.']
      : [
          (w.fam ?? w.id) === 'spear'
            ? 'Narrow thrusts: long reach, limited side coverage.'
            : (w.fam ?? w.id) === 'battle_axe'
              ? 'Broad sweeps trade reach and speed for side coverage.'
              : (w.fam ?? w.id) === 'warhammer'
                ? 'Slow blows; the finisher bypasses light-hit armour.'
                : 'Two slashes, then a lunging finisher.',
          `Tap poise: ${hits.map((h) => h.poise).join(' / ')}; arc: ${hits.map((h) => Math.round((Math.acos(h.arc) * 360) / Math.PI)).join(' / ')} degrees.`,
        ],
  });
  const shot = (s: WeaponShot, heavy: boolean): AttackGuide => {
    const power = (heavy ? [0, 1] : [null]).map((c) => weaponShotPower(c, stats.atkBonus));
    return {
      name: s.name,
      damage: power.map((p) => s.dmg * p),
      healing: s.heal ? power.map((p) => Math.round(s.heal! * p)) : [],
      reach: [s.kind === 'bolt' ? (s.range ?? 9) : (s.radius ?? (s.kind === 'heal_pulse' ? 5 : 3))],
      recovery: heavy ? [heavyHit(1).recovery] : COMBO.map((h) => h.recovery),
      cooldown: weaponRecovery(w, heavy, stats.haste),
      count: s.count ?? 1,
      radius: s.kind !== 'bolt',
      details: [
        ...(s.pierce ? [`Each bolt can pierce ${s.pierce} extra enemies.`] : []),
        ...(s.slow ? [`Slows by ${s.slow * 100}% for ${s.secs ?? 0}s before elemental effects.`] : []),
        ...(s.push ? [`Push ${s.push}.`] : []),
        ...(s.heal ? ['Heals you and nearby party members, up to missing health.'] : []),
      ],
    };
  };
  const low = meleeHeavy(w.id, 0),
    high = meleeHeavy(w.id, 1);
  return {
    name: w.name,
    tap: w.basic ? [shot(w.basic, false)] : w.id === 'morph_staff' ? MORPH_FORMS.map((f) => melee(f)) : [melee()],
    heavy: w.charged
      ? shot(w.charged, true)
      : {
          name:
            (w.fam ?? w.id) === 'spear'
              ? 'Driving thrust'
              : (w.fam ?? w.id) === 'battle_axe'
                ? 'Whirling cleave'
                : (w.fam ?? w.id) === 'warhammer'
                  ? 'Crushing blow'
                  : 'Phase cleave',
          damage: [attackDamage(low.damage, stats.atkBonus), attackDamage(high.damage, stats.atkBonus)],
          healing: [],
          reach: [low.range, high.range],
          recovery: [high.recovery],
          cooldown: 0,
          count: 1,
          radius: false,
          details: [
            `Ready–full charge: ${low.poise}–${high.poise} poise; ${Math.round((Math.acos(high.arc) * 360) / Math.PI)} degree arc.`,
          ],
        },
  };
}

/** Mirrors either a Focus equip or the existing quick-bar placement action without changing the pack. */
export function weaponComparison(
  profile: Pick<Profile, 'equip' | 'inv' | 'stats'>,
  index: number,
): { before: WeaponGuide; after: WeaponGuide; placement: number | null; requirement: number; note: string } | null {
  const item = profile.inv[index],
    d = item && ITEMS[item.id];
  if (!d || d.kind !== 'weapon') return null;
  const current = profile.equip.weapon && ITEMS[profile.equip.weapon.id]?.weapon;
  const w = current ? WEAPONS[current] : WEAPONS.sword;
  let next = w,
    stats = profile.stats,
    placement: number | null = null;
  let note = 'Equipping this weapon changes your attacks and passive bonuses.';
  if (d.weapon) {
    next = WEAPONS[d.weapon];
    stats = equipmentPreview(profile, index, 'weapon');
  } else if (item.id === 'sword') {
    if (index >= HOTBAR) {
      const empty = profile.inv.slice(0, HOTBAR).findIndex((s) => !s);
      placement = empty >= 0 ? empty : 0;
      const inv = profile.inv.map((s) => (s ? cloneStack(s) : null));
      moveSlot(inv, index, placement);
      stats = {
        ...profile.stats,
        atkBonus: profile.stats.atkBonus - quickbarAttack(profile.inv) + quickbarAttack(inv),
      };
    }
    note =
      'Only the strongest sword in your quick-bar adds attack bonus. An equipped main-hand weapon still controls your attacks; unequip it for ordinary sword combat.';
  }
  return {
    before: weaponGuide(w, profile.stats),
    after: weaponGuide(next, stats),
    placement,
    requirement: equipmentLevel(item.id),
    note,
  };
}
