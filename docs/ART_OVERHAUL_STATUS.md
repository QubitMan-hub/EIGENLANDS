# Reference-pack overhaul status — 2026-11-07

User specification: [complete request](design/art-overhaul-request.md). This supersedes earlier scale guidance that reduced characters to fit doors. Preserve identities and gameplay, use the supplied art designs, keep the elevated 2:1 camera, and fit world architecture to people.

## Asset availability — blocked

The requested `complete-isometric-game-art-pack.zip` could not be transferred: the attachment download tool reports that it exceeds its 32 MiB executor transfer limit. It is not present in the workspace. The request text was downloaded and preserved. The pack notes and assets have **not** been read, sliced, cleaned or integrated. Obtain category archives or split parts below 32 MiB each before making reference-specific production art; do not substitute invented designs and claim the pack is integrated.

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

Only the request preservation, implementation survey and first measured scale baseline are complete. The requested visual overhaul remains unfinished.
