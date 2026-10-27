import {
  PROP_WARM,
  CONDITION_RULES,
  DIFFICULTY_RULES,
  T,
  ambientWarmth,
  biomeAt,
  buildingAt,
  caveBiomeAt,
  isCaveY,
  isUpperY,
  sanctuaryAt,
  stepBodyTemp,
  stepTravelNeeds,
  thermalState,
  ITEMS,
  perishable,
  rotEvery,
  type Condition,
} from '@eigenlands/shared';
import { giveStacks } from './helpers';
import type { ServerPlayer } from '../rooms/player';
import type { RoomApi } from './api';

const WARM_OBJECTS = new Set([
  'campfire',
  'furnace',
  'forge',
  'hearth',
  'cooking_pot',
  'street_lamp',
  'oven',
  ...PROP_WARM,
]);

export function setTravelMode(p: ServerPlayer, msg: { mode?: unknown } | null): void {
  if (p.deadT > 0 || !msg || (msg.mode !== 'cozy' && msg.mode !== 'adventure' && msg.mode !== 'hardcore')) return;
  p.data.needs.mode = msg.mode;
  p.travelDamageT = 0;
  if (msg.mode === 'cozy') for (const c of Object.keys(CONDITION_RULES)) delete p.data.buffs[c];
  p.dirty('needs');
  p.dirty('buffs');
}

/** A fire, forge or warm lamp within a few tiles. */
function nearFire(room: RoomApi, x: number, y: number): boolean {
  const tx = Math.floor(x),
    ty = Math.floor(y);
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dy * dy > 10) continue;
      if (room.store.getTile(tx + dx, ty + dy) === T.TORCH) return true;
      const o = room.store.objectAt(tx + dx, ty + dy);
      if (o && WARM_OBJECTS.has(o.sub)) return true;
    }
  return false;
}
function cold(room: RoomApi, x: number, y: number): boolean {
  if (isCaveY(y)) return caveBiomeAt(room.seed, x, y) === 'frost';
  return biomeAt(room.seed, x, y) === 'taiga' || room.wclock.weather() === 'snow';
}
/** beside a pitched tent: out of the wind and the weather */
function nearTent(room: RoomApi, x: number, y: number): boolean {
  const tx = Math.floor(x),
    ty = Math.floor(y);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if (room.store.objectAt(tx + dx, ty + dy)?.sub === 'camp_tent') return true;
  return false;
}
function nearTile(room: RoomApi, x: number, y: number, tiles: number[]): boolean {
  const tx = Math.floor(x),
    ty = Math.floor(y);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if (tiles.includes(room.store.getTile(tx + dx, ty + dy))) return true;
  return false;
}

/** Apply an injury (refreshing its timer); true when newly inflicted. */
export function inflict(room: RoomApi, p: ServerPlayer, cond: Condition, scale = 1): boolean {
  const mode = p.data.needs.mode;
  if (mode === 'cozy' || p.deadT > 0) return false;
  const rule = CONDITION_RULES[cond],
    had = !!p.data.buffs[cond];
  p.data.buffs[cond] = { until: room.wclock.now() + rule.secs * 1000 * scale, power: DIFFICULTY_RULES[mode].bite };
  p.dirty('buffs');
  if (!had) p.toast(`${rule.label}! Cure: ${rule.cure}.`, 'bad');
  return !had;
}

