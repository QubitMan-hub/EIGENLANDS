# Building your own home

Open **Field crafting** (default **C**) and craft building pieces from wood, stone and fiber. No recipe discovery or town station is required. Clear trees and rocks on wilderness land, select a piece in the quick-bar, aim at a nearby tile and **Use** (default **Space**, or the touch Use button). Your personalized bindings also work.

| Piece           | Cost              | Purpose                                   |
| --------------- | ----------------- | ----------------------------------------- |
| Timber Floor    | 2 wood            | Foundation or upper floorboards           |
| Flagstone Floor | 3 stone           | Stone foundation or upper floor           |
| Timber Wall     | 3 wood + 1 fiber  | Framed plaster wall                       |
| Stone Wall      | 5 stone           | Solid masonry wall                        |
| Timber Door     | 4 wood            | Owner-operated, collision-aware entrance  |
| Slate Roof      | 2 stone + 1 wood  | Connected pitched roof panels             |
| Thatched Roof   | 3 fiber + 1 wood  | Warm straw roof panels                    |
| Timber Stairs   | 10 wood + 2 stone | Paired stairs, including an upper landing |

Foundations need level ground in worlds with elevation (revision 3): the tile and all eight neighbours must sit at the same level, so find or clear a flat terrace; hills, banks and mountain slopes refuse the piece with a message and keep your stack.

Lay floors first. Arrange an arbitrary floor plan, then add walls, doors and roofs. Walls and roofs can share a foundation; furniture, chests and crafting stations use a separate layer. The **Rotate** button appears only while a wall, door, roof or stair piece is selected. It has a 44px minimum touch target. A translucent preview shows the aimed piece; the server checks placement and ownership before consuming it.

Adjacent roof panels with the same material and ridge axis form a shared gable. Enter a roofed room to lift its roof and cut away the nearby front walls. Other rooms remain covered.

Use an ordinary item while standing on stairs to change floors. Extend the upper landing over your own foundations below. Upper floors have solid boundaries outside their built area. Place furniture and roofs upstairs too. Both storeys share the same horizontal shard authority while keeping separate collision coordinates.

A pickaxe + Use reclaims the top component in order: roof, wall/door, stairs, then floor. An axe still reclaims ordinary furniture; empty containers first. Refunds require pack space. Remove the upper landing roof and return everyone downstairs before reclaiming the last stairs. Reclaiming stairs also removes their included landing, preventing duplication. Occupied/furnished floors, foundations supporting upper floors, and routes needed to reach stairs cannot be removed.

Ownership belongs to the authenticated account and persists in both solo saves and multiplayer. Visitors may use reachable stairs and open passageways. Only the owner can edit the structure, place objects on its foundations, or open/close its doors. Leave doors open to welcome visitors. Hostile creatures do not spawn on built foundations; walls and closed doors block their movement.

This implementation supports **two floors** in the main-world construction region, **−10,000 through +10,000 on each horizontal axis**. Towns, the spawn crossroads and occupied landmarks are protected. Caves and ocean instances retain their existing architecture. Horizontal region boundaries retain the game's existing edit-authority rule: edit from the owning region. Arbitrary-height towers, structural collapse, co-owner permissions and house furnishing benefits are separate future features.

Implementation: shared structural collision, additive `104_construction.sql`, existing chunk/OBJ transport, separate local construction namespace, live neighboring-shard object relay, original cached `isokit` artwork. No third-party art or new dependencies.

Art references reviewed before implementation: [Minecraft](https://en.wikipedia.org/wiki/Minecraft), [Terraria](https://store.steampowered.com/app/105600/Terraria/) and [Project Zomboid construction](https://pzwiki.net/wiki/Building). These informed modular crafting, shelter readability and functional access; artwork is original.

Validation entry points: `e2e/construction.mjs`, `/labs/artlab.html?lab=construction`, shared/client/server construction tests and the sharded-building cases in `packages/server/test/shard.test.ts`.

Generated town buildings place their stairs at back corners and reserve a clear landing. Stairs in your own buildings stay where you place them; choose a corner and leave a walking aisle if you prefer that layout.
