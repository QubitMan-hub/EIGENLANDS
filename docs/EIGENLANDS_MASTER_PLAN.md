# EIGENLANDS master development checklist

Source: [complete user request](design/master-request.md). Both pasted uploads are identical. This checklist preserves every request paragraph and subrequirement. A checked entry requires code, passing tests, integration and visual evidence; prior partial implementations are not blanket completion.

## Audit and execution record

- [~] IN PROGRESS — Castles/frontier batch (2026-10-26): original projected bastions/crowns/curtain walls, furnished watchrooms/thrones, revision-6 lazy province towns and atlas discovery. Dialogue theme and collision/shard travel defects addressed with regression tests. See [FRONTIER_CITIES.md](FRONTIER_CITIES.md) for evidence and limits. Saved revisions 1–5 retained. Frontier interactive NPC shops/quests, intercity trade and playable castle battlements remain open.

- [x] IMPLEMENTED & TESTED — Prior completed work merged in PRs #2, #3 and #4; main baseline 54cf502. Clean feature branch preserves new work.
- [x] IMPLEMENTED & TESTED — Functional furnished upper floors, charter-gated underwater sanctuaries, timed traps and platform circuits. Three shared and four server integration checks passed; real solo/multiplayer reload, stairs, diving, platform chamber and sloop return passed. Merged to main in PR #5 after both CI checks passed.
- [x] IMPLEMENTED & TESTED — PR #5 merged at 404a880 after both GitHub CI checks passed; local main synchronized. Full broader overhaul remains IN PROGRESS.
- [~] IN PROGRESS — Impeccable HUD and inventory pass: bronze material framing, numeric health, search/category/view sorting, touch item actions and keyboard focus containment. Desktop/touch-landscape interaction and prop bounds checks passed. Maps and deeper combat/progression UI remain open.
- [~] IN PROGRESS — Exploration atlas/minimap slice: actual 2:1 terrain chart, local saved fog/waypoints, layer isolation, pan/zoom/centering, discovered locations, nearby entity filters and safe M/voice migration. All 405 tests, typechecking, both builds and desktop/landscape/MP checks passed; merged in PR #6 at 55fd0af after both CI runs passed. The newer durable continuation archives history beyond 512 resident chunks; private-world identity, cross-device synchronization and new content remain open.
- [!] BUG / BLOCKED — No physical low-end Android/iOS devices or cross-network hardware are attached. Browser emulation cannot verify native performance/orientation.
- [!] BUG / BLOCKED — Uploaded external art archives have no specific reuse license. Existing matching repository sheets and new original art remain usable; do not import unverified artwork.

- [x] IMPLEMENTED & TESTED — Undercroft 2 (world revision 4): organic warped caves with continuous biomes, embedded vein ores, cave terraces, steerable haulage mine lines with buffers, delver camps with four travelling merchants, sealed/echo vault shrines with trials, six biome monsters and four new arena bosses. Flood-fill connectivity, terrace-cliff, feature-spread and server trial/boss/merchant tests pass. Not done: additional full cave towns, boss-specific loot, device performance proof.

- [~] IN PROGRESS — Survival (§8): body temperature (biome/cave/season/weather/fire/shelter), bleeding, poison, burns, frostbite, bandage/antidote/salve/tonics, Hardcore difficulty, HUD warmth bar and chips. Server, shared and HUD tests pass. Open: clothing warmth, camping gear, food storage, magical conditions, fracture.

- [~] IN PROGRESS — Six Great Kingdoms (§6, world revision 5): continents with biome palettes and roads, 78 generated settlements (six capitals, towns, villages, farms, outposts), about 360 named residents with schedules, shops and voices, six mythical beasts, reputation with price effects, four-step quest chains, diplomacy calendar and festivals, Journal Kingdoms tab, entry banner. Open: marching armies, atlas borders, underwater cities, wars, branching faction quests. See docs/KINGDOMS.md.

Implementation references: `packages/client/src/art`, `game`, `ui`, `features`; `packages/shared/src`; `packages/server/src`. Dependencies: preserve shared authoritative rules, chunk/shard persistence and existing saves. Evidence: the latest continuation passed all 405 workspace tests (52 client, 215 server, 138 shared), typechecks and both production builds, plus solo/multiplayer and mobile browser checks. Only individually listed slices are complete; the full master overhaul remains IN PROGRESS.

## Implementation map and remaining dependencies

The full source checklist below is a conservative acceptance list. Broad aesthetic goals remain open even where existing systems already provide part of the functionality. This table identifies actual shipped foundations and concrete next work; a NOT STARTED source line must not be read as permission to replace working systems.

