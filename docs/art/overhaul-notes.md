# Visual overhaul — implementation and remaining work

This pass improves shared artwork throughout the existing game. It is not a completion of the entire proposed premium-art overhaul.

Implemented: a cohesive 48-colour material palette with unchanged quantum indices; quieter grass, paving and wood floors; shallow-water caustics; fuller seasonal leaf clusters; smaller human heads and cleaner directional sprite shading; revised roof courses, window reflections and projected window boxes; trade-specific shop signs and yard dressing; table settings and bordered quilts; shared-wind chimney smoke; mobile landscape controls and orientation fallback. A fractional-endpoint rasterization bug is fixed with a regression test.

The existing town, interiors, fauna sheets, deterministic terrain, collision, shops, NPC schedules and combat architecture remain the foundation. No new package dependencies or external asset collections were added.

## Design references and sourcing

The requested games inform design principles: Minecraft's purposeful exploration and world interaction; Stardew Valley's domestic/trade identity; Eastward and Sea of Stars' separation of material colour from lighting; Hyper Light Drifter's restrained high-saturation accents; Project Zomboid's functional projected interiors; Terraria and Core Keeper's readable biome distinction; Moonlighter and Graveyard Keeper's medieval working spaces. These are design references, not copied artwork or claims of equivalent quality.

Network requests to Kenney, OpenGameArt, itch.io, Lospec, Eastward and Sea of Stars were blocked by the environment proxy (HTTP 403). External asset quality and commercial-use licences could not be verified. Therefore no external pack was integrated and no new third-party attribution is required. A licensed asset comparison remains open; Spriters Resource must remain reference-only without explicit reusable licences.

## Remaining scope

- Further bespoke architecture silhouettes and a detailed room-by-room art pass beyond the dormers, entry covers and furnishing improvements now implemented.
- Functional multi-floor buildings: this needs server/solo floor state, collision, stairs, persistence and visibility changes, not decorative stair sprites.
- Additional weapon/combo families beyond the seven existing held weapons and their blade, crossbow and staff poses; further anatomy/equipment refinement and bespoke enemy/wildlife artwork.
- Larger cave/mountain/shoreline compositions, new interactive discoveries and broader biome storytelling beyond the sparse wilderness dressing implemented below.
- New quantum ability, portal and boss artwork beyond the shrine/crop improvements below; existing effects and telegraph readability remain intact.
- Broader performance profiling on physical low-end Android/iOS devices. Browser emulation verifies layout but cannot prove native orientation-lock behaviour or device performance.

## Reproduce validation

Use Node 22, install the locked npm workspaces and start PostgreSQL/Redis with the repository compose file. Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run build:pages`. Both builds write the same client dist directory.

With a development client/server, run `CHROME=/usr/bin/chromium node e2e/mobile.mjs http://127.0.0.1:5173/`. The mobile check covers portrait fallback, rotation, joining, landscape control bounds and HUD layout. Unit regressions cover fractional pixel lines and clearing queued/held input on blur.

Run `e2e/smoke.mjs` for multiplayer and `CHROME=/usr/bin/chromium node e2e/solo.mjs http://127.0.0.1:5240/` against a served solo build. The solo test now waits for the visible initialization note before reading it; the content assertion remains intact.

Art captures: `TOWN='{"cx":60,"cy":8}' CHROME=/usr/bin/chromium node e2e/shots-art.mjs /tmp/eigenlands-after http://127.0.0.1:5173/ day,night` (development commands enabled). The town coordinate is seed-dependent. Before/after captures and lab images from this session are stored in `/tmp/eigenlands-before` and `/tmp/eigenlands-after`; mobile capture is `/tmp/eigenlands-mobile-landscape.png`.

## Validation results

- Typechecking passed across all workspaces. Client 32, server 202 and shared 124 tests passed (358 total).
- Multiplayer and solo production builds passed.
- Artlab, Spritelab and UI lab opened without reported runtime errors; day/night town, fields, pond and hall captures were taken.
- Mobile Chromium checks passed, including a regression that failed before fixing stale Pixi terrain/lightmap quads after portrait-to-landscape resizing.
- Solo end-to-end passed: movement, combat, inventory, reload/save restoration, session takeover, deletion and fresh start; no console problems.
- Multiplayer smoke recheck passed movement, combat, settings and position restoration with no console problems. The first run failed restoration while the character was taking damage and subsequently respawned; the capture is retained in `/tmp/shots`. No gameplay or test assertion was changed to bypass that failure.

Software-rendered Chromium dropped to roughly 16 FPS in the long-walk multiplayer check; these results do not establish performance on physical mobile hardware.

