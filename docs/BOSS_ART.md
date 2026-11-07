# Cozy boss sprites

All 14 bosses use the **flat cozy source redraw**. Read [current validation and rebuild guide](validation/cozy-boss-redraw/README.md) and view the [complete gallery](validation/current-bosses/gallery.png). Broad material shapes, few large shade clusters, muted colors and readable silhouettes are the current standard. Avoid individual scales, fur hairs, armor etching, chipped surfaces, bone/chain clutter, sparkling facets and texture stippling.

The five ancient silhouettes remain distinct: Azhur has substantial russet wings and pale horns; Orrun has heavy teal coils and a cream belly; the Unwritten King has a plum hood, ivory mask and floating seal tablets; Morrowforge has broad stone plates, moss patches and a heavy hammer; Asterion has ivory armor, a teal cape, spear and a fan of gate shields. Veyr preserves the user's cyan reactor, blue crystals and orange attack core. The other bosses keep their own bell, jelly crown, tusks, crystal claws, flippers or ice crown/blade identities.

## Asset contract

- Sources: `art-source/bosses/*.png`; provenance in `cozy-redraw.json`. Previous detailed sources are recoverable at Git commit `b009d7b`. The original user Veyr reference remains under `client/src/assets/bosses/veyr.png`. Source masters do not ship in the browser bundle.
- Each sheet has 8 columns and 4 facing rows: SE, SW, NE, NW. Standard columns are idle, left stride, passing, right stride, windup, release, recovery, defeated. Veyr retains four walk columns, then windup, release and defeated.
- Runtime order stays **idle → move → windup → attack → hurt → death**. Movement is stride/passing/stride/passing, with separate anticipation and release/recovery poses. Hurt reuses the braced pose; Veyr holds its release pose. Source sheet changes do not imply a new interpolation/animation system.
- One common scale per boss and fixed ground anchors. Cells remain 160–240 px wide / 144–208 high, packed five columns / two rows per facing. Atlas dimensions stay within 2048px. World size and collision are unchanged.
- `tools/art/prepare_boss_palettes.py` prepares one small material palette for all poses/facings, merging near-identical colors before mapping to the game palette. `tools/bake-boss-sheets.mjs` validates that preparation, strips export coverage, aligns contacts, applies the two-pixel art grid and produces the day/night atlases, portraits, fallbacks and manifest. This avoids random material-color speckles without runtime filtering.
- Production files: `client/public/art/bestiary/<boss>-day.png`, `-night.png`, `portraits/`, and mirrored manifest in `client/src/art/boss-manifest.json`.

`bestiary-atlases.ts` loads the shipped PNGs, caches frame textures under the existing soft budgets and retains matching embedded thumbnails for failed downloads. `foes.ts` maps every boss to its own atlas. `combatview.ts` uses real authored facings, distance-based walking, committed cast poses, restrained flashes and no elastic boss squash or windup vibration. The silhouette shadow copies the live pivot, pose and scale. The [previous combat follow-up](validation/cozy-bosses/README.md) documents smooth pursuit, alternating patterns and interrupted casts; those mechanics remain in place.

Verification and reproducible commands are in the current validation guide. Shader/lighting, creature stats, loot, progression and saves were not modified by the source redraw. Extended cooperative balance and physical-device performance remain separate work.
