# Main integration audit — 2026-11-07

Reviewed remote main at `e0b6442` and all three current remote branch tips. There were no open pull requests.

## Integration

- Connected world, procedural settlement tiers, NPC routines/pathing, caves/realms, local discoveries and biodiversity were already integrated through `afff999` and `ddd04e3`. The original local snapshot `3f5076a` is byte-identical to `afff999` (`git diff --exit-code` passes).
- `claude/eloquent-turing-rzp90g` pointed at main. `claude/offhand-shields-parry` was one commit ahead (`8744f93`); that commit is now included by fast-forward, preserving the settlement, construction, danger, art and ecology changes already on main.
- No branch history was rewritten or deleted.

## Issues resolved

1. Bounty beasts could spawn 60 tiles away, but their warning was sent only at spawn to players within 30 tiles. Hunters approaching later missed the warning. Active beasts now warn each approaching account once. A deterministic regression spawns the beast outside warning range, approaches it, checks one warning, then verifies its signature move, reward and daily completion. The warning assertion failed before the fix and passed afterward.
2. The starter encounter test sampled level-three terrain and nighttime while requiring a level-one starter-only pool. It now samples unwarded level-one daylight terrain, retaining species, budget and distant-region checks. No game balance was changed.
3. The garrison test expected a simulation-time reinforcement cooldown to finish inside a six-second wall-clock deadline. It timed out in one full run and passed unchanged in isolation. It now verifies automatic activation, advances normal simulation steps for reinforcements and retains its soldier-count and realm assertions.

## Verification

| Check                                                          | Result                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Full client suite                                              | 62 files, 227 tests passed                                        |
| Full shared suite                                              | 69 files, 417 tests passed                                        |
| Latest full server run, before the garrison fixture correction | 426 passed, one garrison timeout, two infrastructure skips        |
| Final server regression run after all corrections              | 24 passed across `armies`, `wonders`, `combat2` and `local-finds` |
| Workspace typecheck and lint                                   | Passed; changed server files rechecked after the event fix        |
| Multiplayer and solo production builds                         | Passed; solo rebuilt after the event fix                          |
| Changed-file formatting and `git diff --check`                 | Passed                                                            |

The complete server suite was not rerun after the final test-only garrison correction. The affected file and the other corrected event/combat files were rerun together and passed. Server runs used the real browser-storage adapters (`TEST_STORAGE=memory`); PostgreSQL outage-readiness and Redis cluster-bus checks were skipped.

An additional generation-seven layout audit checked 303 settlements across seeds 42 (102), 20260101 (102) and 987654 (99), with zero road, doorway, reachability, facing or furniture-placement issues. The shared suite also covers distinct tiers, multiple cultures/seeds, connected routes and revision-six generation stability.

Production Chromium checks passed:

- Shields were visible with a one-handed sword; hold-to-block, release-to-parry animation, right-click attack and refusal to attack with seeds worked, with no page errors.
- A medium town had 28 authoritative residents and 44 ambient actors within its tier budget. Laundry, gardening, sweeping, pets, woodchopping, children, a busker, porters and a stablehand were active.
- Loaded habitats contained eight moving stoats, voles and robins. Wildlife stayed within its population cap, used consistent headings/anchors and built at most two new raster textures per frame. No page errors occurred.
- Guard, town and wildlife screenshots were reviewed for isometric pixel-art presentation and grounding. Local screenshots and JSON reports are under ignored `test-results/main-integration/`.

The existing large-bundle advisory remains. Software-rendered desktop smoke tests do not establish mobile frame rates or replace a full gameplay/balance playthrough.
