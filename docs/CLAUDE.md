# CLAUDE.md

## Quick Start
```bash
npm install
npm run dev
```

## Critical Rules

1. **NO useState for game data** - Use `gameState.current` ref, mutate directly, call `requestRender()`
2. **Double buffer** - Draw to offscreen canvas, copy to visible. Never clearRect visible canvas.
3. **UI is data** - Buttons are objects with render functions, not React components

## Files

- `src/Game.jsx` - The entire game (~1500 lines, intentionally single file)
- `docs/ARCHITECTURE.md` - How the engine works
- `docs/PATTERNS.md` - Code patterns for adding features
- `docs/GAME.md` - Game design and mechanics
- `docs/ROADMAP.md` - Future features

## State

All game state lives in `gameState.current`. Key fields:
- `gold`, `inventory`, `day`
- `farmerPos`, `farmerDir`, `isMoving`
- `selectedTool`, `selectedCrop`
- `grid` (36x36 array of tiles)
- `buildings` (array of placed buildings)
- `zoom`, `cameraX`, `cameraY`

## The Vibe

Midwest American farmer named Hank. Honest work. The game should feel satisfying - good sounds, clear feedback, every action matters.
