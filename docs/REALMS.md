# The three realms and their peoples

Master plan §7. Worlds of generation 6 and later have three realms. Each is a plane of its own, generated from the
seed (`shared/src/otherworlds.ts`), and each is drawn in the same isometric style as the overworld: the same terrain
shader, prop kit and creature rig. A realm portal near Hadamere leads to each one, and the portal checks your level
before it lets you through. A return portal stands at every arrival point.

| Realm                               | Portal level | Creatures | What is special                                                                                                                                                                                                                                                      |
| ----------------------------------- | -----------: | --------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aetheria**, the Celestial Expanse |            6 |   level 8 | Floating islands over a sea of cloud, joined by sky-roads and updrafts. Ring the three wind chimes and the updraft to the eyrie will carry you. Boss: the Phoenix.                                                                                                   |
| **the Umbral Abyss**                |           10 |  level 12 | Black-rock caverns, glowing fungi and the lit Hollow. Away from light the dark costs 2 HP every 2 s after a 4 s grace (never below 1 HP) and draws shade stalkers. Any equipped light, a lamp, glowing fungi or a placed torch keeps you safe. Boss: the Umbral Maw. |
| **Chronoria**, the Fractured Realm  |           14 |  level 16 | Temporal ruins on a plateau split by void fractures. Rewind rifts return you to where you stood 8 s ago. Set the three chrono dials to the hour written in the archive and the gate to the Unwound's court opens. Boss: the Unwound.                                 |

Realm resources are gathered only in their own realm: sky bloom, umbral caps and time sand (each with a 5-minute
per-player regrowth), aetherium, umbrite and chronium ore, sky amber, void pearls and temporal crystals.

## How a realm is generated

Each realm is a grid of rooms (13 × 13 cells), generated from the seed (`realmGraph` in `otherworlds.ts`):

- **Holes.** Some cells are left empty: about 24% in Aetheria, 16% in the Abyss and 14% in Chronoria. Any room that
  can no longer be reached from home is removed as well.
- **Required rooms.** Some rooms are always present and always connected: home, the boss's room and the way up to it,
  the chime isles, the lore rooms and the peoples' homes. If one is cut off, a corridor of rooms is added back toward
  home.
- **Links.** A random spanning tree joins every room, and a few extra links make loops. In Aetheria a link is either
  a sky-road or an updraft. In the Abyss it is a tunnel. In Chronoria it is a street across the plateau.
- **Themes.** Every ordinary room has a seeded theme of its realm:
  - Aetheria: meadow, grove, crystal, ruin or lake.
  - the Abyss: fungal, crystal, ember (lava seeps that light the chamber), flooded or boulders.
  - Chronoria: overgrown, clockyard, stilled or dunes.
- **Open ground where it matters.** A room's heart, its rim, its updraft spots and the road to the chrono gate stay
  clear. Solid scatter is sparse, so a room can always be crossed.

**Checks.** The shared test walks three seeds: every room must be reachable, every theme must appear, and the gate
and dials must never be cut off. A 10-seed sweep found no stranded room or object. The parts that can't be reached
are the sealed eyrie and small crack-ringed pockets of the Chronoria plateau that hold nothing.

**Fixed while building this.** In some seeds a void crack cut Chronoria's gate court off, and an updraft could set
you down on a tree.

## Peoples

Each realm has a neutral people who live there and trade, and a hostile people at war with them
(`shared/src/realmfolk.ts`).

| Realm     | Neutral people (3 NPCs, shops)                                        | Hostile people (rank and file, caster, champion) | Token they carry |
| --------- | --------------------------------------------------------------------- | ------------------------------------------------ | ---------------- |
| Aetheria  | **the Aerin**: pale sky-folk (Lysa, Quartermaster Corvane, the Elder) | **Gale Reavers**: Reaver, Gunner, Captain        | Storm Feather    |
| the Abyss | **the Hollowfolk**: lantern-keepers of the Hollow                     | **the Gloamkin**: Zealot, Hexer, Hierophant      | Gloam Sigil      |
| Chronoria | **the Archivists**: keepers of the hours                              | **the Sundered**: Blade, Seer, Warlord           | Sundered Seal    |

War-bands of the hostile people roam their realm; a champion leads about 6% of them. Realm creatures roam as well.

