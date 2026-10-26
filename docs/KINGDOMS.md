# The Six Great Kingdoms (world revision 5)

New worlds use revision 5; saved worlds keep their revision (1–4 are frozen). Everything below is gated on `generation >= 5`.

## Geography (`shared/src/realms.ts`)

Six continents sit at shard centres across the sea from the home continent: Aurelion (1024,-512), Sylvaris (256,-1024), Khar-Dum (-768,-768), Raijin (768,768), Thalassara (-256,1024, an archipelago), Nethrakar (-1024,256). Each has a warped coast, its own biome palette, roads on the axes, flat levels near settlements and massifs (Khar-Dum most). Every realm has 13 settlement plots: capital, 4 towns, 4 villages, 2 farms, 2 outposts, each inside one server shard.

## Cities v2 (`realm-towns.ts`, `client/src/art/buildings.ts`)

Plots are bigger (capital 224x168, town 120x92, village 60x50). Each plot has its own seeded plan: row streets of varying pitch and reach, lanes, parks and ponds, a river (or canals in Thalassara), a plaza that changes size and position, full or partial walls (stone, hedge, palisade, canal ring, obsidian with lava moat), corner and gate towers, and in capitals a castle that belongs to its kingdom: moated Aurelion keep with a tourney ground, Sylvaris grove-palace with ponds, Khar-Dum fortress-hold with a thick curtain wall, concentric Raijin citadel, Thalassara island palace, Nethrakar obsidian citadel behind lava. Buildings use style codes `4 + realm*5 + variant` (three common homes, a civic look, a grand look) and roof shapes (gable, hip, pagoda, dome, spire, flat battlements). Residents were increased (more guards and soldiers).

## Art and UI (this pass)

The master palette grew from 48 to 64 colours (emerald, teal, crimson, gold, blue; `C.n*`, `C.t*`, `C.c*`, `C.b*`), grass has mottling, clover and pebbles, trees and roofs use the vivid ramps and the six beasts were recoloured. The UI has a new identity layer (`ui/identity.css`): walnut and brass plates for the live HUD, parchment pages for reading windows, Pixelify Sans and IM Fell English. Impeccable is not installed in this environment, so the pass followed the frontend-design guidance instead. Not done: a full redraw of every older monster and prop, interior art for the new castle halls.

## Settlements (`realm-towns.ts`)

Deterministic `Town` objects per plot: avenue and main street, rows of buildings with south doors, plaza with well and banners, walls and gates (capital/town/outpost), fields and fences (farms/villages), palace and throne for capitals. Building `style` 4–33 selects the client's realm architecture (`client/src/art/buildings.ts`). Settlements are sanctuaries (no monsters).

### Markets, churches, fairs and houses (this pass)

- Plazas are markets: two ranks of stalls (`stall_<awning>_<wares>`: five awnings × produce, fish, cloth, bread, pots, flowers, hung meat, herbs) with crates and baskets, a tiered fountain (or statue/well), lamps and banners. Every stall has a `.stall.N` keeper spot.
- Capitals, towns and villages get a church (`BuildingKind 'church'`: pews, altar, steep gable, rose window, stone bell tower with spire) and a hedged churchyard (graves, crosses, obelisks, a crypt, dead trees). Capitals and towns get a fairground (Ferris wheel, carousel, swing boats, big top, game booths).
- Houses are smaller and each one differs: roof form per kingdom (`plain`, `cross` gable wing, `gambrel`, `barrel`, `swoop`, `jerkin`), pitch, a 40% chance of another roof colour, plaster washes, shutter colours, stone ground floors and round corner towers with cone roofs (`client/src/art/buildings.ts`).
- The QubitMan statue was redrawn after the reference character (wide hat, teal plume, red scarf, mantle, white sleeves, bracers, crimson tabard, gold coins).

### World life (`client/src/game/life.ts`)

Visual-only, built for the settlement you stand in: market vendors calling their wares and customers browsing, tavern patrons in the evening, smiths at the forge, farmers and farm animals, a fisherman, rooftop pigeons, fairgoers, mourners, caravans at the gates, a royal procession and jousting in capitals, bells at 6/12/18, festival bunting and fireworks, umbrellas in rain, people fleeing monsters. Every villager has a unique packed appearance (built one sheet per frame). Army bars sit at helm height.

## People (`kingdoms.ts`, `realm-npcs.ts`, `dialogue.ts`)

