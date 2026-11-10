import { CROPS, PALETTE, cropStage, type CropData, type WorldObj, type Building } from '@eigenlands/shared';
import { solidBox as B, placeBoxes, type VoxelBox } from './mesh';
import { captureSolidCommands } from '../../art/isokit';
import { worldObjDef } from '../../art/worldobjs';
import { voxelHeight } from './camera';
import { buildingStyle, type BuildingStyle } from './architecture';

const authoredProps = new Map<string, VoxelBox[]>();

function originalObjectModel(o: WorldObj): VoxelBox[] {
  const key = `${o.kind}:${o.sub}:${JSON.stringify(o.data ?? {})}`;
  const cached = authoredProps.get(key);
  if (cached) return cached;
  const captured = captureSolidCommands(() => worldObjDef(o, 'sw', undefined, true));
  // Each canvas is one animation frame. Read its original volumes, not its pixels.
  const commands = captured.groups.find((group) => group.length > 0) ?? [];
  const boxes = commands.map((c) =>
    B(
      (c.u + c.du / 2 - 8) / 16,
      voxelHeight(c.z + c.dz / 2),
      (c.v + c.dv / 2 - 8) / 16,
      c.du / 16,
      voxelHeight(Math.max(c.dz, 0.3)),
      c.dv / 16,
      Number.parseInt(PALETTE[c.color].slice(1), 16),
    ),
  );
  // Some art factories share their cached texture with UI/scene callers. The capture does not own those textures.
  if (authoredProps.size > 512) authoredProps.delete(authoredProps.keys().next().value!);
  authoredProps.set(key, boxes);
  return boxes;
}

export const P = {
  bark: 0x64452f,
  wood: 0x9c7147,
  timber: 0x463329,
  cutwood: 0xc39961,
  leaf: 0x527d48,
  lightleaf: 0x7d9b51,
  darkleaf: 0x345d43,
  stone: 0x85918f,
  mortar: 0x566665,
  pale: 0xd0c4a0,
  iron: 0x48545d,
  gold: 0xddaf59,
  teal: 0x559c99,
  roof: 0x735d70,
  red: 0xb65f4d,
  glow: 0x92e1d3,
  flame: 0xffc66b,
};
const tint = (hex: number, k: number) => {
  const r = Math.min(255, ((hex >> 16) & 255) * k),
    g = Math.min(255, ((hex >> 8) & 255) * k);
  const b = Math.min(255, (hex & 255) * k);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
};
export const variation = (n: number) => (((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1) + 1) % 1;

export function treeModel(seed: number, biome: string, season: number): VoxelBox[] {
  const pine = ['taiga', 'alpine', 'tundra'].includes(biome),
    autumn = season === 2 || biome === 'autumn';
  const enchanted = ['enchanted', 'corrupted'].includes(biome);
  const leaf = season === 3 ? 0x94a69a : enchanted ? 0x778a9b : autumn ? 0xbf814b : P.leaf;
  const h = 2.1 + variation(seed) * 0.7,
    out: VoxelBox[] = [];
  const species = Math.floor(variation(seed * 7) * 5),
    bark = species === 1 ? 0xc2beb0 : species === 2 ? 0x78654d : P.bark;
  out.push(B(0, h * 0.38, 0, 0.24, h * 0.76, 0.24, bark));
  if (species === 1) for (let i = 0; i < 6; i++) out.push(B(0.127, 0.2 + i * 0.25, 0.01, 0.015, 0.04, 0.13, P.bark));
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    out.push(B(dx * 0.16, 0.08, dz * 0.16, dx ? 0.38 : 0.16, 0.16, dz ? 0.38 : 0.16, P.bark));
    out.push(B(dx * 0.3, h * 0.65, dz * 0.3, dx ? 0.65 : 0.15, 0.17, dz ? 0.65 : 0.15, P.bark));
  }
  if (pine) {
    for (let i = 0; i < 7; i++) {
      const w = 1.55 - i * 0.2;
      out.push(B(0, h * 0.45 + i * 0.25, 0, w, 0.28, w, tint(leaf, 0.78 + i * 0.055)));
    }
  } else {
    for (let i = 0; i < 13; i++) {
      const a = i * 2.4,
        r = i === 0 ? 0 : 0.37 + variation(seed + i) * 0.4;
      const x = Math.round(Math.cos(a) * r * 8) / 8,
        z = Math.round(Math.sin(a) * r * 8) / 8;
      const y = h * (species === 3 ? 0.88 : 0.78) + Math.round(variation(seed + i * 5) * 5) / 8;
      const w = 0.55 + variation(seed + i * 9) * 0.45;
      out.push(
        B(x, y, z, w, 0.44 + variation(seed + i * 7) * 0.3, w, tint(leaf, 0.82 + variation(i + seed * 2) * 0.4)),
      );
      if (i % 3 === 0) out.push(B(x + 0.12, y + 0.35, z - 0.1, w * 0.6, 0.18, w * 0.65, tint(leaf, 1.22)));
      if (species === 4 && season !== 3 && i % 2 === 0)
        out.push(B(x + w * 0.3, y + 0.25, z, 0.12, 0.1, 0.12, season === 0 ? 0xcda2b2 : 0xaf7050));
      if (species === 2 && i % 2 === 0) out.push(B(x, y - 0.55, z, 0.16, 0.8, 0.17, tint(leaf, 0.92)));
    }
  }
  return out;
}

