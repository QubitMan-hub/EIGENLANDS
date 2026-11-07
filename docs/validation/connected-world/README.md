# Connected world validation

Generation 7 extends the existing isometric pixel-art world. New worlds use this revision; saved revisions remain pinned. The regression fixture verifies revision-6 frontier tiles, elevation, climate and biomes against the pre-change SHA-256 digest, including alternating revision-6/7 cache access.

## Settlement samples

The [generation report](generation-report.json) contains 15 actual frontier layouts: all five tiers for seeds 42, 20260101 and 987654.

| Tier            | Plot size | Buildings in samples | Scheduled residents | Ambient actor ceiling | Defenses                            |
| --------------- | --------- | -------------------- | ------------------- | --------------------- | ----------------------------------- |
| Village         | 64 × 52   | 8–10                 | 6                   | 22                    | Open agricultural settlement        |
| Town            | 96 × 76   | 13–16                | 12                  | 32                    | Palisade/gates, 2 guards            |
| Medium town     | 136 × 104 | 37–40                | 22                  | 46                    | Walls, 4 towers, 4 guards           |
| Big town        | 176 × 132 | 59–64                | 36                  | 62                    | Districts, 12 towers, 7 guards      |
| Kingdom capital | 224 × 168 | 79–86                | 54                  | 80                    | Castle/palace, 16 towers, 12 guards |

Architecture follows the six existing kingdom cultures. Housing scale, street pitch, lanes, manors, market/service provision, districts, defenses and reserved farmland depend on tier. The sampled layouts contain 204, 288–300, 550–560, 765 and 1,218 tilled tiles respectively. Provincial capitals have a subordinate farming village and trading town, linked by three-tile roads. The six named kingdoms retain their capitals and twelve subordinate plots each.

Cold settlement generation in this environment took at most 108.8 ms among the 15 samples; cached lookup took at most 0.060 ms. These are Node CPU measurements, not a browser frame-rate guarantee. Frontier town caches retain 16 entries; discovery remains regional. Authoritative frontier populations are limited to four nearby settlements and 192 residents per room, checked every two seconds. Unseen residents advance their schedules without running long path searches. Nearby decorative populations have separate per-tier ceilings.

## Behavioral checks

- Multi-seed object-aware flood fills verify building approaches and every named routine spot. Additional tests cover all six cultural architectures at all five tiers across two seeds.
- Real `ChunkStore` routes connect three seeded capitals to both subordinate settlements, including actual road tiles, elevation and solid props.
- Surface provinces are excluded from reserved otherworld, crypt and dungeon planes; legacy placement remains unchanged.
- The production `GameRoom.makeVillage` factory is exercised without opening sockets: expanded named rosters, frontier-only shards and adjacent-shard ownership are covered.
- Village tests simulate a full day, road preference, blocked-route recovery, conversations, shops, weather shelter and festival attendance.
- Animal navigation tests prove obstacle detours and replanning after a new obstruction. Routine and habitat tests cover shelter, sleep, roosting, seasonal insects and climate.
- Cave tests cover geology-dependent guardians and hazards, including a guardian finding reachable floor beside a solid vent landmark and warnings before hazardous pulses.
- Realm tests cover connected habitat patches, suitable creatures/resources, readable route clues, legacy stability and flood-filled routes across three seeds and all three realms, including protected puzzle gates and safe arrivals.
- Local discovery tests cover environmental eligibility, personal rewards, full-pack retry, persisted daily claims, stale or forged interactions, cleanup limits and generated resident friendship persistence.

## Main integration verification

Integrated from `origin/codex/connected-world-biodiversity` (`afff999`) without dropping main's newer body, wardrobe, camera, riding, ore, shadow or town-scene work. Conflict resolution preserves telegraphed bounty signatures and one wolf-pack call, while adding local discoveries.

Focused checks passed: 48 shared tests covering generation-7 tiers, legacy revision stability, connectivity, local ecology/finds, otherworlds and hydrology; 37 server tests covering local finds, hazards/encounters, residents/schedules/shops, configuration, appearance persistence and bounties. Client checks cover art, routes, loaded-boundary sampling, population cleanup, complete-scene retirement, scenery and existing ground anchors. Server tests used the supported browser-storage adapters; this pass did not require PostgreSQL.

The fresh production solo browser run verifies generation 7, actual teleport arrival on open terrain, a medium town within its ambient ceiling, authoritative residents, moving wildlife with unflipped scales and consistent pivots, the two-raster-per-frame ceiling and zero page errors. [Browser report](browser-report.json), [town](town-gameplay.png), [wildlife](wildlife-gameplay.png). Asset review sheets are [here](../biodiversity/README.md).

Production build, typecheck and targeted lint passed. The existing large-bundle advisory remains. These are focused integration checks, not a full game completion claim, a real old-save browser migration trial, a full boss/combat playthrough, or multiplayer/phone frame-rate measurements. Saved revisions remain pinned; revision-6 stability is covered by the deterministic regression fixture.
