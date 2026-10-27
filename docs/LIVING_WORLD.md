# Living world, economy and civilizations (master plan §16)

The six kingdoms change from day to day. They grow, quarrel, go to war, hold festivals and tournaments, and trade.
Their roads and wilds hold small stories. Every system is either a pure function of the seed and the world day, or
a small daily step on the server. Nothing simulates individual NPCs off-screen, so the world costs the browser almost
nothing.

## What players get

### Kingdoms that develop on their own

Each kingdom has prosperity, might, stability and a treasury, and these change once per world day:

- **Income and upkeep:** income comes from prosperity and trade, and upkeep from the army.
- **Recruiting:** might rises toward what the treasury can pay for.
- **Public works:** a market hall, stone walls, a granary, a temple, harbour works, a stone bridge or an academy.
  - The kingdom picks a work by need and site and builds it over several days.
  - A finished work keeps paying back. For example, the granary makes food cheaper.
- **Decrees:** each week the crown issues one: Free Market, Royal Tithe, Call to Arms, Royal Feast, War Rations or
  Royal Amnesty. Each decree changes prices and stability.
- **Player deeds count:** trade at kingdom shops and caravans, raids beaten or lost, caravans saved or lost, realm
  quests done and festival cheer all go into the day's ledger and move the numbers.

### Dynamic wars and invasions

- Diplomacy events and lost raids build tension between kingdoms.
- When tension passes 78, a kingdom declares war.
- War raids strike the defender's villages, towns and outposts, using the existing marching-army raids.
- A war ends after at least eight days, once a side is weary or tension falls.

### Court intrigue

When a kingdom's stability drops below 62, a court intrigue starts:

- There are four kinds: plot, scandal, petition and feud.
- The first traveller to act in that kingdom picks one of two answers in the Journal. The choice changes stability,
  treasury or tension, and pays the traveller coins and standing.
- An intrigue that nobody decides within five days festers and costs stability.

### Journal

The Journal's Kingdoms page shows:

- **For each kingdom:** meters, treasury, decree, current work and completed works, and wars.
- **Intrigue:** any open intrigue, with its choices.
- **Chronicle:** the kingdom's recent history.
- **News from the kingdoms:** a combined feed at the top.

### Seasonal festivals and celebrations

Kingdom festivals already existed (two a year each, with crowds, bunting and fireworks), and Hadamere and the home
towns now keep four of their own:

- Blossom Fair (spring);
- Midsummer Lantern Night (summer);
- Harvest Home (autumn);
- Winterfire (winter).

On a festival day:

- **Share a dish:** a player may share one dish at the feast, in that kingdom's settlements or the home towns, from
  the Journal's **Festivals & tournaments** card.
- **The festival's own dish pays best.** Any cooked food is welcome, at half the reward.
- **Cheer:** a kingdom feast adds cheer to that kingdom's ledger.

### Royal tournaments

Each capital holds a tournament from noon to six, every fifth day (staggered between kingdoms) and on every festival:

- **Where:** Goldspire fights in its fenced lists beside the moat; the other capitals use their palace square.
- **The bouts:** three, against the kingdom's own soldiers: a foot soldier, a rider, then the elite champion.
  - The settlement's ward is lifted over the lists only, and only while a bout is fought.
- **Losing:** leaving the lists, dying or running out of time loses the bout.
- **Winning:** the winner takes the purse (half again on a festival), standing, cheer and a champion title such as
  Golden Lance or Thornblade.

### Travelling merchants and trade routes

- **Road caravans:** each of the 24 kingdom roads has one. They trade, can be escorted and get ambushed; see
  [TRAVEL.md](TRAVEL.md).
- **The Wandering Peddler (Pell the Wanderer):**
  - visits a different town of the home continent each day;
  - stands beside its waystone from 08:00 to 18:00;
  - sells rare goods and Recall Shards;
  - belongs to no kingdom and hires no escort.

### Local economic systems

Every kingdom settlement has its own trade:

| Settlement | Makes (cheap)              | Wants (dear)     |
| ---------- | -------------------------- | ---------------- |
| Capital    | finery, charms and potions | food             |
| Town       | tools, arms and armour     | raw materials    |
| Village    | forage, fish, seeds        | tools and arms   |
| Farm       | crops, food, animals       | tools, materials |
| Outpost    | ore and timber             | food and potions |

