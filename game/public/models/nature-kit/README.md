# Kenney Nature Kit models

This folder holds a curated subset of the [Kenney Nature Kit](https://kenney.nl/assets/nature-kit)
(**CC0 / public domain** — no attribution required, but credit appreciated).

These `.glb` files are referenced by `src/game/assets.js` (`MODELS`, `DECORATIONS`)
and loaded by the 3D scene via `@react-three/drei`'s `useGLTF`.

## Adding more models

1. Grab the full Nature Kit from kenney.nl (GLTF format) and drop the `.glb`
   files you want here.
2. Reference the filename in `src/game/assets.js`.
3. The scene falls back to a procedural placeholder for any missing/unmapped
   model, so you can add files incrementally.

> The full kit downloads as a zip from kenney.nl. If that host is network-blocked
> in your environment, the same CC0 GLBs are mirrored across many public GitHub
> repos (search for `tree_default.glb`) and can be pulled via
> `raw.githubusercontent.com`. Known-good mirrors used here:
> `BastiaanOlij/godot-vr-weapons` (full Nature Kit under
> `assets/kenney.nl/naturekit/Models/GLTF format/`) and `rzuf79/experiment-world`
> (Kenney **Food Kit** under `godot/3d/kenney_food/` — same flat-shaded CC0
> style; `crop_tomato.glb` here is its `tomato.glb`).

## Library on deck (downloaded, not yet used)

- `crop_melon.glb`, `crop_turnip.glb` — future crops; add to `MODELS.crop`
  in assets.js + `CROPS` in constants.js to enable.
