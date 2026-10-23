# EIGENLANDS master development checklist

Source: [complete user request](design/master-request.md). Both pasted uploads are identical. This checklist preserves every request paragraph and subrequirement. A checked entry requires code, passing tests, integration and visual evidence; prior partial implementations are not blanket completion.

## Audit and execution record

- [x] IMPLEMENTED & TESTED — Prior completed work merged in PRs #2, #3 and #4; main baseline 54cf502. Clean feature branch preserves new work.
- [x] IMPLEMENTED & TESTED — Functional furnished upper floors, charter-gated underwater sanctuaries, timed traps and platform circuits. Three shared and four server integration checks passed; real solo/multiplayer reload, stairs, diving, platform chamber and sloop return passed. Integration to main follows PR CI.
- [~] IN PROGRESS — Impeccable HUD and inventory pass: bronze material framing, numeric health, search/category/view sorting, touch item actions and keyboard focus containment. Desktop/touch-landscape interaction and prop bounds checks passed. Maps and deeper combat/progression UI remain open.
- [!] BUG / BLOCKED — No physical low-end Android/iOS devices or cross-network hardware are attached. Browser emulation cannot verify native performance/orientation.
- [!] BUG / BLOCKED — Uploaded external art archives have no specific reuse license. Existing matching repository sheets and new original art remain usable; do not import unverified artwork.

Implementation references: `packages/client/src/art`, `game`, `ui`, `features`; `packages/shared/src`; `packages/server/src`. Dependencies: preserve shared authoritative rules, chunk/shard persistence and existing saves. Evidence: this continuation passed all 400 workspace tests (47 client, 215 server, 138 shared), typechecks and both production builds, plus solo/multiplayer and mobile browser checks. Only individually listed slices are complete; the full master overhaul remains IN PROGRESS.

## Implementation map and remaining dependencies

The full source checklist below is a conservative acceptance list. Broad aesthetic goals remain open even where existing systems already provide part of the functionality. This table identifies actual shipped foundations and concrete next work; a NOT STARTED source line must not be read as permission to replace working systems.

| Feature | Current implementation / relevant modules | Dependencies and remaining work | Evidence / limits |
| --- | --- | --- | --- |
| Art, ecology, forty coastal residents, four settlements, sailing, equipment | IN PROGRESS overall; prior PRs #2–#4, client/art, shared/settlements, server sailing/village | Bespoke per-biome/room/boss pass, more creature families and weapon families | Prior 391-test baseline and art/play captures recorded in art/overhaul-notes.md |
| Functional floors and underwater challenges | IMPLEMENTED & TESTED slice; shared/floors.ts, sanctuaries.ts; containers.ts, shrine module, Game.ts | Merge after CI; broader authored interior variety and integrated architectural backdrops remain | Three shared tests and four authoritative integration checks; genuine collision spaces, no decorative-only stairs |
| HUD and pack | IN PROGRESS; ui/hud.css, inventory.ts, inventory-query.ts, windows.ts | Finish inventory comparisons, actual survival data before survival bars; enemy/boss/progression/map overhaul | Two inventory rules tests; desktop/landscape search/category/sort/actions/focus and all six prop bounds passed |
| Navigation and maps | NOT STARTED for requested atlas; existing remapping, predictor, iso camera retained | Resolve M voice vs map, C crafting vs character and J attack vs journal; explored-chunk map data, bounded cache, waypoints and minimap | Do not reveal unexplored terrain or pre-generate an infinite world |
| Survival and meaningful progression | NOT STARTED expansion; existing food/healing, fishing, recipes, seasons retained | Persisted hunger/thirst/temperature and modes, water/bandage items, fair tuning; no invented HUD values | Existing shared/server tests cover incumbent inventory/crafting/fishing |
| Building and farming | IN PROGRESS foundation only; existing construction, crops, farm animals, furniture | User-placeable houses/roofs/stairs, deeper livestock and crafting loops, legal collision/persistence | Existing functionality preserved; master acceptance remains open |
| Companion and hiring expansion | NOT STARTED; existing ShadowModule follows/fights/persists | Original creature companion identities/skills, taming, NPC lease ownership and relationship gates, actual travelling merchants | No placeholder recruitment or movement-only pets added |
| Classes, kingdoms, guilds and realms | NOT STARTED expansion; existing quantum classes, circuits, bosses, shrines retained | Six named kingdoms and three named realms with real progression/persistence, guild F–SSS and additional classes | Underwater sanctuaries are not presented as the requested three realms |
| Private friend worlds / inexpensive hosting | NOT STARTED private-world implementation; current shared solo server and sharded multiplayer retained | Per-world authorization, 2–8 player create/join/share, world persistence separation and hosting measurements | No new paid service or dependency; current compose/Pages setup unchanged |
| Hardware and third-party licenses | BUG / BLOCKED | Physical low-end devices, cross-network devices and specific license evidence | Emulated landscape is not hardware performance proof; “free package” alone does not establish reuse terms |

## Request checklist (unreviewed entries remain NOT STARTED)


## EIGENLANDS — THE DEFINITIVE MASTER OVERHAUL PROMPT


## The Ultimate Isometric Fantasy RPG, Survival, Civilization, Multiplayer & Visual Design Overhaul

**Repository:** https://github.com/QubitMan-hub/EIGENLANDS

## 0. THE MISSION — READ EVERYTHING

- [ ] NOT STARTED — Transform EIGENLANDS into an exceptionally beautiful, deeply immersive, browser-based **isometric pixel-art medieval fantasy RPG**, featuring private multiplayer, an enormous procedural world, living civilizations, survival, crafting, building, exploration, magical creatures, and interconnected gameplay systems.
- [ ] NOT STARTED — I want the creative freedom of Minecraft, the challenging survival of RLCraft, the content depth of Terraria, the charm of Stardew Valley, the exploration of Zelda, the environments of Core Keeper, and the fantasy civilization-building of *That Time I Got Reincarnated as a Slime*.
- [ ] NOT STARTED — For its visuals, take inspiration from *Octopath Traveler, Eastward, Sea of Stars, CrossCode, Hyper Light Drifter,* and outstanding isometric pixel-art games.
- [ ] NOT STARTED — For worldbuilding, study *Frieren, Mushoku Tensei, Delicious in Dungeon, Overlord,* and *That Time I Got Reincarnated as a Slime*.
- [ ] NOT STARTED — For autonomous world systems, take inspiration from *Kenshi, RimWorld,* and *Dwarf Fortress*.
- [ ] NOT STARTED — **This must become one coherent, original game—not a collection of disconnected features.**

### Absolute instructions

