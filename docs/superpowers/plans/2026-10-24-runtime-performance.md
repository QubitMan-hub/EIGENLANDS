# Runtime performance implementation plan

Continue inline without subagents. Building PR #23 is merged at 8d6ccfac8328685da52357515ffd6dc3866da18c after push/PR CI 40130280508 / 40130311122 passed 507 tests. Rebase this branch onto that merge before its own PR.

Evidence before edits: controlled production-solo touch/DPR2 storm trace in /tmp/perf-baseline/{report,cpu}.json (ephemeral). 55 frames, median350ms, p95 783ms. BuildingViews.update peaked783.5ms, terrain assembly159.3ms; 260 visible rain streaks. Exact software-GPU conditions and limitations are in the report. Preserve actual game logic and quantum/combat telegraphs; never promise a universal 10x gain.

- [x] Bound roof raster rays analytically instead of scanning empty space in half-pixel steps; prove unchanged day/night/wall pixels across six diverse buildings and measure bake times.
- [x] Reduce repeated chunk work: shared bounded climate reuse, lazy/coalesced terrain invalidation, no full sprite rebuild for unchanged snapshots, visible-only renderables, cached structural visibility/profile work. Preserve updated tile/object collision immediately.
- [x] Add saved Auto/Economy/High visual settings and gentle/off/full weather. Auto starts lighter on touch/limited devices; pixel scale, lightweight terrain materials and lower canvas fill cost preserve legibility. Keep actors, inputs and telegraphs responsive independently of ambient detail.
- [x] Inspect and correct actual input/dash/combat timing or queue problems found in traces; don't change combat balance to conceal rendering stalls.
- [x] Repeat the same benchmark, actual solo/multiplayer movement/combat/chunk loops, construction reloads and batched desktop/mobile visual checks. Unit tests, full suite/typechecks/both builds; exact limits and remaining physical-device testing documented.
- [ ] Inline review, accurate remaining-work notes, PR attach attempt, both final-head CI runs then merge under persistent authorization.

Measured cold stalls justified the two single-flight workers described in the report; both reuse existing art/world generators, retain synchronous fallback and have bounded failure timeouts. No dependencies added.
