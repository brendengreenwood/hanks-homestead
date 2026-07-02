# Farm loop (active state)

## Calendar
- `SEASON_LENGTH = 6` days per season; 4 seasons per year (24 days).
- Actions are season-locked: **plant** (spring), **water/feed** (summer),
  **harvest** (fall). **Sell** is the winter action but the elevator buys
  year-round. Winter→spring wipes the grid (`makeGrid()`) — unharvested crops
  are lost.

## Growth & water
- A crop ripens after `growTime` growth ticks. Spring rain grows everything
  free (moisture topped to 2); summer ticks only count if the tile has
  moisture. Fall/winter: no growth.
- One watering = `WATER_DAYS = 3` days of moisture. Soil tint shows the level:
  wet (≥2) / drying (1) / parched (0).
- **Scorchers:** each summer day has `SCORCH_CHANCE = 0.3` of drying soil 2
  instead of 1 (🔥 notification + amber heat-wave lighting). A tile at 0
  moisture on a summer tick **withers** (`harvestPenalty`): the crop droops,
  shrinks, and loses its feed bonus. Watering every 2 days is scorcher-proof;
  every 3 days withers ~51% of 4-tick crops.
- Planting timing: spring d1 gives 5 rain ticks + 2 carried moisture. Wheat
  (growTime 6) matures on rain alone — the forgiving starter. Corn/pumpkin
  (9) need 4 watered summer ticks — the risk crops.

## Feed (plant food)
- 🧪 Jars bought at the seed store (`FEED_COST = 12`g), 5 free on a new game.
- One jar doubles a tile's harvest (1→2) **unless the crop withers** — a
  withered fed tile wastes the jar. Fed plants render 12% lusher.

## Sprinklers
- Upgrade (500g, max 1) + `sprinklerOn` toggle in Farm Supply. Each summer
  morning, waters every **thirsty** tile (moisture < 2) at
  `SPRINKLER_COST_PER_TILE = 1`g — runs before the growth tick, so it's
  scorcher-proof. Auto-disables when broke. Value = insurance + attention-free
  summers, not raw gold ROI.

## Jobs (bulk work)
Drag across tiles → snake-ordered job. Jobs queue (see
`architecture.md`), capture action+crop at drag time, chain automatically,
and show as cancelable chips in the HUD. Tractor upgrade speeds walking and
acting (`speedFactor`, up to 2.8x).
