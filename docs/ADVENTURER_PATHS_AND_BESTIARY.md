# Adventurer paths and living bestiary

This batch implements master-plan §§12–13 while preserving Superposer, Entangler, the Circuit Board, existing saves and incoming living-world changes. Regional guild halls and expedition tracking are described in [GUILD_HALLS.md](GUILD_HALLS.md); the subsequent boss redesign is described in [BOSS_ART.md](BOSS_ART.md).

## Classes

Six new families share existing orb/level progression. At level 10 each chooses one of thirty distinct specializations:

| Family  | Specializations                                                                  |
| ------- | -------------------------------------------------------------------------------- |
| Warrior | Knight, Guardian, Berserker, Samurai, Paladin, Dragoon                           |
| Ranged  | Archer, Ranger, Marksman, Beast Hunter                                           |
| Magic   | Elementalist, Sorcerer, Summoner, Druid, Necromancer, Chronomancer               |
| Stealth | Rogue, Assassin, Ninja, Shadowblade                                              |
| Support | Cleric, Bard, Alchemist, Spirit Healer                                           |
| Hybrid  | Spellblade, Beastmaster, Artificer, Runic Engineer, Dragon Tamer, Quantum Weaver |

Each family has four dual-form core abilities and an earned-resource ultimate. Each path adds a distinct fifth dual-form technique, enforced passive strengths/trade-offs and equipment guidance referencing actual held items. There are 54 new dual-form abilities, in addition to the original quantum abilities. These are thirty specializations across six families, not thirty unrelated progression systems.

Directional strikes respect forward arcs, reach and walls; bolts, blinks, rings, slows, shields, party healing/wards and temporary summons execute through the normal server engine. Family damage/range/support rules and path traits affect actual combat. Resource requires effective hostile hits or effective aid to party members; idle/full-health self-healing cannot fill an ultimate. Ultimates require level 15 and 100 resource. Temporary summons follow and defend their owner, expire, do not enter permanent rosters and are bounded to two per owner/eight owner units/32 room temporaries. Permanent companion damage benefits from the appropriate paths without double-buffing temporary summons.

The existing Board → Path page groups class choices behind a native family selector, shows real gear and trade-offs, and reveals the chosen family's paths. Specialization skills require the actual selected path; level-30 second-family abilities preserve the existing authorization rules. Old class indices remain unchanged. Existing aimed-cast controls and held weapon animations remain; no permanent class panel is added.

## Creatures and encounters

Twenty-nine definitions append to the stable enemy order: cow, sheep, pig and horse match existing ranch art, followed by 25 new creatures. New art covers birds, fish, a woodland spirit, nine missing hostile types, eight mythical types and five ancient bosses. Existing rabbits, deer, foxes, wolves, turtles, livestock, kingdom beasts, ocean creatures and underground encounters remain. The Journal field bestiary records visible sightings, retains them after reconnecting, and exposes only recorded species, with habitat, behavior, real loot and bond instructions. Ranch livestock count as sightings even though they synchronize as NPC actors.

Rare surface species respect biome, level and time gates within existing encounter budgets. Undead and rogue mages require night. Territorial rivals are spaced; creatures return home instead of chasing indefinitely. Nearby predators disturb wildlife, prey flees, and close predation yields no player rewards. Trolls regrow after respite; hits suppress it and Ember/Crownfire suppress it longer. Phoenixes revive once before their final kill. Other patterns include multi-headed/breath fans, gaze attacks, stamina-draining webs/storms, siphoning, siren pulls and hurt-triggered mage repositioning.

Selected mythical living bonds extend existing wildlife companions: Dawnmane the unicorn requires level 18 and honey; Galesworn the griffin requires level 22, food and Colossus victory; Cinderbond the dragon requires level 24, food and First Flame victory. Normal health, calmness, strength, range, line-of-sight, food, ownership and roster-slot rules still apply. The unicorn supports resting nearby party members; the griffin pushes threats away; the dragon blocks regrowth. Ancient bosses cannot be tamed or extracted. Main's fox companion and forage behavior remain integrated.

## Ancient progression

| Encounter                      | Place / level                       | Mechanic / guaranteed progression trophy                         |
| ------------------------------ | ----------------------------------- | ---------------------------------------------------------------- |
| Azhur, First Flame             | Broad desert clearing / 24          | Crossing breath lanes and poise interrupts / First-Flame Ember   |
| Orrun, the Remembering Tide    | Deep open water, aboard a boat / 26 | Staggered tidal rings / Remembering Pearl                        |
| The Unwritten King             | Surveyed Undercroft arena / 28      | Four seal sentries renew at phase changes / Unwritten Page       |
| Morrowforge, Last of the First | Broad taiga clearing / 30           | Moving hammer fracture line / Morrowforge Core                   |
| Asterion, Keeper of Six Gates  | Broad enchanted clearing / 32       | Alternating gate sectors and delayed convergence / Sixfold Crown |

Crafted rites form a trophy chain starting with Veyr's Storm Heart, plus wild essence, Qubit Crystals and gold ingots. The final crown refines into 32 Qubit Crystals with essence. Each ancient fight has four health phases, distinct fixed ground marks before impact, a recovery window, an arena rune design and a custom health-bar theme. Stagger cancels warned strikes. Sentries, marks and abandoned arenas clean up. Only living contributors and their nearby party members receive ancient first-victory progress. Inventory authority spends one rite only after a successful summon; trophies and victory records survive reloads.

## Validation and limits

Shared tests cover all thirty paths, skill/gear references, stable kinds, valid drops/recipes, habitat rarity, ancient gates and extraction restrictions. Real server tests exercise class choice, skill authorization, strikes/walls, party aid, resources, all six ultimates, summon lifecycle, ecological rules, sighting persistence, taming gates and ancient encounters/rewards. Browser replays cover class/path choice, aimed casting, the journal, sprites, bosses, mobile layouts and saved progress. [Boss art proof](BOSS_ART.md) covers the original production sheets and runtime presentation.

Initial numerical tuning is implemented; extended player-group balance sessions and physical low-end-device measurements remain ongoing game-wide work. The equipment guidance uses the existing item catalog and real item animations; this batch does not promise thirty new armor sets, new player body rigs or a new class-only gear economy.
