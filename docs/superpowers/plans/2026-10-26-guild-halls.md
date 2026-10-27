# Regional guild halls and expedition ledger

**Goal:** Give guild services a physical home and make accepted work easier to follow.
**Architecture:** Reuse generated civic footprints, existing original building/prop rasterizers, authoritative boards/rest/crafting, the atlas and quest tracking. No new persistence format, dependency, HUD or simulation loop. Work inline without subagents under the user's standing direction.

## Constraints and design

Keep authored art on overlap. Preserve every generated building footprint, doorway, stair and terrain tile, all player-owned objects, cultural roof styles and generation pins. Select a non-palace civic hall, preferring the capital's spare hall; smaller settlements retain an inn annex when necessary. Only generated hall decoration changes. Abandoned towns and upper floors do not gain active guild services. Ground-floor halls get a reception/reading area, restrained storage/lighting, a real rest bed and workbench where space permits. Exterior signs and heraldry must use the existing 2:1 projection and cached textures.

The ledger keeps its current three pages, puts ready/active work first, distinguishes available offers, displays daily expiry and full rewards, and lets an active commission use the existing quest tracker/map. A discovered hall directory belongs inside the atlas; it must not reveal unvisited terrain. No new permanent panel.

## Work

- [ ] Shared layout: failing tests across multiple seeds/capitals/frontier/annex/abandoned/upper towns; then implement metadata and generated furniture, integrate board selection and spatial checks. Assert floor, object-footprint, doorway/stair and access invariants.
- [ ] Original art: projected guild sign/seal and coherent facade details over each culture's existing architecture. Inspect six regional models day/night and their open interiors; retain nearest filtering, worker caching and cutaways.
- [ ] Expedition ledger and atlas: failing destination/filter tests, then discovered-only hall destinations and tracking actions, clear status ordering/expiry/rewards, accessible responsive controls. Preserve server authority and unknown/old payload compatibility.
- [ ] Browser proof: real registration/commission/tracking/rest or workbench interaction, desktop/mobile views, no page errors/overflow; full workspace checks/builds and CI. Update continuation/master plan with exact scope and remaining omissions; integrate incoming main and merge only a verified head.

## Review focus

Saved player edits win over generated decoration; no new footprint or relocation. Narrow halls may skip optional fittings rather than block access. Board/steward approaches and NPC schedule cells remain free. Old panel payloads and unknown quest definitions do not crash the ledger. Atlas destinations stay hidden until visited and never jump between coordinate layers.

Progress: shared layout/destination tests and built gameplay passed. Original dining coverage caught omitted tables; retained two separated side tables and normal stair landings. Reconnect replay caught bed-rest allowlist loss; RED/GREEN save-loading regression and real reload now pass. Regional art inspected once and refined to distinct cultural silhouettes. Remaining whole-suite/CI gates will run with the user-expanded classes/bestiary work. Inline review only under the standing no-subagent instruction.