| Feature                                                                     | Current implementation / relevant modules                                                                                                                                                                                                                    | Dependencies and remaining work                                                                                                                                                                                                                                                                                                                                                              | Evidence / limits                                                                                                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Art, ecology, forty coastal residents, four settlements, sailing, equipment | IN PROGRESS overall; prior PRs #2–#4, client/art, shared/settlements, server sailing/village                                                                                                                                                                 | Bespoke per-biome/room/boss pass, more creature families and weapon families                                                                                                                                                                                                                                                                                                                 | Prior 391-test baseline and art/play captures recorded in art/overhaul-notes.md                                                                                                  |
| Functional floors and underwater challenges                                 | IMPLEMENTED & TESTED slice; shared/floors.ts, sanctuaries.ts; containers.ts, shrine module, Game.ts                                                                                                                                                          | Merged PR #5; broader authored interior variety and integrated architectural backdrops remain                                                                                                                                                                                                                                                                                                | Three shared tests and four authoritative integration checks; genuine collision spaces, no decorative-only stairs                                                                |
| HUD and pack                                                                | IN PROGRESS; ui/hud.css, inventory.ts, inventory-query.ts, windows.ts                                                                                                                                                                                        | Journal-only tutorial/quest guidance, compact Menu and equipment comparisons implemented; compact enemy/boss headers and live Journal Journey added; player vitals ledger (isometric health/mana/stamina/food/water vials and expandable statuses, §3.1) implemented; survival data (temperature, injuries) and broader progression content remain                                           | Inventory query and equipment preview rules; desktop/landscape Journal/menu, ring comparisons, search/category/sort/actions/focus and prop bounds checked                        |
| Navigation and maps                                                         | IN PROGRESS; client/features/atlas, input/keymap, existing predictor and iso camera                                                                                                                                                                          | Atlas/minimap foundation works; durable IndexedDB history beyond 512 resident chunks is implemented in the current continuation; future kingdom/realm content and other key conflicts remain; discovered quest and authorized distant party destinations are verified and merged in PR #9 (3d61674), with all 421 tests, typechecks, both builds and solo/multiplayer browser checks passing | Local fog, saved waypoints/preferences, pan/zoom, layer isolation and no generation on pan checked; M defaults to map, legacy default voice moves to N, custom bindings retained |
| Survival and meaningful progression                                         | IN PROGRESS; opt-in Cozy/Adventure hunger/thirst, food nutrition, waterskins/wells and private real HUD meters                                                                                                                                               | Temperature/exposure, injuries, purification, nutritional variety, bandages and Hardcore remain; preserve existing saves                                                                                                                                                                                                                                                                     | Pure rules, real item/range/authority, legacy migration, persistence and browser checks recorded in CONTINUE_HERE.md                                                             |
| Building and farming                                                        | IMPLEMENTED & TESTED construction slice: 33 craftable structural pieces, resident charters/services, individual husbandry and perennial orchards, arbitrary two-floor plans, roofs/cutaways, doors, stairs, owned collision and separate persisted furniture | Deeper settlement government; arbitrary-height towers, co-owners and cross-region edit expansion                                                                                                                                                                                                                                                                                             | Real crafting/solo upstairs reload, sharded stair authority, live neighboring collision and ownership/refund tests; see PLAYER_BUILDING.md                                       |
| Companion and hiring expansion                                              | IN PROGRESS; three real forage-tamed wildlife bonds reuse ShadowModule follow/fight/progression/persistence, with distinctive support traits and natural sprites                                                                                             | Actual resident lease ownership/visibility, relationship gates, travelling merchants, further companion families and mounts                                                                                                                                                                                                                                                                  | Real food/claim/combat/support/save and rendering checks; no resident recruitment or merchant expansion implied                                                                  |
| Classes, kingdoms, guilds and realms                                        | IN PROGRESS: six kingdoms/frontier cities, F–SSS guild proofs, daily journeys, shared party credit and Wayguard; existing quantum circuits retained                                                                                                          | New named realms, complete additional class families, bespoke guild prefabs and authored world-changing campaigns; see COZY_TOWNS.md and HOMESTEADS_AND_GUILD.md                                                                                                                                                                                                                             | Underwater sanctuaries are not presented as the requested three realms                                                                                                           |
| Private friend worlds / inexpensive hosting                                 | NOT STARTED private-world implementation; current shared solo server and sharded multiplayer retained                                                                                                                                                        | Per-world authorization, 2–8 player create/join/share, world persistence separation and hosting measurements                                                                                                                                                                                                                                                                                 | No new paid service or dependency; current compose/Pages setup unchanged                                                                                                         |
| Hardware and third-party licenses                                           | BUG / BLOCKED                                                                                                                                                                                                                                                | Physical low-end devices, cross-network devices and specific license evidence                                                                                                                                                                                                                                                                                                                | Emulated landscape is not hardware performance proof; “free package” alone does not establish reuse terms                                                                        |

## Request checklist (unreviewed entries remain NOT STARTED)

## EIGENLANDS — THE DEFINITIVE MASTER OVERHAUL PROMPT

## The Ultimate Isometric Fantasy RPG, Survival, Civilization, Multiplayer & Visual Design Overhaul

**Repository:** https://github.com/QubitMan-hub/EIGENLANDS

## 0. THE MISSION — READ EVERYTHING

- [ ] NOT STARTED — Transform EIGENLANDS into an exceptionally beautiful, deeply immersive, browser-based **isometric pixel-art medieval fantasy RPG**, featuring private multiplayer, an enormous procedural world, living civilizations, survival, crafting, building, exploration, magical creatures, and interconnected gameplay systems.
- [ ] NOT STARTED — I want the creative freedom of Minecraft, the challenging survival of RLCraft, the content depth of Terraria, the charm of Stardew Valley, the exploration of Zelda, the environments of Core Keeper, and the fantasy civilization-building of _That Time I Got Reincarnated as a Slime_.
- [ ] NOT STARTED — For its visuals, take inspiration from _Octopath Traveler, Eastward, Sea of Stars, CrossCode, Hyper Light Drifter,_ and outstanding isometric pixel-art games.
- [ ] NOT STARTED — For worldbuilding, study _Frieren, Mushoku Tensei, Delicious in Dungeon, Overlord,_ and _That Time I Got Reincarnated as a Slime_.
- [ ] NOT STARTED — For autonomous world systems, take inspiration from _Kenshi, RimWorld,_ and _Dwarf Fortress_.
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

Implemented in `packages/client/src/ui/vitals*.ts` (model, isometric painter, DOM controller), wired from `Game.hud()`. Art lab: `labs/uilab.html?panel=vitals` (`&hit=1`, `&open=1`, `&reduced=1`). Impeccable skill: not installed in this environment, so the limitation is recorded and the work followed the equivalent review rules below.

- [x] IMPLEMENTED & TESTED — Completely redesign the player HUD. The old bar stack, the separate Food/Water progress meters and the plain buff text are gone; one ledger now holds name, level, coins, the vial row, a thin XP rule and the status row.
- [x] IMPLEMENTED & TESTED — Create visually extraordinary yet readable health, mana, stamina, food and thirst indicators. Each is an isometric glass-and-metal prism built with the props' own `Iso` kit (2:1 projection, lit left face, shaded right face, top face, fixed 48-colour palette, nearest-neighbour pixels), standing on a carved-stone plinth; fill height is the value. Numbers sit under each vial with a pixel icon.
- [x] IMPLEMENTED & TESTED — Cohesive combination of the following:
  - [x] IMPLEMENTED & TESTED — Ornamental frames: bronze-bound ledger with rivets and per-gauge frame metals.
  - [x] IMPLEMENTED & TESTED — Metal, carved stone, leather and rune detailing: bronze health frame, steel mana frame with a crystal spire, iron stamina frame, leather-banded food flask, steel water vial, stone plinths.
  - [x] IMPLEMENTED & TESTED — Pixel-perfect fills and borders: rendered at logical size and scaled by whole numbers only (2× desktop, 1× compact landscape).
  - [x] IMPLEMENTED & TESTED — Distinctive silhouettes: five different footprints and heights, so the gauges differ by shape and position as well as hue (colour-blind safe).
  - [x] IMPLEMENTED & TESTED — Restrained highlights: one meniscus line, one glint, no glow washes.
  - [x] IMPLEMENTED & TESTED — Smooth, informative animations (`GaugeMotion`, unit-tested): instant fill drop, white hit flash, pale trail that drains after a hold, eased recovery; reduced motion snaps everything and disables pulses.
  - [x] IMPLEMENTED & TESTED — Contextual status effects: see the status system below.
