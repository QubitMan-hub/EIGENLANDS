# Seafaring

Beyond the home continent (radius 150–230 tiles from the spawn shrine) the world becomes open sea broken by islands
and archipelagos (`worldgen.ts`: `SEA_START`, `SEA_FULL`, an `isles` noise blended over the land height). Roughly four
tiles in five are water out there; the islands carry the same biomes, ore (silver/gold sit out here), shrines and bosses.

## Sloop
- **Sloop Charter** (`sloop`, workbench: 24 planks, 8 cloth, 2 iron ingots; known from the start). Use it, or press `H`,
  at the water's edge to board; again at a shore to step off. Needs 3x3 of open water to cast off.
- Sailing is `PlayerSim.boat`. `stepPlayer` swaps the collision query for `solid.sea` (land and obstacles solid, open water
  free), disables dashing, and multiplies speed by `BOAT_SPEED_MULT` (1.55). Because it lives in the shared sim and in the ACK,
  prediction is exact. `PlayerState.flags` bit 7 tells other clients you are afloat.
- Attack fires **cannons** instead of melee (`CANNON` in `equipment.ts`): a cannonball, or held and released a three-ball
  broadside. They reuse the ability engine's bolts; bolts and projectiles are blocked by `shotBlockedAt` (land, walls, trees
  but not water), so everything flies over the sea.

## Sea creatures
`EnemyDef.sea` creatures use the same AI with `solid.sea` as their wall.
- **Corsair Sloop** (`pirate`, kind 13): armoured caster that circles and fires cannonballs (orbs); drops doubloons, planks, cloth, iron.
- **Brine Serpent** (`serpent`, kind 14): charging brute from deep water, level 8+; drops doubloons, hide, qubit crystals.
`SailingModule` spawns them around boating players more than 120 tiles from home (budget 4), so the home waters stay safe.
Sea kinds cannot be extracted as shadows (they could not leave the water).

## Art
`art/ships.ts` lofts a ship from a ground-plane model (hull lens, sail quad with billow, wake foam) at 16 headings x 3 sail frames,
lazily cached; sloops have pale sails, corsairs black ones with a skull. The serpent is a head sprite plus humps drawn
as bobbing ellipses. `?lab=ships` in the art lab shows them all.

## Not yet
Ship upgrades and crews, harbours, sea shrines and treasure maps, tides/storms that push the hull, boarding actions.
