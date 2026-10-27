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

## Monarch's powers (2026-10-27)

- **Shadow Exchange** (`G`, from level 10): you swap places with a summoned shadow. The button on a shadow's card
  picks that shadow; otherwise the farthest one within 40 tiles is used.
  - Use it to escape a pincer or to drop into a fight your army has already started.
  - Cooldown 18 s. It won't work while you are mounted or sailing, or if the shadow is down or standing on a solid
    tile.
  - You get 0.5 s of invulnerability as you step out.
- **Monarch's Domain** (`U`, from level 15, needs 2 or more shadows standing). For 12 s the 9 tiles around you belong
  to your army:
  - your shadows heal 25% when it rises, and deal ×1.5 damage while inside;
  - every foe inside is slowed;
  - cooldown 150 s, and the domain falls if you die.
- **Named guardian shadows ("Arise").** A boss's shadow rises a Knight at least (level 6) and keeps a trait:

  | Shadow         | Source               | Trait                                                                       |
  | -------------- | -------------------- | --------------------------------------------------------------------------- |
  | **Ignis**      | Phoenix of the Eyrie | **Rebirth**: when it falls it bursts back to full health, once every 2 min. |
  | **Gloam**      | Umbral Maw           | **Devour**: each kill heals it 25%.                                         |
  | **Tick**       | the Unwound          | **Rewind**: below 30% health it unwinds to full, once every 90 s.           |
  | Any other boss |                      | **Commander**: your other shadows deal +15% damage while it stands.         |

  The trait comes from the creature's kind and is re-derived when a roster loads, so a forged save cannot add one.

- **Balance fix.** A boss's shadow used to keep the boss's full health: around 3,000–4,500 HP at Knight rank, which
  made it unkillable. Boss shadows now keep 15% of the health and 70% of the damage (`BOSS_SHADOW_HP`,
  `BOSS_SHADOW_DMG`). That is still about 2–3× a brute's shadow.
- **Tests:** server `shadow-powers.test.ts`; browser `e2e/shadow-powers.mjs`.
- **Limits:**
  - No gamepad buttons are mapped to the two powers yet. Both work from the keyboard and from the window.
  - The domain is drawn as pulsing rings. There is no full-screen effect.

## Implementation

- `shared/src/shadows.ts`: ranks, stats, chances, XP; `ShadowState` in `schema34.ts` (`WorldState.shadows`, interest-managed like enemies); residues are `SpellState` kind `SPELL.RESIDUE`.
- `server/src/features/shadows/`: the module. A shadow _is_ an `Enemy` that is never added to the room's enemy map; the ordinary enemy AI steps it with hostiles as its targets, and its strikes call `GameRoom.hitEnemy` as the owner. `GameRoom.hookTargets` / `hookStrike` let hostile enemies target and hit shadows.
- Persistence: `character_shadows` (migration 103); the solo build's IndexedDB repo mirrors it.
- Client: `features/shadows/` (window, extraction bar, prompt), `Game` draws shadows through `CombatView.drawEnemy` with a dark silhouette and violet aura.
