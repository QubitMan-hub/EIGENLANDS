# EIGENLANDS art direction

EIGENLANDS is a medieval world with extraordinary quantum magic: warm plaster and worn timber, cool stone, meadow greens and deep teal water. Reserve saturated violet, cyan and pink for phenomena the player should notice. Everyday materials should support those accents.

## Projection and scale

- Ground tiles are **32×16 diamonds**, projected at 2:1. `game/iso.ts` owns world projection and depth ordering. `art/isokit.ts` owns prop geometry: sixteen model units span a tile; +v is the lit, screen-left face and +u the shaded, screen-right face.
- Furniture has actual top and side planes, floor anchors and wall-facing variants. Never rotate a frontal sprite to simulate isometric perspective.
- Use nearest-neighbour textures and integer device-pixel world scaling. Round line endpoints before rasterization. Keep painted details inside their sprite bounds, including outlines, flower boxes and shadows.
- Architectural walls remain individual depth-sorted pieces. Roofs fade behind the player and disappear inside; front walls switch to their cutaway variants. Decorative window boxes disappear with those walls.

## Palette and materials

The shared palette remains 48 colours in six rows of eight: neutrals, greens, earth, water, warm and quantum. Shader indices depend on that layout. The first five ramps favour muted greens, warm limestone, weathered wood and teal water; the quantum row retains its existing colours and indices. The `Scene` creature renderer additionally uses material-specific RGB ramps for fur, shell and crystal, shaded within the same muted value range. These ramps do not alter terrain palette indices.

Use palette indices (`C.g4`, etc.) in generated artwork. Runtime lighting can multiply/add light colours. Choose a clear shadow, body and highlight before adding detail. Use larger leaf clusters with shared shaded cores, not single-pixel noise. Autumn cores must use autumn ramps. Grass is quieter than characters and interactable objects; dense patches remain distinct from paths and clearing ground.

Roofs use staggered material courses with restrained seam contrast. The hall and inn have paired cross-gabled dormers; the library and farmhouse have one. Dormers are intersected in the existing roof ray pass, retain correct occlusion and swap only their panes to warm night colours. Entry covers on the hall, inn, store and bakery use sloped `Iso` planes and brackets; they fade with the roof and introduce no new collision. Stone paving uses warmer stones and occasional moss in joints. Floorboards have seams, sparse grain and nail heads. Water retains depth, shoreline foam, ripples and reflections, with faint shallow-water caustics. Avoid uniform bright texture across every surface.

## Characters and furnishings

People use **24×32 frames and eight directions**. Player atlases have 30 columns: idle (0), eight walk phases (1–8), breathing (9), strike/recovery (10–13), eight running phases (14–21), crossbow aim/recoil (22–25) and staff casting/recovery (26–29). NPC atlases retain ten columns to avoid generating unused combat poses. Preserve frame dimensions, foot anchors, equipment appearances and directional conventions. Smaller tapered heads, single-pixel eyes/brows and clean undithered shading improve human proportions and readability. Keep recognizable hair, hats, scarves, aprons and outfit colours. Strike poses follow predicted local attacks and remote melee events; running uses distance-driven stride frames. Enemy attacks start from their state transition rather than an arbitrary global animation phase. Reduced motion uses a steady strike pose and stable idle. The seven existing weapons have held artwork in eight facings, sharing the body’s near-hand anchor. Weapon geometry is rasterized into cached nearest-neighbour atlases with transparent margins; equipment and shooter identity are synchronized for other players in the same world room. Crossbows use a support hand, while staves return to an upright guard. Weapon sprites hide on death and while sailing.

Furniture uses the existing `Prop` geometry and cached textures. Linen folds and quilt borders should read before stitching. Table settings and open ledgers sit on their actual tabletop. Bookcase folios, cabinet linen and labelled pantry jars use the same projected geometry. Keep circulation routes and door approaches clear. Hadamere retains its existing furnished buildings, NPC schedules, shops and quests. The hall and inn have two side dining areas and the farmhouse a compact table, all outside the existing entrance aisles. Yard props follow the building's trade; bakery, library, herbalist and tailor have distinct hanging signs.

## Motion, lighting and quantum identity

Use the shared `WindField` for vegetation and chimney drift. Smoke uses pooled sprites, integer size steps and fades with its roof. Reduced motion disables smoke; existing reduced-motion handling remains authoritative for weather and gameplay effects.

