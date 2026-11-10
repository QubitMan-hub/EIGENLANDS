import { solidBox as B, type VoxelBox } from './mesh';
import { P, furnitureModel } from './models';

export const UI_ICONS = [
  'qubit',
  'heart',
  'rune',
  'st_regen',
  'st_might',
  'st_ward',
  'st_shield',
  'st_mirror',
  'st_lantern',
  'st_food',
  'st_drop',
  'st_chill',
  'st_heat',
  'st_bleed',
  'st_crack',
  'st_curse',
  'st_poison',
  'map',
  'gear',
  'pack',
  'hammer',
  'book',
  'sun',
  'moon',
  'cloud',
  'rain',
  'storm',
  'snow',
  'fog',
  'coin',
  'sword',
  'bolt',
  'dash',
  'hand',
  'close',
  'trash',
  'cart',
  'gift',
  'scroll',
  'chat',
  'hex',
  'anvil',
  'spark',
] as const;

/** Small sculpted objects, authored as volumes, not extrusions of the old bitmap icons. */
export function uiIconBoxes(name: string): VoxelBox[] {
  const gold = 0xf2bc4e,
    jade = 0x31bca4,
    red = 0xec5b4f,
    silver = 0xb9d9df;
  const box = (x: number, y: number, w: number, h: number, c: number, d = 0.22) => B(x, y, 0, w, h, d, c);
  if (name === 'qubit') {
    const out = [B(0, 0.55, 0, 0.32, 0.32, 0.32, 0x9678db), B(0, 0.55, 0, 0.2, 0.2, 0.5, jade)];
    for (let plane = 0; plane < 3; plane++)
      for (let i = 0; i < 32; i++) {
        const a = (i * Math.PI) / 16,
          tilt = (plane * Math.PI) / 3,
          along = Math.cos(a) * 0.65,
          across = Math.sin(a) * 0.65;
        out.push(
          B(
            along * Math.cos(tilt),
            0.55 + across,
            along * Math.sin(tilt),
            0.055,
            0.055,
            0.055,
            plane === 1 ? gold : jade,
          ),
        );
      }
    return out;
  }
  if (name === 'heart' || name === 'st_regen' || name === 'st_might') {
    const c = name === 'st_regen' ? jade : red;
    return [
      box(-0.2, 0.65, 0.35, 0.35, c, 0.36),
      box(0.2, 0.65, 0.35, 0.35, c, 0.36),
      box(0, 0.42, 0.6, 0.3, c, 0.36),
      box(0, 0.2, 0.32, 0.22, c, 0.3),
      box(-0.23, 0.73, 0.12, 0.1, 0xffc1a0, 0.4),
    ];
  }
  if (['st_ward', 'st_shield', 'st_mirror'].includes(name))
    return [
      box(0, 0.55, 0.68, 0.62, gold, 0.28),
      box(0, 0.18, 0.4, 0.22, gold),
      B(0, 0.54, 0.17, 0.5, 0.47, 0.06, name === 'st_mirror' ? silver : jade),
      B(0, 0.54, 0.22, 0.08, 0.47, 0.04, gold),
    ];
  if (name === 'hammer')
    return [box(0, 0.3, 0.12, 0.7, P.wood), box(0, 0.8, 0.75, 0.3, silver, 0.32), box(0, 0.8, 0.14, 0.32, gold, 0.36)];
  if (name === 'sword')
    return [
      box(0, 0.65, 0.14, 0.9, silver),
      box(0, 0.26, 0.6, 0.1, gold),
      box(0, 0.1, 0.12, 0.25, P.wood),
      box(0, -0.04, 0.2, 0.12, gold),
    ];
  if (['book', 'scroll', 'map'].includes(name)) {
    const c = name === 'book' ? 0x357fb1 : 0xf8df9e;
    const out = [box(0, 0.5, 0.72, 0.8, c, 0.24), B(0, 0.5, 0.15, 0.52, 0.65, 0.06, 0xffefb4)];
    for (let i = 0; i < 3; i++)
      out.push(B(-0.02, 0.35 + i * 0.15, 0.19, 0.38, 0.025, 0.035, name === 'map' ? jade : P.wood));
    out.push(box(-0.35, 0.5, 0.1, 0.85, gold, 0.3));
    return out;
  }
  if (['st_drop', 'st_bleed', 'st_food', 'st_poison', 'st_curse'].includes(name)) {
    const c = name === 'st_food' ? 0xdb963a : name === 'st_poison' ? 0x87bc43 : name === 'st_curse' ? 0xa77ada : red;
    return [
      box(0, 0.35, 0.52, 0.4, c, 0.38),
      box(0, 0.62, 0.32, 0.22, c, 0.32),
      box(0, 0.8, 0.12, 0.16, c),
      box(-0.14, 0.43, 0.07, 0.16, 0xffd79a, 0.42),
    ];
  }
  if (
    [
      'sun',
      'gear',
      'coin',
      'moon',
      'hex',
      'rune',
      'spark',
      'snow',
      'st_chill',
      'st_heat',
      'bolt',
      'storm',
      'dash',
      'close',
      'st_crack',
    ].includes(name)
  ) {
    const out: VoxelBox[] = [],
      c = ['snow', 'st_chill'].includes(name) ? silver : ['rune', 'hex'].includes(name) ? jade : gold;
    if (['bolt', 'storm', 'dash', 'close', 'st_crack'].includes(name)) {
      for (let i = 0; i < 7; i++) {
        const x = name === 'close' ? (i - 3) * 0.1 : Math.sin(i * 0.9) * 0.15;
        out.push(box(x, 0.1 + i * 0.11, 0.2, 0.14, c));
        if (name === 'close') out.push(box(-x, 0.1 + i * 0.11, 0.2, 0.14, c));
      }
      return out;
    }
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      if (name === 'moon' && Math.cos(a) > 0.25) continue;
      out.push(box(Math.cos(a) * 0.35, 0.5 + Math.sin(a) * 0.35, 0.18, 0.18, c, 0.22));
      if (['sun', 'gear', 'snow', 'st_chill', 'spark', 'st_heat'].includes(name) && i % 2 === 0)
        out.push(box(Math.cos(a) * 0.52, 0.5 + Math.sin(a) * 0.52, 0.12, 0.12, c));
    }
    if (!['moon', 'gear', 'hex'].includes(name)) out.push(box(0, 0.5, 0.42, 0.42, c, 0.3));
    return out;
  }
  if (['cloud', 'rain', 'fog'].includes(name)) {
    const out = [
      box(0, 0.65, 0.9, 0.25, silver, 0.36),
      box(-0.2, 0.85, 0.3, 0.25, silver, 0.3),
      box(0.15, 0.9, 0.35, 0.3, silver, 0.38),
    ];
    if (name !== 'cloud')
      for (let i = 0; i < 3; i++) out.push(box((i - 1) * 0.27, 0.2, 0.07, 0.2, name === 'rain' ? 0x4dc8e8 : silver));
    return out;
  }
  if (name === 'hand')
    return [
      box(0, 0.3, 0.48, 0.4, P.pale, 0.24),
      ...Array.from({ length: 4 }, (_, i) => box(-0.2 + i * 0.13, 0.7, 0.09, 0.4 - (i % 3) * 0.05, P.pale)),
      box(-0.33, 0.35, 0.13, 0.3, P.pale),
    ];
  if (name === 'chat')
    return [
      box(0, 0.6, 0.85, 0.5, 0x45b6ab, 0.3),
      box(-0.25, 0.23, 0.2, 0.22, 0x45b6ab),
      ...[-0.25, 0, 0.25].map((x) => B(x, 0.6, 0.19, 0.08, 0.08, 0.04, gold)),
    ];
  if (name === 'pack' || name === 'gift')
    return [
      box(0, 0.45, 0.68, 0.7, name === 'gift' ? red : P.wood, 0.45),
      box(0, 0.5, 0.1, 0.78, gold, 0.49),
      box(0, 0.8, 0.75, 0.1, gold, 0.5),
      box(0, 0.96, 0.35, 0.12, P.wood, 0.2),
    ];
  if (name === 'trash')
    return [
      box(0, 0.4, 0.55, 0.65, P.iron, 0.4),
      box(0, 0.78, 0.7, 0.12, silver, 0.5),
      box(0, 0.88, 0.25, 0.1, silver),
    ];
  if (name === 'cart')
    return [
      B(0, 0.42, 0, 0.75, 0.45, 0.5, P.wood),
      B(-0.4, 0.13, 0, 0.15, 0.3, 0.3, P.iron),
      B(0.4, 0.13, 0, 0.15, 0.3, 0.3, P.iron),
      B(0.5, 0.65, 0, 0.35, 0.08, 0.08, P.wood),
    ];
  if (name === 'st_lantern') return furnitureModel('lantern').boxes;
  if (name === 'anvil')
    return [
      box(0, 0.14, 0.7, 0.2, P.iron, 0.5),
      box(0, 0.4, 0.3, 0.4, P.iron, 0.3),
      box(0, 0.7, 0.9, 0.22, silver, 0.4),
    ];
  return uiIconBoxes('rune');
}

