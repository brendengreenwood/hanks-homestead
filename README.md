# Hank's Homestead 🌾

An isometric farming game built with React + Canvas. Pure canvas rendering, no DOM except the canvas element itself.

## Quick Start

```bash
npm install
npm run dev
```

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Move farmer |
| E | Perform action (plant/water/harvest) |
| 1 | Select plant tool |
| 2 | Select water tool |
| 3 | Select harvest tool |
| Space (hold) + Drag | Pan camera |
| Scroll | Zoom in/out |
| Right-click | Pathfind to tile |
| Left-drag on field | Select area to auto-plant |
| Escape | Cancel action / close shop |

## Game Loop

1. **Spring**: Plant seeds, water crops
2. **Fall**: Harvest mature crops, sell for gold
3. Buy more seeds, repeat

## Project Structure

```
hanks-homestead/
├── src/
│   ├── main.jsx      # Entry point
│   └── Game.jsx      # Everything (single file game)
├── index.html
├── package.json
├── vite.config.js
├── ARCHITECTURE.md   # Technical deep-dive
├── CLAUDE.md         # Instructions for Claude Code
└── README.md         # This file
```

## Why Single File?

The game is ~1500 lines in one file. This is intentional:
- Canvas games don't benefit from React's component model
- All state is in refs to avoid re-render cascades
- Render function draws everything in one pass
- Easier to understand the full picture

When to split: If you add major features (multiplayer, save system, level editor), consider extracting constants, sound system, and UI definitions into separate files.
