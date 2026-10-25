# Player Construction Implementation Plan

Execute inline with the existing authorized workflow; no subagents.

**Goal:** Craft and place modular, owned, furnished two-floor houses with real collision, roofs and usable stairs.
**Architecture:** Separate persisted structural cells compose into ChunkStore terrain/collision; ordinary WorldObj furniture remains independent. Existing chunk/OBJ replication, local IndexedDB repo and shared upper-floor coordinates are reused.
**Tech stack:** TypeScript, PixiJS, existing isokit, PostgreSQL and local repositories.
**Spec:** ../specs/2026-10-24-player-construction-design.md

## Global constraints

No subagents, imported artwork, dependencies, replacement simulation or destructive save migration. Native 32×16 tiles. Preserve existing controls and accessibility.

## Review focus

Foreign edits and authored towns; cross-chunk reload; full inventory/refund atomicity; blocked/occupied stair exits; floor removal stranding visitors; source-of-truth collision matching the client; furniture under roofs; unloaded upper cells; reduced motion and culling.

- [x] Shared model: add construction item/cell types and structural composition in ChunkStore; red/green geometry, cell validation and collision tests. Keep normal object keys intact.
- [x] Persistence/transport: additive construction-cell table, server/local repo support, ObjectManager structural indexing and typed deletion, OBJ/chunk handling. Test normal furniture coexisting with structure, retry preservation reviewed, reload and cross-chunk boundaries.
- [x] Authoritative construction: craftable pieces; placement, support/reach/owner/town checks, doors, stairs, safe owner-only removal/refunds and upper exit connectivity. Real two-client tests and save/rejoin.
- [x] Rendering: cached original isokit floor/wall/roof/stair geometry, chunk/view culling and connected-interior cutaway. Terrain invalidation and shared prediction collision. Review art lab, ordinary town regression and roof/furniture layering.
- [x] Controls: conditional accessible rotation and placement feedback, normal hotbar/Pack crafting and Journal guide. Real solo/multiplayer browser build/use/remove/reload, landscape and reduced-motion checks.
- [x] Full tests, typechecks, both builds, inline diff review; update remaining-work and art notes. Push/PR/attach, wait for final CI, merge under persistent authorization (integration status in CONTINUE_HERE.md).
