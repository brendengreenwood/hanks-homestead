# 🌾 Hank's Homestead — Backlog

A living list of ideas and features. Add freely; check items off as they ship.
Tell Claude "pick up X from the backlog" and it'll grab one.

**Status:** `[ ]` todo · `[~]` in progress · `[x]` done
**Priority (optional):** `(P1)` next up · `(P2)` soon · `(P3)` someday

---

## 🌱 Gameplay & Systems
- [ ] (P1) Save / Load — persist `gameState` to `localStorage`, restore on load
- [ ] Sprinkler / automation building that auto-waters nearby tiles each turn
- [ ] More crops (each needs a growth-stage model + `CROPS` entry)
- [ ] More buildings: chicken coop, well, market stall, fences around the field
- [ ] Tool / farm upgrades (bigger plant radius, faster walk, more seeds)
- [ ] Economy & balance pass (prices, starting gold, upgrade costs)
- [ ] Crop quality / fertilizer tiers beyond the current feed bonus

## 🎨 World & Visuals
- [ ] (P2) Day/night lighting cycle — move the sun, warm glow in house windows at night
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
