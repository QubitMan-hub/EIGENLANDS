# EIGENLANDS — remaining work

This is the practical remaining-work index. The full original requirements and detailed checklist remain in [master request](design/master-request.md) and [master plan](EIGENLANDS_MASTER_PLAN.md). Completed implementation and verification history: [continuation notes](CONTINUE_HERE.md).

## Current visual request

- Completed in PR #18: centered RMB camera, preserved mouse movement, shared clean icon shading, native compact scaling, stone/coal/ore artwork, tree and animated-object anchors, consistent actor/prop shadow projection, continuous sun/moon shadow cycle.
- Completed in [PR #19](https://github.com/QubitMan-hub/EIGENLANDS/pull/19): successful mining/chopping uses the correct held axe/pickaxe, faces its resource and plays a harvesting pose, including with another weapon equipped. All 13 ordinary seeds use distinct crop-picture packets; strawberry artwork now differs from cranberry; quantum seeds retain their distinct icon.
- Completed in [PR #20](https://github.com/QubitMan-hub/EIGENLANDS/pull/20): distinct carp, perch, trout, catfish, pike and eel inventory artwork, with species markings and corrected common-fish tail bounds.
- Still open: individual silhouette/art review for the rest of the catalog (food, fish, equipment, furniture and rare loot); the shared painter improvement is not a bespoke redraw of every item.
- Completed in [PR #20](https://github.com/QubitMan-hub/EIGENLANDS/pull/20): held hoe, watering-can, rod-cast and net-sweep poses reuse the harvesting presentation, including with a combat weapon equipped. A net attempt animates even when it catches nothing.
- Still open: hook/reeling and other interaction animation review, plus visible held consumables and non-tool/non-weapon items where appropriate.
- Still open: per-material dynamic highlights. Current pixel-art highlights are authored into sprites; ambient scene lighting and cast shadows respond to time. A complete normal-map/relighting pipeline is not implemented.
- Still open: real mobile-device GPU profiling and native orientation-lock verification. Landscape browser emulation is covered.

## Gameplay and world expansion

- Expand the existing single paid guild-fighter contract into resident-specific recruitment with clear ownership/lease visibility, payment/dismissal, persistence and multiplayer identity. The existing contract already checks friendship and expires; wildlife bonds and extracted echoes also work.
- Travelling merchants: actual routes/schedules, stock/economy, discovery, interaction and persistence.
- Further weapon families and equipment progression beyond the existing sword, spear, battle axe, warhammer, crossbow and Foci; keep displayed and authoritative attack values shared.
- More authored biome/cave/shore/mountain discoveries and occupied interior variety. Preserve existing landmark IDs, world edits, floor transitions and collision.
- Broader creature/monster diversity with coherent art and meaningful habitats; preserve current separate wildlife/hostile budgets and settlement wards.
- Broader shrine challenge variety, ocean discoveries, settlement identity and environmental storytelling beyond the existing playable systems.
- Full player building freedom: houses, roofs, functional stairs, collision and durable ownership rather than decorative placement alone.
- Survival depth: temperature/exposure, injuries, purification, richer nutrition, bandages and Hardcore. Cozy/Adventure food and water already work.
- Kingdoms, guild progression, realms and private friend-world hosting remain larger unfinished systems; consult the master checklist before claiming them implemented.
- Cross-device atlas synchronization and private-world chart identity. Local durable IndexedDB chart history is implemented.

## Art and release constraints

- External uploaded packs still lack a verified creator/reuse license. “Free package” alone does not establish redistribution/commercial rights. Continue using original procedural art and repository assets with recorded provenance until verified.
- Review new assets at actual gameplay sizes, all facings, animation extremes and reduced motion. Avoid new persistent HUD panels; keep instructions in Journal or the appropriate modal.
- Each next feature needs real solo/multiplayer persistence and gameplay proof, relevant tests/typechecks/builds, inline review (no subagents), and verified integration. Do not mark the entire master overhaul complete from a finished slice.
