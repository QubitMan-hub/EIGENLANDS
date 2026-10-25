import {
  acceptPreparedWorldChunk,
  hasPreparedWorldChunk,
  LEGACY_GENERATION,
  type WorldGeneration,
  type PreparedWorldChunk,
} from '@eigenlands/shared';
type Task = {
  generation: WorldGeneration;
  id: number;
  seed: number;
  cx: number;
  cy: number;
  resolve: () => void;
  promise: Promise<void>;
};
/** One background chunk worker warms the same bounded caches used by drawing and solo authority. */
export class WorldPreparer {
  private worker: Worker | null = null;
  private tasks = new Map<string, Task>();
  private queue: Task[] = [];
  private running: Task | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private id = 0;
  private area = '';
  constructor() {
    if (typeof Worker === 'undefined') return;
    try {
      this.worker = new Worker(new URL('../workers/worldgen.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }: { data: { id: number; chunk?: PreparedWorldChunk } }) => {
        const t = this.running;
        if (!t || data.id !== t.id) return;
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        if (
          !data.chunk ||
          data.chunk.generation !== t.generation ||
          data.chunk.seed !== t.seed ||
          data.chunk.cx !== t.cx ||
          data.chunk.cy !== t.cy
        ) {
          this.disable();
          return;
        }
        try {
          acceptPreparedWorldChunk(data.chunk);
        } catch {
          this.disable();
          return;
        }
        this.tasks.delete(this.key(t.seed, t.cx, t.cy, t.generation));
        this.running = null;
        t.resolve();
        this.pump();
      };
      this.worker.onerror = (e) => {
        e.preventDefault();
        this.disable();
      };
    } catch {
      this.disable();
    }
  }
  private key(seed: number, cx: number, cy: number, generation: WorldGeneration) {
    return `${generation}:${seed}:${cx},${cy}`;
  }
  private disable() {
    this.worker?.terminate();
    this.worker = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const t of this.tasks.values()) t.resolve();
    this.tasks.clear();
    this.queue = [];
    this.running = null;
  }
  private pump() {
    if (!this.worker || this.running || !this.queue.length) return;
    const t = (this.running = this.queue.shift()!);
    this.timer = setTimeout(() => this.disable(), 10000);
    try {
      this.worker.postMessage({ id: t.id, seed: t.seed, cx: t.cx, cy: t.cy, generation: t.generation });
    } catch {
      this.disable();
    }
  }
  private request(seed: number, cx: number, cy: number, generation: WorldGeneration): Promise<void> {
    if (!this.worker || hasPreparedWorldChunk(seed, cx, cy, generation)) return Promise.resolve();
    const k = this.key(seed, cx, cy, generation),
      old = this.tasks.get(k);
    if (old) return old.promise;
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
        resolve = r;
      }),
      t = { id: ++this.id, seed, cx, cy, generation, resolve, promise };
    this.tasks.set(k, t);
    this.queue.push(t);
    this.pump();
    return promise;
  }
  neighborhood(
    seed: number,
    cx: number,
    cy: number,
    radius: number,
    generation: WorldGeneration = LEGACY_GENERATION,
  ): Promise<void> {
    const coords: Array<[number, number]> = [];
    for (let y = cy - radius; y <= cy + radius; y++)
      for (let x = cx - radius; x <= cx + radius; x++) coords.push([x, y]);
    coords.sort((a, b) => (a[0] - cx) ** 2 + (a[1] - cy) ** 2 - (b[0] - cx) ** 2 - (b[1] - cy) ** 2);
    const wanted = new Set(coords.map(([x, y]) => this.key(seed, x, y, generation)));
    for (const t of this.queue)
      if (!wanted.has(this.key(t.seed, t.cx, t.cy, t.generation))) {
        this.tasks.delete(this.key(t.seed, t.cx, t.cy, t.generation));
        t.resolve();
      }
    this.queue = this.queue.filter((t) => wanted.has(this.key(t.seed, t.cx, t.cy, t.generation)));
    return Promise.all(coords.map(([x, y]) => this.request(seed, x, y, generation))).then(() => {});
  }
  stream(seed: number, cx: number, cy: number, generation: WorldGeneration = LEGACY_GENERATION): void {
    const area = this.key(seed, cx, cy, generation);
    if (area === this.area) return;
    this.area = area;
    void this.neighborhood(seed, cx, cy, 3, generation);
  }
}
