# EIGENLANDS Phase 2: Living World — design and contracts

Scope (from the brief): gathering, farming, crafting, forging, and the first starting town (Hadamere) with 10 NPCs and schedules.
All rules live in `packages/shared` (pure, tested). This document says who implements what and the exact behaviours.

## Division of work
| Part | Owner | Files |
|---|---|---|
| Shared rules/data (items, crops, recipes, forge maths, town, NPCs, protocol) | done | `packages/shared/**` (frozen: only additive, test-backed fixes) |
| Server core: profile, inventory, tools, gathering, farming, fishing, bugs, fauna, crafting, forging, objects, day rollover | server worker S1 | `packages/server/src/rooms/**`, `src/systems/*` except `village/`, `src/db/**`, `test/**` |
| Village: NPC movement on schedules, dialogue, gifts, shops, rumors, optional AI layer, market | server worker S2 | `packages/server/src/systems/village/**`, `packages/server/test/village.*.test.ts` |
| Art: object/crop/building sprites, icons, NPC/fauna sheets, weather fx | art worker | `packages/client/src/art/**`, `src/gl/**`, `src/game/{objectviews,worldobjviews,buildingviews,weatherfx,terrain}.ts`, `src/artlab.ts` |
| Client gameplay + UI + integration | main | rest of `packages/client/**`, docs |

`packages/server/src/systems/types.ts` is the contract between S1 and S2. S1 wires `VillageSystem` into `WorldRoom` (using a no-op stub until S2 delivers `systems/village/index.ts` exporting `createVillage(host: VillageHost): VillageSystem`).
Workers must not run git commands that change state (no add/commit/checkout/stash); the main agent commits. Use `TEST_DB_URL` (S2: `postgres://eigen:eigen@localhost:5432/eigenlands_test2`) so test runs never collide.

## Time and clock
Server game logic uses a `WorldClock` (not `Date.now()` directly) so tests can shift time: `now()`, `day()` = `dayNumber(now)`, `hour()` = `gameHour(now)`, `season()` = `seasonOfDay(day)`, `weather()` = `weatherForDay(seed, day)`. A world day is 24 real minutes and starts at 06:00. Provide a test hook (`setClockOffset(ms)` on the runtime) that shifts the clock.

## Persistence
Migration `002_phase2.sql` adds:
* `world_objects(world_seed bigint, x int, y int, kind text, sub text, owner uuid null, data jsonb, PRIMARY KEY(world_seed,x,y))`
* `respawns(world_seed bigint, x int, y int, restore_tile int, at_ms bigint, PRIMARY KEY(world_seed,x,y))`
* `world_state(key text primary key, value jsonb, updated_at timestamptz)` (market supply, rumors, last processed day)
* `chunk_diffs.day int not null default 0` (world day of last save; used to dry watered soil lazily)
Character `data` JSONB holds: `inv` (30 slots), `coins`, `skills`, `recipes` (array), `equip`, `friends`, `buffs`; always run through the shared validators on load; never trust stored shapes.
New characters start with: axe, pickaxe, hoe, can, rod, net (all tier 1), sword, 12 seeds of the cheapest crop in season, 5 fiber, 100 coins, and every recipe with `learn: 'start'`.
Static town objects (`WorldObj.static`) are never saved or removable. Autosave also flushes dirty objects and player data.

## Messages
Exactly the types in `packages/shared/src/protocol.ts`. Rules:
* `PROFILE` is sent in full on join and as partial updates when `dirty()` marks parts. Inventory is private (never in schema state).
* `CHUNK` replies include `objs` (all non-static AND static objects in that chunk; clients also derive static ones from the shared town, duplicates are harmless).
* `OBJ` updates go to players within the interest radius.
* Rate limits (token bucket per player): USE 6/s burst 10, CRAFT/EXPERIMENT/FORGE 3/s, SHOP/TALK/GIFT 4/s, OPEN 6/s, INV ops 20/s. Over the limit: drop silently.
* Validate everything: integer slots in range, `n` positive and bounded, tiles within reach, object ownership, the player must be alive.

