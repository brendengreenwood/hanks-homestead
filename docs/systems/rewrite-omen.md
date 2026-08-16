# Rewrite on the omen engine (active state)

> The game is written in TypeScript on the vendored **omen** ECS engine
> (`packages/engine`, forked from om-game by decision D-018). The legacy JS
> app was retired at market-era parity (D-020); the pages describing it live
> in `docs/archive/`. This page is the active architecture record.

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

## Market era (segment 5)

- `MarketSystem` (runs in `endDay` after growth, matching legacy order):
  mean-reversion toward the seasonal target (`seasonalPriceFactor`, cosine
  wave — peaks in spring, bottoms in fall) with ±6% noise from the seeded
  RNG, clamped to 40–190% of `sellPrice`; `PRICE_HISTORY_LEN` 24 days kept
  for the chart. Selling applies market impact — price drops
  `min(25%, qty × 0.4%)` with a 40% floor — and revenue is the average of
  pre-/post-impact price. Spoilage: perishables lose
  `ceil(count / shelfLife)` per day.
- Grain elevator cap: daily intake `ELEVATOR_BASE_INTAKE` 25 +
  hauler × 15; `soldToday` resets each morning. Contract deliveries settle
  **outside** the cap (legacy parity).
- `ContractSystem`: keeps `CONTRACT_SLOTS` 3 offers (crop random, price
  108–130% of `sellPrice`, qty 8–25, due 6–18 days out, all from the seeded
  RNG); offers refresh each season. At the due day a contract settles —
  delivers from storage for `qty × locked price`, or forfeits
  `CONTRACT_PENALTY` 25% of contract value if stock is short.
- Actions: **sell** / **sellAll** (highest price first, fills remaining
  intake), **acceptContract**.
- HUD: market panel (prices, price history, sell buttons, elevator room
  readout), contracts panel (offers + active contracts with due dates),
  day-report lines for spoilage and contract settlements.
- Proof flows (`market-era.spec.ts`, seed 42): sell-cycle with elevator cap,
  contract accept → deliver → payout `qty × locked price`, and the A-001
  deferred sprinkler proof — earn gold by selling, buy the sprinkler through
  the shop, verify auto-watering + OpEx via real UI.

## Legacy retirement (D-020)

- The React/r3f app (`src/`, root `public/`, root `index.html`,
  `vite.config.js`, `package-lock.json`) is deleted; root scripts delegate
  to the workspace (`pnpm dev|build|test:unit|test:e2e|check`). Netlify
  builds `game/` and publishes `game/dist`.

## Out of rewrite parity (follow-ups)

- Audio engine, mobile touch HUD, farmer avatar + job queue presentation.
