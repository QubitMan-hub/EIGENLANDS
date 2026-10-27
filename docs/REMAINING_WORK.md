# EIGENLANDS — remaining work

This is the practical remaining-work index. The full original requirements and detailed checklist remain in [master request](design/master-request.md) and [master plan](EIGENLANDS_MASTER_PLAN.md). Completed implementation and verification history: [continuation notes](CONTINUE_HERE.md).

## Player and NPC overhaul — active

Players use original native 32×48 art with saved-appearance support. NPCs retain their preferred original 24×32 designs with the newer directional animations. Eighteen directional action families now have eight poses, including station work, hurt, dodge and death. Variable-height physical contacts, richer combat/charge keys, occupation schedules and every bespoke prop interaction remain open. See [CHARACTER_ACTIONS.md](CHARACTER_ACTIONS.md) for exact coverage, verification and remaining items.

## Adventurer paths, bestiary and boss sprites

Implemented: six class families and thirty specializations, unique dual-form techniques and enforced passives, earned-resource ultimates, bounded temporary allies, party synergies, habitat-gated creatures, ecological behaviors, mythical bonds, sighting persistence and five phased ancient encounters. All fourteen bosses now have dedicated original day/night isometric sprite sheets, matching portraits, fixed anchors and real animation poses. See [mechanics and validation](ADVENTURER_PATHS_AND_BESTIARY.md) and [art sources, loader and reproduction](BOSS_ART.md).

Remaining game-wide work: extended group balance sessions, physical-device GPU/thermal measurements and larger cross-network multiplayer stress. New class-exclusive armor sets/player body rigs are not part of the six-family specialization implementation; paths use real existing equipment and held animations.

## Ground texture repair

