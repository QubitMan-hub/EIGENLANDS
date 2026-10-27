# Dungeon gates

Dungeon gates are inspired by the gates of hunter stories (Solo Leveling and similar). Rifts open in the wilds every
day, each one ranked from E to S. Step through one to enter a dungeon of its own. Clear it before dusk, or it breaks
and its monsters spill out into the world. Gates exist only in worlds of generation 6 or later.

## For players

- **When and where.** From 06:00 each day, gates open across the wilds, about one in five 128-tile regions per day.
  No gate opens in towns, sanctuaries or near the spawn shrine. A gate appears as a tall swirling rift in its rank's
  colour, with its letter beneath. When you stand close, a hint tells you its rank and the level it needs.

- **Ranks.** A gate's rank rises with distance from the shrine, roughly one rank every 350 tiles, with the odd
  surprise either way.

  | Rank | Level to enter | Monsters (level)                                                | Master       | Halls | Pays on clear                      |
  | ---- | -------------: | --------------------------------------------------------------- | ------------ | ----: | ---------------------------------- |
  | E    |              3 | slimes, wolves, goblins (4)                                     | Ashen Raider |     5 | 90 coins, 2 lesser mana stones     |
  | D    |              8 | goblins, bandits, spiders (9)                                   | Orc          |     6 | 180 coins, 4 lesser mana stones    |
  | C    |             13 | orcs, undead, rogue mages (14)                                  | Troll        |     7 | 320 coins, 2 mana stones           |
  | B    |             18 | trolls, corrupted beasts, rogue mages, spiders (19)             | Manticore    |     8 | 520 coins, 4 mana stones           |
  | A    |             24 | shade stalkers, gear hounds, sundered blades, gloam hexers (25) | Hydra        |     9 | 800 coins, 2 radiant mana stones   |
  | S    |             30 | trolls, basilisks, manticores, sundered blades (32)             | Dragon       |    10 | 1,300 coins, 4 radiant mana stones |

  Every clear also pays experience. From C rank up, about one monster in seven is a hardened elite.

- **Inside.**
  - **Halls.** Each hall's pack wakes when you walk in.
  - **Side chambers.** These are dead ends. Clear one and whoever stands in it finds a cache of the rank's stone.
  - **The master.** The last hall holds the gate's master: hardened, a few levels up, with 3–4× the health.
  - **The clear.** When the master falls, everyone inside is paid and the gate in the wilds closes.
  - **Leaving.** The pale rift by the entry takes you back to where you stepped in.
  - **First clears.** Your first clear of each rank is recorded as `gate:<rank>` in your progress.

- **Dusk.** At 20:00, any gate nobody has closed breaks.
  - If a hunter is within 60 tiles, its monsters pour out around it, led by a hardened master of normal health.
  - Anyone still inside is thrown back out into the world.

- **Mana stones.** Gates are where mana stones come from (a stray one sometimes drops in the wild). You can sell them
  to merchants (their item values are 60, 180 and 520 coins) or brew them at the alchemy bench:
  - Mana Tonic: heals 60, plus regeneration.
  - Mana Elixir: heals 140, plus ward.
  - Radiant Elixir: heals 320, cures every ailment, and grants fortune.

- **With shadows.** A gate's master leaves a residue like any other foe, so you can extract it into your shadow army
  (see `design/shadow-army.md`).

## How it works

- **Shared (`gates.ts`, `gate-plane.ts`).**
  - The gate plane sits at y −600064. It holds 192 dungeon slots, 512 tiles apart. Each slot's rank, theme (cavern,
    temple, ember or crystal) and layout come from the seed alone.
  - The layout is a winding main way of rooms on a 24-tile grid, plus dead-end side chambers. The tile function hews
    the rooms and corridors out of rock. Braziers stand on the room diagonals, clear of the corridor mouths.
  - `gatesNear(seed, day, box, open)` gives each day's gates. The caller decides which ground counts as open.
- **One room per dungeon.** Every dungeon lies inside one shard region:
  - GATE_OY and the 512-tile pitch put each dungeon's entry at a region's centre;
  - rooms stay within 4 cells of it.

  So a single room runs the whole fight, and a shared test checks this for every 7th slot.

- **Server (`features/gates`).**
  - Gates are live `SpellState` entities of kind `SPELL.GATE`: hue is the rank, r is 1 for a gate and 2 for a way
    out. Nothing about them is saved.
  - Stepping in and out, waking rooms, caches, the clear and dusk breaks all happen in the module.
  - The wilds and a dungeon are usually run by different shards. The hunter's trip, return point and any gate they
    just closed travel in the handoff `Carry`. `verifyTicket` validates the `gate` field field by field.
- **Client.**
  - `features/circuit/spells.ts` draws the rift and the rank glyph.
  - `features/gates` provides the hint.
  - The gate plane is treated as underground for terrain, light and object art. The atlas has a "Gate dungeons"
    layer, and the HUD shows the rank.
- **Items (`catalog/gate-items.ts`).** The three stones and three potions.

## Tests

- Shared `gates.test.ts`:
  - every room is reachable from the entry, over several seeds and every rank;
  - the way in and out are clear;
  - daily gates are deterministic, and their rank rises with distance;
  - rewards and monsters exist;
  - each dungeon lies inside one shard region.
- Server `gates.test.ts`:
  - an under-levelled hunter is pushed back;
  - stepping in, a hall waking, and the master spawning with boosted health;
  - the clear pays coins, stones and the first-clear key, and closes the gate;
  - the exit returns you within a few tiles of the gate;
  - a gate left open at dusk breaks, and its monsters spill out.
- Browser `e2e/gates.mjs` (solo build, sharded):
  - the gate is seen in the wilds;
  - entering it is a shard handoff, and the trip carries over;
  - a hall, then the master;
  - the clear toast;
  - back out beside the gate.

## Limits

- **Room-scoped state.** A dungeon's progress (woken rooms, the master) lives in the room that runs it. If that room
  restarts, the dungeon starts fresh, and anyone inside is put back at the spawn shrine.
- **No group tools.** There is no party invite or matchmaking for gates yet. Any hunter strong enough can walk into
  the same gate.
- **No new monster art.** Gates reuse existing monster kinds and art. The master is a hardened, tougher copy, not a
  new creature.
- **No timer or ranking.** There is no Hunter Association, rank exam or leaderboard. First clears are only recorded
  as progress keys.
- **Not profiled on phones.** Performance on real phones has not been measured.
