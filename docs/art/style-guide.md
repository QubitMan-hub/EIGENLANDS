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

Use the existing iso.ts projection for both terrain and marker coordinates; north follows its screen-space direction. The chart is cartographic ground art, not a second world renderer: each visited tile paints a small 2:1 diamond in a cached chunk image, with nearest-neighbour scaling. World sprites and simulation remain unchanged. Unknown terrain stays ink-dark. Never reveal procedural landmarks merely because their coordinates can be computed. Ordinary locations require discovery; explicit quest tracking may mark a described home or landmark over fog, without revealing terrain or unseen live NPCs. Server-synchronized nearby actors and player-authored waypoints remain eligible. Keep friendly circles and hostile triangles distinct beyond colour. The atlas and minimap share one saved journal and marker rules, including current layer and solved shrine suppression. All artwork/icons remain original; no external pack was imported.

HUD refinement: quests, farming tips and Circuit training guidance live in the Journal. The top-right time/day/town strip and Journal/Menu replace the dial orb and vertical dock. Keep temporary combat and contextual-use cues. Equipment comparisons use a plain legible table with signed changes and shared set bonuses, with an explicit ring replacement selector.

Encounter panels use the same bronze/ink/parchment treatment as the compact HUD. Reserve carmine for health and ochre for remaining poise; numeric values and text state labels supplement colour. Boss phase announcements stay inside their header and damage trails reset between identities. Avoid stacked target/boss/compass overlays. Journal Journey contains progression detail, leaving the playfield clear.

Atlas destination extension: the full map adds warm-gold quest triangles and muted-lilac party circles, explained in its legend and collapsible directories. The map directory keeps discovery-gated quest markers; the single explicitly tracked quest may guide to its described home over opaque fog. Authorized party coordinates may also appear over uncharted ground. Neither adds terrain or a world-space effect. Keep names and detailed objectives in the directories rather than crowding the map with text or adding a HUD tracker.

Durable atlas continuation: archived pages retain the same tile colours and 2:1 diamonds. Show ink-dark fog for unvisited cells and “Loading chart…” while known archived ground is being read; a party marker never charts terrain. Save/storage state remains one line inside the full atlas. No additional gameplay chrome, artwork or animation is introduced. Disk history can exceed the bounded 512-page resident/raster caches; it remains subject to browser storage limits.

Circuit workshop: matte ink-green Board surfaces and bronze borders now match the field ledger. Parchment labels replace decorative purple headings/star backgrounds; the existing generated gate gems, orb colours, outcome hues and Link threads remain. Guided patterns reuse those same assets with nearest-neighbour scaling. Save feedback stays transient; Attune no longer pulses continuously. No external art was imported.

Welcoming-world continuation: tutorial controls and quest checklists remain inside the Journal. The existing travel strip carries one tracked destination, projected direction, distance and Sanctuary label. Use a warm-gold triangle on the chart; do not add a world-space beacon, continuous animation or a second HUD panel. Town wards are simulation protection with quiet textual explanation, not decorative particle fields. No artwork or palette changes were introduced in this slice.

Lumen keeps its existing original world sprite and Board portrait. Tutorial story pages are docked inside the Board, keeping the mobile aiming area clear; first-steps directions remain in Journal. Do not restore a floating story panel over free play.

Weapon comparisons retain original item icons and character equipment. Pack-only before/after attack tables use the field-ledger materials; timing/effects are disclosed on demand. Numeric output is qualified as base output rather than final combat damage. No new art or animation is introduced.

Optional travel needs reuse the existing ledger: food leaf-green, water blue, both labelled/numeric and ochre when low. Cozy hides them. A new original leather waterskin inventory glyph has a stitched body, strap and distinct water accent when filled; empty/full textures remain in the existing 16×16 icon cache. Existing water/heal effects and pixel anchors are reused. No external assets or new held-consumable sprite pipeline are introduced.

Living wildlife bonds retain the existing directional critter sheets, feet anchors, natural palette and reduced-motion animation rules. A quiet warm ground ring and health strip distinguish friendly bonds; violet silhouettes/aura/rank colours remain extracted echoes. Roster portraits crop the first SE idle frame at native pixel size from the same source sheet. No additional imported or generated art assets are introduced by this feature.

Directional casting reuses the projected dashed cyan line and landing ring. Extent comes from actual possible bolt/link/blink forms; selection alone does not commit a desktop cast. The armed orb has a quiet static outline, and reduced motion removes reticle pulses. Cursor movement and camera look use ground coordinates while preserving integer sprite scale and anchors. No external art is added by control personalization.

