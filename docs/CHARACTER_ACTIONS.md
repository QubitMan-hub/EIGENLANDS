# Character art and action poses

## Current implementation — 27 October 2026

The legacy 24×32 person painter has been replaced by the original native **32×48** model in `client/src/art/person-model.ts`. It draws all thirteen outfit presets, saved appearance combinations and resident outfits through one model in eight directions. This is new pixel geometry, not an enlarged copy of the old frames. Faces have brows, eyes, cheek/jaw planes and necks; clothing has tailored silhouettes, collars, closures, belts and pouches; armor, aprons, mantles, hair and hats retain their appearance identities. The existing 48-color palette, hard alpha and upper-left lighting remain the standard.

People use a bottom-center frame anchor (16,48), with normal boot contact near y46. The shared hand solver positions the body, held tools and fishing-line origin. Title previews, labels, labs and rider cropping use the new dimensions. Base outfit atlases are lazy and separate (960×384), avoiding a larger all-outfit texture and its startup bake. Supplemental frames remain lazy with the existing bounded cache. Held strips remain 56×512 for supplemental poses.

## Animation coverage

Eighteen families have eight timed poses in eight directions: mining, chopping, digging, watering, fishing, gathering/planting, crafting, extraction/channeling, seated transport, swimming, conversation, hurt, dodge, death, forging, cooking, alchemy and carpentry. This is **1,152 directional supplemental frames per appearance**. Additional keys interpolate joint positions between deliberately different contact poses; they are not 1,152 separately hand-painted illustrations. Legacy frame ordering and saved identities remain compatible.

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
