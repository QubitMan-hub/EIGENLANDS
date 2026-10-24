# Gathering, combat and interior polish

Work inline, no agents. Reuse the existing intent/USE, fixed simulation, enemy telegraphs, prop projection, hand rig and modal system. User requested implementation in one pass.

- Extend click intent to axe/tree/stump, forage/ripe harvest and selected hoe/can actions, preserving single-target completion/cancellation and server authority.
- Make Dodge a finite combat resource: two charges, four seconds per sequential recharge; preserve dash travel and perfect-dodge timing.
- Rod selected + Space at a shore chooses nearby valid water without requiring a cursor target. Preserve bite/hook and existing fishing minigame.
- Center and contain statue reading/navigation on desktop and phone.
- Align held items exactly with animated hands, keep idle tool heads clear of faces, expose the grip and remove the watering can's inappropriate shaft. Redraw the bed's stacked 2:1 geometry.
- Generate town stairs at back corners with a reserved landing and reversible upper link; keep furnished rooms reachable and player-placed stairs player-controlled.
- Add Reed Stalker (wait, leap, disengage) and Cinder Moth (orbit, ranged windup, retreat) with original baked animated sprites and low biome weights inside existing population budgets.
- Run focused regression tests, full workspace tests/typechecks/builds, actual solo/multiplayer gathering/fishing/dodge/interior/lore/enemy browser checks, then final-head CI and merge under existing authorization. Document remaining physical-device/art scope honestly.
