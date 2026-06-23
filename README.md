# Hank's Homestead 🌾

An isometric farming game built with **React + three.js** ([@react-three/fiber](https://docs.pmnd.rs/react-three-fiber)),
with low-poly art from the CC0 [Kenney Nature Kit](https://kenney.nl/assets/nature-kit).
Grow crops through the seasons, sell your harvest, and build up the homestead.

## Quick Start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Controls

**Desktop**

| Input | Action |
|-------|--------|
| Left-click / drag on the field | Select tiles to plant/water/harvest (Hank auto-walks there) |
| Right-drag | Orbit the camera |
| Scroll | Zoom |
| WASD / Arrows | Move Hank |
| E | Act on the current tile |
| 1–4 | Select the season's action |
| Escape | Cancel / close panels |

**Mobile (touch)**

| Input | Action |
|-------|--------|
| Tap / drag on the field | Act on tiles |
| Two-finger drag | Orbit the camera |
| Pinch | Zoom |
| On-screen D-pad | Move Hank |
| On-screen Act button | Act on the current tile |

## Game Loop

Seasons cycle Spring → Summer → Fall → Winter: plant in spring, water/feed in
summer, harvest in fall, sell at the winter market. (A larger "farm economy"
overhaul — longer seasons, storage, dynamic markets, progression — is planned;
see `BACKLOG.md`.)

## Project Structure

```
src/
├── Game.jsx              # Orchestrator: gameState ref, actions, input, effects
├── three/FarmScene.jsx   # r3f <Canvas>: world, camera, lighting, meshes
├── ui/Hud.jsx + hud.css  # HTML overlay UI (cozy farmstead theme)
├── game/constants.js     # CROPS, BUILDINGS, SEASONS, grid sizes
├── game/logic.js         # A* pathfinding, farmland/walkable, snake-queue
├── game/assets.js        # Kenney model registry + farmer config
└── hooks/useAudio.js     # sound / music / ambience
public/models/            # GLB assets (nature-kit + character)
```

See `CLAUDE.md` for architecture notes and `BACKLOG.md` for the roadmap.

## Deploying

Hosted on **Netlify** (`hanks-homestead.netlify.app`) with **continuous
deployment from `main`** — pushing to `main` triggers a build + deploy.

Note: the Claude Code sandbox can't deploy directly (its outbound proxy blocks
`api.netlify.com`), so deploys happen via Netlify's GitHub integration on push,
or manually from the Netlify dashboard (**Deploys → Trigger deploy**).