export function rockModel(seed: number, ore = ''): VoxelBox[] {
  const out: VoxelBox[] = [];
  for (let i = 0; i < 7; i++) {
    const x = (variation(seed + i * 3) - 0.5) * 0.6,
      z = (variation(seed + i * 7) - 0.5) * 0.6;
    const h = 0.22 + variation(seed + i * 11) * 0.48;
    out.push(
      B(
        Math.round(x * 8) / 8,
        h / 2,
        Math.round(z * 8) / 8,
        0.35 + variation(i + seed) * 0.25,
        h,
        0.4,
        tint(P.stone, 0.75 + variation(seed + i * 2) * 0.5),
      ),
    );
  }
  const color = /gold/.test(ore)
    ? P.gold
    : /copper/.test(ore)
      ? 0xca8a59
      : /crystal|geode/.test(ore)
        ? 0x91bfc9
        : /silver/.test(ore)
          ? 0xc6d6d7
          : /coal/.test(ore)
            ? 0x303c43
            : 0x75858e;
  if (ore)
    for (let i = 0; i < 6; i++)
      out.push(
        B(
          (variation(seed + i * 2) - 0.5) * 0.65,
          0.4 + (i % 3) * 0.09,
          (variation(seed + i * 6) - 0.5) * 0.65,
          0.13,
          0.16 + (i % 3) * 0.08,
          0.13,
          color,
        ),
      );
  return out;
}

export function plantModel(kind: string, seed = 0, color = 0xd6a0b1, stage = 3): VoxelBox[] {
  const out: VoxelBox[] = [];
  const mushroom = /cap|mushroom/.test(kind),
    reed = /reed|grass|wheat|barley/.test(kind);
  for (let i = 0; i < (mushroom ? 3 : 5); i++) {
    const x = (variation(seed + i * 2) - 0.5) * 0.7,
      z = (variation(seed + i * 5) - 0.5) * 0.7;
    const h = (0.14 + variation(seed + i) * 0.3) * (0.3 + stage / 4);
    out.push(B(x, h / 2, z, 0.045, h, 0.045, mushroom ? P.pale : P.leaf));
    if (mushroom) out.push(B(x, h, z, 0.25, 0.09, 0.25, color));
    else {
      out.push(B(x + 0.07, h * 0.5, z, 0.19, 0.04, 0.1, P.leaf));
      out.push(B(x - 0.04, h * 0.7, z + 0.04, 0.1, 0.04, 0.16, P.lightleaf));
      if (!reed && stage > 1) {
        out.push(B(x, h, z, 0.12, 0.06, 0.12, color));
        out.push(B(x, h + 0.035, z, 0.045, 0.04, 0.045, P.gold));
      } else if (stage > 1) out.push(B(x, h, z, 0.07, 0.16, 0.07, P.gold));
    }
  }
  return out;
}

