# Instructions for Claude Code

You're continuing development on Hank's Homestead, an isometric farming game.

## Critical Context

1. **Pure Canvas rendering** - No React DOM except the canvas element. This was intentional - SVG couldn't handle the 36x36 grid.

2. **State in refs** - All game state lives in `gameState.current`. Mutate directly, call `requestRender()` to update visuals. Do NOT use useState for game data.

3. **Single file game** - `src/Game.jsx` is ~1500 lines. This is fine. Canvas games don't need component decomposition.

4. **Double buffering** - Draw to offscreen canvas, copy to visible. Never clear the visible canvas directly or you get white flash.

## How to Add Features

### Adding a new UI button:

```javascript
// In getUIButtons(), add to the buttons array:
buttons.push({
  id: 'my_button',
  x: 100, y: 10, w: 60, h: 28,
  render: (ctx, btn, isHovered) => {
    drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 4);
    ctx.fillStyle = isHovered ? '#AAA' : '#CCC';
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Click Me', btn.x + btn.w/2, btn.y + btn.h/2);
  },
  onClick: () => { 
    // Do something
    requestRender(); 
  },
});
```

### Adding new game state:

```javascript
// 1. Add to gameState.current initialization:
const gameState = useRef({
  // ... existing state
  myNewThing: initialValue,
});

// 2. Use it:
gs.myNewThing = newValue;
requestRender();

// 3. If it needs to reset, add to resetGame():
gs.myNewThing = initialValue;
```

### Adding a new drawable element:

```javascript
// In render(), after existing drawing code but before ctx.restore():

// Example: Draw a marker at a specific tile
const { x: mx, y: my } = getTileScreen(markerX, markerY);
ctx.beginPath();
ctx.arc(mx, my + TILE_HEIGHT/2, 10, 0, Math.PI * 2);
ctx.fillStyle = 'red';
ctx.fill();
```

### Adding keyboard shortcut:

```javascript
// In handleKeyDown switch statement:
case 'q': 
  // Do something
  requestRender();
  return;
```

### Adding a sound:

```javascript
// In useSound(), add to the returned object:
mySound: () => {
  playTone(440, 0.1, 'sine', 0.1);  // frequency, duration, type, volume
},

// Use it:
sounds.mySound();
```

## Common Patterns

### Drawing isometric tile:
```javascript
const drawTile = (sx, sy, color) => {
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + TILE_WIDTH/2, sy + TILE_HEIGHT/2);
  ctx.lineTo(sx, sy + TILE_HEIGHT);
  ctx.lineTo(sx - TILE_WIDTH/2, sy + TILE_HEIGHT/2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};
```

### Converting grid to screen:
```javascript
const { x: screenX, y: screenY } = getTileScreen(gridX, gridY);
```

### Converting mouse to grid:
```javascript
const tile = fromIso(mouseX, mouseY, gs.zoom, gs.cameraX, gs.cameraY);
```

### Rounded rectangle:
```javascript
drawRoundedRect(ctx, x, y, width, height, radius);
ctx.fill();
ctx.stroke();
```

### Panel with shadow:
```javascript
drawPanel(ctx, x, y, width, height);
```

## What NOT to do

1. **Don't use useState for game data** - Causes re-render cascade and white flash
2. **Don't add React components** - Everything is canvas
3. **Don't clearRect the visible canvas** - Draw to offscreen, copy over
4. **Don't forget requestRender()** - After mutating state, call it or nothing updates

## Likely Next Features

Based on game structure, these make sense to add:

1. **More buildings** - Extend BUILDINGS constant, add placement UI
2. **Save/Load** - localStorage with JSON.stringify(gs)
3. **Weather effects** - Rain particles in render loop
4. **Sprinkler automation** - Building that auto-waters adjacent tiles
5. **Crop varieties** - More entries in CROPS constant
6. **Sound toggle** - UI button to mute
7. **Tutorial** - First-time player guidance
8. **Achievements** - Track milestones

## Running

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## File to Edit

`src/Game.jsx` - That's it. One file.
