# Flat, cozy boss source redraw

The user found the previous boss art too detailed. All **14 source sheets** are now redrawn with broad flat material shapes, a few large shadow clusters, warmer muted colors and restrained outlines. Individual scales, stone-gravel surfaces, armor etching, little chains/bones, jewel forests and scratch highlights are removed. The dragon keeps wings/horns; the serpent keeps its heavy coils; the titan keeps its hammer; the guardian keeps its shield fan; Veyr keeps the user's cyan reactor and crystal identity. Bellkeeper is a masked bell guardian with simple clothing rather than a highly textured exposed skeleton. The Unwritten King has a quiet hood/mask/tablet silhouette.

[Before](before.png) · [Current complete gallery](../current-bosses/gallery.png) · [Gameplay captures/report](gameplay/report.json)

These are complete generated source-sheet redraws, not a runtime filter or another texture-resolution change. The previous source art is preserved in Git at `b009d7b`; the user's original Veyr reference remains in `client/src/assets/bosses/veyr.png`. Provenance and source checksums are in `art-source/bosses/cozy-redraw.json`.

## Integration

- Same 8-column / 4-facing source layout, world size, logical frame ordering, pivots and shadows. Standard source columns are idle / left stride / passing / right stride / windup / release / recovery / defeated. Veyr retains its special four-walk-column layout, with windup in source column 6 and release in column 7.
- Rebuilt all 28 day/night atlases, all 14 portraits and matching embedded fallbacks. Portraits now sample the actual exported daytime palette.
- `prepare_boss_palettes.py` fits at most 16 material colors across each complete sheet and merges nearly identical colors before master-palette conversion. This fixes the import bug where tiny RGB variations in a flat grey surface became unrelated grey/tan/pink checker speckles. The actual source material palettes contain 7–13 colors per boss. Transparent export fringes are discarded by the existing coverage/component normalization.
- The export hash now covers material palettes as well as sources/exporter; each material palette also records its source checksum. Stale preparation is rejected. No quantization runs during gameplay.
- Existing smoother pursuit, attack patterns, poise interrupts, recovery, rewards, collision and saves are unchanged.

Rebuild:

```sh
python3 tools/art/prepare_boss_palettes.py
node tools/bake-boss-sheets.mjs http://127.0.0.1:5174/
node e2e/boss-sheets-art.mjs http://127.0.0.1:5174/ docs/validation/cozy-boss-redraw/sheets
npm run build:pages
node e2e/boss-gameplay.mjs http://127.0.0.1:5244/ docs/validation/cozy-boss-redraw/gameplay
python3 tools/art/audit_boss_detail.py
```

## Verification and limits

- [Atlas checks](sheets/report.json): all 28 atlases / 1,120 logical pose samples, four distinct facings, binary transparency, unclipped bounds, source hash, anchors and 2048px texture limits; each complete atlas uses at most 16 colors. Authored fallback is also checked.
- [Texture detail comparison](detail.json): all 14 have fewer interior color transitions than `b009d7b` (36.9–71.5% reduction). This is a diagnostic for quieter surfaces, not a claim about animation quality or fun. Visual gallery/playback is the primary judgment.
- Production solo build and focused boss asset test pass. All 14 are rendered and simulated in gameplay, including the ancient bosses' mobile layouts. Existing keyframe counts remain; this does not add a new dense frame-by-frame animation library or change fight balance.

Keep these broad flat surfaces. Reintroducing scratches, scale stippling, automatic noisy polish or per-pixel independent master-palette matching would undo the requested cozy direction.
