import {
  BUILD_PIECES,
  isDoor,
  isCivOwner,
  BUILD_WORLD_LIMIT,
  BUILD_REACH,
  BUILD_DRAG_REACH,
  BUILD_BATCH_MAX,
  UPPER_OY,
  T,
  buildSolid,
  chunkOf,
  isBuildPiece,
  isUpperY,
  townsNear,
  type BuildCell,
  type BuildData,
  type BuildPiece,
  type BuildTurn,
  type UseMsg,
} from '@eigenlands/shared';
import type { RoomApi } from './api';
import type { ServerPlayer } from '../rooms/player';
import { distToTile, giveStacks } from './helpers';

const pending = new WeakSet<ServerPlayer>();
const LAND: number[] = [T.GRASS, T.GRASS_TALL, T.FLOWERS, T.SAND, T.PATH, T.STUMP, T.TILLED, T.TILLED_WET];
const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const baseY = (y: number) => (isUpperY(y) ? y - UPPER_OY : y);
const occupied = (room: RoomApi, x: number, y: number) =>
  [...[...room.players.values()].map((p) => p.sim), ...room.state.enemies.values()].some(
    (e) => Math.hypot(e.x - x - 0.5, e.y - y - 0.5) < 0.8,
  );
const protectedAt = (room: RoomApi, x: number, y: number) =>
  Math.hypot(x, baseY(y)) < 12 ||
  townsNear(room.seed, x - 2, y - 2, x + 2, y + 2).some(
    (t) => x >= t.x0 - 2 && x <= t.x1 + 2 && y >= t.y0 - 2 && y <= t.y1 + 2,
  ) ||
  !!room.store.objectAt(x, y)?.static;

