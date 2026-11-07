# Directional people, founder and physical items

The user approved the new people and then requested the isometric camera. Preserve those identities: two hero designs plus commoner/robe bases, each with eight authored views. The source order is S, SW, W, NW, N, NE, E, SE; gameplay direction IDs are mapped explicitly. Rear views have rear anatomy rather than mirrored faces.

`art-source/directional-people` preserves the approved initial turnarounds and the elevated-camera versions. `tools/art/prepare_directional_people.py` imports 48 views, using one scale per actor, binary transparency, clear padding and a shared 64×64 cell with ground origin (32,61). Standing figures remain about 44 visible pixels tall. The larger cell is padding, not a change to gameplay size or zoom. `body/directional.ts` fits source parts onto the existing anatomical action rig with nearest sampling and depth ordering. Existing action IDs, appearance fields, saves and input remain compatible. Existing saved looks are kept; the two approved hero presets are selectable and are the defaults on new devices. Custom looks use fitted clothing families, their material colors, hair and headwear. Source hero palettes remain intact. The title-screen portrait no longer stretches a square cell into a narrow rectangle.

QubitMan now uses the dedicated isometric human sculpture with a downward sword and a heater shield. The old plinth origin (78,202), inscription, flames and interaction remain. Crypt/garden statues use the new human bases. Held items use physical projected tool axes, with foreshortening rather than a screen-perpendicular width vector. Shields use each body's skeleton. Common tools, blades, shields, wood, planks, ore/stone blocks and ingots have small isometric inventory models; metal rods retain their separate material glyph.

Proof:

- [All prepared views](turnarounds.png), [tools, icons and founder](tools-statue.png).
- [Live arrival](arrival-world.png), [natural discovery](discovery-world.png), [live movement report](world.json).
- [Pose/contact report](poses.json): 1,904 sampled person frames and 64 held-item contacts. Checks include clipping, binary alpha and coverage near the actual body hand and tool grip.
- [Inventory report](icons.json): all 1,395 current items render; 21 used physical glyph families have new models. This does **not** mean all 1,395 icons were individually redesigned.
- `e2e/directional-world.mjs` checks actual WASD movement selecting all eight distinct facing rows, not just changing the cursor; it also checks discovery proximity and distance culling, with no page errors.

Five sparse, seeded environmental Easter eggs use isometric props and short readable stories: the chosen ladle, tea for two, squirrel crown, clockwork fish, and a lost kite. Cave, underwater and upper-world sites select their own theme. They yield to roads, interiors, edited/occupied tiles and unstreamed ground. They add no loot farm or collision and allocate only a few nearby views plus five cached textures. Discovery is cosmetic; there is no persistent collection/reward system in this batch.

Remaining: individual fitting of the full 355-part wardrobe catalog, full native facial-expression/iris customization on the imported faces, the remaining icon families, and richer bespoke hand-drawn action sequences. Current actions are rigged source cutouts, not newly painted frames for every action. House/environment/animal catalog work remains tracked in [ART_OVERHAUL_STATUS](../../ART_OVERHAUL_STATUS.md). Physical-device and extended multiplayer performance are not measured here.
