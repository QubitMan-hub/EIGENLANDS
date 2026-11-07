# Flora and fauna expansion

Added **42 wild plant species** and **31 small wildlife species** to the existing scenery and ambient layers. Larger wildlife, farming, combat, inventory and saved terrain retain their existing systems. Existing worlds receive the added visual biodiversity without a terrain migration.

## Native sprite previews

These previews show the actual procedural pixel painters at 3× nearest-neighbour scale. They are sprite sheets for review, not browser gameplay screenshots.

- [All 42 plants](flora-preview.png)
- [All 31 small creatures](fauna-preview.png)

| Habitat              | Examples of added plants                                                               | Examples of added wildlife                                                              |
| -------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Meadows and woodland | Daisies, poppies, bluebells, foxgloves, lavender, brambles, bilberries, bracken, fungi | Squirrels, chipmunks, hedgehogs, hares, stoats, voles, robins, woodpeckers, bees, moths |
| Banks and wetlands   | Mint, horsetail, cattails, water iris, marsh marigolds, lotus                          | Kingfishers, herons, ducks, geese, frogs, terrapins, newts, dragonflies                 |
| Cold country         | Heather, reindeer moss, dwarf willow, lichen                                           | Winter-active hares, stoats, voles and birds                                            |
| Desert and shores    | Barrel cactus, prickly pear, aloe, sage, rain lilies                                   | Lizards, nocturnal geckos, desert hares, crabs, sandpipers                              |
| Caves                | Cave lichen, coral, crystal moss, spore fans, ember orchids                            | Glowmoths, crystal beetles, blind cave newts                                            |
| Other realms         | Sky lilies, cloud cotton, spore fans, clockvine                                        | Sky swallows, lantern moths, clockwork wrens                                            |

## World behavior and budgets

Plants form seed-stable 24-tile habitat patches, with three sprite variants each. Seasonal art changes blooms, seed heads, foliage and winter dormancy. Tall flowers, reeds and herbs use the existing wind animation. Selection considers local shade, water, biome, cave geology or realm plane. Placement retains the existing sparse scenery grid and avoids edited ground, structures, solid props, roads and settlement footprints.

Small wildlife follows species-specific daylight, weather, season and habitat requirements. Temperate insects shelter in rough weather, hedgehogs and other sensitive species disappear in winter, frogs remain active in rain, and cave/realm species remain separate from surface species. Animals pause, move around nearby obstacles, stay near their home patch, and react to nearby players. Unsuitable wildlife fades away when conditions change; distant actors and seasonal textures are released. Reduced motion suppresses wing animation and bouncing.

Discovery checks at most 24 candidates every 500 ms in a 7×7-cell neighbourhood. There are at most **28 additional wildlife actors**, and native textures are created lazily, with at most four 40×40 frames per species for the current season. These additions introduce no network entities, collision, terrain edits or new persistent creature/item IDs.

## Verification

Tests cover actual selection of every catalog species, habitat restrictions, seasonal and weather activity, deterministic vegetation patches, sprite diversity, crisp alpha, bounded sprites, animation and winter changes. Runtime tests use real chunk stores for reproducible populations, obstacle-safe positions, weather/season transitions, player-edit exclusion and cleanup after leaving an area. Existing scenery and ambient navigation checks also pass.

TypeScript, lint, the solo production build and all **385 shared tests** pass. The client suite reports 201 passing tests and the three previously reported failures in unchanged `creature-pixels.test.ts`; the additional weather-transition regression also passes in the focused run. Existing server bestiary ecology tests pass; the server bestiary mechanics integration cannot start its listener (`listen EPERM 0.0.0.0`). Browser validation retains the previously diagnosed sandbox socket restriction; no browser frame-rate result is claimed.