- [x] IMPLEMENTED & TESTED — 1. **DO NOT SPAWN SUBAGENTS.** Work directly to minimize token consumption.
- [x] IMPLEMENTED & TESTED — 2. Use my installed Claude skills whenever appropriate, especially **Impeccable** for UI/UX and applicable pixel-art skills.
- [x] IMPLEMENTED & TESTED — 3. Audit the entire repository, relevant branches, existing implementation, and previous improvements before modifying anything.
- [ ] NOT STARTED — 4. Safely merge all previously completed work into the intended main branch. Preserve valuable code and uncommitted changes, resolve conflicts, and verify functionality.
- [ ] NOT STARTED — 5. Finish the remaining overhaul, including incomplete or broken work.
- [ ] NOT STARTED — 6. **Everything must be genuinely isometric.** Terrain, houses, furniture, creatures, characters, equipment, animations, and interactive objects must follow consistent isometric geometry.
- [ ] NOT STARTED — 7. Preserve the existing quantum identity and functional systems.
- [ ] NOT STARTED — 8. No fake features, placeholder implementations presented as finished, unnecessary complexity, or untested claims.
- [ ] NOT STARTED — 9. Prioritize visual excellence, gameplay feel, performance, browser compatibility, customer-grade usability, and minimal hosting costs.
- [ ] NOT STARTED — 10. Maintain a persistent development checklist and continuation document throughout implementation.
- [ ] NOT STARTED — 11. Build actual working features and test them in the running game.
- [ ] NOT STARTED — 12. Do not sacrifice working functionality merely to make the repository smaller.

## 1. MANDATORY PROJECT MEMORY — NEVER FORGET THIS PROMPT

- [x] IMPLEMENTED & TESTED — Immediately create and maintain:
- [x] IMPLEMENTED & TESTED — `docs/EIGENLANDS_MASTER_PLAN.md`
- [x] IMPLEMENTED & TESTED — `docs/CONTINUE_HERE.md`
- [x] IMPLEMENTED & TESTED — `docs/DESIGN_SYSTEM.md`
- [ ] NOT STARTED — These documents must prevent requirements from being forgotten, repeated, or falsely marked complete.

### MASTER PLAN

- [ ] NOT STARTED — Break down **every requirement in this prompt** into actionable, trackable features, including all subrequirements.
- [ ] NOT STARTED — Use these exact statuses:
- [ ] NOT STARTED — `[ ] NOT STARTED`
- [ ] NOT STARTED — `[~] IN PROGRESS`
- [ ] NOT STARTED — `[x] IMPLEMENTED & TESTED`
- [ ] NOT STARTED — `[!] BUG / BLOCKED`
- [ ] NOT STARTED — `[-] DEFERRED`
- [ ] NOT STARTED — For each major feature, record:
- [ ] NOT STARTED — Current implementation status.
- [ ] NOT STARTED — Relevant files and modules.
- [ ] NOT STARTED — Dependencies.
- [ ] NOT STARTED — Remaining work.
- [ ] NOT STARTED — Tests performed and outcomes.
- [ ] NOT STARTED — Known bugs.
- [ ] NOT STARTED — Visual quality and integration status.

### CONTINUE HERE

- [ ] NOT STARTED — Record the current branch, completed work, active tasks, architectural decisions, blockers, and precise next steps.
- [ ] NOT STARTED — Before starting a new development session, read these documents and verify their accuracy against the code.
- [ ] NOT STARTED — Before finishing, update them.
- [ ] NOT STARTED — Never rely solely on conversational memory.

### DESIGN SYSTEM

- [ ] NOT STARTED — Document the game's visual identity, isometric sprite specifications, UI components, palettes, typography, HUD layout, spacing, animations, art direction, and explicit anti-patterns.
- [ ] NOT STARTED — The design system must guide every future addition.
- [ ] NOT STARTED — **Documentation exists to support implementation, not replace it.**

## 2. COMPLETE ISOMETRIC PIXEL-ART OVERHAUL

- [ ] NOT STARTED — Overhaul every poor-quality or inconsistent asset until the entire game feels like a premium handcrafted fantasy RPG.
- [ ] NOT STARTED — Take visual inspiration from:
- [ ] NOT STARTED — Octopath Traveler — cinematic lighting and atmosphere.
- [ ] NOT STARTED — Eastward — beautiful detailed pixel environments.
- [ ] NOT STARTED — Sea of Stars — rich colors and fantasy environments.
- [ ] NOT STARTED — Stardew Valley — cozy environments and furnishings.
- [ ] NOT STARTED — Core Keeper — underground atmosphere and environmental detail.
- [ ] NOT STARTED — Songs of Conquest — medieval fantasy architecture.
- [ ] NOT STARTED — Minecraft — creative freedom, environmental variety, and building systems.

### Mandatory improvements

- [ ] NOT STARTED — Consistent isometric perspective across everything.
- [ ] NOT STARTED — Correct visible surfaces, shading, pixel scale, silhouettes, and depth sorting.
- [ ] NOT STARTED — Beautiful terrain transitions and biome-specific assets.
- [ ] NOT STARTED — Distinct kingdom architecture and furniture.
- [ ] NOT STARTED — Properly furnished houses, taverns, shops, castles, guild halls, and workshops.
- [ ] NOT STARTED — Detailed character and creature animations.
- [ ] NOT STARTED — Beautiful spell effects, combat effects, water, fire, smoke, and magical phenomena.
- [ ] NOT STARTED — Wind-responsive trees, grass, banners, and crops.
- [ ] NOT STARTED — Rain, thunderstorms, fog, snow, and weather-responsive environments.
- [ ] NOT STARTED — Dynamic lighting, day/night cycles, and seasonal atmosphere.
- [ ] NOT STARTED — Small environmental details that make the world feel lived in.
- [ ] NOT STARTED — **Do not simply rotate flat sprites into isometric space.** Redesign their geometry, visible faces, sprite anchors, shading, and pixel clusters.
- [ ] NOT STARTED — Useful asset sources:
- [ ] NOT STARTED — https://itch.io/game-assets
- [ ] NOT STARTED — https://opengameart.org/
- [ ] NOT STARTED — https://kenney.nl/assets
- [ ] NOT STARTED — https://craftpix.net/
- [ ] NOT STARTED — https://lospec.com/
- [ ] NOT STARTED — Use only original or properly licensed assets. Verify license terms and maintain a consistent art direction.

## 3. COMPLETE UI/HUD REVOLUTION — ZERO AI SLOP

- [ ] NOT STARTED — **THIS IS NOW ONE OF THE HIGHEST PRIORITIES OF THE ENTIRE PROJECT.**
- [ ] NOT STARTED — Completely redesign the entire game's interface.
- [~] IN PROGRESS — The existing health bars, enemy health displays, combat HUD, inventory, progression board, menus, and other UI elements must be reviewed and transformed wherever they fall short of exceptional quality.
- [ ] NOT STARTED — I want an interface that feels designed by an outstanding professional game UI artist—not generated from generic AI dashboard patterns.

### Use Impeccable

