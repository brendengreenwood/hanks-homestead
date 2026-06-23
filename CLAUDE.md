# Instructions for Claude Code

You're continuing development on **Hank's Homestead**, an isometric farming game.

## Critical Context

The game was migrated from a single-file pure-Canvas 2D renderer to **3D with
three.js via [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber)** (r3f
v8 + drei v9, pinned for React 18). The old `Game.jsx` canvas monolith is gone;
its history is in git.

1. **Game state lives in a ref** - `gameState.current` in `src/Game.jsx`. Mutate
   it directly, then call `requestRender()` to bump a version counter that
   re-renders the React tree (3D scene + HUD). Do NOT use `useState` for game data.

2. **3D scene is declarative** - `src/three/FarmScene.jsx` reads `gs` and renders
   the world (ground, soil tiles, crops, buildings, farmer). It re-renders when
   the `version` prop changes. Smooth motion (farmer walk/bob) uses `useFrame`,
   not `requestRender`.

3. **HUD is HTML** - `src/ui/Hud.jsx` (+ `hud.css`) is a normal React/DOM overlay
   absolutely positioned over the canvas. All buttons/panels/modals live here, not
   in the 3D scene. The overlay root is `pointer-events: none`; widgets opt back in.

4. **Camera** - orthographic, fixed iso angle, via drei `<OrbitControls>`:
   wheel = zoom, **right-drag = orbit**, left button is reserved for tile picking.

## File Map

| File | Responsibility |
|---|---|
| `src/Game.jsx` | Orchestrator: `gameState` ref, all actions, input, effects |
| `src/three/FarmScene.jsx` | r3f `<Canvas>`, lighting, camera, all 3D meshes |
| `src/ui/Hud.jsx` / `hud.css` | HTML overlay UI |
| `src/game/constants.js` | CROPS, BUILDINGS, SEASONS, grid sizes, helpers |
| `src/game/logic.js` | A* pathfinding, farmland/walkable checks, snake-queue |
| `src/game/assets.js` | **Kenney Nature Kit asset registry** (see below) |
| `src/hooks/useAudio.js` | `useSound`, `useMusic`, `useAmbience` |

## Coordinates

Grid is `WORLD_SIZE` (36×36); the farm field is `FIELD_SIZE` (10×10) at
`FIELD_OFFSET` (13). In 3D each cell is a 1×1 tile; the world is re-centered on the
origin: `worldX = gridX - WORLD_SIZE/2 + 0.5`, `worldZ = gridY - WORLD_SIZE/2 + 0.5`
(see `gx`/`gz` in `FarmScene.jsx`). Tile picking is raycast-based via r3f pointer
events on each soil tile (`onTilePointerDown` / `onTilePointerEnter` in `Game.jsx`),
finalized on a global `pointerup`.

## Art Assets — Kenney Nature Kit (CC0)

3D art is the [Nature Kit](https://kenney.nl/assets/nature-kit). A curated subset
of GLB models is committed in `public/models/nature-kit/` and **enabled**
(`USE_KENNEY_ASSETS = true` in `src/game/assets.js`). Crops use real growth-stage
props (`crops_wheatStageA/B`, `crops_cornStageA–D`, `crop_carrot`, `crop_pumpkin`),
the perimeter is scattered with trees/rocks/bushes (`DECORATIONS`), and buildings
use tent stand-ins.

Any entity whose model is `null` or whose file fails to load falls back to a
procedural placeholder (`ModelErrorBoundary` + `Suspense` in `FarmScene.jsx`), so
the game never crashes on a missing asset.

To add more models: drop the GLB into `public/models/nature-kit/`, reference its
filename in `MODELS` / `DECORATIONS` in `assets.js`, and tune scale via
`CROP_TRANSFORM` or the decoration's `s`. The kit has no farmer or barn; the
farmer is procedural and the silo/farmhouse are tents — add a character/farm kit
for exact matches.

## How to Add Features

- **New crop**: add to `CROPS` in `constants.js`, add a `crop` entry in
  `assets.js`. Placeholder geometry in `FarmScene.jsx` `CropPlaceholder` keys off
  the crop id.
- **New building**: add to `BUILDINGS`, push into `gs.buildings`, map a model in
  `assets.js`. `Buildings` in `FarmScene.jsx` renders footprint + label.
- **New HUD control**: add markup in `Hud.jsx`, style in `hud.css`, wire a
  callback through the `actions` object built in `Game.jsx`.
- **New keyboard shortcut**: add a case in the `handleKeyDown` switch in `Game.jsx`.
- **New sound**: add to the object returned by `useSound` in `useAudio.js`.

## What NOT to do

1. Don't use `useState` for game data — keep it in `gameState.current`.
2. Don't put gameplay UI inside the 3D `<Canvas>` — it goes in the HTML HUD.
3. Don't call `requestRender()` from `useFrame` — animate transforms directly.
4. Don't hardcode model paths in the scene — go through `assets.js`.

## Running

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Likely Next Features

Save/Load (localStorage of `gs`), weather particles, sprinkler automation,
day/night lighting, more crops/buildings, a real farmer character model.
