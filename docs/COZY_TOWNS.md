# Cozy settlements and latest-main review

This batch integrates main through `4d0c9ac`: adaptive graphics/performance mode and prop footprints, the UI legibility pass, waystones/gates/ferries/Recall/roads, caravans, bridges, ferry voyages, underground waystones and named/fed travel mounts. It also retains the living guilds, resident charters and ranch systems from the ongoing branch. Original horse/Glimmerhart sprites take priority where the two mount renderers overlapped; the distinct earned Moonlit Stag remains.

## Integration fixes

- One packed/schema mount field and one mount renderer. Horse = 1 (1.6×), Moonlit Stag = 2 (1.85×), fed horse/Stag = 3/4 (1.76×/2.03×), trained Glimmerhart = 5 (1.45×). Travel care recognizes only its own four modes so it cannot convert a ranch Glimmerhart to a horse. Kept roads retain their travel bonus. Ranch authority checks its own riders and no longer clears whistle/bell riders. Save data stays additive: herd training and `prog.ways/home/mounts` coexist.
- The travel renderer's seated rider crop now works with our original horse/Glimmerhart art and correctly aligned held items/shadows. Space's hint and action both dismount. Basic attacks, dodge and skills step down before acting; actual Circuit spell/ultimate RPCs now enforce that rule too.
- Existing adaptive Auto/Performance resolution, terrain freezing, pathfinding heap and large-prop collision are preserved. No new engine or dependency.
- The built-browser contrast audit found recipe counters on parchment and small Circuit medals still below its threshold. Opaque ink backings fix these while retaining the original sprites and element-colored rims. `e2e/ui-contrast.mjs --assert` now fails on contrast or horizontal overflow regressions.

## Intentional furnishing

`shared/src/cozy-town.ts` runs once on the generated town data before caching. Home towns, ports, cave towns and every kingdom/frontier generator use the same deterministic rules. It changes generated furniture, not player-owned objects, building footprints, floors, doors, stairs or saved world revisions.

Chairs face an adjacent table, desk, counter or real reading surface. Orphan chairs move to an available nearby table in the same building; otherwise they are removed. Seats in entrance lanes are removed. Park benches settle beside existing greenery/amenities and road edges. Decorative portable clutter cannot occupy the front-door corridor, and new positions avoid NPC schedule spots and large-prop footprints.

Street lamps move at most four tiles to useful road edges, stay outside houses and entrance lanes, and maintain eight tiles of spacing. Candidates are deterministic; a lamp with no suitable place is removed rather than forced into a garden or street center. For seed 20260101 this retains 8–13 lamps in each capital, alongside house lighting, with clear approaches. A separate check found no generated guild board/desk overlap with NPC schedule spots in that world.

## Original roof refinement

Roof planes remain on the original 2:1 grid, with existing worker generation, cached textures and cutaways. Residential pitches are calmer; regional palettes use related alternatives rather than unrelated colors. Clay/slate/shingle courses have broader tiles, softer seams and restrained ridge/eave highlights. Straw uses continuous bound bundles instead of random maze-like tone patches. Cultural domes, towers, keeps, underground vaults and sea shells keep their distinct geometry.

Small fixed porch lanterns use the existing wall-plane/night-glass and building-light system on surface buildings. They add warm entry cues without placing another solid street prop. No extra scattering of grass decoration or permanent HUD panel.

## Validation

- Full shared/client/database-free server tests, lint, formatting, workspace types, normal build and solo build. The focused tests cover deterministic/idempotent dressing, actual chair targets, lamp spacing and doorway clearance across settlement families; travel/ranch ownership, save and spell dismount cases run together.
- `e2e/cozy-towns.mjs`: 20 original building views across materials/cultures, day/night versions, and actual settlement scenes including mobile. This joins the existing source art job in CI.
- Live built-browser `e2e/travel.mjs` and `e2e/living-guilds.mjs`: real discovery, paid travel, riding, horse care/training, dismount, physical clues/choices and saved progress. Both run in browser CI.
- `e2e/ui-contrast.mjs --assert`: title/HUD, windows, journal pages, statue, NPC dialogue and shops. Desktop Performance mode is smoke-tested separately; reports and representative screenshots live in `docs/validation/cozy-towns/`.

Software Chromium still shows capital-entry frame spikes (the recorded Performance-mode sample had six long tasks during entry). This is not a low-end phone or real network benchmark, and the batch does not claim lag-free play. Full replacement guild-building prefabs, authored world-changing campaigns, deeper resident government and other broad master-plan items remain documented in `HOMESTEADS_AND_GUILD.md` and the master plan. Render setup remains the user's separate work.
