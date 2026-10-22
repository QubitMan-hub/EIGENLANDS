import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSG, QUBITMAN, townFor } from '@eigenlands/shared';
import type { App } from '../src/app';
import { boot, count, dev, give, hasToast, setDay, sleep, spawn, tp, until, type Probe } from './p2';

let app: App;
let p: Probe;

const npcAt = (id: string) => p.room.village.npc(id)!;
async function near(id: string): Promise<void> { const n = npcAt(id); await tp(p, n.x + 0.8, n.y); }
async function talk(npcId: string, topic?: string): Promise<any> {
  const k = p.dialogues.length;
  p.r.send(MSG.TALK, { npcId, ...(topic ? { topic } : {}) });
  await until(() => p.dialogues.length > k);
  return p.dialogues[p.dialogues.length - 1];
}
async function quest(npcId: string, q: string, action: 'accept' | 'turnin'): Promise<void> {
  const k = p.dialogues.length, pk = p.panels.length;
  p.r.send(MSG.QUEST, { npcId, quest: q, action });
  await until(() => p.dialogues.length > k || p.panels.length > pk);
}
async function open(x: number, y: number): Promise<any> {
  const k = p.panels.length;
  p.r.send(MSG.OPEN, { tx: x, ty: y });
  await until(() => p.panels.length > k);
  return p.panels[p.panels.length - 1];
}

beforeAll(async () => {
  app = await boot();
  p = await spawn(app, 'Questor');
  setDay(p.room, 1, 12.2);
});
afterAll(async () => { await app.close(); });

describe('story quests through dialogue', () => {
  it('Orla offers the welcome quest; talking to three villagers completes it; turning in pays out', async () => {
    await near('orla');
    const hello = await talk('orla');
    expect(hello.choices.some((c: any) => c.id === 'quest:welcome')).toBe(true);
    expect(hello.quests[0]).toMatchObject({ id: 'welcome', state: 'offer' });
    const offer = await talk('orla', 'quest:welcome');
    expect(offer.text).toMatch(/Welcome/);
    expect(offer.choices.map((c: any) => c.id)).toContain('accept:welcome');
    await quest('orla', 'welcome', 'accept');
    expect(p.sp.data.quests.welcome?.state).toBe('active');
    await until(() => p.profiles.some((m) => m.quests?.welcome));
    for (const id of ['odo', 'brannoch', 'tobin']) { await near(id); await talk(id); }
    expect(p.sp.data.quests.welcome!.progress).toEqual([1, 1, 1]);
    expect(hasToast(p, /Quest ready: A Warm Welcome/)).toBe(true);
    await near('orla');
    const coins = p.sp.data.coins;
    const ready = await talk('orla');
    expect(ready.choices.find((c: any) => c.id === 'quest:welcome').kind).toBe('ready');
    await quest('orla', 'welcome', 'turnin');
    expect(p.sp.data.quests.welcome!.state).toBe('done');
    expect(p.sp.data.coins).toBe(coins + 60);
    expect(count(p, 'fertilizer')).toBeGreaterThanOrEqual(3);
    // follow-ups unlock across the village
    const next = await talk('orla');
    expect(next.quests.map((q: any) => q.id)).toContain('qubitman');
  });

  it('reading the statue of QubitMan shows the plaque and legend, and completes "The Hero in the Square"', async () => {
    await quest('orla', 'qubitman', 'accept');
    const t = townFor(p.room.seed);
    const statue = t.objects.find((o) => o.sub === 'statue')!;
    await tp(p, statue.x + 0.5, statue.y + 2.5);
    const panel = await open(statue.x, statue.y);
    expect(panel.kind).toBe('lore');
    expect(panel.lore.plaque).toBe('ALL HAIL QUBITMAN');
    expect(panel.lore.pages.length).toBe(QUBITMAN.legend.length);
    expect(p.sp.data.quests.qubitman!.progress[0]).toBe(1);
    await near('orla');
    await quest('orla', 'qubitman', 'turnin');
    expect(p.sp.data.quests.qubitman!.state).toBe('done');
    expect(count(p, 'qubit_tea')).toBe(1);
    // villagers remember it
    expect(p.sp.data.deeds.statue).toBeTruthy();
  });

  it('delivery quests track the pack and hand the items over', async () => {
    await near('odo');
    await quest('odo', 'timber', 'accept');
    expect(p.sp.data.quests.timber!.progress[0]).toBe(0);
    await give(p, 'wood', 15);
    await sleep(50);
    expect(p.sp.data.quests.timber!.progress[0]).toBe(12);
    await quest('odo', 'timber', 'turnin');
    expect(p.sp.data.quests.timber!.state).toBe('done');
    expect(count(p, 'wood')).toBe(3);
    expect(count(p, 'plank')).toBeGreaterThanOrEqual(6);
  });

  it('kill, cook and place objectives come from the real events', async () => {
    dev(p, { cmd: 'quest', id: 'slimes', action: 'start' });
    dev(p, { cmd: 'quest', id: 'supper', action: 'start' });
    dev(p, { cmd: 'quest', id: 'homestead', action: 'start' });
    await until(() => !!p.sp.data.quests.slimes && !!p.sp.data.quests.supper && !!p.sp.data.quests.homestead);
    // kill
    const e = p.room.spawnEnemy('slime', p.sp.sim.x + 1, p.sp.sim.y);
    (p.room as any).damageEnemy(e, 999, p.sp, 1, 0, 0);
    expect(p.sp.data.quests.slimes!.progress[0]).toBe(1);
    // cook at the inn's pot
    const pot = townFor(p.room.seed).objects.find((o) => o.sub === 'cooking_pot')!;
    await tp(p, pot.x + 0.5, pot.y + 1.5);
    await give(p, 'potato', 1);
    p.r.send(MSG.CRAFT, { station: 'cooking_pot', tx: pot.x, ty: pot.y, recipe: 'roast_potato', n: 1 });
    await until(() => (p.sp.data.quests.supper!.progress[0] ?? 0) >= 1);
    // place a chest
    await give(p, 'chest', 1);
    await tp(p, 300.5, 300.5);
    for (let y = 299; y <= 302; y++) for (let x = 299; x <= 303; x++) { p.room.objects.remove(x, y); p.room.setTile(x, y, 3); }
    p.r.send(MSG.USE, { slot: p.sp.data.inv.findIndex((s) => s?.id === 'chest'), tx: 302, ty: 300 });
    await until(() => (p.sp.data.quests.homestead!.progress[0] ?? 0) >= 1);
  });
});

