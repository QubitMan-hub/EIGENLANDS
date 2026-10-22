import { describe, expect, it } from 'vitest';
import { RUMOR_TEMPLATES } from '@eigenlands/shared';
import { RumorBook, MAX_RUMORS, renderRumor } from '../src/systems/village/rumors';
import { FakePlayer, makeHost, makeVillage, nextTo, run } from './village.helpers';
import { createVillage } from '../src/systems/village';

describe('rumor book', () => {
  it('renders templates, caps history, prunes by age', () => {
    expect(renderRumor('harvest', 'Ana', 'melons')).toBe('Ana brought in a fine harvest of melons.');
    expect(renderRumor('rare_fish', 'Bo', 'koi')).toContain('koi');
    expect(renderRumor('unknown_kind', 'Cy', '')).toContain('Cy');
    expect(Object.keys(RUMOR_TEMPLATES).length).toBeGreaterThan(3);
    const b = new RumorBook();
    for (let i = 0; i < MAX_RUMORS + 10; i++) b.add('level', 'P' + i, '', i);
    expect(b.list.length).toBe(MAX_RUMORS);
    expect(b.list[0]!.who).toBe('P10');
    expect(b.prune(MAX_RUMORS + 9, 6)).toBe(true);
    expect(b.list.every((r) => r.day >= MAX_RUMORS + 3)).toBe(true);
  });

  it('exchange shares one rumor at p=0.5 and never both directions at once', () => {
    const b = new RumorBook();
    const r = b.add('level', 'Ana', '', 0);
    r.heard.push('a');
    expect(b.exchange('a', 'b', () => 0.9)).toBe(false);
    expect(b.exchange('a', 'b', () => 0.1)).toBe(true);
    expect(r.heard).toContain('b');
    expect(b.exchange('a', 'b', () => 0.1)).toBe(false); // nothing new to share
    expect(b.load('garbage')).toBeUndefined();
  });
});

describe('village rumors', () => {
  it('gossips hear within the hour, others learn by proximity, and talk() surfaces them', async () => {
    const { village, clock } = await makeVillage();
    const p = new FakePlayer();
    clock.forced = 'clear';
    clock.set(0, 18.5); // many NPCs at the inn / plaza
    let tick = run(village, clock, 1300);
    village.rumor('harvest', 'Zed', 'pumpkins');
    expect(village.rumorBook().list[0]!.heard).toEqual([]);
    // next game hour boundary: gossips hear it
    clock.advanceMs(60 * 60 * 1000 / 60);
    tick = run(village, clock, 1, tick);
    const r = village.rumorBook().list[0]!;
    expect(r.heard).toContain('orla');
    expect(r.heard).toContain('maribel');
    // spreading: several hours with everyone at the inn
    clock.set(0, 19.2);
    for (let h = 0; h < 6; h++) { clock.advanceMs(60 * 60 * 1000 / 60); tick = run(village, clock, 1, tick); }
    expect(r.heard.length).toBeGreaterThan(2);
    // surfacing in conversation (never about the listener)
    const teller = r.heard[0]!;
    let heardIt = false;
    nextTo(p, village, teller);
    p.name = 'Listener';
    for (let i = 0; i < 100 && !heardIt; i++) { p.data.friends[teller] = { pts: 0, talked: -1, gifted: -1 }; const m = village.talk(p, teller)!; if (m.rumor) { heardIt = true; expect(m.text).toContain(m.rumor); expect(m.rumor).toContain('Zed'); } }
    expect(heardIt).toBe(true);
    // the subject of the rumor does not hear about themselves
    p.name = 'Zed';
    for (let i = 0; i < 60; i++) { p.data.friends[teller] = { pts: 0, talked: -1, gifted: -1 }; expect(village.talk(p, teller)!.rumor).toBeUndefined(); }
  });

  it('rumors persist across restarts and are pruned after a few days', async () => {
    const { host, clock, blobs, village } = await makeVillage();
    village.rumor('level', 'Ana');
    village.rumor('boss_slain', 'Bo');
    await village.dispose();
    expect((blobs.get('rumors') as unknown[]).length).toBe(2);
    const v2 = createVillage(host);
    await v2.init();
    expect(v2.rumorBook().list.map((r) => r.who)).toEqual(['Ana', 'Bo']);
    v2.rumor('level', 'Cy');
    expect(v2.rumorBook().list.at(-1)!.id).toBeGreaterThan(v2.rumorBook().list[0]!.id); // ids keep increasing
    clock.set(10, 10);
    v2.onNewDay(clock.day());
    expect(v2.rumorBook().list.length).toBe(0);
    void makeHost; void FakePlayer;
  });
});