Keep warm windows and lanterns distinct from cool outdoor shadows. Quantum language remains: double silhouettes for superposition, threads for entanglement and phase colours for quantum state. Existing telegraphs, sound cues, accessibility settings, creature sheets and ability effects remain in use. Strike poses, distance-driven wildlife gaits and lighter melee trails refine the existing presentation; quantum ability families and the licensed wildlife sheets remain its foundation.

## Mobile

Use landscape on phones: safe-area-aware thumb controls, a compact Journal/Menu action row and scrollable windows/hotbar. Request fullscreen/orientation lock only from a user gesture. Browsers that decline it use physical device rotation. Portrait remains available through the rotation prompt. Clear held and queued touch input on focus, visibility or viewport changes. Landscape phones use a phone-specific zoom to keep sprites readable and bound terrain fill cost. Keep interaction prompts above abilities and mobile notifications below the health area; idle chat starts collapsed unless the player saved another preference.

## Review and provenance

Review `/labs/artlab.html`, `/labs/spritelab.html`, `/labs/uilab.html`, plus playable day/night streets, water and interiors. Test solo and multiplayer separately. See [overhaul notes](overhaul-notes.md) for validation and remaining scope.

All new artwork is original procedural artwork. No new third-party assets were imported, purchased or relicensed. Existing critter asset provenance remains unchanged. The supplied ZIP/7z packs contain no license text; matching repository sheets remain in use and other pack images serve as references only. See the [world upgrade audit](../design/world-upgrade.md).


Sparse wilderness details use one deterministic candidate per 8×8 cell: clover, fallen leaves, small boughs, shore driftwood, scree, cave formations and glowcaps. These are cosmetic ground details, drawn by the existing tile-object views. They do not create collision, loot or saved objects. Edited tiles and occupied ground suppress them; town and spawn stay clear. Keep silhouettes low so walkable terrain remains believable.

Shrines use projected stepped stone, brass cradles, faceted suspended qubits and front/back orbit threads. Superposed crops keep a stable primary plant and a translucent alternate silhouette linked by a short quantum strand; only three sparse motes change at one frame per second. Reduced motion selects frame zero. Do not return to alternating single-pixel checkerboard crops.


Ore and ordinary stone share a bevelled mesh projected through `Iso`: broad lit tops, shaded sides, and mineral seams sampled continuously across exposed faces. Avoid rounded screen-space piles with bright nuggets pasted onto their silhouettes. Biome stones and crystal bases use the same construction. Underground rock has its own snow-free material selection; surface winter must never put snow on cave ore. Sprite margins include the whole projected footprint.

Natural placement uses deterministic local thinning for tree trunks, small within-tile offsets for organic artwork, lighter undergrowth, and coherent surface mineral pockets. Cave deposits replace solid wall margins in connected seams, with clear walking space between them. Landmark siting uses the original surface layout; existing cave mouths, ruins, shrines and caches retain their locations, and existing tile edits continue to override generation. Never introduce new solid terrain into previously open ground when refining the generator.

The Qubitman figure is an authored pixel sculpture: weathered green stone, a turned face, long overlapping carved robes, a planted staff, restrained bronze trim and a raised palm beneath the qubit. The projected plinth shares its moss-green material; quiet cracks replace repetitive surface dots. Its feet sit on the projected plinth plane. Preserve the inscription, braziers, orbiting qubit, original ground anchor and stable reduced-motion frame.


Broadleaf crowns use asymmetric intersecting masses shaded together, so their branches read as one canopy rather than separately lit balls. Autumn uses one dominant foliage ramp per tree. Conifer tiers vary in width and tip position. Bare winter recursion must fit the existing 48×64 cell; `/labs/artlab.html?lab=foliage&scale=3&motion=0` displays all 24 seasonal variants.

The continuous `vegetationCover` field shapes grass, flowers and cosmetic scenery. Ferns favour nearby trunks, reeds grow on sandy water banks, and plain boulders favour the existing rocky ridges. New plant silhouettes use the shared wind field and freeze under reduced motion. Preserve coastline topology, town layouts, original landmark siting and persisted player edits when tuning these distributions. Water foam is broken into patches, caustics are warped, and ripples are short and sparse.

## Coastal residents, creatures and exploration