- **Shortages:** each day one kind of goods runs short in each settlement and costs more there.
- **Combined prices:** the shop price combines standing, diplomacy, the kingdom's state, the local trade and festival
  cheer.
- **Shop note:** the shop window shows a one-line note on the local trade.

### NPC professions, routines and relationships

Residents already had professions, daily schedules, shops and friendship with players. Now each resident also has
two to four mutual ties to neighbours: friends, rivals, sweethearts, kin, mentors and apprentices. In conversation
they now:

- talk about a neighbour, what that neighbour does for a living and where they are at this hour;
- pass on their kingdom's latest news. In Hadamere, the news is "travellers from over the sea";
- mention today's shortage;
- answer a new question, **Who are your neighbours?**

**Ties change over time.** Every pair of neighbours follows its own arc, about 18 world days per step, worked out from
the seed and the day: some friends fall in love, get engaged and marry; sweethearts either wed or part; rivals make
their peace and become friends; apprentices and their mentors become peers. Residents talk about a recent change in
their own life as fresh news and pass on gossip about their neighbours'. On a wedding day the couple's settlement holds a celebration in the plaza
and the street crowd turns festive.

**Hiring residents.** A guard, soldier, archer or commander who counts you a friend (three hearts) offers **Hire me**
in conversation. A contract runs for one world hour for a fee that scales with the role and your level (from 220
coins; commanders from 420). The hired resident follows and fights beside you, and only one player can employ them at
a time. While hired they are missing from their post, and their neighbours say so. Ending a contract early refunds
half of the unused time. The companion window shows **Hired · N min left** and an **End contract** button.

### Royal events

Each kingdom's crown now has a life of its own. On some days a royal event is under way, chosen from the seed, the
day and the kingdom's state: a **royal birth**, a **coronation** (the crown passes to a new monarch, who is named in
the Journal from then on), a **jubilee**, a **royal wedding** (sometimes arranged as part of a peace between two
kingdoms), a **royal hunt**, a **plague** or a **bountiful harvest**. They have real effects:

- Births, coronations, jubilees and weddings are celebrations: stability rises, the capital's plaza hosts a feast and
  the street crowds turn festive.
- A plague raises prices and lowers stability; a bountiful harvest lowers food prices.
- The Journal shows the reigning monarch and the current royal event for each kingdom, and the event enters the
  chronicle.

### Dynamic settlements

The kingdom state shows on the ground, in each settlement's open squares and lawns near its waystone:

- **Public works:** a work under way raises a timber scaffold over stone courses that rise as it progresses. Each
  finished work stands as a plinth monument with the kingdom's pennant and a topper for the work: a balance, a tower
  stub, sacks, an obelisk, an anchor, an arch or a book.
- **Celebration:** a prosperous or feasting realm strings pennants.
- **War:** settlements raided in today's war, and outposts of a kingdom at war, send up smoke.
- **Growth (revision-6 worlds):** prosperous settlements grow. Each settlement earns cottages from its kingdom's
  prosperity (one per ten points above 55) and from the works finished there, up to four. One goes up per world day,
  on the first clear, level, off-road plot of a seeded list around the settlement's edge. The cottages are real
  building cells, the same floors, walls, door, windows and roof that players build with, in the realm's own
  materials: plaster and tile in Aurelion, logs and moss in Sylvaris, granite and slate in Khar-Dum, timber and tile
  in Raijin, sandstone and reed in Thalassara, brick and slate in Nethrakar. They have real collision and are owned by
  the crown, so anyone may open their doors but nobody can take them apart. Nothing is pulled down when times turn
  hard. The chronicle records each new cottage.

### Life on the roads and in the wilds

- **Wayfarers:** seven travellers per kingdom road at a time: pilgrims, couriers, patrols, shepherds with their flock,
  carters with a handcart, minstrels, hunters and families. They keep to the right-hand verge, step aside in towns
  and mostly go home at night; couriers and patrols ride on after dark with lanterns. They greet you as you pass.
- **Wild folk:** woodcutters, foragers, herbalists, hunters, fishers, prospectors and the odd hermit work out in the
  wilds by day, in nearly four of every ten 40×40-tile cells, wandering round their spot and talking to passers-by.
