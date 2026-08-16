# Hank's Homestead 🌾

An isometric farming game written in **TypeScript** on the vendored **omen ECS
engine** (raw three.js), with low-poly art from the CC0
[Kenney Nature Kit](https://kenney.nl/assets/nature-kit).
Grow crops through the seasons, play the grain market, and build up the
homestead.

## Quick Start

```bash
pnpm install
pnpm dev         # http://localhost:5173  (append ?seed=42 for a deterministic run)
pnpm build
pnpm test:unit   # vitest (engine + game sim)
pnpm test:e2e    # playwright browser gates
pnpm check       # tsc --noEmit
```

## Controls

| Input | Action |
|-------|--------|
| Left-click on the field | Apply the selected tool (plant / water / feed / harvest) |
| Tool + crop buttons (HUD) | Choose action and crop |
| End day (HUD) | Advance the calendar |
| Shop / Market / Contracts (HUD) | Buy supplies and upgrades, sell crops, take forward contracts |

## Game Loop

Seasons cycle Spring → Summer → Fall → Winter (6 days each): plant in spring,
water/feed in summer (watch for scorchers), harvest in fall, and sell into a
mean-reverting market with a daily elevator intake cap. Automate with
sprinklers and upgrades (CapEx/OpEx), and lock in prices with forward
contracts.

## Project Structure

```
packages/engine/          # omen ECS engine (vendored fork of om-game)
game/
├── src/main.ts           # Boot: renderer, loop, world, scene, HUD wiring
├── src/sim/              # ECS sim: constants, components, systems, actions
├── src/scene/FarmScene.ts# three.js scene: ground, tiles, crops, decorations
├── src/ui/hud.ts         # DOM overlay UI
├── src/assets.ts         # Kenney model registry
├── tests/                # Playwright browser specs
└── public/models/        # GLB assets (nature-kit)
```

See `CLAUDE.md` for architecture notes, `docs/systems/rewrite-omen.md` for the
active systems record, and `BACKLOG.md` for the roadmap.

## Deploying

Hosted on **Netlify** (`hanks-homestead.netlify.app`) with **continuous
deployment from `main`** — pushing to `main` triggers a build + deploy
(`pnpm --filter game build`, publishes `game/dist`).
