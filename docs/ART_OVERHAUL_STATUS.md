# Reference-pack overhaul status — 2026-11-07

User specification: [complete request](design/art-overhaul-request.md). This supersedes earlier scale guidance that reduced characters to fit doors. Preserve identities and gameplay, use the supplied art designs, keep the elevated 2:1 camera, and fit world architecture to people.

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

## Closer exploration camera and mounted follow-up

The user requested a closer view and shorter architecture after the initial pass. Normal and Close framing now add one integer backing-pixel scale step across viewport sizes; Far retains its existing framing. At 1000×760 / DPR 1, Normal is 2× instead of 1×. The character remains the same world size; the camera intentionally makes it larger on screen. Existing saved zoom choices remain valid. Roofs and door jambs use the revised 50 px wall / 44 px doorway geometry.

Mounted bodies now use an append-only `ride` clip (230–237): bent knees, straddling feet and hands at the reins. The renderer places the solved hips on the saddle; it no longer crops away the lower 14 pixels of the character. Reins are drawn to both solved hand grips, stirrups are part of the saddle, and held items are hidden while riding to avoid overlapping the reins. Space dismount and attack-to-dismount mechanics remain. Road couriers also use the full ride pose, replacing their separate cropped-body workaround.

Verification: 18 focused client checks; 1,664 directional action frames and 3,120 outfit frames without clipping/alpha failures; built-game mounting, movement and Space dismount; three lower-door approaches and entry. [Camera/rider evidence](validation/cozy-camera-mount/report.json), [doorway evidence](validation/cozy-doorways/report.json). Production build, client typecheck and targeted lint passed. Horse art still has four directional headings and two gait frames; complete reference animal/gait replacement and richer boarding/dismount clips remain unfinished.

## Follow-up animation integration

Three append-only clips are integrated: `fish_reel` (206–213), `fish_land` (214–221) and `plant` (222–229). Reeling retains the water coordinates and rod state through the rhythm stage, ends on a matching result, and drives the line from the actual animated grip. The landing gesture waits for result dismissal; planting uses a grounded crouch with hands toward the soil. Existing frame IDs and authoritative resource/reward behavior are preserved.

Nine focused client checks passed for these changes. `e2e/reference-fishing.mjs` passed against the production browser build: retained rod/reel, landing and kneeling planting frames, zero page errors. [Presentation report](validation/reference-fishing/report.json); these are injected authoritative-event fixtures, not a new end-to-end rewarded catch. The existing real attack/charge/release browser check also passed after the body/cell changes. Full directional asset check now covers 1,600 action frames plus 3,120 outfit frames.

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

- Every one of the 50-option customization catalogs (pants 55) individually fitted, selectable and saved across all actions/directions; current customization remains the existing body/outfit system.
- House catalog background removal, faithful roof/material/design adaptation and any necessary per-building footprint/interior/furniture enlargement.
- Farmland tile cleanup, seam normalization and all crop-stage mappings; rock/ore/depletion catalog cleanup and replacement.
- Individual farm/wildlife anatomy replacement, species-specific gait libraries, remaining mounted-layer refinements and richer mount/dismount clips. Full straddling rider bodies, hip anchoring, reins and stirrups are now integrated, but the animal art/gait overhaul is not complete.
- Carrying, richer facial expressions and remaining bespoke contact/event refinements. Fishing reel/landing and planting now have distinct clips; broader natural-timing and object-contact polish remains.
- Comprehensive same-camera comparisons beside animals/on mounts, every crop/resource/save route, every settlement and performance under multiplayer load.

Do not treat the first integrated stage as completion of the entire request.
