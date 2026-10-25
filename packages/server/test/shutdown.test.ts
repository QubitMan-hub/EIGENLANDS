import { expect, it } from 'vitest';
import { boot, spawn } from './p2';
import { startApp } from './helpers';
it('awaits connected-player saves and closes once when shutdown is requested concurrently', async () => {
  const app = await boot(),
    p = await spawn(app, 'Closing player');
  p.sp.sim.x = 10.5;
  p.sp.sim.y = 4.5;
  p.sp.data.coins = 456;
  try {
    await Promise.all([app.close(), app.close()]);
  } finally {
    await app.close();
  }
  const reloaded = await startApp();
  try {
    const saved = await reloaded.repo.getCharacter(p.accountId);
    expect(saved?.x).toBe(10.5);
    expect(saved?.y).toBe(4.5);
    expect(saved?.data.coins).toBe(456);
  } finally {
    await reloaded.close();
  }
});