Melee arsenal: original Iron Spear, Broadhead Battle Axe and Iron Warhammer silhouettes share steel/pale upper faces, shaded metal sides, wooden shafts and restrained leather bindings. Their 16×16 inventory glyphs depict the same head/haft materials as the held equipment. Rasterize each facing/pose in the existing 56×64 padded atlas; do not rotate completed sprites. Resting heads angle away from faces while preserving the hand grip; their rest angle comes from the facing’s idle grip, so walking cannot flip it when the wrist crosses the torso. The spear points along the facing during its four thrust poses while its grip follows the existing human hand. Axe and hammer follow the existing strike poses; slower recovery stretches their pose timeline. Nearest sampling, integer world scale, feet/grip anchors, back-facing occlusion and reduced-motion static strike pose remain. Projected attack fans use the actual family reach and half-angle; heavy rings stay in the existing quantum palette. Equipment lab supports `weapons=sword,spear,battle_axe,warhammer&frame=0..29` for review.

Camera/grounding polish: camera follows the interpolated player body directly with device-pixel snapping; RMB never contributes a camera offset. Compact item icons use native 16px sampling rather than fractional 24px enlargement. Ore icons use faceted stone and distinct upper-lit mineral clusters. Broadleaf and pine trunks share the same ground-contact baseline, including quantum tree frames. Animated objects refresh anchors with their current sprite. Actor and prop cast shadows share the same flattening and ground origin. Sun and moon shadow azimuth/elevation vary continuously with game time, fading at the horizon; existing time-based ambient lighting remains the scene colour source.
Item shading uses undithered material bands at 16×16 so small silhouettes do not dissolve into alternating pixels. This changes the shared icon rendering across the catalog; it is not a claim that every item received a bespoke new silhouette. Pixel-art material highlights remain authored into the sprites, while cast shadows and ambient scene colour follow time.

Harvesting uses the existing four human strike frames with the authoritative axe/pickaxe identity and node-facing direction; combat strikes retain priority and reduced motion uses a static contact pose. Ordinary seed packets show the actual crop glyph on parchment with a coloured header at native pixel scale; superposed seeds retain their quantum orb identity.

Utility tools: accepted till, water, cast and net-sweep events identify the actor and tool. Hoe/net use the existing strike family; watering-can/rod casts use the existing cast family with geometry aimed along the actor facing. Empty net attempts still animate; invalid actions do not start poses. No persistent HUD is added. Common fish now distinguish long pike snouts, curved eels, perch bars, trout spots, catfish barbels and carp fins in the existing native 16×16 palette.

Cooked food uses original served-dish silhouettes: split baked roots without growing leaves, plated fried fish/steak, folded omelet, lattice pie, ingredient-filled stews, cloth-capped jam and a handled quantum tea cup. Main potion roles use distinct round/tall/angular/square/diamond glass bodies and cross/leaf/bolt/shield/star marks. Keep all details on the native 16×16 grid, at least one pixel of room for the outer outline, cached nearest scaling and the shared palette. No item stats, recipes or nourishment rules change.

## Player-built architecture

Eight original craftable pieces share the existing 32×16 tile grid and fixed palette. Timber walls use warm plaster with diagonal framing; stone walls use readable masonry courses. Floors, walls/doors, stairs and roofs are independent structural components, with furniture on the existing ordinary object layer. `art/construction.ts` caches geometry from `isokit`; inventory silhouettes have a native 16px outline budget. Do not rotate completed sprites. Adjacent slate/thatch roof panels generate a continuous bounded gable profile; the room containing the player lifts its roof and cuts front walls. Stairs have distinct ascending geometry and a recessed descending landing. Structural sprite anchors are the ground-contact centre (24,80) on 48×96 canvases; floor planes draw beneath the shared sun-driven shadows. Walls participate in entity depth sorting; roofs use the existing roof layer. Construction has no decorative sway and remains static under reduced motion. Inspect all orientations in `/labs/artlab.html?lab=construction` and playable interiors with `e2e/construction.mjs`.

## Visual budgets

Auto selects Economy on touch/limited devices; High keeps the detailed material shader. Economy uses the same biome palette ramps, rare quantum accents, water depths, shore foam, geometry and collision with quieter clusters. Native sprites stay nearest-neighbour and use integer device-pixel scaling. Background terrain is overscanned and painted at 15/24 Hz while camera presentation and actors update independently; do not couple actor or telegraph cadence to cosmetic terrain updates. Lighting is deliberately smoother at half resolution. Gentle weather is the default: short faint rain, fewer splashes/snow/leaves, lighter storm tint/fog, and no lightning in Economy or reduced motion. Full and Off are explicit preferences; simulation weather is unchanged. The existing building painter is shared by main/worker paths, with exact day/night/cutaway pixel fixtures in e2e/fixtures/building-pixels.json. No imported assets or separate world generator were introduced.

### Gathering and interior polish (2026-10-24)

Held tool sheets share the 24×32 body's grip at the exact same screen anchor; the equipment overlay has no extra vertical offset. Idle heads lean outward and fingers remain in front of the shaft. A watering can has a vessel, handle and spout, without a pole. Beds stack legs/rails at floor level, mattress at z5, pillow/quilt above it and a rear headboard using Prop's true wall-facing geometry; do not interpenetrate blanket and mattress volumes.