/** Carved slab with solid timbers, inset facing, metal bands and corner studs. Used as a nine-slice UI skin. */
export function uiPlateBoxes(kind: 'timber' | 'stone' | 'jade' | 'slot'): VoxelBox[] {
  const stone = kind === 'stone',
    slot = kind === 'slot',
    jade = kind === 'jade';
  const face = stone ? 0xeed6a0 : jade ? 0x238f7e : slot ? 0x273a38 : 0x4e3426;
  const edge = stone ? 0xa99067 : jade ? 0x146657 : 0x80532e;
  const out = [B(0, 0, -0.12, 6, 4, 0.2, edge), B(0, 0, 0, 5.55, 3.55, 0.2, face)];
  for (const x of [-2.85, 2.85]) out.push(B(x, 0, 0.09, 0.3, 4, 0.28, edge));
  for (const y of [-1.85, 1.85]) out.push(B(0, y, 0.09, 5.7, 0.3, 0.28, edge));
  for (const x of [-2.77, 2.77])
    for (const y of [-1.77, 1.77]) {
      out.push(B(x, y, 0.23, 0.38, 0.38, 0.12, 0xb57d2d), B(x, y, 0.32, 0.12, 0.12, 0.12, 0xf6d47b));
    }
  return out;
}

import type { VialSpec } from '../../ui/vitals-art';

