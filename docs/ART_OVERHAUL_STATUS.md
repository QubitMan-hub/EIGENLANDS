# Latest: flat cozy boss source redraw

All 14 source sheets, day/night exports, portraits and fallbacks now use simplified broad material shapes. Read [current boss redraw and verification](validation/cozy-boss-redraw/README.md). A shared per-sheet material palette also fixes grey/tan/pink speckling during conversion to the master palette. This supersedes the previous sampling-only art adjustment; existing smooth movement/combat and all other pending catalogs remain as documented below.

# Latest integrated stage: directional people and cozy bosses

The user-approved human designs now have eight elevated-camera views and use the shared action rig. QubitMan's source sculpture has a sword and shield. See [people, physical items and discoveries](validation/directional-people/README.md) and [boss presentation/combat](validation/cozy-bosses/README.md) for exact scope, evidence and remaining work. People use 64×64 cells with ground origin (32,61); older measurements below are historical. This stage does not complete the full wardrobe, faces, remaining icon families, building/environment/animal catalogs or every bespoke painted action.

# Reference-pack overhaul status — 2026-11-07

User specification: [complete request](design/art-overhaul-request.md). This supersedes earlier scale guidance that reduced characters to fit doors. Preserve identities and gameplay, use the supplied art designs, keep the elevated 2:1 camera, and fit world architecture to people.

## Latest fidelity correction — supersedes the narrow-body foundation below

Both split archives were reanalysed from all 20 original sheets and verified against their manifest. Players and NPCs now use fuller anatomy/clothing, 12-row directional faces and larger hair/headwear volumes; the two hero presets follow the supplied armour and garment cuts. Cells are 48×56 with eight pixels of transparent top padding and ground origin (24,53); camera scale and ground contact do not change. Equipment and reins use the actual body type. Surface houses now use catalog-inspired clapboard/terracotta, timber/plaster/slate, log/shingle and fieldstone/thatch construction, with clearer roof joints, shutters, stone chimneys and doorway-height canopies.

[Analysis, comparisons, proof and remaining limits](validation/reference-fidelity/README.md). Earlier seven-pixel head/48×48 descriptions below are historical stage evidence, not the current target. The full catalog and architecture conversion remains incomplete.

## Asset availability — received

Both split archives are extracted under `art-source/reference-pack`. All 20 PNGs and the category notes are preserved; checksums and dimensions are recorded in [inventory](validation/reference-pack-inventory.json). The earlier transfer block is resolved. Catalogs remain reference drafts, not validated atlases.

## Integrated foundation and vegetation stage

- Long-legged male/female foundations, 36/35 nominal skeletal height and seven-pixel heads, shared by players, NPCs and humanoid statues. Measured player silhouette is now **42 visible pixels at unchanged 1× zoom**, above the recorded 34 px baseline. [Current capture](validation/art-overhaul-current/before.png), [measurements](validation/art-overhaul-current/baseline.json).
- Sprite cells widened from 32×48 to 48×48 to prevent lateral dodge/death clipping; pixels and render scale remain unchanged, and the pivot remains bottom-centre. No character is downscaled to fit a building.
- Two reference hero presets: male steel/navy/leather/burgundy; female red high ponytail, pale bodice, teal/gold sash and burgundy legwear. Preset identifiers and packed appearance saves remain compatible; individual appearance choices still override presets.
- Latest user correction: walls are now **50 px**, door clearance **44 px**, lowered from the initial 60/50 px pass. This deliberately supersedes the earlier 1.15–1.3× clearance target; character world height stays intact. Footprints, collision, paths and entrances retain their existing world coordinates. No blanket footprint expansion is claimed.
- QubitMan's internal sculpt canvas expanded with a compensating offset so taller anatomy and the hat fit while boots remain on the original pedestal anchor.
- Sixteen named tree/sapling/stump/log assets prepared with measured nonuniform catalog bounds, alpha cleanup, disconnected-dust removal, fixed density, explicit ground anchors and a deterministic palette/RLE manifest. Ordinary forest, autumn, taiga and swamp trees and ordinary/seasonal stumps use the prepared art. Fruit trees, saplings and log are exported but not yet hooked into all orchard/young-tree/log gameplay states. Magical/desert flora retain their established specialised art.
- [Tree review on light](validation/reference-tree-review.png) and [dark](validation/reference-tree-review-dark.png). Source images remain recoverable. The pipeline is `tools/art/prepare_reference_trees.py` (Pillow, NumPy, SciPy); runtime decodes prepared data when seasonal object art is built, with nearest filtering and the existing shadow/occlusion systems.