- [ ] NOT STARTED — Use the installed **Impeccable** skill to audit, critique, redesign, polish, and refine every major UI screen and component.
- [ ] NOT STARTED — First read its actual installed instructions. Use its supported audit, critique, polish, typography, animation, accessibility, and visual verification workflows wherever relevant.
- [ ] NOT STARTED — If the skill is unavailable, document that limitation and follow equivalent professional design-review principles rather than pretending it was used.
- [ ] NOT STARTED — Preserve strong existing design elements instead of blindly replacing everything.

### Eliminate generic AI-generated UI

- [ ] NOT STARTED — Avoid:
- [ ] NOT STARTED — Generic SaaS-style cards and dashboard layouts.
- [ ] NOT STARTED — Random purple-blue gradients.
- [ ] NOT STARTED — Excessively rounded rectangles everywhere.
- [ ] NOT STARTED — Unnecessary glassmorphism.
- [ ] NOT STARTED — Floating panels with meaningless decorative effects.
- [ ] NOT STARTED — Inconsistent borders, shadows, and typography.
- [ ] NOT STARTED — Oversized interfaces that cover the game world.
- [ ] NOT STARTED — Generic icons unrelated to the game's fantasy identity.
- [ ] NOT STARTED — Excessive text, clutter, and repetitive visual patterns.
- [ ] NOT STARTED — Poor spacing, awkward alignment, and unrelated design elements.
- [ ] NOT STARTED — Animations that look flashy but make gameplay harder to understand.
- [ ] NOT STARTED — Instead create a distinctive, handcrafted **medieval fantasy RPG interface** with original visual identity, carefully chosen materials, subtle ornamentation, excellent hierarchy, tasteful animation, and exceptional usability.

## 3.1 Player Health, Mana, Stamina, Hunger & Thirst

- [ ] NOT STARTED — Completely redesign the player HUD.
- [ ] NOT STARTED — Create visually extraordinary yet readable health, mana, stamina, food, and thirst indicators.
- [ ] NOT STARTED — Consider a cohesive combination of:
- [ ] NOT STARTED — Carefully designed ornamental frames.
- [ ] NOT STARTED — Subtle metal, carved stone, leather, rune, or fantasy-material detailing.
- [ ] NOT STARTED — Pixel-perfect bar fills and borders.
- [ ] NOT STARTED — Distinctive silhouettes.
- [ ] NOT STARTED — Beautiful but restrained highlights.
- [ ] NOT STARTED — Smooth, informative animations.
- [ ] NOT STARTED — Contextual status effects.
- [ ] NOT STARTED — **Health bar**
- [ ] NOT STARTED — Distinct visual identity.
- [ ] NOT STARTED — Satisfying damage feedback.
- [ ] NOT STARTED — Smooth health loss and recovery animations.
- [ ] NOT STARTED — Clear low-health warning.
- [ ] NOT STARTED — Readable numerical values where useful.
- [ ] NOT STARTED — Status effects and shields displayed intelligently.
- [ ] NOT STARTED — **Mana / magic**
- [ ] NOT STARTED — Thematically distinct from health.
- [ ] NOT STARTED — Subtle magical effects.
- [ ] NOT STARTED — Readable resource consumption and regeneration.
- [ ] NOT STARTED — **Stamina**
- [ ] NOT STARTED — Clear sprinting, dodging, and exertion feedback.
- [ ] NOT STARTED — Never obscure movement or combat.
- [ ] NOT STARTED — **Hunger and thirst**
- [ ] NOT STARTED — Both visible and instantly understandable.
- [ ] NOT STARTED — Beautiful, compact fantasy-style icons and bars.
- [ ] NOT STARTED — Clear warnings without constantly interrupting gameplay.
- [ ] NOT STARTED — Add temperature, injuries, buffs, debuffs, and other conditions through a clean expandable status system.
- [ ] NOT STARTED — Do not cram everything into an oversized HUD.

## 3.2 Monster & Boss Health Bars

- [ ] NOT STARTED — Completely overhaul health displays for enemies.

### Normal monsters

- [ ] NOT STARTED — Elegant, compact health indicators.
- [ ] NOT STARTED — Display names and levels appropriately.
- [ ] NOT STARTED — Optional small status icons.
- [ ] NOT STARTED — Smooth damage feedback.
- [ ] NOT STARTED — Clear visual distinction between hostile, neutral, friendly, and elite creatures.

### Elite and mythical enemies

- [ ] NOT STARTED — More distinctive frames.
- [ ] NOT STARTED — Unique enemy classification indicators.
- [ ] NOT STARTED — Readable resistance, shield, or phase information.

### Legendary bosses

- [ ] NOT STARTED — Create **spectacular custom boss health bars**.
- [ ] NOT STARTED — For example, an Ancient Dragon could have a beautifully illustrated dragon-themed boss frame with subtle glowing runes, clear phase markers, and a distinctive name treatment.
- [ ] NOT STARTED — An Abyssal Titan, Celestial Guardian, and Demon Sovereign should not all have the exact same generic rectangular bar.
- [ ] NOT STARTED — Boss HUDs must look memorable and cinematic without obstructing attacks or sacrificing clarity.
- [ ] NOT STARTED — Add:
- [ ] NOT STARTED — Health-phase transitions.
- [ ] NOT STARTED — Shield or armor indicators.
- [ ] NOT STARTED — Status effect displays.
- [ ] NOT STARTED — Clear damage feedback.
- [ ] NOT STARTED — Boss name and title.
- [ ] NOT STARTED — Optional encounter-specific mechanics.
- [ ] NOT STARTED — Ensure all styles remain part of one unified design system.

## 3.3 Complete Interface Overhaul

- [ ] NOT STARTED — Redesign and unify:
- [ ] NOT STARTED — Main menu and title screen.
- [ ] NOT STARTED — Character creation and class selection.
- [ ] NOT STARTED — Inventory and equipment.
- [ ] NOT STARTED — Crafting and recipe book.
- [ ] NOT STARTED — Cooking and alchemy interfaces.
- [ ] NOT STARTED — Farming and animal-management screens.
- [ ] NOT STARTED — Guild registration and identity cards.
- [ ] NOT STARTED — F-to-SSS adventurer rank presentation.
- [ ] NOT STARTED — Quest boards and journals.
- [ ] NOT STARTED — Shop and trading screens.
- [ ] NOT STARTED — Building mode and placement previews.
- [ ] NOT STARTED — Dialogue interfaces.
- [ ] NOT STARTED — Multiplayer lobby and invitations.
- [ ] NOT STARTED — Party frames.
- [ ] NOT STARTED — Map and minimap.
- [ ] NOT STARTED — Quantum progression board.
- [ ] NOT STARTED — Skill trees.
- [ ] NOT STARTED — Death, respawn, victory, and level-up screens.
- [ ] NOT STARTED — Settings and keybindings.
- [ ] NOT STARTED — Notifications, tooltips, and interaction prompts.

### Guild UI

