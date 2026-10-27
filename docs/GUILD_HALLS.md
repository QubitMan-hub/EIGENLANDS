# Regional guild halls and expedition planning

Guilds now designate existing civic footprints instead of silently sharing generic halls. Capitals use the smaller non-royal hall; towns and frontier settlements use their existing hall, with inn/keep annexes where necessary. Palaces, keeps and shared inn interiors retain their furnishing. Abandoned towns and upstairs rooms no longer issue active guild boards.

Generated hall dressing has a real recovery bed, workbench, briefing tables and oriented seats, storage and restrained lighting. Placement preserves NPC schedule cells, the entrance aisle and stair landings. Board/steward/reception access remains checked. No terrain, footprint, generated door, stair, player-owned object or saved-world revision is replaced. Narrow rooms omit optional fittings when necessary.

Original cached building art gives guild halls a projected compass sign and wall standard. Regional roofs use a lodge gable, grove pavilion, stone bastion, swept dojo, tide dome or steep archive profile. The regular cultural materials, nearest filtering, worker generation and roof cutaways remain.

The ledger sorts ready/accepted commissions first, labels status, shows daily deadlines and coin/XP/item rewards, and offers Track commission / Show on map for accepted work. It uses the existing quest tracker and atlas. The atlas has a collapsed, discovery-gated hall directory including streamed frontier and player boards, with no new HUD. Old payloads without day/town metadata remain valid; unknown definitions are skipped.

A gameplay replay exposed that the persisted buff allowlist discarded `bed_rest`. Its real 24-minute cooldown now survives loading; expired values still disappear. This prevents reconnects from bypassing rest limits.

Focused checks: eighteen capitals across three seeds, reachable board/rest/workbench/stairs, original dining/entrance/path tests, upper/abandoned exclusions, frontier layout/idempotence, fog-safe/deduplicated atlas destinations, live registration/journey/track/map/mobile/rest/workbench and reload. Source art captures twelve day/night regional models and six open interiors. Full-suite/build/CI validation continues with the subsequently requested classes and bestiary batch; screenshots are evidence of this slice, not that larger completion claim.

Still separate: replacement building footprints and arbitrary-height construction; deeper resident government; classes and bestiary expansion (now the active requested batch); authored world-changing campaigns and physical-device/network performance evidence.
