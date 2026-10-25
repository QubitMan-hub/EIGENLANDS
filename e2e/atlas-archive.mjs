// Real IndexedDB + actual game atlas, including history beyond the resident page limit.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://127.0.0.1:5240/';
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?dev=1&hour=12`);
  await page.waitForSelector('#g-off:not([hidden])');
  await page.fill('#name', 'Archivist');
  await page.click('#btn-guest');
  await page.waitForFunction(() => window.__eigen?.state().ready, null, { timeout: 60000 });
  for (let i = 0; i < 2 && (await page.locator('.p3-lumen-skip').isVisible()); i++)
    await page.locator('.p3-lumen-skip').click();
  await page.waitForFunction(() => window.__eigen.game.ext.atlas.archive?.status === 'saved');
  await page.evaluate(() => {
    window.__eigen.game.app.ticker.maxFPS = 10;
  });
  const checks = await page.evaluate(async () => {
    const a = window.__eigen.game.ext.atlas,
      Archive = a.archive.constructor,
      Journal = a.journal.constructor;
    const check = (ok, label) => {
      if (!ok) throw new Error(label);
    };
    const flush = async (archive) => {
      for (let i = 0; i < 30; i++) {
        await archive.flush();
        if (archive.status === 'saved') return;
      }
      throw new Error('Archive did not flush');
    };
    // Use observed tile fixtures, not world generation/teleports. Run the actual visit/write/cache paths.
    const tiles = new Int16Array(1024).fill(3),
      store = { has: () => true, get: () => ({ tiles }) };
    for (let i = 0; i < 620; i++) {
      a.journal.visit(store, (100 + i) * 32 + 2, 3202, 0);
      if (i % 16 === 0) await flush(a.archive);
    }
    await flush(a.archive);
    check(a.journal.chunks.size <= 512, 'Resident cache is bounded');
    check(a.journal.tile(3202, 3202) === undefined, 'Old page actually evicted');
    check(a.seen(3202, 3202) && !a.seen(3203, 3202), 'Archived discovery preserves cell fog');
    a.changed = true;
    a.save();
    window.archiveFixture = { key: a.key, count: a.archive.discovery.size };
    // Unavailable IndexedDB keeps a bounded retry/recovery window, then recovers when access returns.
    const open = indexedDB.open.bind(indexedDB);
    let unavailable;
    const unavailableScope = `eigen.atlas:unavailable-${Date.now()}:7`;
    try {
      indexedDB.open = () => {
        throw new DOMException('Denied', 'SecurityError');
      };
      unavailable = new Archive(unavailableScope, new Journal(), () => {});
      const cell = new Int16Array(1024).fill(-1);
      cell[0] = 3;
      for (let i = 0; i < 513; i++) unavailable.record(`${i},0`, cell);
      await unavailable.flush();
      check(
        unavailable.status === 'unavailable' && unavailable.pending.size === 512 && unavailable.limited,
        'Unavailable storage bounds and reports pending loss',
      );
      const recovery = new Journal();
      recovery.restore(unavailable.recovery());
      check(
        recovery.chunks.size === 512 && recovery.tile(0, 0) === undefined && recovery.tile(512 * 32, 0) === 3,
        'Recovery retains newest pending observations',
      );
    } finally {
      indexedDB.open = open;
    }
    unavailable.retryAt = 0;
    await flush(unavailable);
    await unavailable.erase(unavailableScope.slice(0, unavailableScope.lastIndexOf(':') + 1));
    // Two tabs/writers observing different cells must not replace one another's discoveries.
    const prefix = `eigen.atlas:fixture-${Date.now()}:`,
      scope = prefix + '7';
    const j1 = new Journal(),
      j2 = new Journal(),
      one = new Archive(scope, j1, () => {}),
      two = new Archive(scope, j2, () => {});
    const first = new Int16Array(1024).fill(-1),
      second = first.slice();
    first[1] = 3;
    second[2] = 4;
    one.record('0,0', first);
    two.record('0,0', second);
    await Promise.all([flush(one), flush(two)]);
    const jr = new Journal(),
      reader = new Archive(scope, jr, () => {});
    await flush(reader);
    reader.load(['0,0']);
    await new Promise((resolve, reject) => {
      let n = 0;
      const id = setInterval(() => {
        if (jr.tile(1, 0) === 3 && jr.tile(2, 0) === 4) {
          clearInterval(id);
          resolve();
        } else if (n++ > 100) {
          clearInterval(id);
          reject(Error('Concurrent discoveries lost'));
        }
      }, 10);
    });
    check(jr.tile(0, 0) === undefined, 'Concurrent merge kept fog');
    // Quota/transaction failure: queued edits remain and a retry persists them.
    const transaction = one.db.transaction.bind(one.db);
    one.db.transaction = () => {
      throw new DOMException('Full', 'QuotaExceededError');
    };
    first[1] = 4;
    one.record('0,0', first);
    await one.flush();
    check(one.status === 'unavailable' && one.pending.size === 1, 'Failed write retains dirty cells');
    one.db.transaction = transaction;
    one.retryAt = 0;
    await flush(one);
    // Legacy snapshots migrate once; recovery records contain only unacknowledged changes.
    const legacy = new Journal();
    legacy.restore(JSON.stringify({ v: 1, chunks: [['3,0', 'D' + '.'.repeat(1023)]] }));
    const migrated = new Archive(prefix + '9', legacy, () => {});
    await flush(migrated);
    check(migrated.seen(96, 0) && !migrated.seen(97, 0), 'Legacy fog migration');
    const newer = new Int16Array(1024).fill(-1);
    newer[0] = 4;
    migrated.record('3,0', newer);
    await flush(migrated);
    const clean = new Archive(prefix + '9', legacy, () => {}, migrated.recovery());
    await flush(clean);
    const fresh = new Journal(),
      freshArchive = new Archive(prefix + '9', fresh, () => {}, '');
    await flush(freshArchive);
    freshArchive.load(['3,0']);
    await new Promise((resolve, reject) => {
      let n = 0;
      const id = setInterval(() => {
        if (fresh.tile(96, 0) === 4) {
          clearInterval(id);
          resolve();
        } else if (n++ > 100) {
          clearInterval(id);
          reject(Error('Old snapshot overwrote migrated terrain'));
        }
      }, 10);
    });
    // Simulate an interrupted save: recovery replays a dirty delta after reopening.
    newer[1] = 3;
    migrated.record('3,0', newer);
    const replay = new Archive(prefix + '9', new Journal(), () => {}, migrated.recovery());
    await flush(replay);
    check(replay.seen(97, 0), 'Recovery replay');
    await Promise.all([migrated.close(), clean.close(), freshArchive.close(), replay.close()]);
    // Separate seed and identity must not inherit this history.
    const isolated = new Archive(prefix + '8', new Journal(), () => {});
    await flush(isolated);
    check(!isolated.seen(1, 0), 'Seed isolation');
    const strangerScope = `eigen.atlas:other-${Date.now()}:7`,
      stranger = new Archive(strangerScope, new Journal(), () => {});
    await flush(stranger);
    check(!stranger.seen(1, 0), 'Identity isolation');
    stranger.record('0,0', first);
    await flush(stranger);
    await isolated.close();
    // Erasure tombstone prevents another still-open tab from resurrecting deleted chart pages.
    await one.erase(prefix);
    const survivor = new Archive(strangerScope, new Journal(), () => {});
    await flush(survivor);
    check(survivor.seen(1, 0), 'Deletion preserves unrelated accounts');
    await Promise.all([survivor.close(), stranger.close()]);
    two.record('0,0', second);
    await two.flush();
    const empty = new Archive(scope, new Journal(), () => {});
    await empty.flush();
    check(empty.discovery.size === 0, 'Deletion removes every page');
    await Promise.all([two.close(), reader.close(), empty.close()]);
    return { pages: a.archive.discovery.size, resident: a.journal.chunks.size, key: a.key };
  });
  assert.ok(checks.pages >= 620);
  console.log('Archive writes, eviction, fog, concurrent merge, retry, isolation and deletion passed', checks);
  await page.reload();
  await page.waitForFunction(
    () => window.__eigen?.state().ready && window.__eigen.game.ext.atlas.archive?.status === 'saved',
    null,
    { timeout: 60000 },
  );
  await page.evaluate(() => {
    const g = window.__eigen.game;
    g.app.ticker.maxFPS = 10;
    g.ext.atlas.toggle();
    g.ext.atlas.centre = { x: 3202, y: 3202, name: '' };
  });
  const chunks = await page.evaluate(() => window.__eigen.state().chunks);
  await page.waitForFunction(() => window.__eigen.game.ext.atlas.journal.tile(3202, 3202) === 3, null, {
    timeout: 20000,
  });
  assert.equal(
    await page.evaluate(() => window.__eigen.state().chunks),
    chunks,
    'Archive pan must not generate terrain',
  );
  assert.equal(await page.evaluate(() => window.__eigen.game.ext.atlas.journal.tile(3203, 3202)), undefined);
  await page.screenshot({ path: `/tmp/atlas-archive-${new URL(base).port}.png` });
  await page.evaluate(async () => {
    const a = window.__eigen.game.ext.atlas;
    await a.forgetAll();
    if (a.key || a.journal.chunks.size) throw Error('Chart deletion did not clear live state');
  });
  assert.deepEqual(errors, []);
  console.log('Reload, lazy viewport loading, no terrain generation, live deletion and console checks passed');
} finally {
  await browser.close();
}
