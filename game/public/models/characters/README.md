# Character models

Farmer base mesh: **Kenney Mini Characters 1** (`character-male-a.glb`) —
**CC0 / public domain**. It's a fully rigged character with an animation library
(`idle`, `walk`, `holding-right`, `interact-right`, …).

In the game (`src/three/FarmScene.jsx`) it's dressed with a procedural straw hat
and pitchfork to read as a farmer, and crossfades between `idle` and `walk` based
on movement. Tune scale/offset/facing and accessory placement via the `FARMER`
object in `src/game/assets.js`.