/** Masonry courses and oak framing are volumetric; windows leave real openings. */
export function wallModel(
  stone: boolean,
  window: boolean,
  door: boolean,
  axis: number,
  style?: BuildingStyle,
): VoxelBox[] {
  const out: VoxelBox[] = [];
  const add = (x: number, y: number, w: number, h: number, c: number, d = 0.19) => out.push(B(x, y, 0, w, h, d, c));
  if (door) {
    add(-0.42, 0.95, 0.16, 1.9, P.timber, 0.3);
    add(0.42, 0.95, 0.16, 1.9, P.timber, 0.3);
    add(0, 1.86, 1, 0.2, P.cutwood, 0.3);
  } else if (stone) {
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 3; col++) {
        if (window && row > 2 && row < 6 && col === 1) continue;
        add(
          (col - 1) * 0.332,
          row * 0.27 + 0.135,
          0.322,
          0.255,
          tint(P.stone, 0.88 + variation(row * 7 + col) * 0.22),
          0.24,
        );
      }
  } else {
    add(0, 0.4, 0.98, 0.8, P.pale);
    add(0, 1.73, 0.98, 0.43, P.pale);
    add(-0.4, 1.15, 0.18, 0.7, P.pale);
    add(0.4, 1.15, 0.18, 0.7, P.pale);
    if (!window) add(0, 1.15, 0.66, 0.7, P.pale);
    add(-0.46, 0.95, 0.1, 1.9, P.timber, 0.28);
    add(0.46, 0.95, 0.1, 1.9, P.timber, 0.28);
    for (const y of [0.1, 0.78, 1.88]) add(0, y, 1, 0.09, P.timber, 0.28);
  }
  if (window && !door) {
    add(0, 0.77, 0.64, 0.08, P.cutwood, 0.38);
    add(0, 1.5, 0.64, 0.08, P.cutwood, 0.3);
    add(0, 1.15, 0.055, 0.74, P.timber, 0.17);
    add(0, 1.15, 0.62, 0.045, P.timber, 0.17);
    // Deep blue inset, with a warm lit pane. Mullions stay actual geometry.
    add(0, 1.15, 0.58, 0.65, 0x849c9a, 0.035);
  }
  let styled = out;
  if (style) {
    styled = out.map((b) => ({
      ...b,
      y: (b.y * style.height) / 1.9,
      h: (b.h * style.height) / 1.9,
      color: b.color === P.pale || b.color === P.stone ? style.wall : b.color === P.timber ? style.timber : b.color,
    }));
    if (window && style.shutters && !door)
      for (const side of [-1, 1])
        styled.push(B(side * 0.39, style.height * 0.59, 0.15, 0.16, 0.6, 0.08, style.roofColor));
    if (!stone && !window && !door && style.variant % 3 === 1)
      for (let i = 0; i < 6; i++)
        styled.push(B(-0.34 + i * 0.13, 0.3 + i * 0.21, 0.15, 0.13, 0.14, 0.07, style.timber));
  }
  return axis ? placeBoxes(styled, 0, 0, 0, 1, Math.PI / 2) : styled;
}

