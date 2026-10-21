import type { Config } from '../config';
import type { Repo } from '../db/repo';
import type { Presence } from '../presence';
import type { GoogleVerifier } from '../auth/google';

/** Process-wide dependencies handed to rooms (Colyseus instantiates rooms itself). */
export interface Runtime {
  config: Config;
  repo: Repo;
  presence: Presence;
  googleVerify: GoogleVerifier | null;
  /** tests set this to 0 to disable ambient enemy spawning */
  ambientSpawns: boolean;
}

let rt: Runtime | null = null;
export const setRuntime = (r: Runtime) => { rt = r; };
export const runtime = (): Runtime => {
  if (!rt) throw new Error('runtime not initialised');
  return rt;
};
