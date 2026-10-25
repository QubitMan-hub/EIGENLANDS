import type { ProgressStore } from '../db/repo34';
import type { Bus } from './bus';
import type { ShardLocks } from './shard/locks';

/** Process-wide Phase 3/4 dependencies (set by createApp). */
export interface Runtime34 {
  repo34: ProgressStore;
  bus: Bus;
  locks: ShardLocks;
}

let rt: Runtime34 | null = null;
export const setRuntime34 = (r: Runtime34) => {
  rt = r;
};
export const runtime34 = (): Runtime34 => {
  if (!rt) throw new Error('runtime34 not initialised');
  return rt;
};
