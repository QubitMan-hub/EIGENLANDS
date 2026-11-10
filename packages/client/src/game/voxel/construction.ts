import type { BuildCell, ChunkStore } from '@eigenlands/shared';
import { solidBox as B, type VoxelBox } from './mesh';
import { voxelHeight } from './camera';
import { P, wallModel, furnitureModel } from './models';

/** Adjacent panels share one ridge profile, so a built house has one roof instead of a pyramid per tile. */
export function constructionRoof(store: ChunkStore, c: BuildCell): VoxelBox[] {
  const d = c.data,
    dx = (d.roofTurn ?? 0) % 2 === 0 ? 1 : 0,
    dy = 1 - dx;
  const matches = (n: number) => {
    const p = store.structureAt(c.x + dx * n, c.y + dy * n);
    return p?.owner === c.owner && p.data.roof === d.roof && (p.data.roofTurn ?? 0) % 2 === (d.roofTurn ?? 0) % 2;
  };
  let left = 0,
    right = 0;
  while (left < 64 && matches(-left - 1)) left++;
  while (right < 64 && matches(right + 1)) right++;
  const n = left + right + 1,
    color = d.roof?.includes('thatch') ? 0xa08c59 : d.roof?.includes('moss') ? 0x6f8052 : P.roof;
  return Array.from({ length: 8 }, (_, i) => {
    const t = (i + 0.5) / 8,
      rise = voxelHeight(Math.min(24, Math.min(left + t, n - left - t) * 5));
    return B(dx ? t - 0.5 : 0, 1.95 + rise, dy ? t - 0.5 : 0, dx ? 0.125 : 1.02, 0.12, dy ? 0.125 : 1.02, color);
  });
}

export function constructionPreview(id: string, turn: number): VoxelBox[] {
  if (id.includes('wall') || id.includes('window') || id.includes('door'))
    return wallModel(id.includes('stone'), id.includes('window'), id.includes('door'), turn % 2);
  if (id.includes('stairs')) return furnitureModel('stairs').boxes;
  if (id.includes('roof')) return [B(0, 1.95, 0, 1, 0.12, 1, P.roof)];
  return [B(0, 0.035, 0, 1, 0.07, 1, P.wood)];
}
