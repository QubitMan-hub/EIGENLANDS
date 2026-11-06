# Sprite generation drafts

Generated using the built-in image-generation tool from the user-provided reference.

NOT GAME-READY: the isometric drafts retain colored backgrounds, repeat some facings, and do not consistently preserve directional attack poses or evenly spaced cells. Do not automatically slice or interpret these as validated eight-direction animations. No in-engine validation has been performed. Single-view action sheets are earlier visual drafts, not eight-direction assets.

Intended directional order: S, SW, W, NW, N, NE, E, SE.
Intended columns: idle 1-2, walk 3-6, run 7-10, attack 11-14, hurt 15, defeat 16. Generated outputs do not reliably satisfy this spec.

## Male directional prompt

Create a full EIGHT-DIRECTION ISOMETRIC GAME CHARACTER ANIMATION ATLAS. Input image is the identity reference. Preserve the original large full-body character's proportions, small head and long legs, costume and colors almost exactly. Crisp pixel art, dark outlines, flat pixel clusters, genuinely transparent background. Fixed orthographic camera elevated approximately 30 degrees above the ground, appropriate to a 2:1 diamond isometric game. Character rotates on the ground plane, camera NEVER rotates or changes elevation.
Exact layout: 16 columns x 8 rows, 128 sprites, ideally 3072x2048 pixels. Every cell identical size, character consistent scale, feet anchored to bottom center with padding; no overlaps or clipping. No labels, no lettering, no drawn grid, no scenery, no drop shadows.
Each ROW has a DIFFERENT direction, critical:
row 1 SOUTH: front facing toward bottom of screen, both eyes visible;
row 2 SOUTHWEST: front three-quarter facing bottom-left;
row 3 WEST: true left profile;
row 4 NORTHWEST: back three-quarter facing upper-left;
row 5 NORTH: true back view, back of head and armor, absolutely NO face;
row 6 NORTHEAST: back three-quarter facing upper-right;
row 7 EAST: true right profile;
row 8 SOUTHEAST: front three-quarter facing lower-right.
EVERY sprite in each row MUST retain that row's facing, including attacks. Anatomical outfit asymmetry must rotate with the body, not simply mirror.
Each row same actions across columns: columns 1-2 idle breathing; columns 3-6 four distinct cyclic walking frames alternating feet; columns 7-10 four distinct cyclic running frames; columns 11-14 four sword attack frames anticipation, raised sword windup, slash, recovery; column 15 hurt recoil; column 16 defeated lying on ground. Generate each whole directional sequence cohesively. No additional props between sprites. Prioritize accurate eight different directions and identity preservation. Maintain 4.5 to 5 heads tall proportions, not chibi. CHARACTER ONLY: male brown-haired warrior at LEFT of reference. Short brown hair, peach skin, slate blue steel torso and single large shoulder armor, brown diagonal chest strap, burgundy waist sash, gold-brown waist panels, charcoal trousers, steel knee plates and bracer, tall brown boots. Stocky athletic torso and long legs exactly as reference. Ignore female and floating heads.

## Female directional prompt

Create a full EIGHT-DIRECTION ISOMETRIC GAME CHARACTER ANIMATION ATLAS. Input image is the identity reference. Preserve the original large full-body character's proportions, small head and long legs, costume and colors almost exactly. Crisp pixel art, dark outlines, flat pixel clusters, genuinely transparent background. Fixed orthographic camera elevated approximately 30 degrees above the ground, appropriate to a 2:1 diamond isometric game. Character rotates on the ground plane, camera NEVER rotates or changes elevation.
Exact layout: 16 columns x 8 rows, 128 sprites, ideally 3072x2048 pixels. Every cell identical size, character consistent scale, feet anchored to bottom center with padding; no overlaps or clipping. No labels, no lettering, no drawn grid, no scenery, no drop shadows.
Each ROW has a DIFFERENT direction, critical:
row 1 SOUTH: front facing toward bottom of screen, both eyes visible;
row 2 SOUTHWEST: front three-quarter facing bottom-left;
row 3 WEST: true left profile;
row 4 NORTHWEST: back three-quarter facing upper-left;
row 5 NORTH: true back view, back of head and armor, absolutely NO face;
row 6 NORTHEAST: back three-quarter facing upper-right;
row 7 EAST: true right profile;
row 8 SOUTHEAST: front three-quarter facing lower-right.
EVERY sprite in each row MUST retain that row's facing, including attacks. Anatomical outfit asymmetry must rotate with the body, not simply mirror.
Each row same actions across columns: columns 1-2 idle breathing; columns 3-6 four distinct cyclic walking frames alternating feet; columns 7-10 four distinct cyclic running frames; columns 11-14 four sword attack frames anticipation, raised sword windup, slash, recovery; column 15 hurt recoil; column 16 defeated lying on ground. Generate each whole directional sequence cohesively. No additional props between sprites. Prioritize accurate eight different directions and identity preservation. Maintain 4.5 to 5 heads tall proportions, not chibi. CHARACTER ONLY: female red ponytail warrior at RIGHT of reference. Preserve slim long-legged approximately 5-heads-tall proportions, small head, peach skin, coral-red bangs and long red/burgundy high ponytail tied teal, silver-white neckline over burgundy fitted torso, teal upper arm band, burgundy/silver gauntlets, gold belt, teal front apron edged gold, asymmetric black trouser on one leg and bare thigh on other, burgundy boots with silver armor. IMPORTANT south row must face DIRECTLY FRONT and southeast row must face RIGHT, southwest LEFT; north must face DIRECTLY BACK. Render on completely empty TRANSPARENT alpha canvas, no colored matte, no brown background. Only female, no male or floating heads.

