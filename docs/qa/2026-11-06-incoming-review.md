# Incoming main review — 2026-11-06

Reviewed and integrated main from `6525e76` through `113b27d` (19 commits). Preserved the pending gathering fixes.

## Incoming scope

- Modular male/female character bodies, shared outfits and poses, character creator fields, statues and calibrated scale. See `CHARACTERS.md`; code in `client/src/art/body` replaces both old painters.
- Creature outlines and baked bestiary art, livestock/saddle layers and removal of indiscriminate enemy water glows.
- Realm graph connectivity/themes; shadow exchange, domain and guardian traits; ranked dungeon gates and dusk breaks.
- Diseases/remedies, star-shard recipes, bounty beasts/boards, hireling equipment, cottage families and farmyard scenery.
- Multi-floor Sunken Vault puzzle, boss, statue riddle and rewards; roof geometry correction.

## Confirmed fixes

- Sprite-frame borders could replace existing dark ink with lighter outline pixels. Keep darker existing ink. Updated outdated tests to the intentionally external outline while checking original interior pixels and protected glow remain untouched.
- Server appearance save/load fixture omitted the newly required `body` and `cut` fields, breaking server typechecking. Added explicit defaults.
- Pending gathering work: tool reach, inventory and cooldown are rechecked after chunk loading; queued requests cannot bypass cooldown. Tool reach/life/ownership are rechecked after construction yields.
- Pending fishing work: retain hooked water coordinates and cancel the reeling session on range/combat/transport interruption or expiry, including reward-time validation.

## Verification

- Workspace typecheck: client/shared passed; server initially failed at the appearance fixture and passed after correction.
- Client suite: 194 tests passed initially; three outline tests failed. After repair all five outline tests passed. Other client files were unchanged after that run.
- Shared suite: 350 passed.
- Focused server integration: 55 passed across gates, shadows, realms, survival, realism, deeper crypts, wonders, farming, fishing and deferred tool handoffs.
- Appearance persistence: four tests passed after fixture update.
- Production solo build passed; targeted ESLint and diff whitespace checks passed.
- Inspected the committed character review board for scale, directional outfits, action poses and statue integration. This is static visual inspection, not a fresh browser playthrough.

## Remaining limitations

- Shadow-domain integration emits `trying to encode "NaN" in EnemyState#poise` despite passing. Root cause is not isolated; investigate before treating the integration as warning-free.
- `CHARACTERS.md` explicitly leaves facial expressions, mounted straddle pose, separate reel/landing poses, per-item garment detail, individual animal remodels and world-art restyling unfinished.
- All 272 changed files were inventoried; focused source review and automated checks do not prove every encounter, new art frame, multiplayer flow or performance condition in gameplay.
