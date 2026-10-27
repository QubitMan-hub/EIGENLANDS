import { expect, it, vi } from 'vitest';
import { MSG } from '@eigenlands/shared';
import { tickFishing, handleHook } from '../src/systems/fishing';
import type { RoomApi } from '../src/systems/api';
import type { ServerPlayer } from '../src/rooms/player';
function fixture(extra = {}) {
  const p = {
    sim: { x: 0.5, y: 0.5, cart: 0, mount: 0, dashT: 0, atkCd: 0, ...extra },
    deadT: 0,
    rhythm: null,
    cast: { id: 'cast', tx: 1, ty: 0, state: 'wait', biteAt: 1000, deadline: 2000 },
    client: { send: vi.fn() },
    toast: vi.fn(),
  } as unknown as ServerPlayer;
  const room = { players: new Map([['p', p]]) } as unknown as RoomApi;
  return { p, room };
}
for (const state of [{ cart: 1 }, { mount: 1 }, { dashT: 0.1 }, { atkCd: 0.2 }, { hold: 1 }, { charge: 0.5 }])
  it(`ends fishing when another action takes over: ${JSON.stringify(state)}`, () => {
    const { p, room } = fixture(state);
    tickFishing(room, 0);
    expect(p.cast).toBeNull();
    expect(p.client.send).toHaveBeenCalledWith(MSG.FISH_CAST, expect.objectContaining({ id: 'cast', ended: true }));
    tickFishing(room, 0);
    expect(p.client.send).toHaveBeenCalledTimes(1);
  });
it('allows peaceful boat fishing', () => {
  const { p, room } = fixture({ boat: 1 });
  tickFishing(room, 0);
  expect(p.cast).not.toBeNull();
  expect(p.client.send).not.toHaveBeenCalled();
});
it('revalidates an interrupted cast when a hook arrives before the next tick', () => {
  const { p, room } = fixture({ dashT: 0.1 });
  handleHook(room, p, { id: 'cast' });
  expect(p.cast).toBeNull();
  expect(p.client.send).toHaveBeenCalledWith(MSG.FISH_CAST, expect.objectContaining({ ended: true }));
});
