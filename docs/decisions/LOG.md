# Decision log

Append-only. Never edit or delete an entry — to reverse a decision, append a
new entry referencing the old one. Format:

```
## D-NNN · YYYY-MM-DD · Title
**What:** the change. **Why:** the reasoning. **Rejected:** alternatives, if any.
```

---

## D-001 · 2026-06-23 · Migrate renderer to three.js via @react-three/fiber
**What:** Replaced the single-file Canvas-2D renderer with r3f v8 + drei v9
(pinned for React 18), declarative scene in `FarmScene.jsx`, HTML HUD overlay.
**Why:** 3D art direction (Kenney Nature Kit) and camera control; declarative
scene keeps React ergonomics. **Rejected:** raw three.js imperative (more
control, much more plumbing); upgrading to React 19 for r3f v9 (churn).

## D-002 · 2026-06-23 · Game state lives in a ref, not useState
**What:** `gameState.current` mutated directly; `requestRender()` bumps a
version counter to re-render scene + HUD; `useFrame` reads the ref for smooth
motion. **Why:** per-frame animation and high-frequency mutations (drag
select) can't churn through setState; one version counter batches everything.

## D-003 · 2026-06-23 · Kenney CC0 kits as the art language; procedural fills the gaps
**What:** Nature Kit GLBs for crops/decor, Mini Characters for the farmer;
barn/silo/house are procedural flat-shaded meshes matched to the kit's look.
Every model falls back to a procedural placeholder via error boundary.
**Why:** kit has no farm buildings; CC0 means zero licensing friction;
fallbacks make missing files a non-event. kenney.nl is network-blocked in the
dev sandbox — GLBs are pulled from GitHub mirrors (see
`public/models/nature-kit/README.md` for known-good repos).

## D-004 · 2026-06-27 · Day-tick seasons; actions season-locked, selling year-round
**What:** Seasons span `SEASON_LENGTH` days (6). Plant=spring, water/feed=
summer, harvest=fall; the elevator buys in **every** season.
**Why:** the core tension is *when to sell*, which needs a calendar that keeps
moving; locking farm actions to seasons keeps a legible rhythm. User decision:
season-locked actions + year-round selling (rejected: market-timing-only with
freeform farming; rejected: selling locked to winter).

## D-005 · 2026-06-27 · Mobile-first foundations before more features
**What:** Portrait-only layout, touch D-pad + long-press action menu,
`pointer: coarse` gates a dedicated mobile chrome; single raycast FieldPlane
for tile picking. **Why:** retrofitting touch later is costlier; touch capture
semantics break per-tile pointer handlers (hence one picking plane).

## D-006 · 2026-07-01 · Discrete camera on mobile
**What:** Free orbit disabled on coarse pointers; UI buttons snap azimuth in
90° steps plus an Iso/Top toggle, eased by a CameraRig. **Why:** touch-orbit
on a grid game mostly produces accidental bad angles; Monument-Valley-style
snaps are predictable and one-thumb friendly. (User direction.)

## D-007 · 2026-07-02 · Corner-anchored touch HUD
**What:** D-pad bottom-right, NEXT bottom-left, econ column top-right, camera
cluster left edge — all `env(safe-area-inset-*)` aware. World-space building
labels hidden on mobile. **Why:** "iPhone corner rules" (user direction);
thumb reachability; labels collided with the left-edge controls.

## D-008 · 2026-07-02 · Multi-agent design review as the tuning source
**What:** Ran a six-dimension adversarial review (loop, economy-with-sims,
mobile UX, code health, presentation, identity) + cross-examining critic; its
confirmed findings drove D-009…D-013. **Why:** the economy had never met a
spreadsheet; independent reviewers with simulations beat vibes. Scores were
5–6.5/10 with the verdict "well-designed economy that hasn't been tuned."

## D-009 · 2026-07-02 · Bug pass: five confirmed defects fixed
**What:** (1) HUD storage bar ignored purchased silos (missing arg);
(2) winter Act button dead-ended (no `sell` branch — now opens the market);
(3) Reset gained a confirm (it deleted the save with one tap);
(4) spoilage `floor→ceil` (piles smaller than shelfLife never spoiled);
(5) market impact applied **before** pricing via `sellRevenue` (batch fills at
avg of pre/post-impact price) so dumping no longer beats spreading.
**Why:** each verified against code/sim; #5 inverted the economy's core
incentive (dump 8,550g vs spread 8,835–8,950g after the fix).

