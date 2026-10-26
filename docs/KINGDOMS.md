# The Six Great Kingdoms (world revision 5)

New worlds use revision 5; saved worlds keep their revision (1–4 are frozen). Everything below is gated on `generation >= 5`.

## Geography (`shared/src/realms.ts`)

Six continents sit at shard centres across the sea from the home continent: Aurelion (1024,-512), Sylvaris (256,-1024), Khar-Dum (-768,-768), Raijin (768,768), Thalassara (-256,1024, an archipelago), Nethrakar (-1024,256). Each has a warped coast, its own biome palette, roads on the axes, flat levels near settlements and massifs (Khar-Dum most). Every realm has 13 settlement plots: capital, 4 towns, 4 villages, 2 farms, 2 outposts, each inside one server shard.

## Settlements (`realm-towns.ts`)

Deterministic `Town` objects per plot: avenue and main street, rows of buildings with south doors, plaza with well and banners, walls and gates (capital/town/outpost), fields and fences (farms/villages), palace and throne for capitals. Building `style` 4–9 selects the client's realm architecture (`client/src/art/buildings.ts`). Settlements are sanctuaries (no monsters).

## People (`kingdoms.ts`, `realm-npcs.ts`, `dialogue.ts`)

`KINGDOMS` holds ruler, court, units, economy, festivals, ranks and relations. `realmNpcs()` builds ~360 residents (ruler/court/commander/guards/archers/innkeeper/smith/merchant/herbalist/scholar in capitals; smaller rosters elsewhere) with schedules and shops. They are not in `NPCS`; the server village adds them at revision 5 for the shard owning their plot. Voices are generated from lore. On a kingdom's festival day its folk gather at their `.plaza` spot from noon.

## Systems

- Reputation (`PlayerData.rep`, `gainRep`): tiers at 0/100/300/700/1500, shop price multiplier (0.8–1.15), spill to allies/rivals. Earned by buying/selling at kingdom shops and quest rewards.
- Diplomacy: `diplomacyAt(seed, day)` seasonal events; `tradeModifier` prices foreign goods; festivals give a 10% discount.
- Quests (`realm-quests.ts`): audience, trade, hunt the realm beast, festival dish (teaches the kingdom's dish recipe).
- Beasts: griffin, spirit stag (neutral), iron golem, raiju, reef naga, hellhound (enemy kinds 44–49); 20% of spawns in a kingdom's wilds for level 3+ players.
- UI: Journal → Kingdoms tab; "Entering <Kingdom>" toast.

## Not built

Marching armies/mounted units, wars and treaties that change the world, atlas realm borders, underwater cities and aquatic farming, kingdom ship fleets, mythical army units as enemies/allies, branching faction quests, per-realm music.

## Checks

`shared/test/realms.test.ts`, `realm-towns.test.ts`, `realm-quests.test.ts`, `server/test/kingdoms.test.ts`; visual tours `e2e/kingdoms-art.mjs`, `e2e/realm-beasts-art.mjs`.