Lumenport, Reedhaven, Brinewick and Amberquay extend the existing settlement interfaces. Each has authored dry streets, furnished buildings and a dredged harbour connection; their local island shelves deliberately change generation around these four new sites. Hadamere retains its original layout. New residents use individual lazily generated 240×256 atlases, ten body frames and eight facings, with distinct clothing, hair, hats and accessories. Use `/labs/artlab.html?lab=portfolks` to review all forty.

Original fox, otter, tortoise, owl, Briar Warden and Prism Crawler rigs use the existing `Scene` projection and 56×52 frames, anchored at (28,44). They have four facings and idle/move/windup/attack/hurt/death sets. Use readable ear, tail, shell, facial-disc and spine silhouettes. Existing boar/stag/badger/wolf sheets remain authoritative for those species. Gaits follow travel distance; idle actions play once with a resting interval, and reduced motion holds frame zero. View all ten models at `/labs/artlab.html?lab=fauna&scale=3`.

Six held tools join the seven existing weapon designs in cached directional atlases. Align them with `personGrip`; use the equipped weapon during attacks and the selected tool while travelling. Remote held-tool metadata comes from the server's actual inventory selection. Hide equipment while dead or sailing. Ocean sailfin, moonray and prism nautilus icons have distinct fin, ray and spiral-shell silhouettes. Ship gunwales, deckboards and rigging are drawn for each heading rather than rotating a finished sprite.

Completed shrines disappear for the solver, including their shadows and light sources; reloads retain that state. Lantern puzzles show the authoritative lit mask, and rune trails mark the next seal and remaining time. Keep effects sparse enough to read combat telegraphs. Sea salvage uses a small projected floating crate, brass bands and pennant at the existing water elevation.

Run `node e2e/world-upgrade.mjs` for frame bounds, caching, resident uniqueness, shrine disappearance and rendered coastal scenes. These checks supplement playable solo/multiplayer tests and do not establish completion of the broader backlog.

## Upper rooms, submerged sanctuaries and the field ledger

Furnished upper rooms reuse buildings, roof cutaways and existing chunk/shard collision through UPPER_OY=-80000. Dry sanctuary chambers use DIVE_OY=-120000 with a sparse deep-water buoy and charter-gated return. The terrain shader must raymarch the full cave-wall height on these planes as well as the Undercroft. Stairs rise away from the viewer with separate treads, posts and an inclined handrail; the downstairs hatch includes a transparent margin and its anchor remains the tile centre. New buoy, ladder and coral columns use Iso-projected top and side faces. Sea salvage now registers its existing original artwork rather than falling back to a generic crate.

Platform courses cross real water gaps with authoritative landings and a 650ms visual arc; reduced motion omits that arc. Green outlined seals are safe, red seals show spikes as well as colour. Two-second safe windows use the existing server clock. Completing a challenge uses the existing one-claim shrine reward and disappearance path. Entry/exit structures remain available for safe return.

The player HUD uses bronze rules, muted ink-green recesses and parchment text. A compact labelled carmine health bar shows current/max values with a low-health mark. Everyday chrome avoids purple gradients and glow. Inventory search/category/order changes are presentation-only; the quick-bar retains its real numbered slots. Selectable details and explicit use/equip controls support touch, and dialog focus stays inside the open window. See DESIGN_SYSTEM.md for targets that are still pending; survival indicators must not be drawn before the corresponding gameplay exists.


## Exploration chart

Use the existing iso.ts projection for both terrain and marker coordinates; north follows its screen-space direction. The chart is cartographic ground art, not a second world renderer: each visited tile paints a small 2:1 diamond in a cached chunk image, with nearest-neighbour scaling. World sprites and simulation remain unchanged. Unknown terrain stays ink-dark. Never reveal procedural landmarks merely because their coordinates can be computed. Only discovered locations, server-synchronized nearby actors and player-authored waypoints are eligible. Keep friendly circles and hostile triangles distinct beyond colour. The atlas and minimap share one saved journal and marker rules, including current layer and solved shrine suppression. All artwork/icons remain original; no external pack was imported.

HUD refinement: quests, farming tips and Circuit training guidance live in the Journal. The top-right time/day/town strip and Journal/Menu replace the dial orb and vertical dock. Keep temporary combat and contextual-use cues. Equipment comparisons use a plain legible table with signed changes and shared set bonuses, with an explicit ring replacement selector.
