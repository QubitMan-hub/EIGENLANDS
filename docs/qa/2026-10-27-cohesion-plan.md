# Gameplay, characters and cohesion pass

Preserve saved appearances, class/item IDs, controls, existing terrain/building assets and the isometric 32×16 projection. Work inline; no unrelated feature expansion.

## Approach

Use the existing modular character system, replacing its small painter with a newly drawn 32×48 character model rather than shipping one uncustomizable hero sheet. Keep native pixel density equal to world props, derive hands and equipment from one joint rig, use explicit ground anchors and cache frames on demand. Extend existing frame families with more keys and bespoke hit, death, dodge and station poses, without changing network/save identity.

Fix measured progression/AI defects before numerical tuning. Avoid raising enemy health to compensate for exploits. Use sight/collision-aware detection, damage and bounded obstacle navigation; keep role-specific tactics and readable windups. Pay farming progress for productive actions rather than reversible seed/water repetition. Base spell riders on actual damage.

## Work and proof

1. Record severity, repro and subsystem in a QA ledger; run early/mid/late browser checkpoints and focused baseline probes.
2. Add failing tests for farming repetition, blocked spell effects, wall attacks and obstacle navigation. Fix at authority/shared movement layers, preserving budgets.
3. Replace all player and resident drawing with a consistent original model, all supported appearances and eight facings. Integrate equipment, portraits, labels, mounts and labs with shared dimensions/anchors.
4. Finish supported action families and combat/hurt/death/transition presentation. Use explicit animation metadata and real confirmed event/state triggers, not arbitrary frame ranges.
5. Re-test progression, builds/bonuses, economy/farming, real bosses, obstacle courses, animation sheets and actual desktop/mobile gameplay. Run types, lint, formatting, appropriate tests and builds; document measured coverage and real limitations.
