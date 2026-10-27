/** Ancient encounters extend the normal boss authority, terrain and strike queues. */
import {
  ancientRite,
  biomeAt,
  caveRegionAt,
  isCaveY,
  isDiveY,
  isUpperY,
  SpellState,
  SPELL,
  T,
  type BossDef,
} from '@eigenlands/shared';
import type { Enemy } from '../../game/enemies';
import type { GameRoom } from '../../rooms/GameRoom';
import type { ServerPlayer } from '../../rooms/player';
export interface AncientRun {
  def: BossDef;
  e: Enemy;
  phase: number;
  rage: boolean;
  later: Array<{ at: number; fn: () => void }>;
  arena?: SpellState;
  sentries?: Set<string>;
  contributors?: Set<string>;
}
export function ancientGround(room: GameRoom, p: ServerPlayer, def: BossDef, x: number, y: number): boolean {
  const r = ancientRite(def.id);
  if (!r) return true;
  const badLayer = isUpperY(y) || isDiveY(y) || (r.where !== 'cave' && isCaveY(y));
  const habitatOK =
    r.where === 'sea'
      ? p.sim.boat && room.store.getTile(Math.floor(x), Math.floor(y)) === T.DEEP_WATER
      : r.where === 'cave'
        ? isCaveY(y) && caveRegionAt(room.seed, x, y, room.store.generation).feature === 'arena'
        : biomeAt(room.seed, x, y) === r.where;
  if (badLayer || !habitatOK) {
    p.toast(
      `This rite needs ${r.where === 'sea' ? 'deep open water and a boat' : r.where === 'cave' ? 'a surveyed Undercroft arena' : `open ${r.where} wilderness`}.`,
      'bad',
    );
    return false;
  }
  const solid = r.where === 'sea' ? (room.store.solidAt.sea ?? room.store.solidAt) : room.store.solidAt;
  let open = 0;
  for (let dy = -6; dy <= 6; dy += 2)
    for (let dx = -6; dx <= 6; dx += 2) if (!solid(Math.floor(x + dx), Math.floor(y + dy))) open++;
  if (open < 40) {
    p.toast('The ancient rite needs a broad clearing, not a cramped passage.', 'bad');
    return false;
  }
  return true;
}
export function raiseSentries(room: GameRoom, r: AncientRun): void {
  r.sentries ??= new Set();
  for (const id of r.sentries) {
    room.enemies.delete(id);
    room.state.enemies.delete(id);
  }
  r.sentries.clear();
  for (const [dx, dy] of [
    [-4, -4],
    [4, -4],
    [-4, 4],
    [4, 4],
  ]) {
    const x = r.e.x + dx!,
      y = r.e.y + dy!;
    if (room.store.solidAt(Math.floor(x), Math.floor(y))) continue;
    const e = room.spawnEnemy('vault_guardian', x, y, false, { level: Math.max(1, r.e.level - 8) });
    e.noRewards = true;
    r.sentries.add(e.id);
  }
}
export function openAncientArena(room: GameRoom, r: AncientRun): void {
  const rite = ancientRite(r.def.id);
  if (!rite) return;
  r.contributors = new Set();
  const a = new SpellState();
  a.id = `arena:${r.e.id}`;
  a.kind = SPELL.ARENA;
  a.x = r.e.x;
  a.y = r.e.y;
  a.owner = r.e.id;
  a.r = 9;
  a.hue = ['primordial_dragon', 'world_serpent', 'sealed_entity', 'forgotten_titan', 'realm_guardian'].indexOf(rite.id);
  r.arena = a;
  room.state.spells.set(a.id, a);
  if (rite.id === 'sealed_entity') raiseSentries(room, r);
}
export function closeAncientArena(room: GameRoom, r: AncientRun | undefined): void {
  if (r?.arena) room.state.spells.delete(r.arena.id);
  for (const id of r?.sentries ?? []) {
    room.enemies.delete(id);
    room.state.enemies.delete(id);
  }
}
export function ancientPhase(room: GameRoom, r: AncientRun): string | undefined {
  const id = r.def.id;
  if (!ancientRite(id)) return;
  r.rage = r.phase >= 2;
  r.e.windMult = Math.max(0.75, 1 - r.phase * 0.07);
  if (r.arena) r.arena.dx = r.phase;
  if (id === 'sealed_entity') {
    raiseSentries(room, r);
    return 'Four sentries renew the seal. Break them before striking the King.';
  }
  if (id === 'primordial_dragon')
    return r.phase === 1
      ? 'The wings spread: flame will sweep in crossing lanes.'
      : r.phase === 2
        ? 'The first crown cracks. Break its poise to interrupt the breath.'
        : 'The last ember burns white. Leave the marked centre.';
  if (id === 'world_serpent')
    return r.phase === 1
      ? 'The tide draws inward. Leave a route between the marked rings.'
      : 'Orrun coils around the crossing. Watch the delayed outer waves.';
  if (id === 'forgotten_titan')
    return r.phase === 1
      ? 'The forge opens. Cross the moving fracture line.'
      : 'The hammer remembers its final war. Ground marks show each delayed impact.';
  return r.phase === 1
    ? 'The gates turn. Break its poise to interrupt the convergence.'
    : 'Six crowns, one guardian: the safe sectors change before each pulse.';
}
export function ancientSpecial(room: GameRoom, r: AncientRun, target: ServerPlayer, t: number): boolean {
  const e = r.e,
    id = r.def.id;
  if (!ancientRite(id)) return false;
  if (r.sentries && [...r.sentries].some((id) => room.enemies.has(id))) return true;
  const origin = { x: e.x, y: e.y },
    dx = target.sim.x - e.x,
    dy = target.sim.y - e.y,
    d = Math.hypot(dx, dy) || 1,
    ux = dx / d,
    uy = dy / d;
  const points: Array<{ x: number; y: number; delay: number; radius: number }> = [];
  if (id === 'primordial_dragon') {
    for (let i = 1; i <= 5; i++)
      points.push({ x: origin.x + ux * i * 2.2, y: origin.y + uy * i * 2.2, delay: 1.7 + i * 0.12, radius: 1.6 });
    if (r.phase >= 1)
      for (const side of [-1, 1])
        for (let i = 1; i <= 3; i++)
          points.push({
            x: origin.x + ux * i * 2 - uy * side * 3,
            y: origin.y + uy * i * 2 + ux * side * 3,
            delay: 2 + i * 0.15,
            radius: 1.4,
          });
  } else if (id === 'world_serpent') {
    const radius = r.phase % 2 ? 6 : 3.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      points.push({
        x: target.sim.x + Math.cos(a) * radius,
        y: target.sim.y + Math.sin(a) * radius,
        delay: 1.8 + (i % 2) * 0.45,
        radius: 1.5,
      });
    }
  } else if (id === 'sealed_entity') {
    for (const [x, y] of [
      [-5, 0],
      [5, 0],
      [0, -5],
      [0, 5],
    ])
      points.push({ x: target.sim.x + x!, y: target.sim.y + y!, delay: 1.9, radius: 2 });
  } else if (id === 'forgotten_titan') {
    for (let i = -3; i <= 3; i++)
      points.push({
        x: target.sim.x - uy * i * 2.2,
        y: target.sim.y + ux * i * 2.2,
        delay: 1.7 + Math.abs(i) * 0.22,
        radius: 1.6,
      });
  } else {
    for (let i = 0; i < 6; i++) {
      const a = ((i + r.phase * 0.5) / 6) * Math.PI * 2;
      points.push({
        x: origin.x + Math.cos(a) * 6,
        y: origin.y + Math.sin(a) * 6,
        delay: 1.8 + (i % 2) * 0.55,
        radius: 1.8,
      });
    }
    if (r.phase >= 2) points.push({ x: target.sim.x, y: target.sim.y, delay: 2.6, radius: 2 });
  }
  e.mode = 'recover';
  e.t = 2.5;
  e.cd = 2.5;
  for (const [i, p] of points.entries()) {
    room.fx({ kind: 'bomb', x: p.x, y: p.y, v: p.delay, w: p.radius, id: `${e.id}:ancient:${i}` });
    r.later.push({
      at: t + p.delay,
      fn: () => {
        if (!room.enemies.has(e.id) || e.mode === 'stagger') return;
        room.enemyStrike(e, p.x, p.y, p.radius, 1.15);
        room.fx({ kind: 'blast', x: p.x, y: p.y, v: p.radius });
      },
    });
  }
  return true;
}