## Verification for this stage

- Initial foundation checks: 15 focused client tests passed: catalog integrity, minimum scale/door clearance, directional actions, grips, appearance and building visibility.
- Latest browser asset checks: 1,600 directional action frames plus 3,120 outfit frames; zero clipping/alpha failures. This revealed lateral dodge/death clipping, fixed by adding cell padding rather than reducing the character.
- Production build and targeted ESLint passed. Built-game scale capture confirms unchanged zoom and increased standing silhouette.
- Real right-mouse movement entered smithy, guild hall and inn, with roof occlusion and zero page errors. [Door/interior screenshots and report](validation/reference-world/report.json).
- Existing packed-appearance compatibility checks passed. Gameplay data, rewards and quest definitions are unchanged by this stage.

## Resource art and grounding follow-up

Twenty-four source rock designs are prepared, plus one derived silver-vein material variant. Source alpha is thresholded, disconnected export noise and hidden backdrop RGB are cleared, and named PNGs plus a palette/RLE manifest ship under `client/public/art/reference` and `client/src/art/reference-rocks.json`. Natural surface boulders, desert sandstone/red strata, and copper/iron/silver/gold resource nodes use the new art. Glint-frame slot ordering is retained with stable repeated frames. Special corrupted rock and cave ore blocks retain their established art. Other catalog designs are exported for later mappings; do not claim all 24 are separate new mineable resources.

Visible surface rocks/ore leave local, nonblocking rubble after depletion. Rubble has no node, collision or loot, and is replaced when the tile changes again. It clears on chunk rebuild/unload or seasonal art rebuild; it is intentionally not a new persistent world object. Mining tiers, HP, drops, respawn and saves are unchanged. `tools/art/prepare_reference_rocks.py` rebuilds the assets with Pillow/NumPy/SciPy. [Light review](validation/reference-rocks-light.png), [dark review](validation/reference-rocks-dark.png), [actual mining proof](validation/reference-mining/report.json).

The detached-shadow follow-up adds a shared small contact footprint to trees, rocks, props and actors, excluding grass/flat clutter. Cast silhouettes use a common projection with independently controlled horizontal length and flattening; ordinary actor shadows use the same navy as scenery. Magical shadow companions retain their tint. Visible static objects refresh their lifted ground position each frame, so terrain arriving later cannot leave a sprite and shadow at an old elevation. Contact/cast positions follow that ground point, preserve crop/water offsets, and are culled/destroyed with their owners.

Verification: 8 focused tests passed, including changed terrain lift without a camera-boundary change, projection geometry, catalog integrity and depleted-node replacement. All 25 exported rock PNGs have binary alpha and zero RGB in transparent pixels. Built-game mining via opaque-pixel click awards stone once, presents rubble and does not continue awarding loot. Browser checks at 07:00, 12:00 and 17:00 sampled 73–76 visible trees, rocks, furniture, lights, players, NPCs and enemies: contact/cast anchor error below 0.01 px, changing cast direction, no page errors. [Grounding screenshots/report](validation/grounding/report.json). Client typecheck, production build and targeted lint passed.

Remaining limits: continuous streaming/performance under multiplayer load and every mountainous prop placement need wider playtesting. Rubble is local feedback; not a durable depletion marker. Building roof shadows retain their existing renderer. New art is not a completion claim for all environment catalogs.

## Closer exploration camera and mounted follow-up

The user requested a closer view and shorter architecture after the initial pass. Normal and Close framing now add one integer backing-pixel scale step across viewport sizes; Far retains its existing framing. At 1000×760 / DPR 1, Normal is 2× instead of 1×. The character remains the same world size; the camera intentionally makes it larger on screen. Existing saved zoom choices remain valid. Roofs and door jambs use the revised 50 px wall / 44 px doorway geometry.

