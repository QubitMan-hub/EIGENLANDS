# Character art and action poses

This continues the character overhaul requested on 27 October. It is a working animation foundation and a targeted art pass, **not a claim that every sprite and every action has received a complete high-resolution authored rebuild**.

## Integrated

- Original player and resident painter: structured collars, garment seams/buttons, belt pouches, quieter hair clusters, directional fringe and skin-based cheek tones. Appearance IDs, outfits, eight facings, lighting and feet remain compatible. World ground shadows replace baked character shadows, avoiding shadows that rise with a saddle or bent pose.
- Eleven appended four-key families in eight directions: mining, chopping, digging, watering, fishing, gathering/planting, crafting, extraction/channeling, seated transport, underwater strokes and conversation. This adds 352 directional body frames without replacing the existing combat, walk, run or customization indices.
- Shared near-hand/support-hand rig binds body and equipment together. Work timing has a longer anticipation, short contact and settling recovery. Planting, harvest and construction confirmations now identify the acting player, including for observers. Crafting uses its existing authoritative actor ID.
- Tool selection and confirmed resource events choose the actual working implement. Unarmed work hides unrelated equipped weapons. Walking, death, dodge and combat take priority over stationary gestures. Fishing stays posed while a cast is active; the world line starts at the rendered rod tip. Extraction uses the confirmed channel lifetime. NPC dialogue triggers a brief facing gesture in both participants.
- Cart/mount riders get a seated pose and a short eased mount/dismount height transition. Underwater players stroke/kick outside buildings; indoor residents keep standing. Reduced motion uses a held contact pose and skips height easing.
- Supplemental body frames are generated only when requested and cached with a 512-texture bound, avoiding a multiplied all-NPC startup atlas. Supplemental held-item strips remain 56×512; existing held strips and frame indices remain compatible.
- Ranged bosses now display authored strike/recovery art when their AI fires directly from windup into recovery. Multi-projectile attacks do not reset the same strike on every orb.

## Verification

`npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build:pages`.

Browser commands, with a source Vite server on 5174 and built solo preview on 5244:

```
node e2e/person-actions.mjs http://127.0.0.1:5174/ /tmp/person-actions
node e2e/person-actions-gameplay.mjs http://127.0.0.1:5244/ /tmp/person-actions-gameplay
node --import tsx e2e/boss-gameplay.mjs http://127.0.0.1:5244/ /tmp/boss-gameplay
node e2e/stormbound.mjs http://127.0.0.1:5244/ /tmp/stormbound touch
```

The art check covers 352 directional poses, alpha, open-edge clipping, frame reuse and held-sheet bounds. Production action checks replay confirmed room FX through the real client renderer and separately exercise persistent fishing and extraction state; these are presentation tests, not a replacement for the server's inventory, farming or combat authority tests. Boss checks exercise actual synchronized enemy AI. Mobile screenshots use browser emulation, not physical-phone profiling.

## Still required for the full requested overhaul

- Fully authored higher-resolution player/NPC sheets matching the reference quality across every appearance and action; current figures remain the original 24×32 modular art, polished rather than entirely replaced.
- More than four authored key poses per work action; continuous contact solving against variable-height benches/resources, per-item hand grips, foot planting and terrain-aware limb placement.
- Unique station-specific crafting sequences, complete NPC work/sleep/social schedules with matching body art, distinct interactions for every prop and settlement occupation.
- Full mount-specific climbing/landing sequences, aquatic body rotation and buoyancy, all eight-direction equipment occlusion refinements, shadow-extraction hand-to-residue effects and network-visible persistent casting state.
- Physical-device animation/performance profiling and multiplayer visual review with multiple simultaneous workers/riders.

Keep these open in the master/remaining-work index. Do not label the user's entire character-and-every-action request complete based on this batch.
