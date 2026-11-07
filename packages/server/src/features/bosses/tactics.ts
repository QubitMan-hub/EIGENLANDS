import type { BossId } from '@eigenlands/shared';
export interface Impact {
  x: number;
  y: number;
  delay: number;
  radius: number;
}
export interface Tactic {
  name: string;
  hint: string;
  impacts: Impact[];
  recovery: number;
}
type Point = { x: number; y: number };
/** Fixed, readable attack geometry. Plans never follow a player after their warning is drawn. */
export function bossTactic(id: BossId, phase: number, sequence: number, origin: Point, target: Point): Tactic {
  const points: Impact[] = [],
    a = Math.atan2(target.y - origin.y, target.x - origin.x),
    turn = (sequence + phase) % 4;
  const at = (p: Point, dx: number, dy: number, delay = 1.5, radius = 1.3) =>
    points.push({ x: p.x + dx, y: p.y + dy, delay, radius });
  const polar = (p: Point, angle: number, r: number, delay = 1.5, radius = 1.3) =>
    at(p, Math.cos(angle) * r, Math.sin(angle) * r, delay, radius);
  const ring = (p: Point, r: number, count: number, gap: number, delay: number) => {
    for (let i = 0; i < count; i++) if (i !== gap) polar(p, a + (i * Math.PI * 2) / count, r, delay, 1.25);
  };
  let name = '',
    hint = '';
  switch (id) {
    case 'slime_king':
      name = 'Crown splash';
      hint = 'Bait the first splash, then leave the side pools.';
      at(target, 0, 0, 1.4, 2.1);
      for (const side of [-1, 1]) polar(target, a + (side * Math.PI) / 2, 3, 2, 1.4);
      break;
    case 'warden':
      name = 'Rootbreak';
      hint = 'Roots split the lane. Cross it sideways before they erupt.';
      for (let i = 1; i <= 5; i++) polar(origin, a, i * 2, 1.5 + i * 0.1, 1.2);
      if (phase) for (const side of [-1, 1]) polar(target, a + (side * Math.PI) / 2, 3.2, 2.4, 1.3);
      break;
    case 'colossus':
      name = 'Fractured crossing';
      hint = 'The centre fractures first; the crossing follows. Find a diagonal opening.';
      at(target, 0, 0, 1.4, 1.5);
      for (let i = 0; i < 4; i++) polar(target, (turn * Math.PI) / 4 + (i * Math.PI) / 2, 3.6, 2.15, 1.35);
      break;
    case 'bellkeeper':
      name = 'The quiet bell';
      hint = 'One bell stays silent. Leave the centre through the gap.';
      ring(target, 4, 8, turn * 2, 1.55);
      at(target, 0, 0, 2.3, 2.1);
      break;
    case 'veyr':
      name = 'Conductor’s fork';
      hint = 'Thunder forks across the marked lane. Step between the prongs.';
      for (let i = 1; i <= 4; i++)
        for (const side of [-1, 1])
          at(
            origin,
            Math.cos(a) * i * 2 - Math.sin(a) * side * 2.2,
            Math.sin(a) * i * 2 + Math.cos(a) * side * 2.2,
            1.5 + i * 0.1,
            1.15,
          );
      if (phase > 1) at(target, 0, 0, 2.6, 1.4);
      break;
    case 'geode_tyrant':
      name = 'Prismatic cage';
      hint = 'A facet is missing. Cross the opening before the inner crystal bursts.';
      ring(target, 4.2, 8, turn * 2, 1.6);
      at(target, 0, 0, 2.45, 2);
      break;
    case 'cinder_wyrm':
      name = 'Ashen jaws';
      hint = 'The outer jaws flare first; the centre burns last.';
      for (let i = 1; i <= 4; i++)
        for (const side of [-1, 1])
          at(
            origin,
            Math.cos(a) * i * 2 - Math.sin(a) * side * 2.7,
            Math.sin(a) * i * 2 + Math.cos(a) * side * 2.7,
            1.45 + i * 0.1,
            1.2,
          );
      at(target, 0, 0, 2.5, 1.6);
      break;
    case 'rime_sovereign':
      name = 'Winter’s compass';
      hint = 'Frost closes the cardinal lanes. Keep a diagonal route open.';
      at(target, 0, 0, 1.4, 1.4);
      for (let i = 0; i < 4; i++)
        for (let r = 2.8; r <= 5.6; r += 2.8)
          polar(target, a + (turn * Math.PI) / 4 + (i * Math.PI) / 2, r, 2 + r * 0.06, 1.15);
      break;
    case 'tide_leviathan':
      name = 'Undertow wake';
      hint = 'The marked wake rolls outward. Steer across it, not along it.';
      for (let i = 0; i < 5; i++) polar(target, a, (i - 2) * 2.3, 1.4 + i * 0.24, 1.4);
      break;
    case 'primordial_dragon':
      name = 'The first crown';
      hint = 'Flame closes the outer crown. Take its broken arc before the heart ignites.';
      ring(origin, 5.8, 10, (sequence + phase) % 10, 1.65);
      at(origin, 0, 0, 2.65, 3);
      break;
    case 'world_serpent':
      name = 'The remembering wake';
      hint = 'The tide remembers where you were. Leave the centre, then follow the opening.';
      at(target, 0, 0, 1.5, 2);
      ring(target, 4.5, 8, turn * 2, 2.2);
      break;
    case 'sealed_entity':
      name = 'Unwritten sentence';
      hint = 'The seal erases a crossing. Slip between its four strokes.';
      for (let i = 0; i < 4; i++)
        for (let r = 2.7; r <= 5.4; r += 2.7)
          polar(target, (turn * Math.PI) / 4 + (i * Math.PI) / 2, r, 1.6 + i * 0.15, 1.2);
      if (phase > 1) at(target, 0, 0, 2.7, 1.5);
      break;
    case 'forgotten_titan':
      name = 'The last hammer';
      hint = 'The hammer marks three blows. Bait the first and move across the fracture.';
      for (let i = 0; i < 3; i++) polar(target, a + Math.PI / 2, (i - 1) * 3.3, 1.5 + i * 0.4, 1.8);
      break;
    case 'realm_guardian':
      name = 'Six gates converge';
      hint = 'A gate is open. Follow it outward before the centre closes.';
      ring(origin, 5.8, 8, turn * 2, 1.6);
      at(target, 0, 0, 2.4, 1.6);
      break;
  }
  return { name, hint, impacts: points, recovery: phase > 1 ? 1.35 : 1.7 };
}
