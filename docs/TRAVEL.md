# Teleportation & travel (master plan §14)

Fast travel in EIGENLANDS is earned. You must walk to a place before you can return to it, and you always leave from a
stone, never from the middle of a fight. The design borrows two ideas: Elden Ring's discovery-gated Sites of Grace, and
Breath of the Wild's towers, where reaching one is a reward in itself.

## What players get

- **Waystones.** Every surface settlement has one in a clear yard near its square. One more stands in each wild
  192×192-tile region, preferring a spot beside a road. Walking within 3.5 tiles attunes a stone. No button press is
  needed.
  - Settlement stones pay XP.
  - Wild stones pay more XP plus coins, so going off the road is worth it.
  - The first attuned stone becomes your Recall home.
- **Kingdom networks.** From an attuned stone you can travel to any other attuned stone in the same kingdom network:
  - the home network (Hadamere and the open wilds);
  - Aurelion, Sylvaris, Khar-Dum, Raijin, Thalassara and Nethrakar.

  The window groups destinations by network and shows each fare. Kingdoms you have no attuned stone in do not appear.

- **Realm Gates.** Each capital and Hadamere has a three-tile arch with a swirling portal. Travel between kingdoms must
  leave from a Realm Gate or Ferry and arrive at one.
- **Ferries (ports).** Every kingdom's seaward outpost or farm has a bell-and-lantern ferry post. Ferry-to-ferry
  crossings cost less than a gate's tithe. You can still sail yourself with the existing Sloop Charter.
- **Fares.** A local hop costs 4 + distance/40 coins. A crossing costs 25 + d/80 by ferry, or 45 + d/60 through a gate.
- **Wayfarer rank.** You gain a rank every 5 attuned stones, up to rank 4. Each rank makes every fare 12% cheaper.
- **Recall Shard (magical teleporter).** Attuning 3 stones teaches the recipe: 4 stone + 1 qubit crystal at a
  workbench makes 2 shards. Harbour shops also sell them. Use one anywhere, including underground, for a five-second
  channel back to your bound home. Bind any attuned stone with **Bind as home** in its window.
- **Safety rules.** Travel needs a 2.5-second channel and the Recall Shard a 5-second one. Moving, being struck or dying
  breaks the channel. You cannot start while a hostile is within 10 tiles, while sailing, or while riding a minecart.
  The fare is taken only when the jump lands.
- **Mounts.**
  - **Riding Horse:** buy its whistle from Fenwick at Hartley Farm Supply (900c). Rides at 1.6× walking speed.
  - **Moonlit Stag:** a silver bell given for attuning 12 stones. Rides at 1.85× walking speed.
  - **Mounting and dismounting:** use the item. You cannot mount indoors.
  - **Restrictions:** no dashing, sprinting, tools or fighting from the saddle. Attacking, charging or casting steps you
    down first, and the blow still lands. A rider who takes damage is thrown.
- **Roads.** Kept paths (`T.PATH`) are faster: ×1.12 on foot and ×1.2 when riding. The kingdoms already have generated
  road networks (`roadDistance`) linking the capital, towns, villages and outposts.
- **Exploration feedback.**
  - Each unattuned stone within about 90 tiles sends up a thin coloured beacon: teal for waystones, violet for gates,
    blue for ferries. Attuned stones show a calm rune ring instead.
  - Attuning plays a column of light.
  - The atlas charts attuned stones as diamonds and marks your home with ⌂.

## Implementation

| Piece                                                         | File                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Placement, ids, networks, rules, fares, wire types            | `packages/shared/src/travel.ts`                                       |
| Objects per chunk (settlement + wild)                         | `ChunkStore.townObjectsIn` → `waystoneObjectsIn`                      |
| Gate collision (three tiles)                                  | `objects.ts` `FOOTPRINTS.realm_gate`                                  |
| Mount speed, saddle rules, road bonus                         | `sim.ts` (`PlayerSim.mount`, `SolidQuery.road`), `constants.ts`       |
| Mount sync                                                    | `ACK_FIELDS` + `PlayerState.mount` (appended schema field)            |
| Server: attune, panel, channel, jump, recall, mounts          | `packages/server/src/features/travel/index.ts`                        |
| Saved progress                                                | `prog.ways`, `prog.home`, `prog.mounts` (`validProg`)                 |
| Items / recipe / shops                                        | `recall_shard`, `horse_whistle`, `stag_bell`; `recipes.ts`; `npcs.ts` |
| Client module (beacons, channel bar/ring, hints, atlas feed)  | `packages/client/src/features/travel/index.ts`                        |
| Travel window                                                 | `packages/client/src/ui/travel.ts`                                    |
| Iso art (waystone, realm gate, ferry post)                    | `packages/client/src/art/waystones.ts`                                |
| Mount art (horse, Stag; 4 headings × stand + 4 gallop frames) | `packages/client/src/art/mounts.ts`                                   |

**Placement.**

- Placement is a pure function of seed and world revision. Stone ids encode kind and tile (`g:65:25`, `w:-84:58`), so a
  saved list resolves without storing the world.
- Settlement stones need a 5×5 (gates 7×7) square of open yard. Nothing furnished may be in it, no NPC spot may be in
  it, and no door, wall or face may be within three tiles. This keeps every front-door route and schedule spot reachable.
- Wild stones avoid towns, shrines, ruins and the spawn vale.
- Older revisions keep the home network. The kingdom networks exist only where those kingdoms exist (revision 5+).

**Jumps.** A jump only moves the player. The shard module hands them to the right shard on its next tick, exactly as
when they walk across a border.

## Validation

- **Shared tests** (`test/travel.test.ts`):
  - every kingdom has a gate, a ferry and wild stones;
  - ids are deterministic and resolve;
  - stones are solid with walkable arrival tiles;
  - network and fare rules hold;
  - mount and road speeds are correct;
  - no dash or sprint in the saddle, and attacking dismounts.
- **Server tests** (`test/travel.test.ts`):
  - attunement on approach with rewards, a paid jump, and refusal of an unattuned destination;
  - travel from away from a stone is refused, moving cancels the channel, and a nearby hostile blocks travel;
  - the Recall Shard returns you home and is consumed;
  - mounting, the synced rider state, being thrown when hurt, and the stag's twelve-stone requirement;
  - progress survives storage sanitising.
- **Browser proof** (`e2e/travel.mjs`, solo dev build, run 2026-10-26):
  - three stones attuned on approach;
  - the gate window listed two destinations;
  - the 2.5 s channel bar and ring showed, the jump landed at the target, and the fare was taken;
  - the horse covered 10 tiles in 1.5 s;
  - no page errors.

## Not built yet

- **Caravan routes:** travelling merchants that actually travel along the kingdom roads.
- **Bridges:** dedicated bridge pieces. Generated roads already cross with the terrain.
- **Ferry passage:** a sailing cut-scene for ferries (they jump like gates).
- **Mount upkeep:** stabling, feeding and naming.
- **More mounts:** further fantasy mounts beyond the Stag; flying mounts.
- **Undercroft network:** a network of its own underground. Travel is surface-only by design; the Recall Shard works
  everywhere.
- **Gamepad selection:** gamepad focus order in the travel window has not been reviewed on hardware.
