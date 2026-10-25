# World generation revision 3 and gameplay elevation

Revision 3 is the full rebuild of the home continent and the first terrain with real height. It is a **new-world** revision: existing worlds are pinned to the revision they were created with and never change. [Hydrology revision 2](HYDROLOGY.md) was a surface-water patch and is not replaced; it remains the revision for every world that exists today.

## Version boundary

| Saved metadata (`worldgen:<seed>`)              | Characters in the database | Result                                                                  |
| ----------------------------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| `{version: 3}`                                  | any                        | revision 3, always                                                      |
| `{version: 2}` (with or without `migratedFrom`) | any                        | revision 2, always; no automatic path to 3                              |
| `{version: 1}`                                  | any                        | revision 2 through the limited hydrology migration (as before)          |
| none                                            | none (brand-new world)     | `NEW_WORLD_GENERATION` (default **3**; `2` keeps creating old worlds)   |
| none                                            | some                       | revision 2 through the hydrology migration (a legacy, unversioned save) |
| anything else                                   | any                        | the server refuses to start rather than guess                           |

- The decision is made once, when the room first opens the world, and written back, so changing `NEW_WORLD_GENERATION` later never moves a saved world. `hasWorldData()` (any character) is a new repository method on both the PostgreSQL and browser-store repositories.
- WELCOME already carries the revision. Chunk stores, worker replies and generation caches are keyed by revision; a reply for the wrong revision is rejected. Characters record the revision they were last loaded under (`PlayerData.worldGeneration`), now compared with the world's revision rather than a global constant, so the hydrology relocation still runs only for worlds migrated from revision 1.
- **Rollback**: restoring a pre-update backup beside the matching server version is the only rollback, as before. A revision-3 world cannot be opened by an older server (it refuses the unknown version). Back up before updating a live database.
- `tools/worldgen-compat.mjs <other checkout>/packages/shared/src/` compares tiles, biomes, whole chunks, authored objects, ruin/cave/shrine sites and the Hadamere site against another commit (for example the one before revision 3) for revisions 1 and 2. At this commit it reports 0 differences over 285,156 sampled tiles plus 169 whole chunks per seed and revision. The same guarantee is frozen in `packages/shared/test/terrain3.test.ts` as fingerprints of the previous main.
- **Landmark ids and town placement always use the revision-1 layout** (`sampleClimate(..., LEGACY_GENERATION)`, `landmarkTileAt`). A revision-3 world therefore has the same ruin, cave, shrine and camp ids and the same Hadamere site as any other world with its seed; only the ground around them is new. Ocean buoys and caches that the larger continent now covers are simply not placed in revision-3 worlds.

## What revision 3 generates

Everything is a pure function of `(seed, x, y)`; there is no per-chunk state, so seams cannot appear (`terrain3.test.ts` regenerates chunks in different orders and compares).

- **Land.** The home continent is a warped blob of radius ~236 tiles, unioned with the old height field so every legacy landmark site stays on land. The old sea ring, archipelago and the four port islands beyond it are unchanged. The old home continent was a ragged, holed fringe; this one is one landmass.
- **Climate.** Temperature follows latitude (cold north, hot south, temperate at the vale) plus noise; moisture is noise with a rain shadow behind high ground.
- **Regions.** Domain-warped Worley cells (~112 tiles) each carry one climate; a biome is chosen per region. Border strips use noise-clustered ecotones; incompatible neighbours (e.g. desert against tundra) are separated by a transitional biome; enchanted and corrupted regions are climate-independent. The home vale is meadow to r=82 and dissolves ragged to r=140.
- **Water.** Beaches vary in width by noise. Rivers follow the zero contours of a warped low-frequency field, so they are long, branch-free curves that close into lakes; they widen in fens, narrow in deserts, avoid the vale and Hadamere, and every few dozen tiles a ford (sand) keeps both banks connected. The land falls away to the river bed so banks are flush with the water. Fens keep the revision-2 basin lakes.
- **Objects.** Tree groves and rock fields are Worley clusters thinned by the existing spacing rule (clearings between groves, no uniform scatter); rock fields get denser on high or steep ground and trees thin out above level 4. Ore keeps its geological-pocket families and distance tiers.

Not implemented (see [WORLDGEN_OVERHAUL_REMAINING.md](WORLDGEN_OVERHAUL_REMAINING.md)): priority-flood drainage and true erosion (rivers are contours, not catchments), ravines, generated bridges (fords only), multi-canopy tree species.

## Elevation model

- Every tile has an integer **level** 0–9 (`MAX_LEVEL`); `LEVEL_PX = 8` screen pixels lift a level, so two levels equal one tile of depth. Water, caves, upper floors, sanctuaries, towns and the vale are level 0.
- A step of **2 or more** levels between neighbours (`CLIFF`) is a cliff: it blocks walking, knockback, pathing, sight and shots. One level is a walkable slope.
- **Hills**: broad swells of at most 3 levels, flat inside the vale (r<95), flat beside Hadamere and the shore, and falling away to rivers. Outside massifs and landmark cones a 440×440 survey of three seeds finds at most 10 cliff edges (0 in two of them; `terrain3.test.ts`); levels are floor()ed from a smooth field, so neighbours differ by one level or none.
- **Massifs** (terraced mountains; desert mesas): one per ~130-tile cell with probability 0.6, away from the vale and the sea. Four sheer tiers of two levels, up to level 8 here (`MAX_LEVEL` allows 9). Each has a **ramp sector** of one level per tile or less running from the base to the summit; flanking cliffs make it read as a pass. This is how every level is reachable by construction.
- **Authored sites** (ruins, cave mouths, shrines, camps) sit inside a slope-limited cone (radius 12, one level per two tiles) around the site's own level, so cliffs are eroded away and the site can always be walked to.
- **Accessibility is verified, not repaired.** `terrain3.test.ts` floods from the spawn with the same rules as movement and requires ≥93% of the continent's open tiles and every mountain top to be reachable; measured 98.2–99.9% (the remainder are pockets sealed by trees, rocks and rivers). There is no flood-fill _repair_ pass: nothing carves extra ramps after generation.

