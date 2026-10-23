# Durable exploration history implementation plan

> Execute inline with superpowers:executing-plans. The user prohibits subagents and has authorized implementation and integration.

**Goal:** Preserve explored terrain beyond the atlas's 512 resident pages.
**Architecture:** IndexedDB stores individual chart pages and compact discovery masks, isolated by existing account and seed keys. Only changed cells are merged in read/write transactions. The existing localStorage chart remains a bounded recovery snapshot; the renderer loads archived pages on demand without generating terrain.
**Tech stack:** TypeScript, native IndexedDB, existing Canvas atlas, Vitest and Playwright.
**Spec:** Existing atlas continuation in docs/CONTINUE_HERE.md and the user's ongoing overhaul request.

## Constraints and review focus
- No new dependencies, no HUD panels, no terrain generation from map reads.
- Preserve fog and the four coordinate planes; archived discovery must still resolve quest locations.
- Async reads must not replace newly visited/edited cells; concurrent transactions merge exploration.
- Bounded resident/raster caches and pending writes; failed persistence remains visible and retryable.
- Account deletion must await archive erasure and stop pending writes; keys remain account+seed until private-world IDs exist.
- Browser storage remains local, quota-limited and user-clearable; this is not cloud backup.

## Tasks
- [x] Extend model with validated page merging and changed-cell notifications; test unknown cells, edits, eviction and malformed records.
- [x] Implement features/atlas/archive.ts with atomic page/mask writes, compact discovery index, bounded queue, retries, lazy reads and account erasure.
- [x] Connect atlas lifecycle, discovery, viewport reads, recovery snapshots and deletion in main.ts; update atlas copy.
- [x] Add real IndexedDB browser checks for >512 pages, migration/reload, overlapping writes, identity isolation, failure/retry and deletion; exercise solo and multiplayer.
- [ ] Run workspace tests/typechecks, both builds, relevant atlas regressions; review diff and document results and remaining scope. Push PR, await CI and merge when verified.

## Execution evidence

Model regressions first failed (missing changed-cell notifications and merge), then passed. Workspace tests passed 423/423, typechecks and both builds passed. Real Chromium solo and multiplayer checked 624 discovered pages with 512 resident pages, old-page reload without generation, fog, concurrent writers, legacy/recovery replay, transaction failure/retry, identity isolation and erasure. Landscape atlas regression and general solo persistence/takeover/deletion/fresh-start passed with no console problems. Final expanded browser confirmation and CI are tracked in CONTINUE_HERE.md.

Inline review: checked transaction ordering, write acknowledgements, asynchronous reads versus new observations, pending/cache bounds, deletion races, namespace ranges, map projection/culling and quiet mobile layout. Corrected replay of stale migrated snapshots, recovery acknowledgement cleanup and viewport scanning cost during implementation. No subagents used; push/merge authorization was already supplied by the user.