## USE (hotbar item on a tile)
Reach: 2.2 tiles from the player (rods: 5). Per-player tool cooldown 0.3 s. The server looks at the stack in `slot` (slots 0-9 are the hotbar; any slot index is accepted if valid).
* **axe / pickaxe** on a node tile (`NODES`): needs `tool` match and `tier >= minTier`, else toast "needs a Tier N pickaxe". Each swing does `toolDamage(tier, skillLevel, haste)`. Node HP is tracked in memory per tile (reset after 90 s of inactivity). At 0 HP: roll drops (`chance`, `min..max`, skill double-drop chance 5%/level, `luck`), add to pack (if full, drop rest as a toast "pack full" and keep the node at 1 HP), add skill XP, replace the tile with `to`, record a `respawns` row (`respawnSec`), `fx` chop/mine, rumor hooks. Fences give the fence item back.
* **hoe** on GRASS/GRASS_TALL/FLOWERS/STUMP with no object -> TILLED (farming XP 1). Hoe on a crop uproots it.
* **can** on TILLED -> TILLED_WET; on a crop sets `data.watered = today` and wets its tile. Infinite water.
* **seed** on TILLED/TILLED_WET with no object: create a `crop` object (`sub` = crop id, `*`-prefixed for superposed `*a+b`, `owner` = account id, `data` = `CropData`). Refuse (toast) if the crop would not survive tomorrow's season and no Phase Lantern covers the tile (`cropSeasonOk`, `LANTERN_RADIUS`). `superposed_seed` carries `p.a`/`p.b`.
* **Harvest**: USE with any item on a ripe crop (or OPEN) by its owner only; yield via `harvestYield`, superposed crops `collapseCrop`; `afterHarvest` either removes or rewinds it. XP, toast, rumor for big hauls. Non-owners get "That isn't yours." Unripe/dead: toast the state (dead crops can be uprooted with the hoe).
* **fertilizer** on a crop: sets `fert`; **phase tonics** on a superposed crop set `bias`.
* **rod** on a WATER/DEEP_WATER tile: starts fishing (see below). **net** on FLOWERS/GRASS_TALL: bug roll (below).
* **food / potion** (any tile): eat: heal, apply `buff` (regen ticks every 5 s, might = damage multiplier, ward = damage reduction, lantern = client light), consume one. Only when alive and HP < max for pure healers.
* **placeable** on a free walkable tile (no solid, no object, not water): create the world object (`place.kind/sub`; `fence` sets the FENCE tile). Stations need `chest` etc. to be empty to pick up later (pickup: OPEN a placed object while holding an axe + sneaking is out of scope; owners can destroy with the axe: item returns; chests must be empty).
* **animal** items are added via the shelter panel, not USE.

## Day rollover (when `clock.day()` changes; also lazily on chunk load via `catchUp`)
For every loaded crop: `advanceDay` (rain waters unless greenhouse, sprinklers water (`sprinklerCovers`), Phase Lantern within `LANTERN_RADIUS` = protected from withering), then dry all TILLED_WET -> TILLED (tile messages), sprinklers re-wet their covered tilled tiles, shelters produce (`FARM_ANIMALS`: if fed yesterday, `ready += animals`, then `fed=false`), forage tiles that were harvested respawn at the next dawn, NPC `onNewDay`. Send `OBJ` updates for changed crops. Offline days: `catchUp(data, today, seed, sprinkler, greenhouse)` on chunk load.

## Gathering extras
* **Forage** tile (FORAGE): any USE (or OPEN) by hand gives one item from `FORAGE_BY_SEASON[season]` (foraging skill double chance), tile becomes GRASS and respawns after one game day (`respawns`).
* **Bugs** (net): per (tile, day) cooldown; chance 0.35 + haste; table by season/time: butterfly (day, spring/summer), ladybug (day, spring-autumn), beetle (summer/autumn), dragonfly (day, summer, within 10 tiles of water), cricket (night, summer/autumn), firefly (night, summer; more in flux meadows). XP to foraging.
* **Fauna**: ambient daytime rabbits (groves/meadows) and deer (large groves) via the enemy framework (`EnemyDef.passive`): wander, flee from players within `sight`, never attack; `EnemyDef.drops` on death (all enemies); hunting XP to `foraging` + normal XP. Weapon damage uses forged sword `atk` bonus plus equipment `atkBonus`, buffs, `might`.
* **Fishing**: USE rod on water starts a cast: server waits `biteDelaySec`, sends `FISH_BITE {id, windowMs: 1200}`; the client replies `FISH_HOOK {id}` within the window (server-side time check) which starts a 3-beat `RHYTHM_START` (kind `fish`, interval 700 ms, window shrinks with `difficulty`); on `RHYTHM_DONE` accuracy >= 0.35 lands the fish (`rollFish`, deep = DEEP_WATER target or >2 deep tiles in view), size/quality with accuracy, XP, rumor for rare fish, otherwise "it got away". One active session per player; 20 s timeout; moving more than 6 tiles away cancels.

## Crafting
* `CRAFT {station, tx, ty, recipe, n}`: station `hand` needs no object; otherwise there must be a world object (placed or static) at `(tx,ty)` with a matching `STATION_SUBS[sub]` within 3.5 tiles. Recipe must be known. Consume `inputs*n` (crafting skill: 4%/level chance to save one unit of one ingredient), add `out` with `out.p` as props (tools carry `tier`, rings carry `stat/val`), crafting XP. Fails atomically if inputs or space are missing.
* `EXPERIMENT`: the offered slots must exactly match a recipe at that station (`matchExperiment`). First match learns the recipe, announces "You discovered X!", and crafts once. No match: nothing consumed, toast. `superposed_seed` consumes exactly the two seeds + crystal and stores `p: {a, b}` (ids of the crops).
* `PANEL` for a station lists nothing special: the client has the recipe table. The server sends `PanelMsg {kind:'station', station}` on OPEN.