## Continuation: architectural identity and usable interiors

The hall and inn now have paired cross-gabled dormers; the farmhouse and library have a single dormer. Their volumes use the existing world-space roof intersection, so they join the main roof without rotated frontal sprites. Night pane textures share the exact day silhouette and use the building's existing light registry. Dormers, roof and entry covers lift together when entering.

The hall, inn, store and bakery gained projected entry covers with brackets; the inn and bakery use striped fabric. Door jambs and quieter straw/terracotta materials improve entrance readability. Bookcases gained bound folios and scrolls, cabinets have linen and hinges, pantry jars have labels, and desks have an open ledger and wax seal. No asset packs or package dependencies were added.

Interior inspection exposed an existing layout problem: the hall's planned table seats overlapped its reserved entrance aisle, so the furnishing helper rejected both tables. The inn's left table and farmhouse table had similar problems. Those dining areas now fit alongside the unchanged reserved aisles. Shared regression checks require those tables to exist and remain outside the entrance corridor; existing pathfinding checks continue covering every NPC destination.

Fresh captures are in `/tmp/eigenlands-architecture` (day, night and occupied hall) and `/tmp/eigenlands-town-refined` (inn, farmhouse, library and prop inspections). Run `CHROME=/usr/bin/chromium node e2e/architecture.mjs` against Vite to check night panes, sprite bounds, light registration and interior cutaways, including all four material styles in both roof ridge directions.

Architectural continuation validation: 32 client tests, 125 shared tests, and 16 server village AI/movement tests passed. Both production builds, the architecture check, mobile layout and full solo end-to-end checks passed.

## Combat and movement continuation

Five reproduced motion defects were fixed: prediction correction moved only one end of the render interval; extrapolation expired by jumping backward; teleports could be extrapolated into another jump; linear snapshot motion stopped abruptly; and the server-clock offset jumped on a newly faster packet. Regression tests failed on each original case before the fixes.

Remote motion now uses bounded monotone interpolation, decelerates short extrapolation to a held endpoint, and does not extrapolate teleports. Clock corrections slew gradually. Small local reconciliation corrections preserve the drawn position at every interpolation phase. Both camera and actors align their movement to device pixels while retaining integer sprite scale.

Players have four directional strike/recovery poses and eight run poses across all 13 outfits. NPC sheets stay smaller. Wildlife gaits follow travelled distance, facing reuses existing direction hysteresis, and speed blending is independent of frame rate. Enemy strike/bite animations begin on entering their attack state. Light-hit feedback pauses effects without freezing every mob; the quantum Phase Slip slowdown remains. Multiple late hit confirmations now consume separate predicted-hit records instead of creating duplicate impact flashes/sounds. Melee fans have lower opacity so targets and telegraphs remain visible.

Landscape phones now retain a phone-sized world zoom, reducing the 844×390 test layout's terrain render area by about 75% relative to its former desktop zoom. Reduced motion freezes shader time and reuses unchanged terrain, with invalidation on camera, world, season or size changes. FPS diagnostics use wall time instead of Pixi's capped delta.

The browser combat check exercises real controls at 150 ms simulated latency and verifies strike/run selection, recovery, reduced-motion poses, pixel alignment and terrain cache invalidation. The action gallery checks all outfits in eight directions. Open `/labs/artlab.html?lab=actions&scale=3&motion=0` to inspect the new poses.

Profiling in software-rendered Chromium exposed substantial GPU cost; CPU frame work was usually single-digit milliseconds, with occasional larger feature/UI work. This does not establish 60 FPS on physical devices or a numeric speedup for the whole game. The remaining-scope list above remains applicable; this is not a claim that the entire original vision is complete.

Final combat validation: all 367 tests passed (40 client, 202 server, 125 shared), plus typechecking and both production builds. Fresh browser checks passed combat controls in multiplayer and solo with simulated 150 ms latency, the 13-outfit/eight-direction action gallery, terrain repaint invalidation, and mobile rotation/zoom/lighting/control bounds. Solo persistence passed reload, takeover, deletion and fresh-start checks without console errors. Notification and prompt bounds are checked in landscape; compact-screen chat starts collapsed while preserving saved preferences, and remains directly accessible.

The final UI inspection also corrected overlapping chat/story controls on narrow screens and kept only two recent mobile notifications visible below the health area. Recently merged pickup notifications return to the visible end of the feed.

