# Weapon field guide implementation plan

Goal: finish the next progression/pack backlog item with truthful before/after attack comparisons. Work inline; no subagents or approval detour (the user has authorized autonomous continuation and merge).

Architecture: retain shared combat definitions, server validation and existing pack. Extract existing numeric damage/power/cooldown/quick-bar bonus and equipment-level rules into pure shared helpers consumed by authority and previews. Add one client model and a pack-only semantic comparison table. Preserve bronze/ink/parchment materials and quiet gameplay.

Approaches: tooltip-only prose cannot compare a real swap; an interactive combat simulator would duplicate enemy/state rules. Chosen approach is a field guide comparing declared unbuffed attacks before armour/critical/element/class effects, with actual stat bonuses, heal/slow/volley details and explicit independent recovery timers. No DPS claims or combat balance changes.

- [x] Tests first: shared numeric/requirement/quick-bar rules; client focus replacement, forged sword placement/swap, morph forms, ranged volleys, healing and purity. Run red, extract authority helpers, implement model, run green.
- [x] Integrate comparison into pack and show exact level requirements, disabling unavailable gear actions. Preserve server rejection, ring selection, sorting and actual item identity; do not add HUD chrome. Notify existing Profile readers of public-state level changes, without claiming private PROFILE data is loaded. Explain charge stages and the global quick-bar sword rule. Preserve selected item, focus and scroll on live profile updates.
- [x] Browser proof on solo desktop and multiplayer mobile, including real equip/unequip/stat changes, locks, sword moves, heal and morph profiles, no unintended inventory mutation and no page errors. Inspect desktop/mobile together, fix once if needed. Run workspace tests/typechecks, both builds, review inline, record limits and merge after CI.

Review focus: quick-bar replacement can remove the strongest sword; Focus attacks must remain after adding a sword; healing is not damage; morphology is a random choice, not cumulative; bolt count is not guaranteed combined damage; haste alters weapon cooldown only, not shared swing recovery. Cover these in model/rule tests and real pack actions.

The first browser run reproduced a stale level lock; a failing Profile notification test now pins that correction. The mobile dev server needed a forced restart to drop stale shared exports. Initial batched visual inspection found unused space beside narrow comparisons; one consolidated layout pass makes selected details span the whole pack and omits zero-damage text for healing-only attacks. Final solo desktop and multiplayer mobile confirmation passed after that single visual fix batch.

Local proof: current client suite 83, server suite 218, shared suite 143; workspace typechecks, both builds and final browser fixtures passed. CI and merge status are recorded in CONTINUE_HERE.md.
