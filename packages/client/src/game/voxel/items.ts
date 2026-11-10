import { ITEMS, PALETTE, isBuildPiece, type Glyph } from '@eigenlands/shared';
import { captureSolidCommands } from '../../art/isokit';
import { ISO_ICONS } from '../../art/isometric-icons';
import { modelGeometry, solidBox as B, type VoxelBox } from './mesh';
import { furnitureModel, plantModel, rockModel, wallModel, P } from './models';
import { voxelHeight } from './camera';
import type { Ctx } from '../../art/shade';

const rgb = (index: number) => Number.parseInt(PALETTE[index].slice(1), 16);
const ring = (a: number, b: number): VoxelBox[] => {
  const out: VoxelBox[] = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    out.push(B(Math.cos(angle) * 0.32, 0.12, Math.sin(angle) * 0.32, 0.16, 0.17, 0.16, a));
  }
  out.push(B(0, 0.25, -0.32, 0.2, 0.2, 0.18, b));
  return out;
};

/** Every item gets a physical volume; existing isometric tool definitions retain their original 3D commands. */
export function voxelItemBoxes(id: string): VoxelBox[] {
  const d = ITEMS[id];
  if (!d) return [B(0, 0.3, 0, 0.6, 0.6, 0.6, P.wood)];
  const { g, a: ia, b: ib } = d.icon,
    a = rgb(ia),
    b = rgb(ib);
  const iso = ISO_ICONS[g];
  if (iso) {
    const c = captureSolidCommands(() => iso({} as Ctx, ia, ib));
    const boxes = c.groups.flatMap((group) =>
      group.map((q) =>
        B(
          (q.u + q.du / 2 - 8) / 16,
          voxelHeight(q.z + q.dz / 2),
          (q.v + q.dv / 2 - 8) / 16,
          q.du / 16,
          voxelHeight(Math.max(0.3, q.dz)),
          q.dv / 16,
          rgb(q.color),
        ),
      ),
    );
    if (boxes.length) return boxes;
  }
  if (isBuildPiece(id)) {
    if (/wall|door|window/.test(id))
      return wallModel(id.includes('stone'), id.includes('window'), id.includes('door'), 0);
    if (/roof/.test(id))
      return Array.from({ length: 7 }, (_, i) =>
        B((i - 3) * 0.16, 0.7 - Math.abs(i - 3) * 0.13, 0, 0.16, 0.14, 0.9, a),
      );
    if (/stairs/.test(id)) return furnitureModel('stairs').boxes;
    return [B(0, 0.07, 0, 0.9, 0.14, 0.9, a), B(0, 0.15, 0, 0.04, 0.015, 0.9, b)];
  }
  if (d.place) {
    const model = furnitureModel(d.place.sub ?? g);
    if (model.authored) return model.boxes;
  }
  if (d.kind === 'seed')
    return [
      B(0, 0.35, 0, 0.55, 0.7, 0.12, P.pale),
      B(0, 0.6, 0.075, 0.5, 0.1, 0.05, a),
      B(0, 0.3, 0.08, 0.25, 0.3, 0.05, b),
      B(0, 0.32, 0.12, 0.05, 0.28, 0.04, P.leaf),
    ];
  if (['ring', 'amulet', 'charm', 'coil', 'rope', 'horseshoe', 'belt'].includes(g) || d.kind === 'ring')
    return ring(a, b);
  if (g === 'helm')
    return [
      B(0, 0.32, 0, 0.55, 0.45, 0.5, a),
      B(0, 0.58, -0.03, 0.42, 0.1, 0.42, a),
      B(0, 0.35, 0.27, 0.52, 0.055, 0.05, b),
      B(0, 0.22, 0.29, 0.055, 0.2, 0.05, a),
    ];
  if (g === 'boots' || g === 'greaves')
    return [-1, 1].flatMap((side) => [
      B(side * 0.2, 0.3, 0, 0.24, g === 'greaves' ? 0.6 : 0.45, 0.25, a),
      B(side * 0.2, 0.08, 0.1, 0.25, 0.15, 0.48, b),
    ]);
  if (
    [
      'sword',
      'dagger',
      'greatsword',
      'katana',
      'knife',
      'spear',
      'halberd',
      'wand',
      'staff',
      'hammer',
      'mace',
      'axe',
      'pickaxe',
      'hoe',
      'rod',
      'whip',
      'saw',
      'chisel',
      'tongs',
      'sickle',
      'shears',
      'trowel',
    ].includes(g)
  ) {
    const out = [B(0, 0.18, 0, 0.08, 0.35, 0.08, b)];
    if (/wand|rod|staff/.test(g)) out.push(B(0, 0.65, 0, 0.07, 0.9, 0.07, b), B(0, 1.15, 0, 0.2, 0.22, 0.2, a));
    else if (/axe|pickaxe|hoe|halberd|hammer|mace|saw/.test(g)) {
      out.push(B(0, 0.6, 0, 0.07, 1.1, 0.07, b), B(0.1, 0.95, 0, 0.52, 0.22, 0.12, a));
      if (g === 'mace') out.push(B(0, 1.05, 0, 0.3, 0.3, 0.3, a));
    } else
      out.push(B(0, 0.7, 0, 0.14, 0.8, 0.06, a), B(0, 0.3, 0, 0.42, 0.06, 0.12, b), B(0, 1.15, 0, 0.06, 0.13, 0.04, a));
    return out;
  }
  if (g === 'bow' || g === 'longbow' || g === 'crossbow')
    return [
      B(-0.2, 0.5, 0, 0.08, 0.9, 0.09, b),
      B(0, 0.1, 0, 0.4, 0.08, 0.09, b),
      B(0, 0.9, 0, 0.4, 0.08, 0.09, b),
      B(0.2, 0.5, 0, 0.015, 0.85, 0.015, P.pale),
    ];
  if (['shield', 'buckler'].includes(g))
    return [
      B(0, 0.4, 0, 0.65, 0.8, 0.14, b),
      B(0, 0.42, 0.1, 0.5, 0.62, 0.08, a),
      B(0, 0.42, 0.17, 0.12, 0.46, 0.055, b),
    ];
  if (['shirt', 'cloak', 'gloves', 'backpack'].includes(g) || d.kind === 'armor' || d.kind === 'outfit')
    return [
      B(0, 0.45, 0, 0.5, 0.6, 0.24, a),
      B(-0.34, 0.6, 0, 0.2, 0.25, 0.24, a),
      B(0.34, 0.6, 0, 0.2, 0.25, 0.24, a),
      B(0, 0.46, 0.14, 0.06, 0.5, 0.04, b),
      B(0, 0.18, 0, 0.55, 0.06, 0.26, b),
    ];
  if (['bottle', 'flask', 'vial', 'jar', 'honey'].includes(g) || d.kind === 'potion')
    return [
      B(0, 0.28, 0, 0.42, 0.48, 0.36, a),
      B(0, 0.62, 0, 0.2, 0.22, 0.2, P.pale),
      B(0, 0.77, 0, 0.22, 0.1, 0.22, b),
      B(-0.13, 0.35, 0.19, 0.055, 0.24, 0.035, 0xe0e8d5),
    ];
  if (['gem', 'crystal', 'shard', 'nugget', 'ore', 'coal', 'stone', 'block', 'brick', 'tile'].includes(g)) {
    if (['gem', 'crystal', 'shard'].includes(g))
      return [
        B(0, 0.35, 0, 0.36, 0.6, 0.36, a),
        B(0, 0.72, 0, 0.22, 0.16, 0.22, b),
        B(0, 0.83, 0, 0.1, 0.09, 0.1, b),
        B(0, 0.07, 0, 0.25, 0.1, 0.25, a),
      ];
    return rockModel(17).map((q) => ({ ...q, color: q.y > 0.3 ? b : a }));
  }
  if (['ingot', 'plate', 'plank', 'pane', 'cloth', 'pelt', 'hide', 'roll', 'resin', 'bark'].includes(g))
    return [
      B(0, 0.12, 0, 0.85, 0.24, 0.42, a),
      B(0, 0.25, 0, 0.7, 0.035, 0.32, b),
      B(0.28, 0.29, 0, 0.07, 0.08, 0.45, b),
    ];
  if (['log', 'branch', 'vine'].includes(g))
    return [
      B(0, 0.19, 0, 0.95, 0.38, 0.35, a),
      B(0.49, 0.19, 0, 0.03, 0.28, 0.28, b),
      B(-0.22, 0.43, 0, 0.13, 0.25, 0.13, a),
    ];
  if (['leaf', 'sprout', 'flower', 'root', 'petal', 'wheat'].includes(g) || d.kind === 'crop' || d.kind === 'forage')
    return plantModel(id, 1, a).map((q) => ({ ...q, color: q.color === P.leaf ? b : q.color }));
  if (['scroll', 'map', 'rune', 'book'].includes(g) || d.kind === 'scroll' || d.kind === 'rune')
    return [
      B(0, 0.12, 0, 0.6, 0.2, 0.85, a),
      B(0, 0.23, 0, 0.48, 0.035, 0.68, P.pale),
      B(0, 0.25, 0, 0.07, 0.03, 0.45, b),
      B(0, 0.25, 0.12, 0.3, 0.03, 0.07, b),
    ];
  if (['fish', 'meat', 'leg', 'bone', 'horn', 'fang', 'claw', 'feather', 'wing'].includes(g))
    return [
      B(0, 0.24, 0, 0.75, 0.36, 0.32, a),
      B(-0.48, 0.24, 0, 0.25, 0.5, 0.12, b),
      B(0.28, 0.32, 0.17, 0.05, 0.06, 0.04, P.iron),
    ];
  if (
    d.kind === 'food' ||
    [
      'fruit',
      'berry',
      'egg',
      'mushroom',
      'bread',
      'cheese',
      'cake',
      'cookie',
      'pie',
      'bowl',
      'cup',
      'pot_stew',
    ].includes(g)
  ) {
    return [
      B(0, 0.08, 0, 0.8, 0.1, 0.7, b),
      B(0, 0.23, 0, 0.55, 0.3, 0.48, a),
      B(0, 0.43, 0, 0.38, 0.1, 0.32, a),
      B(-0.13, 0.48, 0.06, 0.08, 0.05, 0.08, b),
    ];
  }
  // Remaining catalog tokens retain both item materials and a distinct volumetric glyph shape.
  const code = [...g].reduce((n, c) => n + c.charCodeAt(0), 0),
    out: VoxelBox[] = [];
  for (let i = 0; i < 5; i++)
    out.push(
      B(
        ((i % 3) - 1) * 0.2,
        0.12 + Math.floor(i / 3) * 0.24,
        (((code + i) % 3) - 1) * 0.15,
        0.24,
        0.24 + (code % 3) * 0.07,
        0.24,
        i % 2 ? a : b,
      ),
    );
  return out;
}
