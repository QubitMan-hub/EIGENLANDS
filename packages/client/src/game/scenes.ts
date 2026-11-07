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
  | 'dressing'
  // the night watch walks the lamps with a lantern; a stable hand grooms a horse at the inn; hens fed at a farm
  | 'watchman'
  | 'stablehand'
  | 'hens'
  // the town's notice board on the square (read it by standing at it)
  | 'board';

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
  // after the lamps are lit until first light (an end past 24 wraps into the next morning)
  watchman: [20, 29.5],
  stablehand: [7.5, 18.5],
  hens: [6.5, 9.5],
  board: [0, 24],
};

/** Weather a scene does not happen in: nobody hangs washing in the rain, children go in, buskers pack up. */
export function sceneSheltered(kind: SceneKind, weather: string): boolean {
  const wet = weather === 'rain' || weather === 'storm';
  if (kind === 'dressing' || kind === 'board') return false;
  if (weather === 'storm') return kind !== 'cat' && kind !== 'lamplighter' && kind !== 'watchman';
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
  watchman: ['Midnight, and all is well!', 'Who goes there?', 'Mind how you go, it is late.', 'Two of the clock!'],
  stablehand: ['Easy, girl, easy.', 'Fed and watered, sir.', 'She’s a fine mare, this one.'],
  hens: ['Chook chook chook!', 'Come on, girls!', 'Three eggs today.'],
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

  // Doorsteps first, and in order: a matching pair either side of the door, hugging the wall, chosen by what the
  // building is (planters at a home, barrels at the inn, a crate and a basket at a shop, a woodpile and a quenching
  // barrel at the smithy, hay and firewood at a farmhouse). Indices are into DRESSING in scene-life.ts.
  const PAIRS: Record<string, Array<[number, number]>> = {
    house: [
      [0, 0], // planter, planter
      [5, 5], // potted plant, potted plant
      [0, 5],
    ],
    inn: [[1, 1]], // barrels of ale
    store: [[4, 2]], // a crate, a basket
    smithy: [[3, 1]], // woodpile, quenching barrel
    farmhouse: [[6, 3]], // hay, woodpile
  };
  for (const d of doors) {
    const pairs = PAIRS[d.b.kind];
    if (!pairs) continue;
    const pair = pairs[Math.floor(hs(d.x, d.y, 24) * pairs.length)]!;
    ([-1, 1] as const).forEach((side, k) => {
      const x = d.x + side,
        y = d.y;
      if (!o.free(x, y) || taken.has(key(x, y))) return;
      taken.add(key(x, y));
      out.push({
        kind: 'dressing',
        x: x + 0.5,
        y: y + 0.5,
        x2: x + 0.5,
        y2: y + 0.5,
        hours: SCENE_HOURS.dressing,
        seed: Math.floor(hs(x, y, 22) * 2 ** 30),
        set: pair[k]!,
      });
    });
  }

  // Each building's own business: the innkeeper and shopkeepers sweep their steps in the morning, the smithy and the
  // farms split firewood, farms keep a dog; homes wash, garden, keep a cat or a dog and chat with the neighbours.
  const budget = Math.round(7 * o.size);
  const HOME: SceneKind[] = ['chat', 'laundry', 'garden', 'cat', 'chat', 'dog', 'laundry', 'sweep', 'cat', 'woodchop'];
  const BY_KIND: Record<string, SceneKind[]> = {
    inn: ['sweep'],
    store: ['sweep'],
    smithy: ['woodchop'],
    farmhouse: ['woodchop', 'dog'],
  };
  let c = 0;
  for (const d of doors) {
    if (out.filter((sc) => sc.kind !== 'dressing').length >= budget + 4) break;
    const kinds = BY_KIND[d.b.kind] ?? [HOME[(c++ + Math.floor(hs(d.x, d.y, 5) * 2)) % HOME.length]!];
    for (const kind of kinds) {
      if (kind === 'laundry' || kind === 'woodchop') {
        // the side yard: along the wall from the door, on whichever side has room
        for (const side of [1, -1]) {
          const p = near(d.x + side * 3, d.y + 1, 1);
          if (!p) continue;
          add(kind, p, kind === 'laundry' ? [p[0] + side, p[1]] : null, 6);
          break;
        }
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
  }

  // the notice board stands at the edge of the square, facing the street
  {
    const pz = Object.entries(t.spots).find(([k]) => k.endsWith('.plaza'))?.[1] ?? { x: t.cx, y: t.cy };
    const p = near(pz.x + 3, pz.y - 2, 3);
    if (p) add('board', p, null, 17);
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

  // the inn keeps a horse tied at the rail, groomed by day; a farmhouse feeds its hens in the morning
  for (const d of doors) {
    if (d.b.kind !== 'inn' && d.b.kind !== 'farmhouse') continue;
    const p = near(d.x + 3, d.y + 2, 2);
    if (p) add(d.b.kind === 'inn' ? 'stablehand' : 'hens', p, null, 15);
  }

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
      // and through the night the watch walks the same round the other way, lantern in hand
      out.push({
        kind: 'watchman',
        x: x2,
        y: y2,
        x2: x,
        y2: y,
        hours: SCENE_HOURS.watchman,
        seed: Math.floor(hs(x, y, 16) * 2 ** 30),
        route: route.slice().reverse(),
      });
    }
  }
  return out;
}
