# World overhaul implementation status

This document tracks the pasted master request. **The full overhaul is not implemented.** Landmark IDs, towns and persisted edits are preserved; the subsequent controlled surface-hydrology revision is detailed below. No unused placeholder generator or cosmetic elevation has been presented as a finished migration.

## Implemented in this batch

- Game FPS now counts completed frames in a one-second wall-time window. Existing browser/debug/e2e FPS logs consume the corrected value. Unit tests cover uneven frame timing, stalls, startup and clock reset.
- Biome cache keys include the full seed and full coordinates, including fractional coordinates. Bounded maps avoid 16-bit wrapping and cross-seed collisions. Cold-reference regression tests cover two colliding seeds and coordinates 65,536 tiles apart.
- Pixi is split from the main application bundle. Both normal and solo builds and browser verification are required.
- CI gains actual `e2e:solo` browser verification, alongside the production Docker save/restart/export smoke.
- Failed-setup cleanup is guarded in the affected single-line server `afterAll` app teardowns. This does not replace database tests with fake passing results.
- A reusable `tools/worldgen-audit.mjs` renders three-seed biome and continuous-height PNG maps, tile/land/biome percentages, sampled component sizes and transitions along five 1,000-tile walks. Its optional source-module argument supports comparing generator versions.

[Before/after reports and maps](validation/worldgen-before-after/) compare main `e3012a1` with the cache correction. All three sampled topology/statistics results are identical; this is compatibility evidence for the cache fix, **not evidence of a new terrain generator**. Current height maps show continuous legacy climate height, not gameplay elevation. Region measurements use 2-tile sampling and cannot certify sub-sample features or all-world connectivity.

## Subsequent delivered work

- Veyr, the Stormbound Colossus: the user's original boss design adapted into four isometric facings, compact palette atlas, craftable level-22 overworld encounter, warned fixed strikes, poise interruption, recovery, unique loot and durable victory. [Encounter guide](STORMBOUND.md).
- Creature art: palette-only `Scene` output and imported wildlife/Veyr atlases, selective contours, common wildlife scale/foot anchors and normalized companion portraits. Complete rendered atlas pixels are checked in a browser, including transparent coverage, original animation lengths and nearest filtering. [Before/after evidence](validation/creature-art/). This does not certify every shader/UI art path or finish tree branching.
- Surface hydrology revision 2: broad connected fen basins, less total sampled fen water, much less fragmentation, quiet clustered reed edges, rare surface lava/scree. Real persisted generation metadata, WELCOME, chunk/worker version keys, ownership/position migration and legacy landmark reproducibility support this revision. [Hydrology guide and evidence](HYDROLOGY.md). Climate remains the legacy climate; this is not the proposed full region/erosion/elevation generator.
- Formatting tools: ESLint and Prettier cover existing source/scripts/docs/config with a full legacy-format migration, 120-column executable-code checks and mandatory CI. String/template/regex literals, URLs and comments retain explicit length exceptions; unused declaration cleanup is outside this policy. No nominal empty config or blanket exclusion of legacy source was added.
- Database-free server tests: automatic explicit selection of real LocalDb/LocalRepo/LocalRepo34 adapters, real rooms/auth/trade/progression/persistence contracts, native audit inspection and atomic batch writes. PostgreSQL readiness outage and Redis bus tests are visibly skipped in memory mode and mandatory in service-backed CI. Production remains PostgreSQL-only. [Test guide](TEST_STORAGE.md).

## Still required

1. Extend the delivered hydrology version boundary to the full replacement climate/generator. Pin existing worlds to their climate/generation rather than automatically applying an incompatible full rebuild. Preserve town/landmark IDs and edit precedence with additional migration fixtures. Hydrology-only revision 1→2 already has real ownership/position fixtures.
2. Domain-warped Worley regions, shared low-frequency climate fields, latitudinal temperature/rain shadows, plausible climate adjacency/ecotones and a broad home-vale frontier. Current regions still miss the requested size/transition targets.
3. Seam-stable regional terrain erosion and priority-flood drainage, rivers/ravines/bridges, gentle beaches, broad connected swamp pools and town-edge flattening. Independent per-chunk erosion would create seams and is not an acceptable substitute.
4. Deterministic Poisson/cluster object placement with biome-specific density, slope-aware rock fields and species variants, retaining existing ore-vein and authored-object priorities. Current tree/scatter algorithms remain.
5. Actual 6–10-level chunk data and protocol, cliff/ramp/stair/ladder generation, flood-fill accessibility repair and three-seed connectivity tests. Then edge-aware collision/pathfinding, predicted/server movement, projectiles/line-of-sight/high-ground range, actor/prop elevation, camera height and cliff occlusion. Renderer-only lifting would leave invisible collision and is not implemented.
6. Save migration for occupied positions, elevations and constructed flat ground, with rollback/version compatibility and real multiplayer persistence checks.
7. Finish the wider art audit and original multi-canopy tree branching/species variants. Creature palette output, selective contours, wildlife normalization and semantic projectile accents are implemented and checked on real rendered pixels; this does not certify every asset/shader/UI path.
8. Formatting migration is delivered. Continue running the mandatory lint/format checks; any later unused-declaration cleanup or additional lint policy must be explicit.
9. Database-free fallback is delivered with real browser-store contracts, transactions, persistence and explicit external-service exceptions. Keep the independent PostgreSQL/Redis and Docker persistence jobs mandatory.
10. Full before/after gameplay screenshots of every biome, cliffs/ramps/stairs and height-level maps once those systems exist. Current top-down continuous-height baselines do not satisfy that visual acceptance requirement.

The strict $0 Render trial is a separate delivered deployment slice: [RENDER_FREE.md](RENDER_FREE.md). Its 21-client local free-CPU performance gate failed; permanent lag-free multiplayer has not been claimed.
