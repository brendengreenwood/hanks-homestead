# Kenney Nature Kit models go here

Drop the `.glb` model files from the [Kenney Nature Kit](https://kenney.nl/assets/nature-kit)
(CC0) directly into this folder, e.g.:

```
public/models/nature-kit/
  ground_grass.glb
  tree_default.glb
  rock_largeA.glb
  plant_bushSmall.glb
  ...
```

Then, in `src/game/assets.js`:

1. Make sure the filenames listed in `MODELS` match the files you extracted.
2. Set `USE_KENNEY_ASSETS = true`.

The 3D scene falls back to procedural placeholders for any entity whose model is
missing or unmapped, so you can drop files in incrementally.

The kit downloads as a zip from kenney.nl. In a sandboxed/CI environment that host
may be network-blocked — download locally and commit the GLBs, or add `kenney.nl`
to the environment's network allowlist.