- [x] IMPLEMENTED & TESTED — **Health**
  - [x] IMPLEMENTED & TESTED — Distinct identity: the largest, brick-red prism in bronze.
  - [x] IMPLEMENTED & TESTED — Satisfying damage feedback: flash plus draining trail (the existing screen vignette is kept).
  - [x] IMPLEMENTED & TESTED — Smooth loss and recovery animation.
  - [x] IMPLEMENTED & TESTED — Clear low-health warning below 30 %: frame pulses ember, number gains `!` and warm colour; static under reduced motion.
  - [x] IMPLEMENTED & TESTED — Readable numbers (`60/60`) with an accessible progressbar and title.
  - [x] IMPLEMENTED & TESTED — Status effects and shields displayed intelligently: Circuit shield/ward/mirror auras wrap the health vial in a glass cage (colour per type) and also appear in the status row.
- [x] IMPLEMENTED & TESTED — **Mana / magic**
  - [x] IMPLEMENTED & TESTED — Thematically distinct: violet liquid, steel frame, crystal spire. It shows the real class resource (Coherence, Bond …) and is hidden for the Wanderer, who has none yet.
  - [x] IMPLEMENTED & TESTED — Subtle magical effects: spire sparks only while the resource is full (ultimate ready).
  - [x] IMPLEMENTED & TESTED — Readable consumption and regeneration: same trail/recovery motion as health.
- [x] IMPLEMENTED & TESTED — **Stamina**
  - [x] IMPLEMENTED & TESTED — Exertion feedback: the green vial is sprint stamina (added with §4), draining while you run and refilling after a rest, with the two dash charges shown as studs on its plinth.
  - [x] IMPLEMENTED & TESTED — Never obscures movement or combat: the ledger stays in the top-left, 94×46 logical pixels of art, nothing over the playfield; the old under-feet dash pips are unchanged.
- [x] IMPLEMENTED & TESTED — **Hunger and thirst**
  - [x] IMPLEMENTED & TESTED — Visible and instantly understandable: amber flask and cyan vial with food/water icons, shown only in Adventure travel mode (Cozy pauses depletion, so nothing is drawn).
  - [x] IMPLEMENTED & TESTED — Compact fantasy icons and vials.
  - [x] IMPLEMENTED & TESTED — Warnings without interruption: at 20 or below the vial dulls, the number gains `!` and a Hungry/Thirsty chip appears; no toast, no flashing, no sound.
- [~] IN PROGRESS — Add temperature, injuries, buffs, debuffs and other conditions through a clean expandable status system. The system exists and is tested: a registry (`STATUS_DEFS`) turns server buffs, circuit auras and low needs into isometric pedestal chips (four shown, `+n` folds the rest, click or tap expands a described list with timers). Buffs (Regeneration, Might, Ward, Lantern), auras and needs are live. Temperature (Chilled, Overheated) and injuries (Bleeding, Fracture, Poison) are registered but **not simulated by the game yet** (survival is master-plan §8); the HUD shows them the moment the server reports them as buffs and never invents them. Hunger and thirst have no penalty at zero yet, so "Out of food/water" is informational.
- [x] IMPLEMENTED & TESTED — Do not cram everything into an oversized HUD: five vials fit a 216 px ledger; statuses fold; Cozy mode and the Wanderer show fewer.

Design review applied (Impeccable equivalent): no cards, gradients, glass or rounded rectangles; square swatches and chips; one typography pair (Silkscreen headings, monospace numbers); numbers never rely on colour alone; targets 44 px on touch; focus rings; `prefers`-style reduced-motion setting honoured.

Evidence: 33 new unit tests (model, layout, appearance), art-lab captures at 2× and 4×, real browser play in the single-player build on desktop (1280×720) and touch landscape (844×390). Not done: physical-device checks, recorded damage animation in a live fight (the lab drives the same code with a synthetic hit).

## 3.2 Monster & Boss Health Bars

Implemented in `ui/enemy-model.ts` (camps, elite modifiers, chips), `game/worldbar.ts` (world-space bars), `ui/targetframe.ts` (selected-creature frame), `ui/boss-frames.ts` + `ui/bossbar.ts` (legendary frames), wired from `combatview.ts`, `Game.updateTarget34` and `features/adventure`. Art labs: `uilab.html?panel=bosses`, `?panel=creatures`, `spritelab.html?lab=bars`. `e2e/encounters.mjs` was updated to the new target-frame API and passes on the solo build (desktop and touch landscape).

- [x] IMPLEMENTED & TESTED — Completely overhaul health displays for enemies.

### Normal monsters

- [x] IMPLEMENTED & TESTED — Elegant, compact health indicators: a thin isometric slab (exact 2:1 slope) over each damaged creature, with a pale trail that drains after a hit; it now rides above the sprite's real height instead of a fixed offset.
- [~] IN PROGRESS — Display names and levels appropriately: the selected-creature frame shows the name (and level for players); wild creatures have no level in the game data, so none is invented. World bars carry no text to stay compact.
- [x] IMPLEMENTED & TESTED — Optional small status icons: chips with pixel icons and a one-line explanation each (camp, elite modifiers, Armoured, Night, Striking, Staggered, Recovering).
- [x] IMPLEMENTED & TESTED — Smooth damage feedback: trail on world bars and the frame; the existing hit flash and floating numbers are unchanged.
- [x] IMPLEMENTED & TESTED — Clear visual distinction between hostile, neutral, friendly and elite creatures: camp colour on the world bar, a coloured camp gem and left accent on the frame; passive wildlife has its own green; elites get a gilt double frame and one pip per modifier.

### Elite and mythical enemies

- [x] IMPLEMENTED & TESTED — More distinctive frames (gilt double border, gem, modifier pips).
- [x] IMPLEMENTED & TESTED — Unique enemy classification indicators (camp gem + Elite chip, one chip per Hardened/Swift/Volatile with its real effect).
- [x] IMPLEMENTED & TESTED — Readable resistance, shield or phase information: armour/poise bar labelled "Armor" on armoured creatures, "Poise" otherwise; Hardened's 1.7× health, double poise and half knockback are stated. There is no elemental-resistance system in the game, so none is shown.

