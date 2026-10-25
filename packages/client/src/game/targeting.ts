import {
  CROPS,
  ITEMS,
  NODES,
  TILE_DEFS,
  T,
  TIER_NAMES,
  cropStage,
  isSolid,
  STATION_NAMES,
  STATION_SUBS,
  isRipe,
  type CropData,
  type Stack,
  type WorldObj,
  RUIN_NAMES,
  BUILD_PIECES,
  isBuildPiece,
  type BuildCell,
} from '@eigenlands/shared';

export type UseKind =
  | 'talk'
  | 'open'
  | 'harvest'
  | 'tool'
  | 'plant'
  | 'water'
  | 'till'
  | 'cast'
  | 'net'
  | 'forage'
  | 'place'
  | 'eat'
  | 'refill'
  | 'fertilize'
  | 'none';
export interface UseInfo {
  kind: UseKind;
  label: string;
  ok: boolean;
}

const WATER_TILES: number[] = [T.WATER, T.DEEP_WATER];

/** What would "Use" do on this tile with the selected item? Drives the on-screen prompt and client-side routing. */
export function describeUse(
  sel: Stack | null,
  tile: number,
  obj: WorldObj | undefined,
  season: number,
  cell?: BuildCell,
): UseInfo | null {
  const def = sel ? ITEMS[sel.id] : undefined;
  if (sel?.id === 'waterskin_full') return { kind: 'eat', label: 'Drink clean water (+35 water)', ok: true };
  if (sel?.id === 'waterskin_empty')
    return {
      kind: obj?.sub === 'well' ? 'refill' : 'none',
      label: obj?.sub === 'well' ? 'Fill waterskin with clean water' : 'Fill at a town well',
      ok: obj?.sub === 'well',
    };
  if (cell && def?.tool?.type === 'pickaxe')
    return {
      kind: 'tool',
      label: `Reclaim ${cell.data.roof ? BUILD_PIECES[cell.data.roof].name : cell.data.wall ? BUILD_PIECES[cell.data.wall].name : cell.data.stairs ? 'stairs (return downstairs first)' : 'foundation (clear it first)'}`,
      ok: true,
    };
  if (sel && isBuildPiece(sel.id)) {
    const piece = BUILD_PIECES[sel.id],
      used = cell?.data[piece.layer];
    return {
      kind: 'place',
      label: used
        ? 'Reclaim the existing piece first'
        : piece.layer !== 'floor' && !cell?.data.floor
          ? 'Lay your own floor first'
          : `Build ${piece.name}`,
      ok: !used && (piece.layer === 'floor' ? !isSolid(tile) || tile === T.UPPER_VOID : !!cell?.data.floor),
    };
  }
  if (cell?.data.stairs)
    return { kind: 'open', label: cell.data.stairs === 'up' ? 'Climb to upper floor' : 'Return downstairs', ok: true };
  if (cell?.data.wall === 'timber_door')
    return { kind: 'open', label: cell.data.open ? 'Close door (owner only)' : 'Open door (owner only)', ok: true };
  if (obj) {
    if (obj.sub === 'minecart')
      return {
        kind: 'open',
        label: 'Ride the minecart · push along the rails to roll, against them to reverse',
        ok: true,
      };
    if (obj.sub === 'ruin_cache' && (obj.data as { vault?: string } | undefined)?.vault)
      return { kind: 'open', label: 'Open the vault chest (its guardians wake)', ok: true };
    if (obj.sub === 'merchant_cart') return { kind: 'open', label: 'A travelling merchant works this cart', ok: false };
    if (obj.sub === 'campfire' || obj.sub === 'delver_tent')
      return { kind: 'open', label: obj.sub === 'campfire' ? 'Delver camp fire' : 'Delver tent', ok: false };
    if (obj.sub === 'stairs_up' || obj.sub === 'stairs_down')
      return { kind: 'open', label: obj.sub === 'stairs_up' ? 'Climb to upper floor' : 'Return downstairs', ok: true };
    if (obj.sub === 'dive_gate' || obj.sub === 'dive_exit')
      return {
        kind: 'open',
        label: obj.sub === 'dive_gate' ? 'Dive into the submerged sanctuary' : 'Return to your sloop',
        ok: true,
      };
    if (obj.kind === 'crop') {
      const d = obj.data as unknown as CropData | undefined;
      if (d && isRipe(d))
        return {
          kind: 'harvest',
          label: `Harvest ${CROPS[d.crop]?.name ?? 'crop'}${d.alt ? ' (collapses to one!)' : ''}`,
          ok: true,
        };
      if (d?.dead) return { kind: 'tool', label: 'Withered crop (uproot with a hoe)', ok: def?.tool?.type === 'hoe' };
      if (def?.tool?.type === 'can') return { kind: 'water', label: 'Water the crop', ok: true };
      if (def?.kind === 'fertilizer') return { kind: 'fertilize', label: `Apply ${def.name}`, ok: true };
      return {
        kind: 'none',
        label: d ? `${CROPS[d.crop]?.name ?? 'Crop'}: stage ${cropStage(d) + 1}/4` : 'Crop',
        ok: false,
      };
    }
    if (obj.kind === 'station')
      return { kind: 'open', label: `Use ${STATION_NAMES[STATION_SUBS[obj.sub] ?? 'hand']}`, ok: true };
    if (obj.kind === 'chest') return { kind: 'open', label: 'Open chest', ok: true };
    if (obj.kind === 'shelter')
      return { kind: 'open', label: obj.sub === 'coop' ? 'Visit the coop' : 'Visit the barn', ok: true };
    if (obj.sub === 'statue' || obj.sub === 'plaque')
      return { kind: 'open', label: 'Read the Statue of QubitMan', ok: true };
    if (obj.sub === 'board') return { kind: 'open', label: 'Check the request board', ok: true };
    if (obj.sub === 'ruin_cache') return { kind: 'open', label: 'Search the forgotten cache', ok: true };
    if (obj.sub === 'cave_mouth') return { kind: 'open', label: 'Climb down into the Undercroft', ok: true };
    if (obj.sub === 'cave_altar') return { kind: 'open', label: 'Invoke the Hollow Bellkeeper · Deep Sigil', ok: true };
    if (obj.sub === 'cave_lift') return { kind: 'open', label: 'Take the supply lift to daylight', ok: true };
    if (obj.sub === 'cave_ladder') return { kind: 'open', label: 'Climb the ladder to daylight', ok: true };
    if (RUIN_NAMES[obj.sub]) return { kind: 'open', label: `Read the ${RUIN_NAMES[obj.sub]!.toLowerCase()}`, ok: true };
    if (obj.kind === 'sign') return { kind: 'open', label: 'Read sign', ok: true };
    return null;
  }
  const td = TILE_DEFS[tile];
  const node = NODES[tile];
  if (tile === T.FORAGE) return { kind: 'forage', label: 'Forage', ok: true };
  if (tile === T.GRASS_TALL && def?.tool?.type === 'axe')
    return { kind: 'tool', label: 'Cut tall grass (fiber)', ok: true };
  if (node && node.tool) {
    const tier = sel?.p?.tier ?? 1;
    if (def?.tool?.type === node.tool) {
      return tier >= node.minTier
        ? { kind: 'tool', label: `${node.tool === 'axe' ? 'Chop' : 'Mine'} ${node.label}`, ok: true }
        : {
            kind: 'tool',
            label: `${node.label} needs a ${TIER_NAMES[node.minTier - 1] ?? 'better'} ${node.tool}`,
            ok: false,
          };
    }
    return { kind: 'none', label: `${node.label}: use a ${node.tool}`, ok: false };
  }
  if (!def) return null;
  if (def.tool?.type === 'hoe' && (tile === T.GRASS || tile === T.GRASS_TALL || tile === T.FLOWERS || tile === T.STUMP))
    return { kind: 'till', label: 'Till soil', ok: true };
  if (def.tool?.type === 'can' && (tile === T.TILLED || tile === T.TILLED_WET))
    return { kind: 'water', label: 'Water the soil', ok: tile === T.TILLED };
  if (def.kind === 'seed' && (tile === T.TILLED || tile === T.TILLED_WET))
    return { kind: 'plant', label: `Plant ${def.name.replace(' Seed', '')}`, ok: true };
  if (def.tool?.type === 'rod' && WATER_TILES.includes(tile))
    return { kind: 'cast', label: 'Cast your line', ok: true };
  if (def.tool?.type === 'net' && (tile === T.FLOWERS || tile === T.GRASS_TALL))
    return { kind: 'net', label: 'Sweep for bugs', ok: true };
  if (def.kind === 'placeable' && !td?.solid && !WATER_TILES.includes(tile))
    return { kind: 'place', label: `Place ${def.name}`, ok: true };
  if (
    (def.kind === 'food' ||
      def.kind === 'potion' ||
      def.kind === 'crop' ||
      def.kind === 'forage' ||
      def.kind === 'fish') &&
    def.heal
  )
    return { kind: 'eat', label: `${def.kind === 'potion' ? 'Drink' : 'Eat'} ${def.name}`, ok: true };
  void season;
  return null;
}

