# EIGENLANDS voxel migration

## Contract

Replace the pixel world with actual volumetric meshes. Preserve the existing medieval fantasy content,
authoritative simulation, persistence, procedural seeds, world generations, interactions and screen controls.
Use a fixed orthographic camera at azimuth 45°, elevation 30° (the existing 2:1 projection).
No first/third person camera, orbit controls, sprite extrusion or image-based world geometry.

## Audit (2026-11-10)

- TypeScript/Vite monorepo, Pixi 8 client, shared deterministic world and Colyseus server; solo runs the
  same server in the browser. No AGENTS.md files found. Working tree clean before migration.
- `Game.ts` owns prediction, interpolation, streaming, input, UI and sprite presentation.
- `ChunkStore` supplies generated tiles, elevations, edits, objects and construction. Keep this as the
  authority for collision/pathfinding; visual geometry must agree with those same coordinates.
- `iso.ts`: screen x=(x-y)*16, screen y=(x+y)*8-lift. Match this mathematically in 3D.
- Existing `art/voxel.ts` rasterizes signed-distance models into sprites, unsuitable as a 3D renderer.
- World presentation spans terrain, natural objects, buildings, furniture, construction, actors,
  ambient scenes, arrival garden, secrets, travel features, effects and weather. DOM panels are separate.
- Existing e2e scripts cover solo movement, combat, inventory, saving, travel, construction and more.

## Design and implementation plan

Use Three.js as a render adapter over existing simulation, retaining Pixi for labels and interaction
overlays during migration. Procedural solid voxel geometry uses shared box meshes, palette colors,
vertex shading, merged scenery and instanced effects. This avoids an unrelated replacement game or
a second physics system. Alternative of rewriting simulation around a 3D engine was rejected because
it would change navigation, combat and persistence. Sprite extrusion was rejected by the contract.

- [x] Audit architecture and define exact camera/coordinate contract.
- [x] Add projection regression tests and volumetric geometry tests; observe failures before implementation.
- [x] Implement camera, meshing, lighting, stream disposal and scene lifecycle.
- [x] Build and verify the complete arrival-area slice using real simulation and browser screenshots.
- [x] Extend model coverage across tile, object, construction, actor and effect families.
- [x] Integrate remote/solo state, animation, selection, cutaways, terrain edits and interaction feedback.
- [x] Run typecheck, tests, lint, production builds and browser gameplay/regression checks.
- [x] Record measured performance, coverage and remaining validation limits below.

## Verification risks

Camera/picking mismatch; floating actors on elevated terrain; doors rendered as solid walls; stale geometry
after edits; cross-plane travel retaining old meshes; construction roof cutaway; obscuring foreground
vegetation; empty or generic models masking content loss; GPU context loss and unbounded GPU allocation.

## Evidence and remaining work

The migration is enabled by default in both online and solo builds. Browser performance has not been certified on hardware GPUs. Evidence is saved in `docs/validation/voxel/`.

- Nine voxel tests currently pass: exact projection at three zooms and large coordinates, foreground-ray
  cutaway, solid furniture command capture, closed 3D geometry, every enemy model, village/farm anatomy.
- Final full client run: 247 passing; shared 417 passing. Server integration tests required local
  socket permission; rerun outside the socket-restricted sandbox: 88 files, 433 passed, 2 infrastructure skips.
- Arrival smoke exercises actual solo login, movement, attack input and inventory. Screenshot review found
  and corrected opaque legacy lighting and excessive distance fog. Last reviewed arrival is true geometry;
  12 visual chunks, 72,684 triangles / 88 calls, no missing models. The town measured 131,748 triangles /
  144 calls; streaming retained 9–16 chunks across the tour. These are scene metrics, not a hardware frame-rate signoff.
- Legacy sprite pose baking is now bypassed in the active 3D world. Resource clicks raycast voxel geometry.
- Cross-plane tour passed: arrival, town, inn interior, wilderness, Undercroft, Aetheria, Umbra and Chronoria.
  Each stop asserts the renderer's focus advances and has no missing-model diagnostics or page exceptions.
- Construction server regression: 8 tests passed, plus 8 travel regressions. Browser construction initially
  found a sloped site: its old fixture ignored the existing equal-elevation foundation requirement. The
  fixture now selects a truly level clearing, without editing the generated terrain.
- Browser construction passed real UI crafting, a two-floor arbitrary house, owned collision, door opening,
  paired stairs, roof cutaway, furniture placement, mobile rotation and persistence across reload.