Generated two-floor town buildings reserve a back-corner 2×2 stair landing before furnishing. Native enemy models now include Reed Stalker's moss/root silhouette and Cinder Moth's warm patterned wings, with idle/move/windup/attack/hurt/death in four facings and day/night variants. Windups reuse existing readable combat decals; these additions never increase population budgets.


## Undercroft survey districts (2026-10-25)

Entrances, shafts, supply lifts, vents and resonant altars use `art/caves.ts` and the shared `Iso` projection. Openings are cut into visible side planes; rails, beams and platforms show real depth. Ground anchors remain the tile center. Architecture uses the existing stone/wood/iron ramps and small warm or quantum accents, nearest filtering and cached textures.

Cave floors use quiet habitat ramps (amber, moss, cool mineral slate, basalt, pale frost, deep teal). Floor material stays lower in contrast than ores, actors and telegraphs. Economy avoids dense animated noise, while preserving the same habitat colors. Survey roads and wooden lake crossings provide readable navigational structure. Ambient cave light is intentionally brighter than the earlier near-black cave setting, with local shaft/altar/crystal lamps preserved.

Nine original cave models share the existing four-facing rig, lazy sheets and idle/move/windup/attack/hurt/death interface. Small bats, capped fungi, armored scarabs, horned rams, segmented skitters, tailed lurkers, vault sentinels and the bell-shaped keeper have distinct silhouettes. Idle motion is restrained; windups and contact poses communicate attacks. Reduced-motion rendering keeps the existing pose limits. Do not substitute unrelated fallback sprites for new enemy IDs; the art-lab script verifies distinct images.

## Cave materials and architectural identity (2026-10-25)

Use ribbed, low barrel vaults and round oculi for generated cave buildings; surface gables retain their previous silhouette. Submerged sanctuaries use teal dressed masonry, mosaic floors and shell arches. Keep player-chosen timber/stone building materials literal. Architectural raster bounds must enclose curved roofs; gable-plane bounds cannot be reused for a barrel vault.

Mushroom groves use original clustered stems, elliptical caps and restrained cyan speckles, not potted houseplants. Water and magma cascades show a top source, visible rock sides, falling streams and a grounded splash/apron. Magma is dark crust with sparse warm fissures; its sparse light grid avoids per-tile light floods. Arena inlays use muted brass/violet, so red/orange combat warnings remain distinct. Keep the floor seal behind people and enemies, with zero collision.

Chest lids are reconstructed around a model-space hinge for four poses, with wooden, vault-metal and sea-weathered palettes. Their animation follows accepted server interactions and returns to closed; never loop idle chests. Reduced motion uses immediate endpoint poses. The Bellkeeper's skull cavity, long hooked fingers, iron bell armor and dangling chains should read at game scale without filling the screen with effects. All textures retain nearest filtering and cached geometry.

## Ground texture rules — replaces the earlier noise-contour floor painter

Never assign an entire low-frequency smooth-noise contour a light/dark material color: it produces rounded patches. Use seeded, sparse, world-anchored angular chips and short cracks with varied positions, lengths and mirroring. Broad fields may supply only low-amplitude continuous shading. Economy uses the same material language, with fewer marks rather than filled ellipses/checkerboards. Meadow variation controls plant density rather than whole-ground color islands. Keep snow/sand ridges directional and water highlights in short ripple clusters.

Feather habitat palettes only across true adjacent material boundaries. Loose dirt/grass/mineral-earth edges may wear into one another over a narrow pixel band; preserve actual elevations, water boundaries, paved stone and wall contacts. Do not shift biome sampling with large noise offsets. Indoor and underground ground never receives cloud shadows. Micro-textures must remain fixed in world space while the camera moves, in both detail modes.

### Mine infrastructure and restrained liquids

Below ground, ordinary stone and copper/iron/silver/gold nodes are geological blocks: a 32×16 ground diamond, 13px high to meet the existing cave crown, with veins evaluated through the top and both lit faces. Surface ores keep their natural outcrop silhouettes. Do not rotate a frontal resource icon to create either model.

Survey boards stand beside real supply lifts; settlement records belong at the provisioner's frontage. Use the native sign painter for unknown sign subtypes, retaining special noticeboard geometry. Dining chairs rebuild all four compass orientations toward their adjacent table; their uprights and horizontal rails belong along the seat's rear edge. Street lanterns use stone feet and metal brackets and must pass street-edge, building and door-clearance checks.

Mine rails use connected u/v endpoints, cross ties and continuous corner rails at ground level, behind actors. The cart has separate wheel pairs, a recessed bed and iron side walls. A moving rider uses an idle passenger pose; the cart translates without ornamental bobbing. Mine circuits are small, dry loops in mining chambers, never boss rings or settlement streets.

Lava is dark crust with sparse warm fissures, with no white sparkling carpet. Water has slower, sparse ripples and broken low-contrast foam. A falling stream may appear only against an actual rear cave wall with a pool at its foot. Its upper end meets the cave crown, not a freestanding source column. Reduced motion stops texture animation and keeps every route and hazard readable.