/** A physical inset gauge: frame, colored fill, delayed-loss strip and charge studs are all solid meshes. */
export function uiGaugeBoxes(v: VialSpec): VoxelBox[] {
  const colors = {
    health: 0xe95448,
    mana: 0x53bddc,
    stamina: 0x7abb46,
    food: 0xe6a747,
    water: 0x389bd9,
    temp: 0xd58c63,
  };
  const rim = v.low ? 0xd87848 : v.ready ? 0x79dcbb : 0xcda55a;
  const out = [
    B(0, 0, -0.1, 6, 0.68, 0.2, 0x293a38),
    B(0, 0.3, 0.03, 6, 0.08, 0.22, rim),
    B(0, -0.3, 0.03, 6, 0.08, 0.22, rim),
    B(-2.94, 0, 0.03, 0.12, 0.6, 0.22, rim),
    B(2.94, 0, 0.03, 0.12, 0.6, 0.22, rim),
  ];
  const fill = (fraction: number, color: number, z: number) => {
    const w = Math.max(0, Math.min(1, fraction)) * 5.68;
    if (w > 0.001) out.push(B(-2.84 + w / 2, 0, z, w, 0.43, 0.12, color));
  };
  fill(v.trail, 0xa76d4e, 0.02);
  fill(v.shown, colors[v.id], 0.1);
  if (v.aura) out.push(B(0, 0.36, 0.04, 5.8, 0.045, 0.08, v.aura === 'shield' ? 0x9fe8b6 : 0x8fcbe9));
  for (let i = 0; i < v.pipMax; i++)
    out.push(B(2.7 - i * 0.24, -0.3, 0.2, 0.13, 0.1, 0.12, i < v.pips ? 0xf9df85 : 0x4e4b3b));
  return out;
}
