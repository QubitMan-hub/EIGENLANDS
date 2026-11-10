import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

export type VoxelBox = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: number;
  /** Bit mask: +x,-x,+y,-y,+z,-z. Hidden ground faces need no triangles. */
  faces?: number;
  tile?: [number, number];
};
export const solidBox = (
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: number,
  faces = 63,
): VoxelBox => ({ x, y, z, w, h, d, color, faces });

const FACES = [
  {
    n: [1, 0, 0],
    p: [
      [1, -1, -1],
      [1, 1, -1],
      [1, 1, 1],
      [1, -1, 1],
    ],
    shade: 0.88,
  },
  {
    n: [-1, 0, 0],
    p: [
      [-1, -1, 1],
      [-1, 1, 1],
      [-1, 1, -1],
      [-1, -1, -1],
    ],
    shade: 0.78,
  },
  {
    n: [0, 1, 0],
    p: [
      [-1, 1, 1],
      [1, 1, 1],
      [1, 1, -1],
      [-1, 1, -1],
    ],
    shade: 1,
  },
  {
    n: [0, -1, 0],
    p: [
      [-1, -1, -1],
      [1, -1, -1],
      [1, -1, 1],
      [-1, -1, 1],
    ],
    shade: 0.6,
  },
  {
    n: [0, 0, 1],
    p: [
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
      [-1, -1, 1],
    ],
    shade: 0.82,
  },
  {
    n: [0, 0, -1],
    p: [
      [-1, -1, -1],
      [-1, 1, -1],
      [1, 1, -1],
      [1, -1, -1],
    ],
    shade: 0.92,
  },
];

/** Solid cuboids merged into one indexed mesh, with normals and linear vertex colors, never sprites. */
export function modelGeometry(boxes: readonly VoxelBox[]): BufferGeometry {
  const positions: number[] = [],
    normals: number[] = [],
    colors: number[] = [],
    indices: number[] = [],
    tiles: number[] = [];
  const c = new Color();
  for (const b of boxes) {
    c.setHex(b.color);
    for (let f = 0; f < 6; f++) {
      if (!((b.faces ?? 63) & (1 << f))) continue;
      const face = FACES[f],
        offset = positions.length / 3;
      for (const p of face.p) {
        positions.push(b.x + (p[0] * b.w) / 2, b.y + (p[1] * b.h) / 2, b.z + (p[2] * b.d) / 2);
        normals.push(...face.n);
        colors.push(c.r * face.shade, c.g * face.shade, c.b * face.shade);
        tiles.push(b.tile?.[0] ?? NaN, b.tile?.[1] ?? NaN);
      }
      indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  g.setAttribute('voxelTile', new Float32BufferAttribute(tiles, 2));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

export function placeBoxes(
  boxes: readonly VoxelBox[],
  x: number,
  y: number,
  z: number,
  scale = 1,
  turn = 0,
): VoxelBox[] {
  const cs = Math.cos(turn),
    sn = Math.sin(turn);
  return boxes.map((b) => ({
    ...b,
    x: x + (b.x * cs + b.z * sn) * scale,
    y: y + b.y * scale,
    z: z + (b.z * cs - b.x * sn) * scale,
    w: (Math.abs(cs) * b.w + Math.abs(sn) * b.d) * scale,
    h: b.h * scale,
    d: (Math.abs(sn) * b.w + Math.abs(cs) * b.d) * scale,
  }));
}
