# Connected world design

The goal is a cozy adventure whose settlements, inhabitants, caves, other realms, and events follow understandable local rules. Preserve the existing isometric pixel art, browser runtime, deterministic seeds, and saved-world geometry.

## Approach

Extend the existing generators and authoritative systems. Replacing them would discard established kingdom architecture, road networks, cave connectivity, puzzles, services, and persistence. Purely decorative encounters would not satisfy the requested connection between inhabitants and their surroundings.

New settlement geometry belongs to generation 7. Revisions 1–6 stay pinned, including cache isolation and explicit server configuration. Named kingdom identities and IDs remain stable. Procedural frontier settlements gain an explicit five-tier profile: village, town, medium town, big town, kingdom capital. Tier controls footprint, housing/population, services, street layout, defenses, farm provision and districts; kingdom culture still controls architectural style. Capitals retain existing palace/castle generators and subordinate named settlements. Road and entrance accessibility must account for object footprints as well as tiles.

Keep settlement discovery lazy and caches bounded. Scale nearby ambient residents with tier, retaining a hard population cap. Use existing roles, service buildings, work/sleep schedules and road navigation rather than introduce another simulation engine.

Caves and otherworlds retain their proven connected geography. Add local descriptors and useful route clues; use geology and room themes to select hazards, guardians, resources and inhabitants. Any new solid geometry or changed resource placement is revision 7 only. Preserve puzzle gates and safe arrivals.

World events extend the existing authoritative wonder/event system. Local season, weather, biome, cave district or realm room must explain an event's eligibility. Events must have visible, actionable consequences using existing props, interactions, rewards and persistence, and respect existing spawn/reward budgets.

## Proof

Test several seeds for every settlement tier, strict size and population progression, variation within each tier, defenses/services/farms, reachable doors and routes, deterministic locality/encounters, safe arrivals, bounded caches and legacy generation stability. Run relevant shared/client/server tests, typecheck, lint and a production solo build. Full-suite results must distinguish existing failures and environment restrictions. Browser validation needs local socket permissions; record a blocked attempt accurately rather than claim a playtest occurred.
