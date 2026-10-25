import { afterEach, expect, it, vi } from 'vitest';
import { LocalDb } from '../../client/src/local/db';
import { LocalRepo, LocalRepo34 } from '../../client/src/local/repo';

const databases: LocalDb[] = [];
afterEach(async () => {
  for (const db of databases.splice(0)) await db.wipe();
  vi.unstubAllGlobals();
});
async function store() {
  const db = await LocalDb.open();
  databases.push(db);
  return { db, repo: new LocalRepo(db), progress: new LocalRepo34(db) };
}

it('round-trips browser records with JSON/REAL semantics, upgrades guests and cascades account deletion', async () => {
  const { repo, progress } = await store();
  const g = await repo.guestLogin();
  await repo.createCharacter(g.account.id, 'Browser player', 1 / 3, 2 / 3);
  expect((await repo.getCharacter(g.account.id))!.x).toBe(Math.fround(1 / 3));
  await progress.saveProgress(g.account.id, { level: 9 });
  await progress.saveShadows(g.account.id, { roster: ['boar'] });
  const upgraded = await repo.googleLogin('verified-subject', 'user@example.test', g.deviceSecret);
  expect(upgraded.upgraded).toBe(true);
  expect(upgraded.account.id).toBe(g.account.id);
  expect((await repo.googleLogin('verified-subject', null)).account.id).toBe(g.account.id);
  expect((await repo.guestLogin(g.deviceSecret)).account.id).not.toBe(g.account.id);
  expect(await progress.loadProgress(g.account.id)).toEqual({ level: 9 });
  await repo.deleteAccount(g.account.id);
  expect(await repo.getCharacter(g.account.id)).toBeNull();
  expect(await progress.loadProgress(g.account.id)).toBeNull();
  expect(await progress.loadShadows(g.account.id)).toBeNull();
  await expect(progress.saveProgress(g.account.id, {})).rejects.toThrow('foreign key');
});

it('commits both inventories and the audit row atomically, including serialization failures', async () => {
  const { db, repo, progress } = await store();
  const a = (await repo.guestLogin()).account.id,
    b = (await repo.guestLogin()).account.id;
  await repo.createCharacter(a, 'A', 0, 0);
  await repo.createCharacter(b, 'B', 0, 0);
  const trade = { a, b, aData: { coins: 4 }, bData: { coins: 6 }, aItems: [], bItems: [], aCoins: 1, bCoins: 1 };
  await progress.commitTrade(trade);
  expect((await repo.getCharacter(a))!.data).toEqual({ coins: 4 });
  expect((await repo.getCharacter(b))!.data).toEqual({ coins: 6 });
  expect(db.get<unknown[]>('log:trades')).toHaveLength(1);
  await expect(progress.commitTrade({ ...trade, aData: { coins: 999 }, bData: { circular: 1n } })).rejects.toThrow();
  expect((await repo.getCharacter(a))!.data).toEqual({ coins: 4 });
  expect(db.get<unknown[]>('log:trades')).toHaveLength(1);
  await repo.deleteAccount(b);
  await expect(progress.commitTrade(trade)).rejects.toThrow('character missing');
  expect((await repo.getCharacter(a))!.data).toEqual({ coins: 4 });
});

it('reopens the real browser unload journal without a database and keeps returned records isolated', async () => {
  const saved = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => saved.get(k) ?? null,
    setItem: (k: string, v: string) => saved.set(k, v),
    removeItem: (k: string) => saved.delete(k),
  });
  const first = await store();
  const a = (await first.repo.guestLogin()).account.id;
  await first.progress.saveProgress(a, { bosses: ['veyr'] });
  first.db.journalSync();
  const reopened = await store();
  expect(await reopened.progress.loadProgress(a)).toEqual({ bosses: ['veyr'] });
  const copy = (await reopened.progress.loadProgress(a)) as { bosses: string[] };
  copy.bosses.push('unearned');
  expect(await reopened.progress.loadProgress(a)).toEqual({ bosses: ['veyr'] });
});