- [ ] NOT STARTED — Make physical guild quest boards look like beautiful medieval noticeboards, not ordinary website tables.
- [ ] NOT STARTED — Adventurer cards should look like actual fantasy guild identification cards, with rank-specific detailing and exceptional pixel art.
- [ ] NOT STARTED — SSS-rank cards should feel genuinely prestigious.

### Inventory UI

- [~] IN PROGRESS — Design an excellent inventory system with beautiful item icons, clear categories, equipment slots, search, sorting, comparison, and responsive interactions.

### Interaction feedback

- [ ] NOT STARTED — Add tasteful micro-interactions:
- [ ] NOT STARTED — Item pickup effects.
- [ ] NOT STARTED — Crafting completion feedback.
- [ ] NOT STARTED — Skill unlock effects.
- [ ] NOT STARTED — Rank promotion presentations.
- [ ] NOT STARTED — Quest completion celebrations.
- [ ] NOT STARTED — Rare loot discovery effects.
- [ ] NOT STARTED — Beautiful but restrained hover and selection states.

### Visual acceptance requirements

- [ ] NOT STARTED — Use the actual running browser game to inspect the interface at its intended resolutions.
- [ ] NOT STARTED — Capture and review important gameplay states, including combat, menus, inventory, crafting, maps, boss encounters, low health, multiplayer, and survival warnings.
- [ ] NOT STARTED — Critique the results, fix visual inconsistencies, and repeat a bounded improvement cycle.
- [ ] NOT STARTED — **The UI should be distinctive enough that screenshots immediately look like EIGENLANDS—not a generic AI-generated RPG template.**

## 4. COMPLETE CONTROLS, MOVEMENT & CAMERA OVERHAUL

- [ ] NOT STARTED — Significantly improve the controls across the entire game.

### Movement

- [ ] NOT STARTED — Smooth responsive WASD controls mapped correctly to isometric movement.
- [ ] NOT STARTED — Normalized diagonal speed.
- [ ] NOT STARTED — Precise collision and pathing.
- [ ] NOT STARTED — Excellent character animation transitions.
- [ ] NOT STARTED — Responsive sprinting and dodging.
- [ ] NOT STARTED — Optional click-to-move where appropriate.
- [ ] NOT STARTED — No stuck characters or awkward movement.

### Combat

- [ ] NOT STARTED — Precise aiming and targeting.
- [ ] NOT STARTED — Responsive attacks and abilities.
- [ ] NOT STARTED — Clear enemy hitboxes and attack telegraphs.
- [ ] NOT STARTED — Easy weapon, tool, and spell switching.
- [ ] NOT STARTED — Reliable skill activation and combat feedback.

### Camera

- [ ] NOT STARTED — Smooth camera following.
- [ ] NOT STARTED — Configurable zoom.
- [ ] NOT STARTED — Proper handling of buildings, interiors, obstacles, and large bosses.
- [ ] NOT STARTED — No jitter or incorrect rendering order.
- [ ] NOT STARTED — Optional camera effects and shake.

### Default controls

- [ ] NOT STARTED — | Key | Action |
- [ ] NOT STARTED — | WASD | Move |
- [ ] NOT STARTED — | Shift | Sprint |
- [ ] NOT STARTED — | Space | Dodge / context action |
- [ ] NOT STARTED — | E | Interact |
- [ ] NOT STARTED — | I | Inventory |
- [ ] NOT STARTED — | C | Character |
- [ ] NOT STARTED — | K | Skills |
- [ ] NOT STARTED — | J | Quests |
- [ ] NOT STARTED — | M | World Map |
- [ ] NOT STARTED — | G | Guild / Party |
- [ ] NOT STARTED — | B | Building Mode |
- [ ] NOT STARTED — | Tab | Quick Menu |
- [ ] NOT STARTED — | 1–9 | Hotbar |
- [ ] NOT STARTED — | Esc | Pause / Back |
- [ ] NOT STARTED — Audit existing mappings, resolve conflicts, and make controls remappable.
- [ ] NOT STARTED — Prevent browser-specific issues such as page scrolling, lost focus, stuck keys, and accidental gameplay input while typing.
- [ ] NOT STARTED — Play-test controls during combat, building, farming, swimming, mounted travel, teleportation, and multiplayer.

## 5. BEAUTIFUL MINIMAP & LARGE WORLD MAP


## Live minimap

- [ ] NOT STARTED — Add a beautiful, performant minimap in the top-right corner.
- [ ] NOT STARTED — Include:
- [ ] NOT STARTED — Player position and direction.
- [ ] NOT STARTED — Nearby buildings, terrain, roads, water, and landmarks.
- [ ] NOT STARTED — Friendly players and party members.
- [ ] NOT STARTED — Relevant NPCs and enemies.
- [ ] NOT STARTED — Quest locations and teleporters.
- [ ] NOT STARTED — Discovered locations.
- [ ] NOT STARTED — Fog of war.
- [ ] NOT STARTED — Custom waypoints.
- [ ] NOT STARTED — Allow resizing, hiding, and display preferences.

## Full world map — M

- [ ] NOT STARTED — Pressing **M** must open the full interactive world map.
- [ ] NOT STARTED — Press M again or Esc to close it.
- [ ] NOT STARTED — The map should support:
- [ ] NOT STARTED — Zoom and pan.
- [ ] NOT STARTED — Exploration fog.
- [ ] NOT STARTED — Six kingdoms and their territories.
- [ ] NOT STARTED — Three realm-specific maps.
- [ ] NOT STARTED — Capital cities, villages, ports, roads, and landmarks.
- [ ] NOT STARTED — Dungeons, guild halls, teleporters, and discovered locations.
- [ ] NOT STARTED — Quest markers.
- [ ] NOT STARTED — Custom waypoints.
- [ ] NOT STARTED — Multiplayer party positions where permitted.
- [ ] NOT STARTED — Filters, legends, and location information.
- [ ] NOT STARTED — The maps must reflect procedural exploration and saved world changes.
- [ ] NOT STARTED — Use chunk-based map generation, caching, and efficient rendering rather than trying to generate the infinite world at once.
- [ ] NOT STARTED — Make map interfaces aesthetically exceptional and consistent with the UI overhaul.

## 6. THE INFINITE WORLD & SIX GREAT KINGDOMS

- [ ] NOT STARTED — Maintain a massive, effectively infinite procedural world containing six major, persistent civilizations.
- [ ] NOT STARTED — Each must have distinct architecture, climate, history, culture, economy, ruler, military, politics, inhabitants, and quests.

## I. Aurelion — Golden Kingdom

- [ ] NOT STARTED — Grand European-inspired medieval civilization.
- [ ] NOT STARTED — Golden castles, fertile plains, cathedral-like halls, knightly orders, villages, and royal tournaments.
- [ ] NOT STARTED — Army: Knights, infantry, cavalry, archers, griffin riders, royal guards.

