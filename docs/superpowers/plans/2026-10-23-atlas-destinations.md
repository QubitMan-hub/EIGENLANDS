# Atlas quest and party destinations

Continue inline without subagents. Keep the world HUD quiet and reuse the existing private profile, authorized party messages and atlas projection.

- [x] Test destination resolution: active objectives, inventory-based hand-in readiness, completed quests, fog, known homes versus current NPCs, authorized party membership and invalid/offline positions.
- [x] Add collapsible quest and party directories inside the full atlas. Resolve current NPC positions or explicitly labelled discovered homes; never invent resource/enemy coordinates. Mark only discovered quest destinations. Party positions are a distinct, explicitly labelled exception to terrain fog, using existing authorized messages; they reveal no terrain.
- [x] Refresh through the existing frame without replacing focused controls on position updates. Clear party entries on leave and persist only marker preferences, not other players' positions.
- [x] Run unit/type/build checks and desktop/mobile, solo/multiplayer browser checks. Inspect screenshots in one batch, correct issues, confirm.
- [ ] Update continuation/design/remaining-work notes, self-review inline and merge after CI under existing authorization.

Separate follow-up: asynchronous durable chart storage beyond 512 pages, cross-device sync, private-world chart identities, pathfinding, undiscovered quest coordinates, and new quest content.

Six new destination tests cover resolution and privacy. Extended the existing native-input regression: SUMMARY initially failed Space/Enter handling; the input guard now allows native activation, and modal focus enumeration includes summaries. Tests limit software-browser drawing to 10 FPS; the first client pauses drawing only while the second logs in. Both run during cross-shard navigation. This is functional/layout evidence, not a hardware performance benchmark. Screenshot QA found stretched empty sections on mobile and a label covering the centered party marker; one consolidated layout correction and confirmation addressed them. Self-review also moved destination markers above ordinary actor markers.

Local evidence: 421 workspace tests, final 68-client rerun, workspace typechecks and both production variants passed. New desktop/landscape destinations passed in solo and multiplayer; a real cross-shard party passed authorization, live centering/focus, hidden terrain, offline/leave and persisted filter checks. Final native summary activation passed in solo. Existing landscape atlas and general solo persistence/takeover/deletion passed. Final multiplayer confirmation and CI/integration remain pending.
