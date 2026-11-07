# Defensive combat techniques

Added 2026-11-06. These rules build on the existing combos, charged heavies, dodge cancels, perfect dodges and critical counters. Inspiration: timed defense and posture pressure from Sekiro, directional defense from Zelda, and responsive offensive/defensive handoffs from Hades. Implemented in Eigenlands' own stamina and three-hit combat system.

## Controls and techniques

Updated 2026-11-07: the mouse now splits attack and defence. **Right click attacks** (tap for the three-hit combo, hold to charge a heavy), **hold left click to block, let go to parry**. Ctrl (rebindable), gamepad R3 and the touch Guard button work the same way as left click. Mouse movement mode steers with the middle button.

- **Guard (block):** hold left click / Ctrl. Move at 45% speed and face aim. Guard cancels held charging and queued strikes; it becomes available after attack recovery. Holding guard never parries.
- **Parry (release):** letting go of guard opens a parry window of 180 ms (up to 280 ms with a shield). A frontal hit in that window costs 12 stamina (less with a shield), prevents damage, and briefly interrupts a melee attacker (0.8 s ordinary foes, 0.15 s bosses). Releasing again within 0.7 s does not reopen the window, so tapping cannot chain parries. A quick tap of left click is a parry on its own.
- **Riposte:** attack within 0.9 s after a successful parry. Consumes the existing critical-counter window once. Uses the existing weapon's attack, damage timing, feedback and crit rules.
- **Sustained block:** frontal hits while guard is held cost 18 + 8 × attack weight stamina and deal 25% raw damage before existing armour/ability mitigation. Holding guard also drains 8 stamina per second and prevents regeneration.
- **Guard break:** a hit with insufficient stamina drains the remainder, lowers guard, clears queued offense, and imposes 0.6 s attack recovery and a 1.1 s guard lockout. Dodge still provides an escape if a charge remains.
- **Projectile deflection:** a well-timed frontal parry prevents projectile damage; it does not reflect the projectile or stun a distant shooter. A held block (bare or shielded) softens a projectile like a melee blow.

Rear hits bypass defence. Without a shield, crushing attacks (weight 3+) also bypass it. Boats, minecarts and mounts cannot guard. Guard interrupts fishing. Dodge overrides guard, preserving directional evasions and dodge resource costs.

### What is in your hand (`shared/src/hands.ts`)

You fight with the item in the selected quick-bar slot, not whatever happens to be equipped:

| In hand                           | Fights as                                                                    | Damage                                   |
| --------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------- |
| a weapon                          | that weapon (melee family, or its shots)                                     | full                                     |
| the starting sword                | the sword, or the equipped weapon if one is equipped (it replaces the sword) | full                                     |
| axe / pickaxe / hoe               | battle-axe / warhammer / spear moves                                         | 55% / 50% / 40% at tier 1, more per tier |
| rod / net / watering can          | spear / dagger / dagger moves                                                | about a quarter                          |
| an empty slot                     | the equipped weapon, or bare fists (dagger moves)                            | full / 45%                               |
| food, materials, seeds, furniture | nothing: the attack does nothing and a hint says to put it away              | —                                        |

The character is drawn holding exactly that item: no blade appears out of an empty hand.

### Shields and the off hand

An equipped shield is used when the main hand leaves the off hand free: one-handed weapons (sword, dagger), most tools (axe, pickaxe, net, can) and bare fists. Two-handed grips (spear, battle-axe, warhammer, greatsword, crossbow, longbow, every staff, the hoe and the rod) put the shield on the back, where it gives only its armour bonus. Shield guard strength is 0.55 + 6 × the shield's `def`, capped at 1 (a wooden shield is 0.73; most metal shields are 1). At full strength:

- the guard covers about 90° either side of facing instead of 70°;
- the parry window is 100 ms longer;
- block and parry stamina costs fall by 40%;
- a blocked blow deals 10% of its damage instead of 25%;
- a crushing (weight 3) blow can be blocked, though never parried.

The shield keeps its worn `def` bonus either way.

## Art and integration

