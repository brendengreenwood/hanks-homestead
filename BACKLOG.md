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

### Epic 2 — Crop growth & care  ✅ (v1)
- [x] Per-crop `growTime` in days (wheat 6 → pumpkin 9); `SEASON_LENGTH` bumped to 6
- [x] Moisture model: spring rain grows crops free; summer is dry so they only grow with moisture — water lasts `WATER_DAYS` (3); dry summer days stunt the crop (reduced yield)
- [x] Sprout scales with growth % so crops visibly grow day to day; mature model swaps in at full growth
- [x] Neglect = no harvest (stunted) — wheat is the forgiving starter; the rest need watering
- [ ] Map distinct growth-stage models (kit has wheatStageA/B, cornStageA–D) to progress for richer visuals — future polish
- [ ] Plantable-season variety per crop — future

### Epic 3 — Storage  ✅ (v1)
- [x] Harvest flows into the silo; **selling is year-round** via the elevator (Sell button / modal) — farming actions stay season-locked
- [x] Capacity tied to silo buildings (`BASE_STORAGE` + silos × `SILO_CAPACITY`, currently 40 + 60 = 100); harvest blocks/caps when the silo is full
- [x] Storage HUD: capacity bar + stored/total readout (turns red when full)
- [ ] Per-crop spoilage / shelf life — **deferred to Epic 4** (only a real decision alongside dynamic prices: hold for a better price vs. risk spoiling)

### Epic 4 — Marketplace · spot pricing  ✅ (v1)
- [x] Daily price per commodity: mean-reverting toward a seasonal target (peaks in spring, bottoms at the fall glut) + noise
- [x] Price history + per-crop sparkline + trend arrow + %-vs-mean in the elevator
- [x] Elevator sells at the live spot price (base `sellPrice` = long-run mean)
- [x] Market impact: dumping a big batch dips that crop's price (recovers via daily reversion) — rewards spreading sales
- [x] Spoilage (moved here from Epic 3): perishables lose a daily slice of the stockpile (grain keeps, tomatoes rot fast) — the counter-pressure to holding for the spring peak

### Epic 5 — Marketplace · forward contracts  ✅ (v1)
- [x] Rotating offers (refresh each season): deliver a qty of a crop by a future day at a locked price (8–30% premium over the mean — a hedge)
- [x] Auto-settle on the due day: deliver from storage for the locked price, or pay a 25% default penalty
- [x] Contracts UI inside the elevator: active contracts (with progress + days left) and signable offers

### Epic 6 — Marketplace · futures & speculation  ⏸ deferred
- [ ] Futures curve across future dates; tradable positions with expiry
- [ ] Margin + mark-to-market P&L; close positions early
- [ ] Consider an "advanced market" toggle so it stays approachable
- *DEFERRED: deep speculative sim — margin/liquidation/P&L are very balance-
  sensitive and risky to build blind. Best done with playtesting once the spot
  market + contracts have been felt out in real play.*

### Epic 7 — Progression · land + speed  ✅ (v1)
- [x] **Farm Supply store** (🚜 Supply button) — third storefront alongside seed shop + elevator
- [x] Field plots: buy up to 6 plots, each adds 2 rows of farmland (10×10 → 10×22); field/picking grow dynamically
- [x] Tractor: faster auto-walk + auto-farm cadence (up to ~2.8× at max level)
- [x] Silo upgrade: +60 storage each (stacks with built silos)
- [x] Escalating costs as money sinks; everything persists in the save
- note: decoration props can clip into the field at max expansion — prune later

### Epic 8 — Progression · automation  ✅ (v1: sprinklers)
- [x] Sprinklers: buy from Farm Supply; auto-water all planted crops each summer day
- [x] On/off toggle in the store (shut them off to save money)
- [ ] Tractors/equipment that auto-perform plant/harvest ops — future
- *(auto-harvest/plant automation deferred; sprinklers cover watering)*

### Epic 9 — Operational economy (CapEx vs OpEx)  ✅ (v1)
- [x] Sprinklers cost up front (CapEx) **and** a per-tile fee each summer day they
      run (OpEx) — so automation vs. watering by hand is a real ROI call
- [x] If you can't cover the daily cost, the sprinklers switch themselves off
- [x] Toggle on/off to control spend
- [ ] A consolidated daily P&L readout (revenue − OpEx) — future polish
- *decisions: OpEx is per-tile-per-day; can't-pay → auto-off (no debt yet — see Epic 10)*

### Epic 10 — Financing & debt (stretch)  ⏸ deferred
*DEFERRED alongside Epic 6 — loans/interest/foreclosure are balance-sensitive
and pair naturally with the futures layer; build both with playtesting.*
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
- [x] Save/Load (localStorage autosave + resume)
- [x] Epic 1: day-tick calendar (multi-day, season-locked)
- [x] Epic 2: crops grow over days (seasonal moisture model)
- [x] Epic 3: storage capacity + year-round selling
- [x] Epic 4: dynamic market (seasonal prices, history, market impact) + spoilage
- [x] Epic 5: forward contracts
- [x] Epic 7: Farm Supply store (tractor, silo, field plots)
- [x] Epics 8+9: sprinklers + operating cost (CapEx vs OpEx)