### Chunk and protocol data

`Chunk.levels` (1,024 bytes, absent on revisions 1–2) is generated deterministically and sent by the server with every `CHUNK` message (`ChunkMsg.levels`). The client replaces its locally derived copy with the server's (`applyChunkSnapshot` → `ChunkStore.setLevels`, which rejects malformed arrays and invalidates the terrain), so levels can differ from generation in the future (terraforming) without a protocol change. Prepared-chunk worker messages carry levels too.

### Simulation

- **Movement** (`sim.ts`): a body may not overlap ground two or more levels away from the tile under its centre, so players, enemies, shadows, companions, villagers, knockback and dashes all stop at cliff faces by the shared rule that client prediction replays. Ships ignore levels (water is level 0).
- **Pathing** (`findPath`): a step across a cliff, including a diagonal corner, is refused. Click-to-mine, shadow routes and village schedules use it.
- **Sight and shots** (`lineOfSight`, `shotBlockedAt`): rising ground a cliff above the viewer or shooter blocks; looking or shooting downhill does not.
- **High ground**: +5% projectile and bolt range per level of the shooter (up to 6).
- **Building**: a foundation needs level ground: all eight neighbours at the same level as the tile (`construction.ts`). Upper floors already use their own plane.
- Spawn, respawn, saved positions and ownership never involve levels beyond the above; a world that is pinned to revision 2 has no levels at all.

### Rendering

- The terrain shader already marched a per-tile block height; levels simply add `level × LEVEL_PX` to each block (level in bits 2+ of the tile texel's blue channel). Windows with level ≥ 2 first step through coarse one-level planes, then refine at 1 px, so cost is ~3× on mountain windows and unchanged on flat ones and in caves. Coarse and fine marching differ in 0.16% of pixels on a mountain scene (isolated silhouette pixels).
- **One-level steps are grassy (or sand) banks in the habitat's own tones; steps of two levels or more are stone strata under a grass lip.** The thin lit lip lines on back edges are skipped across level steps so hills do not read as contour lines.
- `iso.ts` installs a **lift provider**: `isoY` includes the smooth ground height under a point, so every billboard, label and effect stands on the terrain without callers knowing about height. `depth()` and the terrain plane use the flat projection, so depth order never depends on height. `softLevel` blends neighbouring tile levels but clamps each to one level of the tile underfoot, so bodies glide on ramps and never sag toward a cliff.
- **Picking and aiming** use a heightmap pick (`pickGround`, top level down) and an `aimLift` correction so aiming at an enemy on a ledge is not bent by the height difference; the tile cursor and build ghost sit on their level.
- **Occlusion**: scenery directly behind raised ground nearer the camera is not drawn; creatures there are dimmed to 40% instead of being drawn through the cliff. Camera and culling bounds account for the lift.
- Mobile landscape, reduced motion and the economy shader share this path; `e2e/elevation.mjs --mobile` renders the summit in a 844×390 touch layout.

## Evidence

Reproduce with `node --import tsx tools/worldgen3-audit.mjs docs/validation/worldgen3` (maps and statistics), `node --import tsx e2e/worldgen3-art.mjs <dev url>` (same spot, revision 2 vs 3, real terrain renderer) and `node --import tsx e2e/elevation.mjs <solo url> [--mobile]` (real keyboard climb up a mountain's ramp in the production solo build, cliff refusal, screenshots, page-error check). Statistics are over the 200-tile home disc, 4-tile samples for regions:

| Seed     | Revision | Land tiles       | Reachable from spawn | Biome regions (<200 tiles) | Cliff edges | Highest level |
| -------- | -------- | ---------------- | -------------------- | -------------------------- | ----------- | ------------- |
| 20260101 | 2 → 3    | 88,934 → 116,867 | 99.4% → 99.9%        | 476 (392) → 127 (107)      | 0 → 645     | 0 → 8         |
| 1337     | 2 → 3    | 87,518 → 117,466 | 99.4% → 98.3%        | 432 (348) → 138 (124)      | 0 → 452     | 0 → 8         |
| 7102025  | 2 → 3    | 87,884 → 115,567 | 99.5% → 99.4%        | 417 (339) → 186 (170)      | 0 → 541     | 0 → 8         |

Region fragments that remain are mostly ecotone clusters at region borders and coastal islets; they are noise-clustered by design, not per-tile speckle. The home meadow is still ~40% of the continent (vale plus frontier). Screenshots: [validation/worldgen3](validation/worldgen3/). Top-down biome maps shade land by level; level maps are brighter for higher ground.

## Performance

Chunk generation costs ~19 ms per chunk against ~13 ms for revision 2 (49-chunk average, Node). Level and biome blocks are cached per chunk; landmark proximity is cached per site. The terrain pass is only repainted when the view changes, as before. Measured browser frame rates in this environment come from software GL (3–12 fps at any location) and say nothing about devices; no physical-device benchmark was run.