## II. Sylvaris — Verdant Kingdom

- [ ] NOT STARTED — Ancient forest civilization.
- [ ] NOT STARTED — Living tree settlements, enchanted forests, mystical lakes, ancient spirits, druids, and magical wildlife.
- [ ] NOT STARTED — Army: Elven archers, forest guardians, spirit cavalry, druids, woodland creatures.

## III. Khar-Dum — Iron Kingdom

- [ ] NOT STARTED — Dwarven mountain civilization.
- [ ] NOT STARTED — Enormous fortresses, mines, underground cities, furnaces, mechanical gates, and legendary craftsmen.
- [ ] NOT STARTED — Army: Heavy infantry, runic warriors, golems, siege engineers, armored mountain units.

## IV. Raijin Shogunate — Storm Kingdom

- [ ] NOT STARTED — Feudal Japan-inspired fantasy civilization.
- [ ] NOT STARTED — Pagodas, cherry blossoms, bamboo forests, temples, misty mountains, and ancient shrines.
- [ ] NOT STARTED — Army: Samurai, shinobi, mounted warriors, thunder beasts, spirit swordsmen.

## V. Thalassara — Ocean Kingdom

- [ ] NOT STARTED — Magnificent underwater and island civilization.
- [ ] NOT STARTED — Coral palaces, underwater cities, glowing reefs, ancient ruins, tropical islands, and harbors.
- [ ] NOT STARTED — Army: Sea knights, merfolk, sirens, aquatic cavalry, royal fleets, and leviathan allies.
- [ ] NOT STARTED — Add ships, sailing, underwater exploration, aquatic farming, and ocean trade.

## VI. Nethrakar — Demon Kingdom

- [ ] NOT STARTED — Complex fantasy monster civilization.
- [ ] NOT STARTED — Obsidian fortresses, crimson forests, magical cities, dark ruins, and ancient supernatural societies.
- [ ] NOT STARTED — Army: Demon knights, shadow mages, hellhound cavalry, monstrous infantry, and draconic allies.
- [ ] NOT STARTED — **The demon kingdom is not inherently evil.** It must have its own culture, values, alliances, motivations, and opportunities for peaceful interaction.

### Every kingdom requires

- [ ] NOT STARTED — A distinct named ruler and personality.
- [ ] NOT STARTED — Royal court and advisors.
- [ ] NOT STARTED — Capital city, towns, villages, farms, and military outposts.
- [ ] NOT STARTED — Infantry, cavalry, commanders, and mythical units.
- [ ] NOT STARTED — Culture, traditions, festivals, architecture, and cuisine.
- [ ] NOT STARTED — Trade networks and economic activities.
- [ ] NOT STARTED — Diplomacy, rivalries, treaties, and possible wars.
- [ ] NOT STARTED — Meaningful quests and faction relationships.
- [ ] NOT STARTED — Dynamic NPC behavior and environmental storytelling.

## 7. THREE ADDITIONAL REALMS


## Aetheria — Celestial Expanse

- [ ] NOT STARTED — Floating islands, cloud oceans, celestial castles, phoenixes, sky dragons, divine guardians, aerial exploration, magical flight, and gravity-related puzzles.

## Umbral Abyss

- [ ] NOT STARTED — Dark underground civilizations, glowing fungi, ancient ruins, shadow beasts, abyssal serpents, corrupted creatures, darkness mechanics, and dangerous survival environments.

## Chronoria — Fractured Realm

- [ ] NOT STARTED — Reality fractures, temporal ruins, unusual creatures, quantum-inspired puzzles, alternate states, time-related challenges, and ancient secrets connected to the game's quantum identity.
- [ ] NOT STARTED — Every realm must have distinctive pixel art, creatures, mechanics, resources, worldbuilding, progression, and powerful bosses.

## 8. RLCraft-INSPIRED SURVIVAL

- [ ] NOT STARTED — Make survival significantly deeper and more meaningful.

### Hunger

- [ ] NOT STARTED — A functional food bar affected by time, exertion, and appropriate activities.

### Thirst

- [ ] NOT STARTED — A separate thirst bar with clean water, purification, wells, canteens, waterskins, and climate-dependent hydration.

### Temperature

- [ ] NOT STARTED — Heat, cold, weather exposure, appropriate clothing, fires, and shelter.

### Injuries and conditions

- [ ] NOT STARTED — Poison, bleeding, burns, frostbite, exhaustion, and magical conditions.

### Survival supplies

- [ ] NOT STARTED — Healing herbs, bandages, remedies, camping supplies, food storage, cooking equipment, and travel preparation.

### Difficulty modes

- [ ] NOT STARTED — Cozy — Relaxed farming and building.
- [ ] NOT STARTED — Adventure — Balanced survival and progression.
- [ ] NOT STARTED — Hardcore — Demanding RLCraft-inspired survival and dangerous encounters.
- [ ] NOT STARTED — Survival should reward knowledge and planning without forcing endless frustrating micromanagement.
- [ ] NOT STARTED — The UI must clearly communicate every survival mechanic.

## 9. MASSIVE ITEM, CRAFTING & FOOD EXPANSION

- [ ] NOT STARTED — Create a deeply expandable, data-driven item system with a long-term target of **thousands of meaningful items**.
- [ ] NOT STARTED — Include:
- [ ] NOT STARTED — Resources, ores, metals, gems, crystals, fibers, monster drops, and magical materials.
- [ ] NOT STARTED — Weapons, armor, shields, tools, accessories, and class equipment.
- [ ] NOT STARTED — Building materials, roofs, walls, furniture, and decorations.
- [ ] NOT STARTED — Farming tools, seeds, fertilizer, irrigation equipment, and animal supplies.
- [ ] NOT STARTED — Food ingredients, spices, fruits, vegetables, meats, fish, grains, and dairy.
- [ ] NOT STARTED — Hundreds of potential cooking recipes and culturally distinct dishes.
- [ ] NOT STARTED — Potions, alchemy reagents, runes, scrolls, and magical artifacts.
- [ ] NOT STARTED — Exploration tools, backpacks, lanterns, saddles, and mount equipment.
- [ ] NOT STARTED — Legendary equipment, rare collectibles, and realm-specific resources.

### Crafting disciplines

- [ ] NOT STARTED — Smithing, woodworking, tailoring, leatherworking, cooking, brewing, alchemy, enchanting, engineering, masonry, farming, and magical crafting.

### Systems

- [ ] NOT STARTED — Multiple crafting stations.
- [ ] NOT STARTED — Crafting progression and recipe discovery.
- [ ] NOT STARTED — Multi-stage advanced recipes.
- [ ] NOT STARTED — Equipment upgrades and repair.
- [ ] NOT STARTED — Material rarity.
- [ ] NOT STARTED — Specialized crafting resources.
- [ ] NOT STARTED — Kingdom-specific and realm-specific recipes.
- [ ] NOT STARTED — Excellent searchable crafting UI.
- [ ] NOT STARTED — Crafting favorites, categories, ingredient tracking, and recipe trees.
- [ ] NOT STARTED — Avoid generating thousands of meaningless duplicates. Every major item category should serve actual gameplay.
- [ ] NOT STARTED — Build a robust foundation first, then expand the content systematically.

