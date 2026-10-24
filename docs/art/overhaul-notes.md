# Visual overhaul — implementation and remaining work

This pass improves shared artwork throughout the existing game. It is not a completion of the entire proposed premium-art overhaul.

Implemented: a cohesive 48-colour material palette with unchanged quantum indices; quieter grass, paving and wood floors; shallow-water caustics; fuller seasonal leaf clusters; smaller human heads and cleaner directional sprite shading; revised roof courses, window reflections and projected window boxes; trade-specific shop signs and yard dressing; table settings and bordered quilts; shared-wind chimney smoke; mobile landscape controls and orientation fallback. A fractional-endpoint rasterization bug is fixed with a regression test.

The existing town, interiors, fauna sheets, deterministic terrain, collision, shops, NPC schedules and combat architecture remain the foundation. No new package dependencies or external asset collections were added.

## Design references and sourcing

The requested games inform design principles: Minecraft's purposeful exploration and world interaction; Stardew Valley's domestic/trade identity; Eastward and Sea of Stars' separation of material colour from lighting; Hyper Light Drifter's restrained high-saturation accents; Project Zomboid's functional projected interiors; Terraria and Core Keeper's readable biome distinction; Moonlighter and Graveyard Keeper's medieval working spaces. These are design references, not copied artwork or claims of equivalent quality.

Network requests to Kenney, OpenGameArt, itch.io, Lospec, Eastward and Sea of Stars were blocked by the environment proxy (HTTP 403). External asset quality and commercial-use licences could not be verified. Therefore no external pack was integrated and no new third-party attribution is required. A licensed asset comparison remains open; Spriters Resource must remain reference-only without explicit reusable licences.

## Remaining scope

- Further bespoke architecture silhouettes and a detailed room-by-room art pass beyond the dormers, entry covers and furnishing improvements now implemented.
- Broader authored multi-floor layouts and room identities beyond the functional furnished upper rooms added in the latest continuation below.
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

At this stage, functional multi-floor buildings were still open (implemented in the latest continuation below), alongside a bespoke overhaul of every biome/room/enemy/boss, new interactive discovery systems, or physical-device profiling. Those remaining items require further implementation or hardware access; they are not represented by placeholder stairs or claims of completion.


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

No new dependencies, external assets, purchases, replacement rendering systems or save reset. Additional bespoke world/combat content remains open; functional upper interiors are covered by the later continuation below. New check: `node e2e/ecology-art.mjs`, covering seasonal bounds and rendered woodland/coast/autumn/winter/town/scenery scenes.

Validation for this pass: 378 unit tests passed (45 client, 202 server, 131 shared), all workspace typechecks and both builds passed. Resource/statue, wilderness and seasonal ecology browser checks passed; all 24 tree variants and the new plants fit their frame bounds. Mobile landscape passed. Full solo movement, combat, inventory, reload, tab takeover, deletion and fresh-start checks passed without console problems on an isolated rerun; the first concurrent run timed out on reload under software-rendering load. The server suite retains the previously documented infinite-poise dummy warnings. Screenshots are in `/tmp/eigenlands-guardian-before`, `/tmp/eigenlands-guardian-after` and `/tmp/eigenlands-ecology-final`; the ecology harness now waits for submitted frames and rejects empty captures.

CI also exposed an existing fishing-test race: it asserted the client toast as soon as server-side cast state cleared. The test now waits for the toast's socket delivery while retaining its original assertion. All eight world/fishing tests passed after that test-only fix; fishing gameplay is unchanged.

The final PR workflow passed, while its duplicate push workflow exposed another existing fixture issue: exact crafting-material counts varied with the random ingredient-saving skill bonus. Crafting fixtures now use a fixed no-bonus roll, with a separate forced-bonus case proving that one ingredient is saved and output remains correct. All 11 crafting tests passed locally. This adds one test (379 total) and changes no production crafting behaviour.

## Wildlife and coastal exploration continuation

Inspected both supplied ZIPs, including image dimensions and hashes, then decompressed and hash-checked both 7z alternatives using libarchive. They contain the same files as the corresponding ZIPs. The tiles pack is a small terrain atlas and individual tiles, rather than the castle collection in the promotional reference. The critter pack contains boar, stag, badger and wolf artwork; 45 PNGs match assets already in the repository. Neither archive contains license text. Existing matching sheets remain in use; no unverified artwork was imported. All new rigs, props and icons are original.

Added fox, otter, tortoise and owl rigs plus Briar Warden and Prism Crawler foes. Existing wildlife uses longer rests, a smaller comfort radius, slower steering changes and travel-driven gait. The new hostile creatures retain their melee/leap behaviours when extracted through the existing companion system. Enemy kind IDs were appended, preserving existing saved kinds. Frame margins include feet and death poses; reduced motion keeps stable locomotion frames.

