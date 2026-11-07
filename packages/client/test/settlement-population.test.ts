import { expect, it } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { ChunkStore, SETTLEMENT_PROFILES, buildRealmTown, type RealmSite, type Town } from '@eigenlands/shared';
import { WorldLife, type LifeDeps, type LifeFrame } from '../src/game/life';

it('bounds crowded settlement populations and releases their sprites when moving on', () => {
  const seed = 7;
  const site: RealmSite = {
    id: 'population_test',
    realm: 'aurelion',
    kind: 'town',
    tier: 'town',
    cx: 5000,
    cy: -2000,
    w: 96,
    h: 76,
    ring: 'n',
    name: 'Crowded Market',
  };
  const town = buildRealmTown(site, seed, 7);
  const inn = town.buildings.find((b) => b.kind === 'inn')!;
  expect(inn).toBeDefined();
  // A busy market with many inns must still respect the browser's actor budget.
  const crowded = { ...town, buildings: [...town.buildings, ...Array.from({ length: 30 }, () => ({ ...inn }))] };
  const layer = new Container();
  const store = new ChunkStore(seed, 80, 7);
  const life = new WorldLife({
    seed: () => seed,
    layer: () => layer,
    store: () => store,
    art: () => null,
    foes: () => ({ anchor: () => 0.9, frame: () => Texture.EMPTY }),
  } as unknown as LifeDeps);
  const enter = (t: Town | null) =>
    (life as unknown as { enter(t: Town | null, f: LifeFrame): void }).enter(t, { hour: 12 } as LifeFrame);
  enter(crowded);
  expect(life.count()).toBeGreaterThan(0);
  expect(life.count()).toBeLessThanOrEqual(SETTLEMENT_PROFILES.town.ambientLimit);
  expect(layer.children.length).toBe(life.count());
  enter(null);
  expect(life.count()).toBe(0);
  expect(layer.children.length).toBe(0);
});

it('retires complete scenes together and keeps the interactive notice board under a tier budget', () => {
  const life = Object.create(WorldLife.prototype) as any;
  const board = { kind: 'board' },
    stable = { kind: 'stablehand' },
    dressing = { kind: 'dressing' };
  const mk = (sc?: object) => ({ role: 'scene', sc, root: { destroy: () => {} } });
  life.site = { tier: 'village' };
  // One board and a groom/horse pair; enough doorstep props to trigger pruning.
  life.cast = [mk(board), mk(stable), mk(stable), ...Array.from({ length: 23 }, () => mk(dressing))];
  life.plan = [board, stable, dressing];
  life.limitPopulation();
  expect(life.cast.length).toBeLessThanOrEqual(SETTLEMENT_PROFILES.village.ambientLimit);
  expect(life.cast.filter((a: any) => a.sc === board)).toHaveLength(1);
  expect(life.cast.filter((a: any) => a.sc === stable)).toHaveLength(2);
  expect(life.cast.filter((a: any) => a.sc === dressing)).toHaveLength(0);
  expect(life.plan).toEqual([board, stable]);
});
