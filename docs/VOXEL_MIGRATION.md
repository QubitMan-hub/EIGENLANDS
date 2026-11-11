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
| Free Essential Animation CC0.zip  | Attack, Death, Hit, Idle and Run FBXs; no separate license file in archive                              | Original reference; later re-upload supplies the actual 25-joint skeleton and all five runtime clips       |
| FreeContent.zip                   | 12 T-pose character FBXs, one texture atlas; no license file found                                      | Character proportions/gear reference                                                                       |
| Free Sample (1).zip               | 10 OBJ/MTL models and textures: crates, house, trolley, rock, grass, rack, logs; house has 39,392 faces | Construction and silhouette reference; do not duplicate high-cost geometry per tile                        |
| Isometric Free Sample.zip         | 10 PNGs, including a dungeon example, wall, pillar, chest, torch and armour                             | Visual reference only; images are not 3D assets                                                            |

The Cozy Farm files carry an included CC0 license. The later user-requested Essential Animation CC0
re-upload is also converted and shipped, with source hashes and provenance noting that its archive has
no separate license file. Embedded pixel textures on solid GLBs are surface materials; no billboard or
sprite extrusion is used for world presentation.

The second `FreeContent.zip` contains the same 12 T-pose FBX character filenames and atlas. The final
`FreeSample (1).zip` contains nine SoulGothic OBJ/MTL models and textures, without an included license;
it is used as an architectural material/silhouette reference only.

## Follow-up: orientation, placement, voxel UI and color (2026-11-10)

- Preserve the mathematically tested fixed 2:1 orthographic projection. Correct the procedural creature and
  riding-horse conversion from authored +X to live +Z forward; imported animal rigs already use +Z.
  Projectiles retain their existing +Z axis.
- Correct the second-wall prop transform to exchange wall axes, matching `Prop.uv` and collision footprints.
  Furniture now derives its backing wall from the authoritative tiles, and chairs face adjacent tables or
  retain an explicit saved seat direction. Neighbor layout contributes to the visual cache signature.
- Seeded clutter is fitted as complete objects into non-overlapping slots on actual support surfaces;
  narrow shelves and the clearance below the next board constrain size and placement. No world entities,
  furniture coordinates, procedural seeds or collision layouts are randomized by this pass.
- All 43 HUD/status/menu/title icons are newly authored solid 3D objects rendered orthographically, replacing
  bitmap glyphs. Four solid timber/stone/jade/recessed-slot models provide cached nine-slice panel frames.
  Native text and controls retain screen alignment, keyboard semantics and original interaction boundaries.
  The UI uses one shared thumbnail renderer, not a WebGL context or animation loop per widget.
- Vitals, charge studs, status pedestals, faction gems and boss frames now render solid models.
- The title diorama, eight-way character creator and wardrobe previews now render actual world models.
  Voxel icons hydrate after DOM mounting so importing settings remains safe in non-browser runtimes.
- More saturated meadow/forest greens, jade, roofs, terracotta and water; lower midday illumination avoids
  bleaching materials. UI surfaces use warmer timber, brighter brass, pale limestone and jade selection.
- Validation complete for this pass: 253 client tests pass. After the final visual fixes, 38 focused voxel,
  vitals and encounter tests pass; workspace typecheck, lint and both online/solo production builds pass.
- Desktop (1280×800) and touch landscape (844×390) browser checks pass: title/creator, inventory, interiors,
  menu interaction, camera and model diagnostics. Audited streamed object roots have no displaced anchors or
  incorrect wall transforms; the inn cutaway remains active. No runtime exceptions or missing model diagnostics.
- Screenshot review found and fixed undersized thumbnails and dark empty-equipment labels. Thumbnail framing
  now fits the actual projected bounds at the fixed view. Text contrast against the rendered material is
  12.87:1 for equipment labels and 6.83:1 for reading text; inventory fits both tested viewport widths.
- Latest screenshots and measurements: `docs/validation/voxel/ui-validation.json`, `ui-title.png`,
  `ui-mobile.png`, `ui-mobile-inventory.png`, `ui-creator.png`; arrival/inventory/inn captures updated.
  Hardware GPU performance and an exhaustive manual inspection of every generated room remain unverified.

## Follow-up: supplied essential body rig and animations (2026-11-11)

- Archive inspected: `Free Essential Animation CC0 _1_.zip` contains animation-only Attack, Death, Hit,
  Idle and Run FBXs. They share 25 humanoid joints; **there is no source character mesh**. Body widths,
  clothing and voxel detailing therefore remain EIGENLANDS art, built around the exact supplied joint structure.
- Added reproducible Blender conversion and source-FBX pose verification tools under `tools/voxel/`.
  FBX frame offsets are removed without changing 30 Hz take timing. World-space baking correctly handles
  the different joint basis in Hit. All 25 joints at every authored frame agree within 0.000005 metres.
- Ship one shared GLB with five clips, source hashes and provenance. Characters use one solid voxel
  skinned body per actor, the source bone hierarchy and original animation curves, with independent mixers.
  The old hand-authored arm/knee pivots and sinusoidal human gait/attacks are removed. Equipment is socketed
  to RightHand/LeftHand. Uniform unit/heading normalization and in-place root anchoring preserve simulation.
- Gameplay movement drives Run; combat release drives Attack; real HP loss drives Hit; death plays once
  and clamps; revival returns to Idle. Death no longer adds an unrelated 90-degree whole-body roll.
  Mounted characters keep Idle while the vehicle moves. Human pirates/guards use the same rig with role gear.
- Boot preloads the shared asset before creating title/creator, portraits or playable characters.
  Preview characters and world actors use the same anatomy. Fists and non-weapons leave the weapon socket empty.
- Verification complete: all 4,925 source-frame joint samples pass, maximum error 0.000004413 metres.
  Six rig tests cover source hierarchy/timing, finite skinned geometry, one-shot transitions, guard/revive,
  equipment sockets and independent poses. The full client suite passes 259 tests; workspace typecheck,
  lint, online build and solo build pass (existing Vite large-bundle warning remains).
- Browser proof passes real movement → Run and combat release → Attack, then renders all five takes on the
  actual playable skinned character. Desktop/mobile creator, portraits, inventory, world and inn checks pass
  without runtime exceptions or missing models. Camera remains fixed orthographic; building/prop coordinates unchanged.
- Evidence is under `docs/validation/voxel/essential-animation/`: source pose comparison, live-input results,
  desktop/mobile audit and Idle/Run/Attack/Hit/Death/creator captures. Hardware GPU performance remains unverified.
