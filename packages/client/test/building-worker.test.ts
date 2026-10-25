import { afterEach, expect, it, vi } from 'vitest';
import { BuildingArtWorker } from '../src/art/building-worker-client';
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('falls back instead of leaving invisible buildings when a painter worker stops responding', async () => {
  vi.useFakeTimers();
  let stopped = false;
  class FakeWorker {
    onmessage: any;
    onerror: any;
    postMessage() {}
    terminate() {
      stopped = true;
    }
  }
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal('OffscreenCanvas', class {});
  const w = new BuildingArtWorker(),
    pending = w.request({ id: 'test', kind: 'house', x: 0, y: 0, w: 6, h: 5, doorX: 3, doorY: 4, style: 0 });
  expect(w.available).toBe(true);
  await vi.advanceTimersByTimeAsync(10000);
  expect(await pending).toBeNull();
  expect(stopped).toBe(true);
  expect(w.available).toBe(false);
});