## 10. FARMING, ANIMAL HUSBANDRY & BUILDING

- [ ] NOT STARTED — Players should be able to create their own homes, farms, ranches, workshops, and settlements.

### Agriculture

- [ ] NOT STARTED — Crop growth, planting, watering, harvesting, seasonal effects, irrigation, fertilizers, magical crops, orchards, and vineyards.

### Animal husbandry

- [ ] NOT STARTED — Chickens, cows, sheep, goats, pigs, horses, and fantasy livestock.
- [ ] NOT STARTED — Include feeding, breeding, growth, shelter, animal happiness, resource collection, and proper animations.

### Building

- [ ] NOT STARTED — Cottages, houses, farms, barns, stables, inns, towers, castles, guild halls, workshops, and expandable settlements.
- [ ] NOT STARTED — Allow customization of walls, roofs, flooring, windows, lighting, gardens, and interiors.
- [ ] NOT STARTED — Furniture must be genuinely isometric and functional where appropriate.

## 11. ADVENTURER GUILD SYSTEM — F TO SSS

- [ ] NOT STARTED — Every major settlement should have an Adventurer Guild Hall.
- [ ] NOT STARTED — Players can register, receive guild identity cards, select classes, accept quests, form parties, and gain reputation.
- [ ] NOT STARTED — Ranks:
- [ ] NOT STARTED — **F → E → D → C → B → A → S → SS → SSS**
- [ ] NOT STARTED — SSS should be extraordinarily difficult to obtain.
- [ ] NOT STARTED — It must require intelligence, planning, extraordinary accomplishments, strategic mastery, and meaningful world-changing quests—not merely grinding.

### Quest boards

- [ ] NOT STARTED — Monster hunts, escorts, rescues, investigations, dungeon exploration, resource gathering, crafting commissions, farming contracts, diplomatic missions, kingdom defense, and legendary quests.
- [ ] NOT STARTED — Each guild hall should have a beautiful physical quest board with a fully functional matching UI.

## 12. MORE PLAYER CLASSES

- [ ] NOT STARTED — Introduce:
- [ ] NOT STARTED — **Warrior:** Knight, Guardian, Berserker, Samurai, Paladin, Dragoon.
- [ ] NOT STARTED — **Ranged:** Archer, Ranger, Marksman, Beast Hunter.
- [ ] NOT STARTED — **Magic:** Elementalist, Sorcerer, Summoner, Druid, Necromancer, Chronomancer.
- [ ] NOT STARTED — **Stealth:** Rogue, Assassin, Ninja, Shadowblade.
- [ ] NOT STARTED — **Support:** Cleric, Bard, Alchemist, Spirit Healer.
- [ ] NOT STARTED — **Hybrid:** Spellblade, Beastmaster, Artificer, Runic Engineer, Dragon Tamer, Quantum Weaver.
- [ ] NOT STARTED — Each needs meaningful progression, abilities, equipment, animations, strengths, weaknesses, and cooperative synergies.

## 13. CREATURES, MYTHICAL BEASTS & BOSSES

- [ ] NOT STARTED — Create a substantial, dynamic bestiary.

### Passive

- [ ] NOT STARTED — Deer, rabbits, foxes, birds, fish, turtles, livestock, woodland spirits, and magical wildlife.

### Hostile

- [ ] NOT STARTED — Bandits, raiders, goblins, trolls, undead, orcs, wolves, spiders, corrupted beasts, and rogue mages.

### Mythical

- [ ] NOT STARTED — Griffins, dragons, phoenixes, sirens, unicorns, hydras, manticores, basilisks, leviathans, thunderbirds, and original fantasy creatures.

### Ancient

- [ ] NOT STARTED — Primordial dragons, world serpents, sealed entities, forgotten titans, and realm guardians.
- [ ] NOT STARTED — Implement habitats, behavior, spawning rules, territorial interactions, rarity, combat patterns, and appropriate taming possibilities.
- [ ] NOT STARTED — Bosses require multiple phases, distinct mechanics, excellent animations, memorable encounters, and spectacular custom health bars.

## 14. TELEPORTATION & TRAVEL

- [ ] NOT STARTED — Add:
- [ ] NOT STARTED — Discoverable fast-travel shrines.
- [ ] NOT STARTED — Magical teleporters.
- [ ] NOT STARTED — Kingdom waypoint networks.
- [ ] NOT STARTED — Realm portals.
- [ ] NOT STARTED — Horses and fantasy mounts.
- [ ] NOT STARTED — Sailing and ocean travel.
- [ ] NOT STARTED — Roads, bridges, ports, and caravan routes.
- [ ] NOT STARTED — Meaningful exploration rewards and secrets.
- [ ] NOT STARTED — Fast travel must be convenient without removing the satisfaction of discovering locations.

## 15. QUANTUM PROGRESSION OVERHAUL

- [ ] NOT STARTED — The existing quantum progress board is too confusing.
- [ ] NOT STARTED — Redesign it into a beautiful, intuitive, game-like progression interface.
- [ ] NOT STARTED — Simple everyday language.
- [ ] NOT STARTED — Short explanations.
- [ ] NOT STARTED — Clear icons and upgrade descriptions.
- [ ] NOT STARTED — Obvious progression paths.
- [ ] NOT STARTED — Interactive learning challenges.
- [ ] NOT STARTED — Beginner-friendly onboarding.
- [ ] NOT STARTED — Optional advanced scientific details.
- [ ] NOT STARTED — Quantum-inspired gameplay integrated with Chronoria.
- [ ] NOT STARTED — Accurate explanations where real quantum concepts are referenced.
- [ ] NOT STARTED — Players should understand how to progress without knowing quantum computing beforehand.

## 16. LIVING WORLD, ECONOMY & CIVILIZATIONS

- [ ] NOT STARTED — Introduce:
- [ ] NOT STARTED — Autonomous kingdom development.
- [ ] NOT STARTED — Dynamic wars and invasions.
- [ ] NOT STARTED — Seasonal festivals and celebrations.
- [ ] NOT STARTED — Traveling merchants and trade routes.
- [ ] NOT STARTED — Local economic systems.
- [ ] NOT STARTED — NPC professions, routines, and relationships.
- [ ] NOT STARTED — Dynamic settlements.
- [ ] NOT STARTED — Dungeons and ruins.
- [ ] NOT STARTED — Companions and mounts.
- [ ] NOT STARTED — Environmental storytelling.
- [ ] NOT STARTED — Royal events, tournaments, and political intrigue.
- [ ] NOT STARTED — Use efficient simulation models so the world feels alive without overwhelming the browser.

