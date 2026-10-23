# Exploration atlas implementation plan

Work inline with executing-plans; no subagents. Continues the approved master request and DESIGN_SYSTEM.md.

Goal: a working saved exploration atlas and live minimap, using only visited terrain and existing game truth.
Architecture: a small client exploration journal stores discovered tiles in bounded chunk records, keyed by account and seed; Canvas 2D renders that journal in the existing window manager and compact minimap. Read already-present chunks only (has before get), never generate terrain for map browsing. Keep surface, cave, upper-room and submerged coordinates separate. Browser storage is local, not a new network authority.
Approach: reuse the existing P34Client hooks and Windows instead of a second game overlay/input/rendering engine. An isometric chart follows the world's projection; pan/zoom/centering and saved waypoints work on discovered ground. Existing entity state supplies nearby actors. Undiscovered towns, quests and future kingdoms/realms must not be invented or revealed.

Constraints: original bronze/ink/parchment UI, 32×16 2:1 projection, no dependencies, mobile landscape and reduced motion, existing custom keys preserved, no server/world-generation changes.
Review focus: negative coordinates and plane isolation; malformed/quota-limited storage; ungenerated chunks; marker privacy; M voice migration and intentionally unbound actions.

- [x] Write failing exploration tests: visited radius, missing chunks, edits, negative coordinates, bounded retention, saved reload and corrupt input.
- [x] Implement journal sampling/serialization and plane helpers; pass those tests.
- [x] Write failing key migration tests, then bind map M and voice N for defaults while retaining explicit/custom bindings; display actual remapped labels.
- [x] Implement the atlas/minimap on existing P34Client hooks, discovered location and nearby actor filters, saved waypoints, accessible zoom/pan/center controls, preferences and keyboard navigation.
- [x] Run focused tests/typecheck/builds; inspect desktop/mobile in one batch, consolidate fixes, confirm once. Exercise solo reload, no generation on map pan, plane changes and multiplayer markers.
- [ ] Update master/design/continuation documentation, self-review, run relevant regression checks, push and merge after CI (already authorized).

Not this slice: kingdom territories, unimplemented named realms, undisclosed quest coordinates, cross-device exploration synchronization or all remaining master features.

Evidence: 405 workspace tests passed; both build variants and typechecking passed. Desktop/landscape map and solo/mobile regression checks passed; two real multiplayer clients exercised charted/unexplored player markers, and a quota failure retained the live chart. Final integration requires PR CI. See CONTINUE_HERE.md for remaining scope and storage limits.