- **Every town is lived in:** home, frontier and cave towns that had no street crowd now have one, with stand-in
  sites when a town has no square.
- **Soundscape:** wind, birdsong, crickets and owls at night, rain and thunder, surf near the shore, the murmur of
  a town and the clang of its forge, and passing voices. A separate **Ambience** volume slider is in Settings.
- **Ground marks:** footprints in snow, sand and wet earth behind you and everyone near you, fading over a minute or
  so; puddles gather on paths and bare earth in rain and dry out afterwards.

### Dungeons and ruins

Ruins with a treasure cache already existed. In new worlds (revision 6), a third of the ruins also hide a **crypt**
with a real interior on its own underground plane:

- **Going down:** the sealed door opens at level 5 or higher and takes you down the stairs to the entrance. Stairs
  in the entrance lead back up to the ruin.
- **Layout:** entrance, a passage, the wardens' hall (pillars, braziers, bones and rubble that differ under every
  ruin), another passage, and the reliquary chamber with its sarcophagi. Torches light the walls.
- **The wardens:** the first time someone walks into the hall, the wardens rise there in three waves (wisps, then a
  vault guardian with wisps, then two guardians and a brute). Everyone in the hall fights them together.
- **Reward:** clearing the hall unseals the reliquary for everyone who fought in it: two ruin loot rolls, coins, XP
  and a chance of a rare find, once per player per crypt.
- **Failure:** if everyone leaves the crypt or dies, or five minutes pass, the wardens sink back and the hall can be
  tried again.

### Companions and mounts

- **Mounts:** the Riding Horse, the Moonlit Stag and the flying Griffin. Mounts can be named and fed at
  every waystone's hitching post. See [TRAVEL.md](TRAVEL.md).
- **Mount stamina and stables:** see [TRAVEL.md](TRAVEL.md).
- **Companions:** the wildlife bonds now have a fourth member, **Emberbrush the fox**. Feed it two eggs to bond it.
  - It does not fight.
  - Its trait, **Keen nose**: every two minutes, while you are ashore and out of combat, it digs up something from
    the land around it, such as hazelnuts in the forest or snow yams in the taiga.
  - Its portrait in the companion window is drawn from its own sprite sheet.

### Environmental storytelling

New worlds (revision 6) have story scenes scattered through the wild, in about four of every ten 72×72-tile cells,
away from settlements, roads and ruins:

- **Cold camp:** a fire ring, a bedroll and a pack with an open journal.
- **Lone grave:** a sword driven into the mound.
- **Overturned cart:** broken crates and a bill of lading.
- **Carved standing stone.**
- **Wayside shrine:** stuffed with notes.

Revision-6 worlds also have:

- **Shipwrecks** on sandy shores (about one per 88×88-tile cell with a beach): a broken hull with the captain's log.
- **Summit cairns** on the local high point of hills (about one per 96×96-tile cell): a stone cairn with the climbers'
  register.

Each scene's words are generated from the seed: names, the nearest kingdom, its capital and the land. Reading one
opens the lore panel. The first reading pays 40 XP and counts toward your stories found.

## Efficient simulation

- **Kingdom state:** one small JSON blob per world (`civ:<seed>`). The server steps it once per world day and catches
  up to 28 missed days at load. Clients receive only a summary, when a day turns or an intrigue is decided.
- **Pure functions of seed and day:** caravans, the peddler, festivals, tournaments, local economies, NPC ties, story
  scenes and crypts. Nothing about them is stored except each player's own progress: met caravans, feasts and
  titles, stories read and reliquaries opened.
- **Settlement dressing:**
  - It is built only for settlements within 110 tiles, and only when the kingdom state changes.
  - Each settlement searches for its plots once.
  - Per frame, the only work is the smoke puffs and the pennant flutter.

## Implementation