**Standing.** Standing with each people is stored next to kingdom reputation and uses the same tiers
(known 100, trusted 300, honoured 700). You gain it by:

- killing one of their foes (+6) or a champion (+40);
- killing a realm creature (+1);
- killing the realm's guardian boss (+80);
- selling them their enemies' tokens (+5 each).

Standing unlocks two things:

- **Recipes.** Every recipe marked `learn: realm:<people>` needs known standing. These cover the realm metal (ore,
  ingot, plate, rod), seven weapon families, the four-piece plate set, accessories, and the people's remedies and
  meals.
- **Better shop stock.** Ingots appear at known standing, the shields and charms at trusted, and the mantle and other
  top wares at honoured.

## Progression

The three peoples form a ladder:

1. **Aetherium** (tier 4, level 9). Weapons deal 11 damage, and the realm's flagship item is the Aether Wings.
2. **Umbrite** (tier 5, level 13). Weapons deal 15. Its Umbral Lantern needs aetherium plate.
3. **Chronium** (tier 6, level 16). Weapons deal 18. Its Chrono Charm needs an umbrite rod.

Champion trophies (Captain's Compass, Hierophant's Mask, Warlord's Sigil) and boss drops (Phoenix Plume, Abyss Heart,
Unwound Gear) feed the best accessories. Examples:

- the Storm Buckler and Windcaller Mantle;
- the Gloamward Charm, which needs 3 gloam sigils;
- the Paradox Aegis, which needs 3 sundered seals.

Remedies and meals:

| Item              | Effect                            |
| ----------------- | --------------------------------- |
| Skyfeather Tonic  | swift                             |
| Aerin Honeycake   | heal and regen                    |
| Gloamward Draught | ward, and cures a curse           |
| Glowcap Stew      | heal and lantern                  |
| Chrono Tea        | long swift                        |
| Rewind Elixir     | heals 120 and cures every ailment |
| Paradox Brew      | fortune                           |

## Code map

- **shared:**
  - `otherworlds.ts`: layouts, tiles, objects, puzzles and creatures;
  - `realmfolk.ts`: races, standing, spots and NPCs;
  - `catalog/realm-items.ts`: materials, trophies and remedies;
  - realm metals and gear live in `catalog/metals.ts`, `armor.ts`, `gear.ts`, `gear-items.ts` and `weapons-data.ts`.
- **server:**
  - `features/otherworlds`: portals, puzzles, darkness, rifts, roaming, the guardian and standing on kills;
  - `systems/village`: realm NPCs, standing-gated stock and token sales;
  - `systems/reputation.ts`: `gainStanding`.
- **client:**
  - `art/realms.ts`: realm props;
  - `art/foes.ts`: `otherworldBeast`;
  - `art/army-units.ts`: looks for the hostile peoples;
  - `art/actors.ts`: looks for the neutral peoples;
  - `gl/terrain.frag.ts`: the cloud sea and fracture void.
- **tests:**
  - shared `otherworlds.test.ts`;
  - server `realms.test.ts` and `realmfolk.test.ts`;
  - browser `e2e/realms.mjs` and `e2e/realmfolk.mjs`.

## Limits

- **No visual dial states.** Dial states, chime progress and gate unlocks are shown as toasts and the archive's lore
  panel. The dials and chimes themselves do not change.
- **Plain realm NPCs.** The realm NPCs use the generic resident dialogue and have shops. They have no quest chains of
  their own, and no realm quests exist yet.
- **Single-phase bosses.** The bosses use the existing boss AI (telegraphs, orbs and charges). They have no
  multi-phase scripts or custom health bars beyond the shared boss bar.
- **No flight.** Aetheria uses updrafts instead of magical flight. It has no sky dragons, and gravity puzzles are
  limited to the updraft and chime gate.
- **Layouts changed.** Realm layouts changed on 2026-10-27. A world created before then gets the new layout, and
  anything built inside a realm before that date may now stand somewhere else.
- **Realms only in new worlds.** Older worlds (generation 5 and below) have no realms.
- **No Pinterest references.** Pinterest was not reachable from this environment. Mood references were taken from
  descriptions of public pixel-art pieces (floating islands with waterfalls, glowing mushroom caves, a shattered
  hourglass). All art is original and procedural; no external images or packs were used.
- **Not measured on real devices.** Realm performance on real phones has not been measured.