export function roofModel(b: Building): VoxelBox[] {
  const style = buildingStyle(b),
    out: VoxelBox[] = [],
    roof = style.roofColor,
    base = style.height + 0.08;
  const ridgeX = b.w >= b.h,
    width = ridgeX ? b.h : b.w,
    length = ridgeX ? b.w : b.h;
  if (style.roof === 'hip' || style.roof === 'spire') {
    const steps = Math.ceil(Math.min(b.w, b.h) * 2.3);
    for (let i = 0; i < steps; i++) {
      const inset = i * 0.22;
      out.push(
        B(
          b.w / 2,
          base + i * (style.roof === 'spire' ? 0.3 : 0.17),
          b.h / 2,
          Math.max(0.18, b.w + 0.6 - inset * 2),
          0.19,
          Math.max(0.18, b.h + 0.6 - inset * 2),
          tint(roof, 0.92 + (i % 3) * 0.04),
        ),
      );
    }
  } else if (style.roof === 'battlement') {
    out.push(B(b.w / 2, base, b.h / 2, b.w + 0.2, 0.18, b.h + 0.2, P.stone));
    for (let x = 0; x <= b.w; x++) for (const z of [0, b.h]) out.push(B(x, base + 0.28, z, 0.6, 0.5, 0.55, P.stone));
    for (let z = 1; z < b.h; z++) for (const x of [0, b.w]) out.push(B(x, base + 0.28, z, 0.55, 0.5, 0.6, P.stone));
  } else {
    const steps = Math.ceil((width + 0.6) * 4);
    for (let i = 0; i < steps; i++) {
      const across = -0.3 + ((i + 0.5) * (width + 0.6)) / steps;
      const rise =
        style.roof === 'saltbox'
          ? Math.min((across + 0.3) * 0.5, (width + 0.3 - across) * 1.05)
          : Math.min(across + 0.3, width + 0.3 - across) * 0.64;
      for (let j = 0; j < Math.ceil(length * 2 + 2); j++) {
        const along = -0.35 + (j + 0.5) * 0.5;
        out.push(
          B(
            ridgeX ? along : across,
            base + rise,
            ridgeX ? across : along,
            ridgeX ? 0.49 : (width + 0.6) / steps,
            0.14,
            ridgeX ? (width + 0.6) / steps : 0.49,
            tint(roof, 0.9 + variation(i * 97 + j) * 0.25),
          ),
        );
      }
    }
  }
  if (style.chimney) {
    out.push(B(b.w * 0.25, base + 0.7, b.h * 0.3, 0.45, 1.5, 0.45, P.stone));
    out.push(B(b.w * 0.25, base + 1.48, b.h * 0.3, 0.58, 0.12, 0.58, P.mortar));
  }
  if (style.dormer) {
    const x = b.w * 0.68,
      z = b.h * 0.67,
      h = base + Math.min(b.w, b.h) * 0.17;
    out.push(B(x, h, z, 0.8, 0.65, 0.65, style.wall), B(x, h, z + 0.34, 0.35, 0.36, 0.04, P.teal));
    for (let i = 0; i < 5; i++)
      out.push(B(x + (i - 2) * 0.2, h + 0.45 - Math.abs(i - 2) * 0.12, z, 0.21, 0.1, 0.85, roof));
  }
  if (b.kind === 'church') {
    const x = b.w * 0.3,
      z = b.h * 0.25;
    out.push(B(x, base + 0.9, z, 0.85, 1.8, 0.85, style.wall));
    for (let i = 0; i < 6; i++) out.push(B(x, base + 1.9 + i * 0.2, z, 0.95 - i * 0.15, 0.22, 0.95 - i * 0.15, roof));
    out.push(B(x, base + 3.2, z, 0.07, 0.45, 0.07, P.gold), B(x, base + 3.24, z, 0.28, 0.07, 0.07, P.gold));
  }
  if (style.awning) {
    const alongX = b.doorY === b.y + b.h - 1 || b.doorY === b.y;
    for (let i = 0; i < 7; i++)
      out.push(
        B(
          b.doorX - b.x + (alongX ? (i - 3) * 0.3 : 0),
          base * 0.8,
          b.doorY - b.y + (alongX ? 0 : (i - 3) * 0.3),
          alongX ? 0.3 : 1.8,
          0.1,
          alongX ? 1.8 : 0.3,
          i % 2 ? P.pale : roof,
        ),
      );
  }
  return out;
}