## 17. WORLD CONSEQUENCES — EVERY ACTION MATTERS

- [ ] NOT STARTED — The world should remember meaningful player actions.
- [ ] NOT STARTED — For example, rescuing a village from a dragon could:
- [ ] NOT STARTED — Improve local reputation.
- [ ] NOT STARTED — Unlock rare guild quests.
- [ ] NOT STARTED — Attract attention from a king.
- [ ] NOT STARTED — Affect nearby trade.
- [ ] NOT STARTED — Change creature territories.
- [ ] NOT STARTED — Cause the settlement to prosper.
- [ ] NOT STARTED — Influence later political events.
- [ ] NOT STARTED — Implement persistent reputation, important NPC memories, evolving settlements, diplomatic consequences, and connected questlines.
- [ ] NOT STARTED — Make consequences visible through dialogue, changed environments, construction, celebrations, and altered faction behavior.
- [ ] NOT STARTED — Players should be able to experience different stories because of their choices.

## 18. PRIVATE BROWSER MULTIPLAYER — NO MMO

- [ ] NOT STARTED — EIGENLANDS must remain a **browser-based game**.
- [ ] NOT STARTED — Prioritize free or very low-cost private multiplayer for approximately **2–8 friends**.
- [ ] NOT STARTED — Desired experience:
- [ ] NOT STARTED — **Open website → Create world → Share link/code → Friends join → Play together.**

### Required features

- [ ] NOT STARTED — Private worlds and invitations.
- [ ] NOT STARTED — Cooperative exploration and combat.
- [ ] NOT STARTED — Shared building and farming.
- [ ] NOT STARTED — Shared quests and settlements.
- [ ] NOT STARTED — Individual character progression.
- [ ] NOT STARTED — Guilds and parties.
- [ ] NOT STARTED — Trading.
- [ ] NOT STARTED — Optional consensual PvP.
- [ ] NOT STARTED — Multiplayer chat and markers.
- [ ] NOT STARTED — Persistent world saves.
- [ ] NOT STARTED — Reconnection and safe disconnect handling.

### Technical architecture

- [ ] NOT STARTED — Evaluate a lightweight authoritative Node.js WebSocket server or Colyseus, compatible with the existing stack.
- [ ] NOT STARTED — Consider WebRTC where it offers genuine advantages and account for signaling and TURN costs.
- [ ] NOT STARTED — Target ₹0/month initially where realistic, without assuming unlimited free infrastructure.
- [ ] NOT STARTED — Support chunk synchronization, spatial interest management, server validation, and reliable world persistence.
- [ ] NOT STARTED — Single-player and multiplayer must share core gameplay logic.
- [ ] NOT STARTED — **Do not implement MMO infrastructure at this stage.**
- [ ] NOT STARTED — Actually test multiplayer across separate browser sessions and networks where possible.

## 19. WORLD IMMERSION & SMALL DETAILS

- [ ] NOT STARTED — Add thoughtful environmental interactions:
- [ ] NOT STARTED — Blacksmiths working at forges.
- [ ] NOT STARTED — Farmers tending crops.
- [ ] NOT STARTED — Tavern customers appearing during evenings.
- [ ] NOT STARTED — Guards patrolling settlements.
- [ ] NOT STARTED — Birds landing on rooftops.
- [ ] NOT STARTED — Lanterns illuminating rainy streets.
- [ ] NOT STARTED — Animals wandering farms.
- [ ] NOT STARTED — Fishermen working along rivers.
- [ ] NOT STARTED — Marketplace crowds during festivals.
- [ ] NOT STARTED — Traveling adventurers and merchants.
- [ ] NOT STARTED — Town bells and ambient world activity.
- [ ] NOT STARTED — Villagers reacting to dangerous creatures.
- [ ] NOT STARTED — Natural weather responses.
- [ ] NOT STARTED — Small discoverable stories and secrets.
- [ ] NOT STARTED — These details should make simply walking around the world enjoyable.

## 20. TECHNICAL QUALITY & PERFORMANCE

- [ ] NOT STARTED — Preserve the existing stack wherever sensible.
- [ ] NOT STARTED — Prioritize:
- [ ] NOT STARTED — Reusable data-driven architecture.
- [ ] NOT STARTED — Consistent isometric rendering.
- [ ] NOT STARTED — Chunk-based procedural generation.
- [ ] NOT STARTED — Efficient sprite batching and effects.
- [ ] NOT STARTED — Appropriate NPC simulation levels of detail.
- [ ] NOT STARTED — Reliable world persistence.
- [ ] NOT STARTED — Multiplayer-safe inventory and crafting.
- [ ] NOT STARTED — Minimal unnecessary dependencies.
- [ ] NOT STARTED — Clean code organization.
- [ ] NOT STARTED — Safe save migrations.
- [ ] NOT STARTED — Robust error handling.
- [ ] NOT STARTED — Excellent browser performance.
- [ ] NOT STARTED — Do not optimize by removing useful functionality.
- [ ] NOT STARTED — Test realistic gameplay with multiple active players, creatures, structures, effects, and world events.

## 21. IMPLEMENTATION ORDER

- [ ] NOT STARTED — Before major changes, audit the current state and identify what already works.
- [ ] NOT STARTED — Then prioritize:
- [ ] NOT STARTED — 1. **Integration and recovery:** Safely merge completed work, fix regressions, create the master checklist.
- [ ] NOT STARTED — 2. **Visual foundation:** Establish isometric standards, sprite pipeline, rendering, and art consistency.
- [~] IN PROGRESS — 3. **UI/HUD revolution:** Use Impeccable to redesign health bars, enemy HUDs, maps, menus, inventory, and interaction systems.
- [ ] NOT STARTED — 4. **Controls and navigation:** Improve movement, camera, combat controls, minimap, and full world map.
- [ ] NOT STARTED — 5. **Core survival:** Hunger, thirst, temperature, food, cooking, crafting, and item systems.
- [ ] NOT STARTED — 6. **Building and farming:** Homes, furniture, agriculture, and animal husbandry.
- [ ] NOT STARTED — 7. **Combat and creatures:** Classes, abilities, monsters, bosses, and ecosystem systems.
- [ ] NOT STARTED — 8. **Kingdoms:** Six civilizations and the systems governing them.
- [ ] NOT STARTED — 9. **Guilds and consequences:** Quest boards, ranks, reputation, dynamic events, and meaningful choices.
- [ ] NOT STARTED — 10. **Realms:** Aetheria, Umbral Abyss, and Chronoria.
- [ ] NOT STARTED — 11. **Multiplayer expansion:** Complete browser-based private co-op, accounting for networking requirements from the beginning.
- [ ] NOT STARTED — 12. **Final polish:** Art, animation, UI consistency, balance, performance, testing, and documentation.
- [ ] NOT STARTED — Use **fully playable vertical slices** to establish quality before scaling features across the entire world.
- [ ] NOT STARTED — Do not wait until the end to consider multiplayer state ownership, world persistence, or synchronization.
- [ ] NOT STARTED — If the task exceeds the available execution budget, implement as much working, high-quality functionality as possible and accurately record what remains.

