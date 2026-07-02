# Presentation (active state)

## 3D scene (`src/three/FarmScene.jsx`)
- Orthographic iso camera, drei OrbitControls (desktop free orbit; mobile
  discrete via `CameraRig` easing toward `gs.camAz`/`gs.camTop`).
- Seasonal sky/fog/grass/light from `SEASONS`; **scorcher days** override the
  sun to amber/harsher (`scorch` prop on `SeasonLighting`).
- Buildings (barn/house/silo) are procedural flat-shaded meshes; chickens
  wander/flee; chimney smoke; `lowSpec` (coarse pointer) halves shadows, caps
  dpr 1.5, trims decorations, hides world labels.

## Crops
- Stage models from `MODELS.crop` (assets.js): the **last** entry is mature,
  earlier ones bucket across growth. Corn uses Kenney stages A→D; tomato's
  mature model is the Kenney **Food Kit** tomato (per-file scale override in
  `FILE_SCALE` — Food Kit fruit is tiny). All stage URLs preloaded.
- State is body language, not orbs: fed = 12% lusher · withered = drooped +
  shrunken · watered = soil tint · **mature = pristine bloom + gold drei
  `<Sparkles>`**. Placeholder geometry still covers missing models.
- On-deck models (downloaded, unused): `crop_melon.glb`, `crop_turnip.glb`.
  Mirror provenance: `public/models/nature-kit/README.md`.

## Farmer
- Kenney Mini Characters GLB, idle/walk crossfade + one-shot interact on
  `actionTick`; straw hat + pitchfork portaled onto head/arm bones; damp-lerp
  glide, shortest-arc turns, distance-driven hop. Speech renders in the HUD
  advisor dock, not the scene.

## Audio (`src/game/audio.js`)
- Graph: one-shots → [panner if positioned] → SFX bus → **200Hz highpass** →
  master → **compressor** → out. Music bus reserved.
- All SFX are synthesized (tones + filtered noise), scheduled sample-accurately
  on the audio clock. Bright-leaning design (no sub-200Hz mud).
- **Spatial:** tile-anchored sounds (plant/water/feed/harvest/footsteps) take
  world positions through equal-power panners; `AudioListenerSync` in the
  scene glues the listener to the camera every 8th frame.
- **Footsteps** are material-reactive via `surfaceAt`: grass swish / dry-dirt
  scuff / wet-soil squelch (keyed to per-tile moisture), pitch-jittered.
  They play on manual steps + path walking, not auto-act hops (those carry
  action sounds).
- **Music/ambience: disabled** (`MUSIC_ENABLED = false`); loop player kept.
  The old WAVs still sit in `public/audio/` (~26MB) — candidates for deletion
  or compression when music returns.
