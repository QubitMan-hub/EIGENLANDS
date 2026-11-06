# Isometric animal and rider catalogs

Generated with the built-in image-generation tool from the original character reference and game camera screenshot.

farm-animals.png: 4 columns x 3 rows. Row 1 cow, sheep, horse, pig. Row 2 goat, hen, rooster, duck. Row 3 goose, donkey, dog, cat.

woodland-animals.png: 4 columns x 3 rows. Row 1 stag, doe, boar, fox. Row 2 wolf, bear, rabbit, squirrel. Row 3 hedgehog, badger, raccoon, owl.

mounted-riders.png: 4 columns x 4 rows. First two rows male rider on chestnut horse, last two female rider on gray horse. Intended directions per two-row block: S, SW, W, NW / N, NE, E, SE. Check exact profile vs diagonal accuracy before import.

These are standing-pose illustrations and directional references, not walking/galloping animation sheets. Horse and rider are composited rather than separately rigged layers. Species are presented at catalog scale: rescale against actual game world dimensions before import. Normalize crops, anchors and pixel density; inspect edges and transparency. No in-engine validation has been performed.

## Generation prompts

### farm-animals

Create an isometric pixel-art FARM ANIMALS game asset sheet, matching the crisp dark-outlined pixel clusters and muted fantasy palette of the character reference image 1, and the fixed elevated orthographic camera of game screenshot image 2. Visible tops of backs and heads, 2:1 diamond ground projection, every animal facing screen bottom-left in front-left three-quarter view. Natural recognizable animal proportions, not huge-headed chibi or plush toys. Believable comparative size: horse and cow largest, sheep/goat/pig medium, dog smaller, cat and poultry small. Keep one consistent pixels-per-world-unit scale even if small animals leave generous space in cells.
Exactly 12 isolated complete animals in 4 columns by 3 rows. Row1: black and white dairy cow, cream wool sheep with dark face, chestnut horse with black mane and tail, pink farm pig. Row2: horned tan goat, white hen with red comb, colorful rooster, green-headed mallard duck. Row3: white goose, gray long-eared donkey, brown farm dog, orange tabby cat. One animal per cell, neutral standing poses, full legs hooves paws tails ears and horns visible, anatomically correct limb counts, no cropped elements. Empty transparent background with real alpha; no ground, no cast shadows, no scenery, no fences, no labels, no text, no cell borders, no numbers. All 12 are standalone game sprites with generous padding. Pixel art only, no painted gradients, use crisp blocky edges. Horse bareback, no saddle or rider.

### mounted-riders

Create an isometric pixel-art MOUNTED RIDER DIRECTION SHEET matching reference image 1's two large full-body adventurers and image 2's elevated game camera. Exact original identities: male short brown hair, steel shoulder/chest armor, brown straps, burgundy sash, brown boots; female red high ponytail, white/burgundy chest, teal gold-edged waist panel, burgundy silver boots. Adult proportions same as reference, not chibi. Riders seated naturally astride saddles, thighs on either side, bent knees, feet in stirrups, both hands holding connected reins, correct horse anatomy. Male on chestnut horse with black mane, female on dark gray horse. Horses standing at rest, calm. Muted fantasy palette, crisp pixel clusters and dark outline.
Exactly 16 complete mounted units in regular 4 columns x 4 rows, identical padded cells, consistent scale and feet anchors. Each cell contains ONE whole horse AND ONE rider. Horse large enough to carry adult naturally, rider not giant. Nothing clipped.
Rows1-2 MALE rider: row1 col1 directly front SOUTH, col2 front-left SW, col3 left profile WEST, col4 rear-left NW. Row2 col1 directly back NORTH no face, col2 rear-right NE, col3 right profile EAST, col4 front-right SE.
Rows3-4 FEMALE rider same direction sequence: row3 S SW W NW; row4 N NE E SE.
Critical: show eight distinct facings for each rider, keep horses and riders oriented together. Fixed elevated orthographic camera with visible top of horse back and rider head. No environment, no shadow, no ground, no lettering, no labels, no grid, no watermarks. Actual transparent alpha background. Entire 4x4 sheet only.

### woodland-animals

Create an isometric pixel-art WOODLAND ANIMAL asset catalog in same dark-outlined crisp square pixel-cluster art as character reference image 1, using elevated orthographic camera matching game screenshot image2. Twelve recognizable animals, exactly 4 columns by 3 rows, complete isolated full-body neutral standing poses, all facing front-left bottom-left in same fixed isometric camera. Row1: antlered red deer stag, brown doe, wild boar with tusks, red fox. Row2: gray wolf, large brown bear, small brown rabbit, red squirrel with bushy tail. Row3: hedgehog, badger, raccoon, perched barn owl (owl alone no branch). Natural animal proportions, readable small-scale pixel silhouettes, not chibi plush toys. Keep species size relationships plausible, smaller creatures occupy less cell area. No scenery, trees, ground, shadows, text, grid, labels or numbers. Transparent alpha background with ample padding between all 12 animals. Warm restrained woodland palette, clean deliberate pixel shading, no blurry painting. Each animal whole inside cell with accurate limbs, paws, ears, tails. This is an isolated asset catalog, not a scene.