## D-010 · 2026-07-02 · Feed costs real resources
**What:** Feed went from free (+100% yield, a non-decision) to 12g/tile — and
later that day to a **store-bought consumable** (jars of plant food, D-016).
**Why:** free feed silently doubled every ROI in the game and collapsed the
summer decision space; a withered fed tile now burns a real investment.

## D-011 · 2026-07-02 · Crop niches, sim-tuned
**What:** Retuned CROPS so no crop dominates both profit/tile and
profit/gold: wheat=carry anchor, carrot=low-risk budget (growTime 7),
tomato=best per-gold fall cash (shelf 6), corn=second carry (shelf 60, real
spoilage cost), pumpkin=per-tile king gated by capital+thirst (seed 55).
**Why:** pumpkin previously won every axis (5x spread); the ceil-spoilage fix
(D-009) had also silently killed the carry trade for everything but wheat, so
carry was rebuilt deliberately via shelf-life tuning. Numbers verified by
simulation against shipped constants (see `systems/economy.md`).

## D-012 · 2026-07-02 · Scorcher days + smart sprinklers
**What:** Each summer day has a 30% chance soil dries 2 instead of 1 (with
notification + heat-wave lighting); sprinklers water only thirsty tiles
(moisture < 2) before the growth tick. **Why:** manual watering costs 0g, so
sprinkler ROI was numerically nonexistent; scorchers make the watering
cadence a decision (lazy 3-day cadence → ~51% wither on 4-tick crops, Monte
Carlo) and sprinklers become genuine insurance. **Rejected:** action-points/
energy per day (bigger design swing than the pacing problem justified).

## D-013 · 2026-07-02 · Legibility pass: mechanics show themselves
**What:** Moisture-graded soil tint (wet/drying/parched), scorcher heat-wave
light, feed cost/stock on the button, crop stat lines in the shop, shelf life
in the sell modal. **Why:** review + user: tuning is worthless if the player
can't see it. Also healed NaN moisture from pre-moisture saves.

