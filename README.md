# EIGENLANDS

A browser multiplayer, infinite, isometric pixel-art open-world RPG where every skill is a quantum circuit.
Gather, farm, craft and forge in a living town; wire gates into your Circuit Board to shape your abilities; play solo
in the browser or share a world with other players.

**Play now (single-player, in the browser):** deployed from `main` to GitHub Pages by `.github/workflows/pages.yml`.

## Features
- **World** – infinite deterministic chunks from a seed, GPU isometric terrain with smooth blending, day/night, seasons, weather.
- **Village life** – the town of Hadamere with ten NPCs on schedules, dialogue, gifts, shops with dynamic prices, a quest chain, and the QubitMan statue.
- **Crafting** – tools, stations, discovery recipes, farming with superposition crops, fishing, and Interference Forging (a rhythm minigame).
- **Circuit Board** – place gates on orb lines to bias which form of each ability fires; classes Wanderer, Superposer, Entangler.
- **Combat** – WASD movement, mouse aim, armed skill shots (Q/R/F/G then left click), auto-aim at a selected target, hold right mouse to look ahead, dash, combos, telegraphed enemies.
- **Multiplayer** – authoritative 20 Hz Colyseus server with prediction, interpolation and lag compensation; parties, chat, trading, shard handoff.
- **Accounts** – guest play upgradable to Google sign-in; Postgres persistence; Redis presence.
- **Accessibility** – remappable keys, colour-blind modes, text size, reduced motion, high-contrast HUD, sound captions.

## Controls
| | |
|---|---|
| Move | `W A S D` / arrows (screen-relative) |
| Attack | left click (aims at the cursor) |
| Select target | left click an enemy or party mate · `Esc` clears |
| Abilities | `Q R F G`: quick abilities fire at once, skill shots arm an aim line, then left click fires. `V` ultimate |
| Look ahead | hold right mouse |
| Dash | `Space` / `Shift` |
| Use / talk | `E` · Pack `I` · Craft `C` · Journal `L` · Circuit Board `B` · Party `P` · Chat `Enter` |

## Repository layout
```
packages/
  shared/   deterministic game code used by client and server (sim, worldgen, rules, protocol, schema)
  server/   Colyseus world room, game systems, village AI, Circuit/social features, auth, Postgres migrations
  client/   PixiJS client: renderer, procedural art, UI, input, in-browser solo server (src/local)
    labs/   art-lab and UI-lab pages for reviewing sprites and panels (dev server only)
e2e/        headless-browser checks (smoke, solo, multiplayer, UI/art screenshots)
docs/
  design/   specs per phase · art/ style guide · legal/ privacy
.github/    CI and GitHub Pages workflows
```

## Run it
Requires Node 22+, PostgreSQL 16 and Redis 7 (`docker compose up -d` provides both).
```bash
cp .env.example .env            # optional; defaults work with docker-compose
npm install
npm run dev:server              # http://localhost:2567 (runs migrations on start)
npm run dev:client              # http://localhost:5173
```
No database? Build the single-player variant, which runs the real server room inside the page:
```bash
npm run preview:pages           # http://localhost:5240
```
Handy flags: `?hour=12` pins the clock, `?dev=1` enables dev commands in solo builds, `F3` shows fps and netcode stats.
Art lab: `http://localhost:5173/labs/artlab.html`, UI lab: `/labs/uilab.html`.

## Tests and tools
```bash
npm test                      # shared + server (needs Postgres/Redis) + client unit tests
npm run typecheck
npm run e2e                   # headless Chromium smoke test against the dev servers
npm run e2e:solo              # same against the Pages build (npm run preview:pages first)
npm run loadtest -- 100 20    # bot load test; the server exposes GET /metrics
```
Google sign-in: set `GOOGLE_CLIENT_ID` on the server (the client reads it from `/api/auth/config`); without it the game is guest-only.

## Status and known limits
Not verified in CI: real Google OAuth (tested through an injectable verifier), 60 fps on real GPUs and phones,
1,000 players per shard, and play at 150 ms real-world ping. See `docs/design/` for what each phase promises.
