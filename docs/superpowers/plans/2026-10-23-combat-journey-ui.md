# Combat information and Journal journey

Continue inline without subagents. Preserve the quiet HUD, authoritative combat, shared progression data, saves, solo/server parity and reduced motion.

- [x] Test health normalization and boss selection/phase boundaries before implementation.
- [x] Reuse a compact health meter for selected targets and boss encounters; reset damage trails on identity changes, expose numeric accessible health, label real poise and remove invented enemy levels.
- [x] Select nearby/selected bosses correctly, rebuild phase ticks per identity and avoid duplicate boss/target chrome. Keep panels clear of mobile controls and hidden behind dialogs.
- [x] Add a Journal Journey page with real level/XP, class/spec/second path, owned gates/runes/orbs, shared unlock milestones and actual boss summoning requirements. Refresh visible data through the existing game frame; no new timer or persistence.
- [x] Exercise desktop/mobile together, consolidate fixes, confirm once; run focused and workspace checks, builds and relevant solo/multiplayer browser tests.
- [x] Update continuation/design/master notes and self-review inline.
- [ ] Merge after CI under existing authorization.

Not this slice: new combat rules, invented enemy threat levels, undisclosed boss victory records, survival, kingdoms or companions.

Evidence: 62 client tests (7 new regressions), workspace types and both builds passed. Actual solo/multiplayer summons, item consumption, scaled health and ordinary/boss selection passed separately from paused-world presentation fixtures. Journal live level updates, Board navigation, keyboard reading, health/poise semantics, phase thresholds, identity reset, modal suppression and 844×390 / 568×320 bounds passed. Solo persistence/takeover/deletion passed. The runtime restarted during validation; source survived and interrupted checks were rerun. Production builds omit labs; --labs checks the developer UI lab via Vite. No hardware performance claim or boss victory history was invented.
