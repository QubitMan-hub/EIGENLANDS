import { CHUNK_SIZE, T, compassWord, townFor, type ChunkStore } from '@eigenlands/shared';
import type { Scene } from './scenes';
export interface ArrivalProp {
  x: number;
  y: number;
  kind: 'stone' | 'flower' | 'blanket' | 'board';
  variant: number;
}
const GROUND = new Set<number>([T.GRASS, T.FLOWERS, T.GRASS_TALL, T.PATH]);
export const ARRIVAL_BOARD = { x: -4, y: 1 };
/** Hand-planned arrival commons; all decoration is cosmetic and yields to existing terrain and ownership. */
export function arrivalPlan(seed: number): { props: ArrivalProp[]; scenes: Scene[] } {
  const props: ArrivalProp[] = [];
  for (let y = -4; y <= 4; y++)
    for (let x = -4; x <= 4; x++)
      if (Math.hypot(x, y) > 2.7 && Math.abs(x) + Math.abs(y) <= 6)
        props.push({ x, y, kind: 'stone', variant: (((x + y) % 3) + 3) % 3 });
  const town = townFor(seed),
    length = Math.hypot(town.cx, town.cy);
  for (let i = 5; i <= 12; i++) {
    const x = Math.round((town.cx / length) * i),
      y = Math.round((town.cy / length) * i);
    if (!props.some((p) => p.x === x && p.y === y)) props.push({ x, y, kind: 'stone', variant: i % 3 });
  }
  for (const [i, [x, y]] of [
    [-6, -5],
    [-3, -6],
    [0, -6],
    [4, -5],
    [6, -3],
    [7, 1],
    [6, 5],
    [3, 7],
    [-2, 7],
    [-6, 5],
    [-7, 2],
    [-7, -1],
  ].entries())
    props.push({ x: x!, y: y!, kind: 'flower', variant: i % 3 });
  props.push({ ...ARRIVAL_BOARD, kind: 'board', variant: 0 }, { x: -5, y: -3, kind: 'blanket', variant: 0 });
  const scene = (
    kind: Scene['kind'],
    x: number,
    y: number,
    x2 = x,
    y2 = y,
    hours: [number, number] = [7, 20],
  ): Scene => ({ kind, x, y, x2, y2, hours, seed: seed + 31000 + props.length + x * 11 + y * 7 });
  return {
    props,
    scenes: [
      scene('busker', -5, -2, -5, -2, [9, 21]),
      scene('porter', -5, 4, -2, 6, [7, 19]),
      scene('garden', 5, -2, 5, -2, [6, 19]),
      scene('cat', 5, 4, 5, 4, [0, 24]),
      scene('hens', -5, -5, -5, -5, [6, 20]),
      {
        ...scene('watchman', 4, 1, 4, 1, [20, 29.5]),
        route: [
          [4, 1],
          [0, -4],
          [-4, 1],
          [0, 4],
        ],
      },
    ],
  };
}
export function arrivalGround(store: ChunkStore, x: number, y: number): boolean {
  const tx = Math.floor(x),
    ty = Math.floor(y),
    cx = Math.floor(tx / CHUNK_SIZE),
    cy = Math.floor(ty / CHUNK_SIZE);
  if (!store.has(cx, cy)) return false;
  const chunk = store.get(cx, cy),
    idx = (ty - cy * CHUNK_SIZE) * CHUNK_SIZE + tx - cx * CHUNK_SIZE;
  return (
    !chunk.diff.has(idx) &&
    GROUND.has(store.getTile(tx, ty)) &&
    !store.solidAt(tx, ty) &&
    !store.objectAt(tx, ty) &&
    !store.structureAt(tx, ty)
  );
}
export function arrivalNotices(seed: number) {
  const town = townFor(seed);
  return [
    {
      head: 'Hadamere awaits',
      text: `The village lies ${compassWord(town.cx, town.cy)}, about ${Math.round(Math.hypot(town.cx, town.cy))} tiles away. The stones leaving the shrine point toward it.`,
    },
    {
      head: 'Your first outing',
      text: 'Select a pickaxe to click a rock, or an axe to click a tree. Keep a weapon in hand for combat. Your Journal keeps the arrival quest and discovered places.',
    },
    {
      head: 'A little company',
      text: 'Travellers tend these flowers and carry supplies by day. Stay for a tune; the night watch brings a lantern after dusk.',
    },
  ];
}
