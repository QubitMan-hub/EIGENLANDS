# Exploring the Undercroft

The cave overhaul keeps the existing world seed, original `cv` entrance IDs, mining rules, stored tile edits, inventory, quests and multiplayer authority. It replaces the old narrow noise contours with a deterministic network of 72-tile survey districts. Four shared gates join each district to its neighbors. Dry route cores are five tiles wide; surrounding tunnels are roughly nine tiles wide, and main cavern rooms span roughly 38–52 by 34–48 tiles. Rock remains mineable, including the walls around hidden chambers.

## Finding your way

Normal cave mouths and secondary survey shafts have matching ladders underground and remain two-way. Additional supply lifts occur at alternate junctions on a 144-tile grid; occupied towns also have lifts. These are emergency returns to daylight, not reversible fast travel: a supply lift exits at a nearby surface mouth, while town lifts return to Hadamere. Approach a ladder/lift and use your Interaction binding (Space by default).

Open the Atlas (M by default) underground to **Track nearest exit** or **Track entry chamber**. Guidance uses the existing small direction/distance label. It does not reveal unexplored terrain. Entry markers use authoritative positions so interpolation during a region handoff cannot move them. Survey signs explain the roads, and marked dry routes/wooden lake crossings remain usable without a boat.

## Habitats and discoveries

- Amber Galleries: warm stone and charging Blindstone Rams.
- Lanternroot Grotto: glowcaps, Spore Sages and Matriarch-guarded groves.
- Prism Vaults: quantum seams, armored Prism Scarabs and vault archives.
- Cinder Hollows: dark basalt, rams and scarabs.
- Rime Cathedral: pale mineral floors and leaping Rime Skitters.
- Stillwater Deeps: underground pools and ranged Stillwater Lurkers.

Echo Bats wait for an approach before diving; all habitats retain level and density budgets. Six new ambient kinds have original directional art and reuse the existing readable attack, recovery, armor and projectile mechanics. Two stronger guardian kinds protect ruins/groves and abandoned towns. Ambient monsters never spawn inside occupied settlement wards.

District discoveries include lakes with guaranteed dry crossings, mineable sealed cache rooms, ruined survey archives, glowcap groves, steam vents, five existing shrine challenge types and resonant arenas. Shrines use the same authoritative puzzle/reward/completion persistence as surface shrines. Cache rewards are once per character, check inventory space before claiming, and include useful ore, medicine and rare crystals. Steam vents give a 1.5-second ground warning, then deal nonlethal chip damage; Dodge invulnerability avoids a burst. Guardian sites have a ten-minute live-room cooldown rather than a constant spawn stream.

## People beneath the stone

Hollowhearth's Lamplighters keep a flame for missing travellers. Prismdelve's Resonant Guild records history in crystal. These two furnished settlements add 16 residents with daily schedules, friendship, six provision shops and 16 story quests. Their wards protect streets and homes. Workers use shops and workshops rather than standing in one line.

Bellfall and Stillwater Refuge are abandoned, furnished ruins with failed wards, survey records, treasure and guardian encounters. Their history connects to the bell sealed below. Reading an archive advances the archivists' quests; exploration rewards remain independent for each traveller.

## The Hollow Bellkeeper

At level 12, craft a **Deep Sigil** at a workbench from four iron ingots, two Qubit Crystals and eight coal. Locate a resonant cave arena and interact with its altar while carrying the sigil. A failed summon does not consume it. The Bellkeeper has three phases, guardian-like charges/slams, fixed ground warnings for delayed echo tolls and limited reinforcements. Defeating it uses the normal boss reward/progression system and grants a Heart Crystal, Qubit Crystals and gold.

## Scope and follow-up

This release adds six ambient enemies, two guardian kinds and **one** new phased boss, not an unlimited boss catalog. Depth bands are distance-based progression on the existing cave plane, not stacked geological floors. Supply lifts are one-way returns. Guardian respawn cooldowns are live-room state; shrine/cache/boss character completion and mined edits persist. The northern boundary of the existing coordinate plane remains; unlimited vertical cave layers need a separate coordinate/save migration. More bespoke cave town interiors, quest stories and additional boss mechanics remain opportunities. Physical phone GPU/thermal testing is still required; browser landscape checks do not establish performance on every device.

## Verification

