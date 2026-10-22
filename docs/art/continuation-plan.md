# Equipment, wilderness and quantum art continuation

Continue the approved medieval isometric direction in the existing browser game, without subagents, dependencies, terrain-ID changes or save migrations.

- [x] Held equipment: sword, crossbow and five elemental staves, eight directions, shared hand anchors, distinct shooting/casting poses, synchronized remote equipment. Test pose bounds, equipment changes and two-client presentation.
- [x] Wilderness: sparse, deterministic fallen wood, shore debris and cave formations through the existing chunk object renderer. Decorative details must disappear on edited/occupied ground and never introduce collision or obstruct interaction. Test placement, negative coordinates, boundaries and removal.
- [x] Quantum art: replace checkerboard crop flicker with coherent double silhouettes; improve projected shrine stonework, orbiting resonance and rune details. Keep reduced-motion frames stable and quantum palette indices unchanged. Inspect both facings and animation bounds in Artlab.
- [x] Verify: all workspace tests/typechecks, both builds, art galleries, mobile landscape, solo persistence and multiplayer equipment/combat checks. Record exact results and remaining scope.

Functional upper floors require a separate coordinated change to authoritative floor state, stairs, collision, visibility, NPC schedules and persistence. Decorative stairs will not be presented as functional floors. Physical-device performance and external asset licence checks require access unavailable in this browser-only workspace.
