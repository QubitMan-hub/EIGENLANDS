# Circuit workshop implementation plan

Execute inline. Spec: ../specs/2026-10-23-circuit-workshop-design.md.

- [x] Add pure pattern application, using existing removeAt/placeGate/checkBoard. First reproduce missing behavior in tests. Check scarce tokens, links, locked orbs, rune/ability preservation, immutable source, ideal outcomes and locked previews.
- [x] Add Guides with selected orb/pattern, review comparison, explicit draft application and discoverable Board navigation. Connect gamepad tab cycling and draft/progress updates.
- [x] Add shared-constant path milestones and chosen-class detail disclosure. Refine Board styles into the existing material system, preserving crystal/rail hues and native control affordances.
- [x] Inspect desktop and mobile together; one consolidated fix pass. Verify real solo/multiplayer edit–Attune–cast/reload, keyboard, path and codex, blocked patterns, draft cancellation and no automatic network writes.
- [x] Run relevant tests, workspace typechecking/tests and both builds. Review inline, document exact limits/results, push/attach PR, wait for CI and merge under existing authorization.

Review focus: link source outside selected orb; exhausted shared gate tokens; pending Attune and partial progress; keyboard rerender focus; small landscape scrolling and expert/reduced-motion states.

Inline review checked gate accounting, incoming Links, immutable edits, whole-board validation, saved/pending lock previews, duplicate server writes, focus restoration, gamepad tab indexing and responsive window constraints. Corrected accessible tab names and window sizing conflicts. No subagents used. Pure pattern tests first failed on the missing implementation and then passed (5 checks); all 75 client tests passed. Both final builds/typechecking and final solo/multiplayer browser fixtures passed, including real specialization and second-path choices. Workspace test/CI/merge status is recorded in CONTINUE_HERE.md.

Completed: all 428 workspace tests, typechecking and both builds passed locally. PR #11 merged at bc6aa83a4c5eb816f1a0402c6862bea4300e8ab2 after both CI runs (40003646925 push, 40003654461 PR) passed. Final solo/multiplayer fixtures also proved server-confirmed level-10 specialization and level-30 second-path choices. Main integration is complete.