Shrines now include paired-lantern logic and timed movement trails alongside sequence and gauntlet sessions. Server-owned masks, ordered player positions, timers and single-claim progression govern completion. A full bag leaves the reward claimable at the altar; retries do not grant duplicate coins or reroll loot. Completed shrines hide props, shadows and lights, including after chunk reload. Resonance props are intangible so completion leaves no invisible collision.

Lumenport (512,0), Reedhaven (0,512), Brinewick (-512,0) and Amberquay (0,-512) have authored streets, quays, furnished buildings and 40 additional residents. They reuse the existing building cutaway, NPC schedules, shops, gifts, quests and dialogue systems. Each resident has a distinct small atlas, generated only when needed. Shared furnishing spot names are namespaced by port so Hadamere's workers retain their original destinations. The new island shelves deliberately change the terrain around these four sites; saved tile edits remain authoritative. Procedural rivers cannot flood the occupied streets, and dredged channels connect the piers to the sea.

Three offshore fish use depth, time and fishing-skill gates. Sparse sea caches grant deterministic salvage once per character and preserve unclaimed contents when the pack is full. Existing sloop boarding, cannons and sea enemies remain in use; hull/deck/rigging details are heading-specific. Friendly coastal shopkeepers can arrange one separate guild escort: level 5, friendship, a free companion slot and 250 coins buy thirty real minutes. A hated gift blocks that day's recommendation. Contract state uses existing companion persistence, expires offline, and renders a human fighter with the correct sword. This does not recruit or duplicate the speaking resident.

Six held tools share the existing body grip and pose atlas. Hotbar selection is validated and replicated from the authoritative inventory; attack poses show the equipped weapon. Offshore fish have individual inventory silhouettes. Other consumables, a complete equipment/icon redesign, travelling merchants, arbitrary resident recruitment and a separate pet system with bespoke support abilities remain unfinished. Underwater shrine environments, traps/platforming and functional upper interiors are implemented in the continuation below. See [the precise scope and asset audit](../design/world-upgrade.md).

Validation: all 391 tests passed (45 client, 211 server, 135 shared), all workspace typechecks passed, and multiplayer/solo builds passed. New server tests cover full-bag reward retry, authoritative rune-trail positions, escort requirements and expiry, boarding/disembarking at all four piers, held-tool validation and one-time salvage. The full-day movement simulation includes all 50 residents. Shared checks protect Hadamere's original spots, coastal ground, furnishings and hull-wide harbour channels. Existing synthetic combat-dummy and injected-failure diagnostics remain in the server suite.

`node e2e/world-upgrade.mjs` checks 4,416 animation frames, texture reuse, 40 distinct resident sprites, completed-shrine props/shadows/lights and eight rendered scenes. Screenshots are in `/tmp/eigenlands-world-upgrade`. Solo movement/combat/inventory, save/reload, tab takeover, deletion and fresh start passed with no console problems. Mobile landscape/portrait fallback, control bounds and resized lighting passed. Multiplayer smoke movement/combat/settings/reload passed with no console problems; its first run was invalidated by a development hot reload and was rerun. Validation runs that combine software-rendered browsers with real-time server suites can exhaust CPU scheduling; the final full suite was run separately.


## Functional floors, submerged trials and UI continuation

Hall, inn and farmhouse upper rooms now contain actual furniture and occupy separate persistent coordinate spaces. Reversible stairs validate reach and landing collision, and interaction under the player's feet takes priority over nearby dialogue. A browser test reproduced the NPC interception bug before that correction. Existing roof fades, wall cutaways, static object registration, chunks and shard handoff remain in use. Upper-floor saves reload in the correct room in both multiplayer and solo.

Sparse deep-water buoys lead charter holders into dry underwater chambers. Sequence and paired-lantern puzzles share the existing shrine system; tide-trap courses add safe/red spike phases and nonfatal mistakes, while phase-platform courses traverse actual water gaps with server-validated jumps. Rewards use the existing once-per-character, full-pack-safe path. The exit remains available after completion and returns the player to their sloop; losing a charter inside provides a safe spawn fallback. Server integration tests cover stairs, charter requirements/return, dangerous jump rejection/full completion, trap damage/ordered completion and duplicate reward refusal.

Original stair, hatch, buoy, ladder and coral artwork uses Iso projection and the shared palette. The sprite bounds check caught and corrected the downstairs hatch's bottom edge. Treads now rise away from the viewer with posts and a handrail. The terrain shader raises enclosing walls on these coordinate planes. Location hints decode the plane before computing distance. Actor removal clears temporary jump presentation data.

