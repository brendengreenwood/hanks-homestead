# Session Context for Claude

## Project
Hank's Homestead - isometric farming game, pure canvas rendering in React.

## Current Issue
**BLACK SCREEN** at http://localhost:5176 - need to debug with Chrome extension.

## What We Did This Session

### 1. Fixed Canvas Rendering (COMPLETED)
- Removed fixed 1200x800 canvas dimensions
- Added dynamic sizing based on viewport
- Added devicePixelRatio support for crisp rendering on high-DPI displays
- Canvas now properly scales to window size

### 2. Redesigned Action Bar (IN PROGRESS - BROKEN)
- Moved tools (Plant/Water/Harvest) from top bar to bottom center
- Created WoW/SimCity style action bar with large 64x64 buttons
- Dark semi-transparent panel styling
- Keybinds visible (1, 2, 3)
- When Plant is selected, crops appear in a panel above

### 3. Current State
- Build passes (`npm run build` succeeds)
- Dev server running on port 5176
- Page shows BLACK - likely runtime JS error preventing render
- Body background is `#000` in index.html, so black = nothing rendering

## Key Files
- `src/Game.jsx` - The entire game (~1600 lines)
- `docs/` - Architecture and patterns documentation

## What Needs to Happen
1. Use Chrome MCP to navigate to http://localhost:5176
2. Check browser console for JavaScript errors
3. Fix whatever runtime error is preventing the canvas from rendering

## Architecture Reminders
- NO useState for game data - use `gameState.current` ref
- Double buffer: draw to offscreen canvas, copy to visible
- `requestRender()` triggers redraw
- UI buttons are data objects with render functions, not React components

## Recent Code Changes Location
- `getUIButtons()` function - contains the action bar and crop panel code
- Lines ~490-720 approximately
- The action bar uses CANVAS_WIDTH/CANVAS_HEIGHT from canvasSizeRef

## Dev Server
```bash
cd C:\Users\brend\Documents\hanks-homestead
npm run dev
```
Currently on port 5176.
