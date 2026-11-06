import { expect, it, vi } from 'vitest';
import { handleUse } from '../src/systems/tools';
import type { RoomApi } from '../src/systems/api';
import type { ServerPlayer } from '../src/rooms/player';
function fixture() {
  let release!: () => void;
  const loading = new Promise<void>((resolve) => (release = resolve));
  const touched = vi.fn(() => {
    throw new Error('passed tool preflight');
  });
  const room = { ensureChunk: () => loading, store: { objectAt: touched } } as unknown as RoomApi;
  const p = {
    deadT: 0,
    toolReadyAt: 0,
    sim: { x: 0.5, y: 0.5, mount: 0 },
    data: { inv: [{ id: 'pickaxe', n: 1 }] },
    toast: vi.fn(),
  } as unknown as ServerPlayer;
  const use = () => handleUse(room, p, { slot: 0, tx: 1, ty: 0 }).catch(() => {});
  return { p, use, release, touched };
}
it('rejects a tool request if the player moved away while its chunk loaded', async () => {
  const f = fixture(),
    pending = f.use();
  f.p.sim.x = 100;
  f.release();
  await pending;
  expect(f.touched).not.toHaveBeenCalled();
});
it('reserves one cooldown for tool requests waiting on the same chunk', async () => {
  const f = fixture(),
    pending = [f.use(), f.use(), f.use()];
  f.release();
  await Promise.all(pending);
  expect(f.touched).toHaveBeenCalledTimes(1);
});
it('rejects a tool removed from its slot during chunk loading', async () => {
  const f = fixture(),
    pending = f.use();
  f.p.data.inv[0] = null;
  f.release();
  await pending;
  expect(f.touched).not.toHaveBeenCalled();
});