## D-014 · 2026-07-02 · Advisor dock + indicators + almanac; job queue
**What:** Hank's speech moved off the 3D world into a portrait dock
(Warcraft-style); live indicator chips deep-link into a four-tab Almanac
generated from constants; drag-selections became an RTS-style **job queue**
(action+crop captured at enqueue, cancelable chips, jobs chain).
**Why:** user direction ("expose the purpose of each element… think like a
mobile game designer"; "queue up planting while Hank works"). The queue
refactor also fixed a scheduler race (second drag mid-run corrupted the live
queue).

## D-015 · 2026-07-02 · Daily elevator intake cap
**What:** The elevator takes 25 bu/day (+15/level via new Grain Hauler
upgrade, max 4). Per-crop 1/5/Max sell buttons + intake meter; Sell Max fills
remaining room highest-price-first. Contracts deliver **outside** the cap.
**Why:** user direction ("divvy out your crop over time"); makes the
market-timing game structural instead of optional — spread-vs-dump had teeth
(D-009 #5) but nothing *forced* multi-day selling.

## D-016 · 2026-07-02 · Audio engine with mixer, brighter SFX, spatial panning; music off
**What:** `src/game/audio.js`: SFX bus → 200Hz highpass → master → compressor;
one-shots scheduled on the audio clock; tile sounds route through equal-power
panners with the listener glued to the camera; material-reactive footsteps
(grass/dry dirt/wet squelch keyed to per-tile moisture). Music + never-shipped
nature ambience disabled behind `MUSIC_ENABLED` (also removed a ~15MB eager
WAV preload and four guaranteed-404 fetches). **Why:** user: SFX "too bassy" —
the old plant thud was a 120Sine; user asked for a mixer/engine and spatial
audio as a system; music off pending a proper soundtrack.

## D-017 · 2026-07-02 · Crop state reads from the plants, not status orbs
**What:** Removed all status pips + the green mature beacon. Growth = real
Kenney stage models (corn A→B→C→D; leaf sprout→leafs→fruit for the rest;
Food-Kit tomato replaces the red-flower stand-in, with per-file scale
override). Fed = 12% lusher; withered = drooping/shrunken; mature = pristine
bloom + golden Sparkles. Stage URLs preloaded. **Why:** user direction; orbs
were UI noise in the world, and the kit ships real stage props (mirror-fetched
corn B/C; melon + turnip downloaded for future crops).

## D-018 * 2026-08-16 * Rewrite on the vendored omen ECS engine (TypeScript workspace)
**What:** Repo converted to a pnpm workspace: `packages/engine` (omen, copied verbatim from om-game and intentionally forked) + `game/` (TS rewrite). Sim rebuilt as ECS systems (Calendar/Weather/Growth/Soil) with seeded RNG and vitest parity tests on the legacy balance constants; presentation rendered through the engine Renderer/Loop (raw three.js) with the Kenney registry ported verbatim; DOM HUD with data-testids; playwright browser gates drive real UI (manual era: plant/water/harvest shipped first). Legacy `src/` frozen as reference until parity. **Why:** full adoption of the om-game pattern; the legacy mutable-ref architecture had zero test coverage, so a rebuilt ECS sim core is what makes the unit gates meaningful. **Rejected:** hosting the game inside the om-game workspace (repo lineage preferred); incremental TS-ification without ECS.

## D-019 * 2026-08-16 * Automation era ported to the ECS sim (sprinklers, feed, CapEx/OpEx)
**What:** UPGRADES table ported verbatim (tractor/sprinkler/silo/plot/hauler, baseCost x growth^level). SprinklerSystem runs before growth in endDay (legacy order): summer-only, waters thirsty non-mature crops at 1 gold/tile OpEx, self-disables when broke. Feed action + Farm Supply shop (seeds/plant food/upgrades) + sprinkler toggle in the HUD; endDay returns a DayReport rendered as messages. Plot upgrade spawns new tile rows; FarmScene creates soil meshes lazily so the rows render. Playwright runs serially (parallel headless WebGL contexts stall the GPU). **Why:** segment 4 of the omen rewrite; mechanics parity with the shipped balance-v1 automation loop.

## D-020 * 2026-08-16 * Market era shipped; legacy React/r3f app retired
**What:** MarketSystem (mean-reverting seasonal prices with seeded noise, 40-190% clamp, 24-day history, market impact on sales, daily elevator intake cap 25 + hauler x15, spoilage ceil(count/shelfLife)) and ContractSystem (3 rolling offers at 8-30% premium, seasonal refresh, settle-on-due with 25% default penalty, deliveries bypass the cap) ported verbatim into the ECS sim; sell/sellAll/acceptContract actions; HUD market + contracts panels with day-report lines. Playwright proofs (seed 42) cover the sell cycle, contract payout, and the A-001 deferred sprinkler purchase funded by real selling. With parity reached, the legacy app is deleted: src/, root public/, index.html, vite.config.js, package-lock.json; root scripts delegate to the pnpm workspace; Netlify builds game/dist; legacy systems pages archived as docs/archive/legacy-*.md. **Why:** segment 5 completes the manual - automated - market-player economic arc, the rewrite's parity claim; keeping the dead app invites divergent edits. **Rejected:** keeping src/ as a reference (git history suffices); porting audio/mobile HUD now (explicit follow-ups).

## D-021 * 2026-08-16 * Legacy presentation props restored in the omen scene (A-002)
**What:** Ported the legacy procedural buildings (barn, house with chimney smoke, silo at their legacy grid placements), the five wandering/fleeing barnyard chickens, Hank (Kenney character GLB, scale 1.4, bone-attached straw hat + pitchfork, walk/idle animation crossfade, one-shot interact gesture, eased glide to clicked tiles, procedural fallback), and mouse-wheel camera zoom (12-70 range) into `game/src/scene/props.ts` + `FarmScene.update(dt)`, driven by the engine Loop's delta. The character GLB references a `Textures/colormap.png` that never shipped with the kit export; a LoadingManager URL modifier resolves it to a 1x1 white pixel so boot stays console-clean. **Why:** the rewrite (D-018..D-020) reached mechanics parity but dropped these presentation elements; the user flagged the gap while playing the proof script (amendment A-002). **Rejected:** sourcing the Kenney colormap texture (never existed in the repo; the legacy app had the same silent miss); weakening the playwright console-error gate.
