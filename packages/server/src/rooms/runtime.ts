import type { Config } from '../config';
import type { RepoStore } from '../db/repo';
import type { Presence } from '../presence';
import type { GoogleVerifier } from '../auth/google';
import { ServerClock } from '../systems/clock';

/** Process-wide dependencies handed to rooms (Colyseus instantiates rooms itself). */
export interface Runtime {
  config: Config;
  repo: RepoStore;
  presence: Presence;
  googleVerify: GoogleVerifier | null;
  /** tests set this to 0 to disable ambient enemy spawning */
  ambientSpawns: boolean;
}

/** Live-tunable knobs (tests shrink them). `pace` scales rhythm lead-in and fish bite waits. */
export const tuning = { pace: 1, toolCooldownMs: 300 };

let rt: Runtime | null = null;
let clock: ServerClock | null = null;
export const setRuntime = (r: Runtime) => {
  rt = r;
  clock = null;
};
export const runtime = (): Runtime => {
  if (!rt) throw new Error('runtime not initialised');
  return rt;
};
/** The world clock (fresh, offset 0, whenever a new app is created). `worldClock().setOffset/advanceDays` shift time in tests. */
export const worldClock = (): ServerClock => (clock ??= new ServerClock(runtime().config.worldSeed));
