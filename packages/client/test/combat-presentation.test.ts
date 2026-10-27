import { afterEach, expect, it, vi } from 'vitest';
import type { Graphics } from 'pixi.js';
import { newPlayerSim, type StepEvents } from '@eigenlands/shared';
import { CombatView, type CombatActor, type CombatDeps } from '../src/game/combatview';

afterEach(() => vi.restoreAllMocks());
it('hit feedback pauses effects without freezing unrelated remote movement', () => {
  const view = new CombatView({} as CombatDeps, {} as Graphics);
  view.hitStop(60);
  expect(view.frame(0.016)).toBeLessThan(1);
  expect(view.warp).toBe(0);
  for (let i = 0; i < 20; i++) view.frame(0.016);
  expect(view.warp).toBe(0);
  expect(view.frame(0.016)).toBe(1);
});
it('starts strike poses on the predicted input, recovers, and offers a reduced-motion pose', () => {
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  const deps = {
    fx: () => ({ burst: () => {}, dash: () => {} }),
    weapon: () => ({ ranged: true, hue: -1 }),
    sound: () => {},
  } as unknown as CombatDeps;
  const view = new CombatView(deps, {} as Graphics),
    actor = {} as CombatActor;
  const ev: StepEvents = {
    attacked: true,
    dashed: false,
    heavy: false,
    combo: 0,
    skill: false,
    counter: false,
    level: 0,
    chargeFull: false,
    chargeReady: false,
  };
  view.onLocalStep(ev, newPlayerSim(0, 0), actor);
  expect(view.playerAttackFrame(actor, 1000, false)).toBe(1); // actual release/contact, not a late windup
  expect(view.playerAttackFrame(actor, 1060, false)).toBe(2);
  expect(view.playerAttackFrame(actor, 1180, false)).toBe(3);
  expect(view.playerAttackFrame(actor, 1221, false)).toBe(-1);
  expect(view.attackFrame(actor, 1000, false)).toBe(0);
  expect(view.attackFrame(actor, 1060, false)).toBe(1);
  expect(view.attackFrame(actor, 1120, false)).toBe(2);
  expect(view.attackFrame(actor, 1180, false)).toBe(3);
  expect(view.attackFrame(actor, 1060, true)).toBe(2);
  expect(view.attackFrame(actor, 1221, false)).toBe(-1);
  view.onLocalStep({ ...ev, attacked: false, dashed: true }, newPlayerSim(0, 0), actor);
  expect(view.attackFrame(actor, 1060, false)).toBe(-1); // dash cancels the strike pose too
});
it('matches two late confirmations to two predicted hits without repeating their impact effects', () => {
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  const impact = vi.fn();
  const enemy = {
    id: 'enemy',
    type: 'enemy',
    root: { visible: true },
    kind: 0,
    lx: 0.6,
    ly: 0,
    flash: 0,
    punch: 0,
  } as CombatActor;
  const deps = {
    fx: () => ({ swing: () => {}, impact, kick: () => {}, damage: () => {} }),
    weapon: () => ({ ranged: false, hue: -1 }),
    sound: () => {},
    reduced: () => false,
    views: () => [enemy],
    myId: () => 'self',
  } as unknown as CombatDeps;
  const view = new CombatView(deps, {} as Graphics),
    sim = newPlayerSim(0, 0);
  sim.faceX = 1;
  sim.faceY = 0;
  const ev: StepEvents = {
    attacked: true,
    dashed: false,
    heavy: false,
    combo: 0,
    skill: false,
    counter: false,
    level: 0,
    chargeFull: false,
    chargeReady: false,
  };
  view.onLocalStep(ev, sim, {} as CombatActor);
  view.onLocalStep(ev, sim, {} as CombatActor);
  expect(impact).toHaveBeenCalledTimes(2);
  const hit = { kind: 'hit' as const, x: 0.6, y: 0, id: 'enemy', by: 'self', v: 8, w: 0 };
  view.onFx(hit, () => enemy);
  view.onFx(hit, () => enemy);
  expect(impact).toHaveBeenCalledTimes(2);
});

it('starts the observed shooter pose without consuming ordinary projectile effects', () => {
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  const view = new CombatView({ fx: () => ({}), myId: () => 'self' } as CombatDeps, {} as Graphics);
  const archer = {} as CombatActor;
  expect(view.onFx({ kind: 'shot', id: 'archer', by: 'archer', x: 0, y: 0 }, () => archer)).toBe(false);
  expect(view.attackFrame(archer, 1060, false)).toBe(0);
  expect(view.attackFrame(archer, 1130, false)).toBe(2);
  expect(view.attackFrame(archer, 1261, false)).toBe(-1);
});

it('plays authored boss strike and recovery poses when a caster fires directly into recovery', async () => {
  const { Sprite, Container, Graphics, Texture } = await import('pixi.js');
  const { bestiaryKind } = await import('@eigenlands/shared');
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  const frame = vi.fn((_kind: number, _night: boolean, _dir: number, _anim: string, _frame: number) => Texture.EMPTY);
  const actor = {
    id: 'dragon',
    type: 'enemy',
    kind: bestiaryKind('primordial_dragon'),
    root: new Container(),
    sprite: new Sprite(Texture.EMPTY),
    fl: new Sprite(Texture.EMPTY),
    gfx: new Graphics(),
    lx: 0,
    ly: 0,
    travel: 0,
    outfit: 0,
    flash: 0,
    punch: 0,
    ghostT: 0,
  } as CombatActor;
  const deps = {
    fx: () => ({ burst: () => {}, shockwave: () => {}, kick: () => {} }),
    sound: () => {},
    reduced: () => false,
    me: () => ({ x: 0, y: 0 }),
    foes: () => ({
      frame,
      frames: (_k: number, a: string) => (a === 'attack' ? 2 : 1),
      anchor: () => 1,
      shadow: () => [24, 8],
    }),
  } as unknown as CombatDeps;
  const view = new CombatView(deps, new Graphics());
  const snap = {
    hp: 100,
    maxHp: 100,
    flags: 0,
    tele: 0,
    kind: actor.kind,
    night: false,
    st: 4,
    atk: 0,
    tx: 0,
    ty: 0,
    poise: 100,
    elite: 0,
    faceX: 1,
    faceY: 0,
  };
  view.onFx({ kind: 'orb', id: actor.id, x: 0, y: 0 }, () => actor);
  view.drawEnemy(actor, snap, 0, 0, 1, 1100, 0.016, false);
  expect(frame.mock.calls.at(-1)?.[3]).toBe('attack');
  expect(frame.mock.calls.at(-1)?.[4]).toBe(0);
  view.drawEnemy(actor, snap, 0, 0, 1, 1300, 0.016, false);
  expect(frame.mock.calls.at(-1)?.[3]).toBe('attack');
  expect(frame.mock.calls.at(-1)?.[4]).toBe(1);
  view.drawEnemy(actor, snap, 0, 0, 1, 1500, 0.016, false);
  expect(frame.mock.calls.at(-1)?.[3]).toBe('idle');
  view.onFx({ kind: 'blast', id: actor.id, x: 0, y: 0 }, () => actor);
  expect(view.attackFrame(actor, 1100, false)).toBeGreaterThanOrEqual(0);
  actor.root.destroy();
  actor.sprite.destroy();
  actor.fl.destroy();
  actor.gfx.destroy();
});
