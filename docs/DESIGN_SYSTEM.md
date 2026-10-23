# EIGENLANDS design system

Authoritative existing art details: [art style guide](art/style-guide.md). Requested direction: [master request](design/master-request.md). Experience: medieval field journal and crafted adventurer equipment, with restrained quantum cyan/violet reserved for magic. The world is the primary surface; compact functional chrome must leave movement and telegraphs visible.

Geometry: 32×16 2:1 diamonds, existing isokit/Iso geometry, projected visible faces, correct ground/hand anchors, integer device-pixel scaling, nearest-neighbour textures. People 24×32 and eight facings; held objects use personGrip. Creatures retain their directional animation interfaces. Use original or verified licensed art.

UI direction: warm parchment text, ink/navy recesses, weathered bronze and wood framing, square pixel-stepped corners and selective rune decoration. Health carmine, magic mineral teal, stamina ochre, food leaf green, water blue; always accompany colour with labels/icons. Quantum accents are functional state, not generic decoration. Pixel display face for titles/short labels; readable body text for dialogue, recipes and descriptions. Font assets remain local.

Spacing: 4px base, 8px related controls, 12px panel gutters, 16px sections. Keyboard focus must remain visible. Touch controls at least 44 CSS pixels, safe-area aware. Mobile landscape is preferred, with explicit portrait fallback and accessible scrolling. Windows have consistent title/back/close controls and retain focus/input protections.

Motion target: damage trails communicate delayed health loss (existing boss ghost fill; player damage trail remains open); resource changes ease over short durations. No perpetual decoration over the playfield. Respect reduced motion, suppress shake and freeze nonessential loops. Preserve combat telegraphs and cues.

Maps: generate/cache explored chunks only, never the infinite world. World map and minimap share data, markers, legend and waypoints. Never display undiscovered content as explored. Inventory retains real item identity, comparison, categories, filtering and controller/touch affordances.

Anti-patterns: SaaS cards, pill buttons, random purple/blue gradients, glass panels, oversized HUDs, duplicate icons, blurry sprite rotations, bright texture noise, unreachable decoration, hidden collision, invented statistics or placeholder mechanics described as complete.

Visual acceptance: inspect a batched desktop/mobile set of real gameplay, low health, inventory/crafting, progression, map, combat/boss and settings states; one consolidated fix pass and at most one confirmation pass. Record exact tested surfaces in CONTINUE_HERE.md. Screens not inspected remain unverified.

Implemented UI components this pass: compact bronze-bound player ledger with current/max health and numeric progressbar accessibility; matte green-ink windows with parchment labels; explicit quick-bar/backpack sections, named search/category/order controls, selectable item details/actions and keyboard equipment buttons. Filtering and sorting operate only on view indices. Windows use labelled dialogs, visible focus, a Tab loop and focus return. Hunger/thirst/stamina are design targets until real authoritative values exist. Existing class resource bars remain authoritative.