`packages/shared/test/undercroft-network.test.ts` checks old mouth coordinates, inter-district connectivity, room sizes, exits/landing safety, occupied/abandoned wards, homes/quests, shrine placement, spawn progression and saved edits. `packages/server/test/undercroft.test.ts` exercises actual lift/treasure authority, cave shrine objects, arena summoning/phases/rewards, and vent timing/invulnerability. The existing safety tests now distinguish occupied towns from abandoned ones.

`node e2e/undercroft-art.mjs` reviews native architecture and 72 creature poses, including a distinct-image check for all nine models. `node --import tsx e2e/undercroft.mjs <base-url> <output-dir>` exercises production gameplay in solo or multiplayer and captures entrances, six habitats, settlements, a challenge, the boss and mobile navigation. Runtime logs and screenshots are written under `/tmp/cave-*` during development, not shipped as assets.

## Material and architecture pass

Cinder chambers now contain impassable luminous magma pools, with dry survey paths preserved. Native water and magma cascades, clustered luminous mushrooms and warm/cool local lights provide focal points. Magma lights use a sparse four-tile grid rather than a light per hot pixel. Pools/cascades and fungi freeze their cosmetic animation under reduced motion.

Resonant arenas have engraved flagstones, a broad brass-inlaid ritual seal, four hanging-bell pylons and a water or volcanic moat crossed by wide survey bridges. The seal sits behind actors and adds no invisible collision. The Bellkeeper is larger, with hollow iron armor, an inset skull, hooked claws, hanging chains and a flared bell body. Its collision radius follows the larger footprint; health/rewards and readable encounter phases remain intact. Its cached sheet uses a compact 96×96 frame and fewer redundant looping frames.

Cave settlement buildings have low ribbed stone barrel vaults, round windows, no surface chimneys/dormers, and stone workshop/shop floors; inns retain warm timber floors. Surface houses keep their established gables and materials. Submerged sanctuary chambers use teal masonry, engraved floors and shell-like arches. The building painter also supports shell-vault architecture for buildings on the submerged plane; this does not introduce a new underwater housing settlement or change player-selected construction materials.

Wooden storage chests, metal-bound vault caches and salvaged sea chests use four physically hinged lid poses in both wall orientations. A successful authoritative storage/cache interaction tells nearby clients to open the chest, hold briefly and close. Failed or repeated cache claims do not grant loot or replay a success animation. Reduced motion snaps between the open and closed poses. The animation is transient; inventories, ownership and once-per-character treasure records remain in the existing persistence systems.

Reference images supplied for this pass informed material layering, focal lighting and mechanical detail only. All new art is original procedural geometry; no reference artwork is copied. Review scripts: `e2e/cave-materials-art.mjs` and `node --import tsx e2e/cave-materials.mjs <base-url> <output-dir>`.

## Ground texture repair

The previous floor painter thresholded low-frequency smooth noise into entire dark/light regions. That produced the oval islands shown in player reports; dirt paths used the same rule, Economy grass drew ellipses, and thresholded cloud shadows were incorrectly visible underground.

Floors and paths now use world-anchored angular chips, short branching cracks and small grit clusters. Broad variation changes brightness continuously by at most about two percent instead of filling a contour with another palette color. Cave wall crowns/faces use the same bounded micro-detail rules with short bedding seams. Loose ground materials feather only near their actual boundaries; habitat colors blend only between adjacent tiles of the same material. Height, collision, shores, paved roads and deliberate architecture remain authoritative. Clouds affect open sky only and use a gentle continuous ramp.

The repair also removes oval Economy grass clumps, broad meadow/sand/snow color islands and painted water-reflection patches. Volcanic fissures use piecewise-linear facets, while true water-depth bands and shoreline foam stay tied to real water. No larger texture atlas or extra rendering pass is added.

`node --import tsx e2e/terrain-materials.mjs` renders the real shader through the existing art lab, compares to the last merged terrain rules, measures connected high-contrast regions in isolated basalt/dirt/rock samples, and verifies camera anchoring in both quality modes. It creates and removes a temporary comparison module. In the recorded basalt sample, the largest strong-contrast region changed from 4,825 pixels to five in Economy; this measures texture structure, not a universal frame-rate improvement. Screenshots/logs: `/tmp/terrain-materials*`.

## Undercroft 2 (world revision 4)

