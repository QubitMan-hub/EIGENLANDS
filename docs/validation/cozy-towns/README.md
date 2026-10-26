# Cozy settlements — evidence

- `roof-gallery.png`: 20 authored views across ten roof/culture profiles, day/night, using the shipped building renderer and cached textures.
- `home-12.png`, `capital-23.png`, `home-mobile.png`: real procedural town art at desktop and 844×390 landscape sizes. The lab's character lineup and cutaways are for inspection; these are not NPC AI benchmark captures.
- `art-report.json`: populated building pixels and light points, seven world scenes, no page errors. The separate homestead audit covers 1,248 icons, 33 construction pieces, seven species/four facings, all catalog prop facings/frames and guild artwork.
- `contrast-report.json`: every audited page has zero low-contrast text nodes and zero horizontal scrollers after the counter/badge corrections. Normal vertical page scrolling is retained.
- `performance-report.json`: built solo Performance mode, three desktop scenes in software Chromium. Capital entry still produced six long tasks; this is retained as a limitation, not presented as a hardware FPS guarantee.

The built travel replay attunes real stones, pays for a jump, rides with the whistle and retains saved travel progress. The ranch replay grows, cares for, trains and rides a saved animal, checks Space/dismount text, resolves physical clues and reloads persistent training/guild identity. The latest merged build also replays the actual caravan shop with assertions for reach, shop identity and browser errors. Main through `4d0c9ac` retains bridge/ferry/underground travel and mount care. Server tests additionally exercise Glimmerhart identity across travel-care ticks, the Circuit spell/ultimate dismount path and role/quest/ownership authority.

Reproduce source art with `node --import tsx e2e/cozy-towns.mjs <fresh-vite-url> <out>`. Build/preview solo, then run `e2e/travel.mjs`, `e2e/living-guilds.mjs`, `e2e/ui-contrast.mjs <url> <out> --assert` and `e2e/desktop-performance.mjs <url> <out> --graphics=performance --frames-only`. Set CHROME to the local Chromium executable where required. No physical phone, real friend-network or Render deployment claim.
