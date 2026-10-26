# Homesteads and the Adventurer Guild

This extends the existing authoritative farming, object, construction, quest and party systems. It integrates the crafting expansion from main (`5bbd3cf`, PR #41) and preserves the existing material/recipe catalog. The authored livestock, orchard and guild artwork uses the same 2:1 axes, fixed palette and nearest-neighbour pixels as the world. Catalog furniture received extra raster margin to prevent clipping while retaining its ground anchors.

## Farming and building

Existing seasonal planting/watering/harvesting, fertilizers, sprinklers, Phase Lantern protection and superposed crops remain. Catalog rows marked `orchard` now produce perennial trees, bushes or grape trellises. They establish with watered days, survive dormant seasons, stop growing in winter outside a greenhouse, and keep their mature silhouette after picking. Their existing seed sources and food recipes remain intact. Perennial superpositions require compatible perennial crops with a shared fruiting season. Strong fertilizers cannot reduce maturation below one watered day.

Craft Irrigation Channels from stone and wood. A short cardinally connected channel network on one elevation carries actual adjacent water to neighbouring crops. Isolated channels, uphill channels and connections through another player's channels do not supply water; searches are bounded to 64 entries. It extends irrigation without simulating flowing water every frame.

The expanded construction catalog supplies 33 modular pieces: floors, walls, windows, doors, roof materials and stairs, with existing support, collision, two-floor traversal, cutaways and durable ownership. Compose cottages, farms, workshops, inns, towers or castle compounds from these pieces and the furniture catalog. Craft an Adventurer Guild Board at a Carpenter Bench (Woodworking 3) to give a player-built hall the same guild services as a town hall. World building remains within the existing 10,000-tile construction boundary; this does not add settlement government or NPC housing assignment.

Beds, double beds, canopy beds and hammocks permit safe rest: recover 30% of maximum health and full stamina once per 24 real minutes. The cooldown persists across reconnects. Other players' beds require ownership; hostile creatures nearby prevent rest. Friendly guards and passive wildlife do not. Rest does not advance the shared world clock or set a new respawn point. Chests/cabinets, crafting stations, lights and warming furniture retain their existing functions.

## Husbandry

Own a coop, barn or the crafting expansion's sheepfold, goat shed or pig pen. Existing count-only saves migrate to individuals while retaining feed and uncollected stock. Each animal has a stable ID, birth day, happiness and breeding cooldown. Barns also accept mixed mammals; species-specific shelters retain their restrictions. Four stalls per shelter keep both rendering and management bounded.

| Species     | Adult after | Product       | Cadence of fed dawns |
| ----------- | ----------- | ------------- | -------------------- |
| Chicken     | 2 days      | Egg           | 1                    |
| Cow         | 3 days      | Milk          | 1                    |
| Sheep       | 3 days      | Wool          | 2                    |
| Goat        | 3 days      | Goat Milk     | 1                    |
| Pig         | 3 days      | Truffle       | 2                    |
| Horse       | 5 days      | Fertilizer    | 2                    |
| Glimmerhart | 6 days      | Qubit Crystal | 4                    |

Adopt young animals through the shelter or house purchased animal items from the pack. Feed one hay per animal for one dawn; brush/care once a day to raise happiness. Fed happy adults produce on their cadence; two adults of the same species with happiness at least 70 can breed with two extra hay, an empty stall and four days between births. Young animals do not produce. Offline time cannot invent feed; each product stock is capped at 99. Collection is atomic, requires space for the complete collection, and preserves the new shears/pail requirements for wool and goat milk. Apiaries retain their colony/honey model.

Original rounded isometric models distinguish the seven species, young animals use smaller silhouettes, and quiet head/ear/feed poses leave their hooves fixed. Nearby individuals appear only on clear, level yard tiles; blocked yards still keep the animals safely in shelter management. There is no free-roaming livestock navigation, mount riding or individual bee simulation.

## Guilds

Existing civic halls/inns receive a physical isometric board on an unoccupied floor cell, preserving saved walls and furnishing. Boards in player-built halls use the same services. Guild registration grants a persistent identity card in the ledger. Its class and party buttons open the existing Circuit Board and Social systems. No duplicate class or party rules are introduced.

The rank path is **F → E → D → C → B → A → S → SS → SSS**. The ledger has 25 entries: registration, 16 commissions and eight promotion trials. Carry at most three active guild tasks. Commissions use real hunt, supply, crafting, farming, fishing, trade, archive, experimentation and boss events; promotion needs both commissions of the preceding rank and its practical trial. Rewards are one-time and server-verified at a nearby board. Completed history persists; there is no repeatable rank-XP grinding shortcut.

The final Sixfold Covenant requires an actual contribution to a successfully repelled assault in **each** of the six kingdoms, plus Veyr and Tide Leviathan victories after accepting it. Existing raid contribution checks supply the defense proofs. Saved worlds before revision 5 cannot complete kingdom-dependent proofs without a kingdom world; existing generation pinning remains unchanged.

Still open: escorted travellers/rescues, branching detective quests, guild diplomacy, procedurally varied guild contracts, guild-specific class unlocks, shared party kill credit, bespoke guild hall architecture, dedicated staff and settlement governance. Existing NPC kingdom quests and daily request boards are preserved. This is not blanket completion of every quest theme in master plan §11.

## Validation and integration points

- `shared/src/livestock.ts`, `guild.ts`, `crops.ts`: pure rules and compatible save data. Extend livestock species/products here and keep `FARM_ANIMALS`/`catalog/pen-data.ts` consistent.
- `server/src/systems/{farming,containers,guild,quests}.ts`: ownership, reach, payments, daily simulation, collection and board authority. Raid credit is in `features/armies/index.ts`.
- `client/src/art/{livestock,orchards,props}.ts`: original geometry; `worldobjviews.ts` owns bounded animal sprites, shadows and culling. `catalog-props.ts` retains the new models with corrected raster padding.
- `client/src/ui/{guild,husbandry}.ts`: parchment/ink modal panels; no permanent HUD cluster. Both landscape mobile and desktop are tested.
- Shared and server tests cover migration, replayed dawns, feeding, growth, breeding/capacity, season dormancy, safe collection, tool gates, real board access, rank skipping, one-time rewards, irrigation ownership, rest safety and save/reconnect.
- `e2e/homestead-art.mjs` checks all 1,245 item icons, 33 structures, seven livestock species in both facings/poses, perennial art and all 55 catalog props (both facings, every animation frame) for empty/clipped artwork. `e2e/homestead-gameplay.mjs` registers through the live guild UI, places a barn, adopts/cares/feeds through the live panel and reloads the saved herd and guild identity.

Representative evidence is in `docs/validation/homesteads/`. Physical low-end devices and cross-network latency remain unverified; software Chromium is not an FPS benchmark.
