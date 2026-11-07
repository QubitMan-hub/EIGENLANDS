# Connected World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver distinct settlement tiers and environment-driven cave, realm and world-event behavior within the existing cozy pixel-art game.

**Architecture:** Extend current deterministic generators and existing gameplay modules. Gate changed settlement geometry at generation 7, retain legacy generation branches, and use shared locality policies for authoritative inhabitants and events. Independent settlement, cave/realm and event modules can be implemented separately and integrated through current APIs.

**Tech Stack:** TypeScript, PixiJS, Colyseus/in-browser solo authority, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-11-07-connected-world-design.md`.

## Global Constraints

- Preserve the isometric pixel-art style.
- Keep generation performant for the browser, with lazy discovery, bounded caches and bounded encounter searches.
- Existing saved revisions 1–6 retain their geometry and stable landmark IDs.
- Village → town → medium town → big town → kingdom capital must differ in size, population, layout, architecture, services, defenses and farmland.
- Roads connect useful destinations and buildings have accessible entrances.

## Review Focus

- Generation 6 and 7 queried alternately for the same seed must never share incompatible cached layouts.
- Large props must not block doors, bridges, gates, work spots or puzzle routes.
- Larger populations remain bounded and use reachable roles/locations.
- Cave/realm safe arrivals and settlements cannot receive hostile encounter spawns.
- Events with unsuitable weather/habitat or a full inventory cannot consume a reward incorrectly.

### Task 1: Finish living-world movement and routines

**Files:** `packages/client/src/game/ambient.ts`, `packages/shared/src/{path,weather,ecology,npcs}.ts`, `packages/server/src/systems/village/index.ts`, focused tests.

- [x] Add weighted pathfinding, recovery visibility checks, seasonal work/festivals, animal shelter and biome insect rules.
- [x] Run focused regression tests, including full simulated village day and baseline failure checks for ambient navigation.
- [x] Correct reviewed pigeon roost target and rerun focused checks.

### Task 2: Five procedural settlement tiers

**Files:** new `packages/shared/src/settlement-tiers.ts`; `frontier.ts`, `realm-towns.ts`, `realm-npcs.ts`, `realms.ts`; new multi-seed tier tests.

**Interfaces:** optional `RealmSite.tier`; preserve `SiteKind` compatibility; `frontierSite`/`frontierTown` accept generation; existing `buildRealmTown(site, seed, generation)` remains entry point.

- [x] Write failing tests for all five tiers, deterministic variation, increasing physical size/population, farms, services, defenses and accessible entrances over multiple seeds.
- [x] Implement tier profiles and generation-7 branches without changing legacy random streams; scale existing layout/architecture/castle algorithms.
- [x] Verify focused tier and existing frontier/realm-town tests, including object-aware flood fills.

### Task 3: Generation and population integration

**Files:** `world-version.ts`, server `config.ts`, `worldgen.ts`, `town.ts`, client `game/life.ts`, shared exports and revision tests.

- [x] Add revision-7 metadata/config support, preserving explicit revision 6.
- [x] Isolate generation-sensitive caches and propagate generation to frontier/coast lookups.
- [x] Use tier profiles in bounded nearby resident populations and distinguish settlement tiers in discovery information.
- [x] Test mixed-revision cache access, saved revisions, generated chunk reproducibility and per-tier population budgets.

### Task 4: Cave and realm locality

**Files:** shared locality policies plus `caves2.ts`, `otherworlds.ts`, server cave/otherworld modules and focused locality tests.

**Interfaces:** shared deterministic cave-district and realm-room descriptors; existing generators and gameplay module hooks remain authoritative.

- [x] Write failing tests for geology-appropriate hazards/guardians, useful route descriptions and room-appropriate inhabitants/resources.
- [x] Integrate descriptors with actual signs, encounter selection and existing resource/scenery hooks; preserve established connected routes and puzzle gates.
- [x] Verify multiple seeds, safe arrivals, cave paths and realm landmarks using existing connectivity suites.

### Task 5: Actionable local world events

**Files:** `packages/shared/src/wonders.ts`, server `features/wonders/index.ts`, focused event tests.

- [x] Write failing eligibility/reward tests for events tied to local weather, season, cave/realm conditions.
- [x] Extend the existing deterministic/authoritative event and interaction flow, retaining cooldowns, persistence, reward safety and bounded generation.
- [x] Verify real prop/reward interactions and rejection in unsuitable contexts.

### Task 6: Integration and evidence

- [x] Review all changes, address concrete findings and rerun affected checks.
- [x] Run `npm run typecheck`, `npm run lint`, `npm run build:pages` and relevant test suites.
- [x] Record multi-seed counts, route/accessibility outcomes and generation budgets in a short validation report.
- [x] Run browser playtests if local network permissions are available; otherwise report that limitation.

## Verification handoff

The full shared suite passed 380 tests before the final reserved-plane regression was added; the affected generation/frontier/tier suites then passed all 17 tests including that regression. Focused server verification passed 62 tests across 11 files. The client suite passed 197 tests and retained three existing creature-pixel failures. Browser and socket-based integration checks were attempted and are blocked by the sandbox. See `docs/validation/connected-world/README.md` for the seed report and limits.
