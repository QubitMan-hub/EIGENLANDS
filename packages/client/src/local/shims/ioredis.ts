/**
 * `ioredis` stand-in for the single-player build. The server only imports it for its Redis-backed presence, bus and
 * shard locks; solo mode always uses their in-memory variants, so constructing a client is a bug.
 */
export class Redis {
  constructor() { throw new Error('Redis is not available in the single-player browser build'); }
}
export class Cluster extends Redis {}
export default Redis;
