# Authored boss sprites

The five ancient bosses establish the new art standard: **Azhur, First Flame** has a muscular charcoal body, substantial torn rust wings, articulated claws and a heavy armored tail; **Orrun** has thick overlapping coils, a defined horned head and pale ventral scales; **the Unwritten King** is an empty, ragged funerary mantle with a fractured mask and chained tablets; **Morrowforge** has massive weathered stone-and-iron plates, recessed furnace and a grounded maul; **Asterion** has a tall ivory cathedral silhouette, six gate shields and a ceremonial spear. These are separate designs rather than recolored variants of one rig.

The same pass replaces the Slime Sovereign, Briar Warden, Decoherent Colossus, Bellkeeper, Geode Tyrant, Cinder Wyrm, Rime Sovereign, Tide Leviathan and Veyr. Veyr preserves the player's original blue runes, reactor and crystal crown; the original source file remains intact. All fourteen bosses have their own portraits matching the world sprites. The Slime Sovereign and Colossus no longer enlarge/recolor normal enemy art, and the Warden no longer enlarges a normal boar.

## Assets and animation contract

- Original authored sheets: `art-source/bosses/*.png`. These were generated specifically for this game from the original design brief and the player's Veyr sheet; outside game references informed style, not copied artwork. Source sheets are authoring inputs and are **not shipped in the browser bundle**.
- Production: `packages/client/public/art/bestiary/<boss>-day.png`, `-night.png`, matching `portraits/`, and `boss-manifest.json` mirrored in `client/src/art/`.
- Four row groups remain SE, SW, NE, NW. Source columns are idle; left stride; passing; right stride; windup; strike; recovery; defeated. Veyr retains its original idle/four walk/windup/attack/death column contract.
- Production logical order remains **idle → move → windup → attack → hurt → death**. Walking uses stride A/passing/stride B/passing, not a constant whole-body translation. Anticipation and strike/recovery remain separate poses. Hurt reuses the braced pose. Veyr's single strike pose holds through its attack interval. These are deliberately restrained keyframe animations, not interpolated meshes.
- One common scale covers every pose and facing of a boss. Normalization finds ground contact, removes detached sheet flecks, clips soft alpha, maps to the existing palette and uses nearest sampling. It does not independently resize poses to fill cells.
- Boss cells are 160–240 pixels wide and 144–208 high. The packed ten-pose layout uses five columns and two rows **per facing**; no texture exceeds 2048 pixels on either axis. Empty space does not alter the pivot. `poseRows` keeps the logical frame order independent from packing.

`bestiary-atlases.ts` decodes shipped PNGs and caches frame textures. It avoids runtime boss-model rasterization, uses a 24-atlas/12-megapixel soft cache budget, retains recently visible kinds and unloads older textures. If a boss atlas fails to download, an embedded matching thumbnail preserves its size/ground anchor instead of leaving an invisible enemy. Debug state reports loaded/pending/failed atlases and decoded pixels. Night assets use the same coverage and anchors as day assets.

`foes.ts` maps each boss kind to its own art. `combatview.ts` retains four real facings, removes the old ordinary-enemy aliases/tints/giant scaling, slows the heavy walk cadence, holds strike/recovery poses, and disables elastic hit squash on bosses. Grounded corpse poses use the same anchor. Contact shadows use the boss footprint; the moving-sun silhouette shadow copies the live sprite's pivot, position and scale.

## Rebuild and verification

```sh
node tools/bake-boss-sheets.mjs http://127.0.0.1:5174/
node --import tsx e2e/bestiary-art.mjs http://127.0.0.1:5174/ /tmp/bestiary --bake
node e2e/boss-sheets-art.mjs http://127.0.0.1:5174/ /tmp/boss-sheets
node --import tsx e2e/bestiary-art.mjs http://127.0.0.1:5174/ /tmp/bestiary
npm run build:pages
node --import tsx e2e/boss-gameplay.mjs http://127.0.0.1:5240/ /tmp/boss-gameplay
```

The source hash rejects stale exports. Static checks inspect every logical pose in all four facings, day/night bounds, hard transparency, distinct facings, nonempty coverage and the texture budget. Gameplay checks use real synchronized enemies and AI, including the five ancient designs on desktop and a 390px mobile viewport. They verify actual shipped image loads, fixed proportions, foot anchors, shadow registration, animation states and mobile header separation. A blocked-download check verifies the authored fallback. Physical-device thermal/GPU measurements and extended multiplayer balance play remain separate from browser correctness checks.
