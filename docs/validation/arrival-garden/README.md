# Arrival garden and NPC work contacts

The latest main changes through `0acac7a` were integrated before this batch: off-hand shields/release-to-parry, held-item combat rules, settlement layout auditing and drag building, local danger, projectile/aim presentation, pixel-grid text/light/hit feedback and bounty warnings. Both newly advertised branch tips were already ancestors of main. Focused tests for hands, defence, settlement rules, build plans and danger passed (23 tests). The new pixel-label cache also had an active-texture eviction bug: after 650 transient labels, a persistent shared name texture was destroyed. Reference-counted ownership now keeps visible labels alive through eviction, shared release and text/colour updates ([browser regression proof](pixel-label-cache.json)).

## Arrival garden

Wayfarer's Glade adds a compact isometric paved apron around the original shrine, a short trail pointing toward the actual seeded Hadamere, planted flower borders, a picnic blanket, a readable guide board, a musician, porter, gardener, cat, hens and a night watch. Existing scene schedules, weather shelter, posed bodies, animal models, audio and lighting are reused. The watchman's lantern contributes to world lighting.

All additions are cosmetic: no terrain/save migration, new collision, free loot or progression rewards. Decoration and actors yield to edited ground, structures and existing objects. Discovery and routes use only loaded chunks. The population is capped at seven planned actors, one new appearance sheet per frame; owned textures and sprites are released when leaving, and rebuilt for seasonal/seed changes. These are ambient travellers, not new interactive quest/shop NPCs. The guide points players into the existing tutorial, tools and village progression.

[Before](before.png) and [after](after.png) use the same world position, camera, time and game frame; the arrival overlay is temporarily hidden for the comparison. [Guide](guide.png), [night watch](night.png), [browser checks](report.json). The browser check covers visible population, guide content, changing work frames, player-edit exclusion, day/night schedules and leaving-area cleanup.

## Work contacts and movement

- Append-only two-handed/one-handed carrying, sweeping and lute-playing clips, eight poses and eight directions. Existing combat/parry and saved presentation IDs remain unchanged.
- Carrying preserves walking legs/hip weight transfer while the arms support the load. Sweep feet stay planted; the lute neck stays on the supporting hand while the other hand strums.
- Bucket, sack, broom, pole, lute and lantern use actual model grip points and the current posed hand, body type and child scale. Props rebuild their isometric orientation and sort in front/behind appropriately; their movement/bob updates after the current body frame. Carried props no longer include baked ground-contact shadows.
- Appearance warm-up now distinguishes single-frame action poses from bulk walking atlases. Action-only workers no longer consume the walk-atlas budget forever and hide other workers. Browser verification asserts that active human workers have visible bodies after warm-up.
- Unreachable scene paths wait and retry; they do not teleport across an obstruction. Routes that stop making progress are invalidated and replanned with a bounded retry cadence.

Focused checks cover blocked and stalled routes, hand attachment across two bodies/scales/directions, append-only action IDs, scene timing and arrival edit exclusion. Browser asset review covers 1,984 directional action frames and 3,120 original outfit frames with zero clipping/alpha failures. [Action report](../arrival-work-actions/report.json), [carried model grips](../arrival-work-actions/grips.json), [body/prop composites](../arrival-work-actions/carried-props.png).

Remaining: faithful individual catalog silhouettes, larger environment/catalog adaptation, richer mount/dismount transitions, occupation-specific station contacts and the remaining fishing/umbrella contact refinements. The larger art overhaul remains incomplete. Phone/multiplayer frame-rate results are not claimed for this batch.
