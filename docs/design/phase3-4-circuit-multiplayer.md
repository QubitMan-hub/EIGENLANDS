# EIGENLANDS Phases 3 + 4: Circuit Board and Multiplayer: design and contracts

Scope (from the brief):

- **Phase 3:** the Circuit Board progression system, the tutorial story quest, and 2 classes (Superposer, Entangler).
- **Phase 4:** shards, parties, chat, prediction and interpolation, trading.

Phase 2 (gathering, farming, crafting, forging, Hadamere's NPCs) is being built **at the same time** by another agent. These rules keep the two from clashing:

- All Phase 3/4 code lives in **new files**: `shared/src/{quantum,circuit,classes,qubitpedia,tutorial,protocol34,shards,chatfilter,schema34}.ts`, `server/src/p34/**`, `server/src/rooms/GameRoom.ts`, `server/src/db/migrations/1xx_*.sql`, `client/src/p34/**`.
- Phase 2 files get only **small additive hooks** (listed at the end). No Phase 2 behaviour changes.
- Progression data goes in its **own table** (`character_progress`), not in `characters.data`, which Phase 2 owns and rewrites.
- Message names live in `MSG34` (`protocol34.ts`), not in Phase 2's `MSG`.

## Phase 3: the Circuit Board

### Player-facing model (no maths)

- **Orbs (qubits)** are slots. Each orb powers one **ability line**. You start with 1 and unlock up to 12 by level: `QUBIT_UNLOCK_LEVELS = [1,3,6,9,12,15,18,21,24,27,30,33]`.
- Every ability has two **forms**: form A (the orb's resting colour) and form B (the opposite element, often a different shape). Which form fires is decided **when you cast**.
- **Gates** are tiles you drag onto an orb's line (8 columns per line). Each placed gate uses one token from your collection; removing it gives the token back.
  - **Split** (Hadamard): the ability can come out as either form, 50/50.
  - **Flip** (X): swaps the forms. A flipped ability always comes out as form B.
  - **Tune** (phase gates: **Tune ¼** = T, **Tune ½** = S, **Tune** = Z): turns the orb's colour by 1, 2 or 4 steps around the 8-colour wheel. The colour sets the **element** of a split ability. Tune only shows on a split orb (it needs a Split first); a Split _after_ a Tune makes the colours **interfere**, which changes the odds (Split → Tune → Split always gives form B; Split → Tune ¼ → Split gives form A 85% of the time).
  - **Link** (CNOT): joins two orbs. Casting the first orb also fires the linked orb (an **echo cast** at 60% power, no cooldown cost). If the first orb is split, the two outcomes are **correlated** (entangled): they always match, or always differ.
  - **Lock in** (measurement): when you **attune** the board, a locked line's result is decided once and then stays fixed until you attune again. Locked lines get **+25% power** and no noise from the gates before the lock.
- **Noise.** Each gate adds a little instability. Big boards also add crowding noise. When noise strikes, the cast comes out as the _other_ form and its element turns to Flux (a "misfire"). **Error Correction runes** (up to 2 per line) suppress it, using a real repetition code.
- **Outcome preview:** for each line, coloured bars show the chance of form A and form B, plus a one-line summary ("Glimmer Bolt: Ember bolt or Frost twin-shot, even odds. Linked to Pulse."). Linked lines also show their joint outcomes.
- **Expert View** (toggle) shows the real circuit symbols (H X T S Z ●─⊕ M), the state vector (top amplitudes as kets), Bloch-sphere azimuths, exact probabilities and error rates.
- **Attune**: saving the board is called attuning (5 s cooldown; the client's Attune button greys out). Attuning re-rolls the Lock-in results.

### The real quantum model under it (`shared/src/quantum.ts`, `circuit.ts`)

- State vector simulation of up to 12 qubits (4096 complex amplitudes, Float64Arrays), gates H X Z S T CNOT, mid-circuit measurement (projective, using the stored lock outcome).
- The board compiles to a gate list in column order (a column applies its gates top to bottom; CNOT is a single cell holding `{g:'cx', target}`).
- **Form probability** for line _q_ = P(qubit _q_ = 1) from the Born rule. **Joint distribution** over all lines is cached per attuned board (sampling a cast is one binary search).
- **Element hue** for a line = base hue + round(arg(ρ₁₀)/(π/4)) where ρ is the line's reduced density matrix just before the final measurement. If |ρ₁₀| < 0.05 (no coherence), the hue is the base hue of the form that comes out. So Tune only matters on split lines, exactly as in physics.
- **Noise (bit-flip channel):** per-gate error `ERR = {h:0.01, x:0.005, z/s/t:0.004, cx:0.03, m:0.01}`; line error `p = 1 − Π(1 − e)` over gates touching the line (gates before a Lock are excluded) plus crowding `0.006 × max(0, totalGates − 6)`. With _r_ runes the effective error is the repetition code's logical error: distance _d = 2r+1_, `p_L = Σ_{j>r}^{d} C(d,j) p^j (1−p)^{d−j}`. The preview shows `stability = 1 − p_L`.

### Classes (`shared/src/classes.ts`)

Each class has 4 abilities (two forms each), a resource bar, a signature ultimate and 3 specializations (chosen at level 10). Abilities can go on any line; lines 1 to 4 are on the action bar (Q R F G; pad d-pad; touch buttons). Lines 5 to 12 only fire through Links (support lines). At level 30 you can pick a **second class** and slot its abilities too (multiclass).
Characters with no class are "Wanderers" and know only **Glimmer Bolt**. The tutorial ends with choosing a class.

**Superposer:** resource **Coherence** (+12 per cast from a split line, +4 per hit, −3/s after 4 s out of combat).

| Ability                                                                                                                                                                          | Form A                                          | Form B                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| Split Shot                                                                                                                                                                       | one heavy Ember bolt (18)                       | Frost twin-shot, 2 × 10 in a 12° fan                                |
| Echo Step                                                                                                                                                                        | blink 4 tiles, leave an **Echo** that lasts 4 s | blink 4 tiles, then snap back to the start after 1.5 s (Echo stays) |
| Wavefront                                                                                                                                                                        | Radiant ring (radius 2.5, 14 dmg, push)         | Void ring (radius 2.5, 10 dmg, pull and slow 40% for 2 s)           |
| Probability Ward                                                                                                                                                                 | Verdant shield absorbs 30 for 5 s               | Tide mirror: the next hit within 5 s is reflected (×1.5)            |
| Signature passive **Two Places at Once:** while an Echo exists, an enemy hit on you has a 50% chance to land on the Echo instead; you collapse to the Echo's position (it pops). |
| Ultimate **Many Worlds** (100 Coherence): 3 Echoes around you for 6 s; each of your casts is repeated by every Echo at 40%.                                                      |
| Specs: **Phantom** (Echoes last 2 s longer and dodge 65%), **Splitter** (Split Shot fires 3 twin bolts / 24 heavy), **Collapse** (Locked lines +45% instead of +25%).            |

**Entangler:** resource **Bond** (+1 per 2 echoed damage or healing, −3/s after 4 s out of combat).

| Ability                                                                                                                                                                                   | Form A                                                            | Form B                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| Tether                                                                                                                                                                                    | Void bolt; the enemy hit becomes **Linked** for 8 s (max 3 links) | Verdant bolt; the ally (or you) gets Linked for 8 s |
| Pulse                                                                                                                                                                                     | 16 damage to every Linked enemy                                   | heal 14 to every Linked ally and you                |
| Swap                                                                                                                                                                                      | pull the nearest Linked enemy to you                              | swap places with the nearest Linked target          |
| Mend                                                                                                                                                                                      | heal yourself 20                                                  | Tide ward on you: −35% damage taken for 6 s         |
| Signature passive **Spooky Action:** damage dealt to a Linked enemy echoes 40% to every other Linked enemy; healing on a Linked ally echoes 40% to the others.                            |
| Ultimate **Bell State** (100 Bond): every enemy within 7 tiles is paired; for 6 s, damage on one is mirrored 100% to its pair.                                                            |
| Specs: **Weaver** (5 links, echo 55%), **Bondkeeper** (ally echo 60%, Mend heals party within 6 tiles), **Paradox** (Swap has no cooldown on its first use after Tether; Swap stuns 1 s). |

**Wanderer:** Glimmer Bolt (A: Ember bolt 14; B: Frost bolt 10 + slow).

Elements (8 hues, the existing phase colours): 0 Ember (burn 3/s for 3 s), 1 Spark (+20% vs night foes), 2 Radiant (knockback), 3 Verdant (heal caster 15% of damage), 4 Frost (slow 35% for 2 s), 5 Tide (knockback + 10%), 6 Void (+25% damage), 7 Flux (random 0.6 to 1.6× damage). Ability cooldowns 1.2 to 9 s; numbers live in `classes.ts`.

### Progression rewards

- Level-ups grant gate tokens on a fixed schedule (`LEVEL_GATE_REWARDS`) and a rune every 4 levels. The server stores `rewardedLevel` so nothing is granted twice.
- The tutorial grants: Split ×1, Flip ×1, Tune ×1, Split ×1 (for interference), Link ×1, Lock ×1 and a second orb early (the tutorial unlocks orb 2 regardless of level).
- Runes can also be bought for 150 coins at the board (a currency sink).

### Tutorial: "The Flickering Orb" (`shared/src/tutorial.ts`)

About 5 minutes, told by **Lumen**, a small light-sprite that follows you (client-side companion). No numbers, no symbols. Steps:

1. _Wake_: Lumen appears and hands you an orb. Open the Board (B).
2. _Split_: drag Split onto the orb, attune. Cast (Q) 3 times. You see both colours come out.
3. _Flip_: replace Split with Flip. Cast once: it is always Frost.
4. _Interfere_: Split, Tune, Split. Cast twice: "the colours cancelled: it's always the second form."
5. _Fight_: defeat 3 creatures with your orb (any form).
6. _Choose_: pick Superposer or Entangler (the ability set changes; you get a second orb).
7. _Link_: link orb 1 to orb 2, attune, cast orb 1: both fire.
8. _Lock_: put Lock on a line, attune. "Locked: guaranteed power."
   Completion unlocks the Qubitpedia and grants the remaining starter gates. Players can skip the tutorial (Board → "Skip story") and still choose a class.

### Qubitpedia (`shared/src/qubitpedia.ts`)

Short, friendly entries (qubit, superposition, measurement, the X gate, phase, interference, entanglement, CNOT, decoherence/noise, error correction, Born rule, Bloch sphere, teleportation teaser). An entry unlocks the first time you use the concept. Read it from the Board (Codex tab) or press the ? on any gate.

### Server (`server/src/p34/circuit/`)

- `ProgressStore`: loads and saves `character_progress` (JSONB, validated on load, never trusted).
- `CircuitSystem`: board edit validation (gates owned, qubit unlocked, Link target valid, at most 1 gate per cell), attune (Lock sampling, distribution cache), casting (cooldowns, resource, joint sampling, noise, echo casts through Links), level rewards, tutorial progression, codex unlocks.
- `AbilityEngine`: executes ability effects authoritatively: bolts (own projectile list, element colour in `SpellState.hue`), rings, blinks, Echoes, shields and mirrors, links, ultimates, enemy status (burn, slow, stun) and element riders. Damage goes through the room's `damageEnemy`, so drops and XP stay Phase 2's.
- Synced entities: `SpellState` (`schema34.ts`) in `WorldState.spells`, kinds: bolt, ring, echo, tether, shield, ward. Interest-managed like everything else.

## Phase 4: multiplayer

### Prediction and interpolation (already in Phase 1, extended)

- Ability casts are predicted cosmetically (cast flash and cooldown sweep start at once); the server reply `CAST_R` reports the form, element and cooldown. A blink is server-authoritative and arrives through reconciliation (no snapping: the predictor's smoothing handles it).
- **Adaptive interpolation delay**: `INTERP_DELAY = clamp(2 × snapshot interval + jitter × 2, 80, 200) ms`, recomputed from snapshot arrival jitter.
- **Network simulator** for testing the feel: `?lag=150&jitter=20&loss=0.01` delays and drops inbound and outbound messages on the client. An integration test drives a client at 150 ms simulated round trip and checks reconciliation corrections stay under 0.05 tiles while walking.

### Shards (`shared/src/shards.ts`, `server/src/p34/shard/`)

- The world is split into **regions of 8 × 8 chunks** (256 × 256 tiles). Region (0,0) is centred on spawn (`regionOf(cx) = floor((cx + 4) / 8)`). Each region is one `GameRoom` (Colyseus `filterBy(['shard'])`), so a region runs on whichever process created it; with Redis the Colyseus presence/driver spreads rooms across processes.
- **Joining:** the client asks `GET /api/shard` (bearer token) for its character's shard id, then joins `world` with `{shard}`. A join to the wrong shard is handed off at once.
- **Handoff:** when a player walks 2 tiles past the region border, the room saves the character and progress, issues a short-lived signed **handoff ticket**, sends `HANDOFF {shard, ticket}`, and removes the player. The client joins the target shard and keeps its chunk cache, so the world stays drawn. Input is paused for the round trip (typically under 150 ms).
- **Ownership:** a shard only accepts world edits (USE, OPEN, CHEST, SHELTER, edits) on tiles in its own region. Tile changes are relayed to neighbouring shards over the bus so players near a border see edits on the other side.
- **Ghosts:** each shard publishes players within 24 tiles of a border at 10 Hz on the bus. Neighbours forward them as `GHOSTS` to their own clients, who draw them as interpolated remote players. So you can see people across the border (you cannot hit them; there is no PvP yet).
- **Single session across shards:** presence (Redis, or memory) plus a bus `kick` message enforces one live session per account.
- **Bus:** `Bus` interface with an in-process implementation and a Redis pub/sub implementation (used automatically when Redis is available). Channels: `shard:<id>` (ghosts, tiles), `party:<id>`, `chat:global`, `player:<accountId>` (whispers, party invites, kicks).

### Parties (`server/src/p34/social/party.ts`)

- Up to 5 members. Invite by name or by clicking a nearby player. Accept, decline, leave, kick (leader), promote (leader). Party state lives in a `PartyRegistry` (in-process; mirrored through the bus to every shard).
- HUD party frames: name, level, class colour, HP bar, and an arrow plus distance if off-screen or on another shard.
- **Shared XP:** when an enemy dies, party members within 30 tiles of it get +50% of its XP as a bonus (the killer keeps full XP).
- Party chat channel. Party members' spells (Entangler heals, links) count each other as allies.

### Chat (`server/src/p34/social/chat.ts`)

- Channels: **local** (24 tiles, same shard plus ghosts), **global** (all shards, rate-limited harder), **party**, **whisper** (`/w name text`).
- Moderation: length 200; token bucket (local 2/s, global 1 per 3 s); a mask filter for slurs/profanity (`chatfilter.ts`, whole-word, leetspeak-folded); repeated-message suppression; `/mute name` and `/block name` are per-player and persisted client-side (blocked players are hidden from you); `/report name reason` writes `chat_reports` with recent context. Admin mute: `account_flags.muted_until`.
- Emotes: `/wave /dance /cheer /sit /bow /laugh` show a bubble above the player for 3 s (also `EMOTE` buttons in the chat panel).
- Last 30 global messages are replayed to newly joined players.

### Trading (`server/src/p34/social/trade.ts`)

- Request a trade with a player within 6 tiles on the same shard. Both offer up to 8 pack slots plus coins; any change resets both confirmations; both press **Confirm**, then **Accept** within 30 s.
- Execution is atomic: validated against live inventories (the offered stacks must still be there, unchanged), simulated on clones (both packs must fit), applied to both, then **both characters are saved in one DB transaction** with a `trades` audit row. If the DB write fails, both players' in-memory data is rolled back.
- Cancelled on distance > 8 tiles, either player leaving, or 2 min idle. Coins and items never exist twice.

## Persistence (migrations `101_progress.sql`, `102_social.sql`)

- `character_progress(account_id uuid PK → accounts ON DELETE CASCADE, data jsonb, updated_at)`.
- `trades(id bigserial, a uuid, b uuid, a_items jsonb, b_items jsonb, a_coins int, b_coins int, at timestamptz)` (no FK, kept for audits, deleted with the account via trigger-free cleanup in `deleteAccount`).
- `chat_reports(id bigserial, reporter uuid, target_name text, reason text, context jsonb, at timestamptz)`.
- `account_flags(account_id uuid PK → accounts ON DELETE CASCADE, muted_until timestamptz)`.

## Hooks added to Phase 2/1 files (the whole footprint)

- `server/src/rooms/WorldRoom.ts`: a few `private` members become `protected`; empty protected hook methods (`hookIncomingDamage`, `hookKilled`, `hookTileChanged`, `hookViewEntities`, `hookAcceptsTile`) called at 5 places; `village` creation goes through `protected makeVillage()`.
- `server/src/app.ts`: defines `GameRoom` (a `WorldRoom` subclass) instead of `WorldRoom` with `filterBy(['shard'])`, and mounts `/api/shard`.
- `shared/src/schema.ts`: `WorldState.spells` (one line + import); `PlayerState` gains `cls` (uint8) and `party` (string) for nameplates.
- `shared/src/index.ts`: export lines.
- `client/src/game/Game.ts`: an `ext` hook object (frame, state, handlers, debug), a few members made public.
- `client/src/net/session.ts`: generic `on/send`, handoff reconnect, network simulator.
- `client/src/input/{input,keymap}.ts`: new remappable actions (abilities 1 to 4, ultimate, board, chat, party).
- `client/src/ui/ui.ts`: touch ability buttons and new HUD containers.

## Definition of done

Unit tests for the quantum simulator, circuit rules, noise maths, classes, chat filter and shard maths; server integration tests for attune/cast/abilities, tutorial, party, chat, trade atomicity and rollback, shard handoff and ghosts; client unit tests for the adaptive interpolation and board model; browser e2e for the tutorial flow, the board UI and two players partying, chatting and trading. No console errors. The tutorial and tooltips explain everything in the game itself.
