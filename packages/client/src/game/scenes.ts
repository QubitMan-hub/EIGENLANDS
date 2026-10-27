import { hash2, type Town } from '@eigenlands/shared';

/**
 * Everyday scenes for a settlement: the small, ordinary things people do that make a street feel lived in. Drawing
 * water at the well, hanging out the washing, chopping firewood, sweeping the step, neighbours gossiping at a door,
 * children playing tag, old folk on a bench feeding the pigeons, porters hauling sacks, a busker on the square, a cat
 * on a doorstep and a dog that chases it, someone watering the window boxes and the lamplighter at dusk.
 *
 * This module only plans where and when: a pure function of the town and the seed (tested), so every player sees the
 * same washerwoman at the same line. WorldLife (life.ts) animates the plan.
 */
export type SceneKind =
  | 'well'
  | 'laundry'
  | 'woodchop'
  | 'sweep'
  | 'chat'
  | 'kids'
  | 'bench'
  | 'porter'
  | 'busker'
  | 'cat'
  | 'dog'
  | 'garden'
  | 'lamplighter'
  | 'dressing';

export interface Scene {
  kind: SceneKind;
  /** the tile the scene happens at (feet of the main actor) */
  x: number;
  y: number;
  /** a second point: where water is carried to, the far end of a washing line, the other door of a porter's round */
  x2: number;
  y2: number;
  /** hours the scene plays */
  hours: [number, number];
  /** stable per-scene seed (looks, timing, lines) */
  seed: number;
  /** a lamplighter's round */
  route?: Array<[number, number]>;
  /** doorstep dressing: which town prop stands by the door (planter, barrel, basket, woodpile, crate, plant, hay) */
  set?: number;
}

/** The hours each scene plays. Wells are busiest morning and evening; children are called in for supper. */
export const SCENE_HOURS: Record<SceneKind, [number, number]> = {
  well: [6, 19.5],
  laundry: [8, 16.5],
  woodchop: [7, 17],
  sweep: [6.5, 9.5],
  chat: [9, 19],
  kids: [9, 18],
  bench: [8.5, 18],
  porter: [7, 17],
  busker: [10, 21],
  cat: [0, 24],
  dog: [6, 21],
  garden: [7, 10.5],
  lamplighter: [17.6, 19.4],
  dressing: [0, 24],
};
/** how many doorstep sets scene-life.ts can draw */
export const DRESSING_SETS = 7;

/** Weather a scene does not happen in: nobody hangs washing in the rain, children go in, buskers pack up. */
export function sceneSheltered(kind: SceneKind, weather: string): boolean {
  const wet = weather === 'rain' || weather === 'storm';
  if (kind === 'dressing') return false;
  if (weather === 'storm') return kind !== 'cat' && kind !== 'lamplighter';
  if (wet) return kind === 'laundry' || kind === 'kids' || kind === 'bench' || kind === 'busker' || kind === 'garden';
  if (weather === 'snow') return kind === 'laundry' || kind === 'garden';
  return false;
}

/** What people say while they are at it: plain, everyday talk. */
export const SCENE_TALK: Record<string, string[]> = {
  well: ['Heavy bucket today.', 'Coldest water in the kingdom.', 'Morning!', 'Mind the rope.'],
  laundry: ['Lovely drying weather.', 'These sheets will smell of sunshine.', 'Who muddied these trousers?'],
  woodchop: ['Winter comes whether you are ready or not.', 'One more cord and I am done.', 'Stand back!'],
  sweep: ['Mud everywhere, again.', 'Morning to you.', 'Wipe your boots, please!'],
  chatA: [
    'Did you hear the baker raised his prices?',
    'My youngest has the sniffles again.',
    'They say the miller is courting.',
    'Is your roof still leaking?',
    'The harvest looks good this year.',
    'Have you seen the new cart at the smithy?',
  ],
  chatB: [
    'You don’t say!',
    'Well, I never.',
    'Poor thing. Honey and lemon.',
    'About time, too.',
    'Mine needs patching before the rains.',
    'Fancy that.',
  ],
  kids: ['Tag, you’re it!', 'Can’t catch me!', 'No fair!', 'One more game!', 'My turn!'],
  supper: ['Supper! Come inside!', 'Wash your hands first!'],
  bench: ['In my day, the winters were real winters.', 'Here, little birds.', 'Sit a while, traveller.'],
  porter: ['Coming through!', 'Mind your backs!', 'Flour for the baker.', 'Heavy one, this.'],
  busker: ['A song for a copper!', 'This one’s about a lost sheep.', 'Thank you, kind soul!'],
  garden: ['Thirsty little things.', 'The geraniums are coming on nicely.'],
  lamplighter: ['Lamps are lit!', 'Evening, all.'],
};

