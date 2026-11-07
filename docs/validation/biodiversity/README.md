# Integrated flora and wildlife

The connected-world branch is integrated with main's reference bodies, wardrobe, camera, mounted poses, rocks and ground shadows. Its 42 plants and 31 small wildlife species remain cosmetic, noncolliding and independent of hostile/tameable animal populations.

## Isometric art

- [42 plants, three variants each](flora-preview.png): stems, leaves, petals, pads, fungi and cactus volumes now use the existing isometric drawing kit and master palette. Ground bases and leaf surfaces follow the world's 2:1 projection. Seasonal dormancy and habitat identities are preserved.
- [31 animals, four headings each](fauna-preview.png): native-resolution anatomical rigs share the farm-animal renderer, fixed world-space lighting and depth tests. They turn in world space without horizontal flips. Winter coats, stride pairs, wingbeats, feet, tails, ears and species markings are retained. Beetles keep closed wing cases.
- Wildlife cells remain 40×40 with contact pivot (20,32), adjusted to leave room for long tails and feet in all headings. Plant cells retain (20,34). Render scale stays 1; nearest filtering and binary alpha remain intact. Review sheets use 2× nearest scaling.

## Streaming and performance

Wildlife discovery checks at most 24 candidates every 500 ms, with a ceiling of 28 actors. Habitat sampling and routes stay within loaded chunks, avoiding synchronous neighbouring-chunk generation. A maximum of two uncached animal frames is rasterized per game frame; existing poses remain until their next frame is prepared. Directional textures are cached lazily (up to 16 per species/season) and released when their species is no longer present. Seasonal transitions release the previous season's cache.

Plants keep the existing sparse scenery grid and avoid player edits, structures, paths and settlement footprints. Species eligibility still follows biome/plane, water, shade, flowers, weather, season and time. No new network entities or terrain migration are introduced by this visual layer.

## Verification

Focused art tests check 504 seasonal plant variants and 992 animal direction/action/season combinations for edge clipping, plus readable coverage, crisp alpha, distinct headings and motion. Integration tests check loaded-edge sampling, bounded populations, obstacle routes, weather/season retirement, edits and cleanup. Whole optional town scenes retire together under settlement budgets, preserving the interactive notice board.

Browser evidence and limitations are in [connected-world validation](../connected-world/README.md). The production solo build and workspace typecheck pass. This is not a frame-rate guarantee for untested phones or multiplayer load.
