# World overhaul implementation status

This document tracks the pasted master request. **The full overhaul is not implemented.** Current playable generation, landmark IDs, towns and persisted edits are preserved. No unused placeholder generator or cosmetic elevation has been presented as a finished migration.

## Implemented in this batch

- Game FPS now counts completed frames in a one-second wall-time window. Existing browser/debug/e2e FPS logs consume the corrected value. Unit tests cover uneven frame timing, stalls, startup and clock reset.
- Biome cache keys include the full seed and full coordinates, including fractional coordinates. Bounded maps avoid 16-bit wrapping and cross-seed collisions. Cold-reference regression tests cover two colliding seeds and coordinates 65,536 tiles apart.
- Pixi is split from the main application bundle. Both normal and solo builds and browser verification are required.
- CI gains actual `e2e:solo` browser verification, alongside the production Docker save/restart/export smoke.
- Failed-setup cleanup is guarded in the affected single-line server `afterAll` app teardowns. This does not replace database tests with fake passing results.
- A reusable `tools/worldgen-audit.mjs` renders three-seed biome and continuous-height PNG maps, tile/land/biome percentages, sampled component sizes and transitions along five 1,000-tile walks. Its optional source-module argument supports comparing generator versions.

[Before/after reports and maps](validation/worldgen-before-after/) compare main `e3012a1` with the cache correction. All three sampled topology/statistics results are identical; this is compatibility evidence for the cache fix, **not evidence of a new terrain generator**. Current height maps show continuous legacy climate height, not gameplay elevation. Region measurements use 2-tile sampling and cannot certify sub-sample features or all-world connectivity.

## Still required

1. A persisted world-generation version carried through world metadata, chunk preparation/workers, authority and rendering. Existing worlds must stay on their current generation; town/landmark IDs and player edit precedence need migration fixtures before enabling a replacement.
2. Domain-warped Worley regions, shared low-frequency climate fields, latitudinal temperature/rain shadows, plausible climate adjacency/ecotones and a broad home-vale frontier. Current regions still miss the requested size/transition targets.
3. Seam-stable regional terrain erosion and priority-flood drainage, rivers/ravines/bridges, gentle beaches, broad connected swamp pools and town-edge flattening. Independent per-chunk erosion would create seams and is not an acceptable substitute.
4. Deterministic Poisson/cluster object placement with biome-specific density, slope-aware rock fields and species variants, retaining existing ore-vein and authored-object priorities. Current tree/scatter algorithms remain.
5. Actual 6–10-level chunk data and protocol, cliff/ramp/stair/ladder generation, flood-fill accessibility repair and three-seed connectivity tests. Then edge-aware collision/pathfinding, predicted/server movement, projectiles/line-of-sight/high-ground range, actor/prop elevation, camera height and cliff occlusion. Renderer-only lifting would leave invisible collision and is not implemented.
6. Save migration for occupied positions, elevations and constructed flat ground, with rollback/version compatibility and real multiplayer persistence checks.
7. Palette-only art, consistent actor/creature outlines, critter normalization, original multi-canopy tree branching/species variants and semantic saturated quantum colors. The existing mixed art paths have not been falsely marked compliant. A source-literal test alone would not validate generated pixel colors.
8. ESLint/Prettier with a 120-column policy and a deliberate legacy-format migration; no nominal configuration has been added that silently ignores existing violations.
9. Server-test fallback using the real browser-store contracts, including Repo34/transaction/persistence behavior and an explicit treatment of SQL-specific tests. Current server integration tests still require PostgreSQL. Restoring a local test database is not an in-memory fallback.
10. Full before/after gameplay screenshots of every biome, cliffs/ramps/stairs and height-level maps once those systems exist. Current top-down continuous-height baselines do not satisfy that visual acceptance requirement.

The strict $0 Render trial is a separate delivered deployment slice: [RENDER_FREE.md](RENDER_FREE.md). Its 21-client local free-CPU performance gate failed; permanent lag-free multiplayer has not been claimed.
