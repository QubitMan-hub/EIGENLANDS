> Revision numbering: this guide describes revision 2 (surface hydrology). The full rebuild with real elevation is revision 3 and applies only to worlds created after it shipped; see [WORLDGEN3.md](WORLDGEN3.md). Revision-2 worlds stay as described here.

# Coherent wetlands and quiet fluids

Surface generation revision 2 replaces the fen's seven-tile FBM pool mask with a broad domain-warped basin field at 38-tile scale. A high water threshold leaves more dry ground; a narrow, sparsely clustered reed belt follows the shore. Quantum shimmer cannot punch random dry tiles through the new lake interiors. Existing oceans, climate fields, settlement footprints, roads, caves, shrine IDs and legacy landmark placement keep their existing rules.

Three full-tile samples over [-160,160) show the change below. These are fen-water components on naturally inland swamp ground, not a claim about all-world connectivity or erosion.

| Seed     | Old/new pools | Old/new largest pool (tiles) | Old/new fen water tiles |
| -------- | ------------- | ---------------------------- | ----------------------- |
| 20260101 | 287 / 39      | 50 / 155                     | 1479 / 1371             |
| 1337     | 213 / 21      | 31 / 258                     | 1060 / 898              |
| 7102025  | 431 / 47      | 33 / 241                     | 2106 / 1605             |

Rare small lava basins appear only on suitable surface desert/corrupted land outside the home vale and occupied settlement wards. Their shape follows one geological site, with volcanic scree around the edge; there is no per-tile lava roll. Existing authored ground takes precedence. Lava remains a solid, luminous hazard using the existing renderer/collision system.

Water materials no longer turn shore-distance thresholds or moving noise into filled dark islands. Both graphics presets share one quiet body tone, a subtle continuous depth gradient, a thin bank shelf and a few short drifting ripples. Fen/corrupted water retains its own hue, enchanted pools keep rare cyan accents and winter shallows retain restrained ice detail. Lava uses a steady molten body with sparse short flow streaks instead of polygonal black crust plates and bright branching outlines. Lava lighting is weaker and flickers slowly. Reduced motion freezes fluid motion.

## Save compatibility

The repository stores `worldgen:<seed>` metadata in its existing durable blob store; no new SQL-only persistence path is introduced. WELCOME, chunk stores, preparation tasks, worker replies and generated-tile cache keys carry the revision. Wrong-version worker replies are rejected. Revision-1 tiles remain reproducible and legacy landmark generation stays fixed. Unsupported future metadata fails instead of silently resetting a world.

The limited revision-1→2 hydrology migration preserves saved tile edits. Old owned foundations and adjacent access receive persisted dry-ground repairs, including across chunk borders. Newly placed objects/floors carry their generation so new bridges do not accidentally landfill the lake below them. An old character caught in newly flooded ground, or a drained former pool that now contains a solid obstacle, moves to nearby walkable ground with a bounded search; character data and inventory remain intact. A per-character revision prevents repeating this relocation for current saves. Existing open-ocean positions are not treated as newly flooded land.

Back up a live database before updating; rollback means restoring a compatible pre-update backup alongside its corresponding server version. This narrow hydrology migration is **not** the full future climate/erosion/elevation migration.

## Evidence

- `node --import tsx tools/hydrology-audit.mjs docs/validation/hydrology` reproduces the three-seed reports/maps.
- `node e2e/hydrology-art.mjs [output]` compares both layouts using the same current terrain renderer and shows surface lava.
- `node e2e/fluid-materials.mjs [output] [optional-baseline-git-ref]` isolates the real water/lava shaders, measures dark coverage and motion, and checks reduced motion in both presets. Without a baseline it checks only current materials and is suitable for CI.
- Shared tests verify fragmentation, coverage, revision cache separation, seams, sparse lava, unchanged old lava rules and metadata guards. A real room/repository test verifies ownership across borders, edit precedence, saved-position repair, durable repaired diffs and revision-2 bridge floors.

Reports and screenshots: [validation/hydrology](validation/hydrology/). Top-down maps use teal for sampled fen water, olive for other fen ground, dark blue for other water and dark green for other land. Art-lab screenshots include its deliberately non-physical actor lineup; gameplay collision is validated separately.
