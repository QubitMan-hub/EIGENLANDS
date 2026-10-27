# Crafting, items and food (master plan §9)

What exists, how it is built and how to add to it. Counts below come from the data; `packages/shared/test/catalog*.test.ts`
fail if any of the rules here break.

## The shape of it

- **One vocabulary** in `shared/src/crafting.ts`: 12 disciplines, rarity, 17 stations, item categories, crafted quality.
- **One catalog** in `shared/src/catalog/`: plain data run through `kit.ts` (`item()`, `rec()`, `src.*`). Modules are pure data
  with only type imports from `items.ts`/`recipes.ts`; those two merge the catalog at the end of their own modules, so the
  load order can never form a cycle. Adding a hundred items is a table, not code.
- **Sources and uses are checked.** Every catalog item must be made by a recipe or have a `Source` (node, mob, boss, forage, fish,
  shop, vault, animal, crop, quest); every material must be an input to something. `catalog.test.ts` walks the whole graph from
  raw materials and fails on an unreachable item, an idle material, a duplicate name or a dangling reference.
- **World hooks read the same data**: node drops (with kingdom and cave filters) in `nodes.ts` and the server's `hitNode`; monster
  and boss drops in `catalogMobDrops` (WorldRoom `killEnemy`); forage (`pickForage`), fish (`FISH_TABLE`), vault loot
  (`catalogVaultDrops`), shop stock (`catalogShopStock`, per shop role and kingdom), crops (`CROPS`), shelters (`FARM_ANIMALS`).

## Files

| File                                             | What it holds                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `crafting.ts`                                    | disciplines, XP curve (level 1-40), rarity, stations, categories, quality                               |
| `catalog/metals.ts`                              | the metal ladder: ore, ingot, alloy, plate, rod, wire for 12 metals (6 are kingdom metals)              |
| `catalog/stone-wood.ts`                          | stones, masonry parts, glass, mortar, 8 woods and planks, resin, handles, rivets                        |
| `catalog/fibers.ts`                              | fibre, thread, cloth, dyes, leather, 17 monster parts                                                   |
| `catalog/gems.ts`                                | 12 gems (rough and cut), 6 elemental crystals, rings                                                    |
| `catalog/alchemy.ts`                             | herbs, mineral reagents, vials, 22 potions, oils                                                        |
| `catalog/magic.ts`                               | 12 enchantments in three strengths (34 runes), charged crystals, essences, wand                         |
| `catalog/armor.ts`, `weapons-data.ts`, `gear.ts` | 22 new armour sets, weapon variants in 11 metals, 4 legendary weapons, and their recipes                |
| `catalog/gear-items.ts`                          | shields, cloaks, packs, amulets, belts, lights, craft tools, repair kits                                |
| `catalog/crop-data.ts`, `farm.ts`, `pen-data.ts` | 57 crops with seeds, fertiliser, farm tools, pens, animals                                              |
| `catalog/kitchen.ts`, `dishes.ts`, `drinks.ts`   | meats, fish, herbs, mill/dairy/pot/oven staples, 156 dishes, 51 drinks                                  |
| `catalog/home.ts`                                | stations, furniture, decor (art is `client/src/art/catalog-props.ts`)                                   |
| `catalog/legendary.ts`                           | legendary gear, scrolls, collectibles, explorer kit                                                     |
| `gear-state.ts`                                  | quality, durability, repair/upgrade costs, enchant rules, `equipmentStats` (server and client share it) |
| `item-info.ts`                                   | the words the tooltip and the crafting book use (effects, where to find)                                |

## Rules a player sees

- **Disciplines.** Every craft trains the discipline of its bench; levels unlock recipes (`learn: 'level'`), raise quality and show
  in the book. XP is saved (`PlayerData.disc`). Recipes carry `disc`, `lvl` and an optional `stage` (1 raw to part, 3 finished).
- **Knowing a recipe** (`recipeKnown`): `start`; `level` once skilled; `realm:<id>` once skilled and Friendly with that
  kingdom; `discover` by experimenting (blocked, with nothing used up, until skilled); `scroll`, `npc:` only when taught. Only
  learned recipes are saved, so thousands of recipes cost a character a few bytes.
- **Craft tools** (`Recipe.tool`): chisel, saw, tongs, sewing kit, loupe, knife, mortar & pestle must be in the pack; they are not used up.
- **Quality and wear.** Gear recipes roll Crude to Masterwork from skill (`craftQuality`). Durability wears when you are hit
  (armour), strike (weapon) or walk in the dark (lantern). Broken gear stays equipped and gives nothing. Gear made before this
  system has no durability and never wears.
- **Gear bench** (the book's Gear tab, server `systems/gear.ts`): repair costs a share of the recipe's inputs, upgrade (+1 to +5,
  6% stats and 10% durability each) costs more per level and needs skill, enchanting binds one rune (rarity gates the strength).
- **Gear slots.** Beside weapon, head, chest, legs, feet and two rings: shield, cloak/pack, amulet, belt, charm, lantern.
  Bonuses include warmth, coolness, less hunger and thirst, light radius, ingredient saving and stamina.
- **Food.** A dish row is `[id, name, station, profile, weight, level, inputs, ...]`. Weight sets health and hunger; profile sets
  the buff (hearty = vigor, spicy = fury, fresh = swift, sweet = regeneration, savory = bulwark, rich = steady, lucky =
  fortune, herbal = focus, cool/warm = temperature). Power scales with level. Seven new buff kinds feed the derived stats.
- **Building.** `BUILD_PIECES` gained materials with a bench and level; art is data-driven by material (`LOOK` in
  `client/src/art/construction.ts`). Furniture rows name a shape and two material ramps; hearths warm, lamps light, cabinets store.
- **Farm.** Seeds are sold by the kingdoms that grow them (shop sources). Fertiliser saves 1-2 days and can add yield. A sickle
  in the pack adds a grain to each harvest, a trowel keeps the seed when you lift a crop, shears and a pail collect wool and goat milk.

## Adding things

1. An item: `item(id, name, cat, { v, g, a, b, d, src: [...] })`, an icon glyph from `catalog/glyphs.ts` (draw new ones in
   `client/src/art/icons-catalog.ts`; the type system demands it).
2. A recipe: `rec(station, [[in, n], ...], [out, n], { lvl, disc, learn, tool, quality })`.
3. A placeable: one row in `catalog/home.ts` (shape and ramps; a new shape is a function in `catalog-props.ts`).
4. Run `npx vitest run test/catalog.test.ts` in `packages/shared`. It will name anything unreachable or unused.

## Not built (kept honest)

- **Saddles, mount equipment and mounts** (nothing to ride); class-specific equipment; dagger, bow and greatsword families (each
  needs its own moves and held art; the sword, spear, axe, hammer and crossbow families have variants).
- Armour sets other than the original five do not redraw your character (`look: -1`); they change numbers, not the sprite.
- Individual bee simulation remains open; poultry and mammals now have breeding, growth and happiness (§10).
- Decorative rain barrels/trellises remain; planted perennial grape trellises, fruit trees, irrigation channels and individual husbandry are now functional: see [HOMESTEADS_AND_GUILD.md](HOMESTEADS_AND_GUILD.md).
- Item counts are 1,245, not thousands. The structure is there; more content is more rows, as long as each earns its place.
- Favourites and tracked recipes live in the browser (`localStorage`), not on the server.