Mounted bodies now use an append-only `ride` clip (230–237): bent knees, straddling feet and hands at the reins. The renderer places the solved hips on the saddle; it no longer crops away the lower 14 pixels of the character. Reins are drawn to both solved hand grips, stirrups are part of the saddle, and held items are hidden while riding to avoid overlapping the reins. Space dismount and attack-to-dismount mechanics remain. Road couriers also use the full ride pose, replacing their separate cropped-body workaround.

Verification: 18 focused client checks; 1,664 directional action frames and 3,120 outfit frames without clipping/alpha failures; built-game mounting, movement and Space dismount; three lower-door approaches and entry. [Camera/rider evidence](validation/cozy-camera-mount/report.json), [doorway evidence](validation/cozy-doorways/report.json). Production build, client typecheck and targeted lint passed. Horse art still has four directional headings and two gait frames; complete reference animal/gait replacement and richer boarding/dismount clips remain unfinished.

## Follow-up animation integration

Three append-only clips are integrated: `fish_reel` (206–213), `fish_land` (214–221) and `plant` (222–229). Reeling retains the water coordinates and rod state through the rhythm stage, ends on a matching result, and drives the line from the actual animated grip. The landing gesture waits for result dismissal; planting uses a grounded crouch with hands toward the soil. Existing frame IDs and authoritative resource/reward behavior are preserved.

Nine focused client checks passed for these changes. `e2e/reference-fishing.mjs` passed against the production browser build: retained rod/reel, landing and kneeling planting frames, zero page errors. [Presentation report](validation/reference-fishing/report.json); these are injected authoritative-event fixtures, not a new end-to-end rewarded catch. The existing real attack/charge/release browser check also passed after the body/cell changes. Full directional asset check now covers 1,600 action frames plus 3,120 outfit frames.

## Wardrobe and village-animal integration follow-up

All 355 catalog entries now have cleaned transparent previews, source bounds and palette/material recipes. Seven selectors are saved alongside the unchanged legacy packed appearance, validated by the server and synchronized to other clients. Trousers and shorts are mutually exclusive; equipped armour remains authoritative for visible torso/leg/boot layers. Patterns are applied in body-local coordinates, preserving facing and animation. Leg/boot material coverage now follows the limb rather than posed world height, preventing boots from sliding up kneeling or riding legs. The picker preserves the square sprite aspect ratio.

**Limit:** these are fitted material/pattern adaptations, not 355 newly authored, faithfully traced multidirectional meshes. Hair uses the existing silhouette families with source palette and volume; facial details use the native face renderer. Individual silhouette fitting remains open.

Integrated the available `ccr-3d7267f2-lb0y4u` town/road scene branch while retaining current reference bodies, camera, ground shadows and mounted player fixes. Cats, dogs, hens and pigeons now share the livestock renderer's 2:1 projection, directional lighting and fixed ground pivot instead of flipped flat drawings. Stable horses and road herds use current canvas anchors; town caravan riders use the straddling pose and saddle position. These town pets are ambient, noncolliding scenery, not new tameable or authoritative wildlife. Wolf bounty overlap is consolidated into one telegraphed pack call.

Verification: 64 distinct village-animal directional frames, no edge clipping; [contact sheet](validation/village-animals/directions.png). Focused scene/heading/grounding, bounty, appearance and profile checks passed. Browser wardrobe selection, trousers/shorts switching, synchronized state and reload/rejoin passed ([report](validation/reference-wardrobe/report.json)). Production solo build passed with the existing bundle-size advisory. Built-game town visits captured the cat, dog, stable horse and bench/pigeons with no page errors ([scene report](validation/village-animals/scenes.txt)). This selected town had no hen scene; hens were checked in the directional asset review.

The matching connected-world work is now available as `afff999` on `codex/connected-world-biodiversity` and integrated. Its 42 plants and 31 wildlife species were corrected to the shared isometric projection and palette, with directional anatomy, ground pivots and bounded raster work. Generation-7 tiers, local discoveries and ecology retain their gameplay integration; saved revisions remain pinned. See [integration verification](validation/connected-world/README.md) and [art review](validation/biodiversity/README.md).

## Arrival and work-contact follow-up

