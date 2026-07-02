# Interface (active state)

## Layout
**Desktop:** season chip + left-stack top-left; Sell/Shop/Supply/📖/Reset
top-right; action bar bottom-center; NEXT bottom-right; inventory left-center.
**Mobile (`pointer: coarse`)** — dedicated chrome, desktop widgets hidden:
- Top bar: season/date · gold pill · storage pill (opens market)
- Right edge (top): Sell / Seeds / Supply / Reset (Reset confirms first)
- Left edge (mid): camera cluster — ⟲ 90° snaps ⟳ + Iso/Top toggle
- Bottom-right: D-pad with center Act button; bottom-left: NEXT
- All corners `env(safe-area-inset-*)` aware; economy panels are bottom sheets

## Teaching layer (left-stack, both platforms)
- **Advisor dock:** Hank's framed portrait; his speech docks beside it (no
  world bubbles). Tap → Almanac.
- **Indicator chips** (live conditions, tap → relevant Almanac tab):
  🔥 scorcher today · 🥵 N parched crops (summer) · 🥀 N withered ·
  🎒 storage ≥80% · 📜 contract due ≤2d · 📈 stored crop ≥15% over mean.
- **Job queue chips:** running job (icon + crop + ×remaining) + queued jobs,
  each with ✕ cancel.
- **Almanac:** four tabs (Seasons / Water / Crops / Market) generated from
  constants — the system explainer. Entry points: portrait, chips, 📖 button.

## Touch controls
- Tap Act = current action; **long-press Act (420ms)** = action/crop menu
  (feed shows jar count; crops show seed counts).
- Drag on the field = rect selection → queued job. Single invisible
  `FieldPlane` handles all picking (touch pointer-capture safe).
- Free camera orbit is desktop-only (right-drag); mobile uses the discrete
  cluster + pinch zoom.

## Known gaps (backlog)
- Long-press is the only mobile route to action/crop switching — undiscovered
  by new players (needs onboarding hint).
- Some money-flow tap targets (contract Sign, +1/+5) are under 44pt.
- No haptics; no camera recenter-on-Hank; tablets get phone chrome.