The HUD now uses bronze borders, matte ink-green surfaces, parchment type and a numeric current/max health bar with a low-health marker. Inventory has labelled search, categories, presentation-only sorting, distinct quick-bar/backpack sections, keyboard-selectable details, equipment and use buttons, and quick-bar placement. It preserves authoritative indices and never sorts the actual inventory. Windows are labelled dialogs with a Tab focus loop, Escape dismissal and focus return. The UI lab now loads the real fonts and HUD skin. No hunger/thirst indicators are fabricated; the full combat, survival, map and progression UI remain in progress.

Browser evidence: `e2e/realms.mjs` passed against multiplayer and the solo build, exercising furnished stairs, upper-floor reload, diving, a phase-platform chamber and sailing return with no page errors. `e2e/overhaul-ui.mjs` passed desktop and 844×390 touch-landscape search/category/sort/item-action/focus/window checks and all six new or newly registered prop bounds. General solo movement/combat/inventory/save/reload/takeover/deletion and mobile rotation/control/lighting/runtime checks passed. Captures: `/tmp/eigenlands-realms-mp`, `/tmp/eigenlands-realms-solo`, `/tmp/eigenlands-ui-overhaul`, `/tmp/eigenlands-realms-solo-regression`, `/tmp/eigenlands-mobile-landscape.png`.

The final full regression and CI result belong in CONTINUE_HERE.md. An existing Wavefront damage test initially failed because it retried damaging misfires on the same target; its random slip source is now controlled for that damage assertion, and all 15 circuit-casting integration tests passed on recheck. Training-dummy infinite-poise diagnostics remain incumbent test output. No dependency, DB schema migration, new asset pack or paid service was introduced.

The newly supplied definitive master request is preserved verbatim in `docs/design/master-request.md` with its full checklist in `docs/EIGENLANDS_MASTER_PLAN.md`. It substantially exceeds this slice: maps, survival, full building freedom, companion recruitment, kingdoms, guilds, realms and private friend-world hosting remain explicit work, not claims of completion.

## Quiet HUD and inventory continuation (2026-10-23)

Removed the persistent tutorial banner and quest tracker; their information lives in Journal. Kept nearby interaction prompts, villager markers and temporary combat warnings. Replaced the top-right clock orb and vertical dock with a compact travel strip, direct Journal and native dismissible Menu. Idle chat starts compact while honoring saved preferences; recent notification bursts are limited to two visible messages. Landscape spacing keeps chat and status clear of controls.

Equipment detail now previews passive stat changes for armour, rings and Foci, including set thresholds, crafted ring values and explicit replacement-ring choice. The action equips the slot being compared. No invented DPS, new combat rules or third-party art. Desktop/landscape captures are in /tmp/eigenlands-quiet-hud and /tmp/eigenlands-ui-overhaul; these are local evidence, not portable art assets. Final validation/integration state is recorded in CONTINUE_HERE.md.

Atlas destination continuation (2026-10-23): existing cartographic art now draws gold quest triangles and muted lilac party circles above ordinary actor markers, below the local player. The uncharted-ground label leaves the centered marker clear. Details stay in collapsed full-map directories; mobile landscape stacks them, and closed sections keep compact borders. No new playfield tracker, animated effect or imported artwork. Quest discovery and authorized party sharing have distinct fog rules; neither generates terrain. See the atlas-destinations plan and CONTINUE_HERE.md for validation/status and remaining chart-storage work.

Durable chart continuation (2026-10-23): individual explored pages now persist in IndexedDB, with compact discovery masks and lazy viewport loading. Existing cartographic geometry/palettes stay unchanged. Legacy snapshots migrate and recent pending observations have synchronous recovery; deletion awaits archive erasure and blocks late writers. The full atlas reports saving, loading and storage failures without new HUD panels. See CONTINUE_HERE.md for verified limits and integration results.

Melee-arsenal continuation (2026-10-24): three real main-hand sidegrades—Iron Spear (level 3), Broadhead Battle Axe (6), Iron Warhammer (10)—are craftable through the town forge and stocked by Brannoch. Shared profiles determine predicted and authoritative tap/heavy reach, arc, recovery, lunge, damage and poise; remote FX carry the same weapon identity. Sword and existing Foci/morph rules remain. Family swaps clear charge/combo while retaining recovery. Packed-ACK replay retains derived weapon context without expanding the wire format. Original cached directional held artwork and matching icons use current materials/palette. This is the melee portion of equipment progression; new ranged families, resident recruitment, travelling merchants and the broader master scope remain open. See CONTINUE_HERE.md for proof/integration.
