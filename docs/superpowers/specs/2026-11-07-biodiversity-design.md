# Wildlife and flora expansion

Continue the approved connected-world approach without changing the isometric pixel art, existing saved terrain, item IDs, creature kind IDs or combat balance. Work directly without subagents.

Add at least 40 recognizable wild plants and 30 small wildlife species through the existing cosmetic scenery/ambient layers. Shared habitat definitions govern selection across surface biomes, cave geology and other realms. Plants form coherent patches and have seasonal bloom/dormancy. Wildlife follows habitat, daylight, weather and seasonal availability, with species-specific locomotion, pauses and reactions to nearby players.

Use native-resolution procedural pixel painters with distinct silhouettes and bounded, lazy texture caches. Preserve roads, doors, farms, edited ground and occupied tiles. Limit nearby wildlife to 28 actors and update discovery on a staggered cadence; no terrain mutation or extra network entities.

Verify species diversity across seeds/habitats, weather and season eligibility, collision-safe movement and habitat boundaries, deterministic placement, bounded discovery/caches, seasonal raster differences and sprite coverage. Run typecheck, lint, production build and relevant tests. Retain the previously reported unrelated art-test and sandbox browser limitations if still present.
