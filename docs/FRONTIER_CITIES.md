# Castles and frontier provinces — revision 6

This batch extends the existing TypeScript/PixiJS 2:1 renderer and deterministic town generator. Reference images informed the original geometry; no reference artwork was imported.

## Delivered

- Six cultural castle families retain their own masonry/roof ramps, with round bastions, arrow loops, cone or crenellated crowns, coherent stone terraces and full-height tower foundations. Existing house shapes, fairs, markets and furnishing stay integrated.
- Revision-6 settlements add projected cultural curtain walls, furnished tower watchrooms and palace thrones. Doors and street collision remain authoritative.
- Sparse frontier towns/villages continue beyond the fixed kingdoms. A seeded 1,536-tile regional grid chooses at most one settlement per region (72% candidate probability, with exclusions). Broad warped province islands provide surrounding wilderness and coastlines; the streets flatten into a gentle elevation apron.
- Local generation queries stream building art, static furniture, collision, sanctuary protection, construction exclusion, ambient residents, location labels and discovered atlas locations. They never enumerate an infinite global city list.
- Dialogue uses readable parchment/ink styling on the actual `.dlg-box`; the UI lab imports the shipping theme.
- Collision clipping cannot reverse the requested axis. Shard handoffs discard inputs abandoned by the old authority and wait for the new ACK. Chunk eviction clears cached elevation pointers. Scenery rendering waits for the background preparer instead of forcing the same cold chunk synchronously.

## Quiet ground materials

Grass now leaves broad resting planes between sparse, low-contrast planting drifts. Removed overlapping clover/stone stamps, reduced flower/leaf frequency and quantum glints, and removed a fallback glitter branch that also affected non-snow biomes. Economy grass follows the same quiet direction. Corrupted ground uses sparse short pixel marks instead of continuous curved cracks; sand and snow no longer carry sinusoidal contour stripes. Harvestable plants/resources and biome identity remain intact. Day/night screenshots cover meadow, woodland, enchanted ground and wastes.

## Compatibility and implementation

Fresh worlds default to revision 6. Existing metadata for revisions 1–5 stays pinned; no layout reset or implicit city migration. Castle painter improvements also apply to existing building art, but new layout objects and frontier generation require revision 6.

Read `shared/src/frontier.ts`, `realm-towns.ts`, `town.ts`, `worldgen.ts`, `chunks.ts`, and `client/src/game/buildingviews.ts`. Region candidates avoid home/named kingdoms and cave, diving and upper-floor coordinate planes. Layouts reuse `buildRealmTown`; coast and elevation extend existing generation. Bounded caches hold 512 site candidates, 16 frontier layouts and eight noise fields. Building views retire frontier sprites/textures and ignore late worker replies after leaving an area. Static objects use the normal chunk system and atlas discovery uses its existing bounded landmark archive.

## Validation and limits

`shared/test/frontier.test.ts` checks deterministic distant sites, all six cultural affiliations, saved revision boundaries, furniture, unique object cells, clear entrances, level streets, static chunk objects, sanctuary names and eviction of cached levels. Collision-direction tests reproduce the reverse displacement on cliffs/overlapping solids. Client tests cover new-session input reset and worker readiness/fallback. The server frontier integration test loads actual static furniture/door collision and applies the damage ward.

`e2e/castle-frontier-art.mjs` visits all six capitals and three frontier settlements, verifies bounded active building counts, captures a furnished interior and checks desktop/mobile dialogue contrast (12.1:1). Screenshots/report are in [validation/frontier-cities](validation/frontier-cities/). The existing solo/elevation checks cover actual browser movement, sprint, save/reload, tab takeover and authoritative cliffs; CI also runs PostgreSQL multiplayer and production deployment checks.

Frontier people are ambient visual residents. This batch does not create new interactive merchant/quest rosters, frontier faction armies, intercity trade or road networks. It does not add playable castle battlement floors or stairs. Fixed kingdom shops/quests remain intact. Existing broad world-generation, art and progression work remains on the master checklist. Low-end physical phones and cross-network latency still require hardware testing; browser automation is not evidence of a universal FPS multiplier.