A dedicated append-only guard clip (198–205) gives a wide planted stance and raised defensive hands, with IK and grips from the shared body skeleton. The parry clip (238–245, also append-only) snaps the shield (or the blade) outward and returns to guard; it plays for 260 ms whenever the window opens, locally from the predicted sim and for other players from snapshot flag bit 9. A clean parry also throws sparks beside the ring and "PARRY · RIPOSTE!" label. Existing frame IDs remain intact. Both bodies and all eight directions use the same clips. Settings and Journal list the bindings; the touch button has its own placement. Gamepad R3 replaces one duplicate ultimate binding; L3 still triggers ultimate and shoulder hotbar cycling remains intact.

Shields are drawn by `client/src/art/shields.ts` from the skeleton's left wrist at every facing and frame. The board (round for bucklers, a heater shape otherwise) is a flat plate in body space, projected by the body's own iso frame. At rest it is carried on the forearm facing forward and out; in guard and parry it turns to face the blow. It is drawn over the body when it is nearer the camera than the chest at the same height, and behind it otherwise, so it shows on the near side and is hidden behind the body on the far side. Colours come from the item icon, stepped within their palette ramp; the back of the board is wood with a strap. Other players' shields come from the appended `PlayerState.shield` field, which is empty when their grip is two-handed.

Shared simulation owns guard timing, stamina drain and input cancellation. Server damage authority resolves facing, stamina costs, parries, chip damage and breaks. Binary ACK includes guard/parry/cooldown state; player snapshot flags expand to uint16 for remote guard poses. Client and server must be updated together; existing browser sessions should reload for the new wire format. No save migration is needed.

## Verification and limits

2026-11-07 (hands, shields, release-to-parry):

- `shared/test/hands.test.ts` covers what each item fights as, tool tiers, fists, the equipped weapon replacing the sword, one-handed grips for shields, and food not attacking. `shared/test/defense.test.ts` covers hold-to-block, release-to-parry, no window chaining, and the shield's arc, parry length, stamina cost, damage share and crushing blows.
- `server/test/melee-arsenal.test.ts` checks against the real server: a tool hits softer than the sword, fibre in hand does no damage, and the replicated `held` is empty.
- `client/test/mouse-controls.test.ts` covers right-click attack and charge, left-click guard, middle-button steering, armed-skill confirmation, and a mining click not raising guard.
- `e2e/offhand.mjs` passed against the solo dev build. It equips a wooden shield, holds and releases the real left mouse button (guard frame 202, then the parry window opens with parry frame 238), right-clicks an attack, and right-clicks with seeds in hand without attacking. No page errors. Screenshots go to `test-results/offhand`.
- The spritelab review board (`labs/spritelab.html?lab=review`) shows sword and shield in 8 facings at rest, the guard, and the parry clip.

Earlier (2026-11-06, guard and timed parry):

- 34 shared checks passed: defense, action flow and combat; includes timed/repeated parries, rear/crushing bypass, breaks, charge/dodge priority, riposte consumption and ACK round trip.
- Existing live server combat suite: 12 passed (combos, dodge, charge, enemy encounters and projectiles).
- 14 focused server checks passed: direct authority parry/deflection and existing fishing interruption tests.
- 13 client checks passed: directional action clips, input reset and combat presentation.
- Workspace typechecking and production solo build passed. Targeted ESLint and whitespace checks passed.
- `e2e/guard.mjs` passed against the built browser game: actual Ctrl input, dedicated painted guard frame, stamina drain, parry expiry and dodge/release handoff; no page errors. Screenshot/report under ignored `test-results/guard`. Re-run on 2026-11-07 against the solo dev build after the release-to-parry change: still passes (holding guard never opens a parry window).

Direct authority fixtures verify damage prevention and melee interruption; this does not replace full encounter and network-latency playtesting. Sustained-block values, shield strength, tool damage, boss parry timing and crowd pressure need wider balance playtests. Not built: projectile reflection off a shield, shield bashes as an attack, grab attacks, multiplayer PvP defences, other off-hand items (torches and lanterns stay in their light slot and are not drawn in hand), and resident NPCs do not yet carry shields.
