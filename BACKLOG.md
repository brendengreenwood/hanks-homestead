# 🌾 Hank's Homestead — Backlog

A living list of ideas and features. Add freely; check items off as they ship.
Tell Claude "pick up X from the backlog" and it'll grab one.

**Status:** `[ ]` todo · `[~]` in progress · `[x]` done
**Priority (optional):** `(P1)` next up · `(P2)` soon · `(P3)` someday

---

## 🗺️ Roadmap: The Farm Economy (in design)

The big arc — turn the abstract turn-loop into a living farm economy where you
time the market: sell some of the harvest into the cheap glut, store the rest,
and sell into the rising market before the next harvest.

**Locked directions**
- **Time:** day-tick. "Next" advances **one day**; each season ≈ **14 days** (year ≈ 56 days).
- **Marketplace:** build all three tiers, **phased** — spot → forward contracts → full futures.
- **Progression:** **phased** — buy land plots + speed upgrades first, automation later.

**Build order** (each epic builds on the previous; #1 unblocks everything):

### Epic 1 — Calendar & time foundation  ✅ (v1)
- [x] Day-based clock: `year` / `season` / `dayOfSeason` from a day counter (`SEASON_LENGTH`, currently 3 — bump later)
- [x] "Next" advances one day; season-transition events fire only at season boundaries
- [x] HUD date display (Yr / Day X of N); season chip already shows the season
- [x] Action gating: **decided — keep season-locked** (plant=spring, water/feed=summer, harvest=fall, sell=winter)
- [ ] Crops grow per day (remove instant-mature-at-boundary hack) — deferred to **Epic 2**
- [ ] (pairs well) day/night or seasonal sun angle tied to the clock
- note: bump `SEASON_LENGTH` toward ~14 once Epic 2/3/4 give in-season days purpose

### Epic 2 — Crop growth & care
- [ ] Per-crop `growTime` in days + plantable seasons
- [ ] Moisture/fertility model: water decays over days; neglect slows growth or withers the crop
- [ ] Map growth-stage models to progress %; withered visual
- *open Q: how punishing is neglect — slowdown vs death?*

### Epic 3 — Storage
- [ ] Harvest flows into storage; sell from storage on your own schedule
- [ ] Capacity tied to silo/elevator buildings (upgrade hook); overflow handling
- [ ] Per-crop spoilage / shelf life (grain keeps, produce spoils) → creates pressure to sell
- [ ] Storage HUD: quantities, capacity bar, spoilage timers

### Epic 4 — Marketplace · spot pricing
- [ ] Daily price per commodity: seasonal curve (cheap at harvest glut → climbing toward next harvest) + noise/random walk
- [ ] Price history + chart; trend indicator
- [ ] Elevator UI: sell from storage at spot price; replace fixed `sellPrice` with dynamic price (base = long-run mean)
- *open Q: does dumping a big sell move the price (market impact)?*

### Epic 5 — Marketplace · forward contracts
- [ ] Offered contracts: deliver qty by a date at a locked price (premium/discount to expected spot)
- [ ] Fulfillment on the date; penalty for non-delivery
- [ ] Contracts UI (available / accepted / deadlines)

### Epic 6 — Marketplace · futures & speculation
- [ ] Futures curve across future dates; tradable positions with expiry
- [ ] Margin + mark-to-market P&L; close positions early
- [ ] Consider an "advanced market" toggle so it stays approachable
- *(heaviest epic — balance carefully)*

### Epic 7 — Progression · land + speed
- [ ] **Farm Supply / Hardware Market** — a third storefront (alongside the seed shop & grain elevator) for buying equipment, tools & upgrades
- [ ] Buyable field parcels adjacent to the field; purchasing unlocks more farmable area; cost scaling
- [ ] Equipment/tools: faster walk, faster action cadence, bigger / multi-tile action radius (tractor)
- [ ] Gold balancing so the money loop has meaningful sinks

### Epic 8 — Progression · automation
- [ ] Sprinklers: buy + place to auto-water tiles in range each day (first automation device)
- [ ] Tractors/equipment that auto-perform row ops (till / plant / harvest)
- [ ] Automation buildings; integrates with the operational-cost mechanic below
- *(depends on a working money loop from the marketplace)*

### Epic 9 — Operational economy (CapEx vs OpEx)
The "is it worth automating?" tension. Equipment costs money up front (**CapEx**)
**and** a recurring amount to run (**OpEx**) — so the player weighs manual labor
(free but hands-on) against automation (costs money but scales and saves effort).
- [ ] Recurring expense ledger deducted each day/season for active equipment
- [ ] Sprinklers carry a per-day water/upkeep cost on top of their purchase price
- [ ] Toggle equipment on/off (e.g., shut the sprinklers off in winter) to control spend
- [ ] Daily/seasonal P&L readout: revenue − OpEx − upkeep, so ROI is legible at a glance
- *open Qs: OpEx cadence (per-day vs per-use)? per-tile sprinklers vs a coverage radius? does manual labor cost anything but time? what happens if you can't cover OpEx — equipment idles, or you go into the red?*

### Epic 10 — Financing & debt (stretch)
Builds on Epic 9 — borrow capital to invest now, pay it back with interest. Very
"real farm economics," and a natural answer to the "what if you can't cover OpEx?" question.
- [ ] Loans from a bank / co-op to fund big purchases (tractor, land, elevator upgrade)
- [ ] Interest accrues; repayment shows up as a recurring line alongside OpEx
- [ ] Going into the red opens a debt path rather than a hard block; risk of foreclosure if it spirals
- [ ] Credit / reputation that unlocks better rates as the farm proves itself
- *open Qs: fixed-term loans vs revolving credit line? a bankruptcy lose-condition, or just soft pressure?*

### Cross-cutting
- [ ] **(P1) Save/Load lands early** — state is about to grow a lot and longer games need persistence
- [ ] Ongoing economy / balance tuning

---

## 🌱 Gameplay & Systems (standalone ideas)
- [ ] More crops (each needs a growth-stage model + `CROPS` entry)
- [ ] More buildings: chicken coop, well, market stall, fences around the field
- [ ] Crop quality / fertilizer tiers beyond the current feed bonus

## 🎨 World & Visuals
- [ ] Weather particles — rain in spring/summer, snow in winter
- [ ] Seasonal world dressing — snow cover in winter, autumn leaf tints in fall
- [ ] Tilled-soil rows under crops (kit has `crops_dirtRow` / `crops_dirtSingle`)
- [ ] Fences around the field (kit `fence_*` models)
- [ ] A pond / water feature (kit `ground_river*` tiles) + a footpath to the house
- [ ] Pass on decoration placement so nothing clips the buildings

## 🔊 Audio
- [ ] Chicken "bawk" when they scatter from Hank
- [ ] Footstep sounds while Hank walks
- [ ] SFX polish for build/upgrade actions

## 🖥️ UI / UX
- [ ] Settings panel — music/ambience/SFX volume sliders + mute
- [ ] Onboarding hints / tutorial for first-time players
- [ ] End-of-year / stats screen (best harvest, gold earned)
- [ ] Minimap or camera "recenter on Hank" button

## 🐔 Critters & Life
- [ ] Chickens lay eggs Hank can collect
- [ ] More animals — cow, sheep, or a dog that follows Hank
- [ ] Ambient birds / butterflies drifting over the field

## 📱 Mobile support (cross-cutting) — *foundation v1 in, needs device tuning*
Target: **portrait**, gestures **+ on-screen pad**. Foundation laid; the exact
positions/sizes were built blind and need real-device iteration.
- [x] Touch input: tap a tile to act + drag across tiles to multi-select (unified via a single field picking plane), pinch to zoom, two-finger drag to orbit
- [x] On-screen controls: D-pad (move) + Act button; `move`/`act` wired through `actions`
- [x] Prevent browser gestures hijacking the canvas (viewport meta, `touch-action:none`, overscroll/zoom locked)
- [~] Responsive HUD: portrait reflow + safe-area insets + thumb-cluster controls (centered D-pad with center Act + long-press action/crop menu); needs ongoing real-device polish
- [x] Performance budget: cap device pixel ratio (1.5) + shadow map (1024) + fewer decorations on touch devices
- [ ] Device QA pass: real phones, notch safe-areas, d-pad/act ergonomics, one-handed reach

## 🧰 Tech / Infra
- [ ] Code-split the three.js bundle (`manualChunks`) to clear the >500 kB warning
- [ ] Asset preload + a small loading screen
- [ ] Lightweight tests for `game/logic.js` (pathfinding, snake-queue)

## 🐛 Known issues & polish
- [ ] Fine-tune farmer hat/pitchfork bone offsets (`FARMER` in `assets.js`) — current values are best-guess
- [ ] Tune farmer move/turn/hop feel if needed (`Farmer` useFrame in `FarmScene.jsx`)
- [ ] Confirm chicken yard stays clear of crops at all flee angles

---

## ✅ Recently shipped
- [x] Migrate renderer from Canvas 2D to three.js / react-three-fiber
- [x] Kenney Nature Kit art (crop growth stages, decorations)
- [x] Rigged farmer with bone-attached hat + pitchfork; idle/walk/interact
- [x] Cozy farmstead HUD restyle
- [x] World-anchored speech bubble above Hank
- [x] Procedural barn + grain silo, then a proper cottage for Hank
- [x] Smooth move/turn transitions (fix tile teleporting)
- [x] Barnyard chickens that wander and flee from Hank
