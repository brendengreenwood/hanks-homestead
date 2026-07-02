# Architecture (active state)

## State model
- All game state lives in **`gameState.current`** (a ref) in `src/Game.jsx`.
  Mutate directly, then `requestRender()` bumps a version counter that
  re-renders the 3D scene + HUD. **Never `useState` for game data.**
- Smooth motion (farmer glide, chickens, camera easing, listener sync) runs in
  `useFrame` reading the ref — never `requestRender()` from a frame loop.
- Persistence: `PERSIST_KEYS` snapshot to localStorage
  (`hanks-homestead-save-v1`), debounced on version change + `beforeunload`.
  Backfills for older saves live in `ensureMarket`/`ensureContracts` and a
  `|| 0` guard on `cell.moisture` (pre-moisture grids produced NaN).

## Layers
| File | Role |
|---|---|
| `src/Game.jsx` | Orchestrator: state, all actions, day tick, job queue, save/load, input |
| `src/game/constants.js` | Pure data + balance numbers + pure helpers |
| `src/game/logic.js` | Pure functions: A* pathfinding, farmland/walkable, snake queue, storage |
| `src/game/audio.js` | Audio engine singleton (mixer graph, sound bank, spatial) |
| `src/game/assets.js` | Model registry (crop stages, decorations, farmer, per-file scales) |
| `src/three/FarmScene.jsx` | r3f scene: tiles, crops, buildings, farmer, lighting, camera |
| `src/ui/Hud.jsx` + `hud.css` | HTML overlay: all UI, both desktop and mobile chrome |

## Job queue (execution model)
Drag-selections become **jobs** `{id, action, crop, tiles, total}` pushed to
`gs.jobs`. `startNextJob()` promotes one to `gs.activeJob`, paths Hank to its
first tile (`isPathing`/`pathQueue`), then hands tiles to the auto-act effect
(`isAutoActing`/`autoActionQueue`). Action **and crop are captured at enqueue
time**, so the player can re-select and queue more work mid-run. Jobs chain on
completion; out-of-resource skips to the next job; manual movement or Escape
cancels everything (`cancelAllJobs`).

## Known debts (from the 2026-07-02 code review)
- `Game.jsx` is a ~1000-line god component; economy logic should extract to
  `logic.js` for testability. No test runner exists yet.
- Timers are per-render `setTimeout` effects, not a single game loop.
- Saves have no schema version; migration is ad-hoc `ensure*` functions.