/** Once per real online second; world-clock shifts and reconnects never simulate missed meals. */
export function tickTravelNeeds(room: RoomApi, p: ServerPlayer): void {
  const before = p.data.needs,
    x = p.sim.x,
    y = p.sim.y,
    paused = p.deadT > 0 || !!sanctuaryAt(room.seed, x, y);
  const next = stepTravelNeeds(before, 1, {
    paused,
    exerted: p.travelExerted,
    desert: biomeAt(room.seed, x, y) === 'desert',
    drain: p.stats.drain,
  });
  const rules = DIFFICULTY_RULES[next.mode];
  const now = room.wclock.now();
  const buff = (k: string) => {
    const b = p.data.buffs[k];
    return b && b.until > now ? b.power : 0;
  };
  // body temperature
  if (rules.thermal && !paused) {
    const cave = isCaveY(y);
    const ambient = ambientWarmth({
      biome: biomeAt(room.seed, x, y),
      cave: cave ? caveBiomeAt(room.seed, x, y) : null,
      hour: room.wclock.hour(),
      weather: room.wclock.weather(),
      season: room.wclock.season(),
      indoors: !!buildingAt(room.seed, Math.floor(x), Math.floor(y)) || isUpperY(y) || nearTent(room, x, y),
      fire: nearFire(room, x, y),
      coldResist: Math.min(0.92, buff('warmth') + p.stats.warm * 0.06),
      heatResist: Math.min(0.92, buff('coolness') + p.stats.cool * 0.06),
      exerted: p.travelExerted,
    });
    next.temp = stepBodyTemp(before.temp, ambient, 1);
  } else if (!rules.thermal) next.temp = 0;
  p.travelExerted = false;
  p.data.needs = next;
  const state = thermalState(next.temp);
  if (
    Math.floor(before.food) !== Math.floor(next.food) ||
    Math.floor(before.water) !== Math.floor(next.water) ||
    Math.round(before.temp) !== Math.round(next.temp)
  )
    p.dirty('needs');
  if ((before.food > 20 && next.food <= 20) || (before.water > 20 && next.water <= 20))
    p.toast('Travel supplies are low. Eat food or drink a filled waterskin; see Journal → How to…', 'info');
  if (rules.thermal && !paused) {
    const was = thermalState(before.temp);
    if (state !== was && (state === 'cold' || state === 'hot'))
      p.toast(
        state === 'cold'
          ? 'You are getting cold. Find a fire or shelter, or drink a warming tonic.'
          : 'You are overheating. Find shade or water, or drink a cooling tonic.',
        'info',
      );
    // extreme exposure bites; freezing long enough becomes frostbite, scorching sets cloth alight at noon sands
    if ((state === 'freezing' || state === 'scorching') && ++p.exposureT >= 6) {
      p.exposureT = 0;
      if (p.hp > 1) p.hp = Math.max(1, p.hp - Math.round(rules.bite));
      if (state === 'freezing') inflict(room, p, 'frostbite');
    } else if (state !== 'freezing' && state !== 'scorching') p.exposureT = 0;
  }
  // injuries tick as ordinary buffs; the timer is the duration
  if (!paused && rules.injury > 0) {
    if (nearTile(room, x, y, [T.LAVA])) inflict(room, p, 'burn');
    if (p.data.buffs.burn && nearTile(room, x, y, [T.WATER, T.DEEP_WATER])) {
      delete p.data.buffs.burn;
      p.dirty('buffs');
      p.toast('The water puts the fire out.', 'good');
    }
    if (p.data.buffs.frostbite && state === 'ok' && nearFire(room, x, y)) {
      delete p.data.buffs.frostbite;
      p.dirty('buffs');
      p.toast('The fire thaws the frostbite.', 'good');
    }
    for (const [cond, rule] of Object.entries(CONDITION_RULES)) {
      const b = p.data.buffs[cond];
      if (!b || b.until <= now) {
        p.condT[cond] = 0;
        continue;
      }
      if (!rule.dmg) continue;
      p.condT[cond] = (p.condT[cond] ?? 0) + 1;
      if (p.condT[cond]! >= rule.every) {
        p.condT[cond] = 0;
        if (p.hp > 1) p.hp = Math.max(1, p.hp - Math.max(1, Math.round(rule.dmg * b.power)));
      }
    }
  }
  // raw fish and meat carried in the pack spoil (chests keep them; cold slows it)
  if (!paused && next.mode !== 'cozy' && ++p.rotT >= rotEvery(cold(room, x, y))) {
    p.rotT = 0;
    let rotted = 0;
    for (let i = 0; i < p.data.inv.length; i++) {
      const st = p.data.inv[i];
      const def = st && ITEMS[st.id];
      if (!st || !def || !perishable(st.id, def.kind)) continue;
      st.n -= 1;
      if (st.n <= 0) p.data.inv[i] = null;
      rotted++;
    }
    if (rotted) {
      giveStacks(p, [{ id: 'spoiled_food', n: rotted }]);
      p.dirty('inv');
      p.toast('Some of the raw food in your pack has spoiled. Cook it, or keep it in a chest.', 'info');
    }
  }
  if (!paused && next.mode !== 'cozy' && (next.food === 0 || next.water === 0)) {
    if (++p.travelDamageT >= 10) {
      p.travelDamageT = 0;
      if (p.hp > 1) p.hp = Math.max(1, p.hp - 1);
    }
  } else p.travelDamageT = 0;
}
