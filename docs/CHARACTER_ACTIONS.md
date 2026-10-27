# Character art and action poses

## Current implementation — 27 October 2026

Player art uses the original native **32×48** model in `client/src/art/person-model.ts`. It draws all thirteen player outfit presets and saved appearance combinations in eight directions. At the user’s request, NPCs retain the previous original **24×32** painter in `npc-model.ts`, including their proportions, faces, clothing, palette and eight facings. Their newer directional animation keys remain integrated. This is new pixel geometry, not an enlarged copy of the old frames. Faces have brows, eyes, cheek/jaw planes and necks; clothing has tailored silhouettes, collars, closures, belts and pouches; armor, aprons, mantles, hair and hats retain their appearance identities. The existing 48-color palette, hard alpha and upper-left lighting remain the standard.

Players use a bottom-center frame anchor (16,48), with normal boot contact near y46. The shared hand solver positions the body, held tools and fishing-line origin. Player previews, labels, labs and rider cropping use the player dimensions. NPCs use their original bottom-center (12,32) anchor and corresponding labels/lab sizing. Base outfit atlases are lazy and separate (960×384), avoiding a larger all-outfit texture and its startup bake. Supplemental frames remain lazy with the existing bounded cache. Held strips are 64×640 for supplemental poses.

## Animation coverage

Twenty-one families have eight timed poses in eight directions: mining, chopping, digging, watering, fishing, gathering/planting, crafting, extraction/channeling, seated transport, swimming, conversation, hurt, dodge, death, forging, cooking, alchemy, carpentry, sword cuts, spear thrusts and heavy cleaves. This is **1,344 directional supplemental frames per appearance**. Additional keys interpolate joint positions between deliberately different contact poses; they are not 1,344 separately hand-painted illustrations. Legacy frame ordering and saved identities remain compatible.

- Walking/running use jointed legs, opposing arms, lifted recovery feet and restrained fabric follow-through. Existing slash, shot and cast keys use the new body painter and shared hand contacts. Player releases start at contact, followed by follow-through/recovery; actual held charge shows anticipation. Boss timelines remain separate.
- Work uses anticipation, a short contact and longer settling recovery. Mining/chopping select the confirmed implement. Persistent fishing and extraction retain their pose beyond a short FX event. Unarmed work hides unrelated weapons.
- Confirmed crafting events carry the station to observers. Forge/furnace work uses a hammer, cooking a stirring implement, alchemy a vial, and carpentry a saw. These follow the hand; existing recipe authority and costs are unchanged.
- Hurt poses respond to actual damage feedback, dodge crouches follow the dash lifetime, and death collapses through body poses instead of rotating an upright sprite. Reduced motion holds a stable pose.
- Cart/mount seating and eased height transitions remain integrated; cropped rider equipment uses the matching hip offset. NPC conversations use the same directional model.

## Focused verification

```
npm exec -w @eigenlands/client -- vitest run test/person-actions.test.ts test/equipment-pose.test.ts
node e2e/person-actions.mjs http://127.0.0.1:5174/ test-results/cohesion/art
node e2e/person-actions-gameplay.mjs http://127.0.0.1:5244/ test-results/cohesion/gameplay
node e2e/combat-contact.mjs http://127.0.0.1:5244/ test-results/cohesion/contact
```

The art check covers 1,152 supplemental frames and 3,120 base frames across thirteen outfits. It inspects every supplemental direction/key for hard alpha, open-edge clipping, cache reuse and held texture bounds. It caught an overreaching saw at the frame edge; the contact and implement length were corrected. A diagonal combat/support-hand overreach was also corrected in the shared grip solver. Browser checks use the actual production renderer, authoritative FX delivery, persistent fishing/extraction and desktop/mobile screenshots. Short gestures are also checked after pausing rendering through their arrival. See the [QA ledger](qa/2026-10-27-findings.md) for gameplay defects, fixes and evidence.

## Remaining limits

This does not claim a full campaign balance certification or a bespoke physical animation for every item/prop combination. Variable-height station/resource contact IK, complete occupation/sleep sequences, mount-specific climbing/landing, richer charge/combo-specific combat keys and aquatic body rotation remain open. Physical-device profiling and larger cross-network multiplayer visual sessions remain necessary. Browser mobile screenshots are emulation, not phone performance measurements.

NPC restoration check: 96 idle/walk frames across six named residents and eight facings match the pre-redesign pixels exactly. Eight-key conversation clips remain distinct, and the player renderer remains 32×48.

## Weapon-motion batch

Players now use separate eight-key slash, thrust and cleave clips. Spears extend along their aim; swords cut across it; greatswords, axes and hammers use an overhead lift and weighted settling pose. Charge shows anticipation; release starts at contact using the existing attack duration. Base and upgraded weapon identities select the same appropriate family. Crossbow and staff timing remains supported through existing clips, and NPC designs are unchanged.

Held frames now have 64×80 transparent bounds with a (32,60) ground anchor (normalized .5,.75), shared by body integration and labs. This fixes greatsword windup clipping without reducing weapon scale. Legacy strips remain below 2048 pixels (1920×640). Supplemental strips are 64×640. Verification covers 1,344 action frames, 3,120 base appearance frames, all new melee directions/keys including weapon edges, eleven focused unit checks, and the real opening/charge/heavy-release browser scenario.
