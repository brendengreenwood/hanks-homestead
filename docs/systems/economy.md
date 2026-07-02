# Economy (active state)

## Crop niches (sim-tuned 2026-07-02)
Numbers below are **fed profit per tile at the optimal sell day** and
**profit per gold invested** (seed + one 12g jar), computed against the
seasonal price cycle with ceil-spoilage holding on a 60-unit stack.

| Crop | Niche | seed→sell (mean) | shelf | 💧 summer ticks | fed/tile | per-gold |
|---|---|---|---|---|---|---|
| Wheat | Carry anchor: hold to spring peak | 10→25 | ∞ | 1 | 46 | 2.07 |
| Carrot | Low-risk budget produce | 14→42 | 14d | 2 | 37 | 1.43 |
| Tomato | Best per-gold fall cash; spoils fast | 18→62 | 6d | 3 | 63 | 2.11 |
| Corn | Second carry crop; holding costs ~23% spoilage | 30→60 | 60d | 4 | 81 | 1.93 |
| Pumpkin | Per-tile king; capital-gated, thirstiest | 55→112 | 12d | 4 | 102 | 1.52 |

Design invariant: **no crop wins both per-tile and per-gold.** Early/poor →
tomato + wheat; land-constrained late game → pumpkin; patient storage-rich →
wheat/corn carry.

## Upgrades (Farm Supply)
`upgradeCost = base × growth^level`.

| Key | Effect | Base | Growth | Max |
|---|---|---|---|---|
| tractor | +60% action/walk speed per level | 300 | 1.7 | 3 |
| sprinkler | auto-water thirsty tiles (1g/tile/day OpEx) | 500 | 2.0 | 1 |
| silo | +60 storage | 220 | 1.55 | 6 |
| plot | +2 farmland rows | 180 | 1.5 | 6 |
| hauler | +15 bu/day elevator intake | 260 | 1.6 | 4 |

Known untuned (backlog): total upgrade sink (~11k g core) is small vs late-game
income; payback periods on plot/silo are very fast. No fail state or year-end
score yet (deferred Epics 6/10 are the intended pressure source).

## Tuning method
Balance changes go through simulation first — scripts live in the session
scratchpad pattern: model the price cycle + ceil spoilage + feed cost, print
per-crop tables, iterate, then verify by importing the **shipped**
`constants.js`. The scorcher/sprinkler tradeoff was tuned with a Monte Carlo
of watering cadences (20k trials). Don't eyeball numbers into constants.js.