- Structural roofs share one continuous ridge across adjacent player-built cells. Door previews, rotated
  door leaves, connected-room cutaways, stairs and furniture use the existing authoritative build data.

## Validation limits

- Chromium runs through SwiftShader in this environment. It reported roughly 2–5 FPS during the world tour
  (two browser checks ran concurrently), with slow software rasterization. Actual GPU/mobile frame rate,
  memory ceilings and a long-session stress test remain unverified. No 60-FPS claim is made.
- Meshes are merged per streamed chunk, buried terrain faces omitted, actor geometry cached with a bound,
  effects instanced and local lights pooled. Performance mode reduces resolution and disables shadows.
- Both production builds pass, with Vite's existing large-chunk warning (main bundle approximately 3.3 MB
  before gzip). Automated tests cover all enemy and item model families, not a manual visual review of every
  generated building, creature pose, boss encounter or multiplayer interaction.
- Full client/shared/server suites passed: 1,097 tests total, 2 server infrastructure skips. Following the
  final portrait/settings refinement, typecheck, lint, nine focused voxel tests and both builds passed again.
  Browser smoke additionally checks movement, combat input, 64px voxel item thumbnails and a 160px voxel portrait.

## Refinements requested during migration

- Stable building identities include gabled, hipped, asymmetrical, spired and battlement roofs, stone or
  timber walls, shutters, dormers, chimneys, shop awnings and church steeples. Collision and doors stay fixed.
- Tables and shelves get seeded books, pottery, meals, herbs or workshop materials on actual support surfaces.
  Human proportions use a compact head and longer body, with articulated elbows, knees, gait, guard and attacks.
- Inventory equipment portraits, dialogue and journal portraits render the world character rig rather than sprite sheets.
  Named NPCs retain their original outfit definitions. Weather detail and reduced-motion settings remain respected.
- Inventory, hotbar and crafting thumbnails are orthographic renders of actual voxel item geometry, cached
  at 64px. No pixel-icon extrusion or blocky filter. Equipment families retain different silhouettes/materials.
- Mailboxes become wooden notice stands; new town generation uses signposts. Fairgrounds use a performance
  stage and archery booth instead of Ferris wheels and carousels, with matching original collision footprints.
- The user authorized pushing the verified changes to `main`. Upstream was fetched and matched the starting
  commit `ce9a28c`; no force push is planned.

## User reference and asset audit

The four supplied reference images establish detailed stepped masonry, layered timber, readable furnished
cutaway rooms, block foliage, small material palettes, warm local lights and atmospheric shadows. Preserve
EIGENLANDS' fantasy setting rather than importing the modern/cyberpunk subjects.

| Supplied pack                     | Inspection                                                                                              | Use                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Free Sample.zip                   | 3 skinned animal FBXs, 7 static animal FBXs and textures; no license file found                         | Anatomy reference                                                                                          |
| BlockImagine-Cozy-Farm.zip        | 30 GLBs, editable Blockbench sources, previews, embedded animations; CC0 1.0 license                    | 15 medieval-compatible GLBs copied to public/art/voxel/cozy-farm, with license and README; mailbox removed |
| VoxelNature_Free_1.1.unitypackage | Unity prefabs, serialized meshes, seasonal materials, character animations, shaders                     | Seasonal foliage/rig reference; Unity assets are not browser runtime files                                 |
| Free Essential Animation CC0.zip  | Attack, Death, Hit, Idle and Run FBXs; no separate license file in archive                              | Motion reference; current people use a continuous articulated rig                                          |
| FreeContent.zip                   | 12 T-pose character FBXs, one texture atlas; no license file found                                      | Character proportions/gear reference                                                                       |
| Free Sample (1).zip               | 10 OBJ/MTL models and textures: crates, house, trolley, rock, grass, rack, logs; house has 39,392 faces | Construction and silhouette reference; do not duplicate high-cost geometry per tile                        |
| Isometric Free Sample.zip         | 10 PNGs, including a dungeon example, wall, pillar, chest, torch and armour                             | Visual reference only; images are not 3D assets                                                            |

Only the explicitly licensed Cozy Farm files are redistributed. Embedded pixel textures on these solid GLB
models are surface materials; no billboard or sprite extrusion is used for their world presentation.

The second `FreeContent.zip` contains the same 12 T-pose FBX character filenames and atlas. The final
`FreeSample (1).zip` contains nine SoulGothic OBJ/MTL models and textures, without an included license;
it is used as an architectural material/silhouette reference only.
