# Progression on the map: early, mid and late game

The world's danger is set by **place**, not by the traveller (`shared/src/danger.ts`). Wild creatures used to spawn at the player's own level, so nowhere was gentler or harsher than anywhere else and there was no sense of an early or a late game. Now the land itself holds the difficulty. Nothing is gated: anyone may walk anywhere from the first minute, and the land tells them what it holds.

| Region            | Distance from the crossroads | Creature level | Feels like                                      |
| ----------------- | ---------------------------- | -------------- | ----------------------------------------------- |
| The Hearthlands   | under 260 tiles              | 1–3            | Start: home town, first tools, first fights     |
| The Borderwilds   | 260–900                      | 3–6            | Early-mid: the first real threats               |
| The Kingdom Wilds | 900–2,000                    | 6–9            | Mid: the six kingdoms and their mythical beasts |
| The Frontier      | 2,000–4,000                  | 9–12           | Late: the frontier provinces                    |
| The Far Reaches   | beyond 4,000                 | 12–15          | End game: deadly even at the level cap (9)      |

Level rises smoothly across each region, so there are no cliffs at the borders. Several things add to it:

- **Caves** run a step harder than the land above them: +2 levels and one tier.
- **The realms beyond the gates** count as the Far Reaches.
- **Night** adds +1 level, and so does **corrupted land**.

Further out, the land also presses harder (`dangerPressure`). Each tier increases:

- the spawn budget and pack room around you;
- how often encounters come (up to about 1.7× in the Far Reaches);
- the chance of elites.

The spawn pool is picked from the region's level, so dangerous kinds live far away rather than following you.

**In the game**

- The travel strip names the region and its creature levels, for example "Borderwilds lv 3–6".
- Crossing into a new region is announced. If it is above your level, the announcement says so and tells you to tread carefully.
- The Journal's guide explains the regions.

**Not yet tuned:** loot and XP already scale with creature level. A full balance pass, adjusting rewards per region and hunger and cold pressure in the far regions, is still open.
