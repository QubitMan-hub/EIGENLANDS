# EIGENLANDS Phase 1: Core — Design

Scope (from the brief): movement, combat, one biome with infinite chunk generation, day/night, Google login, saving. Delegated approval: the owner asked for best-judgement decisions without further questions.

## Decisions
- **Server framework:** Colyseus (rooms, binary delta schema sync, reconnection).
- **Layout:** npm workspaces monorepo: `shared` (pure deterministic code), `server`, `client`.
- **Determinism:** movement, collision, combat rules and worldgen live in `shared` and run identically on server and client (client prediction + reconciliation).
- **Art:** original pixel art generated procedurally in code from a fixed 48-colour palette (no third-party assets, no licence risk). A style guide lives in `docs/style-guide.md`.
- **Auth:** Google ID token verified server-side (google-auth-library); server issues an HMAC-signed session token. Guests get a random device secret; "upgrade" links a Google `sub` to the same account. No passwords.
- **Storage:** Postgres (accounts, characters, chunk_diffs, migrations); Redis (presence + session tokens, optional, degrades to in-memory when absent in dev).

## Simulation
- Fixed step 20 Hz (`TICK_DT = 50 ms`). Player input is a `{seq, dx, dy, dash, attack, aimX, aimY}` command per tick. Server applies commands in order, replies with last processed `seq` in the schema; client rewinds to the authoritative state and replays unacknowledged inputs.
- Movement: 8-way, speed 4 tiles/s, dash (dodge) 0.18 s at 3x speed with i-frames and cooldown. Collision: AABB against tile solidity, per-axis resolution.
- Combat: light attack 3-hit combo (arc melee), skill-shot projectile (ranged), enemy telegraphs (windup ring then strike), HP, damage, knockback, death/respawn. Server authoritative; hits validated against a short position history of targets (lag compensation, max 250 ms rewind).
- Enemies (Phase Meadows): Wisp Slime (chaser), Glint Hopper (leaps with telegraph). Night adds stronger variants.
- Interest management: only entities within 2 chunks of a player are present in that client's state view (`StateView`).

## World
- Chunks 32x32 tiles, deterministic from `seed`. Layers: height, moisture, temperature, "quantum flux" (simplex, seeded). Phase 1 renders one biome (Phase Meadows) with variation: grass, flowers, water ponds, sand shores, trees, rocks, with flux-driven shimmer tiles. Biome function is already multi-biome-ready (other biomes return the meadow set until Phase 5).
- Player edits stored as chunk diffs (`index -> tile id`) over the generated chunk; persisted in Postgres.
- Client requests chunks around the player, regenerates locally from seed, and applies diffs sent by the server.

## Day/night
- 24 real minutes per day, derived from server wall clock (shared by all players). Phases dawn/day/dusk/night; smooth palette tint ramp; per-tile light sources (torches/lanterns) in a lightmap rendered with multiply blending.

## Client
- PixiJS v8, 16x16 tiles, integer scaling, input: keyboard, gamepad, touch (virtual stick + buttons). HUD: HP, clock, minimap-less for now, login screen (Google button + guest), settings (reduced motion, text size).
- Entity interpolation (100 ms buffer) for remote entities.

## Testing / verification
- Unit: worldgen determinism, collision, movement step, combat resolution, token signing, chunk codec.
- Integration: server + two headless clients over a real websocket, Postgres and Redis (prediction ack, interest filtering, save/load round trip, guest upgrade).
- Browser: Playwright smoke test of the built client (renders, no console errors, moves).
- Honest limits: real Google sign-in and phone 60 fps cannot be exercised in this sandbox; the Google path is tested with an injectable verifier.

## Done checklist
Runs, no console errors, tests pass, tutorial hints explain controls in-game.
