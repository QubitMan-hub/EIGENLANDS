# Action combat responsiveness — 2026-11-06

## Design and implementation

Improve the existing action combat through deterministic input and recovery rules shared by prediction and server authority. Preserve controls, weapon damage/recovery, dodge charges, recharge and invulnerability. This pass changes control and transitions rather than adding a new combat mode.

- Swing movement previously jumped from 40% to 100% speed at a fixed threshold. A smoothstep curve now restores movement over the last 300 ms of recovery. Longer weapon recoveries retain their initial commitment.
- The combo decision timer previously ran during recovery, leaving slower weapons little time to respond. It now counts down once the player can attack again.
- Dodging clears a previously queued attack. A fresh press during the dodge can still queue a deliberate follow-up.
- A stationary dodge uses current aim; a moving dodge follows movement, allowing a retreat while aiming at the enemy.
- Strafing during swing recovery preserves attack facing. Movement remains responsive, and the next attack or dodge can deliberately change facing.

No new predicted fields or wire-format changes are required. The existing ACK/replay path runs these same rules on both sides.

## Evidence

Four new regression scenarios failed before implementation; all five scenarios (including strike-facing/strafe coverage) pass afterward. Focused shared combat, melee-arsenal and dodge-resource checks: 31 passed. Workspace typechecks, production solo build, targeted ESLint and whitespace checks passed.

Browser production check: `node e2e/combat-contact.mjs http://127.0.0.1:5244/ test-results/action-flow` passed. It exercised opening attack, held charge, heavy release, actual painted contact/recovery frames and cancellation of stale gathering/crafting gestures, with no page errors. Screenshots and report are under ignored `test-results/action-flow`.

## Limits and further combat work

This is a verified responsiveness pass, not a claim of a measurable “100×” improvement or a completed overhaul of every combat feature. Crowd fights, latency under multiplayer load, every class ability and long progression balance still need playtesting. Distinct mounted attack poses and more bespoke enemy reactions remain separate art work. The shadow-domain poise warning recorded in the incoming review is still open.
