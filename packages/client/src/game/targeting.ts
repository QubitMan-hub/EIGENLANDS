import {
  CROPS, ITEMS, NODES, TILE_DEFS, T, TIER_NAMES, cropStage, STATION_NAMES, STATION_SUBS, isRipe, type CropData, type Stack, type WorldObj,
} from '@eigenlands/shared';

export type UseKind = 'talk' | 'open' | 'harvest' | 'tool' | 'plant' | 'water' | 'till' | 'cast' | 'net' | 'forage' | 'place' | 'eat' | 'fertilize' | 'none';
export interface UseInfo { kind: UseKind; label: string; ok: boolean }

const WATER_TILES: number[] = [T.WATER, T.DEEP_WATER];

/** What would "Use" do on this tile with the selected item? Drives the on-screen prompt and client-side routing. */
export function describeUse(sel: Stack | null, tile: number, obj: WorldObj | undefined, season: number): UseInfo | null {
  const def = sel ? ITEMS[sel.id] : undefined;
  if (obj) {
    if (obj.kind === 'crop') {
      const d = obj.data as unknown as CropData | undefined;
      if (d && isRipe(d)) return { kind: 'harvest', label: `Harvest ${CROPS[d.crop]?.name ?? 'crop'}${d.alt ? ' (collapses to one!)' : ''}`, ok: true };
      if (d?.dead) return { kind: 'tool', label: 'Withered crop (uproot with a hoe)', ok: def?.tool?.type === 'hoe' };
      if (def?.tool?.type === 'can') return { kind: 'water', label: 'Water the crop', ok: true };
      if (def?.kind === 'fertilizer') return { kind: 'fertilize', label: `Apply ${def.name}`, ok: true };
      return { kind: 'none', label: d ? `${CROPS[d.crop]?.name ?? 'Crop'}: stage ${cropStage(d) + 1}/4` : 'Crop', ok: false };
    }
    if (obj.kind === 'station') return { kind: 'open', label: `Use ${STATION_NAMES[STATION_SUBS[obj.sub] ?? 'hand']}`, ok: true };
    if (obj.kind === 'chest') return { kind: 'open', label: 'Open chest', ok: true };
    if (obj.kind === 'shelter') return { kind: 'open', label: obj.sub === 'coop' ? 'Visit the coop' : 'Visit the barn', ok: true };
    if (obj.kind === 'sign') return { kind: 'open', label: 'Read sign', ok: true };
    return null;
  }
  const td = TILE_DEFS[tile];
  const node = NODES[tile];
  if (tile === T.FORAGE) return { kind: 'forage', label: 'Forage', ok: true };
  if (node && node.tool) {
    const tier = sel?.p?.tier ?? 1;
    if (def?.tool?.type === node.tool) {
      return tier >= node.minTier
        ? { kind: 'tool', label: `${node.tool === 'axe' ? 'Chop' : 'Mine'} ${node.label}`, ok: true }
        : { kind: 'tool', label: `${node.label} needs a ${TIER_NAMES[node.minTier - 1] ?? 'better'} ${node.tool}`, ok: false };
    }
    return { kind: 'none', label: `${node.label}: use a ${node.tool}`, ok: false };
  }
  if (!def) return null;
  if (def.tool?.type === 'hoe' && (tile === T.GRASS || tile === T.GRASS_TALL || tile === T.FLOWERS || tile === T.STUMP)) return { kind: 'till', label: 'Till soil', ok: true };
  if (def.tool?.type === 'can' && (tile === T.TILLED || tile === T.TILLED_WET)) return { kind: 'water', label: 'Water the soil', ok: tile === T.TILLED };
  if (def.kind === 'seed' && (tile === T.TILLED || tile === T.TILLED_WET)) return { kind: 'plant', label: `Plant ${def.name.replace(' Seed', '')}`, ok: true };
  if (def.tool?.type === 'rod' && WATER_TILES.includes(tile)) return { kind: 'cast', label: 'Cast your line', ok: true };
  if (def.tool?.type === 'net' && (tile === T.FLOWERS || tile === T.GRASS_TALL)) return { kind: 'net', label: 'Sweep for bugs', ok: true };
  if (def.kind === 'placeable' && !td?.solid && !WATER_TILES.includes(tile)) return { kind: 'place', label: `Place ${def.name}`, ok: true };
  if ((def.kind === 'food' || def.kind === 'potion' || def.kind === 'crop' || def.kind === 'forage' || def.kind === 'fish') && def.heal) return { kind: 'eat', label: `${def.kind === 'potion' ? 'Drink' : 'Eat'} ${def.name}`, ok: true };
  void season;
  return null;
}

/** Tile to act on: the cursor tile if the mouse is active and within reach, otherwise the tile in front. */
export function targetTile(px: number, py: number, fx: number, fy: number, mouse: { tx: number; ty: number } | null, reach = 2.4): { tx: number; ty: number } {
  if (mouse && Math.hypot(mouse.tx + 0.5 - px, mouse.ty + 0.5 - py) <= reach) return { tx: mouse.tx, ty: mouse.ty };
  const l = Math.hypot(fx, fy) || 1;
  return { tx: Math.floor(px + (fx / l) * 0.9), ty: Math.floor(py + (fy / l) * 0.9 + 0.2) };
}
