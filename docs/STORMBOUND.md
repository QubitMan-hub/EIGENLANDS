# Veyr, the Stormbound Colossus

Veyr adapts the user's original blue crystal boss into four real isometric facings, including rear armor, walking, raised-arm warning, fiery strike and rubble poses. The atlas uses the shared 48 colors, nearest filtering, one scale and a fixed ground contact. Shadows remain in the existing sun system. Reduced motion holds walking frames and retains attack warnings.

At level 22, experiment at a workbench with **6 Iron Ingots, 4 Qubit Crystals and 3 Wolf Fangs** to craft a **Storm Beacon**. Use it on a broad surface clearing far from spawn and settlements. Failed calls consume nothing; a successful call consumes one beacon. Caves, submerged layers, upper floors, obstructed clearings and another nearby Veyr refuse the call. The Journal's existing boss catalog includes the encounter and reward guidance.

Thunderfall marks three fixed positions with 1.7 seconds of warning. At 65% health, Conduction switches to four cardinal strike sites with gaps between them. At 30%, Overcharge adds a delayed strike at the player's previously captured position. Veyr remains still during the special and has a recovery window. Breaking poise cancels its pending storm. There is no homing damage or continuous add spawning.

Victory grants a **Storm Heart**, a Heart Crystal, Qubit Crystals and gold ingots through normal authoritative loot. A Storm Heart, 3 Gold Ingots and 2 Qubit Crystals make a **Stormglass Signet** at a jeweler (+7 attack when crafted, versus +4 on the ordinary Crystal Ring). First victory and inventory rewards persist normally.

Verification scripts: `e2e/creature-art.mjs` checks complete atlas pixels and stable wildlife geometry; `e2e/stormbound.mjs [base-url] [output-directory] [touch]` summons with a real beacon, inspects the live fight and checks unique loot. Server tests cover terrain/layer/level/duplicate gates, fixed telegraphs, recovery, poise interruption, phase changes and reward persistence.