Implemented: removal of filled noise-contour blobs from caves/paths and related terrain, bounded angular pixel clusters, narrow material/habitat edge blending, world-anchored detail in both quality modes, and indoor cloud-shadow exclusion. The real-shader comparison measures large color regions before/after and camera anchoring. See [root cause and proof](UNDERCROFT.md#ground-texture-repair). Physical phone GPU/thermal profiling remains separate.

## Cave materials and identity

Implemented: original magma/water cascades, impassable lava pools with bounded lighting, glowing mushroom clusters, hinged storage/vault/sea chests driven by authoritative interactions, low stone-vault cave buildings, distinct submerged masonry/arches, and a larger skeletal Bellkeeper with a carved, moated arena. See [material pass and limits](UNDERCROFT.md#material-and-architecture-pass). Player-selected building materials remain literal; no new underwater housing settlement is implied.

## Undercroft overhaul

Implemented: broad interconnected districts/caverns, original mouth compatibility, secondary shafts, supply exits, six visual habitats, dry lake crossings, secret caches, ruins, five shrine challenge types, warned steam vents, six cave enemies, two guardian kinds, one three-phase Bellkeeper, two occupied underground towns (16 residents, shops and quests), two abandoned towns, and Atlas exit/entry tracking. [Player guide, implementation scope and limitations](UNDERCROFT.md).

Remaining cave expansion: stacked geological floors/coordinate migration, additional distinct bosses and authored puzzle mechanics, deeper town-specific interiors/quest stories, durable guardian cooldowns across room restarts, physical phone performance measurements. Supply lifts currently provide one-way returns; normal mouths/shafts remain two-way. Existing mined edits and character reward records remain authoritative.

## Comfortable controls

- Implemented: selected axe/pickaxe + left-click on tree/stump/rock/ore approaches and gathers through the existing server rules; forage/ripe harvest and selected hoe/can/refill actions use the same intent; opaque sprite picking, bounded obstacle routes and cancellation preserve combat control. Defaults are either Shift for Dodge and Space for context interactions (including NPCs, caves and stairs); untouched older defaults migrate while custom bindings remain.

## Gathering, combat and interiors

- Implemented: two Dodge charges with four-second sequential recharge; rod + Space near water without precise cursor aim; centered statue reading; grounded isometric bed layers; held-tool grip/rest alignment; generated town stairs at back corners with clear, reachable landings.
- Added: original Reed Stalker ambush/leap/disengage and Cinder Moth orbit/retreat/ranged encounters, inside existing biome/level/density rules. Full spawn-density and high-level encounter rebalance remains separate work.
- Player building freedom remains: automatically generated stairs moved; player-built stairs keep their chosen placement. Higher towers/co-owners/house benefits remain below.

## Runtime performance

- Implemented: background chunk/building preparation, bounded exact caches, unchanged-snapshot fast paths, visible-only rendering, cached overscanned terrain, lighter Auto graphics, gentle/off/full weather and shared real-time catch-up for movement/dash/combat. [Measurements, scope and reproduction](performance/2026-10-24-runtime.md).
- Remaining validation: real Android/iPhone GPU, memory and thermal measurements; older-browser fallback playtests; large multiplayer/network stress. The software-GPU trace supports roughly 13× less mean main-thread work and 3.5× better median frame timing, not a universal 10× FPS claim.

## Current visual request

- Completed in PR #18: centered RMB camera, preserved mouse movement, shared clean icon shading, native compact scaling, stone/coal/ore artwork, tree and animated-object anchors, consistent actor/prop shadow projection, continuous sun/moon shadow cycle.
- Completed in [PR #19](https://github.com/QubitMan-hub/EIGENLANDS/pull/19): successful mining/chopping uses the correct held axe/pickaxe, faces its resource and plays a harvesting pose, including with another weapon equipped. All 13 ordinary seeds use distinct crop-picture packets; strawberry artwork now differs from cranberry; quantum seeds retain their distinct icon.
- Completed in [PR #20](https://github.com/QubitMan-hub/EIGENLANDS/pull/20): distinct carp, perch, trout, catfish, pike and eel inventory artwork, with species markings and corrected common-fish tail bounds.
- Completed in [PR #22](https://github.com/QubitMan-hub/EIGENLANDS/pull/22): individual artwork for all eleven cooked foods and five main potions, with dish silhouettes and potion bottle shapes/symbols rather than colour alone.
- Still open: individual art review for remaining ingredients/materials, other fish, equipment, furniture, phase tonics/fertilizers and rare loot.
- Completed in [PR #20](https://github.com/QubitMan-hub/EIGENLANDS/pull/20): held hoe, watering-can, rod-cast and net-sweep poses reuse the harvesting presentation, including with a combat weapon equipped. A net attempt animates even when it catches nothing.
- Completed in [PR #21](https://github.com/QubitMan-hub/EIGENLANDS/pull/21): successful catches use a rod reaction after the local fishing result overlay closes, retaining a known casting direction.
- Still open: hook/missed-catch and other interaction animation review, plus visible held consumables and non-tool/non-weapon items where appropriate.
- Still open: per-material dynamic highlights. Current pixel-art highlights are authored into sprites; ambient scene lighting and cast shadows respond to time. A complete normal-map/relighting pipeline is not implemented.
- Still open: real mobile-device GPU profiling and native orientation-lock verification. Landscape browser emulation is covered.

## Gameplay and world expansion

- Companion fixes completed in [PR #21](https://github.com/QubitMan-hub/EIGENLANDS/pull/21): bounded cached obstacle routes, smooth walking catch-up, owner-centered threat sight/leash, and safe recall to the owner tile. Support deer retain their noncombat role; neutral wildlife is not attacked automatically.

- Implemented (2026-10-27): hiring residents. Guards, soldiers, archers and commanders who count you a friend sign on for a one-world-hour contract, one employer at a time, extendable an hour at a time up to three hours ahead (a level per renewal), with **Hired · N min left**, **Extend 1 h**, **End contract** and a half refund of unused time ([LIVING_WORLD.md](LIVING_WORLD.md)). Still open: gear for hirelings, and resident crafters or workers as hires.
- Travel follow-up: a gamepad hardware review of the travel window. Mount fatigue and stables, waystones, gates, ferries with voyages, the Undercroft network, Recall Shards, horse, Stag and Griffin riding with naming and feeding, caravan trade, ambushes and escort jobs, the Wandering Peddler, railed bridges and road speed are implemented ([TRAVEL.md](TRAVEL.md)).
- Living world (§16), implemented 2026-10-27: crypt interiors on their own underground plane with three floor plans and the braziers' riddle, NPC ties that change over seeded arcs and react to your kindness (word travels to friends and rivals), royal events, settlement growth (furnished crown cottages with a family outside the door by day), the fox's portrait, wayfarers on the roads, wild folk at work, street life in every town, an ambient soundscape and footprints/puddles. Still open: multi-floor dungeons and other puzzle types, cottage families you can talk to, changes to existing town layouts ([LIVING_WORLD.md](LIVING_WORLD.md#limits-and-what-is-not-built)).
- Implemented (2026-10-27): dagger (fast, light) and greatsword (slow, heavy, two-handed swings) weapon families with forge recipes, Ironhand Smithy stock, held art and icons. Further families (bows, staves, maces) remain open; keep displayed and authoritative attack values shared.
- Implemented (2026-10-27): shipwrecks with a captain's log on sandy shores and summit cairns with a climbers' register on hilltops (revision-6 worlds). More authored biome/cave discoveries and occupied interior variety remain. Preserve existing landmark IDs, world edits, floor transitions and collision.
- Broader creature/monster diversity with coherent art and meaningful habitats; preserve current separate wildlife/hostile budgets and settlement wards.
- Implemented (2026-10-27): starfall nights with fallen stars to break open, aurora over the taiga, the morning rainbow after rain, and daily town bounties on named beasts ([LIVING_WORLD.md](LIVING_WORLD.md#wonders-and-hunts)). Still open: recipes for star shards, unique bounty-beast art and attacks, a bounty notice board.
- Broader shrine challenge variety, ocean discoveries, settlement identity and environmental storytelling beyond the existing playable systems.
- Implemented: modular owned two-floor houses with 33 craftable pieces, pitched roofs/cutaways, doors, paired stairs, collision, safe refunds and durable solo/server ownership. See [building guide and limits](PLAYER_BUILDING.md). A bed under your own roof leaves you well rested (+15% experience). Further expansion: arbitrary-height towers, shared owner permissions, further house benefits and construction across horizontal shard edit boundaries.
- Survival depth, implemented: temperature/exposure, injuries (bleeding, poison, burns, frostbite), fractures (no running or dodging until a splint) and curses (weaker blows, no regeneration until holy water or a shrine prayer), bandages and remedies, Hardcore, death penalties by difficulty (Hardcore drops your pack in a lost satchel), murky water and boiling, balanced eating (Nourished), clothing warmth by armour material, the Travel Tent (shelter, rest and a camp to wake at) and food spoilage (raw fish and meat rot in the pack, slower in the cold; chests and cooking keep). Still open: magical conditions beyond the curse, diseases, and seasonal food shortages.
- Implemented (2026-10-27): dungeon gates, ranked E–S, opening daily in the wilds. Each leads to a procedural
  dungeon with a master, mana stones and dusk dungeon breaks ([GATES.md](GATES.md)). Also implemented: Shadow
  Exchange, Monarch's Domain and named guardian shadows ([design/shadow-army.md](design/shadow-army.md)). Still open:
  gate party tools and rank exams, gamepad bindings for the shadow powers, and new art for gate masters.
- Implemented (2026-10-27): the three realms (Aetheria, the Umbral Abyss, Chronoria) with their neutral and hostile peoples, standing, realm metals and gear, 3 guardian bosses and realm puzzles ([REALMS.md](REALMS.md)). Still open: realm quests, sky dragons and flight, multi-phase realm bosses, visible dial/chime states.
- Six kingdoms/frontier cities, F–SSS guild progression, daily journeys and owned resident charters are implemented; replacement guild prefabs, authored world-changing campaigns and private friend-world hosting remain larger unfinished systems. See COZY_TOWNS.md and HOMESTEADS_AND_GUILD.md for exact boundaries.
- Cross-device atlas synchronization and private-world chart identity. Local durable IndexedDB chart history is implemented.

## Art and release constraints

- External uploaded packs still lack a verified creator/reuse license. “Free package” alone does not establish redistribution/commercial rights. Continue using original procedural art and repository assets with recorded provenance until verified.
- Review new assets at actual gameplay sizes, all facings, animation extremes and reduced motion. Avoid new persistent HUD panels; keep instructions in Journal or the appropriate modal.
- Each next feature needs real solo/multiplayer persistence and gameplay proof, relevant tests/typechecks/builds, inline review (no subagents), and verified integration. Do not mark the entire master overhaul complete from a finished slice.

## Cave infrastructure and browser co-op (2026-10-25)

This batch replaces generic frontal signs with native isometric props, ties survey signs to actual lifts and moves settlement records beside the shop entrance. Dining chairs face adjacent tables and have proper rear uprights. Exterior lamps use wrought-iron geometry at checked street approaches rather than an arbitrary lamp grid.

Underground rock/mineral nodes now use 32×16 geological blocks at the cave wall height; surface outcrops are preserved. Water foam/ripple density and magma glare/flow are reduced. Cascades require a real rear rock wall and pool; unsupported freestanding source pillars are removed. Dry routes and mining rules remain authoritative.

Ruins and grove mining districts have connected haulage loops. Use a depot to board; hold movement to ride, release to brake, Use to step off. Rails and carts are native isometric geometry. These are local mine circuits, not an across-world railway or a player-built rail crafting system. Track edits/construction can block a cart; dismounting remains available. Reconnecting on a track returns you safely on foot.

The Pages build supports real online servers and friend invites as well as its original solo world. New solo worlds own their saved calendar offset; old saves are preserved. Public multiplayer hosting remains a host action, with free Cloudflare Tunnel instructions in [PLAY_WITH_FRIENDS.md](PLAY_WITH_FRIENDS.md). No public backend or tunnel was provisioned by this change. Large real-device sessions, phone thermals and internet latency profiles remain open validation work.

## Free Render trial deployment (2026-10-25)

The owner chose **Render, strictly $0**, accepting idle sleep and the 30-day database expiry. Root `render.yaml` provisions only a free Singapore web service and free Singapore PostgreSQL. [RENDER_FREE.md](RENDER_FREE.md) contains the authenticated deploy link, frontend joining steps and manual save-export instructions. No Render account/API access is connected here; the live service must still be created from that link, and its public backend URL is needed for live verification and optional frontend prefill.

The production image/readiness/proxy setup and connected-player save/restore test are implemented. A real container-recreation test exposed and fixed competing process-shutdown handlers that could drop recent progress. CI now verifies the Docker image, reconnect persistence and a real SQL dump/restore. The load tool reports failures correctly rather than printing success after missing joins.

**Performance remains unresolved for 20 friends on Render Free.** A 21-client local 0.1-CPU run joined everyone but exceeded tick and latency budgets; even a smaller five-client run recorded occasional overruns. Reports are under `docs/validation/render-free-*.json`. These are local simulations of tight resource limits, not actual Render or Asia–Australia measurements. No paid upgrade, always-on promise or permanent backup service is included.

## Latest pasted world-overhaul request

See [WORLDGEN_OVERHAUL_REMAINING.md](WORLDGEN_OVERHAUL_REMAINING.md) for the full acceptance checklist and exact omissions. FPS/cache correctness, bundle splitting, solo CI and three-seed map/statistics baselines are implemented; the new worldgen/elevation/art architecture is not finished.