Screenshots from this continuation: `/tmp/eigenlands-combat/actions.png`, `/tmp/eigenlands-combat/strike.png`, `/tmp/eigenlands-combat/run.png`, `/tmp/eigenlands-combat-solo/strike.png` and `/tmp/eigenlands-mobile-landscape.png`. The `--peers` option on `e2e/combat-motion.mjs` additionally checks a second real multiplayer client receiving the attack pose.

The extra real two-client test passed authoritative strike presentation on the observer, with both simulated clients kept active during testing. The initial attempt missed the short pose while switching browser tabs; explicitly focusing the sender for input and observer for rendering, with background throttling disabled in the harness, retained the same pose assertion and passed. A fresh architecture run also passed day/night panes, light registration, clipping and cutaways for both ridge directions and every material style.


## Equipment, wilderness and quantum continuation

All seven existing weapons now have held sprites in eight directions: a steel blade, a swept-limb crossbow and five elemental staves. Shared near-hand anchors keep equipment attached through idle, walking, running and striking. Player sheets now include four crossbow aim/recoil poses and four casting/recovery poses (30 columns total); NPC sheets remain ten columns. The crossbow support hand meets the stock. The existing server simulation still decides damage, cooldowns and projectiles. An appended, empty-by-default schema field carries equipment appearance; ranged shot effects carry the shooter's ID, allowing observers to show the correct action. There is no database or save-format migration. Adjacent-shard ghost silhouettes retain their existing presentation.

Weapon geometry is rasterized by facing into lazy cached atlases, with consistent upper-left material lighting. An initial bounds check caught clipped tips; padded canvases fix that without moving the hand anchor. The equipment gallery checks all 1,680 weapon/facing/pose combinations for bounds and texture reuse. The real two-client check verifies equipping a crossbow, observer equipment visibility, local and remote shooting poses, and unequipping locally.

Wilderness ground dressing adds clover, leaf litter, fallen boughs, washed-up wood, scree, small cave formations and glowcaps, three variants each. One candidate per 8×8 cell limits density, with biome/terrain selection and deterministic seeds. These reuse the tile-object renderer, depth sorting, chunk rebuilding and texture lifetime. They are cosmetic: no extra collision or loot. Spawn, town, modified terrain and existing objects suppress them. Object messages refresh the tile decoration so planting or construction does not leave decorative debris underneath. Tests cover repeatability, negative coordinates, edited ground and occupied tiles.

Shrines gained inset rune channels, brass collars, a recessed crystal cradle and a faceted qubit with separated front/back orbit threads. Superposed crops now retain coherent primary and alternate silhouettes; a short strand and three one-Hz motes replace alternating pixel checkers. Reduced motion still uses the stable first frame. The wilderness gallery checks bounds, both shrine orientations and that only sparse motes change between crop frames. All artwork in this continuation is original procedural work; no new external assets or dependencies were added.

Visual review of the two-player capture also exposed notification and tutorial overlap in short desktop windows. Those windows now share the restrained two-toast feed and side-positioned tutorial hint used on landscape phones; the desktop quest tracker clears the vertical toolbar.

Captures: `/tmp/eigenlands-equipment.png`, `/tmp/eigenlands-wilderness.png`, and `/tmp/eigenlands-combat-final/remote-crossbow.png`. Galleries: `/labs/artlab.html?lab=equipment&scale=3&motion=0` and `/labs/artlab.html?lab=wilderness&scale=3&motion=0`. Reproduce with `node e2e/equipment-art.mjs`, `node e2e/wilderness-art.mjs`, and `node e2e/combat-motion.mjs http://127.0.0.1:5173/ /tmp/eigenlands-combat-final --peers`.

This does not complete functional multi-floor buildings, a bespoke overhaul of every biome/room/enemy/boss, new interactive discovery systems, or physical-device profiling. Those remaining items require further implementation or hardware access; they are not represented by placeholder stairs or claims of completion.


Continuation validation: 372 tests passed (45 client, 202 server, 125 shared); all workspace typechecks and both production builds passed. Equipment and wilderness galleries, architecture checks, two-client combat/equipment presentation with 150 ms simulated latency, mobile landscape/rotation, and solo movement/combat/save/reload/takeover/deletion checks passed. Solo reported no console problems. The server test suite still emits existing unregistered-message notices and NaN-poise warnings from training dummies configured with infinite poise; this run does not claim a warning-free suite.

A final mobile regression reproduced Play requesting fullscreen after the player selected Continue in portrait. Play now respects that choice, while the explicit landscape button still requests landscape. The updated mobile check failed before the fix (one request instead of zero) and passed on the final solo build. Native physical-device orientation behaviour remains unverified.


## Ore, natural distribution and the Qubitman figure