/** Tile to act on: the cursor tile if the mouse is active and within reach, otherwise the tile in front. */
export function targetTile(
  px: number,
  py: number,
  fx: number,
  fy: number,
  mouse: { tx: number; ty: number } | null,
  reach = 2.4,
): { tx: number; ty: number } {
  if (mouse && Math.hypot(mouse.tx + 0.5 - px, mouse.ty + 0.5 - py) <= reach) return { tx: mouse.tx, ty: mouse.ty };
  const l = Math.hypot(fx, fy) || 1;
  return { tx: Math.floor(px + (fx / l) * 0.9), ty: Math.floor(py + (fy / l) * 0.9 + 0.2) };
}

/** Shore fishing works without a precise cursor tile; an intentional water aim still wins. */
export function fishingTarget(
  px: number,
  py: number,
  getTile: (x: number, y: number) => number,
  mouse: { tx: number; ty: number } | null,
): { tx: number; ty: number } | null {
  const water = (x: number, y: number) => WATER_TILES.includes(getTile(x, y));
  if (mouse && Math.hypot(mouse.tx + 0.5 - px, mouse.ty + 0.5 - py) <= 5 && water(mouse.tx, mouse.ty)) return mouse;
  let best: { tx: number; ty: number } | null = null,
    dist = 3.5;
  for (let ty = Math.floor(py) - 3; ty <= Math.floor(py) + 3; ty++)
    for (let tx = Math.floor(px) - 3; tx <= Math.floor(px) + 3; tx++) {
      const d = Math.hypot(tx + 0.5 - px, ty + 0.5 - py);
      if (d < dist && water(tx, ty)) {
        best = { tx, ty };
        dist = d;
      }
    }
  return best;
}
