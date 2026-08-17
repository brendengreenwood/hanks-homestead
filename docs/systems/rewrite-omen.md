# Rewrite on the omen engine (active state)

> The game is being rewritten in TypeScript on the vendored **omen** ECS
> engine (`packages/engine`, forked from om-game by decision D-018). The
> legacy JS app in `src/` is frozen as a porting reference until the rewrite
> reaches parity; the pages describing it (`architecture.md`, `farm-loop.md`,
> etc.) remain the legacy record and will be archived when `src/` retires.

## Workspace

- pnpm workspace: `packages/engine` (package `omen`, vendored verbatim) +
  `game/` (package `game`, the rewrite app).
- Gates: `pnpm --filter omen|game exec vitest run`, `tsc --noEmit` per
  package, `pnpm --filter game test` (playwright, real browser + dev server),
  `pnpm --filter game build`.

## Sim (ECS)

- `game/src/sim/constants.ts` — legacy balance values ported **verbatim**
  (CROPS, SEASONS, SEASON_LENGTH 6, WATER_DAYS 3, SCORCH_CHANCE 0.3,
  FEED_COST 12, ELEVATOR_BASE_INTAKE 25, BASE_STORAGE 40, SILO_CAPACITY 60,
  grid math WORLD_SIZE 36 / FIELD_SIZE 10 / FIELD_OFFSET 13), with parity
  unit tests.
- `createFarmWorld(seed)` (`sim/world.ts`) spawns 100 Tile entities and the
  Farm/Calendar/Weather singletons on the engine `World`. Seeded mulberry32
  RNG; `?seed=` URL param pins runs for reproducible proofs.
- Day tick (`endDay()`): Calendar → Weather (scorcher roll) → Growth → Soil,
  matching the legacy day-tick order.
- Components: `Tile` (moisture, watered), `Crop` (crop, growth, fed,
  harvestPenalty), `Weather` (scorcher), `Farm` (gold 200, 10 seeds/crop,
  5 plant food, storage, silos=1 → capacity 100).

## Manual-era actions (`sim/actions.ts`)

- **plant** — spring-only, consumes a seed, adds a `Crop` at growth 0.
- **water** — summer-only, sets moisture to `WATER_DAYS`, marks soil watered.
- **harvest** — fall-only, requires `growth ≥ growTime`; yield 1 withered /
  2 fed / 1 otherwise; blocked when the silo lacks room
  (`BASE_STORAGE + silos × SILO_CAPACITY`).
- All actions return `{ok, message}`; failures surface as HUD toasts.

## Presentation

- Renders through the engine's `Renderer`/`Loop` (raw three.js, no r3f).
- `game/src/assets.ts` — Kenney registry ported verbatim from
  `src/game/assets.js` (crop stage models, per-file scales, decorations).
  GLBs live in `game/public/models/`.
- `scene/FarmScene.ts` — soil tiles + crop stage models via cached GLTF
  loads; placeholder cones until/if a model resolves (missing assets never
  blank the scene); seasonal sky/grass palette from `SEASONS`; withered
  crops tinted; raycast tile picking on left click.
- `ui/hud.ts` — DOM overlay: tool buttons (plant/water/harvest), crop
  select, **End day**, gold/date/storage readouts, seed inventory. All
  controls carry `data-testid`s so playwright proof flows drive the exact
  controls a human clicks.

## Automation era (segment 4)

- `UPGRADES` table ported verbatim: tractor / sprinkler / silo / plot /
  hauler with baseCost × growth^level pricing and max levels; helpers
  `upgradeCost`, `fieldHeight`, `speedFactor`, `elevatorIntake`.
- `Farm` gains `upgrades` record + `sprinklerOn`; buying the plot upgrade
  spawns new tile rows (`ROWS_PER_PLOT` 2); silo upgrades raise capacity.
- `SprinklerSystem` (runs before growth in `endDay`, matching legacy order):
  summer-only, waters thirsty non-mature crops, charges
  `SPRINKLER_COST_PER_TILE` (1 gold) per tile, switches itself off when
  gold runs out. `endDay()` returns a `DayReport` (sprinkler OpEx,
  scorcher) rendered as HUD messages.
- Actions: **feed** (summer-only, consumes plant food, doubles yield),
  **buySeeds**/**buyFeed**, **buyUpgrade**, **toggleSprinkler**.
- HUD: feed tool, Farm Supply modal (seeds / plant food / upgrades),
  sprinkler ON/OFF toggle (visible once owned), day-report messages.
- FarmScene creates soil meshes lazily so plot-expansion rows render/pick.

## Not yet ported (later segments)

- Market era: dynamic prices, elevator intake cap, selling, spoilage,
  forward contracts (segment 5).
- Out of rewrite parity: audio engine, mobile touch HUD, farmer avatar +
  job queue presentation (follow-ups).
