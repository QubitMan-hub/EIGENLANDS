import { G, T, TILE_DEFS, LEVEL_PX, hash2 } from '@eigenlands/shared';
import { solidBox as B, placeBoxes, type VoxelBox } from './mesh';
import { voxelHeight } from './camera';

export interface GroundTile {
  tile: number;
  level: number;
  color: number;
  urban?: boolean;
  snow?: boolean;
  occupied?: boolean;
}
export interface TerrainSource {
  seed: number;
  at(x: number, y: number): GroundTile;
}
export interface TerrainPatch {
  boxes: VoxelBox[];
  shadowBoxes: VoxelBox[];
  cells: number;
  topFaces: number;
  sideFaces: number;
  visibleQuads: number;
}
const SIDES = [
  [1, 0, 1],
  [-1, 0, 2],
  [0, 1, 16],
  [0, -1, 32],
] as const;
const tint = (c: number, k: number) =>
  (Math.min(255, Math.round(((c >> 16) & 255) * k)) << 16) |
  (Math.min(255, Math.round(((c >> 8) & 255) * k)) << 8) |
  Math.min(255, Math.round((c & 255) * k));
const mod = (a: number, n: number) => ((a % n) + n) % n;
const liquid = (g: number) => g === G.WATER || g === G.DEEP || g === G.LAVA;

/** An actual missing upper corner with a lower surviving voxel, rather than a painted crack. */
function chippedPaver(w: number, d: number, color: number, turn: number): VoxelBox[] {
  const chip = 0.05,
    faces = 4 | 1 | 2 | 16 | 32;
  return placeBoxes(
    [
      B(0, -0.025, chip / 2, w, 0.05, d - chip, color, faces),
      B(chip / 2, -0.025, -d / 2 + chip / 2, w - chip, 0.05, chip, color, faces),
      B(-w / 2 + chip / 2, -0.0425, -d / 2 + chip / 2, chip, 0.015, chip, tint(color, 0.82), faces),
    ],
    0,
    0,
    0,
    1,
    (turn * Math.PI) / 2,
  );
}

