# Market (active state)

## Price cycle
- `seasonalPriceFactor(day)`: cosine over the 24-day year — **peak mid-spring
  (1.35×)**, **trough mid-fall (0.65×)**. ~2.08× nominal spread.
- `tickMarket()` daily: mean-revert 40% toward `mean × factor × noise(0.94–
  1.06)`, clamped to 0.4–1.9× mean. 24-day history feeds the sparklines.

## Selling
- **Daily intake cap:** the elevator takes `elevatorIntake(upgrades)` bushels
  per day — 25 base, +15 per Grain Hauler level (max 85). `gs.soldToday`
  tracks it (persisted, reset each dawn). Big harvests must be divvied out
  across days.
- **Market impact:** `sellRevenue(id, qty)` prices a batch at the **average of
  pre- and post-impact price** (impact = up to −25% at 60+ qty), so dumping
  earns less per unit than spreading sales while the price recovers via
  mean-reversion. Verified: 60 pumpkins at peak = 8,550g dumped vs 8,950g over
  three days.
- Sell modal: intake meter, per-crop **1 / 5 / Max** buttons, Sell Max fills
  remaining room highest-price-first. Winter Act button opens this modal.

## Storage & spoilage
- Capacity = `BASE_STORAGE 40` + 60/silo (buildings + bought upgrades).
  Harvest stops when full.
- Spoilage daily: `ceil(count / shelfLife)` for shelfLife < 999 — a batch is
  gone within its shelf life regardless of pile size. Grain (wheat) keeps
  forever; corn (60d) is the only other real carry crop.

## Forward contracts
- 3 offers, refreshed each season; premium 1.08–1.30× **mean** (not expected
  spot), due `day + 6 + rand(0–11)`. Auto-deliver from storage on the due day;
  default costs 25% of contract value (gold-clamped at 0).
- Contracts deliver **outside the daily intake cap** — part of the premium's
  value. Their natural niche: perishables that can't survive to the spring
  peak.
- Known untuned (backlog): fixed 8–25 qty doesn't scale with farm size;
  premiums ignore the seasonal cycle (a spring-due contract can be worse than
  spot); a fresh-game offer can be due before the first possible harvest.
