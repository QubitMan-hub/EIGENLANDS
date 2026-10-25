# Veyr, the Stormbound Colossus

Original character design supplied by the user as `boss1.png` in this task. The user states they made the sheet. Isometric facings and poses were created by image generation using that attached design as the edit reference, then normalized through `art/stormbound.ts` in the browser Canvas pipeline. No third-party sprite pack or game artwork was imported.

`veyr.png` is the shipping 768×384 palette atlas: eight 96×96 cells per row, four rows. Rows: SE, SW, NE, NW. Columns: idle, four walking poses, windup, hot-core strike, defeated rubble. The foot contact is (48,86). All poses share one scale. The raw generated intermediate remains outside the repository; the game ships only the approximately 96 KB normalized atlas.