### Legendary bosses

- [x] IMPLEMENTED & TESTED — Create spectacular custom boss health bars: pixel-art frames per boss, drawn on a canvas with the fixed palette.
- [x] IMPLEMENTED & TESTED — Examples: all five existing bosses have a unique silhouette, isometric emblem, metal and rune colour — Gelatinous Sovereign (dripping jelly frame, crowned jelly cube), Warden of the Grove (antler tab, stump with antlers), Decoherent Colossus (fractured chamfers, floating shards), Hollow Bellkeeper (bell arch, bronze bell), Veyr (lightning-cut flanks, storm crystal). Glowing rune studs walk along the foot of each frame (still under reduced motion).
- [x] IMPLEMENTED & TESTED — The dragon, Abyssal Titan, Celestial Guardian and Demon Sovereign named as examples do not exist in the game; the registry (`BOSS_THEMES`) is keyed by boss id and a test fails if a boss lacks a distinct theme.
- [x] IMPLEMENTED & TESTED — Memorable and cinematic without obstructing attacks: fixed 224×48 art at 2× (1× on compact phones), centred at the top; layout checks against the ledger, minimap and touch controls pass in `e2e/encounters.mjs`.
- [x] IMPLEMENTED & TESTED — Add:
  - [x] IMPLEMENTED & TESTED — Health-phase transitions: isometric phase gems on the bar's top edge light as thresholds are passed; the phase chip and the server's phase text update.
  - [x] IMPLEMENTED & TESTED — Shield or armor indicators: an Armor bar from the synced poise value.
  - [x] IMPLEMENTED & TESTED — Status effect displays: Striking, Staggered, Recovering chips from the synced stance. Bosses have no other status effects in the game.
  - [x] IMPLEMENTED & TESTED — Clear damage feedback: draining trail behind the fill.
  - [x] IMPLEMENTED & TESTED — Boss name and title: headline plus a quieter title line per boss (the titles are new flavour text).
  - [~] IN PROGRESS — Optional encounter-specific mechanics: the line under the frame shows the server's intro and per-phase text; there is no separate per-boss mechanic indicator (e.g. weak-point markers) because the server sends none yet.
- [x] IMPLEMENTED & TESTED — Ensure all styles remain part of one unified design system: one grammar (emblem left, name band, bar window with phase gems, status band), shared chip component with the target frame, shared palette and `Iso` kit.

Evidence: 9 new unit tests (themes distinct and complete, phase marks, camps, elite info, chips), art-lab captures at 2×, solo-build e2e (`e2e/solo.mjs`, `e2e/encounters.mjs`). Not done: a recorded real boss fight capture (the e2e drives the same code with fixtures), physical-device checks.

## 3.3 Complete Interface Overhaul

- [ ] NOT STARTED — Redesign and unify:
- [~] IN PROGRESS — Main menu and title screen: title now has a floating isometric island diorama (ledge cliff, shrine ring, torches, tree) with your wanderer standing on it, updating live as you customise (`ui/title-scene.ts`); hidden on narrow or short screens. The menu card itself is unchanged apart from the wardrobe.
- [~] IN PROGRESS — Character creation and class selection: appearance creator done (§3.1 PR); class selection still lives in the Circuit Board's Choose path tab and was not redesigned.
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
- [~] IN PROGRESS — Party frames: social/party/voice panels moved onto the shared square bronze/ink material (radii, navy colours, the voice chip); layout not redesigned.
- [~] IN PROGRESS — Map and minimap.
- [ ] NOT STARTED — Quantum progression board.
- [ ] NOT STARTED — Skill trees.
- [~] IN PROGRESS — Death, respawn, victory, and level-up screens: the defeat ribbon (ember frame, cause of death, isometric countdown slab) and the level-up celebration card are done; victory still uses the boss banner unchanged.
- [~] IN PROGRESS — Settings and keybindings: sprint is a new remappable action, camera distance is a new setting; the window layout itself is unchanged.
- [~] IN PROGRESS — Notifications, tooltips, and interaction prompts: toasts and prompts moved to the bronze/ink material (pickup pedestals, gilt rare finds, celebration cards); tooltips are unchanged.

### Guild UI

Blocked: there is no guild, adventurer rank or guild-card system in the game. The physical quest board that does exist is part of the Journal/Board work and was not redrawn in this slice.

- [ ] NOT STARTED — Make physical guild quest boards look like beautiful medieval noticeboards, not ordinary website tables.
- [ ] NOT STARTED — Adventurer cards should look like actual fantasy guild identification cards, with rank-specific detailing and exceptional pixel art.
- [ ] NOT STARTED — SSS-rank cards should feel genuinely prestigious.

### Inventory UI

- [~] IN PROGRESS — Design an excellent inventory system with beautiful item icons, clear categories, equipment slots, search, sorting, comparison, and responsive interactions.

### Interaction feedback

