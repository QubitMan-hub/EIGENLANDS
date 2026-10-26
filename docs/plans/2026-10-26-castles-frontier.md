# Castles, furnished frontier cities and travel fixes

Use the existing 2:1 world-space building/prop painters; reference images supply architectural ideas, not imported pixels. Preserve the six kingdom palettes and existing controls. Work without subagents.

1. Fix dialogue's obsolete theme selector. Prove readable text in the real conversation UI.
2. Reproduce reverse collision displacement and prevent collision clipping from reversing the requested axis. Defer cold scenery chunk bakes while the background worker is pending; preserve collision authority and fallback without workers. Check streaming movement and reconciliation.
3. Add round/battlement/archer tower and keep silhouettes, kingdom-specific keep details, timber/stone domestic subsets and appropriate furnishing using existing geometry and objects. Preserve existing footprints.
4. Add revision 6 for new worlds: bounded, deterministic regional settlement discovery throughout the surface world. Keep revisions 1–5 frozen. Reuse the realm town builder, furnish every building and keep doors/paths clear. Stream distant buildings and static objects into existing render/collision systems; record discovered settlements on the atlas. Avoid a global array of infinitely many towns.
5. Validate determinism, saved-world boundaries, furnishings/door reachability, collision, worker parity, browser solo and relevant multiplayer paths. Run formatting/lint/types/unit/build/browser checks. Merge only after final-head push and PR CI are green. Document any limits accurately.

Architectural calls: use authored procedural geometry rather than mixing reference sprite packs; use lazy regional discovery rather than multiplying fixed capitals; do not migrate existing worlds into new city plots automatically. Interactive NPC shops are retained in the existing kingdoms; new frontier population should use existing systems where feasible and be documented precisely.