/** Physical cap, inset tread and layered cut faces. All randomness is sampled in absolute world coordinates. */
export function buildVoxelTerrain(
  source: TerrainSource,
  x0: number,
  y0: number,
  side: number,
  detail: 4 | 8 = 8,
): TerrainPatch {
  const width = side * detail,
    pitch = width + 2,
    step = 1 / detail;
  const tiles = new Map<string, GroundTile>();
  const at = (x: number, y: number) => {
    const key = `${x},${y}`;
    let t = tiles.get(key);
    if (!t) {
      t = source.at(x, y);
      tiles.set(key, t);
    }
    return t;
  };
  const height = new Float64Array(pitch * pitch),
    colors = new Uint32Array(pitch * pitch),
    grounds = new Int16Array(pitch * pitch);
  const index = (x: number, z: number) => (z + 1) * pitch + x + 1;
  const boxes: VoxelBox[] = [],
    shadowBoxes: VoxelBox[] = [];
  const salt = source.seed;
  for (let z = -1; z <= width; z++)
    for (let x = -1; x <= width; x++) {
      const wx = x0 + (x + 0.5) * step,
        wz = y0 + (z + 0.5) * step,
        tx = Math.floor(wx),
        tz = Math.floor(wz),
        tile = at(tx, tz),
        g = TILE_DEFS[tile.tile]?.ground ?? G.VOID;
      const i = index(x, z);
      grounds[i] = g;
      if (tile.tile === T.UPPER_VOID) {
        height[i] = -Infinity;
        continue;
      }
      const h = voxelHeight(tile.level * LEVEL_PX),
        sx = Math.floor(wx * 8),
        sz = Math.floor(wz * 8);
      // Quarter/half-tile color patches cross logical tile borders; no per-tile checkerboard tint.
      const patch = hash2(salt, Math.floor(sx / 3), Math.floor(sz / 3), 6101);
      const large = hash2(salt, Math.floor(sx / 11), Math.floor(sz / 11), 6102);
      let color = tint(tile.color, [0.89, 0.96, 1.02, 1.08][Math.floor(patch * 4)] * (0.96 + large * 0.08));
      let recess = 0;
      if (g === G.GRASS || g === G.SAND || g === G.CAVE || g === G.PATH || g === G.VAULT) {
        // Small stepped depressions expose real vertical faces without raising the collision surface.
        const clumpSize = detail === 4 ? 4 : 2;
        const clump = hash2(salt, Math.floor(sx / clumpSize), Math.floor(sz / clumpSize), 6103);
        recess = clump < 0.08 ? 1 / 64 : clump > 0.985 ? 1 / 32 : 0;
      }
      if (g === G.GRASS) {
        // Worn turf follows a path boundary; unrelated grass does not receive arbitrary dirt tiles.
        const px = wx - tx,
          pz = wz - tz;
        const verge =
          (px < 0.18 && TILE_DEFS[at(tx - 1, tz).tile]?.ground === G.PATH) ||
          (px > 0.82 && TILE_DEFS[at(tx + 1, tz).tile]?.ground === G.PATH) ||
          (pz < 0.18 && TILE_DEFS[at(tx, tz - 1).tile]?.ground === G.PATH) ||
          (pz > 0.82 && TILE_DEFS[at(tx, tz + 1).tile]?.ground === G.PATH);
        if (verge && patch < 0.48 && !tile.snow) color = tint(0x9c8b4f, 0.92 + patch * 0.15);
      }
      if (g === G.SOIL || g === G.SOIL_WET) {
        const furrow = mod(sx, 8) === 1 || mod(sx, 8) === 6;
        recess = furrow ? 0.065 : 0;
        color = tint(tile.color, furrow ? 0.74 : 1.06);
      }
      if (g === G.FLOOR || g === G.WALL || g === G.VAULT || g === G.CAVE || (g === G.PATH && tile.urban)) {
        recess = 0.055;
        color = tint(tile.color, 0.64);
      }
      if (liquid(g)) {
        recess = g === G.LAVA ? 0.055 : 0.11;
        const shore = SIDES.some(([dx, dz]) => !liquid(TILE_DEFS[at(tx + dx, tz + dz).tile]?.ground ?? G.VOID));
        if (g !== G.LAVA) color = tint(shore ? 0x51b2b8 : tile.color, 0.94 + patch * 0.12);
      }
      const supported = tile.occupied || !!TILE_DEFS[tile.tile]?.obj;
      if (g === G.GRASS && supported && Math.abs(wx - tx - 0.5) < 0.16 && Math.abs(wz - tz - 0.5) < 0.16) recess = 0;
      colors[i] = color;
      height[i] = h - recess;
    }
  let topFaces = 0,
    sideFaces = 0;
  // Greedy coplanar caps: a patch costs one quad, not a complete cube per buried voxel.
  const used = new Uint8Array(width * width);
  for (let z = 0; z < width; z++)
    for (let x = 0; x < width; x++) {
      const u = z * width + x,
        i = index(x, z);
      if (used[u] || !Number.isFinite(height[i])) continue;
      let w = 1;
      while (
        x + w < width &&
        !used[u + w] &&
        height[index(x + w, z)] === height[i] &&
        colors[index(x + w, z)] === colors[i]
      )
        w++;
      let d = 1;
      rows: while (z + d < width) {
        for (let k = 0; k < w; k++)
          if (
            used[(z + d) * width + x + k] ||
            height[index(x + k, z + d)] !== height[i] ||
            colors[index(x + k, z + d)] !== colors[i]
          )
            break rows;
        d++;
      }
      for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) used[(z + dz) * width + x + dx] = 1;
      boxes.push(B((x + w / 2) * step, height[i] - 0.04, (z + d / 2) * step, w * step, 0.08, d * step, colors[i], 4));
      topFaces++;
    }
  for (let z = 0; z < width; z++)
    for (let x = 0; x < width; x++) {
      const i = index(x, z),
        hi = height[i];
      if (!Number.isFinite(hi)) continue;
      const tx = Math.floor(x0 + (x + 0.5) * step),
        tz = Math.floor(y0 + (z + 0.5) * step),
        tile = at(tx, tz),
        h = voxelHeight(tile.level * LEVEL_PX),
        g = grounds[i];
      for (const [dx, dz, face] of SIDES) {
        let lo = height[index(x + dx, z + dz)];
        if (!Number.isFinite(lo)) continue; // upper-floor void has no invented basement walls
        if (lo >= hi - 0.00001) continue;
        // Rows are only split on exposed faces; turf, roots, soil and bedrock remain visibly separate.
        let bottom = lo;
        while (bottom < hi - 0.00001) {
          const top = Math.min(hi, (Math.floor((bottom + 0.00001) * 8) + 1) / 8);
          const depth = h - (top + bottom) / 2;
          let c = colors[i];
          if (g === G.GRASS)
            c =
              depth < 0.095
                ? tile.snow
                  ? 0xcbd7d7
                  : tint(tile.color, 0.72)
                : depth < 0.22
                  ? 0x80633b
                  : depth < 0.6
                    ? 0x916b45
                    : 0x69766c;
          else if (g === G.SAND) c = depth < 0.3 ? 0xc6a36b : 0x937a57;
          else if (!liquid(g)) c = depth < 0.2 ? 0x85775b : 0x69716b;
          const v = hash2(
            salt,
            Math.floor((x0 + (x + 0.5) * step) * 8) + Math.floor(bottom * 8) * 7,
            Math.floor((y0 + (z + 0.5) * step) * 8),
            6110,
          );
          c = tint(c, 0.88 + v * 0.2);
          boxes.push(B((x + 0.5) * step, (bottom + top) / 2, (z + 0.5) * step, step, top - bottom, step, c, face));
          sideFaces++;
          bottom = top;
        }
      }
    }
  for (let z = 0; z < side; z++)
    for (let x = 0; x < side; x++) {
      const tx = x0 + x,
        tz = y0 + z,
        t = at(tx, tz),
        g = TILE_DEFS[t.tile]?.ground,
        h = voxelHeight(t.level * LEVEL_PX);
      // A coarse solid core casts the cliff's real shadow. Fine turf does not self-shadow into black cracks.
      const lows = SIDES.map(([dx, dz]) => at(tx + dx, tz + dz))
        .filter((n) => n.tile !== T.UPPER_VOID)
        .map((n) => voxelHeight(n.level * LEVEL_PX));
      const low = Math.min(h, ...lows);
      if (t.tile !== T.UPPER_VOID && h - low > 0.15)
        shadowBoxes.push(B(x + 0.5, (h - 0.04 + low) / 2, z + 0.5, 1, h - low - 0.04, 1, 0));
      if (g === G.FLOOR) {
        // Aligned planks and staggered end joints replace the floating floor overlay.
        for (let p = 0; p < 4; p++) {
          const offset = mod(tx + tz + p, 4),
            color = tint(
              [0x9b7047, 0xb38a54, 0x96714b, 0xa58050][offset],
              0.95 + hash2(salt, tx * 4 + p, tz, 6115) * 0.1,
            );
          boxes.push(B(x + (p + 0.5) / 4, h - 0.022, z + 0.5, 0.238, 0.044, 0.985, color, 4 | 1 | 2 | 16 | 32));
          if (mod(tx + tz + p, 3) === 0)
            boxes.push(B(x + (p + 0.5) / 4, h - 0.02, z + 0.12, 0.018, 0.035, 0.018, 0x4e4840, 4));
        }
      } else if (g === G.CAVE || g === G.VAULT || g === G.WALL || (g === G.PATH && t.urban)) {
        const natural = g === G.CAVE;
        const color = g === G.PATH ? 0x9a9c8b : t.color;
        for (let pz = 0; pz < 2; pz++)
          for (let px = 0; px < 2; px++) {
            const n = hash2(salt, tx * 2 + px, tz * 2 + pz, 6116);
            const w = 0.46 + (n > 0.6 ? 0.02 : 0),
              d = 0.46 + (n < 0.4 ? 0.02 : 0),
              top = h - (n > 0.8 ? 0.0125 : 0);
            const c = tint(color, 0.87 + n * 0.25);
            if (natural || n < 0.4)
              boxes.push(
                ...placeBoxes(chippedPaver(w, d, c, Math.floor(n * 4)), x + (px + 0.5) / 2, top, z + (pz + 0.5) / 2),
              );
            else boxes.push(B(x + (px + 0.5) / 2, top - 0.025, z + (pz + 0.5) / 2, w, 0.05, d, c, 4 | 1 | 2 | 16 | 32));
          }
      } else if (g === G.WATER || g === G.DEEP) {
        if (hash2(salt, tx, tz, 6117) > 0.68) {
          const px = x + 0.2 + Math.floor(hash2(salt, tx, tz, 6118) * 4) / 8;
          boxes.push(B(px, h - 0.105, z + 0.28, 0.22, 0.009, 0.032, 0x91d2ce, 4 | 1 | 2 | 16 | 32));
        }
      }
    }
  const visibleQuads = boxes.reduce((sum, b) => {
    let mask = b.faces ?? 63;
    while (mask) {
      sum += mask & 1;
      mask >>= 1;
    }
    return sum;
  }, 0);
  return { boxes, shadowBoxes, cells: width * width, topFaces, sideFaces, visibleQuads };
}

/** Scuffed, chipped stepping stones follow the existing arrival plan, never scatter new obstacles. */
export function steppingStone(seed: number): VoxelBox[] {
  const out: VoxelBox[] = [];
  for (let z = 0; z < 2; z++)
    for (let x = 0; x < 2; x++) {
      const n = hash2(seed, x, z, 6120),
        w = n > 0.5 ? 0.3 : 0.32,
        c = tint(0xa2a898, 0.89 + n * 0.18);
      out.push(...placeBoxes(chippedPaver(w, 0.31, c, Math.floor(n * 4)), (x - 0.5) * 0.34, 0.029, (z - 0.5) * 0.34));
    }
  return out;
}

/** A terrain edit can expose the neighboring chunk's bank or cliff faces. */
export function terrainChunkKeys(x: number, y: number, side = 16): string[] {
  const out: string[] = [];
  for (let cy = Math.floor((y - 1) / side); cy <= Math.floor((y + 1) / side); cy++)
    for (let cx = Math.floor((x - 1) / side); cx <= Math.floor((x + 1) / side); cx++) out.push(`${cx},${cy}`);
  return out;
}