/** Can every upstairs occupant still reach a down stair after this edit? Unknown/huge components fail closed. */
function safeUpperEdit(room: RoomApi, x: number, y: number, next: BuildData | undefined): boolean {
  if (!isUpperY(y)) return true;
  const dataAt = (tx: number, ty: number) => (tx === x && ty === y ? next : room.store.structureAt(tx, ty)?.data);
  for (const p of room.players.values()) {
    const sx = Math.floor(p.sim.x),
      sy = Math.floor(p.sim.y);
    if (!isUpperY(sy)) continue;
    // Only a connected built floor can be affected; authored floors are independent.
    if (!room.store.structureAt(sx, sy)?.data.floor) continue;
    const queue: Array<[number, number]> = [[sx, sy]],
      seen = new Set<string>();
    let exit = false;
    for (let i = 0; i < queue.length && seen.size < 4096; i++) {
      const [tx, ty] = queue[i]!,
        k = `${tx},${ty}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const d = dataAt(tx, ty);
      if (!d?.floor || buildSolid(d) || (room.store.objectAt(tx, ty) && room.store.solidAt(tx, ty))) continue;
      if (d.stairs === 'down') {
        exit = true;
        break;
      }
      for (const [dx, dy] of DIRECTIONS) if (!seen.has(`${tx + dx},${ty + dy}`)) queue.push([tx + dx, ty + dy]);
    }
    if (!exit) return false;
  }
  return true;
}

/** Load the chunks a placement at (x, y) reads: its neighbours on both floors. */
async function loadAround(room: RoomApi, tiles: Array<[number, number]>): Promise<void> {
  const chunks = new Set<string>();
  for (const [x, y] of tiles) {
    const by = baseY(y);
    for (const yy of [y, isUpperY(y) ? by : by + UPPER_OY])
      for (const [dx, dy] of [[0, 0], ...DIRECTIONS]) chunks.add(`${chunkOf(x + dx!)},${chunkOf(yy + dy!)}`);
  }
  await Promise.all(
    [...chunks].map((k) => {
      const [cx, cy] = k.split(',').map(Number);
      return room.ensureChunk(cx!, cy!);
    }),
  );
}

/**
 * Lay one building piece from the stack in `slot` at (x, y): every ownership, land, support and safety rule. Returns
 * null when it was built, or the reason it was not (the caller decides whether to say it).
 */
function placeOne(
  room: RoomApi,
  p: ServerPlayer,
  slot: number,
  id: BuildPiece,
  x: number,
  y: number,
  rawTurn: number | undefined,
  reach: number,
): string | null {
  const upper = isUpperY(y),
    by = baseY(y);
  if (p.deadT > 0 || p.data.inv[slot]?.id !== id) return 'You have run out of that piece.';
  if (distToTile(p, x, y) > reach) return 'Too far away.';
  const old = room.store.structureAt(x, y);
  if (old && old.owner !== p.accountId) return 'This building belongs to another player.';
  if (rawTurn !== undefined && (!Number.isInteger(rawTurn) || rawTurn < 0 || rawTurn > 3)) return 'Bad turn.';
  if (
    Math.abs(x) > BUILD_WORLD_LIMIT ||
    Math.abs(by) > BUILD_WORLD_LIMIT ||
    protectedAt(room, x, y) ||
    protectedAt(room, x, by)
  )
    return 'Build on clear wilderness land within 10,000 tiles of the crossroads. Towns and landmarks are protected.';
  for (const [dx, dy] of DIRECTIONS) {
    const near = room.store.structureAt(x + dx, y + dy);
    if (near && near.owner !== p.accountId) return 'Leave a tile of space around another player’s building.';
  }
  const piece = BUILD_PIECES[id],
    d: BuildData = { ...old?.data },
    turn = (rawTurn ?? 0) as BuildTurn,
    obj = room.store.objectAt(x, y);
  if (obj && (obj.static || obj.owner !== p.accountId)) return 'Clear this space first.';
  if (d[piece.layer]) return 'Remove the existing piece with a pickaxe first.';
  if (piece.layer === 'floor') {
    if (upper) {
      const below = room.store.structureAt(x, by);
      if (below?.owner !== p.accountId || !below.data.floor)
        return 'An upper floor needs your foundation directly below.';
      if (
        !DIRECTIONS.some(
          ([dx, dy]) =>
            room.store.structureAt(x + dx, y + dy)?.owner === p.accountId &&
            room.store.structureAt(x + dx, y + dy)?.data.floor,
        )
      )
        return 'Extend an existing upper landing first.';
    } else if (!LAND.includes(room.store.getTile(x, y))) return 'Clear trees and rocks before laying a foundation.';
    else {
      // foundations need level ground: every neighbouring tile must sit at the same elevation
      const level = room.store.levelAt(x, y);
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++)
          if (room.store.levelAt(x + ox, y + oy) !== level)
            return 'This ground slopes too much for a foundation. Find a level clearing.';
    }
    d.floor = id as BuildData['floor'];
  } else {
    if (!d.floor) return 'Lay your own floor here first.';
    if (piece.layer === 'wall') {
      if (d.stairs || obj || occupied(room, x, y)) return 'The wall or doorway needs a clear tile.';
      d.wall = id as BuildData['wall'];
      d.wallTurn = turn;
      d.open = false;
      if (!safeUpperEdit(room, x, y, d)) return 'That wall would block someone’s stairs.';
    } else if (piece.layer === 'roof') {
      d.roof = id as BuildData['roof'];
      d.roofTurn = turn;
    } else {
      if (upper || d.wall || obj) return 'Stairs start on an empty ground-floor foundation.';
      const uy = y + UPPER_OY,
        landing = room.store.structureAt(x, uy);
      if (landing || room.store.objectAt(x, uy) || protectedAt(room, x, uy) || occupied(room, x, uy))
        return 'The upper landing is occupied.';
      d.stairs = 'up';
      d.stairsTurn = turn;
      room.objects.put({
        x,
        y: uy,
        kind: 'structure',
        sub: 'cell',
        owner: p.accountId,
        data: { floor: 'timber_floor', stairs: 'down', stairsTurn: turn },
      });
    }
  }
  room.objects.put({ x, y, kind: 'structure', sub: 'cell', owner: p.accountId, data: d });
  const stack = p.data.inv[slot]!;
  if (--stack.n <= 0) p.data.inv[slot] = null;
  p.dirty('inv');
  room.fx({ kind: 'place', x: x + 0.5, y: y + 0.5, id: p.id });
  return null;
}

/** Runs before ordinary object/tool dispatch, so the structure and furnishing layers stay independent. */
export async function useConstruction(
  room: RoomApi,
  p: ServerPlayer,
  msg: UseMsg,
  id: string,
  pickaxe: boolean,
): Promise<boolean> {
  if (!isBuildPiece(id) && !(pickaxe && room.store.structureAt(msg.tx, msg.ty))) return false;
  if (pending.has(p)) return true;
  pending.add(p);
  try {
    const { tx: x, ty: y } = msg;
    await loadAround(room, [[x, y]]);
    if (p.deadT > 0 || distToTile(p, x, y) > BUILD_REACH || p.data.inv[msg.slot]?.id !== id) return true;
    if (pickaxe) {
      const old = room.store.structureAt(x, y);
      if (old && old.owner !== p.accountId) p.toast('This building belongs to another player.');
      else if (old) removePiece(room, p, old);
      return true;
    }
    if (!isBuildPiece(id)) return true;
    const why = placeOne(room, p, msg.slot, id, x, y, msg.turn, BUILD_REACH);
    if (why && why !== 'Bad turn.') p.toast(why);
  } finally {
    pending.delete(p);
  }
  return true;
}

/**
 * A dragged run of one building piece (see shared buildPlan): each tile keeps every rule of a single placement and
 * takes one piece from the stack, within a builder's reach; the builder hears one summary, not a message per tile.
 */
export async function useConstructionArea(room: RoomApi, p: ServerPlayer, msg: UseMsg, id: BuildPiece): Promise<void> {
  const area = msg.area;
  if (!Array.isArray(area) || !area.length || area.length > BUILD_BATCH_MAX) return;
  const tiles: Array<[number, number, number]> = [];
  for (const t of area) {
    if (!Array.isArray(t) || t.length !== 3 || !t.every((v) => Number.isInteger(v) && Math.abs(v) < 1e6)) return;
    tiles.push([t[0]!, t[1]!, t[2]!]);
  }
  if (pending.has(p)) return;
  pending.add(p);
  try {
    await loadAround(
      room,
      tiles.map(([x, y]) => [x, y] as [number, number]),
    );
    let built = 0;
    const reasons = new Map<string, number>();
    for (let i = 0; i < tiles.length; i++) {
      if (p.data.inv[msg.slot]?.id !== id) {
        reasons.set('You ran out of pieces.', tiles.length - i);
        break;
      }
      const [x, y, turn] = tiles[i]!;
      const why = placeOne(room, p, msg.slot, id, x, y, turn, BUILD_DRAG_REACH);
      if (why) reasons.set(why, (reasons.get(why) ?? 0) + 1);
      else built++;
    }
    const name = BUILD_PIECES[id].name;
    if (!reasons.size) p.toast(`Built ${built} × ${name}.`, 'good');
    else {
      const [why] = [...reasons].sort((a, b) => b[1] - a[1])[0]!;
      p.toast(`Built ${built} of ${tiles.length} × ${name}. ${why}`, built ? 'info' : undefined);
    }
  } finally {
    pending.delete(p);
  }
}

function removePiece(room: RoomApi, p: ServerPlayer, cell: BuildCell): void {
  const { x, y, data: d } = cell,
    next: BuildData = { ...d };
  let refund: BuildPiece;
  if (d.roof) {
    refund = d.roof;
    delete next.roof;
    delete next.roofTurn;
  } else if (d.wall) {
    refund = d.wall;
    delete next.wall;
    delete next.wallTurn;
    delete next.open;
  } else if (d.stairs) {
    const uy = d.stairs === 'up' ? y + UPPER_OY : y,
      gy = uy - UPPER_OY,
      other = room.store.structureAt(x, d.stairs === 'up' ? uy : gy);
    if (other?.owner !== p.accountId || other.data.stairs !== (d.stairs === 'up' ? 'down' : 'up')) {
      p.toast('The stair pair is unavailable.');
      return;
    }
    const upper = room.store.structureAt(x, uy)!;
    if (upper.data.roof || room.store.objectAt(x, uy) || !safeUpperEdit(room, x, uy, undefined)) {
      p.toast('Clear the upper landing and return downstairs before removing these stairs.');
      return;
    }
    if (!giveStacks(p, [{ id: 'timber_stairs', n: 1 }])) {
      p.toast('Your pack is full.');
      return;
    }
    const ground = room.store.structureAt(x, gy)!;
    room.objects.remove(x, uy, true);
    room.objects.put({ ...ground, data: { ...ground.data, stairs: undefined, stairsTurn: undefined } });
    return;
  } else if (d.floor) {
    if (room.store.objectAt(x, y) || occupied(room, x, y)) {
      p.toast('Clear the floor before lifting it.');
      return;
    }
    if (!isUpperY(y) && room.store.structureAt(x, y + UPPER_OY)?.data.floor) {
      p.toast('Remove the supported upper floor first.');
      return;
    }
    if (!safeUpperEdit(room, x, y, undefined)) {
      p.toast('That would cut off someone’s stairs.');
      return;
    }
    refund = d.floor;
    delete next.floor;
  } else return;
  if (!giveStacks(p, [{ id: refund, n: 1 }])) {
    p.toast('Your pack is full.');
    return;
  }
  if (next.floor || next.wall || next.roof || next.stairs) room.objects.put({ ...cell, data: next });
  else room.objects.remove(x, y, true);
}

export async function openConstruction(room: RoomApi, p: ServerPlayer, x: number, y: number): Promise<boolean> {
  const cell = room.store.structureAt(x, y);
  if (!cell) return false;
  const d = cell.data;
  if (d.stairs) {
    const ty = y + (d.stairs === 'up' ? UPPER_OY : -UPPER_OY);
    await room.ensureChunk(chunkOf(x), chunkOf(ty));
    const pair = room.store.structureAt(x, ty);
    if (
      p.deadT > 0 ||
      distToTile(p, x, y) > 3.5 ||
      room.store.structureAt(x, y) !== cell ||
      !pair ||
      pair.owner !== cell.owner ||
      pair.data.stairs !== (d.stairs === 'up' ? 'down' : 'up')
    )
      return true;
    if (room.store.solidAt(x, ty) || occupied(room, x, ty)) {
      p.toast('The landing is blocked.');
      return true;
    }
    p.sim.x = x + 0.5;
    p.sim.y = ty + 0.5;
    p.sim.boat = 0;
    p.sim.dashT = 0;
    p.queue.length = 0;
    p.toast(d.stairs === 'up' ? 'You climb to your upper floor.' : 'You return downstairs.');
    return true;
  }
  if (isDoor(d.wall)) {
    // a kingdom's cottages are lived in: anyone may come and go through their doors
    if (cell.owner !== p.accountId && !isCivOwner(cell.owner)) {
      p.toast('Only the owner can open or close this door.');
      return true;
    }
    if (d.open && occupied(room, x, y)) {
      p.toast('The doorway is occupied.');
      return true;
    }
    const next = { ...d, open: !d.open };
    if (!safeUpperEdit(room, x, y, next)) {
      p.toast('Keep the route to the stairs open.');
      return true;
    }
    room.objects.put({ ...cell, data: next });
    return true;
  }
  return false;
}