- [ ] NOT STARTED — Add tasteful micro-interactions:
- [x] IMPLEMENTED & TESTED — Item pickup effects: pickup toasts stand the item icon on an isometric pedestal and merge repeats.
- [ ] NOT STARTED — Crafting completion feedback.
- [x] IMPLEMENTED & TESTED — Skill unlock effects: Gate unlocked and skill-level cards (parsed from the server's toasts, see `ui/moments.ts`).
- [!] BUG / BLOCKED — Rank promotion presentations: the game has no guild or F–SSS rank system yet, so there is nothing to present; the card component in `ui/moments.ts` takes a new kind when the system exists.
- [x] IMPLEMENTED & TESTED — Quest completion celebrations: Quest complete card with the reward line; recipe discoveries and heart growth get cards too.
- [x] IMPLEMENTED & TESTED — Rare loot discovery effects: forged-quality, high-tier and valuable non-food pickups get a gilt double frame and a single glint (none under reduced motion).
- [ ] NOT STARTED — Beautiful but restrained hover and selection states.

### Visual acceptance requirements

Slice delivered 2026-10-25: legacy navy/rounded styles in `style.css` (toasts, cards, recipe/dialogue/sign panels, bars, captions) were replaced with the shared slate/bronze/parchment tokens and square corners. The Circuit Board and social panels still use their own purple theme and are the next unification target.

- [ ] NOT STARTED — Use the actual running browser game to inspect the interface at its intended resolutions.
- [ ] NOT STARTED — Capture and review important gameplay states, including combat, menus, inventory, crafting, maps, boss encounters, low health, multiplayer, and survival warnings.
- [ ] NOT STARTED — Critique the results, fix visual inconsistencies, and repeat a bounded improvement cycle.
- [ ] NOT STARTED — **The UI should be distinctive enough that screenshots immediately look like EIGENLANDS—not a generic AI-generated RPG template.**

## 4. COMPLETE CONTROLS, MOVEMENT & CAMERA OVERHAUL

- [ ] NOT STARTED — Significantly improve the controls across the entire game.

### Movement

- [ ] NOT STARTED — Smooth responsive WASD controls mapped correctly to isometric movement.
- [x] IMPLEMENTED & TESTED — Normalized diagonal speed: `sanitizeCmd` clamps the movement vector to unit length; a shared test checks diagonal sprint speed equals straight sprint speed.
- [ ] NOT STARTED — Precise collision and pathing.
- [ ] NOT STARTED — Excellent character animation transitions.
- [x] IMPLEMENTED & TESTED — Responsive sprinting and dodging: hold X (remappable; thumb stick at its rim on touch; stick pushed fully on a gamepad) to run 1.4× faster on a server-authoritative stamina pool (3.3 s of running, refills after 0.6 s rest, 1.4 s if you run dry). It is part of the shared sim, so prediction, ACK reconciliation and server agree exactly (shared tests incl. an ACK round trip; solo e2e holds X and watches stamina fall and refill). Dodge is the existing Shift dash with its double charge; the plan's Shift-sprint/Space-dodge table was not adopted because Shift and Space are already bound (dash, interact) in saved layouts.
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
- [x] IMPLEMENTED & TESTED — Configurable zoom: Settings → Camera distance (close/normal/far) and the = / − keys; steps keep whole-pixel scales so art never blurs.
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
- [~] IN PROGRESS — Audit existing mappings, resolve conflicts, and make controls remappable.
- [~] IN PROGRESS — Prevent browser-specific issues such as page scrolling, lost focus, stuck keys, and accidental gameplay input while typing.
- [ ] NOT STARTED — Play-test controls during combat, building, farming, swimming, mounted travel, teleportation, and multiplayer.

## 5. BEAUTIFUL MINIMAP & LARGE WORLD MAP

## Live minimap

- [x] IMPLEMENTED & TESTED — Add a beautiful, performant minimap in the top-right corner.
- [ ] NOT STARTED — Include:
- [x] IMPLEMENTED & TESTED — Player position and direction.
- [~] IN PROGRESS — Nearby buildings, terrain, roads, water, and landmarks.
- [~] IN PROGRESS — Friendly players and party members.
- [x] IMPLEMENTED & TESTED — Relevant NPCs and enemies.
- [ ] NOT STARTED — Quest locations and teleporters.
- [~] IN PROGRESS — Discovered locations.
- [x] IMPLEMENTED & TESTED — Fog of war.
- [x] IMPLEMENTED & TESTED — Custom waypoints.
- [x] IMPLEMENTED & TESTED — Allow resizing, hiding, and display preferences.

## Full world map — M

- [x] IMPLEMENTED & TESTED — Pressing **M** must open the full interactive world map.
- [x] IMPLEMENTED & TESTED — Press M again or Esc to close it.
- [ ] NOT STARTED — The map should support:
- [x] IMPLEMENTED & TESTED — Zoom and pan.
- [x] IMPLEMENTED & TESTED — Exploration fog.
- [ ] NOT STARTED — Six kingdoms and their territories.
- [ ] NOT STARTED — Three realm-specific maps.
- [~] IN PROGRESS — Capital cities, villages, ports, roads, and landmarks.
- [~] IN PROGRESS — Dungeons, guild halls, teleporters, and discovered locations.
- [~] IN PROGRESS — Discovered quest destinations, current villagers/known homes and hand-in markers implemented and locally tested. Objectives without fixed positions retain Journal guidance.
- [x] IMPLEMENTED & TESTED — Custom waypoints.
- [x] IMPLEMENTED & TESTED — Authorized distant party destinations and markers on the full atlas. No terrain reveal or persisted player positions.
- [~] IN PROGRESS — Filters, legends, and location information.
- [~] IN PROGRESS — The maps must reflect procedural exploration and saved world changes.
- [x] IMPLEMENTED & TESTED — Use chunk-based map generation, caching, and efficient rendering rather than trying to generate the infinite world at once.
- [~] IN PROGRESS — Make map interfaces aesthetically exceptional and consistent with the UI overhaul.

## 6. THE INFINITE WORLD & SIX GREAT KINGDOMS

- [~] IN PROGRESS — Maintain a massive, effectively infinite procedural world containing six major, persistent civilizations. Revision 5 adds six continents across the sea (plus the home continent) with distinct biomes; kingdom state is per-player standing, not yet a persistent shared world simulation.
- [~] IN PROGRESS — Each must have distinct architecture, climate, history, culture, economy, ruler, military, politics, inhabitants, and quests. Shipped: architecture styles, climate, lore, ruler, economy, rep titles; Army units are lore only (see KINGDOMS.md). Quests: four-step chains.

## I. Aurelion — Golden Kingdom

- [~] IN PROGRESS — Grand European-inspired medieval civilization.
- [~] IN PROGRESS — Golden castles, fertile plains, cathedral-like halls, knightly orders, villages, and royal tournaments.
- [~] IN PROGRESS — Army: Knights, infantry, cavalry, archers, griffin riders, royal guards. Lore units and the griffin beast exist; no marching armies or riders.

## II. Sylvaris — Verdant Kingdom

- [~] IN PROGRESS — Ancient forest civilization.
- [~] IN PROGRESS — Living tree settlements, enchanted forests, mystical lakes, ancient spirits, druids, and magical wildlife.
- [~] IN PROGRESS — Army: Elven archers, forest guardians, spirit cavalry, druids, woodland creatures.

## III. Khar-Dum — Iron Kingdom

- [~] IN PROGRESS — Dwarven mountain civilization.
- [~] IN PROGRESS — Enormous fortresses, mines, underground cities, furnaces, mechanical gates, and legendary craftsmen.
- [~] IN PROGRESS — Army: Heavy infantry, runic warriors, golems, siege engineers, armored mountain units.

## IV. Raijin Shogunate — Storm Kingdom

- [~] IN PROGRESS — Feudal Japan-inspired fantasy civilization.
- [~] IN PROGRESS — Pagodas, cherry blossoms, bamboo forests, temples, misty mountains, and ancient shrines.
- [~] IN PROGRESS — Army: Samurai, shinobi, mounted warriors, thunder beasts, spirit swordsmen.

## V. Thalassara — Ocean Kingdom

- [~] IN PROGRESS — Magnificent underwater and island civilization.
- [~] IN PROGRESS — Coral palaces, underwater cities, glowing reefs, ancient ruins, tropical islands, and harbors.
- [~] IN PROGRESS — Army: Sea knights, merfolk, sirens, aquatic cavalry, royal fleets, and leviathan allies.
- [~] IN PROGRESS — Add ships, sailing, underwater exploration, aquatic farming, and ocean trade. Existing sailing and ports remain; no underwater cities, aquatic farming or kingdom ship fleets yet.

## VI. Nethrakar — Demon Kingdom

- [~] IN PROGRESS — Complex fantasy monster civilization.
- [~] IN PROGRESS — Obsidian fortresses, crimson forests, magical cities, dark ruins, and ancient supernatural societies.
- [~] IN PROGRESS — Army: Demon knights, shadow mages, hellhound cavalry, monstrous infantry, and draconic allies.
- [~] IN PROGRESS — **The demon kingdom is not inherently evil.** It must have its own culture, values, alliances, motivations, and opportunities for peaceful interaction.

### Every kingdom requires

- [~] IN PROGRESS — A distinct named ruler and personality.
- [~] IN PROGRESS — Royal court and advisors.
- [~] IN PROGRESS — Capital city, towns, villages, farms, and military outposts.
- [~] IN PROGRESS — Infantry, cavalry, commanders, and mythical units.
- [~] IN PROGRESS — Culture, traditions, festivals, architecture, and cuisine.
- [~] IN PROGRESS — Trade networks and economic activities.
- [~] IN PROGRESS — Diplomacy, rivalries, treaties, and possible wars.
- [~] IN PROGRESS — Meaningful quests and faction relationships. Four-step chains and reputation exist; faction wars and branching are not built.
- [~] IN PROGRESS — Dynamic NPC behavior and environmental storytelling. Schedules, festival gatherings and diplomacy-priced shops exist; no wars or NPC migration.

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

- [~] IN PROGRESS — Heat, cold, weather exposure, appropriate clothing, fires, and shelter.

### Injuries and conditions

- [~] IN PROGRESS — Poison, bleeding, burns, frostbite, exhaustion, and magical conditions.

### Survival supplies

- [ ] NOT STARTED — Healing herbs, bandages, remedies, camping supplies, food storage, cooking equipment, and travel preparation.

### Difficulty modes

- [ ] NOT STARTED — Cozy — Relaxed farming and building.
- [ ] NOT STARTED — Adventure — Balanced survival and progression.
- [x] IMPLEMENTED & TESTED — Hardcore — Demanding RLCraft-inspired survival and dangerous encounters.
- [ ] NOT STARTED — Survival should reward knowledge and planning without forcing endless frustrating micromanagement.
- [ ] NOT STARTED — The UI must clearly communicate every survival mechanic.

## 9. MASSIVE ITEM, CRAFTING & FOOD EXPANSION

See [CRAFTING.md](CRAFTING.md) for the architecture, the data files and what is deliberately not built.

- [~] IN PROGRESS — Create a deeply expandable, data-driven item system with a long-term target of **thousands of meaningful items**. (1,240 items and 902 recipes today, 860 items from data tables in `shared/src/catalog/`; every one has a source or a recipe and a use, enforced by a test. Not yet thousands.)
- [~] IN PROGRESS — Include:
- [x] IMPLEMENTED & TESTED — Resources, ores, metals, gems, crystals, fibers, monster drops, and magical materials. (12 metals with plate/rod/wire, 12 gems raw and cut, 6 elemental crystals, 8 woods, 6 stones, textiles, leather, 17 monster parts, essences; found in the kingdom or cave that has them.)
- [~] IN PROGRESS — Weapons, armor, shields, tools, accessories, and class equipment. (27 armour sets, 63 weapons across spear/axe/hammer/sword/crossbow in 11 metals plus 4 legendaries, 15 shields, cloaks, packs, amulets, belts, charms and lanterns in six new gear slots, 61 accessories, craft tools. No class-specific equipment and no new weapon families (dagger, bow, greatsword) yet.)
- [x] IMPLEMENTED & TESTED — Building materials, roofs, walls, furniture, and decorations. (21 new wall, floor, roof, door and stair pieces in brick, marble, sandstone, granite, plaster, log, glass, tile, copper; 44 furniture and decoration pieces with isometric art, including storage, hearths and lamps that really warm and light.)
- [~] IN PROGRESS — Farming tools, seeds, fertilizer, irrigation equipment, and animal supplies. (57 new crops with seeds sold by the kingdoms that grow them, four fertilisers, a three-tile sprinkler, sickle/shears/trowel/pail that matter, sheep, goats, pigs and bees with their pens. Breeding, growth and animal happiness are §10.)
- [x] IMPLEMENTED & TESTED — Food ingredients, spices, fruits, vegetables, meats, fish, grains, and dairy. (Grains, vegetables, orchard and vine fruit, spices, tea, cocoa, coffee, 7 wild meats, 15 new fish and shellfish, culinary herbs, and the mill, dairy, oil and preserving chain.)
- [x] IMPLEMENTED & TESTED — Hundreds of potential cooking recipes and culturally distinct dishes. (156 dishes and 51 drinks, each with a weight and a profile that gives a distinct buff; six kingdom cuisines of 9-12 dishes each that need standing in that kingdom; dozens found only by experimenting.)
- [x] IMPLEMENTED & TESTED — Potions, alchemy reagents, runes, scrolls, and magical artifacts. (13 herbs, mineral reagents, 22 potions, 34 enchantment runes in three strengths, 15 recipe scrolls, charged crystals, six legendary artifacts.)
- [~] IN PROGRESS — Exploration tools, backpacks, lanterns, saddles, and mount equipment. (Backpacks, lanterns, compass and spyglass charms and a campfire kit exist; **saddles and mount equipment are NOT built**: there is no mount system for them to serve.)
- [x] IMPLEMENTED & TESTED — Legendary equipment, rare collectibles, and realm-specific resources. (4 legendary weapons, a legendary armour set, 6 artifacts, 7 collectibles from vaults; six realm metals, realm woods, gems, seeds and dishes that only their kingdom provides.)

### Crafting disciplines

- [x] IMPLEMENTED & TESTED — Smithing, woodworking, tailoring, leatherworking, cooking, brewing, alchemy, enchanting, engineering, masonry, farming, and magical crafting. (12 disciplines with XP, levels 1-40 and a perk line each; saved with the character.)

### Systems

- [x] IMPLEMENTED & TESTED — Multiple crafting stations. (17 stations; 8 new ones can be crafted and placed, and appear in Hadamere's trade houses.)
- [x] IMPLEMENTED & TESTED — Crafting progression and recipe discovery. (Levelling unlocks recipes; kingdoms, villagers and scrolls teach others; 100 recipes are found by experimenting, and only learned recipes are saved.)
- [x] IMPLEMENTED & TESTED — Multi-stage advanced recipes. (Ore to ingot to plate to armour; fibre to thread to cloth to garment; and so on, shown as a recipe tree in the book.)
- [x] IMPLEMENTED & TESTED — Equipment upgrades and repair. (Quality Crude to Masterwork, durability, repair at the bench or with kits, upgrades to +5, one enchantment per piece; broken gear stays on you and gives nothing.)
- [x] IMPLEMENTED & TESTED — Material rarity. (Six rarity tiers scale value and power; gear needs rarer gear for stronger runes.)
- [x] IMPLEMENTED & TESTED — Specialized crafting resources. (Tools in the pack open trades; realm metals, cave crystals and monster parts feed particular recipes.)
- [x] IMPLEMENTED & TESTED — Kingdom-specific and realm-specific recipes. (132 recipes need a kingdom's friendship; their materials are sold or found only there.)
- [x] IMPLEMENTED & TESTED — Excellent searchable crafting UI. (Search by item, category or ingredient; filters; paging; discipline bars; a gear bench.)
- [x] IMPLEMENTED & TESTED — Crafting favorites, categories, ingredient tracking, and recipe trees. (Favourites and tracked recipes are kept in the browser.)
- [~] IN PROGRESS — Avoid generating thousands of meaningless duplicates. Every major item category should serve actual gameplay. (A test fails any item no recipe or source reaches, or nothing uses. Metal parts nothing uses are not made.)
- [x] IMPLEMENTED & TESTED — Build a robust foundation first, then expand the content systematically.

## 10. FARMING, ANIMAL HUSBANDRY & BUILDING

- [~] IN PROGRESS — Players can build durable owned homes, farms, ranches, workshops and guild halls from modular architecture and functional objects. Charters, valid housing assignments, resident happiness/upkeep and services are now implemented; deeper governance remains open.

### Agriculture

- [x] IMPLEMENTED & TESTED — Planting, watered growth, harvesting, seasons, sprinklers and water-connected irrigation, fertilizer, superposed crops, perennial orchards and grape trellises. See HOMESTEADS_AND_GUILD.md.

### Animal husbandry

- [x] IMPLEMENTED & TESTED — Chickens, cows, sheep, goats, pigs, horses and Glimmerhart fantasy livestock.
- [x] IMPLEMENTED & TESTED — Owned shelters, feeding, breeding, growth, happiness, bounded products, tool-gated atomic collection and grounded quiet animations. Calm bounded server yard roaming and trained horse/Glimmerhart riding are implemented; apiaries retain their colony model.

### Building

- [~] IN PROGRESS — Cottages, houses, farms, barns, stables, inns, towers, castles, guild halls and workshops can be composed from 33 modular pieces and the furniture/station catalog; support, collision, roofs, stairs and ownership persist. Owned charters and resident services are implemented; bespoke prefab plans and deeper governance remain open.
- [x] IMPLEMENTED & TESTED — Wall, roof, floor, window, lighting, garden and interior customization via construction and placed objects.
- [~] IN PROGRESS — Native isometric furniture; functional storage, benches, lights, warmth, safe bed rest and player-hall guild boards. Additional furniture-specific interactions remain open.

## 11. ADVENTURER GUILD SYSTEM — F TO SSS

- [~] IN PROGRESS — Existing civic halls/inns host physical guild boards, including frontier settlements; player-built halls can craft their own. Original guild desks/standards and dedicated stewards form civic annexes; replacement hall prefabs remain open.
- [x] IMPLEMENTED & TESTED — Register, receive a persistent ledger identity card, accept verified commissions, select classes and form parties through the existing systems, share nearby living-party kill credit and unlock rank-B Wayguard specialization.
- [x] IMPLEMENTED & TESTED — **F → E → D → C → B → A → S → SS → SSS** with two commissions and a practical trial per promotion.
- [x] IMPLEMENTED & TESTED — SSS requires distinct credited defenses in all six kingdoms plus two legendary bosses after acceptance, following all previous promotions. No repeatable rank-XP shortcut.
- [~] IN PROGRESS — Practical/cross-profession/boss mastery and actual raid-outcome proofs implemented; authored branching world-changing guild storylines remain open.

### Quest boards

- [~] IN PROGRESS — 25 ledger entries covering hunts, supplies, crafting, farming, fishing, trade, archives, experimentation, bosses and kingdom defense. Four daily surveyed escort/rescue, physical branching investigation and resource-backed diplomacy jobs supplement the fixed ledger; authored world-changing campaigns remain open.
- [x] IMPLEMENTED & TESTED — Original projected physical boards with a readable matching desktop/mobile ledger, server reach/eligibility checks and one-time rewards.

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

See [TRAVEL.md](TRAVEL.md) for rules, files, validation and limits.

- [x] DONE — Discoverable fast-travel shrines: waystones in every surface settlement and one per wild region, attuned by walking up (rewards, beacons, atlas).
- [x] DONE — Magical teleporters: Recall Shard (learned at 3 attuned stones) returns you to a bound home from anywhere.
- [x] DONE — Kingdom waypoint networks: travel between any attuned stones of one kingdom network, with fares and Wayfarer discounts.
- [x] DONE — Realm portals: a Realm Gate in each capital and Hadamere links the networks.
- [~] IN PROGRESS — Horses and fantasy mounts: Riding Horse (shop) and Moonlit Stag (12 stones) are ridden with shared-sim speed and saddle rules; no stabling, feeding, naming or flying mounts yet.
- [~] IN PROGRESS — Sailing and ocean travel: Sloop Charter sailing (existing) plus Ferry posts at every kingdom's seaward outpost; no ferry voyage scene.
- [~] IN PROGRESS — Roads, bridges, ports, and caravan routes: generated kingdom roads now speed travellers and riders, ports have ferries; caravans and dedicated bridges are not built.
- [~] IN PROGRESS — Meaningful exploration rewards and secrets: wild stones pay XP and coins, Wayfarer ranks cut fares, the Recall recipe and the Stag are exploration rewards; more secrets remain.
- [x] DONE — Fast travel must be convenient without removing the satisfaction of discovering locations: only attuned stones, only from a stone, never mid-fight, channels break on movement or damage.

## 15. QUANTUM PROGRESSION OVERHAUL

- [~] IN PROGRESS — The existing quantum progress board is too confusing.
- [~] IN PROGRESS — Redesign it into a beautiful, intuitive, game-like progression interface.
- [~] IN PROGRESS — Simple everyday language.
- [~] IN PROGRESS — Short explanations.
- [~] IN PROGRESS — Clear icons and upgrade descriptions.
- [~] IN PROGRESS — Obvious progression paths.
- [~] IN PROGRESS — Interactive learning challenges.
- [~] IN PROGRESS — Beginner-friendly onboarding.
- [~] IN PROGRESS — Optional advanced scientific details.
- [ ] NOT STARTED — Quantum-inspired gameplay integrated with Chronoria.
- [~] IN PROGRESS — Accurate explanations where real quantum concepts are referenced.
- [~] IN PROGRESS — Players should understand how to progress without knowing quantum computing beforehand.

Circuit workshop continuation: five guided patterns reuse actual tokens/edit constraints and show real outcome/slip previews before explicit draft application. Class/orb milestones and expandable class details are connected to shared data. Existing tutorial/codex/expert science remain. Broader interactive challenges/rewards and additional class/kingdom systems remain open. Validation and merge status: CONTINUE_HERE.md.

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
- [ ] IN PROGRESS — Companions and mounts: three forage-tamed wildlife bonds are implemented and verified; mounts and further companion families remain open.
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
- [~] IN PROGRESS — Maps and minimap.
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

### Welcoming-world follow-up (2026-10-24)

Friend feedback addressed through the existing Journal/atlas/input and shared room simulation: practical first-steps progress, complete controls, convenient default bindings, explicit chosen-quest guidance and settlement wards with lower, habitat-specific encounter pressure. This is an onboarding/navigation/balance slice, not completion of the remaining major-world scope. Exact proof and integration status: CONTINUE_HERE.md.

Welcoming-world integration: merged in PR #12 at `b90a1f9` after both CI runs passed. All 436 tests, typechecks, both builds and final solo desktop / multiplayer mobile browser checks passed. This does not mark broader pending master requirements complete.

### Weapon field guide continuation (2026-10-24)

Pack attack comparisons now distinguish real Focus swaps from strongest-sword quick-bar bonuses, show charged/tap/heal/volley/morph behavior and shared level requirements, and preserve reading state on profile refreshes. Public level updates refresh open-pack eligibility. Numeric formulas remain shared with existing authority; no new weapon family, combat balance or survival system is implied. Proof and integration status: CONTINUE_HERE.md.

Weapon field guide integration: merged in PR #13 at `5fae659` after both CI runs passed all 444 tests, typechecks and build. Both final build variants and real solo desktop / multiplayer mobile pack checks passed locally. The broader master scope remains in progress.

Travel-needs continuation (2026-10-24): a complete opt-in hunger/thirst loop reuses existing character JSONB, PROFILE, tick, food, crafting and wells. Old saves remain Cozy with full reserves. This does not complete temperature/injuries, purification, Hardcore or the full survival brief. Exact proof/integration: CONTINUE_HERE.md.

Travel-needs integration: merged in PR #14 at `f0b3be8` after both final-head CI runs passed all 453 tests, typechecks and build. Both production build variants and final solo desktop / multiplayer landscape supply, save and tutorial-regression checks passed locally. Broader survival and master-overhaul work remains open.

Wildlife-bonds continuation (2026-10-24): tame Brambleback boars, Mossburrow badgers and Glimmerhart deer through actual forage offers and authoritative calm/range/ownership/slot checks. Reuse natural critter art, roster progression and persistence, with real shove/slow/safe-rest traits and no new HUD. Existing echo repeated-charge hit tracking is corrected. Resident hiring and travelling merchants remain open; exact validation/integration status: CONTINUE_HERE.md.

Wildlife-bonds integration: PR #15 merged at `173a763` after push CI `40068679527` and PR CI `40068682027` passed all 462 tests, typechecking and build on implementation head `fb344ad`. Both final build variants and actual solo desktop / multiplayer landscape taming, commands, follow, rendering and save/reload loops passed locally. Resident recruitment, travelling merchants and the broader master scope remain open.

Personalized-controls continuation (2026-10-24): a saved keyboard / held-RMB steering preference, normal directional key→preview→left-click casting even with selected enemies, actual form reach and modality safeguards reuse current input/prediction/combat. Following user feedback, bounded wilderness populations move closer and wildlife gains nocturnal habitats; town wards and newcomer protections remain. No new combat engine, species or pathfinder. Exact validation/integration: CONTINUE_HERE.md.

Personalized-controls and density integration: PR #16 merged at `5129ea2` after push CI `40079919304` and PR CI `40079924251` passed all 475 tests, typechecks and build on head `ac7c876`. Final solo desktop / multiplayer landscape control loops, existing first-steps regression, both production builds and batched/final visual checks passed locally. This does not mark the broader master overhaul complete.

Melee-arsenal continuation (2026-10-24): three real main-hand sidegrades—Iron Spear (level 3), Broadhead Battle Axe (6), Iron Warhammer (10)—are craftable through the town forge and stocked by Brannoch. Shared profiles determine predicted and authoritative tap/heavy reach, arc, recovery, lunge, damage and poise; remote FX carry the same weapon identity. Sword and existing Foci/morph rules remain. Family swaps clear charge/combo while retaining recovery. Packed-ACK replay retains derived weapon context without expanding the wire format. Original cached directional held artwork and matching icons use current materials/palette. This is the melee portion of equipment progression; new ranged families, resident recruitment, travelling merchants and the broader master scope remain open. See CONTINUE_HERE.md for proof/integration.

Melee-arsenal integration: PR #17 merged at `692333b` after push CI `40084458752` and PR CI `40084461637` both passed all 484 tests, typechecks and build on final head `510e851`. Both local production builds, final solo desktop/multiplayer landscape craft-to-combat/save flows, all-weapon pose bounds and two-client remote rendering checks passed. Further equipment families and broader master requirements remain in progress.
