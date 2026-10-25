import { prepareWorldChunk, type WorldGeneration } from '@eigenlands/shared';
const scope = globalThis as unknown as {
  onmessage: (
    e: MessageEvent<{ generation: WorldGeneration; id: number; seed: number; cx: number; cy: number }>,
  ) => void;
  postMessage: (m: unknown, t: Transferable[]) => void;
};
scope.onmessage = ({ data: { id, seed, cx, cy, generation } }) => {
  try {
    const chunk = prepareWorldChunk(seed, cx, cy, generation);
    scope.postMessage({ id, chunk }, [
      chunk.tiles.buffer,
      chunk.levels.buffer,
      chunk.climate.buffer,
      chunk.biomes.buffer,
    ]);
  } catch (e) {
    scope.postMessage({ id, error: String(e) }, []);
  }
};