## 22. MANDATORY QUALITY ASSURANCE

- [ ] NOT STARTED — Before marking any feature complete:
- [ ] NOT STARTED — 1. Check whether the actual code implements it.
- [ ] NOT STARTED — 2. Run relevant tests.
- [ ] NOT STARTED — 3. Play-test the feature in the browser where practical.
- [ ] NOT STARTED — 4. Verify that it integrates correctly with other systems.
- [ ] NOT STARTED — 5. Examine the rendered visuals and UI.
- [ ] NOT STARTED — 6. Check performance and responsiveness.
- [ ] NOT STARTED — 7. Fix major bugs or accurately record blockers.
- [ ] NOT STARTED — 8. Update the master development checklist.

### UI-specific QA with Impeccable

- [ ] NOT STARTED — Perform visual critique and refinement of:
- [ ] NOT STARTED — Normal gameplay HUD.
- [ ] NOT STARTED — Low-health combat HUD.
- [ ] NOT STARTED — Enemy and boss health bars.
- [ ] NOT STARTED — Inventory and crafting screens.
- [ ] NOT STARTED — Guild halls and quest boards.
- [ ] NOT STARTED — Maps and minimap.
- [ ] NOT STARTED — Character and class interfaces.
- [ ] NOT STARTED — Quantum progression.
- [ ] NOT STARTED — Multiplayer lobby.
- [ ] NOT STARTED — Building and farming interfaces.
- [ ] NOT STARTED — Menus and settings.
- [ ] NOT STARTED — Look specifically for inconsistent visual hierarchy, generic AI-generated patterns, poor contrast, cramped spacing, misaligned components, excessive ornamentation, and unreadable combat information.
- [ ] NOT STARTED — Review actual browser screenshots rather than judging UI quality from source code alone.
- [ ] NOT STARTED — **No screenshot-based validation means the visual overhaul is not fully verified.**

## 23. THE EXPERIENCE I WANT

- [ ] NOT STARTED — Imagine beginning as a completely unknown F-rank adventurer.
- [ ] NOT STARTED — You wake up in a tiny medieval village.
- [ ] NOT STARTED — You need food, water, tools, and shelter.
- [ ] NOT STARTED — You gather resources, craft equipment, cook meals, and build a small home.
- [ ] NOT STARTED — You begin farming and raising animals.
- [ ] NOT STARTED — You explore mysterious forests, fight creatures, and register at the local Adventurer Guild.
- [ ] NOT STARTED — You travel to magnificent royal kingdoms, befriend powerful monsters, meet ancient rulers, discover secret civilizations, and encounter mythical beasts.
- [ ] NOT STARTED — You visit an underwater kingdom, explore the Demon Sovereign's capital, fly through celestial islands, descend into the Abyss, and uncover the strange mysteries of Chronoria.
- [ ] NOT STARTED — You build an extraordinary settlement with your friends.
- [ ] NOT STARTED — You defeat powerful dragons, forge legendary equipment, influence kingdom politics, and discover rare classes.
- [ ] NOT STARTED — Eventually, your deeds become known throughout the world.
- [ ] NOT STARTED — Perhaps you earn the almost impossible SSS adventurer rank.
- [ ] NOT STARTED — Perhaps you become a great builder, farmer, merchant, dragon rider, or guild leader.
- [ ] NOT STARTED — Perhaps you establish your own kingdom.
- [ ] NOT STARTED — And all of this happens in an astonishingly beautiful, responsive, handcrafted-looking isometric world—directly in your browser.
- [ ] NOT STARTED — The game should be enjoyable whether players are fighting legendary bosses, crafting equipment, exploring strange environments, building houses, or simply enjoying a rainy evening in their village.

## 24. FINAL INSTRUCTIONS — ABSOLUTELY NON-NEGOTIABLE

- [ ] NOT STARTED — **DO NOT FORGET ANYTHING IN THIS PROMPT.**
- [ ] NOT STARTED — Create and maintain the master development document.
- [ ] NOT STARTED — Finish previously started work and safely integrate all completed improvements.
- [ ] NOT STARTED — Use Impeccable for the UI/UX overhaul and appropriate installed skills for the art and game systems.
- [ ] NOT STARTED — Do not spawn subagents.
- [ ] NOT STARTED — Do not produce generic AI-slop interfaces.
- [ ] NOT STARTED — Do not replace beautiful existing design elements with inferior generic ones.
- [ ] NOT STARTED — Do not fake feature completion.
- [ ] NOT STARTED — Do not compromise the isometric perspective.
- [ ] NOT STARTED — Do not make the game unnecessarily complicated for players.
- [ ] NOT STARTED — Do not spend excessive resources on pointless architectural complexity.
- [ ] NOT STARTED — Prioritize genuine gameplay quality, exceptional pixel art, beautiful interfaces, reliable controls, and a cohesive living world.

### Final delivery report

- [ ] NOT STARTED — When ending the current implementation session, provide:
- [ ] NOT STARTED — 1. What was actually completed.
- [ ] NOT STARTED — 2. What previous work was merged.
- [ ] NOT STARTED — 3. What UI elements were redesigned and visually checked.
- [ ] NOT STARTED — 4. What gameplay systems were implemented and tested.
- [ ] NOT STARTED — 5. What remains in progress.
- [ ] NOT STARTED — 6. Which features are blocked or deferred.
- [ ] NOT STARTED — 7. Current known bugs.
- [ ] NOT STARTED — 8. Actual multiplayer and hosting status.
- [ ] NOT STARTED — 9. Where the updated master plan and continuation document are located.
- [ ] NOT STARTED — 10. The exact next highest-priority implementation tasks.
- [ ] NOT STARTED — **THE STANDARD IS NOT "GOOD ENOUGH FOR AN AI-GENERATED GAME."**
- [ ] NOT STARTED — The standard is an original, beautifully crafted, technically solid fantasy RPG that people genuinely want to explore.
- [ ] NOT STARTED — Make the UI look like it belongs in a premium game.
- [ ] NOT STARTED — Make the pixel art exceptional.
- [ ] NOT STARTED — Make combat feel responsive.
- [ ] NOT STARTED — Make survival meaningful.
- [ ] NOT STARTED — Make the kingdoms believable.
- [ ] NOT STARTED — Make the world feel alive.
- [ ] NOT STARTED — Make exploration rewarding.
- [ ] NOT STARTED — Make multiplayer effortless.
- [ ] NOT STARTED — Make the game unmistakably **EIGENLANDS**.
- [ ] NOT STARTED — **Do your absolute best. Implement, integrate, test, refine, and document everything.**
