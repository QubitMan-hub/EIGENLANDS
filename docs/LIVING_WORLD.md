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

### Dynamic settlements

The kingdom state shows on the ground, in each settlement's open squares and lawns near its waystone:

- **Public works:** a work under way raises a timber scaffold over stone courses that rise as it progresses. Each
  finished work stands as a plinth monument with the kingdom's pennant and a topper for the work: a balance, a tower
  stub, sacks, an obelisk, an anchor, an arch or a book.
- **Celebration:** a prosperous or feasting realm strings pennants.
- **War:** settlements raided in today's war, and outposts of a kingdom at war, send up smoke.

### Dungeons and ruins

Ruins with a treasure cache already existed. In new worlds (revision 6), a third of the ruins also hide a **crypt**:

- **Waking the wardens:** touching the sealed door (level 5 or higher) wakes three waves of wardens around it:
  wisps, then a vault guardian with wisps, then two guardians and a brute.
- **Reward:** clearing all three waves opens the reliquary, which holds two ruin loot rolls, coins, XP and a chance
  of a rare find. Each player can open each reliquary once.
- **Failure:** walking more than 22 tiles away, dying or taking more than five minutes lets the wardens sink back,
  and the seal can be tried again.

A crypt is an encounter on the surface around the ruin. There is no separate dungeon map.

### Companions and mounts

- **Mounts:** the Riding Horse, the Moonlit Stag and the flying Griffin. Mounts can be named and fed at
  every waystone's hitching post. See [TRAVEL.md](TRAVEL.md).
- **Companions:** the wildlife bonds now have a fourth member, **Emberbrush the fox**. Feed it two eggs to bond it.
  - It does not fight.
  - Its trait, **Keen nose**: every two minutes, while you are ashore and out of combat, it digs up something from
    the land around it, such as hazelnuts in the forest or snow yams in the taiga.

### Environmental storytelling

New worlds (revision 6) have story scenes scattered through the wild, in about four of every ten 72×72-tile cells,
away from settlements, roads and ruins:

- **Cold camp:** a fire ring, a bedroll and a pack with an open journal.
- **Lone grave:** a sword driven into the mound.
- **Overturned cart:** broken crates and a bill of lading.
- **Carved standing stone.**
- **Wayside shrine:** stuffed with notes.

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

## Limits and what is not built

- Crypts are surface encounters; there are no separate dungeon interiors or multi-floor dungeons.
- Tournaments are fought against ordinary soldier AI; there is no mounted jousting minigame. The jousting knights
  in Goldspire are cosmetic.
- NPC relationships are fixed by the roster. They do not change over time or react to the player.
- Settlement dressing is decoration only. It does not change buildings, layouts or collision.
- Story scenes and crypts exist only in revision-6 worlds, so older worlds' ground is untouched.
- The fox has no portrait art in the companion window yet: its crest is shown empty.
