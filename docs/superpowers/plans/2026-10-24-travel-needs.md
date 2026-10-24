# Travel needs implementation plan

Continue the approved master backlog inline, without subagents or repeated permission requests.

Goal: a complete opt-in hunger/thirst loop using existing food, crafting, wells, persistence and private profile/HUD. Existing/new characters default Cozy; Adventure enables slow online-only depletion, greater exertion/desert water use, non-lethal exhaustion and real food/water meters. Town wards/death pause needs. Switching modes never refills them. This is a survival foundation, not temperature, injury, purification or Hardcore implementation.

Approach: pure shared validation/depletion rules, JSONB character data through existing serialization, one validated/rate-limited mode command, existing server second tick and item-use paths. Food-class items restore 25 nourishment. A crafted one-drink leather waterskin restores 35 water and swaps full/empty in place; empty skins refill only at a reachable actual well. No random illness, offline catch-up, extra services or replacement simulation.

- [x] Write failing shared tests for legacy defaults/clamps, Cozy/town/dead pause, real-time rates and exertion/climate; server tests for authority, food at full HP, safe well refill/range/reuse and saved needs. Implement through existing rules and run green.
- [x] Add truthful Journal How-to controls/status, opt-in compact food/water HUD meters, item instructions/original waterskin icon, targeting and pack drink actions. Preserve reduced motion, privacy and quiet default HUD.
- [x] Run workspace tests/typechecks, both builds and actual solo/mobile multiplayer mode/refill/consume/reload checks. Inspect desktop/mobile together, fix once if needed, review inline, update continuation/style/master notes and merge after CI.

Acceptance: depletion is about 30 minutes food / 20 minutes water at rest, ×1.25 exertion and ×1.5 desert thirst; 1 HP per 10 seconds at zero stops at 1 HP. Pauses cannot accumulate damage or catch-up. Supply actions remain atomic in the live actor and do not create loot/XP. Need values never come from a client command. Old saves load Cozy/100/100. Mode and fractional meters persist through existing solo/server character data.

The browser loop passed solo desktop and multiplayer mobile before visual review. Batched captures exposed voice overlap with wrapped player names; an added browser assertion reproduced it. One consolidated fix uses native resize observation for ledger-relative voice/toast placement and removes roadmap prose from the player-facing mode description. Final solo desktop and multiplayer landscape confirmation passed, including the geometry assertion; supply use, pause and saved-state checks remained green.

Current checks: client 85, server 222 (including the added legacy load case), shared 146; typechecks, both builds and final browser loops passed. The earlier workspace command passed 452 before the extra legacy test. CI/merge evidence is recorded in CONTINUE_HERE.md.
