import { T } from './tiles';
import type { Town, Building } from './town';

/** Separate, persistent upper-floor coordinates reuse chunk collision, interest and shard handoff. */
export const UPPER_OY = -80000;
export const isUpperY = (y: number): boolean => y > UPPER_OY - 12000 && y < UPPER_OY + 12000;

export const townStairTile=(b:Building)=>({x:b.x+b.w-2,y:b.y+1});

export function upperTowns(base: Town[]): Town[] {
  return base.flatMap(t => t.buildings.filter(b => ['hall', 'inn', 'farmhouse'].includes(b.kind)).map(b => {
    const u: Building = { ...b, id: `${b.id}.upper`, y: b.y + UPPER_OY, doorY: b.doorY + UPPER_OY };
    const upper: Town = { name: `${t.name} · ${b.kind} upper floor`, cx: b.x + b.w / 2, cy: u.y + b.h / 2, x0: b.x, y0: u.y, x1: b.x + b.w - 1, y1: u.y + b.h - 1, buildings: [u], objects: [], spots: {}, tiles: new Map() };
    for (let y = 0; y < u.h; y++) for (let x = 0; x < u.w; x++) upper.tiles.set(x + y * u.w, !x || !y || x === u.w - 1 || y === u.h - 1 ? T.WALL : T.FLOOR);
    const {x:sx,y:sy}=townStairTile(b);
    if (!t.objects.some(o => o.sub === 'stairs_up' && o.data?.building === b.id)) t.objects.push({ x: sx, y: sy, kind: 'deco', sub: 'stairs_up', data: { building: b.id, to: { x: sx + .5, y: sy + UPPER_OY + .5 } } });
    upper.objects.push({ x: sx, y: sy + UPPER_OY, kind: 'deco', sub: 'stairs_down', data: { building: b.id, to: { x: sx + .5, y: sy + .5 } } });
    const add = (x: number, y: number, sub: string) => {if(x<=u.x||x>=u.x+u.w-1||y<=u.y||y>=u.y+u.h-1||x>=sx-1&&y<=sy+UPPER_OY+1||upper.objects.some(o=>o.x===x&&o.y===y))return;upper.objects.push({x,y,kind:'deco',sub});};
    add(u.x + 1, u.y + 1, 'bed'); add(u.x + u.w - 2, u.y + u.h - 2, 'bed');
    add(u.x + 3, u.y + 1, b.kind === 'hall' ? 'bookcase' : 'wardrobe');
    add(u.x + 1, u.y + 3, 'desk'); add(u.x + 2, u.y + 3, 'stool');
    add(u.x + u.w - 2, u.y + 3, 'lamp');
    upper.objects.push({ x: u.x + 3, y: u.y + 2, kind: 'furniture', sub: 'rug' });
    return upper;
  }));
}
