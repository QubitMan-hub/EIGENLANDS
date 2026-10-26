# Homesteads and the Adventurer Guild

This extends the existing authoritative farming, object, construction, quest and party systems. It integrates the crafting expansion from main (`5bbd3cf`, PR #41) and preserves the existing material/recipe catalog. The authored livestock, orchard and guild artwork uses the same 2:1 axes, fixed palette and nearest-neighbour pixels as the world. Catalog furniture received extra raster margin to prevent clipping while retaining its ground anchors.

## Farming and building

Existing seasonal planting/watering/harvesting, fertilizers, sprinklers, Phase Lantern protection and superposed crops remain. Catalog rows marked `orchard` now produce perennial trees, bushes or grape trellises. They establish with watered days, survive dormant seasons, stop growing in winter outside a greenhouse, and keep their mature silhouette after picking. Their existing seed sources and food recipes remain intact. Perennial superpositions require compatible perennial crops with a shared fruiting season. Strong fertilizers cannot reduce maturation below one watered day.

Craft Irrigation Channels from stone and wood. A short cardinally connected channel network on one elevation carries actual adjacent water to neighbouring crops. Isolated channels, uphill channels and connections through another player's channels do not supply water; searches are bounded to 64 entries. It extends irrigation without simulating flowing water every frame.

The expanded construction catalog supplies 33 modular pieces: floors, walls, windows, doors, roof materials and stairs, with existing support, collision, two-floor traversal, cutaways and durable ownership. Compose cottages, farms, workshops, inns, towers or castle compounds from these pieces and the furniture catalog. Craft an Adventurer Guild Board at a Carpenter Bench (Woodworking 3) to give a player-built hall the same guild services as a town hall. World building remains within the existing 10,000-tile construction boundary; owned guild boards now also manage settlement charters and NPC housing, described below.

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

Original rounded isometric models distinguish the seven species. Four model-space facings and short stride poses keep feet grounded; young animals use smaller silhouettes. Server-synced individuals rest for ten seconds, then take a short collision-checked yard walk. They stay within four tiles of their shelter, cannot cross cliffs or solid terrain and stream only near players (128 animals maximum per room). Blocked yards retain animals safely in shelter management.

Happy adult horses and Glimmerharts can train for 100 coins and five hay. Training persists on the individual. Use **Saddle up** in shelter management; the original animal model appears beneath the rider, with a grounded sun shadow. Riding gives 1.45× walking speed through the shared predicted simulation/packed ACK. Space dismounts; attacks, skills, dodges and incoming enemy damage dismount before combat. Boats, minecarts, caves, upper floors, roofed buildings, lost shelter ownership, death and disconnect/handoff end riding. Mounting near hostiles is refused. Mount position/riding status is transient; training and ownership persist. Apiaries intentionally retain their colony model, without individual bee simulation.

## Guilds

Existing civic halls/inns receive a physical isometric board on an unoccupied floor cell, preserving saved walls and furnishing. Boards in player-built halls use the same services. Guild registration grants a persistent identity card in the ledger. Its class and party buttons open the existing Circuit Board and Social systems. No duplicate class or party rules are introduced.

The rank path is **F → E → D → C → B → A → S → SS → SSS**. The ledger has 25 entries: registration, 16 commissions and eight promotion trials. Carry at most three active guild tasks. Commissions use real hunt, supply, crafting, farming, fishing, trade, archive, experimentation and boss events; promotion needs both commissions of the preceding rank and its practical trial. Rewards are one-time and server-verified at a nearby board. Completed history persists; there is no repeatable rank-XP grinding shortcut.

The final Sixfold Covenant requires an actual contribution to a successfully repelled assault in **each** of the six kingdoms, plus Veyr and Tide Leviathan victories after accepting it. Existing raid contribution checks supply the defense proofs. Saved worlds before revision 5 cannot complete kingdom-dependent proofs without a kingdom world; existing generation pinning remains unchanged.

### Living guild journeys

Four rotating commissions appear each world day for your current rank, alongside the 25 promotion entries. Titles, route heading and evidence are deterministic from world seed/day/type; routes are surveyed over actually loaded, walkable, same-step terrain. Routes must stay within the serving shard. No available route means a refused offer rather than an unreachable objective.

- **Escort:** a physical scholar follows only while you stay within seven tiles and the road is clear. The traveller must reach three checkpoints; the player's arrival alone earns nothing. Nearby hostiles hurt the traveller and can fail the journey.
- **Rescue:** reach a distant unwarded camp, defeat its scripted guards, then guide the physical surveyor back. Guards cannot supply XP, loot or unrelated quest credit, preventing abandonment farming. A hall with no suitable unwarded local camp cannot issue this route.
- **Investigation:** inspect three ordered physical clues, compare their road/thread/seal evidence, identify the suspect and choose restitution or a magistrate report. Wrong accusations send you back to the witness evidence. Branches grant different kingdom standing.
- **Diplomacy:** meet a physical envoy and choose ten wood of rebuilding aid, a 50-coin compromise, or a threat. Costs and kingdom standing differ; the choice and quest proof apply only once.

Journey progress, health, release state and decisions survive reconnects. The Journal/atlas tracks the current rendezvous. Failed/incomplete trips can be abandoned at a real board; resolved work cannot be abandoned and replayed for reputation. Active jobs remain valid on the issue day and two following days, then expire at the third following dawn; completed daily history is retained for fourteen days. These optional jobs do not bypass the fixed promotion trials.

Existing parties now share actual kill quest credit with living members within 32 tiles in the same room. Existing party XP remains separate; loot and rewards are not copied. Town guilds gain a projected registration desk with brass seal and hanging standard, plus a Guild Steward who opens the ledger. Free floor placement preserves doors, stairs, existing furnishing and saved building footprints. Player guild boards support their own modular halls. This creates a guild annex within civic architecture; it does not replace every civic building with a new prefab.

**Wayguard** is a new alternative specialization for both existing quantum classes: level 10 plus verified guild rank B, with 6% less incoming enemy damage. Server checks enforce both gates, and the class UI shows it locked before eligibility. Original specializations remain available. This is not the master plan's separate full class expansion.

### Settlement charters

Open your owned Adventurer Guild Board, then **Manage settlement**. A charter advances **Homestead → Hamlet → Village → Borough**, holding 2/4/6/8 residents. Deposit 100 coins at a time into its durable treasury. Invitations cost 50 treasury coins. Each upgrade requires the current capacity in residents, guild registration, 250 × next tier treasury coins, 30 × next tier wood and 20 × next tier stone. The board holds the charter; demolishing it ends that charter.

Homes must be within 24 tiles of the board, entirely owned, enclosed, roofed and at least six interior cells, with an owned bed, table/desk, light and a boundary door. Room floods stop at 144 cells. Multiple beds or boards cannot assign the same room twice. Homes are revalidated after edits; lost roofs/walls/furniture stop the resident's services and appearance. Residents use the existing original human sprite families.

Treasury upkeep is three coins per resident on an observed dawn. Paid residents in valid homes gain five happiness; unpaid/invalid housing loses fifteen. Offline days do not multiply charges or production. At happiness 50+, a **gardener** waters owned crops within eight tiles on a paid dawn; an **artisan** fully repairs a damaged equipped weapon for 15 player coins; a **warden** reduces incoming enemy damage by 8% within twenty tiles of the board (does not stack with other wardens). Resident records, happiness, treasury and charter tier persist. Visitors cannot spend or assign housing.

The journey, party credit, staff, resident, yard and riding gaps are now implemented with these boundaries. Remaining architecture and broader scope: new complete guild-building prefabs, authored world-changing branching campaigns, resident schedules/elections/taxation, unrestricted pasture migration and individual bees. Physical low-end hardware and real cross-network latency still need testing. Existing kingdom quests, daily request boards, recipes, controls and world-generation pinning remain intact.

## Validation and integration points

- `shared/src/livestock.ts`, `guild.ts`, `crops.ts`: pure rules and compatible save data. Extend livestock species/products here and keep `FARM_ANIMALS`/`catalog/pen-data.ts` consistent.
- `server/src/features/{guild-journeys,settlements,ranch}.ts`: journey actors/decisions, housing/charters, calm yard walks and mount authority. `shared/src/{guild-contracts,settlement}.ts` defines bounded persisted records and home validation.
- `server/src/systems/{farming,containers,guild,quests}.ts`: ownership, reach, payments, daily simulation, collection and board authority. Raid credit is in `features/armies/index.ts`.
- `client/src/art/{livestock,orchards,props}.ts`: original geometry; `worldobjviews.ts` owns bounded animal sprites, shadows and culling. `catalog-props.ts` retains the new models with corrected raster padding.
- `client/src/ui/{guild,husbandry}.ts`: parchment/ink modal panels; no permanent HUD cluster. Settlement management is in `ui/settlement.ts`; all three panels are checked on landscape mobile and desktop.
- Shared and server tests cover migration, replayed dawns, feeding, growth, breeding/capacity, season dormancy, safe collection, tool gates, real board access, rank skipping, one-time rewards, irrigation ownership, rest safety and save/reconnect.
- `e2e/homestead-art.mjs` checks all 1,245 item icons, 33 structures, seven livestock species in both facings/poses, perennial art and all 55 catalog props (both facings, every animation frame) for empty/clipped artwork. `e2e/homestead-gameplay.mjs` registers through the live guild UI, places a barn, adopts/cares/feeds through the live panel and reloads the saved herd and guild identity.

Representative evidence is in `docs/validation/homesteads/`. Physical low-end devices and cross-network latency remain unverified; software Chromium is not an FPS benchmark.

### Living-guild validation

`shared/test/living-guilds.test.ts` checks canonical daily IDs, malformed saved routes/charters, housing requirements and mount ACK/prediction. `server/test/living-guilds.test.ts` exercises actual route surveying, ordered physical evidence, branching choices, one-time payment/reputation, abandonment, walking escorts, guarded rescues, party range/death gates, demolished housing, treasury ownership, charter reconnects, adult mount training and guild specialization gates. The browser test `e2e/living-guilds.mjs` grows/cares for a real saved horse across dawns, trains/rides/dismounts through actual UI and resolves an investigation through real clue objects. The art test now covers four livestock facings, rest/feed/stride poses, the guild desk and clue props, and the settlement panel. Evidence: `docs/validation/living-guilds/`.
