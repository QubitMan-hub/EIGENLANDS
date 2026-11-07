# Character and house reference fidelity

The two split ZIPs are preserved together in `art-source/reference-pack`. All **20 PNGs** were rechecked against the original SHA-256 manifest: [source audit](source-audit.json). Read the actual sheets and their category notes, not just the earlier overhaul summary.

## What the references actually require

- `characters/*single-view-actions.png` supplies the strongest hero identity: substantial steel shoulders, leather harness, ochre tassets, knee guards and tall boots for the male; red high ponytail, pale bodice, teal/gold panels and dark boots for the female. The eight-direction drafts help resolve side/rear volumes. The earlier seven-pixel face and narrow five-head approximation did not reproduce these clothed silhouettes.
- The base-body sheets inform joints, gait and modular layer fitting. They are not a reason to make the fully clothed people as narrow as bare body drafts. Preserve standing height while giving heads, torsos, limbs, hands and footwear sufficient pixel area.
- The seven customization catalogs contain 355 designs, not 355 complete animated outfits. They remain appearance references; this pass does not claim every catalog silhouette has been authored.
- The house catalog contains 12 specific compositions: clapboard/terracotta, plaster-and-oak/slate, log/shingle, fieldstone/thatch, plus larger storey, porch, dormer, cross-wing and round-house variations. Match material construction in world coordinates. Do not flatten a catalog house over working interiors, doors and depth-sorted walls.
- The other sheets cover animals, riders, farm plots, trees and rocks. Their coherent volume, warm materials, restrained clusters and upper-left light are the shared standard. They were reviewed as context; this pass does not replace every asset in those categories.

Some original sheets contain partial alpha, halos, variable cell spacing and inconsistent directions. The category notes explicitly call them drafts. Their documentation is source context; the user's request governs implementation.

## Implemented

Players, named NPCs and ambient workers share broader anatomical volumes, purposeful 12-row directional faces, fuller hair/headwear, more substantial boots and clothing volume. The two hero presets have distinct layered armour and waist garments. NPC identities, saved appearances and selected clothing remain intact; custom clothing does not inherit a hero's armour cut.

Sprite cells now have eight pixels of extra **transparent top padding**: 48×56, ground pivot (24,53). Body and equipment remain bottom anchored. This does not stretch art, change camera zoom, shrink people or move their ground point. Hair and hats have room during raised poses. Tools, weapons, fishing-line origins and mounted reins resolve the rendered male/female skeleton. Carried scene props follow the same updated contacts.

The original four surface house styles now follow the first four catalog material families. Kingdom, cave and underwater identities remain available. Roofs have readable staggered joints; walls have larger framed windows, wood shutters, broader clean plaster panels, real log courses and stone chimneys. Selected cottages gain entry canopies; canopy clearance follows doorway height. Ordinary starter cottages no longer randomly receive castle turrets. Footprints, collision, interiors, ownership and roof cutaways retain existing gameplay.

The pose sweep also exposed an unbounded cloth interpolation: seated knees above the hips were divided by an almost-zero height difference, extrapolating garment support thousands of pixels beyond a bone. Cloth now follows the posed pelvis, stays above ground and interpolates only within leg segments. Bent-leg regression checks and the directional render sweep cover this freeze.

## Evidence

[Reference / before / rebuilt comparison](comparison.png). Source heroes are normalized to 44 pixels high for this analysis; original sheets remain untouched.

[Before people](before-characters.png), [after people](after-characters.png), [before houses](before-houses.png), [after houses](after-houses.png). People are shown at the same 3× pixel scale; the after cells include additional transparent headroom. [Before measurements](before.json), [after measurements](after.json). Measurements are opaque sprite bounds, not cell dimensions.

The 1,904 sampled body/animation frames and 64 body-specific held-tool checks passed without clipping, partial alpha or missing grips. All 19 focused tests passed, including bent-leg cloth support and appearance/building compatibility. Build, type and lint checks are recorded with this batch.

[Directional pose and tool checks](poses.json), [pose contact sheet](poses.png), [gameplay doorway checks](world/report.json). These are focused checks and visual captures, not proof that every cosmetic combination or device has been tested.

Remaining: faithful individual cuts across the entire customization catalog, every one of the 12 house silhouettes (including separate functional upper storeys), remaining mount/station transitions and wider environment adaptation. This is a substantial fidelity correction, not a claim that the full original overhaul is complete or that the references are pixel-for-pixel reproduced.
