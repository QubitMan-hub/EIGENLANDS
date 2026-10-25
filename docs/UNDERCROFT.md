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
