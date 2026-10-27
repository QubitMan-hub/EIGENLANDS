# Adventurer paths and living bestiary

User expanded the active hall batch to complete master-plan §§12–13. Continue inline; no subagents or approval rounds. Preserve original art, quantum mechanics, existing classes, equipped/held item art, saves and all incoming main work.

## Class architecture

Use six family classes plus the existing Superposer and Entangler. At level 10 each family chooses one of the requested named paths: Warrior (Knight, Guardian, Berserker, Samurai, Paladin, Dragoon); Ranged (Archer, Ranger, Marksman, Beast Hunter); Magic (Elementalist, Sorcerer, Summoner, Druid, Necromancer, Chronomancer); Stealth (Rogue, Assassin, Ninja, Shadowblade); Support (Cleric, Bard, Alchemist, Spirit Healer); Hybrid (Spellblade, Beastmaster, Artificer, Runic Engineer, Dragon Tamer, Quantum Weaver). These are thirty distinct specializations, not thirty duplicate independent progression systems.

Each family has four dual-form Circuit abilities and a real resource/ultimate. Each named path unlocks a distinct fifth skill, an enforced passive and equipment guidance; strengths/weaknesses and party effects are explicit. Existing orb progression, level-10 specialization and level-30 second-family rules stay authoritative. Path skills are rejected before choosing that path. Append class indices; do not renumber saved/synced old classes. New ultimates require level 15 and actual earned resource. Friendly wards/heals use the real party and never hostile players. Pets are bounded temporary summons using existing owner-centred companion navigation, damage and reform/cleanup authority; they are not stored as free permanent livestock/roster entries. Equipment advice refers to real existing items and held animations.

## Bestiary architecture

Audit existing passive fauna, livestock, armies, mythical kingdom beasts, ocean/underground creatures and phased bosses before adding missing content. Add original missing mythical/ancient species with unique silhouettes and grounded four-facing idle/move/windup/attack/hurt/death poses. New spawn entries remain sparse, habitat/level/time gated and outside safe towns; no increase to the global hostile budget. Add real territorial/rarity rules and appropriately gated living bonds. Ancient encounters need distinct phase triggers, telegraphs, arenas/rewards and boss-bar identity through existing rendering and persistence.

## Steps and evidence

- [ ] Shared class/path/ability definitions and authorization: RED/GREEN tests for all thirty paths, unique dual forms, old index preservation, path/level/second-family gates and real referenced gear/summons.
- [ ] Server combat/progression: implement the actual effects, bounded summons, earned resource, passives and ultimate; tests exercise all families plus each effect type, party/non-party/range/death checks, cleanup and reconnects. No resource farming from idle self-heals or invulnerable targets.
- [ ] Class UI/animations: group families and paths with guidance, concise weaknesses and unlocks; preserve compact Circuit layout, original quantum classes and real held weapons. Browser-test choosing, attuning, casting and save/reload on desktop/mobile.
- [ ] Audit/expand bestiary and habitats, original art, territorial AI/taming and phased ancient fights with actionable telegraphs and rewards; test spawn/behavior/persistence/loot and inspect every new atlas.
- [ ] Full tests/types/lint/format/both builds, gameplay/art/contrast/performance smoke, documentation and master-plan mapping of shipped evidence versus any genuine remaining scope. Integrate incoming main, require both final-head CI runs green and merge the tested tree.

## Progress

The preceding regional hall work is committed as `b1d7a26`; see GUILD_HALLS.md. Focused shared/client/server and real gameplay/art proof passed, plus types/lint/format. A full shared run caught lost dining tables; two separated briefing groups restore the original guarantee and targeted hall/phase2 tests pass. Full final gates remain required after the new requested scope.