describe('the daily request board', () => {
  it('posts three jobs, accepts them, and pays for deliveries handed in at the board', async () => {
    const board = townFor(p.room.seed).objects.find((o) => o.sub === 'board')!;
    await tp(p, board.x + 0.5, board.y + 1.5);
    const panel = await open(board.x, board.y);
    expect(panel.kind).toBe('board');
    expect(panel.board.requests.length).toBe(3);
    const job = panel.board.requests.find((r: any) => r.objectives[0].type === 'deliver') ?? panel.board.requests[0];
    await quest('board', job.id, 'accept');
    expect(p.sp.data.quests[job.id]?.state).toBe('active');
    const o = job.objectives[0];
    if (o.type === 'deliver') {
      await give(p, o.target, o.n);
      const coins = p.sp.data.coins;
      await quest('board', job.id, 'turnin');
      expect(p.sp.data.quests[job.id]!.state).toBe('done');
      expect(p.sp.data.coins).toBe(coins + job.coins);
      const after = p.panels[p.panels.length - 1];
      expect(after.board.requests.find((r: any) => r.id === job.id).state).toBe('done');
    }
    // far away: refused
    await tp(p, board.x + 20.5, board.y + 0.5);
    const from = p.toasts.length;
    p.r.send(MSG.QUEST, { npcId: 'board', quest: panel.board.requests[1].id, action: 'accept' });
    await until(() => hasToast(p, /Too far/, from));
  });
});

describe('friendship', () => {
  it('heart events play at milestones, offer choices, and are remembered', async () => {
    await near('maribel');
    dev(p, { cmd: 'friend', npc: 'maribel', pts: 90 });
    await until(() => p.sp.data.friends.maribel?.pts === 90);
    const ev = await talk('maribel');
    expect(ev.event).toMatch(/Crooked Spoon/);
    expect(ev.pages.length).toBeGreaterThan(1);
    expect(ev.choices.length).toBe(3);
    const pts = p.sp.data.friends.maribel!.pts;
    const reply = await talk('maribel', ev.choices[2].id);
    expect(reply.text).toMatch(/Leek and potato/);
    expect(p.sp.data.friends.maribel!.pts).toBeGreaterThan(pts);
    expect(p.sp.data.events).toContain('maribel:0');
    const again = await talk('maribel');
    expect(again.event).toBeUndefined();
  });

  it('ask topics answer in character; goodbyes end the conversation', async () => {
    const ask = await talk('maribel', 'ask');
    expect(ask.choices.map((c: any) => c.id)).toEqual(expect.arrayContaining(['ask:about', 'ask:town', 'ask:qubitman', 'ask:rumor', 'back']));
    const q = await talk('maribel', 'ask:qubitman');
    expect(q.text.length).toBeGreaterThan(20);
    const bye = await talk('maribel', 'bye');
    expect(bye.end).toBe(true);
  });

  it('shops keep opening hours', async () => {
    setDay(p.room, 1, 19.5);
    await sleep(1200); // let Tobin walk out of the store
    await near('tobin');
    const from = p.toasts.length, k = p.shopViews.length;
    p.r.send(MSG.SHOP, { npcId: 'tobin', action: 'open' });
    await until(() => hasToast(p, /closed/i, from));
    expect(p.shopViews.length).toBe(k);
    const d = await talk('tobin');
    expect(d.canShop).toBe(false);
    expect(d.shopOpen).toBe(false);
    setDay(p.room, 1, 12.2);
  });
});