`KINGDOMS` holds ruler, court, units, economy, festivals, ranks and relations. `realmNpcs()` builds ~360 residents (ruler/court/commander/guards/archers/innkeeper/smith/merchant/herbalist/scholar in capitals; smaller rosters elsewhere) with schedules and shops. They are not in `NPCS`; the server village adds them at revision 5 for the shard owning their plot. Voices are generated from lore. On a kingdom's festival day its folk gather at their `.plaza` spot from noon.

## Systems

- Reputation (`PlayerData.rep`, `gainRep`): tiers at 0/100/300/700/1500, shop price multiplier (0.8–1.15), spill to allies/rivals. Earned by buying/selling at kingdom shops and quest rewards.
- Diplomacy: `diplomacyAt(seed, day)` seasonal events; `tradeModifier` prices foreign goods; festivals give a 10% discount.
- Quests (`realm-quests.ts`): audience, trade, hunt the realm beast, festival dish (teaches the kingdom's dish recipe).
- Beasts: griffin, spirit stag (neutral), iron golem, raiju, reef naga, hellhound (enemy kinds 44–49); 20% of spawns in a kingdom's wilds for level 3+ players.
- UI: Journal → Kingdoms tab; "Entering <Kingdom>" toast.

## Not built

Server-side NPC routines beyond schedules (guard rotation, gossip, trade routes), rideable mounts, story sites and ruins, a redraw of every older monster in the style of the latest references, treaties that change the world, underwater cities and aquatic farming, kingdom ship fleets, mythical army units as enemies/allies, branching faction quests, per-realm music.

## Checks

`shared/test/realms.test.ts`, `realm-towns.test.ts`, `realm-quests.test.ts`, `server/test/kingdoms.test.ts`; visual tours `e2e/kingdoms-art.mjs`, `e2e/realm-beasts-art.mjs`.

## Architectural polish (2026-10-26)

The shared building painter now varies home ridge orientation, pitch, gable/hip silhouettes and dormers without changing settlement generation or saved layouts. It fixes interior roof pixels being mistaken for fascia, refines ray-hit material coordinates, gives hip end planes their own tile orientation and shading, and adds staggered rectangular tile courses, gable framing and architecture-coloured entry awnings. Existing pagodas, domes, spires, battlements and realm palettes remain.

Market stalls have wider counters, merchandise and price boards, front/back supports, braces, stone feet and projected canvas/valances in both orientations. QubitMan's original carved figure now has a tricorn, scarf inlay, star medal, split coat, staff and grounded boots, preserving the plinth, inscription and quantum effects. These shared textures reach existing kingdoms and older settlements too.

Building loading prioritizes visible architecture before off-screen warmup, retaining a single build/upload per frame. Art Lab can now select revision 5, and the visual harness waits for all visible architecture rather than taking premature empty-floor screenshots.

Validation harness: `e2e/kingdom-materials.mjs` (source Vite), plus `e2e/kingdoms-art.mjs` (playable solo). Scope: architectural art and loading order; this does not add new castle interiors, upper floors, districts or world-generation migrations. Those remain separate features.

This pass also integrates the newer Living cities branch (PR #38, `9d8c741`), preserving its compact homes, house-specific paints, cross/gambrel/barrel/swept/clipped roof forms, corner turrets, churches and churchyards, fairgrounds and resident activities. The fair's wheel is now a true projected vertical circle with axle depth and box cabins; carousel horses and swing boats have projected volumes, and carousel/tent canvas uses faceted 3D cones with restrained stripes instead of stacked rings. All ride frames are checked for clipping in both facings. Tall church/turret rays start at the full volume height rather than the lower chimney cap. Steep church gables use a safe volume cap when the shallow-plane analytic intersection is invalid; the browser check catches missing roof planes. The new material harness runs in browser CI and its images are uploaded with the art evidence.

## Settlement streaming and shopfronts

The next batch spatially indexes immutable settlement buildings by the existing 32-tile chunk grid. Each frame updates only the nearby set, sorts visible bakes ahead of warmup, and hides sprites once when they leave that set. Roof visibility, interior detection and night lights retain their rules. Boundary-door and teleport-cleanup regression tests include 1,000 distant buildings. No new world-generation data or save format is introduced.

Hanging shop lettering and icons are now projected onto thick upright boards; their bottoms retain the previous height above the walkway. Stone thresholds and small woven mats use the wall painter's real top/side geometry and existing low doorstep height. They improve entrance readability without creating new obstacles.

The six source-rendered capital samples update 55–66 nearby buildings out of 1,141 total (about 94–95% fewer building-view candidates per frame). This measures architecture traversal, not overall FPS; terrain, NPCs and other render costs still exist. Evidence: `docs/validation/kingdom-art/report.json`.