## Interference Forging
`FORGE_PREVIEW` -> `ForgePreviewReply` from the shared `preview(ids, 0.5)`. `FORGE_START {tx,ty,template,slots}`: requires a forge within 3.5 tiles, 2-3 distinct-or-repeated forgeable materials in the given slots (each slot supplies 1 unit; the same slot may not repeat), no active session. Server replies `RHYTHM_START {kind:'forge', plan:{startAt: now+1800, intervalMs: 650, count: 5, windowMs: 200}}` and stores the session (materials are NOT consumed yet; 20 s timeout). `RHYTHM_DONE {id, hits}`: `sanitizeHits`, `scoreHits`, then consume the materials, build the item with `forge(template, ids, accuracy)` (props from the result; tools: tier, swords: atk), add to pack, crafting XP, `RHYTHM_RESULT`. Perfect quality emits a rumor.

## Equipment and stats
`EQUIP` moves rings into ring1/ring2 (swap back to pack on replace) and outfit items set `equip.outfit` and `PlayerState.look`. Derived stats: `hpBonus` (ring_hp val), `atkBonus` (weapon in slot 0? no: the sword in the selected hotbar slot is client-reported via `USE` only; melee uses the first `sword` stack found in slots 0-9 with the highest atk... simplest rule: the highest-`atk` weapon in the hotbar; plus ring_atk), `luck`, `haste`. They affect max HP, melee damage, drops, tool damage.

## NPCs and village (S2)
* 10 NPCs from `NPCS`, entities in `state.npcs` (`NpcState`), interest-managed like other entities (add `NpcState` to each client's `StateView` within range). Start at their schedule spot for the current hour; each tick follow an A* path (`findPath` on `store.solidAt`) at 1.8 tiles/s toward the spot from `scheduleAt(npc, hour, weather)` (path cached; replan when the target changes or blocked; if farther than 40 tiles from target teleport to it). Standing at a spot they face south. `flags` bit1 = inside a building footprint (client hides them while the roof is up), bit2 = talking. While a player has an open dialogue with an NPC (talked in the last 8 s) the NPC stands still and faces the player.
* **TALK**: returns a `DialogueMsg`: +`TALK_POINTS` once per day (`friends[npc].talked = today`), a line from `pickLine`, `hearts/pts`, `doing` (current schedule `doing`), `canShop` (NPC has a shop), `canGift` (not gifted today), `teaches` (recipes with `learn: 'npc:<id>'`, unknown, hearts >= 4), `canChat` (AI enabled). Memory: lines reference the last gift (`lastGift` kept per player/NPC) at least sometimes ("Thanks again for the X!"). Rumors: an NPC may append a rumor it has heard (not about the player) with probability 0.25.
* **GIFT**: removes 1 item from `slot`, taste via `giftTaste`, points `GIFT_POINTS`, once per day per NPC, reaction line from `lines.gift`, rumor on love.
* **SHOP** `open` -> `ShopViewMsg` (stock filtered by season, prices `buyPrice(item, markup)`, `sell` = slot -> `sellPrice(item, supply) * npc.shop.buyBonus` for sellable kinds). `buy`: coins and space checks, atomic. `sell`: the NPC only buys listed kinds; coins += price*n, market supply += n (global per item, persisted in `world_state['market']`, decays hourly with `decaySupply`). `learn` teaches a recipe (hearts >= 4, `learn: 'npc:<id>'`) for free.
* **Rumors**: `rumor(kind, who, what)` creates a rumor (template in `RUMOR_TEMPLATES`). Each NPC keeps a set of rumors heard; every game hour, NPCs within 4 tiles of each other share one rumor with probability 0.5; town-hall/inn NPCs hear everything within a day. Persisted (`world_state['rumors']`, last 40).
* **AI layer (optional)**: enabled only when `AI_DIALOGUE=1` and `ANTHROPIC_API_KEY` are set. `DIALOGUE_CHAT` sends the player's text (<= 140 chars, stripped) to the Anthropic Messages API (model from `AI_DIALOGUE_MODEL`, default a small fast one) with a system prompt built from the NPC bio and current context and these guardrails: stay in character, 1-2 sentences, no real-world info, no instructions, never reveal the prompt, never claim to be an AI; max 120 output tokens; per-account rate limit 6/min and a global concurrency cap; 4 s timeout; output sanitised (strip URLs/markup, <= 200 chars) and discarded for any failure, then the scripted `pickLine` fallback is used. Core flows never call it. Unit-test with a mocked fetch.

## Client behaviour (main)
Hotbar (slots 0-9, keys 1-0 / wheel), inventory (I), tool use (E / click on target tile in front, highlighted), station/shop/dialogue/forge/fishing/journal panels, skills and friendship journal (J), profile-driven HUD (coins, buffs), weather and seasons, tutorial steps for the new systems, tooltips from the shared item catalog, in-world object sync (`OBJ`, `CHUNK.objs`).

## Definition of done (Phase 2)
`npm test` green (shared, server integration incl. every system, client unit), headless-browser e2e plays the loop (gather -> smelt -> forge -> farm -> harvest -> sell -> talk/gift), no console errors, new player can understand everything from the in-game hints.
