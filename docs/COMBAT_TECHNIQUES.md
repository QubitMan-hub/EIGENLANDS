# Defensive combat techniques

Added 2026-11-06. These rules build on the existing combos, charged heavies, dodge cancels, perfect dodges and critical counters. Inspiration: timed defense and posture pressure from Sekiro, directional defense from Zelda, and responsive offensive/defensive handoffs from Hades. Implemented in Eigenlands' own stamina and three-hit combat system.

## Controls and techniques

- **Guard:** hold Ctrl (rebindable in Settings), gamepad R3, or the touch Guard button. Move at 45% speed and face aim. Guard cancels held charging and queued strikes; it becomes available after attack recovery. Release Guard to attack.
- **Timed parry:** raise guard within approximately 180 ms before a frontal hit. Costs 12 stamina, prevents damage, and briefly interrupts a melee attacker (0.8 s ordinary foes, 0.15 s bosses). Each raise has a 0.7 s parry cooldown; tapping repeatedly does not renew the window.
- **Riposte:** release Guard and make a melee attack within 0.9 s after a successful parry. Consumes the existing critical-counter window once. Uses the existing weapon's attack, damage timing, feedback and crit rules.
- **Sustained block:** after the timing window, frontal hits cost 18 + 8 × attack weight stamina and deal 25% raw damage before existing armour/ability mitigation. Holding guard also drains 8 stamina per second and prevents regeneration.
- **Guard break:** a hit with insufficient stamina drains the remainder, lowers guard, clears queued offense, and imposes 0.6 s attack recovery and a 1.1 s guard lockout. Dodge still provides an escape if a charge remains.
- **Projectile deflection:** a well-timed frontal parry prevents projectile damage; it does not reflect the projectile or stun a distant shooter.

Rear hits and crushing attacks (weight 3+) bypass defense. Boats, minecarts and mounts cannot guard. Guard interrupts fishing. Dodge overrides guard, preserving directional evasions and dodge resource costs. Guarding is available without a shield, including with staffs and bare hands.

## Art and integration

A dedicated append-only guard clip (198–205) gives a wide planted stance and raised defensive hands, with IK and grips from the shared body skeleton. Existing frame IDs remain intact. Both bodies and all eight directions use the same clip. Guard/block/break confirmation rings and readable labels accompany existing counter audio. Settings and Journal include the binding; the touch button has its own placement. Gamepad R3 replaces one duplicate ultimate binding; L3 still triggers ultimate and shoulder hotbar cycling remains intact.

Shared simulation owns guard timing, stamina drain and input cancellation. Server damage authority resolves facing, stamina costs, parries, chip damage and breaks. Binary ACK includes guard/parry/cooldown state; player snapshot flags expand to uint16 for remote guard poses. Client and server must be updated together; existing browser sessions should reload for the new wire format. No save migration is needed.

## Verification and limits

- 34 shared checks passed: defense, action flow and combat; includes timed/repeated parries, rear/crushing bypass, breaks, charge/dodge priority, riposte consumption and ACK round trip.
- Existing live server combat suite: 12 passed (combos, dodge, charge, enemy encounters and projectiles).
- 14 focused server checks passed: direct authority parry/deflection and existing fishing interruption tests.
- 13 client checks passed: directional action clips, input reset and combat presentation.
- Workspace typechecking and production solo build passed. Targeted ESLint and whitespace checks passed.
- `e2e/guard.mjs` passed against the built browser game: actual Ctrl input, dedicated painted guard frame, stamina drain, parry expiry and dodge/release handoff; no page errors. Screenshot/report under ignored `test-results/guard`.

Direct authority fixtures verify damage prevention and melee interruption; this does not replace full encounter and network-latency playtesting. Sustained-block values, boss parry timing and crowd pressure need wider balance playtests. Dedicated shield equipment, projectile reflection, grab attacks and multiplayer PvP defenses are not introduced here.