A compact isometric arrival garden now decorates unmodified ground around the shrine, with seeded village guidance, seasonal borders and scheduled travellers/animals. It preserves saved terrain, collision, player ownership and progression. Carrying, sweeping and lute-playing use append-only directional clips; six carried props follow model grips and posed hands, with correct body/child scaling and no baked floor shadows. Blocked scene routes wait/replan rather than snapping. Exact proof and remaining limits: [arrival/work validation](validation/arrival-garden/README.md). This does not complete the larger art/catalog request.

## Recorded before any art edits

Recoverable code point: `9fdc05d` (includes completed guard/parry work; no art-pack changes). Screenshot and machine-readable measurements: [before.png](validation/art-overhaul-baseline/before.png), [baseline.json](validation/art-overhaul-baseline/baseline.json). Reproduce with `node e2e/scale-baseline.mjs <preview-url> <output-directory>`.

- Built game, 1000×760 viewport, zoom 1, sprite scale 1, idle frame 0, player at (0.5, 4.5).
- Sprite cell 32×48; opaque silhouette rows 14–47 inclusive: **34 vertical world pixels and 34 screen pixels** for this baseline appearance, including hair/outline.
- This is a measured visible-silhouette baseline for one appearance, not a universal anatomy measurement. Preserve each appearance's standing height when mapping the full catalog; do not replace the recorded visible-height floor with a smaller nominal skeleton height.
- Projection stays `sx=(x-y)*16`, `sy=(x+y)*8`; vertical heights map 1:1 before zoom.
- Existing door rendering uses a nominal 34 px opening. It needs clearance review against actual visible heights: 34 × 1.15–1.3 gives roughly **40–45 px** for this baseline. Increase geometry/footprints/interiors as needed, then recheck collision and access. No door, building, character scale or camera changes were made in this preparatory step.

## Integration map

- Renderer/game: TypeScript + Pixi, `client/src/game/Game.ts`; terrain shader in `client/src/gl/terrain.frag.ts`.
- Characters: `client/src/art/body` shared skeleton, IK, outfits, headwear and painting; `art/actors.ts` builds lazy player/NPC frames.
- Actions and grips: `art/person-actions.ts`, `art/body/poses.ts`, `art/body/index.ts`, `art/weapons.ts`; preserve existing frame IDs.
- World assets: `art/buildings.ts`, `art/stories.ts`, `art/props.ts`, `art/town.ts`, `art/livestock.ts`; logical world/collision definitions under `shared/src` and streaming stores.
- Simulation and prediction: `shared/src/sim.ts`, `client/src/net/prediction.ts`; server gameplay remains authoritative.
- Existing character-system limitations: `CHARACTERS.md`. Read these alongside the new request rather than claiming already-complete reference integration.

## Pending stages

1. Receive/read pack and notes; inventory actual contents, transparency and nonuniform silhouettes.
2. Establish individual asset metadata, consistent pixel density and protected scale; validate front/back views and identity references.
3. Integrate both bodies and clothing catalogs, correct occlusion, eight directions and missing animation states.
4. Adapt buildings/interiors/collision/navigation; replace crops, vegetation/resources, animals and mounted poses using supplied designs.
5. Validate actual gameplay and capture matched-camera comparisons, actions, crop/resource events, save compatibility and mounted scale.

The foundation/scale, hero-palette and tree stage is integrated. The following requested work remains incomplete:

- Faithful individual silhouette fitting for all 355 catalog options across actions/directions. Selection, source previews, palette/pattern adaptation and save/sync are integrated, but native haircut/face families remain shared.
- House catalog background removal, faithful roof/material/design adaptation and any necessary per-building footprint/interior/furniture enlargement.
- Farmland tile cleanup, seam normalization and all crop-stage mappings; additional mappings/seasonal treatments for the now-prepared rock catalog. Core surface rocks, ores and local depleted rubble are integrated.
- Individual farm/wildlife anatomy replacement, species-specific gait libraries, remaining mounted-layer refinements and richer mount/dismount clips. Full straddling rider bodies, hip anchoring, reins and stirrups are now integrated, but the animal art/gait overhaul is not complete.
- Broader carrying/contact coverage, richer facial expressions and remaining bespoke contact/event refinements. Fishing reel/landing and planting now have distinct clips; broader natural-timing and object-contact polish remains.
- Comprehensive same-camera comparisons beside animals/on mounts, every crop/resource/save route, every settlement and performance under multiplayer load.

Do not treat the first integrated stage as completion of the entire request.
