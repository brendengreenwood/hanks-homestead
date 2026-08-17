# Instructions for Claude Code

You're continuing development on **Hank's Homestead**, an isometric farming game.

## Documentation system (maintain it!)

Docs live in three time horizons — full process in `docs/README.md`:

- **Future** → `BACKLOG.md` (roadmap/epics)
- **Present** → `docs/systems/*.md` — the active state of each system.
  **When you ship a change, update the relevant page(s)** so they always
  match the game.
- **Past** → `docs/decisions/LOG.md` — append-only decision log. **Every
  substantial change gets an entry**: `D-NNN · date · what / why / rejected`.
  Never edit old entries; a reversal is a new entry referencing the old one.
- Superseded docs move to `docs/archive/` with an `> ARCHIVED <date> — <why>`
  header instead of being deleted.

## Critical Context

The game was **rewritten in TypeScript on the vendored omen ECS engine**
(`packages/engine/`, forked from om-game). The old React/r3f app is gone
(D-020); its history is in git. See `docs/systems/rewrite-omen.md` for the
active architecture.

1. **Repo is a pnpm workspace** — `packages/engine` (omen, vendored fork) +
   `game/` (the app). Root scripts delegate: `pnpm dev`, `pnpm build`,
   `pnpm test:unit`, `pnpm test:e2e`, `pnpm check`.
2. **Sim is ECS** — components in `game/src/sim/components.ts`, systems in
   `game/src/sim/*System.ts`, player actions in `game/src/sim/actions.ts`,
   world factory + `endDay()` pipeline in `game/src/sim/world.ts`. Seeded RNG
   (`game/src/sim/rng.ts`, `?seed=` URL param) keeps flows deterministic.
3. **Presentation is raw three.js** through the engine's `Renderer`/`Loop` —
   `game/src/scene/FarmScene.ts`. No r3f/React.
4. **HUD is plain DOM** — `game/src/ui/hud.ts`, absolutely positioned over the
   canvas, every control carries a `data-testid` for playwright.

## File Map

| File | Responsibility |
|---|---|
| `game/src/main.ts` | Boot: renderer, loop, world, scene, HUD wiring |
| `game/src/sim/constants.ts` | CROPS, SEASONS, UPGRADES, market/contract constants, helpers |
| `game/src/sim/components.ts` | Tile / Crop / Weather / Farm ECS components |
| `game/src/sim/world.ts` | `createFarmWorld()`, `endDay()` system pipeline |
| `game/src/sim/actions.ts` | plant / water / feed / harvest / shop / upgrades / sell |
| `game/src/sim/*System.ts` | Calendar, Weather, Growth, Soil, Sprinkler, Market, Contract |
| `game/src/scene/FarmScene.ts` | three.js scene: ground, tiles, crops, decorations |
| `game/src/ui/hud.ts` | DOM HUD: tools, shop, market, contracts, end-day |
| `game/src/assets.ts` | **Kenney Nature Kit asset registry** (see below) |
| `game/tests/*.spec.ts` | Playwright browser gates |

## Coordinates

Grid is `WORLD_SIZE` (36×36); the farm field is `FIELD_SIZE` (10×10) at
`FIELD_OFFSET` (13). Each cell is a 1×1 tile; the world is re-centered on the
origin: `worldX = gridX - WORLD_SIZE/2 + 0.5`, `worldZ = gridY - WORLD_SIZE/2 + 0.5`
(`gridToWorld()` in `game/src/sim/world.ts`). Tile picking is raycast-based in
`FarmScene.pick()`.

## Art Assets — Kenney Nature Kit (CC0)

3D art is the [Nature Kit](https://kenney.nl/assets/nature-kit). The curated GLB
subset lives in `game/public/models/nature-kit/`. Crops use real growth-stage
props (`crops_wheatStageA/B`, `crops_cornStageA–D`, `crop_carrot`,
`crop_pumpkin`), the perimeter is scattered via `DECORATIONS`. Any model that
fails to load falls back to a procedural placeholder box, so the game never
crashes on a missing asset.

To add more models: drop the GLB into `game/public/models/nature-kit/`,
reference it in `MODELS` / `DECORATIONS` in `game/src/assets.ts`, and tune
scale there.

## How to Add Features

- **New crop**: add to `CROPS` in `constants.ts`, add a model entry in
  `assets.ts`.
- **New sim mechanic**: add a component/system in `game/src/sim/`, wire it into
  the `endDay()` pipeline in `world.ts`, and write a `*.unit.test.ts` beside it.
- **New HUD control**: add markup in `hud.ts` with a `data-testid`, wire the
  callback in `main.ts`, and cover it in a playwright spec.

## What NOT to do

1. Don't mutate sim state from the scene or HUD — go through `actions.ts`.
2. Don't put gameplay UI inside the canvas — it goes in the DOM HUD.
3. Don't hardcode model paths in the scene — go through `assets.ts`.
4. Don't use unseeded `Math.random()` in the sim — use the world's RNG.
5. Don't weaken or skip tests to make gates pass.

## Running

```bash
pnpm install
pnpm dev         # http://localhost:5173  (append ?seed=42 for deterministic runs)
pnpm build
pnpm test:unit   # vitest (engine + game)
pnpm check       # tsc --noEmit (engine + game)
pnpm test:e2e    # playwright browser gates
```

## Out of scope / follow-ups

Audio engine and mobile touch HUD from the legacy app are not yet ported.
Epic 6 futures, loans, insurance, land expansion remain backlog.
