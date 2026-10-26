import { afterEach, expect, it, vi } from 'vitest';
import { prepareWorldChunk, hasPreparedWorldChunk } from '@eigenlands/shared';
import { WorldPreparer } from '../src/game/world-preparer';
afterEach(() => vi.unstubAllGlobals());
it('rejects a worker reply from the wrong generation without adopting it as the requested base', async () => {
  let worker: any;
  class FakeWorker {
    onmessage: any;
    onerror: any;
    sent: any[] = [];
    terminate = vi.fn();
    constructor() {
      worker = this;
    }
    postMessage(m: any) {
      this.sent.push(m);
    }
  }
  vi.stubGlobal('Worker', FakeWorker);
  const preparer = new WorldPreparer(),
    done = preparer.neighborhood(910027, 4, -5, 0, 1),
    req = worker.sent[0];
  worker.onmessage({ data: { id: req.id, chunk: prepareWorldChunk(req.seed, req.cx, req.cy, 2) } });
  await done;
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(hasPreparedWorldChunk(req.seed, req.cx, req.cy, 1)).toBe(false);
});
it('adopts worker output and unblocks initial loading', async () => {
  let worker: any;
  class FakeWorker {
    onmessage: any;
    onerror: any;
    sent: any[] = [];
    constructor() {
      worker = this;
    }
    postMessage(m: any) {
      this.sent.push(m);
    }
    terminate() {}
  }
  vi.stubGlobal('Worker', FakeWorker);
  const p = new WorldPreparer(),
    done = p.neighborhood(91417, 4, -5, 0),
    req = worker.sent[0];
  expect(p.ready(req.seed, req.cx, req.cy, req.generation)).toBe(false);
  worker.onmessage({ data: { id: req.id, chunk: prepareWorldChunk(req.seed, req.cx, req.cy) } });
  expect(p.ready(req.seed, req.cx, req.cy, req.generation)).toBe(true);
  await done;
  expect(hasPreparedWorldChunk(91417, 4, -5)).toBe(true);
  expect(worker.sent).toHaveLength(1);
});
it('cancels stale queued chunks and falls back without hanging when a worker fails', async () => {
  let worker: any;
  class FakeWorker {
    onmessage: any;
    onerror: any;
    sent: any[] = [];
    constructor() {
      worker = this;
    }
    postMessage(m: any) {
      this.sent.push(m);
    }
    terminate() {}
  }
  vi.stubGlobal('Worker', FakeWorker);
  const p = new WorldPreparer(),
    old = p.neighborhood(91418, 0, 0, 1),
    next = p.neighborhood(91418, 99, 99, 0);
  worker.onerror({ preventDefault() {} });
  await Promise.all([old, next]);
  expect(worker.sent).toHaveLength(1);
  expect(p.ready(91418, 100, 100, 1)).toBe(true);
  await p.neighborhood(91418, 100, 100, 1);
  expect(worker.sent).toHaveLength(1);
});
