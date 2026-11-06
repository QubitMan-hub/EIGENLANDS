# Major isometric game art and animation overhaul

Implement a major visual overhaul of my existing game using the attached asset pack as the art direction. Inspect the actual project and integrate the work into the playable game. Do not stop at a plan, mockup, asset browser, or isolated demo.

## Non-negotiable visual priorities

Match these character identities, body proportions, outfits, architecture, vegetation, animals, materials, palette families and pixel-art treatment as closely as possible. Keep the existing game's elevated isometric camera angle. Use characters/*single-view-actions.png for the two hero identities and silhouette proportions, characters/*base-walk* for modular body foundations, and the category sheets for appearance designs. If the original character reference and game screenshot are supplied separately, use those as the primary identity and camera references; their temporary uploads are not included in this archive.

PRESERVE CHARACTER SIZE. Do not shrink the player or NPCs to fit small buildings. Record the current character world height and on-screen height at the current camera zoom before changing anything, and treat that as the minimum. Keep the approved head-to-body ratio and long-legged body structure. Do not turn them into oversized-head chibi characters. If current in-game characters differ from the approved body structure, correct the proportions without reducing total standing height.

Enlarge houses, doorways, rooms, furniture, and other world objects where needed to fit the characters naturally. Do not zoom the camera out to conceal a scale mismatch or silently make the characters appear smaller. Make buildings fit the people, with plausible headroom and entrance width. Use a consistent world scale; door clearance should typically be around 1.15–1.3 times the standing adult height. Apply this in world units, not by comparing arbitrarily scaled catalog thumbnails. Adapt exceptional buildings intentionally.

## Inspect and preserve the existing game

Identify the engine, renderer, asset loader, camera projection, tile dimensions, character controller, animation system, equipment system, NPC definitions, world construction, collisions and depth sorting. Work within the existing architecture where practical.

Preserve gameplay mechanics, quests, NPC identities, dialogue, schedules, inventory, controls and save compatibility. Use a migration if asset identifiers or world data must change. Keep a recoverable version of the current game before substantial edits. Avoid unrelated gameplay or UI redesigns.

## Turn the supplied designs into production assets

Read the pack notes. These images are design catalogs and imperfect generated drafts, not verified game-ready atlases. Preserve their intended design while correcting production defects.

Remove colored backdrops, halos and stray pixels; validate real transparency on light and dark backgrounds. Slice assets individually, preserve complete silhouettes, establish consistent pixel density, and define anchors and bounds. Do not blindly assume every sheet has perfectly uniform cells. Pants contains 55 options; the other customization catalogs contain 50 each.

Repair incorrect or duplicated directions, mismatched proportions, accidental skin fills, clipping and frame drift. Do not display entire catalog sheets as in-world objects. Export named individual assets and organized atlases with metadata appropriate to the engine. Use crisp pixel rendering, without blurred upscaling. Where buildings need extra detail at a larger size, redraw or regenerate consistent details rather than stretching them unevenly.

## Characters and all humanoid NPCs

Build player and humanoid NPCs from the supplied male and female body foundations. Maintain consistent anatomy and scale across idle, motion, work and combat. Add variation through skin tones, faces, hairstyles and clothing while retaining this shared visual language.

Implement interchangeable hair, eyes, mouths, tops, armor, pants, shorts and boots from the catalog designs. Include dresses, robes and job-specific outfits where appropriate to existing NPC roles. Fit clothing to both body foundations where needed. Keep underwear covered by equipped clothing.

Every appearance layer must match the base body’s direction, pose, frame and anchor. Handle front/back hair, sleeves, shoulder armor, skirts and held items with correct occlusion. Hide covered body areas so skin does not poke through clothing. Preserve asymmetric equipment correctly as characters rotate.

Provide eight distinct directions: N, NE, E, SE, S, SW, W, NW. Create the missing directional and action frames; existing catalog art is not a substitute for these. Faces must disappear in back views. Do not mirror asymmetric equipment incorrectly.

## Grounded animation overhaul

Inspect every action the game supports and give it an appropriate animation. Include idle, walking, running, turning, woodcutting, mining, fishing, farming, watering, gathering, crafting, carrying, interacting, combat, damage reactions and falling where supported.

Use believable human movement with preparation, weight transfer, contact, follow-through and recovery. Keep feet planted during stationary work and match movement speed to stride timing. Avoid foot sliding, stretched limbs, floating tools, disconnected hands, and body-size changes.

Woodcutting must use a sensible two-handed grip, torso rotation and axe contact with the trunk. Mining must strike the rock with the pick head. Fishing needs distinct cast, wait, bite, reel and landing phases, with connected rod and line. Farming needs distinct digging, hoeing, planting and harvesting poses. Water must leave the watering-can spout and reach the plot. Crafting must align hands and tools to the workstation.

Use action-specific frame counts and timing. Trigger sound, particles, resource changes and damage at actual contact/completion frames. Handle interruptions and different frame rates without duplicated rewards or missed events.

## Houses, farmland, trees and rocks

Use the supplied house designs throughout the settlement with variety appropriate to existing building functions. Preserve recognizable roof shapes, timber/plaster/stone construction, doors and windows. Enlarge footprints and interiors when necessary, then update entrances, paths, collision, navigation and nearby placements. Avoid overlapping houses or blocking access after scaling.

Use the farmland designs for soil, watering, planting, growth, maturity and harvested states. Normalize diamond footprints and make adjacent tiles join seamlessly. Match crops to actual gameplay data and preserve readable growth stages.

Replace relevant trees with the supplied deciduous, evergreen, fruit, seasonal and young-tree designs. Use coherent stump and log states for harvesting. Integrate rocks, ore nodes and depleted states with existing resource logic.

Handle roof and canopy occlusion so the player remains readable behind tall objects. Base sorting on appropriate ground anchors and footprints. Match lighting and shadows across the whole world; do not retain catalog backgrounds or inconsistent baked lighting.

## Animals and mounted characters

Integrate farm animals and wildlife from the supplied sheets at believable sizes relative to the unchanged human scale. Catalog thumbnail sizes are not world-scale specifications.

Create proper directional and movement animations for animals used by gameplay, with species-appropriate gait, idle, grazing and interaction states. Match horse scale to adult riders.

Use the mounted-rider sheet as the visual target for the two heroes on horseback. Keep rider posture, saddle, reins and stirrups physically coherent. Implement supported mount/dismount, idle and movement states. Separate horse, rider and equipment layers where customization requires it. Update mounted collision, sorting and animation timing appropriately.

## Statues

Rework humanoid statues to match the same body structure and head-to-body proportions as the character foundations. Preserve statue identity, pose, material, weathering and pedestal. Monumental size is allowed, but anatomy must remain consistent with this character style.

## Implementation and acceptance

Proceed in reviewable stages while continuing toward the full overhaul: establish scale and rendering, prepare base assets, integrate characters and NPC customization, complete world/environment changes, add action and animal animations, then validate the complete game.

Test in the actual game, not only an asset preview. Capture comparisons using the same camera angle and zoom. Show the unchanged-size player at several doorways, walking among NPCs, performing resource actions, beside animals and mounted on a horse, and near updated statues.

Verify all eight directions, clothing swaps, action transitions, collision, navigation, entrances, depth sorting, crop progression, resource events and save compatibility. Confirm that buildings were enlarged where needed and characters were never reduced to make them fit.

Deliver the integrated overhaul, organized assets and manifests, screenshots or short recordings, the scale values used, checks performed, and a precise list of anything still incomplete. Do not claim missing animations or unfinished asset cleanup are complete.