export function furnitureModel(sub: string, seed = 0): { boxes: VoxelBox[]; authored: boolean } {
  const out: VoxelBox[] = [],
    add = (x: number, y: number, z: number, w: number, h: number, d: number, c: number) =>
      out.push(B(x, y, z, w, h, d, c));
  const legs = (w = 0.7, d = 0.6, h = 0.55) => {
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) add(x, h / 2, z, 0.09, h, 0.09, P.timber);
  };
  if (sub === 'festival_stage' || sub === 'archery_booth') {
    add(0, 0.15, 0, 2.8, 0.3, 1.9, P.wood);
    for (const x of [-1.2, 1.2]) add(x, 1, 0, 0.13, 2, 0.13, P.timber);
    add(0, 2, 0, 2.9, 0.12, 2.1, P.red);
    if (sub === 'archery_booth')
      for (const x of [-0.7, 0, 0.7]) {
        add(x, 0.9, -0.6, 0.58, 0.65, 0.08, P.pale);
        add(x, 0.9, -0.54, 0.3, 0.35, 0.04, P.red);
        add(x, 0.9, -0.51, 0.1, 0.12, 0.03, P.gold);
      }
    else {
      add(0, 1.7, 0, 2.3, 0.25, 0.05, P.pale);
      for (let i = 0; i < 5; i++) add((i - 2) * 0.45, 1.55, 0, 0.15, 0.18, 0.05, i % 2 ? P.gold : P.teal);
    }
  } else if (sub.startsWith('secret_')) {
    if (sub === 'secret_kite') {
      for (let i = 0; i < 7; i++)
        add(0, 0.025, (i - 3) * 0.08, 0.55 - Math.abs(i - 3) * 0.12, 0.05, 0.08, i < 3 ? P.red : P.gold);
      add(0.32, 0.06, 0.3, 0.13, 0.12, 0.13, P.wood);
    } else if (sub === 'secret_tea') {
      add(0, 0.04, 0, 0.65, 0.08, 0.65, P.wood);
      for (const x of [-0.18, 0.18]) {
        add(x, 0.15, 0, 0.15, 0.15, 0.15, P.teal);
        add(x, 0.23, 0, 0.1, 0.015, 0.1, P.bark);
      }
    } else {
      add(0, 0.13, 0, 0.55, 0.26, 0.55, sub === 'secret_crown' ? P.bark : P.stone);
      if (sub === 'secret_ladle') {
        add(0, 0.63, 0, 0.05, 0.8, 0.05, P.stone);
        add(0, 1.04, 0, 0.19, 0.06, 0.19, P.pale);
      } else if (sub === 'secret_fish') {
        add(0, 0.4, 0, 0.43, 0.2, 0.17, P.gold);
        add(-0.27, 0.4, 0, 0.12, 0.3, 0.08, P.gold);
      } else {
        add(0, 0.31, 0, 0.28, 0.12, 0.28, P.gold);
        for (const x of [-0.11, 0.11]) for (const z of [-0.11, 0.11]) add(x, 0.44, z, 0.06, 0.14, 0.06, P.gold);
      }
    }
  } else if (sub.startsWith('scaffold:')) {
    const stage = Number(sub.split(':')[1]) || 0;
    for (const x of [-0.7, 0.7]) for (const z of [-0.7, 0.7]) add(x, 1, z, 0.1, 2, 0.1, P.timber);
    for (let i = 0; i <= stage; i++) add(0, 0.3 + i * 0.4, 0, 1.6, 0.08, 1.6, P.wood);
    for (let i = 0; i < stage + 1; i++) add(-0.4, 0.15 + i * 0.27, 0, 0.5, 0.25, 0.9, P.stone);
  } else if (sub.startsWith('monument:')) {
    add(0, 0.1, 0, 1.7, 0.2, 1.7, P.stone);
    add(0, 0.35, 0, 1.25, 0.3, 1.25, P.pale);
    if (/market/.test(sub)) {
      add(0, 1, 0, 0.12, 1, 0.12, P.gold);
      add(0, 1.5, 0, 1.1, 0.1, 0.1, P.gold);
    } else if (/walls/.test(sub)) {
      add(0, 1, 0, 0.8, 1, 0.8, P.stone);
      for (const x of [-0.3, 0.3]) for (const z of [-0.3, 0.3]) add(x, 1.65, z, 0.2, 0.3, 0.2, P.stone);
    } else {
      add(0, 1, 0, 0.4, 1, 0.4, P.gold);
      add(0, 1.65, 0, 0.2, 0.3, 0.2, P.gold);
    }
  } else if (/bunting/.test(sub)) {
    for (const x of [-1, 1]) add(x, 1, 0, 0.08, 2, 0.08, P.timber);
    add(0, 1.8, 0, 2, 0.03, 0.03, P.pale);
    for (let i = 0; i < 7; i++) add((i - 3) * 0.27, 1.65, 0, 0.16, 0.25, 0.05, i % 2 ? P.gold : P.teal);
  } else if (/table|counter|desk|workbench|carpenter|loom|station/.test(sub)) {
    legs();
    for (let i = 0; i < 5; i++) add((i - 2) * 0.19, 0.62, 0, 0.18, 0.1, 0.85, P.wood);
    if (/table|desk/.test(sub)) {
      add(0, 0.68, 0, 0.45, 0.025, 0.7, P.teal);
      add(-0.23, 0.73, -0.2, 0.14, 0.09, 0.18, P.pale);
      add(0.21, 0.72, 0.19, 0.13, 0.06, 0.12, P.gold);
    }
  } else if (/chair|stool|bench|throne/.test(sub)) {
    legs(0.45, 0.45, 0.4);
    add(0, 0.44, 0, 0.6, 0.1, 0.58, P.wood);
    if (!/stool/.test(sub)) {
      add(0, 0.8, -0.23, 0.62, 0.65, 0.09, P.timber);
      add(0, 0.78, -0.17, 0.45, 0.35, 0.05, P.teal);
    }
  } else if (/bed|cot/.test(sub)) {
    legs(0.7, 0.8, 0.25);
    add(0, 0.29, 0, 0.9, 0.15, 1.15, P.wood);
    add(0, 0.41, 0, 0.84, 0.17, 1.08, P.pale);
    add(0, 0.52, 0.12, 0.85, 0.09, 0.75, P.teal);
    add(0, 0.55, -0.36, 0.55, 0.12, 0.24, 0xe2dac0);
    add(0, 0.56, -0.56, 0.94, 0.75, 0.1, P.timber);
    for (const x of [-0.44, 0.44]) add(x, 0.65, -0.55, 0.12, 0.98, 0.12, P.cutwood);
  } else if (/book|shelf|cabinet|cupboard/.test(sub)) {
    add(0, 0.7, -0.3, 0.9, 1.4, 0.08, P.timber);
    for (const x of [-0.45, 0.45]) add(x, 0.7, 0, 0.1, 1.4, 0.65, P.wood);
    for (let j = 0; j < 4; j++) {
      add(0, 0.08 + j * 0.43, 0, 0.92, 0.07, 0.65, P.cutwood);
      for (let i = 0; i < 6; i++)
        add(
          (i - 2.5) * 0.12,
          0.25 + j * 0.4,
          -0.05,
          0.1,
          0.24 + variation(i + j) * 0.1,
          0.36,
          [P.teal, P.red, P.gold, P.pale, P.leaf, P.roof][(i + j) % 6],
        );
    }
  } else if (/chest|cache|crate|box|treasure/.test(sub)) {
    add(0, 0.28, 0, 0.78, 0.55, 0.62, P.wood);
    add(0, 0.59, 0, 0.76, 0.12, 0.61, P.cutwood);
    for (const x of [-0.26, 0.26]) add(x, 0.34, 0, 0.065, 0.65, 0.65, P.iron);
    add(0, 0.37, 0.33, 0.13, 0.15, 0.055, P.gold);
  } else if (/barrel|cask|vat|bucket|planter|pot/.test(sub)) {
    for (let j = 0; j < 5; j++) {
      const w = 0.48 + (j === 0 || j === 4 ? 0 : 0.12);
      add(0, 0.08 + j * 0.14, 0, w, 0.14, w, P.wood);
    }
    for (const y of [0.15, 0.55]) add(0, y, 0, 0.64, 0.055, 0.64, P.iron);
    if (/plant|pot/.test(sub)) out.push(...placeBoxes(plantModel('flower', seed), 0, 0.72, 0));
  } else if (/rug|blanket|carpet|banner|tapestry/.test(sub)) {
    const hanging = /banner|tapestry/.test(sub);
    add(0, hanging ? 1 : 0.025, 0, 0.78, hanging ? 1.5 : 0.035, hanging ? 0.045 : 0.95, P.teal);
    if (hanging) add(0, 1.8, 0, 0.95, 0.07, 0.08, P.gold);
    else for (const x of [-0.33, 0.33]) add(x, 0.048, 0, 0.045, 0.015, 0.9, P.gold);
  } else if (/lamp|lantern|torch|brazier|candle|campfire|hearth|forge|furnace|kiln/.test(sub)) {
    const fire = /hearth|forge|furnace|kiln/.test(sub),
      post = /lamp|torch/.test(sub);
    add(0, fire ? 0.4 : 0.08, 0, fire ? 0.9 : 0.38, fire ? 0.8 : 0.16, fire ? 0.8 : 0.38, P.mortar);
    if (post) add(0, 0.7, 0, 0.1, 1.4, 0.1, P.timber);
    const y = post ? 1.5 : fire ? 0.5 : 0.24;
    add(0, y, 0, 0.24, 0.3, 0.24, P.flame);
    add(0, y + 0.2, 0, 0.12, 0.15, 0.12, P.gold);
    if (fire) {
      add(0, 1, -0.3, 0.8, 1.2, 0.2, P.stone);
      add(0, 1.65, -0.3, 0.9, 0.15, 0.3, P.mortar);
    }
  } else if (/well|fountain/.test(sub)) {
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      add(Math.cos(angle) * 0.44, 0.3, Math.sin(angle) * 0.44, i % 2 ? 1 : 0.18, 0.6, i % 2 ? 0.18 : 1, P.stone);
    }
    add(0, 0.18, 0, 0.7, 0.05, 0.7, P.teal);
    for (const x of [-0.48, 0.48]) add(x, 0.95, 0, 0.1, 1.7, 0.1, P.timber);
    for (let i = 0; i < 5; i++) add((i - 2) * 0.24, 1.9 - Math.abs(i - 2) * 0.12, 0, 0.25, 0.12, 1.2, P.roof);
  } else if (/board|sign|notice/.test(sub)) {
    for (const x of [-0.34, 0.34]) add(x, 0.7, 0, 0.09, 1.4, 0.09, P.timber);
    add(0, 1.05, 0, 0.94, 0.65, 0.13, P.wood);
    add(0, 1.06, 0.075, 0.53, 0.43, 0.035, P.pale);
    add(0, 1.42, 0, 1.05, 0.1, 0.3, P.roof);
  } else if (/anvil|smith/.test(sub)) {
    add(0, 0.2, 0, 0.5, 0.4, 0.5, P.bark);
    add(0, 0.55, 0, 0.35, 0.3, 0.3, P.iron);
    add(0, 0.73, 0, 0.8, 0.17, 0.34, P.stone);
    add(0.46, 0.73, 0, 0.25, 0.09, 0.18, P.iron);
  } else if (/stairs|ladder|lift/.test(sub)) {
    for (let i = 0; i < 7; i++) add(0, i * 0.12 + 0.06, (i - 3) * 0.13, 0.85, 0.12, 0.15, P.cutwood);
    for (const x of [-0.4, 0.4]) add(x, 0.45, 0, 0.08, 0.9, 0.95, P.timber);
  } else if (/gate|portal|arch|mouth|return/.test(sub)) {
    for (const x of [-0.65, 0.65]) {
      add(x, 0.9, 0, 0.32, 1.8, 0.35, P.stone);
      add(x, 1.85, 0, 0.45, 0.16, 0.45, P.gold);
    }
    add(0, 2, 0, 1.5, 0.2, 0.38, P.stone);
    for (let i = 0; i < 5; i++) add((i - 2) * 0.23, 1.8, 0, 0.09, 0.12, 0.12, P.glow);
  } else if (/crystal|geode|pylon|obelisk|monolith|waystone|statue|altar|shrine/.test(sub)) {
    add(0, 0.1, 0, 0.95, 0.2, 0.95, P.mortar);
    add(0, 0.3, 0, 0.68, 0.2, 0.68, P.stone);
    for (let i = 0; i < 5; i++) add(0, 0.5 + i * 0.25, 0, 0.42 - i * 0.055, 0.25, 0.42 - i * 0.055, P.stone);
    add(0, 1.22, 0.24, 0.15, 0.32, 0.06, P.glow);
    add(0, 1.85, 0, 0.22, 0.15, 0.22, P.glow);
  } else if (/hedge/.test(sub)) {
    add(0, 0.25, 0, 0.9, 0.5, 0.55, P.darkleaf);
    add(0, 0.53, 0, 0.85, 0.15, 0.5, P.leaf);
  } else if (/fallen_star/.test(sub)) {
    add(0, 0.12, 0, 0.45, 0.24, 0.45, P.glow);
    add(0, 0.12, 0, 0.16, 0.4, 0.16, P.gold);
    add(0, 0.12, 0, 0.7, 0.1, 0.1, P.glow);
    add(0, 0.12, 0, 0.1, 0.1, 0.7, P.glow);
  } else if (/flower|bloom|bush|herb|fern|reed|cap|mushroom|coral|kelp|moss/.test(sub)) {
    out.push(...plantModel(sub, seed, /glow|coral/.test(sub) ? P.glow : 0xd69bad));
  } else if (/tree|orchard/.test(sub)) out.push(...treeModel(seed, 'forest', 1));
  else if (/stone|rock|ore|scree|stalagmite/.test(sub)) out.push(...rockModel(seed, sub));
  else if (/fence|rail/.test(sub)) {
    for (const x of [-0.43, 0.43]) add(x, 0.4, 0, 0.1, 0.8, 0.1, P.bark);
    for (const y of [0.25, 0.6]) add(0, y, 0, 0.95, 0.08, 0.08, P.wood);
  } else
    return {
      boxes: [B(0, 0.26, 0, 0.6, 0.52, 0.6, P.wood), B(0, 0.56, 0, 0.68, 0.08, 0.68, P.cutwood)],
      authored: false,
    };
  return { boxes: out, authored: true };
}

export function objectModel(o: WorldObj, seed: number): { boxes: VoxelBox[]; authored: boolean } {
  if (o.sub === 'mailbox') return furnitureModel('noticeboard', seed);
  if (['festival_stage', 'ferris_wheel'].includes(o.sub)) return furnitureModel('festival_stage', seed);
  if (['archery_booth', 'carousel'].includes(o.sub)) return furnitureModel('archery_booth', seed);
  if (/^(secret_|scaffold:|monument:|bunting)/.test(o.sub)) return furnitureModel(o.sub, seed);
  if (o.kind === 'crop') {
    const def = CROPS[o.sub],
      data = o.data as unknown as CropData;
    const stage = def && data ? cropStage(data) : 0;
    const color = def ? Number.parseInt(PALETTE[def.color].slice(1), 16) : P.gold;
    return { boxes: plantModel(o.sub, seed, o.data?.dead ? P.bark : color, stage), authored: true };
  }
  const original = originalObjectModel(o);
  if (original.length > 0) return { boxes: original, authored: true };
  return furnitureModel(o.sub, seed);
}