interface PlanOpts {
  /** true when a person can stand on the tile */
  free: (x: number, y: number) => boolean;
  /** settlement size: village 1, town 1.4, capital 2 */
  size: number;
}

const DOORISH = new Set(['house', 'store', 'inn', 'farmhouse', 'smithy']);

/** Plan the everyday scenes of a settlement. Deterministic for (town, seed). */
export function planScenes(t: Town, seed: number, o: PlanOpts): Scene[] {
  const out: Scene[] = [];
  const taken = new Set<number>();
  const key = (x: number, y: number) => (x + 4096) * 8192 + (y + 4096);
  // furniture inside a hall or church is not a street: scenes only happen out of doors
  const indoors = (x: number, y: number) =>
    t.buildings.some((b) => x >= b.x - 1 && x <= b.x + b.w && y >= b.y - 1 && y <= b.y + b.h);
  const outside = (x: number, y: number) => o.free(x, y) && o.free(x, y + 1) && !indoors(x, y);
  const hs = (a: number, b: number, k: number) => hash2(seed ^ 0x51ce, a, b, k + t.cx * 7 + t.cy);
  // a free standing tile near (x, y), not already used by another scene
  const near = (x: number, y: number, r = 2): [number, number] | null => {
    for (let d = 0; d <= r; d++)
      for (let dy = -d; dy <= d; dy++)
        for (let dx = -d; dx <= d; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
          const px = Math.floor(x) + dx,
            py = Math.floor(y) + dy;
          if (!taken.has(key(px, py)) && outside(px, py)) return [px, py];
        }
    return null;
  };
  const add = (kind: SceneKind, p: [number, number], p2: [number, number] | null, n: number) => {
    taken.add(key(p[0], p[1]));
    if (p2) taken.add(key(p2[0], p2[1]));
    out.push({
      kind,
      x: p[0] + 0.5,
      y: p[1] + 0.5,
      x2: (p2 ?? p)[0] + 0.5,
      y2: (p2 ?? p)[1] + 0.5,
      hours: SCENE_HOURS[kind],
      seed: Math.floor(hs(p[0], p[1], n) * 2 ** 30),
    });
  };

  const doors = t.buildings
    .filter((b) => DOORISH.has(b.kind))
    .map((b) => ({ b, x: b.doorX, y: b.doorY + 1 }))
    .sort((a, b) => hs(a.x, a.y, 1) - hs(b.x, b.y, 1));
  const objs = (sub: string) => t.objects.filter((ob) => ob.kind === 'deco' && ob.sub === sub && !indoors(ob.x, ob.y));

  // the well: someone always comes for water and carries it home to a nearby door
  for (const w of objs('well')) {
    const p = near(w.x, w.y + 1, 2);
    if (!p) continue;
    const home = doors.slice().sort((a, b) => Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(b.x - w.x, b.y - w.y))[0];
    add('well', p, home ? near(home.x, home.y, 2) : null, 1);
  }
  // existing washing lines and woodpiles get their people
  for (const l of objs('laundry')) {
    const p = near(l.x, l.y + 1, 2);
    if (p) add('laundry', p, [p[0] + 1, p[1]], 2);
  }
  for (const w of objs('woodpile')) {
    const p = near(w.x + 1, w.y + 1, 2);
    if (p) add('woodchop', p, null, 3);
  }
  // benches: an old couple or a single elder
  for (const b of objs('bench').slice(0, Math.ceil(2 * o.size))) {
    const p = near(b.x, b.y, 1);
    if (p) add('bench', p, null, 4);
  }

  // the houses: a round of chores and neighbourly talk, one scene per door until the budget runs out
  const budget = Math.round(7 * o.size);
  const chores: SceneKind[] = ['sweep', 'chat', 'laundry', 'woodchop', 'garden', 'cat', 'chat', 'dog', 'sweep', 'cat'];
  let c = 0;
  for (const d of doors) {
    if (out.length >= budget + 4) break;
    const kind = chores[(c + Math.floor(hs(d.x, d.y, 5) * 3)) % chores.length]!;
    c++;
    if (kind === 'laundry' || kind === 'woodchop') {
      // the side yard: a step along the wall from the door
      const side = hs(d.x, d.y, 6) < 0.5 ? -1 : 1;
      const p = near(d.x + side * 3, d.y + 1, 2);
      if (!p) continue;
      add(kind, p, kind === 'laundry' ? [p[0] + side, p[1]] : null, 6);
      continue;
    }
    if (kind === 'chat') {
      const p = near(d.x, d.y + 1, 1);
      if (!p) continue;
      const q = near(p[0] + 1, p[1], 1);
      if (!q) continue;
      add('chat', p, q, 7);
      continue;
    }
    const p = near(d.x + (kind === 'cat' ? 1 : 0), d.y, 1);
    if (p) add(kind, p, null, 8);
  }

  // every door is dressed: pots, a barrel, sacks or a stack of firewood against the wall either side of it
  for (const d of doors) {
    for (const side of [-1, 1]) {
      const x = d.x + side * (1 + Math.floor(hs(d.x, d.y, 20 + side) * 2)),
        y = d.y;
      if (!o.free(x, y) || taken.has(key(x, y)) || hs(x, y, 21) < 0.25) continue;
      taken.add(key(x, y));
      out.push({
        kind: 'dressing',
        x: x + 0.5,
        y: y + 0.5,
        x2: x + 0.5,
        y2: y + 0.5,
        hours: SCENE_HOURS.dressing,
        seed: Math.floor(hs(x, y, 22) * 2 ** 30),
        set: Math.floor(hs(x, y, 23) * DRESSING_SETS),
      });
    }
  }

  // the square: children at play, a busker, a porter's round between the market and a shop
  const plaza = Object.entries(t.spots).find(([k]) => k.endsWith('.plaza'))?.[1] ?? { x: t.cx, y: t.cy };
  for (let i = 0; i < Math.ceil(o.size); i++) {
    const p = near(plaza.x + (i ? -6 : 6), plaza.y + 4, 3);
    if (p) add('kids', p, null, 10 + i);
  }
  const bp = near(plaza.x - 3, plaza.y - 3, 3);
  if (bp && o.size > 1) add('busker', bp, null, 12);
  const store = doors.find((d) => d.b.kind === 'store' || d.b.kind === 'inn');
  const cart = objs('cart')[0] ?? objs('crate')[0] ?? objs('barrel')[0];
  const from = cart ? near(cart.x + 1, cart.y + 1, 2) : near(plaza.x + 2, plaza.y + 2, 3);
  const to = store ? near(store.x, store.y + 1, 2) : null;
  if (from && to) add('porter', from, to, 13);

  // at dusk the lamplighter walks the round of the street lamps
  const lamps = objs('street_lamp');
  if (lamps.length >= 2) {
    const route: Array<[number, number]> = [];
    for (const l of lamps.slice(0, 8)) {
      const p = near(l.x, l.y + 1, 1);
      if (p) route.push([p[0] + 0.5, p[1] + 0.5]);
    }
    if (route.length >= 2) {
      const [x, y] = route[0]!;
      const [x2, y2] = route[route.length - 1]!;
      out.push({
        kind: 'lamplighter',
        x,
        y,
        x2,
        y2,
        hours: SCENE_HOURS.lamplighter,
        seed: Math.floor(hs(x, y, 14) * 2 ** 30),
        route,
      });
    }
  }
  return out;
}