New worlds are created at revision 4 (`WORLD_GENERATION = 4`); revision 1–3 worlds keep their exact caves, ores and mine loops (rev 4 only changes the cave plane, towns/surface are identical to revision 3). `caveTileAt2` (`shared/src/caves2.ts`) is a pure function of (seed, x, y) that keeps the district skeleton (centre chamber + four shared gates) as its connectivity guarantee but draws it through a smooth noise warp:

- **Organic passages.** Routes meander, widen and pinch (radius 2.5–4.5 tiles, never below five wide), with cavern blobs hung off them and a noisy centre chamber. Pillars (stalagmites) are local priority minima, so two never touch, and nothing solid is placed within three tiles of a ladder, lift, connector, rail line or vault doorway. `shared/test/caves2.test.ts` flood-fills four seeds and fails if any district centre, lift, ladder landing, rail tile, camp stall, boss arena or vault apron is cut off.
- **Continuous biomes.** `caveBiomeField` is a warped Voronoi of ~56-tile patches that cross district borders (limestone under the home vale). The shader tints rock tops and faces per biome (amber, moss, violet, soot, rime, teal) in addition to the existing floor tint.
- **Minerals are geology.** Ore is ribbons along noise contours inside the rock (coal, copper, iron, silver, gold, qubit crystal, geodes by biome and depth) and only appears where a passage cuts a ribbon, so no tile floats in the middle of nothing. Each ore is a rock block with nuggets, fissure threads and glints embedded across top and side faces (`client/src/art/caveores.ts`, art lab `?lab=caveores`). Mined tiles leave open floor.
- **Even spread.** District features are dealt out per 3×3 block (one each of lake, delver camp, sealed vault, echo vault, steam vents, boss arena, grove, plus a second camp and lake), so nothing clumps and no boss arena stands within two districts of the start. Ladders come from the existing 72-tile mouth grid (about one per district) plus lifts at alternate junctions.
- **Elevation.** `caveLevels` raises smooth terraces (levels 0–2) between sites; every authored site (centre chambers, camps, arenas, vaults, towns, lifts, landings, mine lines) is flattened and adjacent tiles never differ by a cliff (tested). The terrain shader's cave ray now starts at wall height plus the tallest raised block in the window.
- **Haulage lines instead of loops.** A district with a delver camp, grove or vents may have a mine: rails run from a loading bay (timber buffer, parked cart, waymark) down a lamplit drift the generator cuts for them, with a corner, to a face chamber ringed with the richest ore. `MineLine` replaces the old square loop; the rider **steers** (`mineStep`): pushing along the rails rolls forward, against them reverses, buffers stop the cart. A line always lies inside one shard so a rider never leaves the room. New rail art: gravel bed, sleepers, steel rails, chamfered curves, red-bumper buffers.
- **Delver camps and travelling merchants.** Camp districts hold a fire, two tents, a merchant's cart, lamps, a supply stash and a sign. Four merchants (Odo Peddlewick ore, Marla Quillon apothecary, Tobin Gleamfoot lamps, Sable Rook gems; `DELVER_MERCHANTS`) walk a round of three camps inside one shard on a daily schedule (stall hours 06–22) with real shops and voices. They exist only in revision 4 worlds and are not part of `NPCS`.
- **Vault shrines with challenges.** `secret` districts hold a **sealed vault**: walled hall, doorway choked with boulders (mine through), and a chest that wakes the biome's guardians (one hardened elite) when opened. `puzzle` districts hold an **echo vault**: three engraved plates each wake one ambush (support kinds, then signature + support, then two signature monsters); the chest unlocks when all are cleared. Themed loot per biome (once per character), a 5% heart crystal.
- **Unique monsters.** Each cave biome has a signature species (Amber Gnawer, Lantern Hound, Geode Golem, Cinder Drake, Rime Wraith, Stillwater Eel) with new original models, spawn tables by biome and level, and vault duty.
- **More bosses.** The Deep Sigil on an arena altar summons the boss of that arena's biome: Hollow Bellkeeper (amber/moss), **Geode Tyrant** (crystal, L14), **Cinder Wyrm** (basalt, L16), **Rime Sovereign** (frost, L18), **Stillwater Leviathan** (drowned, L20). Each has phases, adds, telegraphed strike patterns (shard ring, lava sweep, glacial rings, tidal cross), a boss frame and normal boss rewards.

Not done in this pass: more full cave towns (the four hand-authored settlements are unchanged; delver camps are the new "villages"), unlimited vertical layers, boss-specific loot items, and physical-device performance checks.
