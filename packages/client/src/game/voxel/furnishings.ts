import { hash2 } from '@eigenlands/shared';
import { solidBox as B, type VoxelBox } from './mesh';
import { P } from './models';

/** Seeded, period-appropriate dressing placed on actual horizontal support surfaces. */
export function dressFurniture(boxes: readonly VoxelBox[], kind: string, seed: number, house = 'house'): VoxelBox[] {
  if (!/table|desk|counter|bench|shelf|bookcase|cabinet/.test(kind) || /garden|stool/.test(kind)) return [];
  const shelf = /shelf|bookcase|cabinet/.test(kind);
  const surfaces = boxes.filter(
    (b) => b.w > 0.4 && b.d > 0.25 && b.y + b.h / 2 > 0.25 && b.y + b.h / 2 < 1.65 && (!shelf || b.h < 0.14),
  );
  if (!surfaces.length) return [];
  surfaces.sort((a, b) => b.w * b.d - a.w * a.d);
  const supports = shelf
    ? surfaces.filter((b, i, all) => !all.slice(0, i).some((a) => Math.abs(a.y - b.y) < 0.15)).slice(0, 4)
    : [surfaces[0]];
  const out: VoxelBox[] = [],
    colors = [0x7d6754, 0x6e8b83, 0xa1765b, 0xa89060, 0x6c725b, 0x81738a];
  supports.forEach((s, row) => {
    const count = shelf ? 3 + Math.floor(hash2(seed, row, 1, 45) * 5) : 2 + Math.floor(hash2(seed, row, 2, 45) * 4);
    for (let i = 0; i < count; i++) {
      const start = out.length;
      const x = s.x - s.w * 0.36 + ((i + 0.5) / count) * s.w * 0.72;
      const z = s.z + (hash2(seed, i, row, 47) - 0.5) * s.d * 0.55;
      const y = s.y + s.h / 2 + 0.008,
        c = colors[Math.floor(hash2(seed, i, row, 48) * colors.length)];
      const theme =
        house === 'smithy'
          ? 4
          : house === 'church' || shelf
            ? 2
            : house === 'inn'
              ? 0
              : Math.floor(hash2(seed, i, row, 49) * 5);
      if (theme === 2) {
        const h = 0.17 + hash2(seed, i, row, 50) * 0.15;
        out.push(B(x, y + h / 2, z, 0.07, h, 0.16, c), B(x, y + h - 0.025, z + 0.085, 0.06, 0.018, 0.015, P.gold));
        if (!shelf) out.push(B(x + 0.04, y + 0.025, z, 0.21, 0.04, 0.22, P.pale));
      } else if (theme === 0) {
        out.push(
          B(x, y + 0.02, z, 0.2, 0.035, 0.2, P.pale),
          B(x, y + 0.075, z, 0.14, 0.1, 0.13, i % 2 ? 0xb79d68 : 0x9a6a43),
        );
        if (i % 2 === 0) out.push(B(x, y + 0.135, z, 0.07, 0.03, 0.1, P.cutwood));
      } else if (theme === 1) {
        out.push(
          B(x, y + 0.08, z, 0.13, 0.16, 0.13, c),
          B(x + 0.08, y + 0.08, z, 0.045, 0.08, 0.06, c),
          B(x, y + 0.165, z, 0.085, 0.015, 0.085, P.bark),
        );
      } else if (theme === 3) {
        out.push(
          B(x, y + 0.04, z, 0.18, 0.07, 0.18, P.wood),
          B(x, y + 0.16, z, 0.035, 0.2, 0.035, P.leaf),
          B(x - 0.05, y + 0.17, z, 0.13, 0.05, 0.07, P.darkleaf),
          B(x + 0.04, y + 0.23, z, 0.1, 0.05, 0.08, P.leaf),
        );
      } else {
        out.push(
          B(x, y + 0.035, z, 0.21, 0.06, 0.13, P.iron),
          B(x, y + 0.08, z, 0.15, 0.025, 0.1, P.stone),
          B(x + 0.05, y + 0.1, z + 0.1, 0.03, 0.04, 0.24, P.wood),
        );
      }
      // Pack whole objects into disjoint slots, then fit to the support and the next shelf's clearance.
      const group = out.splice(start);
      const lo = [
        Math.min(...group.map((b) => b.x - b.w / 2)),
        Math.min(...group.map((b) => b.y - b.h / 2)),
        Math.min(...group.map((b) => b.z - b.d / 2)),
      ];
      const hi = [
        Math.max(...group.map((b) => b.x + b.w / 2)),
        Math.max(...group.map((b) => b.y + b.h / 2)),
        Math.max(...group.map((b) => b.z + b.d / 2)),
      ];
      const slotWidth = (s.w - 0.08) / count;
      const cx = s.x - s.w / 2 + 0.04 + (i + 0.5) * slotWidth;
      const ceiling = Math.min(
        y + 0.5,
        ...boxes
          .filter(
            (b) =>
              b.y - b.h / 2 > y + 0.025 &&
              Math.abs(b.x - cx) < b.w / 2 + slotWidth / 2 &&
              Math.abs(b.z - s.z) < b.d / 2 + s.d / 2,
          )
          .map((b) => b.y - b.h / 2 - 0.015),
      );
      const scale = Math.min(
        1,
        (slotWidth - 0.015) / (hi[0] - lo[0]),
        (s.d - 0.08) / (hi[2] - lo[2]),
        (ceiling - y) / (hi[1] - lo[1]),
      );
      if (scale <= 0) continue;
      const cz = Math.max(
        s.z - s.d / 2 + ((hi[2] - lo[2]) * scale) / 2 + 0.02,
        Math.min(z, s.z + s.d / 2 - ((hi[2] - lo[2]) * scale) / 2 - 0.02),
      );
      for (const b of group)
        out.push({
          ...b,
          x: cx + (b.x - (lo[0] + hi[0]) / 2) * scale,
          y: y + (b.y - lo[1]) * scale,
          z: cz + (b.z - (lo[2] + hi[2]) / 2) * scale,
          w: b.w * scale,
          h: b.h * scale,
          d: b.d * scale,
        });
    }
  });
  return out;
}
