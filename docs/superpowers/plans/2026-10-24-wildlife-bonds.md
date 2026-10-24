# Wildlife bonds implementation plan

Implement inline under the approved overhaul; no subagents or repeated approval gates.

Goal: three tameable wildlife companions with original bond identities, natural existing critter art, real following/progression/support and durable solo/server saves. Reuse ShadowModule roster, slots, stance, reform and persistence; level 5 unlock, one bonded animal per species. No new service/dependency, external assets, recruitment or travelling merchant claims.

Design: suitable forage buys a deterministic bond with a healthy, unprovoked nearby animal (range 4, clear ground line, level no higher than player). Server chooses and consumes exact food across stacks only after all checks. Remove the live wild animal without kill/drop/XP/residue. A failed/duplicate/stale command consumes nothing. Brambleback boar: 3 hazelnuts, charge knockback +2. Mossburrow badger: 2 mushrooms, bite slows for 2 seconds using existing slow. Glimmerhart deer: 3 blackberries, noncombat support heals owner 2 HP every 12 seconds when nearby, safely out of combat and ashore. Support timers never catch up offline. Bonded records retain a validated optional marker; existing shadow/escort records retain their meaning. Shared kind validation only admits passive deer when bonded.

- [x] Shared catalog and validation: red/green tests pin foods, valid species and progression compatibility.
- [x] Server: real-message tests pin food atomicity, no kill rewards, authority/range/walls/health/provocation/roster/slots, one-per-species, unique support, follow and save/rejoin. Implement through existing module.
- [x] Client: nearby visible wildlife and explicit food offer inside Companions & Echoes; preserve roster reading/focus on updates. Show original creature thumbnails, bond trait and truthful status; retain vanilla shadows/escorts. Natural sprite palette and quiet warm marker; no new HUD. Test/render actual sprite flags.
- [x] Verify full tests/typechecks/both builds, solo desktop and multiplayer landscape real taming/commands/reload and bounds; batched visual review, one fix and final confirmation if needed. Inline diff review, update continuation/master/style notes, push PR and merge after final-head CI.

Review risks: two players offer to same animal (single synchronous commit); food split across slots (exact removal); wall or coordinate-layer abuse (owned target/range/line); old/invalid saved bond (strict validation); deer accidentally attacks/flees from owner, support heals during combat or offline (real simulation tests). Pets reform after falling through the quantum bond; this is explained, not presented as permanent animal death.

Local verification: all 462 tests (86 client, 229 server, 147 shared), typechecks and both builds passed. Actual solo desktop and multiplayer landscape loops passed all three offers, natural sprites, original-sheet portraits, stances/focus/disclosure/scroll, follow, dismiss/summon and saved reload. Red/green covered missing touch Menu access and the existing repeat-charge bug. The progression toast test now waits for actual client delivery instead of racing server state. Desktop/mobile visual review completed with brief notification/warm health adjustments and final mobile confirmation. CI/merge evidence belongs in CONTINUE_HERE.md.

Integration complete: PR #15 squash-merged at `173a763` after both final-head CI runs passed. CONTINUE_HERE.md records exact commit and run IDs. Main synchronized; no subagents.