| Piece                                                           | File                                                     |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| Kingdom model: daily step, projects, decrees, wars, intrigue    | `packages/shared/src/civ.ts`                             |
| Server: load/step/save, broadcast, intrigue choice, ledger hook | `packages/server/src/features/civ/`                      |
| Festivals, home festivals, tournaments, titles                  | `packages/shared/src/pageantry.ts`                       |
| Server: feasts, tournament bouts and the lifted ward            | `packages/server/src/features/festivals/index.ts`        |
| Local economies                                                 | `packages/shared/src/local-economy.ts`, village `shop()` |
| Wandering Peddler                                               | `packages/shared/src/caravans.ts` (`peddlerAt`)          |
| NPC ties and gossip                                             | `packages/shared/src/npc-ties.ts`, village `talk()`      |
| Settlement dressing (art and placement)                         | `client/src/art/civic.ts`, `features/travel/settlements` |
| Story scenes and crypt placement and words                      | `packages/shared/src/stories.ts`                         |
| Crypt trials                                                    | `packages/server/src/features/crypts/index.ts`           |
| Story and crypt art                                             | `packages/client/src/art/stories.ts`                     |
| Fox companion (Keen nose)                                       | `shared/src/companions.ts`, `server/features/shadows`    |
| Journal: kingdoms, news, intrigue, festivals and tournaments    | `packages/client/src/ui/journal.ts`                      |

## Validation

- **Shared tests:**
  - civ stepping, wars, intrigue and price factors (`civ.test.ts`);
  - local economies;
  - festivals and tournaments, and mutual NPC ties (`pageantry.test.ts`);
  - the peddler's rotation and hours (`travel.test.ts`);
  - the companion roster.
- **Server tests (Postgres):**
  - living kingdoms (`civ.test.ts`);
  - a home feast once per festival, a full three-bout tournament with title, and forfeiting by leaving the lists
    (`festivals.test.ts`);
  - the peddler's shop (`caravans.test.ts`);
  - "Who are your neighbours?" (`village.dialogue.test.ts`);
  - reading a story scene once for XP, a full crypt trial and the reliquary opening once, and the fox bond and its
    find (`living-wild.test.ts`).
- **Browser proof** (`e2e/living-world.mjs`, solo dev build, 2026-10-26):
  - walking to an overturned-cart scene and reading its bill of lading;
  - the Journal's Festivals & tournaments card, showing a tournament day with **Enter the lists**;
  - no page errors.
- **Settlement dressing:** checked in the browser at Harrowgate (Aurelion) with an injected kingdom state. A scaffold
  stood in the market square, a monument on the lawn and pennants nearby.

- **Settlement growth:** server test (`realism.test.ts`): a prosperous kingdom raises whole cottages one step at a
  time, never more than earned, and none come down when prosperity falls. Crypt interiors, evolving ties, royal
  events, wayfarers and wild folk have shared tests (`crypts.test.ts`, `lively.test.ts`, `pageantry.test.ts`,
  `civ.test.ts`); the full crypt flow (down, trial, reliquary, back up) is in `living-wild.test.ts`.
- **Browser proof** (`e2e/lively-world.mjs` and `e2e/living-world.mjs`, solo dev build, 2026-10-27): a shepherd
  and flock on a Khar-Dum road, a wild hunter, street life in a home town, a story scene read, the festivals card and
  the inside of a crypt; no page errors.

## Limits and what is not built

- Crypts are a single fixed floor plan (five rooms), the same under every ruin apart from the scattered bones. There
  are no multi-floor dungeons, puzzles or bosses in them.
- Tournaments are fought against ordinary soldier AI; there is no mounted jousting minigame. The jousting knights
  in Goldspire are cosmetic.
- NPC ties follow seeded arcs. They do not react to what the player does, apart from hiring.
- Settlement growth adds cottages on the outskirts only. Existing town layouts never change, and the cottages are
  empty shells (no furniture or residents of their own). A cottage is only raised in the room that holds its
  settlement, and plots on slopes, roads or occupied ground are skipped, so a settlement can have fewer cottages than
  it has earned.
- Hired residents are a one-hour contract with the existing companion AI; they do not level, equip or persist past
  the contract.
- Wayfarers and wild folk are drawn on each client from the seed and the clock. They cannot be fought, traded with
  or followed home, and other players see the same people only because they compute the same thing.
- Story scenes, crypts, wrecks, cairns and settlement growth exist only in revision-6 worlds, so older worlds' ground
  is untouched.
- The subsequent bestiary batch adds seven wildlife bonds and matching original portraits; see ADVENTURER_PATHS_AND_BESTIARY.md.
