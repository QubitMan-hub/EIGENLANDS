# Essential humanoid animation

Converted from the user-supplied `Free Essential Animation CC0 _1_.zip` (Idle, Run, Attack, Hit, Death).
The archive is presented as CC0 and contains no separate license or author file. No attribution is invented.
CC0 reference: https://creativecommons.org/publicdomain/zero/1.0/

The files contain a shared 25-joint skeleton and animation takes, **no character mesh**. The game's solid
voxel body is built around this skeleton; its appearance is authored by EIGENLANDS, not a copied source mesh.

`essential.glb` retains the skeleton hierarchy and motion. Source frame offsets are removed; clips retain
30 Hz timing. Each take is baked in world space onto Idle's hierarchy to account for different FBX joint
bases (especially Hit). Only uniform unit/heading normalization and in-place gameplay anchoring happen at runtime.
Source hashes and exact durations are recorded in `manifest.json`.

Rebuild with Blender 4.x:

    blender -b --python tools/voxel/import-essential-animation.py -- "source.zip" output-directory

Verify the export against the extracted source FBXs:

    node tools/voxel/verify-essential-animation.mjs extracted-source-directory output-directory/essential.glb
