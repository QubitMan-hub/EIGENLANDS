import { expect, it } from 'vitest';
import { realmTowns, townFor, guildBoard, guildFurnishings, T, objSolid, propFootprint, upperTowns } from '../src';

it('gives every capital a dedicated, accessible guild hall with real preparation fittings', () => {
  for (const seed of [1, 20260101, 87531]) {
    const capitals = realmTowns(seed, 6).filter((t) => t.buildings.some((b) => b.id.endsWith('.palace')));
    expect(capitals).toHaveLength(6);
    for (const t of capitals) {
      const halls = t.buildings.filter((b) => b.guild);
      expect(halls, t.name).toHaveLength(1);
      const b = halls[0]!,
        board = guildBoard(t)!;
      expect(b.kind).toBe('hall');
      expect(b.id).not.toMatch(/palace|keep/);
      expect(board.x > b.x && board.x < b.x + b.w - 1 && board.y > b.y && board.y < b.y + b.h - 1).toBe(true);
      const objects = [...t.objects, board, ...guildFurnishings(t)];
      const inside = objects.filter((o) => o.x > b.x && o.x < b.x + b.w - 1 && o.y > b.y && o.y < b.y + b.h - 1);
      expect(inside.some((o) => o.sub === 'bed')).toBe(true);
      expect(inside.some((o) => o.sub === 'workbench')).toBe(true);
      const tile = (x: number, y: number) => t.tiles.get(x - t.x0 + (y - t.y0) * (t.x1 - t.x0 + 1)) ?? T.GRASS;
      const blocked = new Set<string>();
      for (const o of inside) {
        expect(tile(o.x, o.y)).toBe(T.FLOOR);
        if (!objSolid(o.kind, o.sub)) continue;
        for (const [x, y] of [[o.x, o.y], ...propFootprint(o.sub, o.x, o.y, tile)]) {
          const k = `${x},${y}`;
          if (blocked.has(k)) throw Error(`Overlapping ${o.sub} in ${t.name}`);
          blocked.add(k);
        }
      }
      const seen = new Set<string>(),
        queue = [[b.doorX, b.doorY]];
      for (let i = 0; i < queue.length; i++) {
        const [x, y] = queue[i]!;
        const k = `${x},${y}`;
        if (
          seen.has(k) ||
          blocked.has(k) ||
          x! < b.x ||
          x! >= b.x + b.w ||
          y! < b.y ||
          y! >= b.y + b.h ||
          tile(x!, y!) !== T.FLOOR
        )
          continue;
        seen.add(k);
        queue.push([x! + 1, y!], [x! - 1, y!], [x!, y! + 1], [x!, y! - 1]);
      }
      for (const o of inside.filter((o) =>
        ['bed', 'workbench', 'guild_board', 'guild_desk', 'stairs_up'].includes(o.sub),
      ))
        expect(
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([dx, dy]) => seen.has(`${o.x + dx!},${o.y + dy!}`)),
          `${t.name} ${o.sub} approach`,
        ).toBe(true);
    }
  }
});
it('keeps upper floors and abandoned towns free of active guild boards', () => {
  const t = townFor(20260101);
  expect(guildBoard({ ...t, abandoned: true })).toBeNull();
  expect(upperTowns([t]).every((u) => guildBoard(u) === null)).toBe(true);
});

it('equips distant procedural towns without changing their footprint or filling their entrance', async () => {
  const { buildRealmTown, REALM_SITES, furnishGuildHall } = await import('../src');
  const t = buildRealmTown(
    {
      ...REALM_SITES[0]!,
      id: 'frontier:guild-test',
      name: 'Mossrest',
      kind: 'town',
      cx: 4096,
      cy: 4096,
      w: 128,
      h: 96,
    },
    20260101,
    6,
  );
  const hall = t.buildings.find((b) => b.guild);
  expect(hall).toBeTruthy();
  const before = JSON.stringify({ tiles: [...t.tiles], buildings: t.buildings, objects: t.objects });
  furnishGuildHall(t);
  expect(JSON.stringify({ tiles: [...t.tiles], buildings: t.buildings, objects: t.objects })).toBe(before);
  const board = guildBoard(t)!;
  expect(board.x).toBeGreaterThan(4000);
  expect(
    t.objects.some(
      (o) =>
        Math.abs(o.x - hall!.doorX) <= 1 && o.y >= hall!.doorY - 1 && o.y <= hall!.doorY && objSolid(o.kind, o.sub),
    ),
  ).toBe(false);
});
