# EIGENLANDS

A browser multiplayer, infinite, pixel-art open-world RPG where progression is powered by quantum circuits.
This repository currently contains **Phase 1: Core** (see `docs/superpowers/specs/2026-10-21-phase1-core-design.md`).

## What works today (Phase 1)
- Infinite deterministic world: 32x32 chunks from a seed (simplex height/moisture/temperature/"quantum flux"), streamed on demand. One biome (Phase Meadows) with water, sand, trees, rocks, flowers, glowing "phase bloom" tiles, camps and a spawn shrine.
- Real-time action combat: 8-way movement, dash with i-frames, 3-hit sword combo, aimed skill shot, telegraphed enemies (Wisp Slime, Glint Hopper), XP and levels, death and respawn.
- Authoritative Colyseus server at 20 Hz with client-side prediction + reconciliation, entity interpolation, lag-compensated melee (250 ms rewind), per-client interest management (2-chunk radius), binary acks.
- Day/night: 24 real minutes per day, smooth ambient colour, per-tile lights (torches, blooms), night makes enemies stronger; 4 seasons of 7 days (clock/season shown, gameplay effects arrive with farming).
- Accounts: guest play (device secret) upgradable in place to Google sign-in; no passwords stored; account deletion; Postgres persistence (characters, chunk edits as diffs) with migrations; Redis presence.
- Smash rocks/trees (E): the edit is saved as a chunk diff and survives restarts.
- Accessibility: remappable keys, colour-blind modes, text size, reduce motion, high-contrast HUD, sound captions, keyboard/mouse/gamepad/touch.

## Run it
Requires Node 22+, PostgreSQL 16, Redis 7 (`docker compose up -d` provides both).
```bash
cp .env.example .env            # optional; defaults work with docker-compose
npm install
npm run dev:server              # http://localhost:2567  (runs migrations on start)
npm run dev:client              # http://localhost:5173
```
Useful URLs/flags: `?hour=12` pins the in-game clock (screenshots/testing); `F3` shows fps, ping, prediction correction and netcode stats.

Google sign-in: set `GOOGLE_CLIENT_ID` (a Web OAuth client id) on the server; the client fetches it from `/api/auth/config`. Without it the game runs guest-only.

## Tests and tools
```bash
npm test                                  # shared + server (real Postgres/Redis) + client unit tests
npm run typecheck
node packages/client/e2e/smoke.mjs        # headless Chromium: login, move, fight, stream chunks, reload
node packages/client/e2e/multi.mjs        # two players + phone/touch emulation
npx tsx packages/server/tools/loadtest.ts 100 20   # bot load test; reads /metrics
```
Server metrics: `GET /metrics` (players, enemies, tick time avg/max, over-budget ticks).

## Layout
`packages/shared` deterministic game code used by both sides (sim, worldgen, chunks, protocol, schema) · `packages/server` Colyseus room, auth, DB · `packages/client` PixiJS client + procedural art · `docs/` design, style guide, privacy.

## Honest status and known limits
- Verified here: unit/integration tests, headless-browser play, a 100-bot load test (avg tick ~14 ms with everyone in one view). **Not verified:** real Google OAuth (tested through an injectable verifier), 60 fps on real GPUs/phones (software WebGL in CI gives ~20-40 fps; JS frame cost is ~2-3 ms), 1,000 players per shard (needs spatial hashing, worker sharding: Phase 4/6), 150 ms-ping feel on a real WAN (prediction is tested deterministically, not with injected latency).
- Single world room per process; sharding, parties, chat, trading arrive in Phase 4.
- No gathering/crafting/NPCs yet (Phase 2) and no Circuit Board/classes (Phase 3); only the placeholder "Wanderer" exists.
