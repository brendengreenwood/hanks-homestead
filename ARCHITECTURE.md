# Architecture

## Why Canvas?

We started with SVG. A 36x36 grid = 1,296 tiles, each with multiple SVG elements = 10,000+ DOM nodes. Browser couldn't handle it. Canvas draws everything as pixels in one element. Smooth 60fps.

## State Management

**No React state for game data.** React re-renders cause canvas to flash white. Instead:

```javascript
const gameState = useRef({
  gold: 200,
  farmerPos: { x: 17, y: 17 },
  grid: [...],  // 36x36 array
  // ... all game state
});

const gs = gameState.current;  // Shorthand

// To trigger re-render after mutation:
const [, forceUpdate] = useState(0);
const requestRender = useCallback(() => forceUpdate(n => n + 1), []);

// Usage:
gs.gold += 100;
requestRender();
```

This pattern: mutate refs directly, call `requestRender()` when you want visual update.

## Coordinate Systems

```
Grid Coords (x, y)     →  Isometric (isoX, isoY)  →  Screen (screenX, screenY)
     (0,0)                                              
       ↓                                                
    toIso(x, y)         →  { isoX: (x-y)*32, isoY: (x+y)*16 }
       ↓                                                
    + offsets           →  screenX = isoX + WORLD_OFFSET_X + WORLD_CENTER_X
                           screenY = isoY + WORLD_OFFSET_Y
       ↓                                                
    + camera            →  final position after ctx.translate(cameraX, cameraY)
       ↓
    + zoom              →  final position after ctx.scale(zoom, zoom)
```

**Inverse (mouse → tile):**
```javascript
fromIso(screenX, screenY, zoom, cameraX, cameraY) → { x, y }
```

## Render Pipeline

```javascript
render() {
  // 1. Fill with sky (prevents white flash)
  ctx.fillStyle = skyColor;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  ctx.save();
  
  // 2. Apply transforms (order matters!)
  ctx.translate(centerX, centerY);   // Move origin to center
  ctx.scale(zoom, zoom);              // Scale around center
  ctx.translate(-centerX, -centerY); // Move origin back
  ctx.translate(cameraX, cameraY);   // Apply camera pan
  
  // 3. Draw world (back to front for isometric)
  for y: for x: drawTile(x, y);
  drawPath();
  drawBuildings();
  drawFarmer();
  
  ctx.restore();
  
  // 4. Draw UI (no transforms, screen coordinates)
  for button in getUIButtons(): button.render(ctx);
  drawNotification();
  
  // 5. Copy to visible canvas (atomic, no flicker)
  visibleCtx.drawImage(offscreen, 0, 0);
}
```

## Double Buffering

Draw to offscreen canvas, copy to visible canvas in one operation:

```javascript
// Create once
offscreenRef.current = document.createElement('canvas');

// In render:
const ctx = offscreenRef.current.getContext('2d');
// ... draw everything ...
visibleCtx.drawImage(offscreenRef.current, 0, 0);
```

This prevents the white flash that happens if you clear + draw directly.

## UI Button System

Buttons are data, not components:

```javascript
const getUIButtons = () => {
  const buttons = [];
  
  buttons.push({
    id: 'shop',
    x: 100, y: 10, w: 60, h: 28,
    render: (ctx, btn, isHovered) => {
      // Draw button with ctx
      drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 4);
      ctx.fillStyle = isHovered ? '#FEF08A' : '#FEF9C3';
      ctx.fill();
      ctx.fillText('Shop', btn.x + btn.w/2, btn.y + btn.h/2);
    },
    onClick: () => { gs.showShop = !gs.showShop; requestRender(); },
  });
  
  return buttons;
};
```

**Hit detection:**
```javascript
const getButtonAt = (x, y) => {
  for (const btn of getUIButtons().reverse()) {  // Top-most first
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
      return btn;
    }
  }
  return null;
};
```

**Hover state:**
```javascript
const uiState = useRef({ hoveredButton: null });

// In mouse move:
const btn = getButtonAt(x, y);
if (btn?.id !== uiState.current.hoveredButton) {
  uiState.current.hoveredButton = btn?.id || null;
  requestRender();
}
```

## Pathfinding (A*)

Standard A* with Manhattan heuristic:

```javascript
const findPath = (startX, startY, endX, endY) => {
  // Returns array of {x, y} steps, or [] if no path
};
```

Buildings are obstacles. Farmer walks around them.

## Auto-Plant System

1. User drags selection on farmland
2. Build queue in snake pattern starting from drag start
3. If farmer not at first cell, pathfind there first
4. Process queue: move farmer, plant, next cell
5. Stop if out of seeds

```javascript
gs.autoPlantQueue = [{ x, y }, ...];
gs.isAutoPlanting = true;
// useEffect processes queue with setTimeout
```

## Camera System

```javascript
gs.cameraX = -632;  // Offset to center on field
gs.cameraY = -316;
gs.isPanning = false;
gs.panStartMouse = null;
gs.panStartCamera = null;
```

**Panning:**
- Space down → `isPanning = true`
- Mouse down while panning → record start positions
- Mouse move while panning → `camera = panStart + (mouse - mouseStart) / zoom`
- Space up → end panning

## Seasons

```javascript
const season = gs.day % 2 === 1 ? 'spring' : 'fall';
```

- **Spring** (odd days): Plant and water
- **Fall** (even days): Harvest only

Sleep button advances day. Spring→Fall matures all crops instantly.

## Constants

```javascript
FIELD_SIZE = 10        // Farmable area
WORLD_SIZE = 36        // Total world
FIELD_OFFSET = 13      // Field starts here (centered)
TILE_WIDTH = 64
TILE_HEIGHT = 32
CANVAS_WIDTH = 1200
CANVAS_HEIGHT = 800
```

## Sound System

Web Audio API synth sounds:

```javascript
const sounds = useSound();
sounds.plant();   // Earthy plop
sounds.water();   // Splash
sounds.harvest(); // Ascending chime
sounds.sell();    // Cash register
sounds.error();   // Descending buzz
sounds.buy();     // Coin clink
```

## Performance Notes

- 36x36 = 1,296 tiles rendered per frame
- Double buffering prevents flash
- Only re-render when state changes (not continuous loop)
- Mouse hover updates throttled (only when tile changes)
- All state in refs (no React re-render cascade)
