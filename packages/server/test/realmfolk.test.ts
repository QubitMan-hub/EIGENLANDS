import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  NODES,
  OTHERWORLDS,
  RACES,
  RECIPES,
  STANDING,
  STANDING_FOR,
  T,
  recipeBlock,
  recipeKnown,
} from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot3, clearEnemies, dev, setLevel, sleep, spawn3, tp, until } from './p3helpers';

let app: App;
beforeAll(async () => {
  app = await boot3({ newWorldGeneration: 6 });
});
afterAll(async () => {
  await sleep(300);
  await app?.close();
});

describe('the peoples of the realms', () => {
  it('the Aerin keep shop on their isle; their better wares wait for standing, and Reaver feathers raise it', async () => {
    const p = await spawn3(app, 'Envoy');
    await setLevel(p, 10);
    const village = p.room.village as unknown as {
      npc: (id: string) => { x: number; y: number } | undefined;
      shop: (p: unknown, m: unknown) => { stock: Array<{ item: string }> } | null;
    };
    // the quartermaster stands on the Aerin isle
    await tp(p, 0.5, OTHERWORLDS.aetheria.oy + 1.5);
    await until(() => !!village.npc('aerin_corvane'), 5000);
    const npc = village.npc('aerin_corvane')!;
    expect(Math.abs(npc.y - OTHERWORLDS.aetheria.oy)).toBeLessThan(20);
    await tp(p, npc.x + 1, npc.y);
    const shown = () => village.shop(p.sp, { npcId: 'aerin_corvane', action: 'open' })!.stock.map((s) => s.item);
    expect(shown()).not.toContain('aetherium_ingot');
    expect(shown()).not.toContain('storm_buckler');
    // turning in Reaver feathers: coin and standing
    p.sp.data.inv[0] = { id: RACES.aerin.token, n: 20 };
    village.shop(p.sp, { npcId: 'aerin_corvane', action: 'sell', slot: 0, n: 20 });
    expect(p.sp.data.rep.aerin).toBe(STANDING.token * 20);
    expect(shown()).toContain('aetherium_ingot');
    expect(shown()).not.toContain('storm_buckler');
    p.sp.data.rep.aerin = STANDING_FOR.trusted;
    expect(shown()).toContain('storm_buckler');
    expect(shown()).not.toContain('windcaller_mantle');
    await p.r.leave();
  });

  it('bringing down a Gale Reaver in Aetheria raises standing with the Aerin', async () => {
    const p = await spawn3(app, 'Skyguard');
    await setLevel(p, 10);
    await tp(p, 0.5, OTHERWORLDS.aetheria.oy + 1.5);
    clearEnemies(p.room);
    const before = p.sp.data.rep.aerin ?? 0;
    p.room.spawnEnemy('gale_reaver', p.sp.sim.x + 2, p.sp.sim.y, false, { level: 8 });
    dev(p, { cmd: 'kill', d: 6 });
    await until(() => (p.sp.data.rep.aerin ?? 0) >= before + STANDING.foe, 3000);
    await p.r.leave();
  });

  it('a people’s recipes wait for their standing; their metal is mined only in their realm', () => {
    const plate = RECIPES.find((r) => r.out.id === 'armor_aetherium_chest')!;
    expect(plate.learn).toBe('realm:aerin');
    const who = (rep: number) => ({
      learned: new Set<string>(),
      disc: { smithing: 1e6 } as never,
      rep: { aerin: rep },
    });
    expect(recipeKnown(plate, who(0))).toBe(false);
    expect(recipeKnown(plate, who(STANDING_FOR.known))).toBe(true);
    const smelt = RECIPES.find((r) => r.out.id === 'aetherium_ingot')!;
    expect(recipeBlock(smelt, who(0))).toMatch(/standing with the Aerin/);
    const ore = NODES[T.ORE_SILVER]!.drops.find((d) => d.item === 'aetherium_ore')!;
    expect(ore.realm).toBe('aetheria');
  });
});
