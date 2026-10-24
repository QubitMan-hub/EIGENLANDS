# Camera, icons and grounding

RMB camera drift came from a separate eased cursor offset in Game. Removed that state and offset; the camera uses the same interpolated player position as actor rendering, with device-pixel snapping. Existing RMB movement/aim and ability input remain. Settings and Journal now describe the centered behavior.

The icon painter retains the shared palette and native 16×16 canvas with nearest sampling, but uses clean material bands. Stone, coal and ore silhouettes now have authored stone facets and contrasting mineral clusters. Compact hotbar and ingredient icons no longer resize 16px art to fractional 24px scale.

Broadleaf and pine trunk bottoms now agree with their ground anchor, including quantum-tree source frames. Animated tile objects and props refresh anchors from the actual frame. Player/creature shadows copy the actor anchor and ground position, and use the same projected flattening as props; the art lab matches runtime.

The existing virtual sun drives all cast-shadow families from game time. Sun/moon azimuth and elevation now continue through the day and night, with shadows fading at the horizon rather than abruptly switching to a fixed night direction. Existing ambient colors, weather and lights continue using the same hour. No sky overlay is added to the top-down view.

Verification includes personalized-controls gameplay and visual-grounding browser scripts: actual held-RMB movement and direction changes, measured centering, six town times, horizon continuity, sun direction reversal and icon gallery. Full test/build results are reported with the implementation handoff. Remaining limits: material highlights are baked pixel art, not dynamically relit surfaces; not every inventory silhouette has been individually redrawn. Physical-device GPU performance is not inferred from browser emulation.

Final local checks: 484 tests (100 client, 233 server, 151 shared), all workspace typechecks, multiplayer and solo builds passed. Personalized controls browser regression passed. The final visual-grounding check passed with measured RMB camera centering, actual gameplay tree shadow origin/anchor agreement and morning/afternoon direction reversal, plus six town lighting captures and the icon gallery. Captures are local `/tmp/polish-*` evidence.

Integration: PR #18 merged at `e68d8b5` after both final-head CI runs passed. Landscape personalized-controls and weapon-guide checks also passed; forest/autumn/taiga anchors match their reused tree painters.