Replaced rounded mineral piles and pasted-on nuggets with bevelled world-space outcrops: top and side facets share a continuous mineral field. Ordinary rocks, biome rock variants and crystal bases now use the same projected geology. Copper/iron/silver/gold retain distinct material ramps and quiet precious-metal glints. A dedicated underground art context fixes surface winter snow appearing on cave ore; animated cave textures and reduced motion follow that context correctly. Canvas bounds checks also caught the original statue plinth touching its bottom edge; extra canvas space preserves its original (78,202) ground anchor.

Tree trunks are locally thinned without request-order state, organic sprites receive a small deterministic offset within their tile, and grass/flower coverage is lighter. Surface mineral kinds share geological pockets instead of independent per-node rolls, retaining their distance-based tiers. In caves, connected seams replace already-solid wall margins; random ore obstacles were removed from walking space. Existing tunnels and landing chambers keep their shape. Original surface siting remains available specifically for landmark selection, and cave caches use their original floor search, so existing mouths, shrine/ruin centres, cache IDs and destinations remain stable. Persisted tile diffs still override the base map. Client and server must use the same shared generator; the solo bundle includes both.

The first Qubitman revision used the existing isometric `Scene` renderer. The subsequent reference-led revision below replaces that figure with an authored robed guardian. The projected plinth, inscriptions, braziers and orbiting qubit are preserved.

Generation regressions cover tree spacing, connected same-mineral cave deposits, request-order independence at negative chunk boundaries, known landmark coordinates, and the invariant that previously open surface/cave tiles stay open. The resource art check covers cave seasons, mineral animation, reduced motion, sprite bounds and statue anchors. Reproduce with `node e2e/resource-art.mjs`. Before/after captures are in `/tmp/eigenlands-resource-before` and `/tmp/eigenlands-resource-after`; the new gallery is `/labs/artlab.html?lab=resources&scale=3&season=3&motion=0`.

This continuation improves the requested resource art, natural distribution and statue; the larger remaining-scope items above are still open. No external artwork, dependencies, purchases or save reset were introduced.


Final pre-merge checks: all 377 unit tests passed (45 client, 202 server, 130 shared), all workspace typechecks and both builds passed. Mobile landscape and full solo persistence passed without console problems. Two-client combat/equipment checks passed with 150 ms simulated latency. The short-pose check initially timed out because it observed only after input dispatch; the harness now records actual rendered frame IDs through the existing ticker before input and asserts the same strike/shooting poses. It does not change combat timing or bypass gameplay. Resource bounds checks passed after correcting the plinth's clipped bottom edge.


## Reference-led guardian and ecology continuation

The supplied statue reference informed pose, robe layering and weathered stone, without copying its artwork. Qubitman now has a long carved robe, a turned face, a planted staff, a raised supporting palm and restrained bronze trim. The plinth uses related green stone, with sparse cracks instead of the regular surface-dot pattern. Existing inscription, quantum orbit, braziers and (78,202) ground anchor remain.

Trees have asymmetric crowns shaded as a single canopy, coherent autumn colours and irregular conifer tiers. The seasonal bounds check exposed overlong pre-existing winter branch recursion; it now fits the existing frame. Existing trunk locations and spacing are preserved. Ground cover and scenery share a coherent shelter field. New ferns favour trunks and reeds favour sandy banks; both use the existing wind field and reduced-motion handling. Plain background boulders are thinned outside rocky ridges; mineral selection and existing coastline remain intact. Terrain has quieter cover patches, broken shore foam and shorter, less regular water reflections.

No new dependencies, external assets, purchases, replacement rendering systems or save reset. The larger remaining scope listed above (including functional multi-floor interiors and additional bespoke world/combat content) is still open. New check: `node e2e/ecology-art.mjs`, covering seasonal bounds and rendered woodland/coast/autumn/winter/town/scenery scenes.

Validation for this pass: 378 unit tests passed (45 client, 202 server, 131 shared), all workspace typechecks and both builds passed. Resource/statue, wilderness and seasonal ecology browser checks passed; all 24 tree variants and the new plants fit their frame bounds. Mobile landscape passed. Full solo movement, combat, inventory, reload, tab takeover, deletion and fresh-start checks passed without console problems on an isolated rerun; the first concurrent run timed out on reload under software-rendering load. The server suite retains the previously documented infinite-poise dummy warnings. Screenshots are in `/tmp/eigenlands-guardian-before`, `/tmp/eigenlands-guardian-after` and `/tmp/eigenlands-ecology-final`; the ecology harness now waits for submitted frames and rejects empty captures.
