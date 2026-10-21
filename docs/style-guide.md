# EIGENLANDS art style guide (Phase 1)

- **Grid:** 16x16 tiles, integer scaling only (client chooses 1x-6x; phones ~13 tiles across).
- **Palette:** fixed 48 colours in `packages/shared/src/palette.ts` (6 rows of 8: neutrals, greens, earth, water, warm, quantum). Art code may only reference palette indices (`C.g4`, ...). Lighting is a runtime multiply/additive overlay, not extra art colours.
- **Biome accent:** Phase Meadows = mint `q7` (#5af0d0) on glowing bloom tiles. Each new biome picks one accent from the quantum row.
- **Quantum visual language:** shifting hue = phase, shimmering double = superposition, glowing thread = entanglement.
- **Characters:** 16x16, 4 directions x 8 walk frames (frame 0 = idle), 1px dark-ink outline implied by darker palette tones; outfits swap shirt/hair/skin palette indices. Bosses 32x32+.
- **Telegraphs:** red (`r3`/`r4`) ground circle that fills over the windup; always paired with a sound cue.
- **Sprite pipeline:** all sprites are generated procedurally at startup (`packages/client/src/art/`): `draw.ts` helpers, `tiles.ts` atlas (4 variants x 2 frames per tile), `actors.ts` sheets. Replace any function with PNG atlases later without touching game code (the `Sheets`/`TileAtlas` interfaces are the seam).
- **Animation:** water/torches/blooms use 2 frames at 2 Hz; "reduce motion" freezes them.
