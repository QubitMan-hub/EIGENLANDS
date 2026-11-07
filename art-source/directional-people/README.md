# Approved directional source people

Generated source turnarounds approved by the user in this conversation, followed by the user's camera-only isometric revision. Preserve the designs, proportions, outfit identities and palettes. `original-turnarounds/` records the approved first versions; `heroes.png`, `commoners.png` and `robes.png` are the elevated-camera production sources. Each sheet is 4×4: the first two rows are one male, the last two one female; each actor follows S, SW, W, NW, N, NE, E, SE. These are generated source art, not claimed to be hand-drawn.

`qubitman-statue.png` is the separate isometric founder source, inspired by the user's own founder reference: hat, scarf, coat, right-hand sword and left-hand shield. It is not an imported third-party game asset.

Run `python3 tools/art/prepare_directional_people.py` and `python3 tools/art/prepare_qubit_statue.py` from the repo root (Pillow, NumPy, SciPy). Preparation clears soft/export coverage, keeps one scale per actor, preserves the actual views, quantizes and packs transparent RLE/cells. Sources are not loaded by the browser. Metadata/checksums and visual evidence live in `docs/validation/directional-people`.
