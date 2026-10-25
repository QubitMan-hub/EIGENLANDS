# Shadow Army

Inspired by _Solo Leveling_: the creatures you defeat can become yours.

## Loop

1. **Defeat** a hostile creature at player level 5 or higher (`EXTRACT_LEVEL`). A violet **residue** rune lingers where it fell for 12 s, visible to everyone nearby but usable only by the one who struck the killing blow.
2. **Extract** (`T`): stand within 3.5 tiles and channel the Sigil for 1.2 s without moving. The chance is shown first and is `0.55 + 0.035 × (your level − its level)`, −0.12 for elites, −0.10 for brutes, +0.05 for wildlife (`extractChance` in `shared/src/shadows.ts`).
3. **Command** (`Y` opens the Shadow Army window): summon, dismiss, rename, release, and pick a stance. Select an enemy (left click) and your shadows focus it.
4. **Evolve**: shadows earn 60 % of the XP of every creature that falls near them. Ranks: Soldier (Lv 1) → Knight (6) → Elite (14) → Commander (24) → Marshal (38). Shadow level is capped at your level + 5. Each rank multiplies HP and damage.

## Rules that keep it fair

- Slots: `1 + ⌊level / 8⌋`, max 8. The roster holds 16.
- Shadows never die for good: when downed they re-form after 20 s at 60 % health.
- Enemies aggro on shadows as they do on players, so shadows tank for you. Shadow kills count as yours (loot, XP, new residues).
- Stances: **Assist** (focus target, anything near you), **Guard** (stay close, fight only what comes near), **Aggressive** (hunt everything in sight).

## Implementation

- `shared/src/shadows.ts`: ranks, stats, chances, XP; `ShadowState` in `schema34.ts` (`WorldState.shadows`, interest-managed like enemies); residues are `SpellState` kind `SPELL.RESIDUE`.
- `server/src/features/shadows/`: the module. A shadow _is_ an `Enemy` that is never added to the room's enemy map; the ordinary enemy AI steps it with hostiles as its targets, and its strikes call `GameRoom.hitEnemy` as the owner. `GameRoom.hookTargets` / `hookStrike` let hostile enemies target and hit shadows.
- Persistence: `character_shadows` (migration 103); the solo build's IndexedDB repo mirrors it.
- Client: `features/shadows/` (window, extraction bar, prompt), `Game` draws shadows through `CombatView.drawEnemy` with a dark silhouette and violet aura.
